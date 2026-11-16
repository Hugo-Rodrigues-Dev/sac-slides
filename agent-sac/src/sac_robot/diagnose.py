"""
Diagnostic : OÙ et POURQUOI la voiture percute-t-elle les plots ?

    uv run diagnose --run runs/obstacles_long
    uv run diagnose --run runs/v2_seed0 --placement anywhere

Pour chaque plot rencontré, on note s'il a été évité ou percuté, avec :
- l'endroit : 1re ligne droite, virage, 2e ligne droite ;
- sa position en travers de la route : bord intérieur, milieu, bord extérieur ;
- la vitesse de la voiture quand elle arrive à sa hauteur ;
- le nombre de plots de l'épisode.
"""

from __future__ import annotations

import argparse
import math
from collections import defaultdict
from pathlib import Path

import torch

from . import env as E
from .compare import load
from .env import CarTrackEnv, project


def zone(s: float) -> str:
    return "ligne droite 1" if s <= E.L else "virage" if s <= E.L + math.pi * E.R else "ligne droite 2"


def lateral(d: float) -> str:
    return "intérieur" if d < -0.4 else "extérieur" if d > 0.4 else "milieu"


def main():
    parser = argparse.ArgumentParser(description="Où la voiture percute-t-elle les plots ?")
    parser.add_argument("--run", type=str, required=True)
    parser.add_argument("--placement", choices=["side", "anywhere"], default=None)
    parser.add_argument("--episodes", type=int, default=300)
    args = parser.parse_args()
    actor, cfg = load(Path(args.run))
    placement = args.placement or ("anywhere" if cfg["v2"] else "side")

    stats = defaultdict(lambda: [0, 0])   # clé → [évités, percutés]
    speeds = {"évité": [], "percuté": []}
    for i in range(args.episodes):
        env = CarTrackEnv(obstacles=3, sensors=cfg["sensors"], v2=cfg["v2"], placement=placement)
        s, _ = env.reset(seed=50_000 + i)
        cones = sorted((project(x, y), (x, y)) for x, y in env.obstacles)
        if not cones:
            continue
        speed_at = {}
        while True:
            with torch.no_grad():
                mu, _ = actor(torch.as_tensor(s).unsqueeze(0))
            s, _, terminated, truncated, info = env.step(torch.tanh(mu).squeeze(0).numpy())
            for (cs, _), _xy in cones:
                if cs not in speed_at and info["s"] >= cs - 1.0:
                    speed_at[cs] = env.v
            if terminated or truncated:
                break
        for (cs, cd), _xy in cones:
            if info["s"] > cs + 0.6:
                outcome = "évité"
            elif info["hit"] and abs(info["s"] - cs) < 2.0:
                outcome = "percuté"
            else:
                continue   # pas atteint (choc plus tôt, sortie de route…)
            k = 0 if outcome == "évité" else 1
            stats[("endroit", zone(cs))][k] += 1
            stats[("position", lateral(cd))][k] += 1
            stats[("nb de plots", str(len(cones)))][k] += 1
            if cs in speed_at:
                speeds[outcome].append(speed_at[cs])

    print(f"Agent {args.run} · plots placés « {placement} » · {args.episodes} épisodes\n")
    for group in ("endroit", "position", "nb de plots"):
        print(group.upper())
        for (g, key), (ok, ko) in sorted(stats.items()):
            if g != group:
                continue
            print(f"  {key:<16} {ok + ko:4d} plots   évités {100 * ok / (ok + ko):5.1f} %   percutés {ko}")
        print()
    for k, v in speeds.items():
        if v:
            print(f"vitesse moyenne en arrivant sur un plot {k:<8}: {sum(v) / len(v):4.1f} m/s")


if __name__ == "__main__":
    main()
