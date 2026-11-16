"""
Soft Actor-Critic, écrit à la main pour être lu.

Les pièces correspondent aux slides :
- Actor            → « l'acteur choisit l'action » (une gaussienne écrasée par tanh)
- Critic ×2        → « deux critiques qui notent », on garde le min
- critics_target   → les réseaux cibles, qui suivent doucement (τ)
- log_alpha        → la température α, apprise automatiquement
- ReplayBuffer     → la mémoire où l'on pioche 256 souvenirs au hasard
"""

from __future__ import annotations

import copy
import math
from dataclasses import dataclass

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


def mlp(n_in: int, n_out: int, hidden: int = 256) -> nn.Sequential:
    return nn.Sequential(
        nn.Linear(n_in, hidden), nn.ReLU(),
        nn.Linear(hidden, hidden), nn.ReLU(),
        nn.Linear(hidden, n_out),
    )


# ============================================================== Replay buffer

class ReplayBuffer:
    """Mémoire circulaire des transitions (s, a, r, s', fini)."""

    def __init__(self, obs_dim: int, act_dim: int, capacity: int):
        self.s = np.zeros((capacity, obs_dim), np.float32)
        self.a = np.zeros((capacity, act_dim), np.float32)
        self.r = np.zeros((capacity, 1), np.float32)
        self.s2 = np.zeros((capacity, obs_dim), np.float32)
        self.done = np.zeros((capacity, 1), np.float32)
        self.capacity, self.i, self.size = capacity, 0, 0

    def add(self, s, a, r, s2, done):
        self.s[self.i], self.a[self.i], self.r[self.i] = s, a, r
        self.s2[self.i], self.done[self.i] = s2, done
        self.i = (self.i + 1) % self.capacity
        self.size = min(self.size + 1, self.capacity)

    def sample(self, n: int):
        idx = np.random.randint(0, self.size, size=n)   # au hasard : anciens comme récents
        return tuple(torch.as_tensor(x[idx]) for x in (self.s, self.a, self.r, self.s2, self.done))


# ===================================================================== Acteur

class Actor(nn.Module):
    """Prend l'état, sort une moyenne μ et un écart-type σ pour chaque dimension d'action."""

    def __init__(self, obs_dim: int, act_dim: int):
        super().__init__()
        self.net = mlp(obs_dim, 2 * act_dim)

    def forward(self, s: torch.Tensor):
        mu, log_std = self.net(s).chunk(2, dim=-1)
        log_std = log_std.clamp(-5.0, 2.0)
        return mu, log_std

    def sample(self, s: torch.Tensor):
        """Tire une action et renvoie aussi log π(a|s) (utile pour l'entropie)."""
        mu, log_std = self(s)
        std = log_std.exp()
        u = mu + std * torch.randn_like(mu)        # astuce de reparamétrisation : le hasard est à part
        a = torch.tanh(u)                          # tanh borne l'action dans [-1, 1]
        logp = torch.distributions.Normal(mu, std).log_prob(u).sum(-1, keepdim=True)
        # Correction due à tanh (changement de variable) : log(1 - tanh(u)²), version stable
        logp -= (2 * (math.log(2) - u - F.softplus(-2 * u))).sum(-1, keepdim=True)
        return a, logp

    @torch.no_grad()
    def act(self, s: np.ndarray, deterministic: bool = False) -> np.ndarray:
        s = torch.as_tensor(s, dtype=torch.float32).unsqueeze(0)
        if deterministic:                          # en évaluation : on joue la moyenne
            return torch.tanh(self(s)[0]).squeeze(0).numpy()
        return self.sample(s)[0].squeeze(0).numpy()


# ================================================================== Critiques

class Critic(nn.Module):
    """Q(s, a) : prend l'état ET l'action, sort une seule note."""

    def __init__(self, obs_dim: int, act_dim: int):
        super().__init__()
        self.net = mlp(obs_dim + act_dim, 1)

    def forward(self, s, a):
        return self.net(torch.cat([s, a], dim=-1))


# ======================================================================== SAC

@dataclass
class SACConfig:
    gamma: float = 0.99        # poids du futur
    tau: float = 0.005         # vitesse de suivi des réseaux cibles
    lr: float = 3e-4           # taux d'apprentissage des réseaux
    batch_size: int = 256      # souvenirs révisés à chaque pas
    buffer_size: int = 1_000_000


class SAC:
    def __init__(self, obs_dim: int, act_dim: int, cfg: SACConfig = SACConfig(), fixed_alpha: float | None = None):
        self.cfg = cfg
        self.fixed_alpha = fixed_alpha   # None : α appris (SAC v2) ; sinon α fixé à la main (SAC v1)
        self.actor = Actor(obs_dim, act_dim)
        self.q1, self.q2 = Critic(obs_dim, act_dim), Critic(obs_dim, act_dim)
        self.q1_target, self.q2_target = copy.deepcopy(self.q1), copy.deepcopy(self.q2)
        for p in list(self.q1_target.parameters()) + list(self.q2_target.parameters()):
            p.requires_grad_(False)

        # α est appris : on optimise log α pour qu'il reste positif
        self.log_alpha = torch.tensor([math.log(fixed_alpha) if fixed_alpha else 0.0], requires_grad=True)
        self.target_entropy = -float(act_dim)     # cible par défaut : −(nb de dimensions d'action)

        self.actor_opt = torch.optim.Adam(self.actor.parameters(), lr=cfg.lr)
        self.q_opt = torch.optim.Adam(list(self.q1.parameters()) + list(self.q2.parameters()), lr=cfg.lr)
        self.alpha_opt = torch.optim.Adam([self.log_alpha], lr=cfg.lr)

    @property
    def alpha(self) -> float:
        return self.log_alpha.exp().item()

    def update(self, buffer: ReplayBuffer) -> dict:
        s, a, r, s2, done = buffer.sample(self.cfg.batch_size)
        alpha = self.log_alpha.exp().detach()

        # ---- 1. Critiques : se rapprocher de la cible de Bellman « soft »
        with torch.no_grad():
            a2, logp2 = self.actor.sample(s2)                       # action suivante tirée par l'acteur ACTUEL
            q_next = torch.min(self.q1_target(s2, a2), self.q2_target(s2, a2))   # le plus prudent des deux
            y = r + self.cfg.gamma * (1 - done) * (q_next - alpha * logp2)       # + bonus d'entropie
        q1, q2 = self.q1(s, a), self.q2(s, a)
        q_loss = F.mse_loss(q1, y) + F.mse_loss(q2, y)
        self.q_opt.zero_grad()
        q_loss.backward()
        self.q_opt.step()

        # ---- 2. Acteur : viser les actions bien notées, sans devenir trop sûr de lui
        a_new, logp = self.actor.sample(s)
        q_new = torch.min(self.q1(s, a_new), self.q2(s, a_new))
        actor_loss = (alpha * logp - q_new).mean()
        self.actor_opt.zero_grad()
        actor_loss.backward()
        self.actor_opt.step()

        # ---- 3. Température : α monte si l'entropie est sous la cible, baisse sinon
        if self.fixed_alpha is None:
            alpha_loss = -(self.log_alpha * (logp.detach() + self.target_entropy)).mean()
            self.alpha_opt.zero_grad()
            alpha_loss.backward()
            self.alpha_opt.step()

        # ---- 4. Réseaux cibles : on les rapproche de 0,5 % des critiques
        with torch.no_grad():
            for net, target in ((self.q1, self.q1_target), (self.q2, self.q2_target)):
                for p, p_t in zip(net.parameters(), target.parameters()):
                    p_t.mul_(1 - self.cfg.tau).add_(self.cfg.tau * p)

        return {
            "q_loss": q_loss.item(),
            "actor_loss": actor_loss.item(),
            "alpha": self.alpha,
            "entropy": -logp.mean().item(),
            "q_mean": q1.mean().item(),
        }
