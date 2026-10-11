# `signal()`

Une cellule de valeur modifiable qui prévient ses lecteurs quand elle change. C'est le premier
geste du moteur, et le seul qui écrit.

| Vous voulez | Allez à |
| --- | --- |
| créer une valeur, avec ou sans argument | [Créer](#creer) |
| savoir quand un signal devient intéressant | [Les crochets](#les-crochets) |
| lire sans être suivi | [Lire sans dépendre](#lire-sans-dependre) |
| écouter sans gérer un effet | [S'abonner](#sabonner) |
| comprendre pourquoi `NaN` notifie | [Le seuil est `!==`](#le-seuil-est-) |
| savoir ce qui se cache derrière | [La classe derrière](#la-classe-derriere) |
| comprendre comment le graphe se construit | [La cellule et le nœud](../reimplementer/la-cellule.md) |

Chaque bloc de code de cette page est un **scénario du harnais différentiel** : il est exécuté
au moment du rendu, et le journal affiché est celui que l'exécution a produit.

## Créer

Trois formes, une seule fonction. Sans argument, c'est `signal(undefined)` — la valeur vaut
`undefined`, et le type le dit.

```ts scenarios/signal/valeur-par-defaut
const compteur = signal(0)
const sans = signal()
const nomme = signal(1, { name: "compteur" })
log("sans argument", String(sans.value))
log("le nom survit", String(nomme.name))
```

```text
sans argument undefined
le nom survit compteur
```

## Les crochets

`watched` est appelé quand le **premier** lecteur s'abonne ; `unwatched`, quand le **dernier** se
désabonne. Ce sont des crochets, pas des observateurs : ils ne lisent rien et ne s'abonnent à rien.

```ts scenarios/signal/crochets-watched-unwatched
const s = signal(0, {
  watched: () => log("premier lecteur"),
  unwatched: () => log("dernier lecteur parti"),
})

const lecteur = effect(() => log("l'effet tourne", String(s.value)))
s.value = 1
lecteur.dispose()
```

```text
premier lecteur
l'effet tourne 0
l'effet tourne 1
dernier lecteur parti
```

## Lire sans dépendre

`peek()` et `untracked()` lisent sans enregistrer de dépendance, même au milieu d'un effet. La
différence : `untracked()` lit une valeur, `peek()` est une méthode du signal qui lit la sienne.

```ts scenarios/signal/lire-sans-dependre
const niveau = signal(2)
const user = signal("ada")

effect(() => log("l'effet lit", user.value, untracked(() => niveau.value)))
niveau.value = 3
user.value = "grace"
```

```text
l'effet lit ada 2
l'effet lit grace 3
```

Écrire `niveau` n'a **pas** relancé l'effet : il n'en dépend pas. Écrire `user` l'a relancé. C'est
le cas honnête d'une lecture sans abonnement — un paramètre de configuration qu'on veut courant
sans relancer le calcul à chaque changement de lui. `SPEC.md` §5.1 et §10.

## S'abonner

`subscribe()` crée un **effet interne** nommé `"sub"` : il lit `this.value`, puis appelle le
rappel sous `untracked`. Le rappel n'est jamais suivi, et une écriture faite dedans ne propage
pas. Le retour est le dispositeur de cet effet — même forme que celui de `effect()`, donc
utilisable avec `using`. `SPEC.md` §11.

```ts scenarios/signal/abonnement
const s = signal(1)
const arret = s.subscribe((x) => log("recu", String(x)))
s.value = 2
arret()
log("apres arret", String(s.value))
```

```text
recu 1
recu 2
apres arret 2
```

Le rappel est appelé **tout de suite**, à l'abonnement — `recu 1` avant toute écriture.

## Le seuil est `!==`

Écrire la même valeur ne réveille personne — c'est la coalescence, `SPEC.md` §9.3. Mais le seuil
n'est **pas** l'identité de valeur :

```ts scenarios/signal/seuil-est-inequality
const s = signal(0)
s.value = -0
log("0 -> -0 ignoree", String(s.value))

const nan = signal(NaN)
nan.value = NaN
log("NaN -> NaN accepte", String(nan.value))
```

```text
0 -> -0 ignoree 0
NaN -> NaN accepte NaN
```

`Object.is` donnerait le résultat opposé sur `NaN` — `Object.is(NaN, NaN)` est `true`, donc
l'écriture serait ignorée et personne ne serait notifié. Or la référence notifie. Le seuil est
`!==`, sans branche spéciale. C'est ce qui distingue `signalcn` d'une implémentation fondée
sur `Object.is`. `SPEC.md` §5.2.

## La classe derrière

`signal()` renvoie une instance de `Signal`, et la classe est exportée et constructible.

```ts
class Signal<T = undefined> {
  get value(): T
  set value(next: T)
  peek(): T
  subscribe(fn: (value: T) => void): Disposer
  toString(): string
  valueOf(): T
  toJSON(): T
}
```

Ce qui n'est **pas** dans cette page appartient à
[`architecture.md`](../../technique/architecture.md) §2 : les huit propriétés-own et leur ordre,
le `brand` posé sur le prototype, l'absence de `_flags`. La surface est ici, la structure est là.

> **Marqueur** — si vous savez créer une valeur, la lire, la comparer et l'écouter, vous avez la
> page. Ce qui suit est un renvoi, pas un coût.

## Et pour les objets ?

`computed()` dérive une valeur d'autres signals, et `effect()` réagit. Les deux sont dans
[`computed.md`](./computed.md) et [`effect.md`](./effect.md). Pour un objet métier entier,
[`createModel()`](./createModel.md) enveloppe chaque méthode en `action` — et c'est le seul
export qui a une logique propre.
