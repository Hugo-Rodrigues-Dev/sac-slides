# Soft Actor-Critic — open-slide

Présentation de **SAC en 7 à 10 minutes**, réalisée avec le véritable framework **[open-slide](https://open-slide.dev/)**, React et TypeScript.

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

## Notre agent SAC

Le dossier [`agent-sac/`](agent-sac/) contient notre propre implémentation de SAC sur la piste de l'exposé, les **deux agents entraînés** (poids de l'acteur) et un labo où la voiture conduit en direct dans le navigateur, avec des plots à poser d'un clic. Ouvrir `agent-sac/viewer/index.html` suffit ; le [README du dossier](agent-sac/README.md) explique comment réentraîner.

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
