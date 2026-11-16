"""
Compare les voitures face aux mêmes plots.

    uv run compare

Chaque voiture passe exactement les mêmes épisodes (mêmes départs, mêmes plots), dans deux
conditions : plots d'un seul côté de la route (« côté ») et plots n'importe où, y compris au
milieu (« partout »). On joue l'action moyenne et on compte les plots évités un par un.
Plusieurs graines d'un même agent sont moyennées (avec l'écart min–max).
"""

from __future__ import annotations

import argparse
import glob
import json
from pathlib import Path

import numpy as np
import torch

from .env import CarTrackEnv, project
from .sac import Actor

AGENTS = [
    ("capteurs, jamais vu de plot", ["runs/sensors"]),
    ("v1 : entraînée avec plots", ["runs/obstacles_long"]),
    ("v2 : 15 rayons × 2, choc −40, curriculum", sorted(glob.glob("runs/v2_seed*"))),
]


def load(run: Path) -> tuple[Actor, dict]:
    config = json.loads((run / "config.json").read_text()) if (run / "config.json").exists() else {}
    v2 = config.get("v2", False)
    sensors = config.get("sensors", config.get("obstacles", 0) > 0)
    env = CarTrackEnv(obstacles=0, sensors=sensors, v2=v2)
    actor = Actor(env.observation_space.shape[0], 2)
    actor.load_state_dict(torch.load(sorted((run / "checkpoints").glob("actor_*.pt"))[-1]))
    actor.eval()
    return actor, {"v2": v2, "sensors": sensors}


def evaluate(actor: Actor, cfg: dict, placement: str, n: int) -> dict:
    """Arrivées (épisodes avec au moins un plot) et plots évités un par un."""
    arrived = episodes = passed = hit = 0
    for i in range(n):
        env = CarTrackEnv(obstacles=3, sensors=cfg["sensors"], v2=cfg["v2"], placement=placement)
        s, _ = env.reset(seed=40_000 + i)
        cones = sorted(project(x, y)[0] for x, y in env.obstacles)
        while True:
            with torch.no_grad():
                mu, _ = actor(torch.as_tensor(s).unsqueeze(0))
            s, _, terminated, truncated, info = env.step(torch.tanh(mu).squeeze(0).numpy())
            if terminated or truncated:
                break
        if not cones:
            continue
        episodes += 1
        arrived += int(info["finished"])
        passed += sum(1 for c in cones if info["s"] > c + 0.6)
        hit += int(info["hit"])
    return {"arrivées": 100 * arrived / max(episodes, 1), "plots évités": 100 * passed / max(passed + hit, 1)}


def main():
    parser = argparse.ArgumentParser(description="Compare les voitures face aux mêmes plots")
    parser.add_argument("--episodes", type=int, default=300)
    args = parser.parse_args()
    out = {}
    for name, runs in AGENTS:
        runs = [Path(r) for r in runs if (Path(r) / "checkpoints").exists()]
        if not runs:
            print(f"{name:<42} : pas d'entraînement trouvé")
            continue
        res = {}
        for placement in ("side", "anywhere"):
            vals = [evaluate(*load(r), placement, args.episodes) for r in runs]
            res[placement] = {k: [round(v[k], 1) for v in vals] for k in vals[0]}
        out[name] = {"graines": len(runs), **res}
        fmt = lambda xs: f"{np.mean(xs):5.1f} %" + (f" ({min(xs):.0f}–{max(xs):.0f})" if len(xs) > 1 else "")
        print(f"{name:<42} [{len(runs)} graine(s)]  côté : évités {fmt(res['side']['plots évités'])}, arrivées {fmt(res['side']['arrivées'])}"
              f"   |   partout : évités {fmt(res['anywhere']['plots évités'])}, arrivées {fmt(res['anywhere']['arrivées'])}")
    Path("runs/compare.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print("Écrit runs/compare.json")


if __name__ == "__main__":
    main()
