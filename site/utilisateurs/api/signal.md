# `signal()`

Une cellule de valeur modifiable qui prévient ses lecteurs quand elle change. C'est le premier
geste du moteur, et le seul qui écrit.

| Vous voulez | Allez à |
| --- | --- |
| créer une valeur, avec ou sans argument | [Créer](#creer) |
| savoir quand un signal devient intéressant | [Les crochets](#les-crochets) |
| lire sans être suivi | [Lire sans dépendre](#lire-sans-dependre) |
| écouter sans gérer un effet | [S'abonner](#s-abonner) |
| comprendre pourquoi `NaN` notifie | [Le seuil est `!==`](#le-seuil-est) |
| savoir ce qui se cache derrière | [La classe derrière](#la-classe-derriere) |

Chaque bloc de code de cette page est un **marqueur de la table** — sa forme est
`ts scenarios/<groupe>/<nom>`. Au moment du build, le lecteur exécute ce bloc contre
`signalcn`, et pose dans la page le code nettoyé et le journal que l'exécution a produit :
aucun bloc de cette page n'est écrit à la main, aucun journal non plus.

## Créer

Trois formes, une seule fonction, et `SPEC.md` §5.1 les dit ensemble : sans argument, c'est
`signal(undefined)` — la valeur vaut `undefined`, et le type le dit.

```ts scenarios/signal/no-argument
```

Le journal porte les deux formes, et elles sont indiscernables : la valeur est `undefined` du
premier geste au second.

## Les crochets

`watched` est déclenché à l'ajout du **premier** abonné ; `unwatched`, à la perte du
**dernier** — `SPEC.md` §4.2 les donne comme ça, exécutés dans un `untracked`, ses lectures ne
créant aucune dépendance. `this.name` est lisible dedans : le scénario nomme son signal `"W"`,
et le journal le montre.

```ts scenarios/effect/watchers
```

La première ligne est la paire : `watched W` au premier lecteur, puis `unwatched W` à la perte
du dernier — et l'écriture `s.value = 1` qui suit n'y change rien : il n'y a plus personne.
La seconde est un effet qui lit deux sources : un dispose détache les **deux**, dans l'ordre de
lecture. La troisième est un computé : son `unwatched` part **avant** ceux de ses sources, dans
le même ordre que `watched`.

## Lire sans dépendre

`untracked()` lit sans enregistrer de dépendance, même au milieu d'un effet — `SPEC.md` §10 le
donne pour le cas honnête : un paramètre de configuration qu'on veut courant sans relancer le
calcul à chaque changement de lui. Et `peek()` est son exact miroir sur la surface du signal,
dit `SPEC.md` §5.1 : il lit son propre signal sans abonner.

```ts scenarios/untracked/no-dependency
```

Écrire `b` ne réveille **pas** l'effet : la lecture de `b` est passée sous `untracked`, et le
journal le montre trois fois — ni `b.value = 1`, ni `b.value = 2` ne le font tourner. Écrire
`a` le relance : la lecture de `a` est suivie. Et ni `peek()` ni `untracked()`, repris sur un
deuxième signal, n'ajoutent de dépendance : `runs avec peek 1`, `runs avec untracked 1`.

## S'abonner

`subscribe()` crée un **effet interne** nommé `"sub"` : il lit `this.value`, puis appelle le
callback sous `untracked` — `SPEC.md` §11. Le retour est le dispositeur de cet effet, même
forme que celui de `effect()`, donc utilisable avec `using`.

```ts scenarios/subscribe/untracked-callback
```

L'appel est **immédiat et synchrone** à l'abonnement, avant la ligne suivante : `["got 0",
"after"]` le montre, `got 0` est déjà dans le journal quand `after` l'atteint. Le callback
reçoit exactement un argument, `arguments recus 1`. Ses lectures n'abonnent personne, et ses
écritures sont batchées : la seconde l'emporte, `e now 2` et non `e now 1`.

## Le seuil est `!==`

Écrire plusieurs fois la même valeur dans un batch ne produit qu'une notification — c'est la
coalescence, `SPEC.md` §9.3. Mais le seuil n'est pas l'identité de valeur, et `SPEC.md` §5.2 le
dit : l'égalité est une **identité stricte `!==`**.

```ts scenarios/signal/zero-and-negative-zero
```

`Object.is` dirait le contraire de cette première écriture — `Object.is(0, -0)` est `true`,
donc l'écriture serait acceptée et la valeur bougerait. Voici la seconde moitié de la table du
§5.2 :

```ts scenarios/signal/strict-equality-nan
```

`Object.is(NaN, NaN)` est `true`, donc l'écriture serait ignorée et personne ne serait notifié.
Or `NaN → NaN` notifie. Le seuil est `!==`, sans branche spéciale sur un cas particulier —
c'est ce qui distingue `signalcn` d'une implémentation fondée sur `Object.is`.

## La classe derrière

`signal()` renvoie une instance de `Signal`, et la classe est exportée et constructible — la
structure d'instance observable est `SPEC.md` §5.3, et le scénario la traverse : prototype
partagé, écriture après `new`, et l'appel sans `new` qui lève.

```ts scenarios/signal/instance-and-class
```

`Signal(5)` sans `new` lève — un appel de méthode obtiendrait `this` de son objet, et
l'écriture réussirait : c'est pourquoi la table détache le constructeur avant de l'appeler.

Ce qui n'est **pas** dans cette page appartient à
[`architecture.md`](../../technique/architecture.md) §2 : les huit propriétés-own et leur ordre,
le `brand` posé sur le prototype, l'absence de `_flags`. La surface est ici, la structure est là.

> **Marqueur** — si vous savez créer une valeur, la lire, la comparer et l'écouter, vous avez la
> page. Ce qui suit est un renvoi, pas un coût.

## Et pour les objets ?

`computed()` dérive une valeur d'autres signals — `SPEC.md` §6 — et une dépendance peut naître
au cours du calcul lui-même, §7. `effect()` réagit aux lectures qu'il fait, et se dispose —
`SPEC.md` §8. Pour un objet métier entier, `createModel()` enveloppe chaque méthode de la
fabrique en `action` — `SPEC.md` §16, le seul export qui porte une logique propre.
