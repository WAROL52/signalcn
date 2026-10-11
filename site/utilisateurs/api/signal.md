# `signal()`

Une cellule de valeur modifiable qui prévient ses lecteurs quand elle change. C'est le premier
geste du moteur, et le seul qui écrit.

| Vous voulez | Allez à |
| --- | --- |
| voir la signature et les options | [Le prototype](#le-prototype) |
| comprendre pourquoi `NaN` notifie | [Le seuil est `!==`](#le-seuil-est-) |
| lire sans être suivi | [`peek()`](#peek) |
| écouter sans gérer un effet | [`subscribe()`](#subscribe) |
| savoir ce qui se cache derrière | [La forme derrière](#la-forme-derriere) |
| comprendre comment le graphe se construit | [La cellule et le nœud](../reimplementer/la-cellule.md) |

## Le prototype

```ts
signal<T>(value: T, options?: SignalOptions<T>): Signal<T>
signal<T = undefined>(): Signal<T | undefined>
```

Sans argument, c'est `signal(undefined)` — la valeur vaut `undefined`, et le type le dit.

`SignalOptions` porte trois champs, tous optionnels :

| Champ | Effet |
| --- | --- |
| `watched` | appelé quand le **premier** lecteur s'abonne |
| `unwatched` | appelé quand le **dernier** lecteur se désabonne |
| `name` | nom de la fonction, conservé dans l'artefact minifié |

`watched` et `unwatched` sont des crochets, pas des observateurs : ils ne lisent rien, et ils ne
s'abonnent à rien. Leur rôle est de dire au code autour qu'un signal est devenu intéressant.

## Le seuil est `!==`

C'est le détail le plus piégeux du contrat, et il est normatif — `SPEC.md` §5.2.

```text
  NaN -> NaN     : ecriture acceptee, notifie
  0   -> -0      : ecriture ignoree
  -0  -> 0       : ecriture ignoree
  objet ≠ objet  : notifie
  meme reference : ignoree
```

`Object.is` donnerait le résultat **opposé** sur `NaN` : `Object.is(NaN, NaN)` est `true`, donc
l'écriture serait ignorée et personne ne serait notifié. Or la référence notifie. Le seuil est
donc `!==`, sans branche spéciale.

## `peek()`

Une lecture qui n'enregistre **aucune** dépendance, même au milieu d'un effet. C'est la forme
pour lire une valeur qu'on ne veut pas suivre — un paramètre de configuration, une valeur qu'on
consulte une fois.

`peek()` est exactement `untracked(() => this.value)`, et c'est une contrainte : la seule façon
de rendre cette méthode autre chose serait de passer par l'accesseur `value` quand le suivi
existera.

## `subscribe()`

S'abonner, c'est créer un **effet interne** nommé `"sub"` : il lit `this.value`, puis appelle le
rappel sous `untracked`. Le rappel n'est donc jamais suivi, et une écriture faite dedans ne
propage pas.

Le retour est le dispositeur de cet effet — même forme que celui de `effect()`, donc utilisable
avec `using`.

## La forme derrière

`signal()` renvoie une instance de `Signal`, et la classe est exportée et constructible. Huit
propriétés-own, **dans cet ordre** — l'ordre est le contrat, `SPEC.md` §5.3, parce qu'`Object.keys`
le révèle :

```text
_value, _version, _node, _targets, _batchSnapshotVersion, _watched, _unwatched, name
```

`brand` n'est **pas** un champ : il est posé par `defineProperty` sur le prototype, non
énumérable, donc `for..in` sur un signal expose 8 clés et non 17. C'est ce qui protège un signal
quand il entre dans un `createModel()`.

> **Marqueur** — si vous savez créer une valeur, la lire, la comparer et l'écouter, vous avez la
> page. La section suivante est un renvoi, pas un coût.

## Ce que ça fait, en une fois

Le bloc ci-dessous est un **scénario du harnais différentiel** : le code est exécuté au moment du
rendu, et le journal affiché est celui que l'exécution a produit. Il n'est jamais écrit à la main.

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
sans argument undefined
nom garde compteur
NaN -> NaN ecriture acceptee NaN
meme valeur, pas de notification 0
abonne recoit 1
abonne recoit 2
apres desabonnement 2
peek 1
pas d abonnement 1
```

Trois lectures de ce journal, et c'est la page entière :

- `abonne recoit 1` **avant** toute écriture — un abonnement appelle le rappel tout de suite ;
- `meme valeur, pas de notification` — la coalescence, `SPEC.md` §9.3, et la raison pour
  laquelle écrire deux fois ne coûte rien ;
- `pas d abonnement 1` — `peek()` a lu sans s'abonner, donc la valeur n'a pas changé et rien
  n'a été enregistré.

## Et pour les objets ?

`computed()` dérive une valeur d'autres signaux, et `effect()` réagit. Les deux sont dans
[`computed.md`](./computed.md) et [`effect.md`](./effect.md). Pour un objet métier entier,
[`createModel()`](./createModel.md) enveloppe chaque méthode en `action` — et c'est le seul
export qui a une logique propre.
