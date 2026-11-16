"""
Prépare le labo dans le navigateur : l'agent y conduit EN DIRECT.

    uv run export --run runs/sensors --name "Capteurs, jamais vu de plot"
    uv run export --run runs/obstacles_long --name "Entraînée avec des plots"
    # chaque export écrit viewer/agents/<dossier>.js ; le labo charge ceux listés dans viewer/agents/index.js

On exporte, pour chaque instantané de l'entraînement, les poids du réseau acteur
(le navigateur refait le calcul du réseau lui-même) et ses statistiques, plus les
constantes de la piste et de la voiture pour que la simulation soit identique.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch

from . import env as E
from .env import CarTrackEnv
from .sac import Actor

EVAL_EPISODES = 40


def evaluate(actor: Actor, obstacles: int, sensors: bool) -> tuple[int, int]:
    """Taux d'arrivées et de sorties de route, en jouant l'action moyenne."""
    finished = off = 0
    for i in range(EVAL_EPISODES):
        env = CarTrackEnv(obstacles=obstacles, sensors=sensors)
        s, _ = env.reset(seed=10_000 + i)
        while True:
            with torch.no_grad():
                mu, _ = actor(torch.as_tensor(s).unsqueeze(0))
            s, _, terminated, truncated, info = env.step(torch.tanh(mu).squeeze(0).numpy())
            if terminated or truncated:
                finished += info["finished"]
                off += info["off"]
                break
    return round(100 * finished / EVAL_EPISODES), round(100 * off / EVAL_EPISODES)


def weights(actor: Actor) -> list[dict]:
    """Les trois couches du réseau acteur, arrondies pour alléger le fichier."""
    sd = actor.state_dict()
    layers = []
    for i in (0, 2, 4):
        W = sd[f"net.{i}.weight"].numpy()
        b = sd[f"net.{i}.bias"].numpy()
        layers.append({"rows": W.shape[0], "cols": W.shape[1],
                       "W": [round(float(v), 4) for v in W.ravel()], "b": [round(float(v), 4) for v in b]})
    return layers


def load_metrics(path: Path):
    rows = list(csv.DictReader(open(path)))
    finished = np.array([int(r["finished"]) for r in rows], float)
    off = np.array([int(r["off"]) for r in rows], float)

    def rolling(x, w=50):
        return [float(np.mean(x[max(0, i - w + 1): i + 1])) for i in range(len(x))]

    # ~200 points suffisent pour les courbes
    idx = np.linspace(0, len(rows) - 1, min(200, len(rows))).astype(int)
    succ, crash = rolling(finished), rolling(off)
    return {
        "step": [int(rows[i]["step"]) for i in idx],
        "success": [round(succ[i] * 100, 1) for i in idx],
        "crash": [round(crash[i] * 100, 1) for i in idx],
        "alpha": [round(float(rows[i]["alpha"]), 4) for i in idx],
        "entropy": [None if rows[i]["entropy"] == "nan" else round(float(rows[i]["entropy"]), 3) for i in idx],
    }


def save_plot(curves, path: Path):
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    axes[0].plot(curves["step"], curves["success"], label="arrivées")
    axes[0].plot(curves["step"], curves["crash"], label="sorties / chocs")
    axes[0].set_title("Réussite (% sur 50 épisodes)"); axes[0].legend()
    axes[1].plot(curves["step"], curves["alpha"]); axes[1].set_title("Température α"); axes[1].set_yscale("log")
    axes[2].plot(curves["step"], [np.nan if v is None else v for v in curves["entropy"]]); axes[2].set_title("Entropie")
    for ax in axes:
        ax.set_xlabel("pas d'entraînement"); ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=120)


def main():
    parser = argparse.ArgumentParser(description="Exporte l'agent pour le labo dans le navigateur")
    parser.add_argument("--run", type=str, default="runs/sensors")
    parser.add_argument("--name", type=str, default=None, help="nom affiché dans le labo")
    args = parser.parse_args()
    run = Path(args.run)
    config = json.loads((run / "config.json").read_text()) if (run / "config.json").exists() else {"obstacles": 0}
    obstacles = config.get("obstacles", 0)
    sensors = config.get("sensors", obstacles > 0)

    env = CarTrackEnv(obstacles=obstacles, sensors=sensors)
    obs_dim, act_dim = env.observation_space.shape[0], env.action_space.shape[0]

    snapshots = []
    for ckpt in sorted((run / "checkpoints").glob("actor_*.pt")):
        step = int(ckpt.stem.split("_")[1])
        actor = Actor(obs_dim, act_dim)
        actor.load_state_dict(torch.load(ckpt))
        actor.eval()
        success, crash = evaluate(actor, obstacles, sensors)
        print(f"instantané {step:>7,} pas : arrivées {success:3d} %, sorties ou chocs {crash:3d} %")
        snapshots.append({"step": step, "success": success, "crash": crash, "layers": weights(actor)})

    curves = load_metrics(run / "metrics.csv")
    save_plot(curves, run / "courbes.png")

    data = {
        "id": run.name, "name": args.name or run.name,
        "env": {
            "R": E.R, "L": E.L, "half": E.HALF, "carHalf": E.CAR_HALF, "end": E.S_END,
            "wheelbase": E.WHEELBASE, "maxSteer": E.MAX_STEER, "vMax": E.V_MAX, "speedLag": E.SPEED_LAG,
            "grip": E.GRIP, "dt": E.DT, "maxSteps": E.MAX_STEPS, "lookahead": list(E.LOOKAHEAD),
            "sensors": env.sensors, "rayAngles": E.RAY_ANGLES, "rayRange": E.RAY_RANGE, "rayStep": E.RAY_STEP,
            "obstR": E.OBST_R, "carRadius": E.CAR_RADIUS, "trainObstacles": obstacles,
        },
        "snapshots": snapshots, "curves": curves,
    }
    agents = Path("viewer/agents")
    agents.mkdir(exist_ok=True)
    out = agents / f"{run.name}.js"
    out.write_text("(window.SAC_AGENTS = window.SAC_AGENTS || []).push(" + json.dumps(data, separators=(",", ":")) + ");\n")
    # liste des agents exportés, chargés par le labo dans cet ordre
    listing = sorted(p.stem for p in agents.glob("*.js") if p.stem != "index")
    (agents / "index.js").write_text("window.SAC_AGENT_FILES = " + json.dumps(listing) + ";\n")
    print(f"\nÉcrit {out} ({out.stat().st_size / 1e6:.1f} Mo) et {run / 'courbes.png'}")
    print("Ouvre le labo :  open viewer/index.html")


if __name__ == "__main__":
    main()
