# Prototype jetable — la voix de la documentation

**Question posée par [#43](https://github.com/WAROL52/signalcn/issues/43)** : à quoi ressemble une
page de ce projet qui ne fait pas peur ? Trois formes pour la **même** page — le drainage du batch.

Ce dossier n'est pas de la documentation et ne se fusionne pas. Il est conservé comme **source
primaire** de la décision : le verdict est consigné en commentaire de résolution sur le ticket, la
forme gagnante est repliée dans le vrai site.

## Lancer

```sh
npm exec vitepress dev prototype/voix
```

Puis choisir une variante dans la navigation. La table de la page d'accueil dit ce qui distingue
les trois.

## Les trois formes

| Fichier | Forme | Le pari |
|---|---|---|
| [`drainage-a.md`](./drainage-a.md) | entoncement | l'algorithme entier d'abord, le détail derrière un marqueur unique |
| [`drainage-b.md`](./drainage-b.md) | parcours | le problème d'abord, l'intuition utilisable, le marqueur **avant** le mécanisme |
| [`drainage-c.md`](./drainage-c.md) | fiche | détail dès la première ligne, mais scopé en unités courtes, table de lecture en tête |

Le contenu est volontairement équivalent : la question porte sur la **forme**, donc les trois pages
disent la même chose pour que seule la structure change.

## Deux écarts assumés par rapport à `/prototype`

- **Pas de barre flottante de changement de variante.** La `nav` du thème fait le même travail en
  trois lignes et ne pose aucune question au lecteur que la page réelle ne posera pas. Un prototype
  qui ajoute du chrome ment sur le chrome de l'original.
- **Le thème est une copie du thème réel** — même `lang`, même `appearance`, même recherche locale.
  La question est « quelle forme de page », pas « quel rendu » : le prototype doit se lire contre le
  fond de la réponse finale.

## La surface balayée

Le drainage du batch est le meilleur candidat parce qu'il a les trois propriétés qu'il faut
répéter sur les autres pages : un **algorithme** qui se lit en dix lignes, un **pourquoi** qui ne
se déduit pas du code, et des **effets de bord** (erreurs, bornes) qui ne sont ni l'un ni l'autre.