# Les deux règles de drainage

Dans quel ordre vos effets tournent, et pourquoi confondre les deux règles produit un programme qui
passe les tests et échoue en production.

| Vous voulez | Allez à |
| --- | --- |
| comprendre l'**ordre**, sans savoir d'où il vient | [Deux ordres](#deux-ordres) |
| comprendre **pourquoi** les effets différents s'inversent | [Les effets différés](#les-effets-differes) |
| comprendre ce qui **déclenche** une exécution | [Ce qui déclenche](#ce-qui-declenche) |

## Deux ordres

Il y a deux ordres, et ils sont différents.

```text
  deux écritures, dans un batch :     b ← c          les effets différés s'exécutent à l'envers

  deux effets sur le même signal :    b   c          l'ordre de création
```

Un signal écrit deux fois ne déclenche rien une seconde fois — c'est la coalescence, et c'est dans
[`SPEC.md`](/SPEC.md) §9.3. Ce qui reste, c'est **qui** tourne, et dans quel ordre.

## Les effets différés

Un effet qui écrit pendant qu'il tourne ne peut pas s'exécuter tout de suite : il modifie une
dépendance qu'il est en train de lire. Il part donc dans une file, et **la file est drainée à
l'envers de l'empilement**.

L'envers, et non l'ordre d'empilement, vient de la file elle-même : les écritures s'empilent en tête,
donc la dernière entrée est la première de la file. Inverser la file est donc le même geste que la
faire grower, et c'est pour ça qu'un effet différé ne peut pas être repoussé indéfiniment par un autre.

## Ce qui déclenche

Un effet se ré-exécute quand une source qu'il a lue a changé de valeur. Deux corollaires qui se
confondent souvent :

- écrire la **même** valeur ne réveille personne — l'identité, pas le type, décide ;
- un effet qui écrit une de ses propres dépendances se ré-exécute **dans le même drainage**, pas au
  tour suivant. La portée du batch est la durée de cette garantie.

> **Marqueur** — si vos effets tournent dans l'ordre que vous attendiez, c'est tout ce qu'il fallait.
> Le reste explique d'où vient l'ordre, et sert si un programme vous surprend.

Le mécanisme est dans [`architecture.md`](./architecture.md) §5. Les écarts assumés avec la référence
sont dans [`SPEC.md`](/SPEC.md) §21.