# La cellule et le nœud

Ce qui décide qu'une écriture se tait, qu'une écriture réveille, et quelle cible
l'entend — trois règles distinctes, rejouées ici code et journal à l'appui. Cette page
est une étape du [chapitre de reconstruction](./index) ; le chapitre rejoue le moteur
dans l'ordre où on le réécrirait.

> **Structure :** [`architecture.md`](../architecture.md) — la cellule (`Signal`), la liste
> de ses cibles, et le nœud qu'une réactivation ne réalloue pas.
> **Norme :** [`SPEC.md`](/SPEC.md) — l'identité qui décide d'une écriture y est normative
> (§5.2), la notification qu'elle porte aussi (§5.1), et la dépendance qu'une relecture
> redonne (§7) ; cette page les rejoue, elle n'établit rien.

| Vous voulez | Allez à |
| --- | --- |
| voir quand une écriture se tait et quand elle passe | [Les écritures que l'identité refuse](#les-ecritures-que-lidentite-refuse) |
| voir la place de cette page dans l'ordre du chapitre | [Le chapitre de reconstruction](./index) |

Chaque bloc de code de cette page est une **reconstitution** : le corps d'un test de la
suite `signalcn-seul`, exécuté au moment du rendu contre l'artefact distribué. Le journal
que la page montre est celui de cette exécution — jamais une recopie. Le nom du bloc est le
nom du test, et une entrée de matrice existante le cite à côté des scénarios qu'elle porte
déjà : la couverture ne gagne aucune entrée, et le harnais rejoue le même test contre le
paquet de référence.

## Les écritures que l'identité refuse

Une écriture modifie le signal et propage l'invalidation « si la sémantique d'égalité le
déclenche » ([`SPEC.md`](/SPEC.md) §5.1) — et cette sémantique est une **identité stricte
`!==`**, pas une identité de valeur ([`SPEC.md`](/SPEC.md) §5.2). La reconstitution fait
compter les tournées à deux cellules attentives : la première écoute une écriture neuve, la
même primitive écrite deux fois et `NaN` appliqué à `NaN` ; la seconde écoute `0`, puis un
`-0`.

```ts reconstitution/identical-writes-are-not-notified
```

La première ligne est la tournée de création : l'effet s'exécute aussitôt posé, sans
attendre d'écriture. Puis les écritures partagent le même fil : la primitive identique laisse
le compte à deux, `NaN` passe **deux** fois parce que `NaN !== NaN` est vrai, et le `-0`
n'arrive à rien — la seconde cellule a tourné une fois, sa création, et `Object.is` dit que
la valeur est restée `0`. Le silence d'une écriture n'est pas une perte : une valeur qui
n'a pas changé n'a rien à dire.
