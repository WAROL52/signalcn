# Premier effet

Le premier programme qui marche : un signal, un computed, un effect, et ce qu'il faut pour que
chacun s'arrête.

| Vous voulez | Allez à |
| --- | --- |
| voir le programme qui marche | [Les quatre gestes](#les-quatre-gestes) |
| savoir pourquoi une lecture devient une dépendance | [Une lecture est une promesse](#une-lecture-est-une-promesse) |
| lire sans être suivi | [Lire sans dépendre](#lire-sans-dependre) |
| regrouper des écritures | [Regrouper](#regrouper) |
| tout arrêter | [S'arrêter](#s-arreter) |

La liste des exports et les options de chaque fonction sont dans le [`README.md`](/README.md).
Cette fiche n'en recopie que les gestes.

## Les quatre gestes

```ts
const count = signal(0)

const doubled = computed(() => count.value * 2)

const dispose = effect(() => {
  console.log("count:", count.value)
  console.log("doubled:", doubled.value)
})

count.value = 1
dispose()
```

Quatre gestes, et c'est tout le moteur : créer une valeur (`signal`), dériver une valeur
(`computed`), réagir à une valeur (`effect`), et s'arrêter (`dispose()`).

Un `effect` tourne **immédiatement**, une fois, et retourne son propre destructeur. Il ne rend
rien d'autre : la valeur observée, c'est ce qu'il imprime.

## Une lecture est une promesse

Un `effect` qui lit `count.value` le relit à chaque écriture — pas parce qu'il est *abonné* dans
un sens abstrait, mais parce que la lecture elle-même enregistre la dépendance. Rien ne se
déclare : toute lecture de `.value` qui se produit pendant que l'effet tourne devient ce que
l'effet suit.

La conséquence surprend une fois :

```ts
effect(() => {
  if (count.value > 3) console.log(debug.value)
})
```

Tant que `count.value` vaut 0, `debug` n'est **pas** une dépendance — l'effet ne l'a jamais lu.
Dès que `count` passe au-dessus de 3, `debug` entre dans le suivi, et l'effet le suit désormais.
Le suivi s'adapte à ce qui s'est réellement passé, pas à ce qu'on imagine qu'il se passe.

## Lire sans dépendre

`untracked()` exécute une lecture sans l'enregistrer :

```ts
effect(() => {
  console.log(user.value, untracked(() => level.value))
})
```

L'effet dépend de `user`, pas de `level`. Le cas d'usage honnête : lire un paramètre de
configuration qu'on veut courant sans vouloir relancer le calcul sur chaque changement de lui.

`untracked` n'empêche pas d'écrire, et ne désactive pas le rafraîchissement d'un `computed` lu.
Il enlève une lecture de la liste, c'est tout.

## Regrouper

`batch()` regroupe des écritures et **diffère tout effet** jusqu'à la sortie :

```ts
batch(() => {
  count.value = 1
  count.value = 2
})
```

L'effet ne tourne pas entre les deux écritures : il tourne une fois, à la sortie, sur la
dernière valeur. Écrire la même valeur deux fois ne notifie qu'une fois — la coalescence,
fite par `SPEC.md` §9.3.

Un `batch` imbriqué ne draine rien de plus : seul le batch le plus externe déclenche la
propagation. La surprise — d'un ordre, d'une portée, d'un computed lu trop tôt — mord à
l'exécution, pas à la lecture. C'est le sujet de
[Le batch et ses surprises](./batch-et-surprises.md).

> **Marqueur** — si vous écrivez, lisez et disposez, vous n'avez plus rien à apprendre ici. Les
> sections suivantes expliquent pourquoi le suivi marche, et elles sont pour le jour où ça vous
> surprend.

## S'arrêter

`dispose()` démonte un `effect`, et c'est tout ce qu'il faut pour couper chaque chaîne qui
remonte à lui. Un `effect` disposé ne tourne plus, même si ses sources sont écrites.

`subscribe()` existe aussi sur un signal : il appelle le callback tout de suite, à l'abonnement,
rejoue chaque changement, et retourne un destructeur qui se désamorce de la même façon. C'est la
forme pour écouter une valeur sans gérer un cycle entier d'effet.

Et le cleanup quand une source change : le corps d'un `effect` peut **retourner** une fonction
de nettoyage, appelée avant la ré-exécution suivante — ou à la dispose. Le sujet, avec les
écarts assumés, est dans `SPEC.md` §12.

## Et pour les objets ?

`createModel()` fait pour un objet métier ce que `signal` fait pour une valeur : chaque champ
devient un signal, et chaque méthode un `action`. Cette fiche s'arrête là — c'est le seul export
dont la forme vaut une lecture séparée, et le `README.md` la couvre.