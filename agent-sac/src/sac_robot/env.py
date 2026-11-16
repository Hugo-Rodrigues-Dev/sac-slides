"""
L'environnement : une voiture qui doit prendre un virage en épingle.

C'est la piste de l'exposé (vue de dessus, en mètres) : une ligne droite qui monte,
un demi-tour de rayon 5 m, une ligne droite qui redescend. La route fait 3 m de large.

C'est un MDP comme en cours :

- État s     : ce que la voiture perçoit (écart au milieu de la route, angle par
               rapport à la route, vitesse, forme de la route devant elle).
- Action a   : deux nombres CONTINUS dans [-1, 1]
               a[0] = volant (-1 = 30° à droite, +1 = 30° à gauche)
               a[1] = pédale (-1 = vitesse visée nulle, +1 = vitesse visée maximale)
               → impossible de faire un argmax comme dans le DQN : c'est
                 exactement le cas où SAC est utile.
- Récompense : + les mètres parcourus le long de la route, −10 si la voiture sort
               de la route, +10 si elle arrive au bout.

Le compromis : aller vite rapporte plus, mais trop vite dans le virage, les pneus
décrochent et la voiture tire tout droit.
"""

from __future__ import annotations

import math

import gymnasium as gym
import numpy as np
from gymnasium import spaces

# ---- La piste (mêmes chiffres que les slides) ----
R = 5.0                        # rayon du virage, au milieu de la route
L = 8.0                        # longueur des lignes droites
HALF = 1.5                     # demi-largeur de la route
CAR_HALF = 0.5                 # demi-largeur de la voiture
S_END = 2 * L + math.pi * R    # longueur totale (≈ 31,7 m)

# ---- La voiture ----
WHEELBASE = 2.0                # empattement (m)
MAX_STEER = math.radians(30)   # braquage maximal
V_MAX = 12.0                   # vitesse maximale (m/s)
SPEED_LAG = 0.3                # la vitesse rejoint la vitesse visée avec un peu de retard
GRIP = 7.0                     # accélération latérale maximale avant de glisser (m/s²)
DT = 0.1                       # durée d'un pas (s)
MAX_STEPS = 300                # 30 secondes maximum

LOOKAHEAD = (3.0, 6.0, 10.0)   # la voiture « regarde » la route à 3, 6 et 10 m devant elle

# ---- Obstacles (option) : des plots posés sur la route, que la voiture voit avec 7 rayons ----
OBST_R = 0.35                  # rayon d'un plot (m)
CAR_RADIUS = 0.5               # la voiture vue comme un disque pour les chocs
N_RAYS = 7
RAY_ANGLES = [math.radians(a) for a in (-60, -40, -20, 0, 20, 40, 60)]
RAY_RANGE = 8.0
RAY_STEP = 0.25


def track_point(s: float, d: float) -> tuple[float, float]:
    """Position (x, y) à la distance s le long de la route, avec un écart latéral d (d < 0 : intérieur)."""
    if s <= L:
        return R + d, s
    if s <= L + math.pi * R:
        phi = (s - L) / R
        return (R + d) * math.cos(phi), L + (R + d) * math.sin(phi)
    return -(R + d), L - (s - L - math.pi * R)


def track_heading(s: float) -> float:
    """Direction de la route à la distance s."""
    if s <= L:
        return math.pi / 2
    if s <= L + math.pi * R:
        return (s - L) / R + math.pi / 2
    return -math.pi / 2


def project(x: float, y: float) -> tuple[float, float]:
    """L'inverse : distance s le long de la route et écart latéral d d'un point (x, y)."""
    if y > L:
        phi = math.atan2(y - L, x)
        return L + phi * R, math.hypot(x, y - L) - R
    if x >= 0:
        return y, x - R
    return L + math.pi * R + (L - y), -x - R


def wrap(a: float) -> float:
    return (a + math.pi) % (2 * math.pi) - math.pi


def ray_distances(x: float, y: float, heading: float, obstacles: list[tuple[float, float]]) -> list[float]:
    """Distance jusqu'au bord de la route ou à un plot, pour chaque rayon (plafonnée à RAY_RANGE)."""
    out = []
    for rel in RAY_ANGLES:
        a = heading + rel
        dx, dy = math.cos(a), math.sin(a)
        dist = RAY_RANGE
        t = RAY_STEP
        while t < RAY_RANGE:
            px, py = x + dx * t, y + dy * t
            _, d = project(px, py)
            if abs(d) > HALF or any((px - ox) ** 2 + (py - oy) ** 2 < OBST_R ** 2 for ox, oy in obstacles):
                dist = t
                break
            t += RAY_STEP
        out.append(dist)
    return out


class CarTrackEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, obstacles: int = 0, sensors: bool | None = None):
        """obstacles = 0 : la piste seule (version des slides). obstacles = n : jusqu'à n plots
        posés au hasard à chaque épisode. sensors : la voiture reçoit 7 rayons de « vue »
        (par défaut, seulement s'il y a des plots ; on peut les activer sur la piste seule)."""
        super().__init__()
        self.max_obstacles = obstacles
        self.sensors = obstacles > 0 if sensors is None else sensors
        self.obstacles: list[tuple[float, float]] = []
        self.action_space = spaces.Box(-1.0, 1.0, shape=(2,), dtype=np.float32)
        # écart, angle (sin, cos), vitesse, route devant (3 × sin/cos), action précédente (2), [+ 7 rayons]
        n = 4 + 2 * len(LOOKAHEAD) + 2 + (N_RAYS if self.sensors else 0)
        self.observation_space = spaces.Box(-1.0, 1.0, shape=(n,), dtype=np.float32)

    def place_obstacles(self, points: list[tuple[float, float]]):
        """Pose des plots à la main (positions x, y)."""
        self.obstacles = list(points)

    def _obs(self) -> np.ndarray:
        s, d = project(self.x, self.y)
        rel = wrap(self.heading - track_heading(s))
        ahead = []
        for k in LOOKAHEAD:
            r = wrap(track_heading(min(S_END, s + k)) - self.heading)
            ahead += [math.sin(r), math.cos(r)]
        rays = [r / RAY_RANGE for r in ray_distances(self.x, self.y, self.heading, self.obstacles)] if self.sensors else []
        return np.array([d / HALF, math.sin(rel), math.cos(rel), self.v / V_MAX, *ahead, *self.last_action, *rays],
                        dtype=np.float32).clip(-1, 1)

    def reset(self, *, seed: int | None = None, options: dict | None = None):
        super().reset(seed=seed)
        d0 = float(self.np_random.uniform(-0.5, 0.5))
        self.x, self.y = track_point(0.5, d0)
        self.heading = math.pi / 2 + float(self.np_random.uniform(-0.1, 0.1))
        self.v = float(self.np_random.uniform(2.0, 4.0))
        self.last_action = np.zeros(2)
        self.steps = 0
        self.s, _ = project(self.x, self.y)
        self.obstacles = []
        if self.max_obstacles:
            n = int(self.np_random.integers(0, self.max_obstacles + 1))
            spots = sorted(self.np_random.uniform(5.0, S_END - 4.0, size=n))
            for i, sp in enumerate(spots):
                if i and sp - spots[i - 1] < 4.0:
                    continue
                # un plot d'un côté de la route : il reste toujours un passage de l'autre côté
                side = 1.0 if self.np_random.random() < 0.5 else -1.0
                self.obstacles.append(track_point(float(sp), side * float(self.np_random.uniform(0.3, 1.0))))
        return self._obs(), {}

    def step(self, action):
        a = np.clip(np.asarray(action, dtype=np.float64), -1.0, 1.0)
        steer = a[0] * MAX_STEER
        target_v = (a[1] + 1) / 2 * V_MAX

        # Vitesse : rejoint la vitesse visée avec un peu de retard
        self.v += (target_v - self.v) * min(1.0, DT / SPEED_LAG)
        # Virage (modèle « vélo ») : trop vite, l'adhérence limite le virage et la voiture élargit
        turn_rate = self.v * math.tan(steer) / WHEELBASE
        max_rate = GRIP / max(self.v, 0.1)
        turn_rate = max(-max_rate, min(max_rate, turn_rate))
        self.heading = wrap(self.heading + turn_rate * DT)
        self.x += self.v * math.cos(self.heading) * DT
        self.y += self.v * math.sin(self.heading) * DT
        self.last_action = a
        self.steps += 1

        s, d = project(self.x, self.y)
        progress = s - self.s
        self.s = s
        hit = any(math.hypot(self.x - ox, self.y - oy) < OBST_R + CAR_RADIUS for ox, oy in self.obstacles)
        off = abs(d) > HALF - CAR_HALF or hit
        finished = s >= S_END

        reward = progress - 0.01
        if off:
            reward -= 10.0
        if finished and not off:
            reward += 10.0

        terminated = off or finished
        truncated = self.steps >= MAX_STEPS
        return self._obs(), reward, terminated, truncated, {"off": off, "hit": hit, "finished": finished and not off, "s": s, "d": d}
