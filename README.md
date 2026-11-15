# Soft Actor-Critic

Une présentation en français pour expliquer **SAC en 7 à 10 minutes**, avec un exemple de robotique. Design sombre, accents menthe et cuivre, aucune image décorative et aucune dépendance externe.

**[Ouvrir les slides](https://hugo-rodrigues-dev.github.io/sac-slides/)**

## Présenter

- `←` / `→` ou `Page précédente` / `Page suivante` : changer de slide.
- `Espace` : avancer.
- `Début` / `Fin` : première / dernière slide.
- `F` : plein écran (si le navigateur le permet).
- `N` : afficher ou masquer les notes orales. **Elles sont visibles sur l’écran projeté** : les consulter avant, ou garder [les notes Markdown](docs/notes-orales.md) sur un autre appareil.
- `Échap` : fermer les notes ; le navigateur gère également la sortie du plein écran.

Les boutons sont utilisables au clavier avec `Tab` et `Entrée`. Une slide peut être partagée directement, par exemple `#slide-3`.

## Ouvrir en local

Ouvrir simplement `index.html` dans un navigateur. Les slides fonctionnent hors ligne, sans installation ni CDN.

Ou, pour servir les fichiers depuis ce dossier :

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Puis ouvrir <http://127.0.0.1:8000>.

## Plan et durée indicative

| Slide | Sujet | Durée |
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
| **Total** | **Hors questions** | **8:40** |

## Modifier

| Fichier | Contenu |
| --- | --- |
| `index.html` | Texte des slides et schémas en HTML |
| `styles.css` | Couleurs, typographie et mise en page 16:9 |
| `app.js` | Navigation, plein écran et notes intégrées |
| `docs/notes-orales.md` | Notes pour préparer l’oral |
| `docs/comprendre-sac.md` | Fiche de compréhension et questions possibles |
| `docs/sources.md` | Bibliographie commentée et correspondance avec les slides |

Si le nombre de slides change, modifier également le tableau `speakerNotes` dans `app.js`. Si les notes évoluent, reporter la modification dans `docs/notes-orales.md`.

Les exemples de bras robotique et les nombres illustratifs servent à expliquer le principe. Ce dépôt ne contient ni entraînement de robot, ni mesure de performance, ni courbe expérimentale.

## Hébergement

GitHub Pages sert directement la branche `main`, dossier `/` : pas de compilation, de service tiers ni de workflow nécessaire. Le fichier `.nojekyll` permet de servir les fichiers statiques tels quels.

## Références

Voir [la bibliographie commentée](docs/sources.md). Le contenu décrit la version moderne courante de SAC avec deux critiques, sans réseau V séparé, et avec ajustement automatique du coefficient d’entropie.

## Licence

Le code et les textes originaux de ce dépôt sont sous [licence MIT](LICENSE). Les publications et autres ressources citées conservent leurs droits respectifs.
