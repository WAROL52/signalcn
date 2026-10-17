# `effect()`

Une fonction qui suit ce qu'elle lit, se relance quand ça change, et rend la fonction qui
l'arrête. C'est la réaction du moteur : elle ne rend rien d'autre que le moyen de s'arrêter.

| Vous voulez | Allez à |
| --- | --- |
| savoir quand le premier tour se produit | [Le premier tour](#le-premier-tour) |
| réagir à des valeurs, avec un nettoyage propre | [Réagir](#reagir) |
| ne suivre aucun signal, tourner une seule fois | [Ne rien suivre](#ne-rien-suivre) |
| arrêter un effet, dehors ou du dedans | [S'arrêter](#s-arreter) |
| savoir ce que `effect()` rend, et le passer à `using` | [La forme du rendu](#la-forme-du-rendu) |
| connaître l'ordre des runs, dans et hors `batch` | [L'ordre](#l-ordre) |
| comprendre quand une erreur sort, ou pourquoi un effet boucle | [Les erreurs](#les-erreurs) |
| accéder à l'instance, et donner un nom | [La classe derrière](#la-classe-derriere) |

Chaque bloc de code de cette page est un **marqueur de la table** — sa forme est
`ts scenarios/<groupe>/<nom>`. Au moment du build, le lecteur exécute ce bloc contre
`signalcn`, et pose dans la page le code nettoyé et le journal que l'exécution a produit :
aucun bloc de cette page n'est écrit à la main, aucun journal non plus.

## Le premier tour

Le premier run est **synchrone, avant que `effect()` ne rende la main**, et le callback ne
reçoit aucun argument — `SPEC.md` §8.1 fixe les deux à la suite.

```ts scenarios/effect/first-run-and-arguments
```

La ligne du journal est collectée pendant ce premier tour : `0/object` dit zéro argument, et
un `this` d'objet — c'est déjà l'instance, dont la [classe](#la-classe-derriere) est plus
bas. Une écriture posée juste après `effect()` trouve donc un effet vivant, pas un effet en
attente.

## Réagir

Les lectures deviennent les dépendances, et le ré-run suit **chaque changement de
dépendance** — `SPEC.md` §8.1 ; `SPEC.md` §12 y ajoute le cleanup : exécuté **juste avant le
run suivant** — et au moment du dispose —, il lit la valeur **courante**.

```ts scenarios/effect/rerun-and-cleanup
```

Le journal se lit en quatre temps : `run:0` est le premier tour ; écrire `1` passe d'abord
par `cleanup:1` — le nettoyage voit la valeur **écrite**, pas celle de son run — puis
`run:1` ; écrire `2` repart de même. La seconde moitié resserre le cas à une seule source :
deux sources, écrites dans les deux sens, et les **trois** écritures réveillent le run — la
première lue réveille autant que la dernière.

## Ne rien suivre

Un effet qui ne lit **aucun signal** n'a rien à quoi s'abonner : il tourne une fois et plus
jamais — `SPEC.md` §8.1.

```ts scenarios/effect/no-dependency
```

Le compteur reste à un après deux écritures. Aucune lecture ne s'est produite pendant le
tour de l'effet : `s.value = 1` puis `2` ne notifient personne.

## S'arrêter

Disposer est **idempotent** — `SPEC.md` §8.1 : le même dispose, appelé de nouveau, ne produit
rien de plus. Depuis l'intérieur, la geste est `this.dispose()`, où `this` est déjà
l'instance — `SPEC.md` §8.3 —, et l'écriture suivante ne trouve plus rien à notifier —
`SPEC.md` §12 met le dispose devant toute nouvelle propagation.

```ts scenarios/dispose/during-the-run
```

Deux `dispose()` au même tour, et `run:0` est le seul run du journal : le second appel ne
fait rien, et `aucun run apres 1` le dit après l'écriture.

## La forme du rendu

Ce que `effect()` rend n'est **ni une flèche, ni l'instance** — `SPEC.md` §8.2 : `.name`
vaut `"bound "`, `.length` vaut `0`, les clés own sont vides, et `[Symbol.dispose]` est
**la même fonction**, donc `using` l'admet.

```ts scenarios/effect/shape-of-the-disposer
```

`type function`, `name "bound "`, `length 0`, `cles []` : la forme liée, tenue. Le
**mécanisme**, lui, est consigné à `SPEC.md` §21.1 (`effect#41`, `dispose#3`) : une fonction
ordinaire qui ferme sur l'instance, pas un `bind` — c'est ce qui laisse `using` fonctionner
ici, là où il lève `TypeError` sur le paquet installé.

## L'ordre

Hors `batch()`, chaque écriture se propage à l'instant — le batch, `SPEC.md` §9, est ce qui
diffère —, donc l'ordre des runs suit celui des écritures.

```ts scenarios/effect/order-outside-batch
```

Dans un `batch()`, la file d'effets différés est une **pile** — `SPEC.md` §13.4 fixe deux
règles distinctes : les signaux écrits se drainent à l'inverse des **écritures**, et
plusieurs effets sur le même signal sortent dans l'ordre de **création**.

```ts scenarios/batch/three-levels-and-order
```

`b` est écrite **en second**, et `C:1` passe avant `A:1` et `B:1` ; `a` alimente deux
effets, et `A:1` puis `B:1` gardent l'ordre de création. Les imbrications n'ajoutent rien au
drain : trois niveaux, un seul — `SPEC.md` §9.1.

## Les erreurs

L'asymétrie est double — `SPEC.md` §15.5 : au **premier** run, l'erreur dispose l'effet, se
propage, et `effect()` ne rend **aucun dispositeur** ; à un **re-run**, l'effet reste vivant,
et l'écriture suivante le rappelle.

```ts scenarios/effect/errors
```

Le message journalisé est celui du callback : « boom premier » puis « boom rerun ». La
troisième ligne se lit avec sa question — la variable `rendu` vaut soit le dispositeur, soit
`"leve"` — ici elle n'a jamais vu le dispositeur, il n'y en a **pas** : `runs du premier
effet 1`, l'effet est disposé à sa faute. Le survivant tient trois runs : `t.value = 2` le
rappelle, et il ne lève plus.

Un cycle qui se borne n'est pas une erreur — `SPEC.md` §15.2 : `if (v < 50)` produit 51
exécutions sans lever, et s'arrête quand la condition s'éteint.

```ts scenarios/effect/bounded-cycle
```

`runs 51` est ce que ce corps produit, **pas un contrat** : la borne de drainage n'est pas
figée — `SPEC.md` §21.2 le consigne et aucune promesse n'est faite sur le compte. Côté
migration, le pas à porter est écrit dans
[`migrer-depuis-preact.md`](../migrer-depuis-preact.md#les-cycles).

## La classe derrière

`this` est l'instance d'`Effect` **pour une fonction non fléchée** — `SPEC.md` §8.3 — ; une
flèche, elle, capture le `this` lexical du module : dans le harnais, ce `this` de module est
`globalThis`, ce que le journal dit.

```ts scenarios/effect/this-is-the-instance
```

La classe `Effect` est exportée, et l'instance est la même par ses deux routes : `this` dans
le callback, et le constructeur — `new Effect(fn, { name: "n" })`. Le nom donné en options,
lui, ne se lit **que sur l'instance** — `SPEC.md` §4.2 — : la valeur de retour le cache,
comme `SPEC.md` §8.2 le montre avec `"bound "`.

Ce qui n'est **pas** dans cette page appartient à
[`architecture.md`](../../technique/architecture.md) §2 : les six propriétés-own et leur
ordre, la file `_nextBatchedEffect`, ce qui rend `this.dispose()` possible. La surface est
ici, la structure est là.

> **Marqueur** — si vous savez réagir, arrêter un effet et lire son journal, vous avez la
> page. Ce qui suit est un renvoi, pas un coût.

## Et après ?

`computed()` dérive une valeur d'autres signals, et une dépendance peut naître au cours du
calcul lui-même — `SPEC.md` §6, §7 — ; un effet suit un computé comme n'importe quelle
source. `batch()` regroupe les écritures et diffère le drainage jusqu'à la sortie —
`SPEC.md` §9 —, l'ordre du §13.4 y est normatif. Et pour un objet métier entier,
`createModel()` enveloppe chaque méthode de la fabrique en `action`, et les effets créés
pendant la construction lui appartiennent — `SPEC.md` §16.4.
