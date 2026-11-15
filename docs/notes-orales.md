# Notes pour l’oral — environ 8 min 40

Les temps sont des repères. Répéter une fois à voix haute : la durée réelle dépend du débit et des pauses. Les sources de chaque partie figurent dans [sources.md](sources.md).

## 1. Soft Actor-Critic — 0:35

SAC signifie Soft Actor-Critic. C’est un algorithme d’apprentissage par renforcement proposé en 2018 par Haarnoja et ses collègues.

Le fil conducteur : comment apprendre des actions efficaces sans se fermer trop tôt à d’autres possibilités ? SAC est particulièrement adapté aux commandes continues, comme celles d’un robot. « Soft » renvoie à l’objectif qui ajoute de l’entropie.

Transition : prenons un exemple concret.

## 2. Un bras robotique — 0:55

Un bras doit atteindre une cible. Il observe les positions et vitesses de ses articulations ainsi que la cible, puis applique des couples moteurs. Ce sont des actions continues : on choisit des valeurs réelles, pas seulement gauche ou droite.

La récompense peut pénaliser la distance à la cible et l’effort. C’est un exemple pédagogique : aucune expérience n’est mesurée dans ce dépôt.

La politique est la règle qui choisit les actions. SAC est model-free : il n’apprend pas explicitement un modèle des transitions pour planifier.

Transition : comment éviter de répéter trop tôt un mouvement seulement moyen ?

## 3. Récompense et entropie — 1:20

Un agent cherche à maximiser ses récompenses futures. SAC ajoute l’entropie, qui mesure la diversité de la distribution d’actions dans un même état.

La formule affichée est simplifiée : l’objectif complet est une espérance sur les trajectoires avec actualisation par gamma. Si plusieurs actions sont bonnes, on souhaite conserver plusieurs possibilités au lieu de se concentrer trop vite sur une seule.

Alpha règle le poids de cette diversité. Plus alpha est grand, plus elle pèse dans l’objectif. Cela encourage l’exploration sans garantir la découverte de toutes les bonnes stratégies. Avec alpha égal à zéro, le bonus disparaît.

Transition : quels réseaux apprennent ce comportement ?

## 4. Acteur et critiques — 1:20

L’acteur produit une distribution d’actions. Pour le continu, on utilise souvent une gaussienne transformée afin de respecter les bornes des commandes. Pendant l’entraînement, on échantillonne une action.

Chaque critique reçoit l’état et l’action et estime une valeur à long terme qui inclut les futurs bonus d’entropie. On utilise le minimum des deux estimations pour limiter la surestimation. Exemple fictif : Q1 donne 12 et Q2 donne 8 ; on retient 8. Cela ne rend pas les estimations exactes.

Nous décrivons la version moderne : la formulation initiale avait aussi un réseau de valeur V séparé.

Transition : comment ces réseaux apprennent-ils à partir des interactions ?

## 5. La boucle d’apprentissage — 1:15

L’agent agit et stocke la transition dans une mémoire appelée replay buffer. Il tire ensuite un lot aléatoire d’expériences, y compris anciennes. C’est le sens de off-policy : apprendre à partir des données produites par d’anciennes versions de la politique.

Les critiques rapprochent leurs prédictions d’une cible de Bellman fondée sur la récompense et une estimation du futur. L’acteur favorise les actions bien évaluées tout en maintenant de l’entropie.

Dans la variante présentée, alpha est ajusté pour viser une entropie cible. Les critiques cibles suivent lentement les critiques entraînés. Le schéma donne la logique générale, pas un ordre universel de toutes les opérations internes.

Transition : quels sont les réglages essentiels ?

## 6. Hyperparamètres — 1:05

Les nombres sont les paramètres par défaut de Stable-Baselines3 : pas un réglage optimal universel.

Insister surtout sur alpha, l’entropie cible et le taux d’apprentissage. Alpha peut augmenter ou diminuer ; son ajustement automatique n’est pas un programme qui réduit systématiquement l’exploration.

Gamma règle le poids du futur. Le batch est le nombre de transitions par mise à jour ; le buffer est la capacité de mémoire. Avec tau égal à 0,005, les critiques cibles mélangent 0,5 % des paramètres entraînés et 99,5 % de leurs anciens paramètres à chaque mise à jour cible.

Transition : qu’y gagne-t-on et que coûte ce mécanisme ?

## 7. Avantages et limites — 1:00

Les expériences sont réutilisées : chaque interaction peut servir plusieurs fois. L’entropie encourage l’exploration et SAC obtient de bons résultats sur de nombreuses tâches de contrôle continu.

En contrepartie, plusieurs réseaux et un buffer demandent du calcul et de la mémoire. Les récompenses rares restent difficiles : varier les actions ne suffit pas forcément à découvrir une réussite lointaine.

PPO est on-policy : il apprend principalement sur des données récentes de sa politique de collecte. La réutilisation offerte par SAC ne garantit pas un entraînement plus rapide en temps réel, ni un meilleur score sur toute tâche.

## 8. Applications et bilan — 0:55

Les auteurs ont montré la locomotion d’un quadrupède et la manipulation robotique. Les ressources Berkeley présentent ces expériences réelles.

La version classique vise les actions continues. Des variantes existent pour le discret, mais le SAC standard de Stable-Baselines3 ne les prend pas en charge.

À retenir : l’acteur choisit, les critiques évaluent, le buffer réutilise les expériences et l’entropie encourage la diversité. Pour un vrai robot, SAC ne garantit pas à lui seul la sécurité des mouvements.

## 9. Sources — 0:15

Les articles sont les références scientifiques. Berkeley donne l’intuition et les exemples, Spinning Up les équations, et Stable-Baselines3 les paramètres pratiques.

Passer aux questions.
