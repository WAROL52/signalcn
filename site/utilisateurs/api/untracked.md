# `untracked()`

Une lecture qui ne s'inscrit nulle part : le callback s'exécute, sa valeur revient, et le contexte
qui l'entoure n'a rien appris. C'est le geste du moteur pour lire sans s'abonner — au milieu d'un
effet comme hors de lui.

| Vous voulez | Allez à |
| --- | --- |
| lire un signal sans l'ajouter aux dépendances | [La lecture neutralisée](#la-lecture-neutralisee) |
| écrire sous `untracked`, et retrouver le suivi après une exception | [Les écritures](#les-ecritures) |
| lire un computé sans réveiller son lecteur | [Le computé lu](#le-compute-lu) |
| retrouver la valeur du callback, promesse comprise | [La valeur rendue](#la-valeur-rendue) |
| savoir ce qu'un `createModel` possède encore | [La portée de capture](#la-portee-de-capture) |
| créer un effet indépendant de l'effet qui l'a créé | [L'effet créé dedans](#l-effet-cree-dedans) |

Chaque bloc de code de cette page est un **marqueur de la table** — sa forme est
`ts scenarios/<groupe>/<nom>`. Au moment du build, le lecteur exécute ce bloc contre
`signalcn`, et pose dans la page le code nettoyé et le journal que l'exécution a produit :
aucun bloc de cette page n'est écrit à la main, aucun journal non plus.

## La lecture neutralisée

`untracked(fn)` « exécute une lecture sans ajouter les signaux consultés aux dépendances du
contexte réactif extérieur » — `SPEC.md` §10. C'est toute la promesse, et elle vaut des deux
côtés : au milieu d'un effet, les lectures du callback quittent le suivi ; hors d'un effet, il n'y
a personne à qui les ajouter, et l'appel se contente de rendre.

```ts scenarios/untracked/no-dependency
```

Le journal se lit en trois temps. `apres creation ["e:0/0"]` : l'effet a tourné une fois à sa
pose, lisant `a` sous suivi et `b` sous `untracked`. `b ecrit, non suivi` puis `b reecrit` : le
journal ne bouge pas d'une entrée, les deux écritures n'ont atteint personne. `a ecrit` seul le
relance — `["e:0/0","e:1/2"]` —, et la valeur **courante** de `b` part avec. Les deux dernières
lignes rejouent le verdict : `runs avec peek 1`, `runs avec untracked 1` — `peek()`, que
`SPEC.md` §5.1 donne pour le miroir du signal, tient le même compte.

## Les écritures

« `untracked` **n'empêche pas** les écritures », et « le contexte précédent est restauré même
lorsqu'une exception est levée, par un `finally` » — les deux sont dans `SPEC.md` §10. La
neutralisation ne couvre que le **suivi** : le reste du pipeline reste intact.

```ts scenarios/untracked/writes-and-restore
```

`ecritures autorisees ["e:0","dans untracked","e:1","apres ecriture"]` : l'écriture de `1` a
trouvé l'effet **pendant** le callback — `e:1` paraît avant `apres ecriture`. Rien n'est gelé, et
hors `batch` la propagation reste synchrone. La seconde ligne est le témoin de la restauration :
après l'exception rattrapée (`va lever`, `caught`), l'écriture de `2` réveille encore l'effet
(`e:2`). Sans le `finally`, le contexte serait resté vidé et la suite n'aurait plus rien suivi.

## Le computé lu

`untracked` « **ne désactive pas** le rafraîchissement d'un computed lu » — `SPEC.md` §10. La
lecture ne réveille personne, mais elle ne fige pas le dérivé non plus : il se rafraîchit à la
prochaine demande, c'est-à-dire à la prochaine lecture.

```ts scenarios/untracked/computed-refresh
```

`runs:1 cCalls:1` à l'état initial, et **les mêmes comptes** après l'écriture : l'effet ne dépend
pas de `c`, et le computé n'a pas recalculé. `valeur lue dehors 10` est la lecture qui le
rafraîchit, et `apres la lecture runs:1 cCalls:2` sépare les deux — le computé a intégré
l'écriture, l'effet n'a pas bougé. Lire n'est pas suivre ; lire n'est pas invalider non plus.

## La valeur rendue

`untracked<T>(fn: () => T): T` rend la valeur du callback telle quelle — `SPEC.md` §4. L'appel vit
très bien **hors d'un effet** : il n'y a aucun contexte à neutraliser, et c'est la valeur qui
reste le contrat ; une `Promise` n'est pas attendue, elle traverse.

```ts scenarios/untracked/return-value
```

Quatre appels, quatre réponses : `nombre 42` ; `objet la reference` — la **même** référence, et
non une copie — ; `promesse passee telle quelle oui` ; `undefined undefined`, la valeur comme
l'absence.

## La portée de capture

`untracked` a un second effet : il « neutralise la portée de capture d'effets d'un `createModel`
englobant, puis la restaure » — `SPEC.md` §10 —, et un effet créé sous `untracked` au sein d'une
fabrique **n'appartient pas** au modèle — `SPEC.md` §16.4.

```ts scenarios/untracked/suspended-capture
```

Première moitié, l'exception : la fabrique imbriquée qui lève est rattrapée dans l'appelante, et
l'effet qui suit est posé — `capture apres exception ["avant","attrape","owned"]`, les trois
temps, puis le silence du dispose. C'est la règle du `finally` qui tient la portée à travers
l'échec, et la seconde moitié est celle qui paie la preuve : `capture reimplantee par un computé
["owned:0","owned:1"]`, **sans** `owned:2` — l'effet, créé après la lecture sous `untracked`,
appartient bien au modèle ; le dispose l'emporte, et l'écriture suivante ne le voit pas. Une
capture restée neutralisée aurait laissé l'effet orphelin, et son `owned:2` serait au journal.

## L'effet créé dedans

Un effet créé dans un `untracked` au milieu d'un autre effet ne suit pas son parent — `SPEC.md`
§13.6 : « un effect créé dans un effect est indépendant et non possédé ». Le parent relancé ne
l'emporte pas avec lui, et §16.4 range l'effet né dans un `untracked()` englobant parmi ce qui
**n'est pas** possédé.

```ts scenarios/untracked/effect-created-inside
```

`parents:1 crees:1 interieurs:1` : le parent a tourné une fois et créé un premier interne, lancé
une fois. Après l'écriture, `parents:2 crees:2 interieurs:2` : le parent se relance, car il lit
`a`, et cette seconde visite crée un **second** interne — le premier n'a pas rejoué avec lui.
Chaque interne a tourné exactement une fois, et chacun lit `b`, qui ne change jamais : tout
re-run qu'il ferait serait imputable au parent, et le compte ne le montre pas.

Ce qui n'est **pas** dans cette page appartient à [`architecture.md`](../../technique/architecture.md)
§8 : l'emplacement unique du suivi, la garde qui le lit en tête de l'ajout de dépendance, et ce
qu'`untracked` vide — l'emplacement **et** la portée de capture, restaurés ensemble dans un
`finally`. Le §11 porte la portée elle-même : `capturedEffects`, l'ouverture inconditionnelle
d'un `createModel`, et sa neutralisation par `untracked`. La surface est ici, la structure est là.

> **Marqueur** — si vous savez lire sans être suivi, écrire dedans sans perdre le fil, et créer un
> effet qui ne s'accroche pas à son parent, vous avez la page. Ce qui suit est un renvoi, pas un
> coût.

## Et après ?

`action()` enveloppe les fonctions d'un modèle — `SPEC.md` §16.2 — et partage le verdict de la
portée : un effet créé dans une `action()` englobante **n'appartient pas** au modèle, comme sous
`untracked` — `SPEC.md` §16.4. Le callback de `subscribe()`, lui, s'exécute sous `untracked` :
ses lectures n'abonnent personne — `SPEC.md` §11. Côté usage,
[`batch-et-surprises.md`](../batch-et-surprises.md) range « un `untracked()` à l'intérieur d'un
batch » parmi ses surprises.
