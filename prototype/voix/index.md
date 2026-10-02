---
layout: page
title: Prototype jetable
---

# Prototype jetable — trois formes pour une même page

**Ce dossier n'est pas de la documentation.** Il existe pour répondre à une seule question, posée
par [#43](https://github.com/WAROL52/signalcn/issues/43) :

> À quoi ressemble une page de ce projet qui ne fait pas peur ?

Le contenu importe peu. Les trois pages ci-dessous parlent **de la même chose** — le drainage du
batch, tiré de `site/technique/architecture.md` §5 — et ne se différencient que par la **forme** :

| Variante | Forme | Où commence le détail | Le « vous pouvez sauter ici » |
|---|---|---|---|
| [**A — entoncement**](./drainage-a) | pyramide inversée | à la fin | oui, une fois, après l'algorithme | 
| [**B — parcours**](./drainage-b) | narration problème → intuition → mécanisme | à la fin | oui, **avant** le mécanisme, plus tôt qu'en A |
| [**C — fiche**](./drainage-c) | référence courte, une idée par section | **dès la première ligne**, mais scopé | non — une table de lecture en tête le remplace |

Ce qui est réellement en jeu, c'est la réponse à trois questions :

1. **Où commence le détail ?** — A et B le repoussent en fin de page, C le met devant mais le
   découpe en unités courtes. Le build ne dit pas laquelle est juste.
2. **Ce qui est dit avant quoi ?** — l'algorithme avant sa justification (A), le problème avant
   l'algorithme (B), l'idée avant l'algorithme et après (C).
3. **Quand écrit-on « vous pouvez sauter ici » ?** — et est-ce un marqueur dans le texte, ou une
   promesse faite en tête ?

Lancer :

```sh
npm exec vitepress dev prototype/voix
```

Puis choisir une variante dans la navigation. La réponse est consignée en commentaire de résolution
sur [#43](https://github.com/WAROL52/signalcn/issues/43) ; ce dossier ne se fusionne pas.