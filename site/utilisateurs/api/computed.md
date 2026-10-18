# `computed()`

Une valeur dérivée d'autres signaux, recalculée quand ils changent — et seulement quand un lecteur
la demande. C'est la mémoire du moteur : elle n'exécute rien d'avance.

| Vous voulez | Allez à |
| --- | --- |
| créer une valeur dérivée, paresseuse et mise en cache | [Créer](#creer) |
| nommer le dérivé, et savoir ce qui le protège | [Les options](#les-options) |
| écrire une source sans abonné | [Sans abonné](#sans-abonne) |
| changer de source en cours de route | [Les dépendances dynamiques](#les-dependances-dynamiques) |
| écrire dans la valeur dérivée | [Lecture seule](#lecture-seule) |
| comprendre ce que devient une erreur du calcul | [Les erreurs](#les-erreurs) |
| reconnaître un cycle | [Les cycles](#les-cycles) |
| dériver d'un dérivé, et l'ordre du rafraîchissement | [La chaîne](#la-chaine) |

Chaque bloc de code de cette page est un **marqueur de la table** — sa forme est
`ts scenarios/<groupe>/<nom>`. Au moment du build, le lecteur exécute ce bloc contre
`signalcn`, et pose dans la page le code nettoyé et le journal que l'exécution a produit :
aucun bloc de cette page n'est écrit à la main, aucun journal non plus.

## Créer

`computed(fn, options?)` rend un **signal en lecture seule** dont la valeur dérive d'autres
signaux — `SPEC.md` §6 le dit en une ligne. Le corps est évalué **paresseusement** : rien ne
s'exécute avant la première lecture, et trois lectures consécutives donnent **une** évaluation.

```ts scenarios/computed/lazy-and-cache
```

Le journal se lit en trois temps : `evaluations avant toute lecture 0` — la fabrique n'a rien
calculé —, puis `1` après la première lecture, et toujours `1` après la troisième. La valeur est
rendue au passage : `valeur 10`.

## Les options

Les options sont celles d'un signal — `SPEC.md` §4.1 les nomme `SignalOptions` — : `name`,
`watched`, `unwatched`, et **aucune option de comparaison**, la sémantique d'égalité étant celle du
langage, sans `equals`, `comparator` ni `equal`. `name` est un champ public, **mutable après coup**,
et le `watched` d'un computé se déclenche **avant** ceux de ses sources — `SPEC.md` §4.2.

```ts scenarios/computed/options-and-brand
```

`nom c` à la création, `nom modifie z` ensuite : le nom se lit et s'écrit, la fabrique ne le fige
pas. Et la marque se partage — `Symbol(preact-signals)` pour un computé comme pour un signal,
`SPEC.md` §5.1 — ce qui est exactement le veto que la descente d'un `createModel()` respecte,
`SPEC.md` §16.2 : un dérivé n'est jamais enveloppé comme un objet métier.

## Sans abonné

Sans abonné, une écriture d'une source **ne réveille rien** : le recalcul a lieu à la prochaine
lecture — `SPEC.md` §6.

```ts scenarios/computed/no-subscriber
```

Trois écritures de `a`, et le compte reste à `1` : aucun nœud ne suit le computé, donc personne
n'est notifié. La lecture suivante rend `5` — la valeur intègre les **trois** écritures, pas
seulement la dernière — et l'évaluation monte alors à `2`.

## Les dépendances dynamiques

Une dérivation ne conserve que les dépendances **effectivement lues** à son dernier passage —
`SPEC.md` §7 réconcilie la liste à chaque évaluation, et une dépendance abandonnée cesse de
notifier.

```ts scenarios/computed/dynamic-dependencies
```

Le journal ne relaie `a` qu'une fois : après la bascule, `c` lit `b`, et l'écriture de `a` ne
change plus rien — `apres ecriture de a, qui n'est plus lue b`. Ce n'est pas la paresse qui a
bougé, c'est la liste : `a` n'en fait plus partie.

Relue, la dépendance redevient notifiante — le nœud abandonné est **réutilisé** à la réactivation,
pas recréé, dit toujours `SPEC.md` §7 — et la valeur écrite pendant l'abandon ne se perd pas.

```ts scenarios/computed/reactivation-after-abandon
```

Le journal recompose `aba` : `a`, puis `b` pendant l'abandon, puis `a` de nouveau. La valeur rendue
est `10`, celle que `a` portait — écrite pendant qu'aucun calcul ne le lisait.

## Lecture seule

La valeur d'un computé **ne s'écrit pas** : le descripteur `value` n'a pas de setter, donc en mode
strict l'affectation lève `TypeError`, et en mode sloppy elle est silencieusement ignorée —
`SPEC.md` §6 fixe les deux.

```ts scenarios/computed/read-only
```

`instanceof Signal true` et `instanceof Computed true` : un dérivé est un signal, d'une classe qui
en hérite — la classe `Computed` est exportée et constructible, `SPEC.md` §4. `le descripteur a un
setter undefined` donne la raison de l'écriture qui lève, et les deux lignes suivantes séparent les
modes : le `Function` du scénario n'est pas strict, l'affectation y est un no-op et la valeur ne
bouge pas.

## Les erreurs

L'erreur d'un calcul est **mémorisée dans la valeur** : `SPEC.md` §15.7 la re-throw à chaque lecture
de `.value`, sans réévaluer le corps — une seule évaluation, et **la même instance** d'`Error` tant
qu'aucune dépendance n'a bougé.

```ts scenarios/computed/cached-error
```

Trois lectures après le déclenchement, trois fois `boom` : le corps n'a tourné qu'une fois de plus,
et le compte le confirme — `2` évaluations, puis `3` après la résolution, où la valeur saine
revient.

Le même §15.7 fait propager l'erreur par **tous** les points de lecture : `.value`, `peek`,
`toString()`, `valueOf()` et `toJSON()`.

```ts scenarios/computed/conversions-propagate-the-error
```

Cinq lignes, cinq `Error` : aucun des cinq points n'absorbe l'erreur ni ne rend une valeur. Le
journal porte le **type**, jamais le message — `SPEC.md` §15.4 ne fige pas la chaîne, et
`signals.min.js` la réécrit.

Reste l'observateur. Un effet qui lit un computé qui lève à son **premier** run est disposé par
cette erreur, et `effect()` ne rend alors **aucun** dispositeur — `SPEC.md` §15.5.

```ts scenarios/computed/error-to-effect
```

`creation Error`, `runs 1` : l'effet est mort à sa première faute, et l'écriture suivante ne le
rappelle pas — `apres ecriture de la source, l'effet a-t-il tourne ? 1`. Le computé, lui, survit :
`valeur du compute une fois resolu 1`, une fois la source apaisée.

## Les cycles

Lire un computé **pendant son propre calcul** lève immédiatement, même hors `batch` — `SPEC.md`
§15.1 fait reposer cette détection sur le drapeau `RUNNING`, distinct du compteur de drainages.

```ts scenarios/computed/cycles
```

`auto-cycle : type, evaluations Error / 1` : l'auto-rentrée lève avant d'avoir tourné deux fois. Le
cycle **indirect** — deux computés qui se lisent — est le même refus, `Error / 2`, une évaluation de
chaque côté. Le type est contractuel, le texte ne l'est pas : `Error`, jamais `TypeError` —
`SPEC.md` §15.3 — et le message n'est pas asserté, `SPEC.md` §15.4.

## La chaîne

Un computé peut en dériver un autre — `SPEC.md` §6 compte les computés imbriqués dans le
comportement —, et le rafraîchissement suit la lecture : quand un effet lit le dérivé, la source se
recalcule d'abord. `SPEC.md` §13.4 donne l'ordre de drainage pour **normatif**.

```ts scenarios/computed/bottom-up-chain-order
```

Le journal sort `c1`, puis `c2`, puis les deux effets : `["c1:0","c2:1","e1:2","e2:2"]` — une
chaîne se rafraîchit de bas en haut, et les deux effets voient la même valeur finale, dans leur
ordre de création. La seconde ligne rejoue la chaîne après l'écriture, dans le même ordre.

Ce qui n'est pas dans cette page appartient à
[`architecture.md`](../../technique/architecture.md) §2 : les douze propriétés-own et leur ordre —
`_fn`, `_sources`, `_globalVersion` et `_flags` derrière les huit d'un signal —, et le drapeau
`OUTDATED` qui fait échouer la voie rapide d'un computé neuf. La surface est ici, la structure est
là.

> **Marqueur** — si vous savez dériver une valeur, la relire sans la recalculer, changer de source
> et rattraper une erreur, vous avez la page. Ce qui suit est un renvoi, pas un coût.

## Et après ?

`effect()` réagit aux lectures qu'il fait — un computé est une source comme une autre — et rend le
moyen de s'arrêter, `SPEC.md` §8. `batch()` regroupe les écritures et diffère la propagation
jusqu'au drainage, `SPEC.md` §9, l'ordre du §13.4 y restant normatif. Et pour un objet métier
entier, `createModel()` enveloppe chaque méthode de la fabrique en `action`, et un effet créé dans
un computé de la fabrique ne lui appartient pas — `SPEC.md` §16.4.

Côté migration, ce que ce dérivé change pour du code écrit contre la baseline — l'énumération du
`for..in`, le `constructor` du prototype — est relevé dans
[`migrer-depuis-preact.md`](../migrer-depuis-preact.md#l-enumeration).
