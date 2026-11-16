"""
Extrait les VRAIS chiffres des entraînements pour les slides de l'exposé.

    uv run export-slides       # écrit runs/slides_data.json

Pour chaque entraînement (α appris, et α fixés à la main) :
- taux d'arrivée de la politique (actions tirées au hasard dans la politique, comme pendant l'entraînement)
- entropie réelle : moyenne de −log π(a|s) sur les états visités
- μ et σ du volant et de la pédale à l'entrée du virage (mesurés en tirant 4 000 actions)
- quelques trajectoires réellement conduites
Et les courbes d'apprentissage de l'entraînement où α est appris.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path

import numpy as np
import torch

from . import env as E
from .env import CarTrackEnv
from .sac import Actor

TRAJ_SEEDS = [101, 102, 103, 104, 105, 106, 107, 108]
EVAL_EPISODES = 60


def load_actor(run: Path) -> Actor:
    env = CarTrackEnv()
    actor = Actor(env.observation_space.shape[0], env.action_space.shape[0])
    ckpt = sorted((run / "checkpoints").glob("actor_*.pt"))[-1]
    actor.load_state_dict(torch.load(ckpt))
    actor.eval()
    return actor


def episode(actor: Actor, seed: int, record: bool):
    """Un épisode avec la politique stochastique : on tire l'action dans la gaussienne, comme à l'entraînement."""
    torch.manual_seed(seed)
    env = CarTrackEnv()
    s, _ = env.reset(seed=seed)
    pts, logps, ref_state = [], [], None
    while True:
        st = torch.as_tensor(s).unsqueeze(0)
        with torch.no_grad():
            a, logp = actor.sample(st)
        logps.append(-logp.item())
        if ref_state is None and env.s >= E.L:
            ref_state = s.copy()
        if record:
            pts.append([round(env.x, 2), round(env.y, 2), round(env.heading, 3)])
        s, _, terminated, truncated, info = env.step(a.squeeze(0).numpy())
        if terminated or truncated:
            if record:
                pts.append([round(env.x, 2), round(env.y, 2), round(env.heading, 3)])
            outcome = "ok" if info["finished"] else "off"
            return outcome, pts, logps, ref_state


def summarize(run: Path) -> dict:
    actor = load_actor(run)
    outcomes, entropies, ref, times = [], [], None, []
    for i in range(EVAL_EPISODES):
        outcome, _, logps, ref_state = episode(actor, 5000 + i, record=False)
        outcomes.append(outcome)
        if outcome == "ok":
            times.append(len(logps) * E.DT)
        entropies += logps
        if ref is None and ref_state is not None:
            ref = ref_state
    # μ et σ à l'entrée du virage : on tire 4 000 actions dans la politique
    with torch.no_grad():
        st = torch.as_tensor(ref).unsqueeze(0).repeat(4000, 1)
        acts = actor.sample(st)[0].numpy()
    steer, pedal = acts[:, 0], (acts[:, 1] + 1) / 2
    trajs = []
    for seed in TRAJ_SEEDS:
        outcome, pts, _, _ = episode(actor, seed, record=True)
        trajs.append({"outcome": outcome, "dur": round(len(pts) * E.DT, 2), "pts": pts})
    return {
        "success": round(100 * outcomes.count("ok") / len(outcomes)),
        "lapTime": round(float(np.mean(times)), 2) if times else None,
        "entropy": round(float(np.mean(entropies)), 2),
        "steerMu": round(float(steer.mean()), 3), "steerSigma": round(float(steer.std()), 3),
        "pedalMu": round(float(pedal.mean()), 3), "pedalSigma": round(float(pedal.std()), 3),
        "trajectories": trajs,
    }


def curves(run: Path, points: int = 41) -> dict:
    rows = list(csv.DictReader(open(run / "metrics.csv")))
    last_step = int(rows[-1]["step"])
    out = {"step": [], "success": [], "alpha": [], "entropy": []}
    for b in range(points):
        step = last_step * b / (points - 1)
        sel = [r for r in rows if int(r["step"]) <= step]
        out["step"].append(int(step))
        if not sel:
            out["success"].append(0); out["alpha"].append(1.0); out["entropy"].append(None)
            continue
        recent = sel[-50:]
        out["success"].append(round(100 * sum(int(r["finished"]) for r in recent) / len(recent)))
        out["alpha"].append(round(float(sel[-1]["alpha"]), 4))
        e = sel[-1]["entropy"]
        out["entropy"].append(None if e == "nan" else round(float(e), 2))
    return out


def main():
    parser = argparse.ArgumentParser(description="Exporte les chiffres réels pour les slides")
    parser.add_argument("--runs", type=str, default="runs")
    parser.add_argument("--out", type=str, default="runs/slides_data.json")
    args = parser.parse_args()
    runs = Path(args.runs)
    fixed = sorted((p for p in runs.glob("alpha_*") if (p / "checkpoints").exists()), key=lambda p: float(p.name.split("_")[1]))
    data = {"fixed": [], "auto": None, "curves": curves(runs / "auto")}
    for p in fixed:
        alpha = float(p.name.split("_")[1])
        d = summarize(p) | {"alpha": alpha}
        print(f"α = {alpha:<6} arrivées {d['success']:3d} %  tour {d['lapTime']} s  entropie {d['entropy']:+.2f}  "
              f"volant σ {d['steerSigma']:.3f}  pédale σ {d['pedalSigma']:.3f}")
        data["fixed"].append(d)
    data["auto"] = summarize(runs / "auto")
    a = data["auto"]
    print(f"α appris → arrivées {a['success']} %  entropie {a['entropy']:+.2f}  α final {data['curves']['alpha'][-1]}")
    Path(args.out).write_text(json.dumps(data, separators=(",", ":")))
    print(f"Écrit {args.out}")


if __name__ == "__main__":
    main()
