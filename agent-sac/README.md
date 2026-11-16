# Voiture SAC

> Dossier `agent-sac/` du dépôt de l'exposé. Il contient le code de notre propre SAC, **les deux agents déjà entraînés** et le labo prêt à ouvrir :
>
> - `runs/sensors/` : voiture avec capteurs, entraînée sur la piste seule (60 000 pas, jamais vu de plot) ;
> - `runs/obstacles_long/` : v1, voiture entraînée avec 0 à 3 plots au hasard (200 000 pas) ;
> - `runs/v2_seed0/`, `v2_seed1/`, `v2_seed2/` : v2, la version améliorée (3 graines, 400 000 pas chacune), voir plus bas ;
> - dans chaque dossier : les poids de l'**acteur** à chaque checkpoint (`checkpoints/actor_*.pt`, PyTorch), les courbes (`metrics.csv`, `courbes.png`) et la configuration (`config.json`). Les critiques ne sont pas sauvegardés : ils ne servent qu'à entraîner ;
> - `viewer/` : le labo, déjà exporté. Ouvrir `viewer/index.html` dans un navigateur suffit, sans Python.

Une voiture apprend à prendre un virage en épingle avec **Soft Actor-Critic**, codé à la main. C'est la piste de notre exposé, et les chiffres affichés dans les slides 5 et 6 viennent de ce projet.

- `src/sac_robot/env.py` : la piste, la voiture et la récompense (un environnement Gymnasium).
- `src/sac_robot/sac.py` : SAC en environ 150 lignes, commenté avec le vocabulaire de l'exposé. α est appris, ou fixé à la main avec `--alpha`.
- `src/sac_robot/train.py` : la boucle d'entraînement.
- `src/sac_robot/export.py` : exporte les poids de l'acteur à chaque checkpoint, pour le labo dans le navigateur.
- `src/sac_robot/export_slides.py` : mesure les chiffres utilisés dans les slides.
- `src/sac_robot/compare.py` : fait passer les mêmes épisodes à toutes les voitures et compte les plots évités.
- `src/sac_robot/diagnose.py` : montre où et dans quelles conditions une voiture percute les plots.
- `viewer/index.html` : le labo d'entraînement. L'agent y conduit **en direct** (le réseau acteur est recalculé en JavaScript), et on pose des plots sur la route d'un clic.

## Lancer

Il faut [uv](https://docs.astral.sh/uv/).

```bash
uv run train --steps 200000 --obstacles 3 --run runs/obstacles_long   # ~20 min
uv run export --run runs/obstacles_long                              # écrit viewer/data.js
open viewer/index.html
```

Dans le labo :

- **frise du haut** : choisir un checkpoint de l'entraînement (pas entraîné → fin), aussi au clavier avec ← et → ;
- **clic sur la route** : poser un plot, clic sur un plot : le retirer, ou « plots au hasard » ;
- **action moyenne μ / tirée dans (μ, σ)** : conduite déterministe ou avec le hasard de la politique ;
- le nuage orange montre 16 actions tirées dans la politique, les rayons verts ce que voient les capteurs ;
- les compteurs « essais / arrivées / chocs » se remettent à zéro à chaque changement.

Avec `--obstacles 3`, chaque épisode d'entraînement place 0 à 3 plots au hasard, toujours d'un côté de la route, et la voiture reçoit 7 rayons de « vue » (de −60° à +60°, 8 m). Sans cette option, c'est la piste seule, celle des chiffres des slides.

Pour reproduire les chiffres des slides, on entraîne aussi cinq voitures avec α fixé à la main, puis on exporte :

```bash
for a in 0.003 0.01 0.05 0.2 1.0; do uv run train --steps 40000 --alpha $a --run runs/alpha_$a; done
uv run export-slides         # écrit runs/slides_data.json
```

## Le problème

| Élément du MDP                                | Ici                                                                                                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| État *s* (12 nombres, 19 avec les capteurs)  | écart au milieu de la route, angle par rapport à la route, vitesse, direction de la route à 3, 6 et 10 m devant, action précédente, [7 rayons] |
| Action *a* (2 nombres continus dans [−1, 1]) | volant (±30°), pédale (vitesse visée de 0 à 12 m/s)                                                                                            |
| Récompense *r*                               | + les mètres parcourus le long de la route, −10 en cas de sortie de route ou de plot percuté, +10 à l'arrivée                                  |
| Fin d'épisode                                  | arrivée, sortie de route, ou 30 secondes écoulées                                                                                                |

La piste : une ligne droite de 8 m, une épingle de 5 m de rayon, une ligne droite de 8 m, avec une route de 3 m de large. Le compromis : aller vite rapporte plus, mais trop vite dans le virage, les pneus décrochent (accélération latérale limitée à 7 m/s²) et la voiture tire tout droit.

## Ce qu'on a mesuré

Un entraînement par valeur de α, 40 000 pas chacun :

| α                 | Arrivées | Temps au tour | Entropie | σ du volant à l'entrée du virage |
| ------------------ | --------- | ------------- | -------- | ----------------------------------- |
| 0,003 (fixé)      | 100 %     | 5,7 s         | −4,4    | ±1°                               |
| 0,01 (fixé)       | 100 %     | 4,4 s         | −3,4    | ±2°                               |
| 0,05 (fixé)       | 100 %     | 4,8 s         | −0,8    | ±5°                               |
| 0,2 (fixé)        | 100 %     | 5,5 s         | +0,4     | ±11°                              |
| 1 (fixé)          | 100 %     | 7,6 s         | +0,7     | ±13°                              |
| appris (cible −2) | 100 %     | —            | −1,5    | α final ≈ 0,024                   |

Toutes les voitures finissent le virage : la piste est assez simple. Ce qui change, c'est la vitesse. Avec trop peu d'entropie, la voiture conduit toujours pareil et reste plus lente ; avec trop d'entropie, elle zigzague et perd du temps. α appris finit entre les deux. Comme il n'y a qu'un entraînement par α, l'ordre exact entre les valeurs du milieu peut varier d'un essai à l'autre.

## Où retrouver chaque idée de l'exposé dans le code

| Dans l'exposé                             | Dans `sac.py`                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| L'acteur sort deux zones (volant, pédale) | `Actor` : une moyenne et un écart-type par action, puis `tanh`           |
| Deux critiques qui notent                  | `Critic` ×2 : prennent l'état **et** l'action, sortent une note     |
| On garde la note la plus basse             | `torch.min(self.q1_target(...), self.q2_target(...))`                       |
| Bonus d'entropie                           | `- alpha * logp2` dans la cible, `alpha * logp` dans la perte de l'acteur |
| α appris automatiquement                  | `log_alpha` et `target_entropy = -2`                                      |
| Replay buffer, 256 moments au hasard       | `ReplayBuffer.sample`                                                       |
| Réseaux cibles qui suivent doucement (τ) | fin de `SAC.update`                                                         |

## L'expérience : une voiture entraînée sans plots les évite-t-elle ?

Question : si on entraîne la voiture **avec des capteurs** mais **seulement à rester sur la route**, est-ce qu'elle évite ensuite un plot posé sur la route, sans réentraînement ? Pour ses capteurs, un plot ressemble à un bout de bord de route.

```bash
uv run train --steps 60000 --sensors --run runs/sensors                  # capteurs, jamais de plot
uv run train --steps 200000 --obstacles 3 --run runs/obstacles_long      # entraînée avec des plots
uv run compare                                                           # mêmes épisodes pour les trois voitures
```

Les trois voitures passent les mêmes épisodes, avec 0 à 3 plots posés d'un côté de la route, en jouant l'action moyenne :

| Voiture                                  | Sans plots | Plots évités (un par un)                                  |
| ---------------------------------------- | ---------- | ----------------------------------------------------------- |
| aveugle : piste seule, sans capteurs     | 100 %      | 36 % (par chance : le plot n'était pas sur sa trajectoire) |
| capteurs, jamais vu de plot              | 100 %      | 48 %                                                        |
| entraînée avec des plots (200 000 pas) | 100 %      | 75 %                                                        |

Ce qu'on en retient :

- **sans capteurs**, aucun algorithme ne peut éviter un obstacle : il est invisible ;
- **avec capteurs mais sans plots à l'entraînement**, l'effet existe mais reste faible (+12 points). La voiture n'a jamais été récompensée pour contourner quelque chose au **milieu** de la route : ses rayons n'ont vu que des bords, sur les côtés ;
- **la robustesse de SAC** vient de ce qu'il a exploré : il se rattrape bien dans des situations proches de celles qu'il a connues (écart de trajectoire, vitesse), comme le robot Minitaur sur un sol inconnu. Mais il ne sait pas faire quelque chose qu'il n'a jamais eu besoin de faire.

Dans le labo, le bouton en haut à gauche permet de passer d'une voiture à l'autre et de le constater en direct.

## La v2 : comment on a nettement amélioré l'agent

Le diagnostic de la v1 (`uv run diagnose --run runs/obstacles_long`) montrait un problème de **perception**, pas de vitesse. La v1 percutait surtout les plots côté extérieur et en sortie de virage, n'évitait que 42 % des plots au milieu de la route, et roulait plus lentement quand elle les percutait.

La v2 change trois choses (option `--v2`) :

| | v1 | v2 |
| --- | --- | --- |
| Rayons | 7, de −60° à +60°, 8 m | 15, de −70° à +70°, **18 m** |
| Mesures par rayon | 1 (bord **ou** plot, confondus) | **2** (distance au bord, distance au plot) |
| Plot percuté | −10 | **−40**, plus une petite pénalité quand un plot est à moins de 1,5 m |
| Placement des plots | d'un côté de la route | **n'importe où**, y compris au milieu (un passage reste toujours libre) |
| Entraînement | 200 000 pas | **curriculum** (1 plot max, puis 2, puis 3), 400 000 pas, 3 graines |

```bash
uv run train --steps 400000 --obstacles 3 --v2 --curriculum --seed 0 --run runs/v2_seed0
uv run compare
```

Résultat sur les mêmes épisodes, avec l'action moyenne (épisodes avec au moins un plot) :

| Voiture | Plots sur un côté : évités | Plots partout : évités | Arrivées (plots partout) |
| --- | --- | --- | --- |
| capteurs, jamais vu de plot | 50 % | 31 % | 22 % |
| v1 | 75 % | 62 % | 47 % |
| **v2** (moyenne de 3 graines) | **99 %** (98–100) | **94 %** (93–96) | **80 %** (76–83) |

### Ce qui reste à corriger

Il y a un écart entre les plots évités (94 %) et les arrivées (80 %). La v2 ne percute plus guère de plots, mais elle **sort de la route** dans 9 à 15 % des épisodes. C'est une erreur dans la récompense : percuter un plot coûte −40, alors que sortir de la route ne coûte que −10. Quand la voiture hésite, quitter la route est donc « moins cher » pour elle. Prochaine étape : la même pénalité pour les deux.
