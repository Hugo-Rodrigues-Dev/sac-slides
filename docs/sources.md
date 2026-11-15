# Sources commentées

## Ordre de lecture conseillé

1. [Berkeley — Soft Actor Critic: Deep Reinforcement Learning with Real-World Robots](https://bair.berkeley.edu/blog/2018/12/14/sac/), 14 décembre 2018. Billet des auteurs : intuition et exemples de manipulation et de locomotion. Les vidéos peuvent compléter l’oral, mais aucun média tiers n’est intégré à ce dépôt.
2. [OpenAI Spinning Up — Soft Actor-Critic](https://spinningup.openai.com/en/latest/algorithms/sac.html). Référence pédagogique pour l’objectif, la politique stochastique, les deux critiques, les réseaux cibles et le pseudo-code. La page présente la version sans réseau V, avec alpha fixé dans son implémentation.
3. [Stable-Baselines3 — SAC](https://stable-baselines3.readthedocs.io/en/master/modules/sac.html). Référence pratique pour les paramètres, la température automatique et les espaces d’actions pris en charge. Les valeurs de la slide 7 correspondent aux défauts de la documentation consultée ; la page `master` peut évoluer.
4. [Haarnoja, Zhou, Abbeel et Levine — Soft Actor-Critic: Off-Policy Maximum Entropy Deep Reinforcement Learning with a Stochastic Actor](https://proceedings.mlr.press/v80/haarnoja18b.html). ICML 2018, PMLR 80, pages 1861–1870. Article fondateur.
5. [Haarnoja et al. — Soft Actor-Critic Algorithms and Applications](https://arxiv.org/abs/1812.05905). Prépublication de décembre 2018, version révisée en janvier 2019. Développements de l’algorithme, ajustement automatique de la température et expériences robotiques.

## Correspondance avec les slides

| Slide | Appui principal |
| --- | --- |
| 1 — Couverture | Article ICML 2018 |
| 2 — Rappel du DQN et de ses limites | Cours CM4 (DQN, ε-greedy, experience replay, target network) |
| 3 — Récompense + entropie | Berkeley et Spinning Up |
| 4 — Température α | Algorithms and Applications (ajustement automatique) ; courbes illustratives π ∝ exp(Q/α) |
| 5 — Acteur et deux critiques | Spinning Up, version moderne ; l’exemple Q1 = 12, Q2 = 8 est illustratif |
| 6 — Boucle d’entraînement | Spinning Up |
| 7 — Hyperparamètres | Stable-Baselines3 (valeurs par défaut) et tableau d’hyperparamètres de Algorithms and Applications |
| 8 — Minitaur | Berkeley : 2 h d’entraînement réel, sol plat puis terrains inconnus |
| 9 — Autres robots | Berkeley : Sawyer 2 h, main à 3 doigts 20 h depuis des images |
| 10 — Quand l’utiliser | Synthèse des sources ; espaces d’actions pris en charge dans Stable-Baselines3 |
| 11 — À retenir | Synthèse |

## Précautions d’interprétation

- Les résultats favorables des articles sont des résultats expérimentaux sur des tâches et comparaisons précises, pas une supériorité universelle.
- La version initiale et la version moderne n’ont pas exactement les mêmes réseaux. Ce support décrit la seconde, avec deux critiques, sans réseau V séparé et avec alpha automatique.
- « Efficacité en données » et « rapidité en temps réel » sont deux mesures différentes.
- Le bras robotique de la slide 2 et l’exemple Q1 = 12, Q2 = 8 des notes sont illustratifs.
- Aucun benchmark ni entraînement n’a été réalisé pour ce support.
