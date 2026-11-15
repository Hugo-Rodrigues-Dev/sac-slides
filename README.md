# Soft Actor-Critic — open-slide

Présentation en français de **SAC en 7 à 10 minutes**, réalisée avec le véritable framework **[open-slide](https://open-slide.dev/)**, React et TypeScript.

9 pages, style technique sombre inspiré de la robotique, accents menthe/cuivre et aucune image décorative. Les notes orales sont intégrées à la vue présentateur d’open-slide.

## Lancer le diaporama

Prérequis : **Node.js 24 LTS** et npm.

```sh
git clone https://github.com/Hugo-Rodrigues-Dev/sac-slides.git
cd sac-slides
npm install
npm run dev
```

Ouvrir **<http://localhost:5173/s/soft-actor-critic>**. Si le port est occupé, utiliser l’adresse affichée dans le terminal.

Le serveur propose le navigateur de présentations, l’éditeur, les vignettes et le rechargement à chaud. Utiliser **Present / Présenter** pour le diaporama plein écran. Les notes sont disponibles dans le tiroir de notes et dans la vue présentateur native avec chronomètre.

La présentation n’est plus un fichier HTML autonome : **`npm run dev` lance bien open-slide**.

## Modifier les slides

Le fichier **[`slides/soft-actor-critic/index.tsx`](slides/soft-actor-critic/index.tsx)** contient :

- `design` : couleurs, polices et échelle typographique ;
- les neuf composants de pages, sur un canevas natif de 1920 × 1080 ;
- `notes` : textes pour l’oral, indexés sur les pages ;
- l’export par défaut : ordre des pages.

Le framework gère la mise à l’échelle, la navigation, le mode présentation, l’inspecteur et les exports. Les recommandations pour modifier le support sont dans `AGENTS.md` et les compétences officielles sous `.agents/skills/`.

## Plan — environ 8 min 40

| Page | Sujet | Durée |
| --- | --- | --- |
| 1 | Soft Actor-Critic | 0:35 |
| 2 | Exemple d’un bras robotique | 0:55 |
| 3 | Récompense et entropie | 1:20 |
| 4 | Acteur et deux critiques | 1:20 |
| 5 | Boucle d’apprentissage | 1:15 |
| 6 | Hyperparamètres | 1:05 |
| 7 | Avantages et limites | 1:00 |
| 8 | Applications et bilan | 0:55 |
| 9 | Sources | 0:15 |

Les exemples sont pédagogiques : aucun entraînement ou benchmark n’a été réalisé pour ce support.

## Comprendre le sujet

- [Fiche de compréhension et questions possibles](docs/comprendre-sac.md)
- [Sources commentées](docs/sources.md)
- Notes orales directement dans l’export `notes` de la présentation.

## Vérifier et compiler

```sh
npm run typecheck
npm run build
npm run preview
```

La compilation produit `dist/`. Le workflow GitHub Actions compile et déploie automatiquement la branche `main` sur **[GitHub Pages](https://hugo-rodrigues-dev.github.io/sac-slides/)**. Le chemin de base `/sac-slides/` est appliqué pendant ce déploiement ; le serveur local reste à la racine.

Pour une installation reproductible avec le fichier verrouillé, utiliser `npm ci` à la place de `npm install`.

## Licence

Code et textes originaux sous [licence MIT](LICENSE). Les ressources citées conservent leurs droits respectifs.
