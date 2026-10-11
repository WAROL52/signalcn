# `signal()` — variante B

Variante du prototype : **le journal est la colonne vertébrale**. Pas de sections « cas d'usage »,
pas de renvoi vers une page de mécanisme — chaque ligne du journal porte son explication à côté,
et le prototype tient en haut.

| Vous voulez | Allez à |
| --- | --- |
| la signature | [Le prototype](#le-prototype) |
| le détail le plus piégeux | [`NaN` notifie](#nan-notifie) |

## Le prototype

```ts
signal<T>(value: T, options?: SignalOptions<T>): Signal<T>
signal<T = undefined>(): Signal<T | undefined>
```

Options : `watched`, `unwatched`, `name`. Sans argument, la valeur vaut `undefined`.

## `NaN` notifie

Le seuil est `!==`, pas `Object.is`. `Object.is(NaN, NaN)` est `true`, donc l'écriture serait
ignorée — or la référence notifie. `SPEC.md` §5.2.

## Ce que ça fait, en une fois

```ts scenarios/signal/valeur-par-defaut
const sans = signal()
log("sans argument", String(sans.value))
log("nom garde", signal(1, { name: "compteur" }).name)
const s = signal(NaN)
s.value = NaN
log("NaN -> NaN ecriture acceptee", String(s.value))
const m = signal(0)
m.value = 0
log("meme valeur, pas de notification", String(m.value))
const v = signal(1)
const d = v.subscribe((x) => log("abonne recoit", String(x)))
v.value = 2
d()
log("apres desabonnement", String(v.value))
const p = signal(1)
log("peek", String(p.peek()))
log("pas d abonnement", String(p.value))
```

```text
sans argument undefined          la valeur vaut undefined, et le type le dit
nom garde compteur                l'option name survit a la minification
NaN -> NaN ecriture acceptee NaN  !== , pas Object.is — la reference notifie
meme valeur, pas de notification 0  la coalescence, SPEC.md §9.3
abonne recoit 1                   un abonnement appelle le rappel tout de suite
abonne recoit 2                   puis a chaque ecriture
apres desabonnement 2             le dispositeur coupe la chaine
peek 1                            une lecture qui n enregistre aucune dependance
pas d abonnement 1                donc rien n a change
```

> **Marqueur** — si vous savez créer une valeur et la lire, vous avez la page.

Le reste — la classe `Signal` et ses huit propriétés-own, `subscribe()` et sa forme de
dispositeur, `peek()` et sa contrainte — est dans
[`architecture.md`](../../technique/architecture.md) §2 et `SPEC.md` §5.
