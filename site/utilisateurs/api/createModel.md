# `createModel()`

Un constructeur de modèle : la fabrique rend un objet, `createModel()` l'enveloppe **en place**,
capture les effets nés pendant la construction, et pose le disposeur sous `Symbol.dispose`. C'est
le seul export qui a une logique propre — le reste est de la propagation.

| Vous voulez | Allez à |
| --- | --- |
| construire un modèle, et voir ce que la fabrique rend | [La construction](#la-construction) |
| passer des arguments à la fabrique, sans `this` | [La fabrique et ses arguments](#la-fabrique-et-ses-arguments) |
| protéger un signal ou un computé de l'enveloppement | [Le veto de la marque](#le-veto-de-la-marque) |
| savoir quelles clés entrent dans le domaine | [Les clés propres](#les-cles-propres) |
| lire un accesseur sans l'écraser | [Le descripteur](#le-descripteur) |
| retrouver une seule instance sous deux routes | [La mémoïsation](#la-memoisation) |
| faire tourner un modèle sans `Symbol.dispose` | [L'absence de `Symbol.dispose`](#l-absence-de-symbol-dispose) |
| reconnaître une méthode `async` à son double drainage | [L'avertissement asynchrone](#l-avertissement-asynchrone) |
| voir une fabrique qui ne rend pas un objet lever | [La garde d'entrée](#la-garde-d-entree) |
| savoir quels effets le modèle possède | [Les effets possédés](#les-effets-possedes) |
| disposer un modèle imbriqué | [Les modèles imbriqués](#les-modeles-imbriques) |
| faire le ménage, une fois, dans l'ordre | [Le dispose](#le-dispose) |
| garder deux instances indépendantes | [Deux instances](#deux-instances) |
| voir le cycle et les primitives | [Le cycle et les primitives](#le-cycle-et-les-primitives) |
| comprendre la portée de capture, le constructeur, l'enveloppement et le dispose | [`architecture.md`](../../technique/architecture.md) §11 à §14 |

Chaque bloc de code de cette page est un **marqueur** : sa forme est `ts scenarios/model/<nom>`
pour la surface, et `ts reconstitution/<nom>` pour les sept corrections de l'ADR 0005. Au moment
du build, le lecteur exécute le bloc nommé contre `signalcn`, et pose dans la page le code nettoyé
et le journal que l'exécution a produit : aucun bloc de cette page n'est écrit à la main, aucun
journal non plus.

## La construction

L'objet rendu par la fabrique **est** l'instance, muté en place — ni copie, ni proxy —,
`instanceof` est faux et `constructor` vaut `Object` ; la validation est **uniquement TypeScript**,
aucune propriété n'est contrôlée à l'exécution — `SPEC.md` §16.1 et §16.3.

```ts scenarios/model/shape-and-teardown
```

`avec new 1` et `sans new 1` : les deux appels passent. `l'objet de la fabrique est-il muté en
place true` dit la transparence, et les trois lignes suivantes la conséquence — `instanceof le
constructor false`, `constructor.name Object`, `instanceof Object true`. L'enveloppement descend
dans les fonctions imbriquées et les tableaux (`this conserve true`, `fonctions imbriquees
enveloppees true`, `descend dans un tableau true`), mais pas dans un signal (`ne descend pas dans
un signal Symbol(preact-signals)`). Une méthode de classe reste sur son prototype (`methode de
classe non enveloppee m`), une `Date` garde son identité, et l'objet `{ anything: 42 }` est
accepté : `aucune validation a l'execution function`.

## La fabrique et ses arguments

La fabrique reçoit les arguments de la construction et **pas** `this` — l'appel est un appel
simple, donc `this` vaut `undefined` en ESM — `SPEC.md` §16.1.

```ts scenarios/model/arguments-and-this
```

`arguments transmis [1,2]` : la fabrique a reçu les deux arguments tels quels. `this de la
fabrique undefined` : elle ne peut pas s'appuyer sur un `this` que le constructeur n'a pas posé.

## Le veto de la marque

Le test de descente compare la **valeur** de `brand`, pas son nom : un signal et un computé
portent le vrai symbole et traversent la fabrique **intacts**, tandis qu'un objet métier qui
porte une propriété `brand` est enveloppé au lieu d'être ignoré — `SPEC.md` §16.2 et §16.6.

```ts reconstitution/brand-value-skips-a-signal-in-a-model
```

`le signal traverse la fabrique true` : le signal rendu par la fabrique est **le même objet** que
la source, et le computé aussi. L'écriture de `7` passe par le modèle, et le computé suit jusqu'à
`8` : la descente n'a rien cassé. La ligne ne dit pas « lève » — ce garde ne lève pas, il laisse
passer. La moitié divergente, l'objet métier porteur de `brand`, n'est pas rejouable contre la
baseline : ce test fige la borne partagée, l'identité intacte, et la règle ci-dessus nomme la
correction.

## Les clés propres

Le domaine est le **propre énumérable** : une méthode de classe reste sur le prototype et n'est
pas enveloppée, une clé propre non énumérable reste hors du domaine, et une propriété héritée
énumérable n'est ni enveloppée ni recopiée — `SPEC.md` §16.2 et §16.6.

```ts reconstitution/only-own-enumerable-keys-are-wrapped
```

`méthode de classe intacte true` : `mk.met` est exactement `K.prototype.met`, l'identité est
conservée. Le reste du corps fixe les bornes : `cache`, propre mais non énumérable, reste la
fonction d'origine ; `visible`, propre et énumérable, est enveloppé ; `h`, héritée énumérable,
reste appelable et fait tourner l'état du modèle. La ligne ne lève pas : ce garde **retire du
domaine**, il ne rejette pas. La copie propre de l'héritée, qui est la moitié divergente de la
baseline, reste en prose — le test fige la borne partagée.

## Le descripteur

La descente lit le **descripteur** avant d'écrire : un accesseur est invoqué une fois à la
construction, reste un accesseur — jamais remplacé par une propriété de données —, et la descente
continue dans l'objet qu'il rend — `SPEC.md` §16.2 et §16.6.

```ts reconstitution/getter-is-read-not-written
```

`l'accesseur reste un accesseur true` : le descripteur du modèle porte toujours un `get`, sans
`set`. La descente a continué dans l'objet rendu — la fonction `inc` y a été enveloppée et garde
son `this` —, et le getter n'a pas été invoqué une seconde fois par l'écriture. La ligne ne lève
pas : l'accesseur n'est jamais écrit, et son descripteur reste celui d'un accesseur.

## La mémoïsation

Les enveloppes sont **mémoïsées** par fonction : deux clés qui mènent au même sous-arbre rendent
la **même** instance, donc `model.a === model.b`, et l'état ne se dédouble pas — `SPEC.md` §16.6.

```ts reconstitution/shared-subtree-identity
```

`deux routes, une instance true` : `m.A` et `m.B` sont le même objet, et cet objet est l'arbre de
la fabrique, muté en place. Le sous-arbre partagé est identique par les deux routes ; l'écriture
`inc(3)` passe par la première, et la feuille vaut `3` — aucun état ne se dédouble. La ligne ne
lève pas : elle observe l'identité que la mémoïsation produit.

## L'absence de `Symbol.dispose`

Quand `Symbol.dispose` manque au runtime, **aucune** clé n'est posée : la baseline écrivait une
propriété énumérable nommée `"undefined"`, et `using` devenait un no-op qui fuyait tous les
effets ; ici le modèle reste utilisable et le désarmement explicite reste possible — `SPEC.md`
§16.5 et §16.6.

```ts reconstitution/no-stray-key-on-the-model
```

`une clé undefined est posée false` : la question est posée à l'envers pour que le journal dise
l'absence. Le modèle ne porte que ses noms (`a`, `b`) et le seul symbole du disposeur ; aucune clé
`"undefined"` n'existe. La ligne ne lève pas — elle rend `false`, et c'est la vérité du garde. Le
cas divergent, le symbole **absent**, n'est pas rejouable dans un realm normal : il reste en
prose, et le test fige la borne observable, l'absence de nom parasite.

## L'avertissement asynchrone

Une fonction `async` enveloppée **avertit** : `action` ne batche que son préfixe synchrone, donc
la méthode observe **deux drainages** — un avant le premier `await`, un après —, sans que le
contrat synchrone change — `SPEC.md` §16.6.

```ts reconstitution/asynchronous-fn-drains-in-two-passes
```

`les deux passages e0 debut apres1 e1 retour e2 apres2` : l'effet a tourné à sa pose (`e0`), le
préfixe synchrone s'est vidé sur place (`apres1`, puis `e1`) avant que `go()` ne rende la main,
et la suite de l'attente a produit un second drainage (`e2`, puis `apres2`). Le test étouffe
`console.warn` : l'avertissement lui-même n'entre pas dans le journal ; la ligne montre ce qu'il
annonce, les deux passages.

## La garde d'entrée

Une fabrique qui ne rend **pas un objet** est rejetée par une `TypeError` **avant toute
mutation** : la garde nomme l'erreur au lieu de laisser l'écriture du disposeur échouer plus loin
sur une primitive, ou réussir silencieusement en mode sloppy — `SPEC.md` §16.6.

```ts reconstitution/null-factory-return-throws-on-first-use
```

`une fabrique qui ne renvoie pas un objet lève TypeError` : `null` et `42` sont refusés de la
même façon, et la ligne dit l'issue — c'est le seul des sept gardes dont le journal porte
réellement « lève ». Sa fonction est de nommer l'erreur au point d'entrée, avant qu'un modèle à
moitié construit ne soit rendu.

## Les effets possédés

Les effets créés pendant la construction sont **possédés** par le modèle et disposés par
`model[Symbol.dispose]()` ; un effet né dans un `untracked`, dans un getter, dans un computé
évalué plus tard ou dans un cleanup n'appartient à personne, et une fabrique qui lève **perd**
ses effets — `SPEC.md` §16.4.

```ts scenarios/model/effect-capture
```

`18 e:0`, `18 e:1`, puis `18 apres dispose vu` : l'effet du modèle tourne à sa pose, réagit à
l'écriture, et se tait après le dispose. `21 batch : effets possedes dispose fait` : un effet né
dans un `batch` est possédé. Les cas négatifs se lisent à leur journal : l'effet d'un getter
survit (`13 effet d'un getter`, quatre entrées pour deux appels), celui d'une fabrique qui lève
continue (`16 effet perdu…`), le parent ne récupère rien d'un enfant qui lève (`17…`), l'effet
d'un computé reste vivant (`22…`), et celui d'un cleanup n'est jamais possédé (`23…`).

## Les modèles imbriqués

Les effets d'un modèle imbriqué remontent au parent — la fermeture de la portée concatène les
deux listes —, donc le dispose du parent emporte les cleanups internes **et** externes ; un
enfant créé sous `untracked` ouvre une portée neuve que le parent ne possède pas — `SPEC.md`
§16.4.

```ts scenarios/model/nested-models
```

Les deux effets tournent à la pose (`externe 0`, `imbrique 0`) et sur l'écriture (`externe 1`,
`imbrique 1`). Le dispose du parent, lui, ne rend plus rien : `apres dispose du parent vu` arrive
sans nouveau run. La seconde moitié est l'exception : `parent 0` et `enfant 0` tournent, puis le
dispose du parent laisse `enfant 2` vivre — l'enfant né sous `untracked` n'a jamais été possédé.

## Le dispose

`model[Symbol.dispose]` est une `action` : il groupe les disposes, et les cleanups sortent dans
l'ordre, un par un ; il est idempotent, non énumérable, et **écrase** silencieusement un
`Symbol.dispose` fourni par l'utilisateur — `SPEC.md` §16.5.

```ts scenarios/model/dispose
```

`run 0`, `cleanup 1`, `run 1` : le cleanup du re-run précède le corps suivant, et `cleanup 1`
voit la valeur écrite. Après `avant dispose vu`, le cleanup arrive, puis `apres dispose vu` — le
modèle est bien arrêté. `dispose deux fois vu` ne rejoue rien. Les trois défauts figés restent
visibles : un cleanup qui lève interrompt les suivants (`un cleanup qui leve interrompt les
suivants ["cleanup1","cleanup2 throws","err: Error"]`), un `Symbol.dispose` utilisateur est
écrasé (`[]`), et le disposeur n'est pas énumérable. `utilisable avec using ["body","cleanup"]`
ferme la forme.

## Deux instances

Chaque construction ouvre sa propre portée : deux instances ne partagent aucun effet, même quand
elles lisent le **même** signal, et disposer de l'une ne touche pas l'autre ; un abonnement créé
dans la fabrique reste possédé — `SPEC.md` §16.4.

```ts scenarios/model/two-instances
```

`e1 1` et `e2 2` : chaque modèle a son effet, et les écritures croisées ne les mélangent pas
(`apres ecritures croisees vu`). Disposer `a` laisse `b` vivant, et réciproquement pour `c` et
`d`. La dernière ligne est le cas interne : `un abonnement interne reste possede ["run 00","sub
0","run 01","sub 0","sub 1"]` — le dispose du modèle a désabonné l'effet créé dans la fabrique,
alors que la source externe continuait de changer.

## Le cycle et les primitives

Un objet **cyclique** produit un `RangeError` après une mutation **partielle** — défaut figé —,
une fabrique qui rend une primitive ou `null` lève `TypeError` — la garde du §16.6 —, et un
getter n'est évalué qu'une fois à la construction — `SPEC.md` §16.2, §16.5 et §16.6.

```ts scenarios/model/cyclic-getter-and-primitives
```

`evaluations du getter 1` : la descente a invoqué le getter une seule fois ; `la valeur stockee
est un signal true` : ce qu'il rend est un signal. La correction du [descripteur](#le-descripteur)
laisse ensuite l'accesseur en place, donc une lecture ultérieure l'invoque de nouveau. `objet
cyclique RangeError / mutation commencee : true` : le cycle est reproduit, pas corrigé, et la
mutation avait commencé. `fabrique primitive, avec new TypeError` et `fabrique null TypeError` :
la garde d'entrée répond avant toute mutation.

Le mécanisme — la portée de capture, l'ordre du constructeur, l'enveloppement et le dispose —
est dans [`architecture.md`](../../technique/architecture.md) §11 à §14 ; cette page montre la
surface, elle n'établit rien.
