# `batch()`

Un regroupement d'écritures : la propagation attend la fermeture de la portée, puis part d'un
coup — **synchrone**, donc tout a couru avant la ligne suivante. C'est la parenthèse du moteur :
dedans rien ne bouge, à la sortie le graphe rattrape son retard.

| Vous voulez | Allez à |
| --- | --- |
| regrouper des écritures, et lire ce que le corps rend | [La parenthèse](#la-parenthese) |
| imbriquer trois niveaux, sans multiplier les drainages | [Les imbrications](#les-imbrications) |
| voir ce qui sort quand le corps lève | [Les erreurs](#les-erreurs) |
| comprendre pourquoi un effet ne tourne qu'une fois | [La coalescence](#la-coalescence) |
| écrire `A → B → A` et épargner l'aval | [Le retour en arrière](#le-retour-en-arriere) |
| lire un computé entre deux écritures | [La lecture pendant le batch](#la-lecture-pendant-le-batch) |
| savoir ce qui compte comme un retour au même | [Le seuil du retour](#le-seuil-du-retour) |

Chaque bloc de code de cette page est un **marqueur de la table** — sa forme est
`ts scenarios/<groupe>/<nom>`. Au moment du build, le lecteur exécute ce bloc contre
`signalcn`, et pose dans la page le code nettoyé et le journal que l'exécution a produit :
aucun bloc de cette page n'est écrit à la main, aucun journal non plus.

## La parenthèse

`batch(fn)` « regroupe les mutations et diffère la propagation observable jusqu'au drainage, qui
est **synchrone** » — `SPEC.md` §9. Le corps rend une valeur, et le batch la rend telle quelle :
la **même référence** pour un objet, et celle du plus interne quand les batchs s'imbriquent —
`SPEC.md` §9.1, dont le §9.4 fait un cas obligatoire.

```ts scenarios/batch/value-and-nesting
```

Le journal se lit en trois temps. Avant le batch, `["e:0"]` : l'effet a déjà tourné, son premier
run est synchrone à sa pose. Pendant, seuls `A`, `B` et `C` s'ajoutent — les deux écritures de
`a` n'ont réveillé personne. Après, `e:2` paraît **une fois** : les deux écritures n'ont coûté
qu'un seul run, et l'effet voit la **dernière** valeur. Les trois premières lignes portent le
retour : `ret` tel quel, l'objet **par identité** (`oui`), puis `inner` remonté d'un niveau.
`hors` et `2` referment — `batch()` rend ce que le corps rend, et la valeur finale est la
dernière écrite.

## Les imbrications

Un batch ouvert dans un batch « n'incrémente pas la profondeur : il se comporte comme un simple
appel de `fn` », et « seul le batch le plus externe draine » — `SPEC.md` §9.1, qui ajoute que
trois niveaux d'imbrication produisent **un seul** drainage. Ce drainage suit `SPEC.md` §13.4,
**normatif** : la file des effets différés est une pile — l'ordre des **écritures** s'inverse, et
plusieurs effets sur le **même** signal sortent dans l'ordre de leur **création**.

```ts scenarios/batch/three-levels-and-order
```

`niveau3` seul écrit ; les deux niveaux autour se comportent en simples appels — et un unique
drainage a suivi. À la sortie, `C:1` passe **avant** `A:1` et `B:1` : `b` a été écrite en
second, donc ses lecteurs passent les premiers — l'inverse des écritures. Et sur `a`, `A:1`
précède `B:1` : les deux effets gardent leur ordre de création. Les trois `d1()`–`d3()` de la
fin ne journalisent rien : ils désabonnent, c'est le ménage du scénario.

## Les erreurs

`batch` « fait remonter l'erreur de son corps **mais draine quand même** », et la profondeur est
restaurée, même après une exception — `SPEC.md` §9.2.

```ts scenarios/batch/body-error-and-depth
```

L'erreur **ressort** de l'appel — c'est `boom` —, et pourtant `e:1` est dans le journal : le
drainage a eu lieu avant que l'erreur ne parte. La ligne suivante est le témoin de la
restauration : `a.value = 2`, écrit hors batch, draine à son tour (`e:2`). Sans cette
restauration, plus rien ne drainerait jamais.

Un batch imbriqué ne se rattrape pas lui-même : « une exception dans un batch imbriqué **ne**
passe pas par un `finally` local — elle remonte au batch externe, qui draine puis re-throw » —
toujours `SPEC.md` §9.1. Rattrapée à l'intérieur du corps, elle est donc vue par **un seul**
drainage, celui du plus externe.

```ts scenarios/batch/caught-inner-error
```

`caught inner`, `after`, `end`, puis `e:2` : l'erreur interne a été rattrapée **dans** le batch
externe, aucune propagation n'a fui au milieu, et le drainage unique a vu la valeur finale —
l'écriture de `2` tient. La seconde moitié rejoue le cas depuis l'extérieur : `out` sort de
`batch()`, et `f:1` était déjà dans le journal — la levée n'annule pas le drainage, c'est §9.2.

## La coalescence

Écrire plusieurs fois la même valeur dans un batch « ne produit qu'une notification », et un
effet notifié deux fois « ne tourne qu'une fois par drainage » — `SPEC.md` §9.3. Un batch **sans
écriture**, lui, ne draine pas — `SPEC.md` §9.1.

```ts scenarios/batch/identical-write
```

`["e:0","e:1"]` : trois écritures identiques, **une** notification, et l'effet a tourné une
fois. La seconde ligne est le témoin négatif — un batch qui ne fait que **lire** `a.value` ne
draine pas, le journal ne bouge pas. Et hors batch, la réécriture identique ne notifie toujours
pas : il faut une valeur **vraie** pour un troisième run (`e:2`), le seuil du setter étant celui
de `SPEC.md` §5.2.

## Le retour en arrière

Écrire `A → B → A` dans un batch « n'oblige pas les aval à se recalculer : les nœuds qui ont vu
la version pré-batch sont advanced d'un cran » — c'est le fast-forward de `SPEC.md` §13.5, que le
§9.3 range sous la coalescence.

```ts scenarios/batch/revert-a-b-a
```

`1 → 2 → 0` sur `a` : `cCalls:1 eRuns:1` avant, **les mêmes** comptes après — ni le computé ni
l'effet n'ont bougé, aucun n'ayant vu la version intermédiaire. La seconde ligne est le
contrepoids : `a` revient bien à `0`, mais `b` passe à `10`, un changement **réel**, donc
`cCalls:2 eRuns:2` — et la valeur rendue est `10`. La dernière ligne sépare les deux temps : un
effet créé **dans** le corps tourne aussitôt (`vu:1`) — le batch diffère la propagation, pas
l'exécution.

## La lecture pendant le batch

Le fast-forward « ne s'applique qu'aux nœuds ayant vu la version pré-batch » : « une lecture
paresseuse pendant le batch suffit à faire perdre cet avantage » — `SPEC.md` §13.5. Le nœud qui
a lu la version intermédiaire l'a consommée ; l'effet tourne alors une seconde fois, **avec la
valeur revertie**.

```ts scenarios/batch/revert-with-lazy-read
```

`mid:10` est la lecture du milieu : le computé a consommé la version intermédiaire, et c'est ce
qui lui coûte le fast-forward. L'effet, lui, finit sur `e:0` — le drainage le rappelle, et il
relit la valeur revertie. `cCalls 3` compte les évaluations, `fin end:0` referme, et l'écriture
suivante repart à `4` : le nœud n'est pas resté figé sur le retour.

Le geste inverse — écrire, puis **relire** son computé dans le corps — ne dispense pas du
réveil : la file de drainage ne s'épuise pas dans une lecture, donc l'effet tourne quand même à
la sortie, seul un batch **sans écriture** ne drainant pas — `SPEC.md` §9.1. Les cas obligatoires
du §9.4 nomment les deux côtés, « lecture après écriture à l'intérieur d'un batch » et « computed
lu pendant le batch ».

```ts scenarios/batch/reread-wakes-despite-read
```

`pendant le batch A:T` : la relecture voit la nouvelle valeur, et `["e:A:a","e:A:T"]` la réveille
à la sortie — une relecture **après** le batch ne change plus rien. Autour d'un `untracked`, le
verdict est le même — `["e:B:b","e:B:T"]` : neutraliser le suivi n'éteint pas le
rafraîchissement. Et le témoin négatif ferme le sujet : sans écriture, `["e:C:c"]`, rien ne
bouge.

## Le seuil du retour

`SPEC.md` §9.3 confie le retour `A → B → A` à la réconciliation de snapshots de `§13.5` ; elle
compare des **valeurs**, à l'identité stricte de `§5.2` et non à `Object.is` : `NaN` n'est
**jamais** considéré comme revenu au même, et un signal passé de `-0` à `0` l'est **toujours**.

```ts scenarios/batch/strict-snapshot-identity
```

`laisses a NaN : runs 2` : l'effet a tourné à sa pose, puis au drainage — `NaN === NaN` est
faux, la source n'est jamais revenue. `reparti de -0 : runs 1` : le signal est **construit** à
`-0` (écrire `-0` sur `0` serait ignoré), le batch le mène à `1` puis `0`, et `0 === -0` est
vrai — la valeur est revenue, le fast-forward s'applique, l'effet ne tourne pas.

Ce qui n'est **pas** dans cette page appartient à
[`architecture.md`](../../technique/architecture.md) §5 : les trois variables de module —
`batchDepth`, `batchIteration`, `batchedEffect` —, la liste chaînée qui **est** la pile de
drainage, et le drainage fait en **détachant** ; le §6 porte les snapshots et le fast-forward. La
surface est ici, la structure est là.

> **Marqueur** — si vous savez grouper des écritures, les imbriquer, et faire sortir une erreur
> sans perdre le drainage, vous avez la page. Ce qui suit est un renvoi, pas un coût.

## Et après ?

`untracked()` lit sans enregistrer de dépendance — `SPEC.md` §10. `createModel()` enveloppe
chaque méthode own énumérable de la fabrique en `action` — `SPEC.md` §16.2 —, et un effet créé
pendant la construction appartient au modèle — `SPEC.md` §16.4. Côté usage,
[`batch-et-surprises.md`](../batch-et-surprises.md) tient la fiche du même sujet, et
[`regles-de-drainage.md`](../../technique/regles-de-drainage.md) explique la pile.
