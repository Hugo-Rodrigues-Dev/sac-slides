"""
Entraînement : la boucle « agir → mémoriser → réviser → corriger » des slides.

    uv run train                         # α appris automatiquement
    uv run train --alpha 0.2 --run runs/alpha_0.2   # α fixé à la main, pour comparer
"""

from __future__ import annotations

import argparse
import csv
import json
import time
from collections import deque
from pathlib import Path

import numpy as np
import torch

from .env import CarTrackEnv
from .sac import SAC, ReplayBuffer, SACConfig


def main():
    parser = argparse.ArgumentParser(description="Entraîne le robot avec SAC")
    parser.add_argument("--steps", type=int, default=60_000, help="nombre total de pas dans l'environnement")
    parser.add_argument("--random-steps", type=int, default=5_000, help="pas joués au hasard avant d'apprendre")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--run", type=str, default="runs/auto", help="dossier de sortie")
    parser.add_argument("--alpha", type=float, default=None, help="fixer α à la main (sinon il est appris)")
    parser.add_argument("--obstacles", type=int, default=0, help="nombre max de plots posés au hasard à chaque épisode")
    parser.add_argument("--sensors", action="store_true", help="donner les 7 rayons à la voiture, même sans plots")
    parser.add_argument("--v2", action="store_true", help="version 2 : 15 rayons × 2 mesures sur 18 m, choc à −40, plots partout")
    parser.add_argument("--curriculum", action="store_true", help="1 plot max au début, puis 2, puis --obstacles")
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    out = Path(args.run)
    (out / "checkpoints").mkdir(parents=True, exist_ok=True)

    sensors = args.sensors or args.obstacles > 0 or args.v2
    env = CarTrackEnv(obstacles=args.obstacles, sensors=sensors, v2=args.v2)
    (out / "config.json").write_text(json.dumps({"obstacles": args.obstacles, "sensors": sensors, "v2": args.v2,
                                                  "curriculum": args.curriculum, "alpha": args.alpha,
                                                  "steps": args.steps, "seed": args.seed}))

    def max_obstacles_at(step: int) -> int:
        """Curriculum : on augmente la difficulté par paliers."""
        if not args.curriculum or args.obstacles <= 1:
            return args.obstacles
        if step < args.steps // 4:
            return 1
        if step < args.steps // 2:
            return min(2, args.obstacles)
        return args.obstacles
    obs_dim, act_dim = env.observation_space.shape[0], env.action_space.shape[0]
    agent = SAC(obs_dim, act_dim, SACConfig(), fixed_alpha=args.alpha)
    buffer = ReplayBuffer(obs_dim, act_dim, agent.cfg.buffer_size)

    # Instantanés de l'acteur pour le visualiseur : du robot « aléatoire » au robot entraîné
    snapshots = sorted({0, args.steps // 6, args.steps // 3, args.steps // 2, 3 * args.steps // 4, args.steps})

    metrics_file = open(out / "metrics.csv", "w", newline="")
    metrics = csv.writer(metrics_file)
    metrics.writerow(["step", "episode", "return", "finished", "off", "length", "alpha", "entropy", "q_mean"])

    env.max_obstacles = max_obstacles_at(0)
    s, _ = env.reset(seed=args.seed)
    ep, ep_return, ep_len = 0, 0.0, 0
    recent = deque(maxlen=50)
    last_stats = {"alpha": agent.alpha, "entropy": float("nan"), "q_mean": float("nan")}
    t0 = time.time()

    for step in range(args.steps + 1):
        if step in snapshots:
            torch.save(agent.actor.state_dict(), out / "checkpoints" / f"actor_{step:07d}.pt")
        if step == args.steps:
            break

        # 1. Agir : au début au hasard (remplir la mémoire), ensuite avec l'acteur
        if step < args.random_steps:
            a = env.action_space.sample()
        else:
            a = agent.actor.act(s)

        s2, r, terminated, truncated, info = env.step(a)

        # 2. Mémoriser. On ne marque « fini » que les vraies fins (pas la limite de temps)
        buffer.add(s, a, r, s2, float(terminated))
        s = s2
        ep_return += r
        ep_len += 1

        # 3 + 4. Réviser un lot au hasard et corriger acteur, critiques, α, cibles
        if step >= args.random_steps:
            last_stats = agent.update(buffer)

        if terminated or truncated:
            recent.append(info["finished"])
            metrics.writerow([step, ep, round(ep_return, 3), int(info["finished"]), int(info["off"]), ep_len,
                              round(last_stats["alpha"], 5), round(last_stats["entropy"], 4), round(last_stats["q_mean"], 3)])
            ep += 1
            ep_return, ep_len = 0.0, 0
            env.max_obstacles = max_obstacles_at(step)
            s, _ = env.reset()

        if step % 2_000 == 0 and step > 0:
            rate = 100 * np.mean(recent) if recent else 0.0
            print(f"pas {step:>7,} | épisodes {ep:>4} | arrivées {rate:5.1f} % (50 derniers) "
                  f"| α {last_stats['alpha']:.3f} | entropie {last_stats['entropy']:+.2f} | {time.time() - t0:5.0f} s",
                  flush=True)
            metrics_file.flush()

    metrics_file.close()
    print(f"\nTerminé en {time.time() - t0:.0f} s. Résultats dans {out}/")
    print("Étape suivante :  uv run export   puis ouvrir viewer/index.html")


if __name__ == "__main__":
    main()
