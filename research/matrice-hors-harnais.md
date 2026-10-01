# Les 32 entrées de matrice que le harnais ne rejoue pas

Ce que la matrice publie pour 32 de ses 221 entrées, et **où** cette observation est vérifiable.

Point de départ du ticket `#33` : le paquet publié minifie ses propres propriétés.
`Object.keys(signal(1))` rend `["v","i","n","t","l","W","Z","name"]`, `signal(1)._version` vaut
`undefined`, et `"_flags" in signal(1)` vaut `false`. La matrice, elle, cite des noms lisibles et des
numéros de ligne du **code source** du paquet.

Ce document ne corrige rien : ni la matrice, ni `registry/default/signals.test.ts`, ni le moteur. Il
établit, entrée par entrée, si l'observation tient sur l'**artefact** — le paquet installé, ce que le
projet compare et ce qu'un utilisateur installe — ou si elle ne peut rien y porter. La décision sur la
forme de la matrice reste celle du ticket.

## Méthode

Une seule règle d'exécution, et elle est celle du harnais : **on exécute, on ne déduit pas.** Un test
qui atteint un observable est rouge s'il lève sur le paquet, vert s'il y passe.

1. **Les deux cibles, dans un seul processus.** `import * as art from "@preact/signals-core"` charge le
   paquet installé. Les sources non minifiées, `node_modules/@preact/signals-core/src/index.ts`
   (1138 lignes), sont transpilées dans `scripts/` avant import : `node_modules` refuse le
   type-stripping de Node. Chaque sonde est écrite une fois et jouée **sur les deux**, dans la même
   exécution, pour que la comparaison vienne de la machine et non d'une lecture.
2. **Les 32 entrées ne sont pas tapées à la main.** `COUVERTURE` est importé depuis
   `registry/default/signals.test.ts`, filtré sur les destinations contenant `signalcn-seul`. Le
   registre rend **32**, dont 9 que couvre aussi un scénario de la table. Le compte du ticket est
   confirmé par le fichier, pas par un recomptage.
3. **L'observable est la colonne « Observé »** de `research/baseline-1.14.4.md`, pas la colonne
   « Localisation `src/index.ts` ». La seconde est une citation de ligne source pour les 221 entrées
   : elle ne distingue rien et n'a pas servi de critère.
4. **Règle de verdict, appliquée uniformément :**
   - `artefact` — tout ce que la matrice publie comme observé pour cette entrée se vérifie sur le
     paquet installé tel quel, sans nom lisible et sans ligne source.
   - `source-seulement` — l'observable est nommé par un identifiant que le paquet minifie, ou par une
     ligne source : il ne peut rien porter sur le paquet installé.
   - `ambigu` — la matrice y mêle les deux, et le choix de la trancher n'appartient pas à ce document.

Toutes les sondes vivaient dans `scripts/` et ont été supprimées. `git status` ne porte que ce fichier.

### Le fait brut qui fonde les verdicts

Les 23 noms lisibles que la matrice cite ont été cherchés sur l'artefact, dans `Object.keys` d'un
signal, d'un computé, d'une instance d'effet, et dans `getOwnPropertyNames` de leurs prototypes :

```
_value _version _node _targets _batchSnapshotVersion _watched _unwatched _fn
_sources _globalVersion _flags _cleanup _nextBatchedEffect _callback _start
_notify _dispose _refresh _subscribe _unsubscribe _target _source _next
```

**Les 23 sont absents.** Aucun nom lisible ne subsiste sur l'artefact, à part ceux de l'API publique
(`value`, `peek`, `toString`, `toJSON`, `valueOf`, `brand`, `subscribe`, `dispose`, `name`).

Ce qui subsiste, en revanche, ce sont les **comptes, l'ordre et les valeurs**, tous préservés :

| Cible | Sources | Artefact installé |
|---|---|---|
| `Object.keys(signal(1))` | `_value _version _node _targets _batchSnapshotVersion _watched _unwatched name` | `v i n t l W Z name` |
| `Object.keys(computed(…))` | les 8 ci-dessus + `_fn _sources _globalVersion _flags` | les 8 ci-dessus + `x s g f` |
| `Object.keys(new Effect(…))` | `_fn _cleanup _sources _nextBatchedEffect _flags name` | `x m s u f name` |
| `for..in` sur un computé | 22 clés | 22 clés |

Le manglage est **positionnel** : la huitième clé s'appelle `name` des deux côtés, la sixième clé d'un
effet aussi. Cinq contrôles de valeur, indépendants de la position, le confirment sur l'artefact
installé : `_version 0 → i 0`, `_batchSnapshotVersion 0 → l 0`, `_globalVersion −1 → g −1`,
`_flags 4 → f 4`, `_flags 32 → f 32`.

C'est un **constat**, pas un contrat : rien dans le paquet ne publie cette correspondance, et le
mangler peut la changer d'une version à l'autre. Elle permet de *lire* l'artefact, pas d'écrire une
attende que l'artefact porterait.

## Les 32 entrées

`Scénario` est la destination de la table dans `COUVERTURE`, vide quand l'entrée n'est couverte que
par un test `signalcn-seul`. L'observable est celui de la matrice, suivi de ce que le paquet installé
a répondu.

| Entrée | Scénario | Observable publié, puis mesure sur l'artefact installé | Verdict |
|---|---|---|---|
| `signal#3` | — | `Object.keys(signal(1))` = `["_value","_version","_node","_targets","_batchSnapshotVersion","_watched","_unwatched","name"]`. Huit clés et le même ordre, mais `["v","i","n","t","l","W","Z","name"]` : **la liste citée est fausse** sur l'artefact. | `source-seulement` |
| `signal#4` | — | `"_flags" in signal(1) === false`, `signal(1)._flags === undefined`. Les deux expressions **tiennent** sur l'artefact — et y sont **vacuës** : `"_flags"` n'y existe nulle part, donc `false` est aussi la réponse pour `nimporte quoi`. Elles ne distinguent pas « un Signal n'a pas de drapeaux » de « le nom est minifié ». | `ambigu` |
| `signal#6` | `signal/egalite-stricte-nan` | `s = NaN` → effet re-exécuté **2 fois**, `_version === 1`. Mesuré : 2 runs sur l'artefact ✓ ; `_version` minifié ✗. | `ambigu` |
| `signal#7` | `signal/zero-et-negative-zero` | 1 run, `_version === 0`, `Object.is(value,-0) === false`. Mesuré : 1 run ✓ et `Object.is(...) === false` ✓ ; `_version` ✗. | `ambigu` |
| `signal#8` | `signal/zero-et-negative-zero` | 1 run, `_version === 0`, `Object.is(value,-0) === true`. Mesuré : 1 run ✓ et `Object.is(...) === true` ✓ ; `_version` ✗. | `ambigu` |
| `signal#15` | `signal/peek` | Descripteur de `Signal.prototype.peek` = `{writable:true, enumerable:true, configurable:true}`. Mesuré sur l'artefact : `{w:true, e:true, c:true}`, à l'identique. `peek` est un nom public, il n'est pas minifié. | `artefact` |
| `signal#21` | — | Signal gelé → `TypeError`, « le nom de propriété dans le message dépend du build : `_value` en source, `v` dans le bundle ». Mesuré sur l'artefact : `TypeError: Cannot assign to read only property 'v' of object '[object Object]'`. La matrice prévoit elle-même les deux noms. | `artefact` |
| `conv#10` | — | `toString` / `valueOf` / `toJSON` / `peek` de prototype, descripteurs `{w:true, e:true, c:true}`. Mesuré : les quatre à l'identique sur l'artefact. (signalcn y diverge par ADR-0004 : `enumerable: false`.) | `artefact` |
| `conv#12` | — | `brand` descripteur `{w:true, e:true, c:true}`, `s.brand = "x"` fonctionne et crée une prop d'instance. Mesuré : descripteur à l'identique, `s.brand === "x"`, clé own créée. | `artefact` |
| `computed#10` | — | `a*10+b` : la 1ʳᵉ dépendance change suffit. Mesuré : `c.value === 12`, puis `a.value = 10` → `102`. Le **comportement** tient. Mais la destination (`signalcn-seul/ordre-des-sources`) vérifie autre chose : le **sens de parcours** de `_sources` / `_next` / `_source`, trois noms minifiés, et le test déclare que signalcn inverse la liste de la baseline. | `ambigu` |
| `computed#19` | — | `Object.getPrototypeOf(c1) === Object.getPrototypeOf(c2)`, prototype `instanceof Signal`. Mesuré sur l'artefact : `true` et `true`, sans un seul nom lisible. (signalcn diverge : prototype sans état, `constructor === Computed` — SPEC §21.) | `artefact` |
| `computed#20` | — | `Object.keys(computed)` = 12 clés, liste nominative. Mesuré : 12 clés et le même ordre, sous d'autres noms. | `source-seulement` |
| `computed#21` | — | `for..in` = 22 clés = 12 + 10, liste nominative. Mesuré : 22 exactement ; mais 4 des 10 noms de prototype sont minifiés (`h`, `S`, `U`, `N`). | `source-seulement` |
| `computed#22` | — | `TypeError: this._fn is not a function` ; 12 → 15 clés, `_flags === 16`, `_version === 1`. Mesuré : la **forme** tient sur l'artefact — une `TypeError`, +3 clés sur le prototype, les computeds réels survivent — mais le texte est `this.x is not a function` et les deux champs cités n'existent pas. | `ambigu` |
| `effect#34` | — | Effet créé dans un computé : 3 évaluations, 6 runs d'effets. Mesuré sur l'artefact : `outer` ×3, `inner` ×6, journal vide avant la première lecture. API publique uniquement. | `artefact` |
| `effect#36` | — | `e.name === "n"` ; `Object.keys(e)` = `["_fn","_cleanup","_sources","_nextBatchedEffect","_flags","name"]`. Mesuré : `name` est public et tient (`"n"`, mutable, `"name" in e`) ; la liste des six clés est `["x","m","s","u","f","name"]`. | `ambigu` |
| `effect#37` | — | `new Effect(fn)._flags === 32` ; `computed(fn)._flags === 4`, `_globalVersion === -1`. Mesuré dans un process neuf : les **valeurs** tiennent à l'identique sur l'artefact (`f = 32`, `f = 4`, `g = −1`) ; les trois noms n'existent pas. | `ambigu` |
| `effect#39` | — | `Object.keys(Effect.prototype)` = `["_callback","_start","_notify","_dispose","dispose"]`. Mesuré : 5 clés énumérables, même ordre, `["c","S","N","d","dispose"]`. | `source-seulement` |
| `effect#40` | — | `Error: Out-of-order effect`, **atteignable seulement via `_start`**, inatteignable par l'API publique. Mesuré : le message (un littéral, donc non minifiable) se reproduit sur l'artefact, et l'API publique n'y donne pas accès non plus ; mais la voie `_start` y porte un autre nom. | `ambigu` |
| `effect#41` | — | `using d` → `["run","body","cleanup"]`. L'observable est **pleinement adressable** — API publique, `Symbol.dispose` n'étant pas minifié — et le paquet installé la **refuse** : `TypeError: Symbol(Symbol.dispose) is not a function`, journal arrêté à `["run"]`. | `ambigu` |
| `modele#2` | `modele/forme-et-enveloppement` | `inst === shared` ; `shared.inc.name` passe de `"inc"` à `"actionWrapper"`. Mesuré : `inst === shared` tient sur l'artefact ; le nom y vaut `""`. | `ambigu` |
| `modele#4` | `modele/forme-et-enveloppement` | `inst.inc.name === "actionWrapper"` ; `this` conservé (`inc() === inst`). Mesuré : substitution ✓ et `this` conservé ✓ (le compteur du modèle passe de 0 à 1) ; le nom y vaut `""`. | `ambigu` |
| `modele#5` | `modele/forme-et-enveloppement` | `inst.nested.deep.inc.name === "actionWrapper"`. Mesuré : l'enrobage dans l'objet imbriqué tient sur l'artefact ; le nom y vaut `""`. | `ambigu` |
| `modele#11` | `modele/getter-cyclique-et-primitives` | `RangeError: Maximum call stack size exceeded`, `o.m.name === "actionWrapper"` après le crash. Mesuré : le `RangeError` et la mutation partielle tiennent à l'identique sur l'artefact ; le nom y vaut `""`. | `ambigu` |
| `modele#15` | `modele/forme-et-enveloppement` | `{anything: 42, fn: () => 1}` accepté, `fn` wrappé. Mesuré : accepté ✓, `fn` wrappé ✓ — et la substitution se voit sur l'artefact sans nom lisible, par le seul changement de `fn.name` (`"fn"` → `""`). | `artefact` |
| `subscribe#12` | — | `s._targets._target.name === "sub"`. Mesuré : `"sub"` sur les sources, `undefined` sur l'artefact — la cible y est bien un effet, sans nom. | `source-seulement` |
| `subscribe#16` | — | Les effets créés par `signal.subscribe()` **dans** une factory sont possédés : dispose du modèle → plus de notification. Mesuré : abonnement appelé pendant la factory, journal `["abo:0"]` seul après `model[Symbol.dispose]()` — sur l'artefact comme sur les sources. API publique. | `artefact` |
| `action#6` | — | `f.name === "actionWrapper"`, `f.length === 0`. Mesuré : `f.name === ""`, `f.length === 0`. | `source-seulement` |
| `dispose#2` | — | `d[Symbol.dispose] === d`, `Symbol.dispose in d === true`. Mesuré sur l'artefact : les deux `true`. `Symbol.dispose` est un symbole bien connu, il n'est pas minifié. | `artefact` |
| `dispose#3` | — | `using` déclenche le cleanup → `["run","body","cleanup"]`. Même refus que `effect#41` : `TypeError: Symbol(Symbol.dispose) is not a function`, journal `["run"]`. | `ambigu` |
| `dispose#5` | — | Dans un realm où `Symbol.dispose` est absent : `Object.getOwnPropertyNames(d)` = `["length","name","undefined"]`, aucun symbole, `typeof d["undefined"] === "function"`, modèle `["a","m","undefined"]`. Mesuré : reproduit **à l'identique** sur le bundle réel, avec `Symbol.dispose` réellement éteint dans le realm du paquet. | `artefact` |
| `dispose#10` | — | `Effect.prototype` porte `dispose` et `_dispose` ; `Object.keys(Effect.prototype)` = `["_callback","_start","_notify","_dispose","dispose"]`. Mesuré : 5 clés énumérables, même ordre — `dispose` survit, `_dispose` devient `d`. | `source-seulement` |

## Décompte

**`artefact` : 10** — `signal#15`, `signal#21`, `conv#10`, `conv#12`, `computed#19`, `effect#34`,
`modele#15`, `subscribe#16`, `dispose#2`, `dispose#5`.
**`source-seulement` : 7** — `signal#3`, `computed#20`, `computed#21`, `effect#39`, `subscribe#12`,
`action#6`, `dispose#10`.
**`ambigu` : 15** — `signal#4`, `signal#6`, `signal#7`, `signal#8`, `computed#10`, `computed#22`,
`effect#36`, `effect#37`, `effect#40`, `effect#41`, `modele#2`, `modele#4`, `modele#5`, `modele#11`,
`dispose#3`.

## Ce que la mesure ne tranche pas

**1. `effect#41` et `dispose#3` sont les deux cas les plus lourds, et ce ne sont pas des cas de
minification.** L'observable est entièrement adressable — `using`, `Symbol.dispose`, l'API publique — et
le paquet installé refuse de la produire : `TypeError: Symbol(Symbol.dispose) is not a function`, journal
arrêté à `["run"]`. La cause est le `bind` du dispositeur, reproduite hors de toute bibliothèque :
`using` sur une fonction liée dont `Symbol.dispose` pointe sur elle-même lève, sur une fonction simple
il passe. **Le paquet installé et les sources se comportent de façon identique**, donc le
`["run","body","cleanup"]` que la matrice publie n'est reproductible ni sur l'un ni sur l'autre, et
l'écart avec le moteur n'est pas un écart de nom. Ce qu'il faut pour trancher : dire laquelle des deux
attentes fait foi, celle de la matrice ou celle du moteur — la mesure ne peut pas le dire, elle peut
seulement constater que les deux cibles la refusent.

**2. Le manglage positionnel permettrait de confronter les sept entrées `source-seulement`, mais il
n'est écrit nulle part.** Les 23 noms lisibles correspondent aux 23 noms de l'artefact **par rang**, et
cinq valeurs indépendantes le confirment. Un registre qui dirait ce rang-là transformerait `signal#3`,
`computed#20`, `computed#21`, `effect#39` et `dispose#10` en attentes vérifiables sur l'artefact, au
prix d'une convention que le paquet peut changer sans prévenir. Ce qu'il faut : une correspondance
publiée, ou un artefact non minifié à comparer. En l'absence des deux, ces sept entrées publient une
attente qu'aucune implémentation ne peut satisfaire si elle est confrontée au paquet installé.

**3. Deux entrées classées `artefact` ne sont adossées à aucun test qui atteigne leur observable.**
`subscribe#16` et `modele#15` portent sur des observables purement publics, et ils tiennent. Mais leur
destination — `nom-de-leffet-interne` et `nom-des-fonctions-enveloppees` — n'affirme qu'un **nom**,
et rien de ce que ces deux entrées décrivent. Le verdict `artefact` de ces deux lignes repose sur ma
sonde, pas sur la suite : `registre-complet` passe, et il ne voit pas la différence.

**4. `effect#40` pointe vers le mauvais test.** Son observable — `Error: Out-of-order effect` — se
rejoue dans `signalcn-seul/gardes-internes`, qui est enregistré par `node --test` (96 tests verts) et
que **aucune entrée de `COUVERTURE` ne cite**. L'entrée `effect#40` pointe vers
`signalcn-seul/hors-ordre`, qui vérifie l'ordre de fermeture imbriquée par l'API publique et n'atteint
pas ce message. Le verdict `ambigu` masque ce déplacement : l'entrée n'a pas une observation introuvable,
elle en a une jamais sollicitée.

**5. `signal#4` est vraie et ne prouve rien.** `"_flags" in signal(1) === false` tient sur l'artefact,
et y tiendrait avec n'importe quel nom. La forme qui la rendrait probante existe pourtant — comparer
les clés-own d'un signal (8) à celles d'un computé (12) et vérifier que le signal n'a pas la clé de
drapeaux — et elle est sans nom lisible. Ce qu'il faut : décider si la matrice publie l'observable
dans sa forme littérale, vacuë, ou dans une forme qui distingue « absent » de « renommé ».

**6. Un commentaire de `COUVERTURE` est contredit par la mesure.** L'entrée `dispose#2` porte ce
commentaire : « la baseline fait pointer `Symbol.dispose` sur le dispositeur, qui est une fonction
liée, et V8 refuse alors cette méthode ». Mesuré : la méthode **est** présente et **s'appelle sans
erreur** sur l'artefact (`d[Symbol.dispose] === d`, appel direct sans levée) ; c'est `using` qui refuse.
`registry/default/signals.test.ts` n'est pas modifié ici — le constat est relevé, pas corrigé.
