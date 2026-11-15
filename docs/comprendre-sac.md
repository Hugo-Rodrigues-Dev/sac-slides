# Comprendre SAC

Cette fiche va plus loin que les slides. Les équations suivent les conventions de [Spinning Up](https://spinningup.openai.com/en/latest/algorithms/sac.html) ; l’ajustement de la température est présenté dans [Algorithms and Applications](https://arxiv.org/abs/1812.05905).

## Les mots à connaître

| Terme | Sens |
| --- | --- |
| Politique π(a\|s) | Distribution des actions possibles dans un état |
| Acteur | Réseau qui représente la politique |
| Critique Q(s,a) | Réseau qui évalue la valeur à long terme d’une action dans un état |
| Stochastique | L’action est tirée d’une distribution |
| Off-policy | L’apprentissage peut utiliser des données produites par une autre politique, notamment une ancienne version |
| Model-free | L’agent n’apprend pas explicitement la dynamique de l’environnement pour planifier |
| Entropie | Diversité de la distribution d’actions, conditionnée par l’état |
| Replay buffer | Mémoire de transitions passées |

## L’objectif

```text
J(π) = E[ Σ_t γ^t ( r_t + α H(π(·|s_t)) ) ]
```

L’espérance porte sur les trajectoires générées par la politique et l’environnement. Le coefficient gamma actualise les conséquences futures. Alpha règle la valeur accordée à l’entropie relativement à la récompense ; changer l’échelle des récompenses change donc ce compromis si alpha est fixé.

L’entropie s’écrit `H(π(·|s)) = E_a[-log π(a|s)]`. Pour les actions continues, il s’agit d’une **entropie différentielle** : elle peut être négative et dépend de l’échelle des actions. L’analogie avec des choix discrets sert à comprendre la diversité, pas à transposer toutes les propriétés numériques.

L’acteur ne maximise pas uniquement le hasard : il cherche un compromis entre qualité des actions et diversité.

## La mise à jour des critiques

Pour une transition `(s, a, r, s')`, une cible simplifiée est :

```text
a' ~ π(·|s')
y = r + γ (1 - d) [ min(Q1_cible(s',a'), Q2_cible(s',a'))
                     - α log π(a'|s') ]
```

`d` indique une vraie fin terminale. Une limite de temps ne doit pas être confondue automatiquement avec un état terminal ; le traitement dépend des informations renvoyées par l’environnement.

Chacun des deux critiques minimise l’erreur quadratique entre sa prédiction et cette cible, sur un lot du replay buffer. La cible est traitée comme une constante pendant cette mise à jour.

Les réseaux cibles suivent lentement les paramètres entraînés :

```text
paramètres_cibles ← (1 - τ) × paramètres_cibles + τ × paramètres_entraînés
```

Attention : certaines sources utilisent `rho = 1 - tau` pour décrire la même moyenne.

## La mise à jour de l’acteur

L’acteur minimise approximativement :

```text
E_s du buffer, a~π [ α log π(a|s) - min(Q1(s,a), Q2(s,a)) ]
```

Le terme Q favorise les actions bien évaluées. Le terme logarithmique favorise l’entropie. Dans la version usuelle, la reparamétrisation d’une gaussienne permet de faire passer le gradient à travers l’action échantillonnée ; une transformation tanh borne les actions et impose une correction de leur log-densité.

Ces détails sont utiles pour une implémentation maison, mais ne sont pas nécessaires à l’exposé.

## Pourquoi deux critiques ?

Une politique qui maximise une estimation approximative peut exploiter ses erreurs positives : une action semble meilleure qu’elle ne l’est. Utiliser le minimum de deux critiques réduit cette surestimation. Il ne la supprime pas de façon garantie, et peut introduire du pessimisme.

## Que fait alpha automatique ?

Dans la formulation usuelle, alpha est ajusté pour viser une entropie cible moyenne. Si la politique devient trop concentrée par rapport à cette cible, l’ajustement tend à augmenter la pression en faveur de l’entropie ; dans l’autre sens, il tend à la réduire.

Cela ne promet ni de bonnes récompenses, ni une exploration globale suffisante. Alpha n’est pas nécessairement décroissant. Dans Stable-Baselines3, on optimise son logarithme et l’entropie cible automatique vaut généralement l’opposé de la dimension des actions.

## Questions possibles du professeur

**Pourquoi ne pas toujours choisir la meilleure action estimée ?**

Parce que l’estimation est imparfaite et qu’une politique peut se concentrer trop tôt sur une stratégie moyenne. L’entropie aide à maintenir des alternatives.

**Pourquoi conserver d’anciennes expériences ?**

Pour apprendre plusieurs fois à partir d’interactions déjà payées en temps ou en ressources. Le tirage aléatoire atténue aussi les corrélations temporelles des données successives.

**L’agent reste-t-il aléatoire après l’entraînement ?**

La politique apprise reste une distribution, mais on peut l’évaluer avec des actions déterministes. Dans l’implémentation usuelle à gaussienne transformée, on utilise alors la moyenne de la gaussienne passée par la transformation, ce qui n’est pas forcément l’espérance de l’action transformée.

**SAC est-il meilleur que PPO ?**

Pas universellement. SAC peut être intéressant quand la réutilisation des interactions compte en contrôle continu. Le résultat dépend de la tâche, du réglage et du budget de calcul. Comparer sur plusieurs graines et distinguer nombre d’interactions et temps réel.

**Peut-on utiliser SAC pour des actions discrètes ?**

Oui avec une formulation adaptée. La version classique présentée ici et le SAC standard de Stable-Baselines3 utilisent des actions continues.

**Quelles limites pour la robotique réelle ?**

Collecter les données, concevoir la récompense et gérer la sécurité physique restent difficiles. Les résultats publiés portent sur des systèmes expérimentaux précis ; l’algorithme ne fournit pas une garantie de sécurité.
