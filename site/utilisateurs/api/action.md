# `action()`

Une fonction qui regroupe ses écritures et détache son corps du suivi courant : à chaque appel,
les mutations attendent la sortie de la portée, et les lectures ne s'inscrivent nulle part. C'est
la forme d'une mutation — celle que `createModel()` pose sur chaque fonction own énumérable d'un
modèle.

| Vous voulez | Allez à |
| --- | --- |
| regrouper des écritures sans drainer, et lire hors du suivi | [L'emballage](#l-emballage) |
| transmettre `this`, les arguments et la valeur rendue | [La forme de l'appel](#la-forme-de-l-appel) |
| écrire depuis un effet, et savoir quand le drainage sort | [L'écriture depuis un effet](#l-ecriture-depuis-un-effet) |

Chaque bloc de code de cette page est un **marqueur de la table** — sa forme est
`ts scenarios/<groupe>/<nom>`. Au moment du build, le lecteur exécute ce bloc contre
`signalcn`, et pose dans la page le code nettoyé et le journal que l'exécution a produit :
aucun bloc de cette page n'est écrit à la main, aucun journal non plus.

## L'emballage

`action` compose les deux primitives : l'appel ouvre un `batch` — « `batch(fn)` regroupe les
mutations et diffère la propagation observable jusqu'au drainage, qui est **synchrone** » —
`SPEC.md` §9 —, et il exécute `fn` sous `untracked` — « `untracked(fn)` exécute une lecture sans
ajouter les signaux consultés aux dépendances du contexte réactif extérieur » — `SPEC.md` §10.
La portée la plus externe est celle qui draine — « seul le batch le plus externe draine »,
`SPEC.md` §9.1 — : l'action ne draine pas après chaque écriture, et une action appelée depuis un
effet ne l'abonne pas.

```ts scenarios/action/batch-around-untracked
```

Le premier témoin est le sujet de la page : `deux ecritures, un seul flush` rend
`["e:0","e:2"]`. L'effet a tourné à sa pose (`e:0`), les deux écritures de l'action n'ont produit
qu'un seul drainage, et il voit la **dernière** valeur (`e:2`). Les actions imbriquées ne coûtent
pas un drainage de plus — `actions imbriquees, un seul flush` rend le même journal —, et l'erreur
du corps traverse sans annuler le drainage : sous `l'erreur traverse, le flush a lieu`, le journal
est `["e:0","e:1","caught:Error"]` — `e:1` est déjà là quand `caught:Error` arrive, `SPEC.md`
§9.2.

La valeur et les arguments traversent : `valeur de retour ret`, `arguments 3`, et une promesse
n'est pas attendue — `une promesse traverse object`, le `typeof` d'une promesse. La cinquième
ligne est la moitié `untracked` : `runs de l'effet appelant 1 puis 1`. L'effet appelle une action
qui lit `source` ; si l'action ne détachait pas cette lecture, l'effet s'abonnerait à `source` et
l'écriture de `1` le relancerait. Il reste à un run : la lecture est passée hors du suivi.

## La forme de l'appel

`action` rend une fonction ordinaire, de signature `(...args: TArgs) => TReturn` — `SPEC.md` §4 :
elle n'est ni un signal, ni un objet du modèle. `this` est préservé lors de l'appel — `SPEC.md`
§16.2 le dit pour les méthodes enveloppées d'un modèle, et c'est le même wrapper — ; détachée, la
fonction ne voit que le `this` du module, `undefined` en ESM.

```ts scenarios/action/this-and-arguments
```

`appel membre, this preserve 5` : l'appel `objet.run()` voit `objet` et rend `n`.
`appel detache, this ESM undefined` : la même fonction, sortie de son objet, ne trouve plus rien —
la règle du module, pas une propriété de l'action. `marque presente false` et
`prototype de Function true` ferment la forme : pas de `brand`, et le prototype de `Function` —
une action n'est pas un signal.

Le nom du wrapper, `actionWrapper`, et sa `length` à zéro sont figés par la matrice de
conformité ; `--keep-names` les conserve à la minification — `SPEC.md` §17.2. La table ne peut pas
les montrer : le paquet publié minifie ses noms de fonctions, et une assertion sur `f.name`
échouerait contre la baseline.

## L'écriture depuis un effet

Une action appelée depuis un effet n'ouvre pas un drainage à elle : son `batch` s'imbrique dans
celui du run, et « seul le batch le plus externe draine » — `SPEC.md` §9.1. L'écriture de
l'action attend donc la fin du run de l'effet appelant ; l'ordre de ce drainage est normatif,
`SPEC.md` §13.4.

```ts scenarios/action/write-from-an-effect
```

`journal ["d1:0","d2:0","d1:1","d2:9"]` : les deux effets ont tourné à leur pose (`d1:0`,
`d2:0`). L'écriture du déclencheur réveille `d1`, qui écrit `cible` dans une action ; `d2` ne voit
la valeur qu'**après** la fin de `d1` — `d1:1` puis `d2:9`, jamais `d2:9` pendant le run de `d1`.
Le batch de l'action s'est imbriqué dans celui du drainage, et n'a rien drainé de lui-même.

Ce qui n'est **pas** dans cette page appartient à
[`architecture.md`](../../technique/architecture.md) §5, §8 et §11 : l'ouverture du batch et la
pile de drainage, le tracking et son emplacement unique, et la portée de capture qu'`untracked`
neutralise. La surface est ici, la structure est là.

> **Marqueur** — si vous savez emballer des écritures, les appeler depuis un effet, et passer
> `this`, les arguments et la valeur, vous avez la page. Ce qui suit est un renvoi, pas un coût.

## Et après ?

`createModel()` enveloppe chaque fonction **own énumérable** de la fabrique en `action`,
récursivement — `SPEC.md` §16.2 —, et son disposeur est lui aussi une action, qui batche les
disposes — `SPEC.md` §16.5. Un effet créé dans une `action()` englobante n'appartient pas au
modèle — `SPEC.md` §16.4. Côté usage, [`batch-et-surprises.md`](../batch-et-surprises.md) tient
la fiche du même sujet : batchs, cascades, `action`, et les surprises à l'exécution.
