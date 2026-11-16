"""
Expérience : une voiture entraînée SANS plots s'adapte-t-elle quand on en ajoute ?

    uv run compare

Trois voitures passent exactement les mêmes 200 épisodes (mêmes départs, mêmes plots) :
- « aveugle »  : entraînée sur la piste seule, sans capteurs (elle ne peut pas voir un plot)
- « capteurs » : entraînée sur la piste seule, AVEC capteurs, sans jamais voir de plot
- « plots »    : entraînée avec des plots posés au hasard (le cas favorable)
On joue l'action moyenne (comme en évaluation).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch

from .env import CarTrackEnv
from .sac import Actor

AGENTS = [("aveugle", "runs/auto"), ("capteurs", "runs/sensors"), ("plots", "runs/obstacles_long")]


def load(run: Path) -> tuple[Actor, bool]:
    config = json.loads((run / "config.json").read_text()) if (run / "config.json").exists() else {}
    sensors = config.get("sensors", config.get("obstacles", 0) > 0)
    obs_dim = 12 + (7 if sensors else 0)
    actor = Actor(obs_dim, 2)
    actor.load_state_dict(torch.load(sorted((run / "checkpoints").glob("actor_*.pt"))[-1]))
    actor.eval()
    return actor, sensors


def run_episodes(actor: Actor, sensors: bool, obstacles: int, n: int) -> dict:
    res = {"arrivées": 0, "plot percuté": 0, "sortie de route": 0, "temps écoulé": 0}
    for i in range(n):
        env = CarTrackEnv(obstacles=obstacles, sensors=sensors)
        s, _ = env.reset(seed=30_000 + i)
        while True:
            with torch.no_grad():
                mu, _ = actor(torch.as_tensor(s).unsqueeze(0))
            s, _, terminated, truncated, info = env.step(torch.tanh(mu).squeeze(0).numpy())
            if terminated or truncated:
                key = "arrivées" if info["finished"] else "plot percuté" if info["hit"] else "sortie de route" if info["off"] else "temps écoulé"
                res[key] += 1
                break
    return {k: round(100 * v / n) for k, v in res.items()}


def main():
    parser = argparse.ArgumentParser(description="Compare les voitures face à des plots jamais vus")
    parser.add_argument("--episodes", type=int, default=200)
    args = parser.parse_args()
    out = {}
    for name, run in AGENTS:
        if not (Path(run) / "checkpoints").exists():
            print(f"{name:<9} : pas d'entraînement dans {run}")
            continue
        actor, sensors = load(Path(run))
        empty = run_episodes(actor, sensors, 0, args.episodes)
        cones = run_episodes(actor, sensors, 3, args.episodes)
        out[name] = {"sans plots": empty, "avec plots": cones}
        print(f"{name:<9}  sans plots : {empty['arrivées']:3d} % arrivées   |   avec 0 à 3 plots : {cones['arrivées']:3d} % arrivées, "
              f"{cones['plot percuté']:3d} % plot percuté, {cones['sortie de route']:3d} % sortie de route")
    Path("runs/compare.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print("Écrit runs/compare.json")


if __name__ == "__main__":
    main()
