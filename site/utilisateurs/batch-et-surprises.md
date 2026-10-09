# Le batch et ses surprises

Quand deux écritures se touchent dans la même boucle, et ce qui surprend à l'exécution — l'ordre,
la coalescence, `action`.

| Vous voulez | Allez à |
| --- | --- |
| regrouper des écritures | [Un batch, c'est une parenthèse](#un-batch-c-est-une-parenthese) |
| savoir quel effet tourne quand | [Deux règles, pas une](#deux-regles-pas-une) |
| comprendre pourquoi un effet ne se déclenche pas | [La coalescence](#la-coalescence) |
| écrire depuis une action de modèle | [`action`](#action) |
| connaître les pièges à l'exécution | [Ce qui surprend](#ce-qui-surprend) |

Le drainage lui-même — la file, la pile, l'ordre inverse — est expliqué dans
[`site/technique/regles-de-drainage.md`](../technique/regles-de-drainage.md). Cette fiche dit
quoi attendre, l'autre dit d'où ça vient.

## Un batch, c'est une parenthèse

`batch(fn)` ouvre une portée : les écritures s'accumulent à l'intérieur, et **rien ne se
propage** avant la fermeture. À la sortie, tout ce qui a changé réveille ses lecteurs, une fois,
dans l'ordre du drainage — qui est **synchrone** : à la fin de la ligne `batch(...)`, tout a
couru.

```ts
batch(() => {
  a.value = 1
  b.value = 2
})
// ici, les deux effets savent déjà a et b à jour
```

Trois conséquences normatives, figées par `SPEC.md` §9 :

- un `batch` **imbriqué** ne draine pas : seul le plus externe déclenche la propagation ; trois
  niveaux d'imbrication produisent un seul drainage ;
- une **exception** dans le corps remonte, mais draine quand même — l'état du graphe est
  restauré avant que l'erreur ne se propage ;
- un batch sans écriture ne draine pas.

## Deux règles, pas une

C'est le piège numéro un, et il est figé : `SPEC.md` §13.4 dit **deux règles distinctes**, et
les confondre produit une suite qui passe sur les graphes simples et échoue sur les graphes
réels.

| | Règle |
|---|---|
| Plusieurs effets sur le **même** signal | ordre de création |
| Plusieurs **écritures** de signaux distincts dans un batch | ordre inverse des écritures |

```text
deux effets sur le même signal :    b   c          l'ordre de création
deux écritures, dans un batch :     b ← c          les effets différés s'exécutent à l'envers
```

Entre deux drainages, la règle est la largeur : tout ce qu'une écriture a réveillé tourne,
avant que les effets de ces effets-là tournent.

## La coalescence

Écrire deux fois la même valeur dans un batch ne produit qu'**une** notification. Un effet
notifié deux fois ne tourne qu'une fois par drainage. Le cas `A → B → A` dans un batch est
traité par réconciliation de snapshots : les nœuds qui n'ont pas vu l'écriture intermédiaire
reprennent la valeur pré-batch sans tourner — mais dès qu'un computed a été **lu** pendant le
batch, cet avantage disparaît, et l'aval peut voir la valeur revertie.

Conséquence pratique : ne lisez pas un computed entre deux écritures du même batch si vous
comptez sur la coalescence.

## `action`

`action(fn)` enveloppe une fonction dans un batch. Son nom n'est pas gratuit : une méthode de
modèle qui écrit n'a pas à savoir qu'elle est dans un batch, donc elle s'enveloppe une fois, à
la construction, et chaque appel est batché.

```ts
const increment = action(() => {
  count.value += 1
  label.value = `étape ${count.value}`
})
increment()
```

C'est la forme pour les **mutations** : une action est synchrone, elle retourne la valeur de la
fonction, et elle est sûre à appeler depuis n'importe où. `createModel()` les produit tout seul
sur les méthodes own énumérables — le détail est dans le `README.md`.

> **Marqueur** — si vous savez regrouper et lire les deux règles, vous avez la fiche. La section
> suivante est pour le jour où un ordre vous surprend.

## Ce qui surprend

Une liste courte, et elle ne remplace pas les deux règles :

- **Un effet qui écrit sa propre dépendance** se ré-exécute dans le **même** drainage, pas au
  tour suivant. La portée de la garantie est celle du batch.
- **Écrire le même signal depuis plusieurs effets** ne casse rien, mais l'ordre des effets
  divergera si vous l'oubliez : relire [Deux règles, pas une](#deux-regles-pas-une).
- **Un `untracked()` à l'intérieur d'un batch** désactive la capture de capture du modèle
  englobant : un effet créé là n'appartient pas au `createModel()` qui le contient.
- **Un computed lu pendant un drainage** réévalue et intègre les écritures : un computed
  invalidé puis relu sans abonné n'est pas un computed désactivé.
- **Disposer un effet pendant le drainage** est licite : l'effet est sauté, sans callback.