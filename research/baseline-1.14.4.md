# Inventaire comportemental exhaustif — `@preact/signals-core@1.14.4`

Baseline figée pour `signalcn`. Toute affirmation ci-dessous provient d'une **probe exécutée**, pas d'une
lecture de code. La source de référence est `package/src/index.ts` (1138 lignes) du tarball
`preact-signals-core-1.14.4.tgz` ; les numéros de ligne `L…` renvoient à ce fichier.

## Où une observation a été faite

Le référent est **le paquet installé**, pas ses sources. Une propriété s'y appelle `i`, pas
`_version` : le paquet minifie les siennes. Une entrée dont l'observable ne peut rien porter sur
l'artefact est marquée comme telle dans `COUVERTURE` — `source:<réf>` ou `divergence:<ancre>` — et
sa raison est au [§21 de la SPEC](../SPEC.md). Elle reste ici, telle quelle : elle dit ce que la
**référence en source** fait, ce qui reste vrai d'elle. Ce qui est faux, c'est de la présenter
comme une observation de l'artefact — et le marqueur, désormais, le dit.

Les lignes **BRANCHE** ne sont pas des doublons. Ce sont les compléments nés d'un découpage : une
entrée qui asserte un comportement confrontable *et* un nom qui ne l'est pas a été coupée en deux.
La branche garde l'observable de la mère — c'est le même fait observé par un autre point — et ce qui
la sépare est **le point d'observation**, jamais le comportement. Neuf branches.

La campagne qui a établi tout cela pour les 32 entrées hors harnais, verdict par verdict, est
[`matrice-hors-harnais.md`](./matrice-hors-harnais.md).

## Méthode de reproduction

1. `npm pack @preact/signals-core@1.14.4` puis décompression → `package/src/index.ts`.
2. Projet jetable `/tmp/opencode/probe` : la lib est chargée **depuis `src/index.ts`** via `tsx`
   (`import … from "./lib.ts"`), donc les noms d'internes observés correspondent exactement aux `L…`.
3. Chaque comportement est un `probe("nom", fn)` isolé, exécuté dans un `try/catch` et journalisé
   séparément : un probe qui throw n'annule pas les suivants.
4. Les comportements dépendants de la **strictness du module consommateur** ont été rejoués sur les
   bundles réellement publiés : `dist/signals-core.js` (CJS, sloppy) et `dist/signals-core.mjs`
   (ESM, strict). Les bundles sont manglés donc leurs noms internes ne sont pas utilisés comme
   référence, seulement comme contrôle de parité.
5. Contrôle de parité : tous les chiffres cités (compteurs de cycle, ordre de flush, `-0`, `NaN`) ont
   été reproduits à l'identique sur `src/index.ts` **et** sur les bundles CJS et ESM.

Node utilisé : v24.18.1.

## Sommaire de l'inventaire

**224 comportements** documentés, répartis ainsi :

| Section | Comportements | Entrées marquées « non documenté » |
|---|---|---|
| Zones non documentées | 60 | 60 |
| `signal(initialValue, options?)` | 23 | 15 |
| `computed(fn, options?)` | 27 | 19 |
| `effect(fn, options?)` | 41 | 27 |
| `batch(fn)` | 26 | 18 |
| `untracked(fn)` | 13 | 7 |
| `action(fn)` | 13 | 8 |
| `createModel(factory)` | 34 | 23 |
| `Signal.prototype.subscribe(fn)` | 18 | 17 |
| Conversions `toString` / `toJSON` / `valueOf` / `brand` | 15 | 12 |
| `dispose` et `Symbol.dispose` | 14 | 9 |
| **Total** | **224** | **175** |

---

# Zones non documentées

C'est la partie la plus importante du livrable : pour tout ce qui suit, ni le `README.md` ni le
`CHANGELOG.md` du paquet ne peuvent servir d'oracle. Ces comportements ont été **établis uniquement
par probe**.

## A. Ordre d'exécution et gestion d'erreurs

1. **L'ordre de flush est l'inverse de l'ordre de notification**, la file `batchedEffect` étant une
   pile en prepend. Pour un seul signal, les targets sont en insertion en tête, donc les effets
   s'exécutent dans l'ordre d'abonnement (donc de création). Pour un batch multi-écritures, l'ordre
   est l'inverse de l'ordre des écritures.
   *Observé* : effets `A`,`B`,`C` sur `a`,`b`,`c`, `batch(() => { a=1; b=1; c=1 })` → `["C:1","B:1","A:1"]`.
   Effets `d1..d4` sur le même signal, `a=1` → `["d4:1","d3:1","d2:1","d1:1"]` (ordre de création).
2. **La première erreur mémorisée est la première rencontrée dans l'ordre de flush**, pas la première
   chronologique. *Observé* : `["A","B","B","A","caught:EB"]` — l'effet `B` tourne avant `A`, donc
   `EB` est re-throwée et `EA` est perdue.
3. **L'erreur d'effet écrase l'erreur du corps du `batch`.** *Observé* : corps qui throw `BODY` et
   effet qui throw `EFFECT` → l'appelant reçoit `EFFECT`. Le `finally { endBatch() }` du `batch`
   (`L101-105`) throw pendant le unwinding et remplace l'exception en cours. Idem avec un `batch`
   imbriqué : `["EFFECT"]`.
4. **Le seuil de cycle est 100 itérations de flush, et l'erreur part du setter après 102 exécutions
   d'effet.** *Observé* : `effect(() => { n++; a.value = a.value + 1 })` → l'effet s'exécute **102
   fois**, `a` vaut 101, puis `Error: Cycle detected`. Le premier run est direct (hors flush,
   `batchIteration === 0`) ; chaque re-run incrémente `batchIteration` avant d'exécuter, donc le
   102ᵉ run voit `batchIteration === 101 > 100`.
5. **Deux mécanismes de cycle distincts.** Le setter (`L463`) dépend de `batchIteration` ; le getter
   d'un `Computed` (`L753`) dépend du flag `RUNNING` et ne dépend **pas** du compteur. Lire un
   computed en cours de calcul throw `Cycle detected` immédiatement, même hors batch.
6. **`Cycle detected` est un `Error` (pas un `TypeError`)**, message exact `"Cycle detected"`,
   `name === "Error"`.
7. **Un cleanup qui throw dispose l'effet**, y compris en pleine flush. *Observé* : après
   `cleanup boom`, l'effet ne se ré-exécute plus et n'est plus abonné.
8. **Un cleanup qui throw interrompt la boucle de dispose d'un modèle** : les modèles suivants ne
   sont pas disposés. *Observé* : `["cleanup1","cleanup2 throws"]`, `err: "m boom"`, `cleanup3`
   jamais exécuté.
9. **L'erreur d'un premier run d'effet dispose l'effet et ne renvoie aucun disposer** :
   `effect()` retourne `undefined` (la variable n'est même pas assignée). `signal._targets` redevient
   `undefined` : `watched` puis `unwatched` sont tous deux déclenchés.
10. **L'erreur d'un computed est mémorisée et re-throwée par `peek`, `toString`, `valueOf` et
    `toJSON`** aussi, pas seulement par `.value`. *Observé* : les six lectures throw `"boom"`, le
    corps n'est évalué qu'une fois (`calls: 1`), `(c)._value instanceof Error === true`.
11. **L'`Error` mémorisée est réutilisée tant qu'aucune écriture n'a eu lieu** : deux lectures
    successives ne réévaluent pas le corps (`calls: 1`) et re-throwent la **même** instance. Après une
    écriture de la dépendance, le corps est réévalué (`calls: 2`) : soit l'erreur est remplacée par une
    nouvelle (`"always 0"` → `"always 1"`), soit le computed redevient valide. Chaque échec incrémente
    `_version` (`1` puis `2`).
12. **Un effet disposé alors qu'il est dans la file de flush est sauté silencieusement** (`L62`) :
    *Observé* : `d1` disposé par `d2` pendant la flush → le journal contient `"d1:1"` mais pas
    `"d2:1"`.
13. **L'ordre de drain est BFS sur les itérations de flush** : la chaîne en cours est vidée
    entièrement avant la chaîne suivante, les effets notifiés pendant l'exécution repartent dans une
    nouvelle chaîne.
14. **Un effet qui écrit une dépendance qu'il lit s'auto-notifie** et se ré-exécute dans la même
    flush (autant de fois que nécessaire). *Observé* : `["run:0","run:1","run:2","run:3"]` pour
    `if (v < 3) a.value = v + 1`.

## B. Structure d'objets observable

15. **`Computed.prototype` est une *instance unique et partagée* de `Signal`** (`L644`).
    *Observé* : `Object.getPrototypeOf(c1) === Object.getPrototypeOf(c2) === true`. Ses 12 clés
    d'instance sont donc visibles par `for..in` sur chaque computed.
16. **Lire `.value` sur `Computed.prototype` throw `TypeError: this._fn is not a function`** **et empoisonne
    définitivement le prototype partagé** : `_flags` passe à 16 (`HAS_ERROR`), `_value` devient une
    `TypeError`, `_version` passe à 1, et 3 nouvelles clés apparaissent (`_flags`, `_globalVersion`,
    `_sources`). *Observé* avant/après : 12 clés → 15 clés. Les deux lectures suivantes throw le même
    message. Les computeds réels continuent de fonctionner (`c2.value === 2`).
17. `Object.keys(computed)` expose 12 propriétés d'instance ; `for..in` en expose **22** (les 10
    propriétés énumérables du prototype s'y ajoutent ; `value` est non énumérable).
18. `Object.keys(signal)` et `Object.keys(new Effect(...))` incluent toujours `name`, même absent
    (valeur `undefined`), car le constructeur fait une affectation inconditionnelle.
19. **`EffectOptions.name` n'est pas observable via la valeur de retour de `effect()`** : la fonction
    retournée est `effect._dispose.bind(effect)`, son `.name` vaut `"bound "`. Le nom n'est visible que
    via `new Effect(fn, { name })` (classe exportée) ou via les internes : l'effet créé par
    `subscribe` porte `name === "sub"` (`s._targets._target.name`).
20. `SignalOptions.name` est un simple champ public, mutable après coup.
21. **`this` dans le callback d'un effet est l'instance `Effect`** et non `undefined` : les 6 clés
    privées (`_fn`, `_cleanup`, `_sources`, `_nextBatchedEffect`, `_flags`, `name`) et
    `_start`/`_callback`/`dispose` sont publiquement atteignables. Mais **seulement pour une fonction
    non fléchée** : une flèche capture le `this` lexical du module.
22. **`this` dans un callback `subscribe` n'est *pas* l'effet** : le callback est appelé en
    `fn(value)` depuis une flèche. *Observé* : `this === globalThis` en CJS sloppy, `undefined` en
    ESM strict. Idem pour `this` dans une fonction passée à `action()` et dans la factory de
    `createModel` : c'est la strictness du **module consommateur** qui décide.
23. **Affectation à `computed.value`** : `Computed.prototype.value` n'a **pas de setter**. En sloppy :
    no-op silencieux. En strict (bundle ESM) : `TypeError: Cannot set property value of [object
    Object] which has only a getter`.
24. **`createModel` qui renvoie une primitive ne throw pas en sloppy** (affectation de propriété sur
    une primitive = no-op silencieux) et throw en strict : `TypeError: Cannot create property
    'Symbol(Symbol.dispose)' on number '42'`.
25. `signal` gelé (`Object.freeze`) : écriture → `TypeError: Cannot assign to read only property`.

## C. `createModel` / `action` (la surface la moins documentée)

26. **`createModel` mute l'objet retourné par la factory en place** (`L1076-1087`, `L1109`) et le
    retourne tel quel. *Observé* : `inst === shared`, et `shared.inc.name` passe de `"inc"` à
    `"actionWrapper"` **après** `new M()`.
27. **`instanceof` est toujours faux**, `instance.constructor === Object`. L'objet n'est pas une
    instance de la "classe" retournée.
28. **Appelable sans `new`** au runtime, y compris depuis le TypeScript compilé.
29. **`wrapInAction` n'utilise que `for…in`** → les méthodes de prototype de classe ne sont **pas**
    wrappées. *Observé* : `class Foo { m(){} n = signal(1) }` → `inst.m.name === "m"`.
30. **`wrapInAction` ne descend pas dans les objets qui ont `brand`** (donc pas dans un signal) et ne
    touche pas `null`/primitives. Un `Date` reste la même référence.
31. **`wrapInAction` boucle infiniment sur un objet cyclique** : `RangeError: Maximum call stack size
    exceeded`, l'objet étant **partiellement** muté avant le crash.
32. **Les getters sont invoqués une seule fois**, par le `for…in` de `wrapInAction`, et le résultat est
    réassigné comme propriété de données. Un getter qui renvoie un signal le fait entrer dans le
    modèle.
33. **Les effets créés dans un getter ne sont pas possédés** : `wrapInAction` s'exécute **après**
    `stopCapturingEffects()`. *Observé* : l'effet tourne, puis survit au `model[Symbol.dispose]()`.
34. **Les effets d'un modèle imbriqué sont remontés dans la propriété du parent**
    (`L1064-1073`). *Observé* : dispose du modèle externe → les cleanups des deux modèles imbriqués
    tournent, et les signaux du modèle interne deviennent inertes.
35. **Les effets créés dans un `untracked()` ou une `action()` pendant une factory ne sont pas
    possédés** (CHANGELOG 1.14.4 le mentionne pour `untracked` **et** `action`, mais le README n'en
    parle pas et le mécanisme — remise à `undefined` puis restauration — n'est pas décrit).
36. **Les effets créés dans un `batch()` pendant une factory sont possédés** : `batch` ne touche pas
    `capturedEffects`.
37. **Un effet créé dans un cleanup pendant `model[Symbol.dispose]()` n'est pas possédé** et fuit.
38. **Si la factory throw, les effets capturés sont perdus** (`L1099-1104`) : `capturedEffects` est
    remis à `undefined`, donc aucune instance ultérieure ne les récupère. *Observé* : l'effet leaké
    s'exécute une fois et survit à tout dispose de modèle.
39. **Les effets créés par `signal.subscribe()` dans une factory SONT possédés** (ce sont des
    `Effect` comme les autres).
40. `model[Symbol.dispose]` **écrase** un `Symbol.dispose` fourni par l'utilisateur, silencieusement.
41. `model[Symbol.dispose]` est un `action` : il batche les disposes. Les cleanups sont flushing dans
    l'ordre, un par un.
42. `Object.keys(model)` ne contient jamais `Symbol.dispose` ; `Object.getOwnPropertySymbols(model)`
    contient exactement `Symbol(Symbol.dispose)`.
43. `action()` retourne une fonction nommée `"actionWrapper"`, de `length` 0 quel que soit le nombre
    d'arguments déclarés, `brand` absent.

## D. Divers

44. **`Signal` et `Computed` appelé sans `new`** : `Signal(5)` → `TypeError: Cannot read properties of
    undefined` (strict) ; en sloppy le `this` devient le global et la valeur est écrite sur le global.
45. **Aucune validation à l'exécution dans `createModel`** : `{ anything: 42, fn: () => 1 }` passe, la
    fonction est wrappée. `ValidateModel` n'est qu'un type.
46. **Les dépendances dynamiques sont réactivées** : après abandon puis re-lecture, l'ancien nœud est
    réutilisé et les bonnes dépendances sont réabonnées. *Observé* : `["1","10","2","3"]` — après
    `t=true`, `a=2` ne notifie plus ; après `t=false`, `a=3` notifie à nouveau.
47. **Le compteur d'évaluations d'un computed invalidé puis relu dépend de la version globale.**
    *Observé* : `c.value` trois fois → 1 évaluation ; puis `a=1; b=2` sans abonné ; puis `c.value` →
    **2ᵉ évaluation** et la valeur intègre les deux écritures (`12`).
48. **Le correctif 1.14.4 (`recordBatchSnapshot` / `reconcileBatchSnapshots`) est observable.** *Observé* :
    `batch(() => { a=1; c.value; a=0 })` → le computed est évalué 3 fois au total, l'effet tourne
    **2 fois** (la seconde avec la valeur revertie `0`). Sans lecture intermédiaire, l'effet ne tourne
    **pas** du tout (`cCalls: 1, eRuns: 1`).
49. **Le snapshot n'est enregistré que pendant le corps du `batch` utilisateur** (`L165` :
    `batchDepth === 0 || batchIteration !== 0`) : une écriture faite par un effect pendant le flush
    n'entre pas dans le snapshot, donc pas de fast-forward. *Observé* : les trois scénarios de revert
    n'ont pas le même comportement (#16, #17, #18 ci-dessous) — le fast-forward ne s'applique qu'aux
    nodes qui ont vu la version *pré-batch*.
50. **`untracked` restaure `evalContext` ET `capturedEffects` même en cas d'exception** (`finally`).
51. **`watched`/`unwatched` sont appelés dans un `untracked`** : les lectures de signal faites dans ces
    callbacks n'abonnent personne. *Observé* : `"watched reads other=X"`. Une écriture dans `watched`
    est visible par l'effet qui est en train de s'abonner (`t.value = 1` puis l'effet lit `t === 1`).
52. **`watched` d'un computed se déclenche avant ceux de ses sources**, et `unwatched` dans l'ordre
    inverse. *Observé* : `["c:watched","a:watched","b:watched"]` puis `["c:unwatched","a:unwatched","b:unwatched"]`.
53. **Si `watched` ou `unwatched` throw**, l'erreur remonte à travers `effect()`/`dispose()` et l'effet
    est disposé.
54. **Une exception dans un cleanup laisse `evalContext` intact** (le throw a lieu avant
    `evalContext = undefined` dans `_start`, `L928` vs `L933`) : pas de `"Out-of-order effect"`.
55. **`"Out-of-order effect"` est inatteignable par l'API publique** ; atteint seulement en appelant
    deux fois le `finish` renvoyé par `Effect.prototype._start` sur la classe exportée.
    *Observé* : `Error: Out-of-order effect`.
56. **Un cleanup qui lit le signal dont il dépend ne le réabonne pas**, mais lit la valeur **courante**
    (post-écriture). *Observé* : `"cleanup sees 7"`.
57. **Les écritures faite dans un cleanup sont différées** si le dispose a lieu pendant une flush, mais
    **immédiates** s'il a lieu hors flush. *Observé* : pendant la flush, l'autre effet tourne après le
    premier ; hors flush, il tourne pendant le `dispose()`.
58. **`Symbol.dispose` absent ⇒ clé de propriété `"undefined"`** (voir §`dispose` et
    `Symbol.dispose`, ligne 5).
59. `toString()` sur un `Symbol` throw `TypeError: Cannot convert a Symbol value to a string` (le
    message vient de V8, pas de la lib). **Aucun `Symbol.toPrimitive`** n'est défini :
    `signal(1)[Symbol.toPrimitive] === undefined`. La conversion string passe donc par
    `toString`/`valueOf` selon le type de la valeur.
60. `JSON.stringify(signal(5))` → `"5"` grâce à `toJSON`.

---

# `signal(initialValue, options?)`

| # | Comportement | Localisation `src/index.ts` | Observé (résultat du probe) | Documenté ? | Quirk figé |
|---|---|---|---|---|---|
| 1 | Crée une instance `Signal` | `L494-498` | `signal(1).value === 1`, `_version === 0` | oui | — |
| 2 | Sans argument → `undefined` | `L494-497` | `signal().value === undefined`, identique à `signal(undefined)` | partiellement (CHANGELOG 1.7.0) | — |
| 2b | **BRANCHE** — Sans argument → `undefined` | `L494-497` | `signal().value === undefined`, identique à `signal(undefined)` | partiellement (CHANGELOG 1.7.0) | — |
| 3 | 8 propriétés d'instance, dans cet ordre | `L368-377` | `Object.keys(signal(1))` = `["_value","_version","_node","_targets","_batchSnapshotVersion","_watched","_unwatched","name"]` | non | ordre exact des clés |
| 4 | Pas de `_flags` sur un `Signal` | `L368-377` | `"_flags" in signal(1) === false`, `signal(1)._flags === undefined` | non | un `Signal` n'est pas un `Effect` |
| 4b | **BRANCHE** — Pas de `_flags` sur un `Signal` | `L368-377` | `"_flags" in signal(1) === false`, `signal(1)._flags === undefined` | non | un `Signal` n'est pas un `Effect` |
| 5 | Écriture → notification immédiate et synchrone | `L461-485` | `["e:0","before","e:1","after"]` | oui (README §`signal`) | le flush est terminé avant la fin de l'instruction |
| 5b | **BRANCHE** — Écriture → notification immédiate et synchrone | `L461-485` | `["e:0","before","e:1","after"]` | oui (README §`signal`) | le flush est terminé avant la fin de l'instruction |
| 6 | Égalité `!==` stricte : `NaN` notifie | `L462` | `s = NaN`, effect re-exécuté **2 fois**, `_version === 1` | non | `Object.is` n'est **pas** utilisé |
| 6b | **BRANCHE** — Égalité `!==` stricte : `NaN` notifie | `L462` | `s = NaN`, effect re-exécuté **2 fois**, `_version === 1` | non | `Object.is` n'est **pas** utilisé |
| 7 | `0 → -0` ne notifie pas | `L462` | 1 run au total, `_version === 0`, `Object.is(value,-0) === false` (valeur restée `0`) | non | — |
| 7b | **BRANCHE** — `0 → -0` ne notifie pas | `L462` | 1 run au total, `_version === 0`, `Object.is(value,-0) === false` (valeur restée `0`) | non | — |
| 8 | `-0 → 0` ne notifie pas | `L462` | 1 run, `_version === 0`, `Object.is(value,-0) === true` (valeur restée `-0`) | non | — |
| 8b | **BRANCHE** — `-0 → 0` ne notifie pas | `L462` | 1 run, `_version === 0`, `Object.is(value,-0) === true` (valeur restée `-0`) | non | — |
| 9 | Nouvel objet de même forme notifie | `L462` | 2 runs, `_version === 1` ; ré-écriture de l'objet d'origine → `_version === 2` | non | identité, pas égalité structurelle |
| 10 | `0 → undefined` notifie ; `undefined → undefined` non | `L462` | 2 runs / 1 run | non | — |
| 11 | Écriture identique : aucune notification | `L462` | 1 run, `_version` inchangé | non | — |
| 11b | **BRANCHE** — Écriture identique : aucune notification | `L462` | 1 run, `_version` inchangé | non | — |
| 12 | Auto-écriture dans un effect : aucune boucle | `L462` | `effect(() => { n++; s.value = s.value })` → `n === 1` | non | — |
| 13 | Écriture hors de tout effect : aucun flush | `L481-483` | effect sans dépendance : `n === 1` après 2 écritures | oui (README §`effect` « lazy ») | — |
| 14 | `peek()` = `untracked(() => value)` | `L449-451` | effect lisant `s.peek()` : 1 run malgré `s=1` | oui (README + CHANGELOG 1.0.0/1.0.1) | — |
| 15 | `peek()` est énumérable et inscriptible sur le prototype | `L449` | descripteur `{writable:true, enumerable:true, configurable:true}` | non | — |
| 16 | `options.name` → champ public mutable | `L376` | `signal(1,{name:"n"}).name === "n"`, `signal(1).name === undefined`, `""` conservé | oui (README §options) | toujours présent dans `Object.keys` |
| 17 | `brand` sur le prototype | `L379` | `typeof s.brand === "symbol"`, `String(s.brand) === "Symbol(preact-signals)"`, énumérable/inscriptible | partiellement (CHANGELOG 1.5.0) | inscriptible : `s.brand = "x"` crée une prop d'instance |
| 18 | `instanceof Signal` vrai | `L300`,`L368` | `s instanceof Signal === true`, proto `=== Signal.prototype` | non | — |
| 19 | `new Signal(5)` : signal mutable | `L368` | `.value = 2` → `2` | non | la classe est exportée |
| 20 | `Signal(5)` sans `new` | `L368` | `TypeError: Cannot read properties of undefined` (strict) | non | le corps n'est pas validé |
| 21 | Signal gelé (`Object.freeze`) | `L461-485` | `TypeError: Cannot assign to read only property` en strict (le nom de propriété dans le message dépend du build : `_value` en source, `v` dans le bundle) | non | dépend de la strictness |
| 22 | `brand` commun à toutes les versions | `L3` | `signal(1).brand === Signal.prototype.brand` | oui (CHANGELOG 1.5.0) | `Symbol.for`, donc inter-réalms |
| 23 | Aucune méthode `dispose` sur un `Signal`/`Computed` | `L300`,`L622` | `typeof signal(1).dispose === "undefined"`, idem pour un computed | non | seul l'effet retourné est disposible |

---

# `computed(fn, options?)`

| # | Comportement | Localisation `src/index.ts` | Observé (résultat du probe) | Documenté ? | Quirk figé |
|---|---|---|---|---|---|
| 1 | Paresseux : rien ne s'exécute avant la première lecture | `L640-641`,`L661-697` | `callsBefore === 0`, `callsAfter === 1` | oui (README « lazy ») | — |
| 2 | Valeur mise en cache si résultat identique | `L679-687` | 3 lectures consécutives → **1** évaluation | oui (CHANGELOG 1.1.1) | — |
| 3 | Sans abonné, une écriture ne relance rien | `L737-749` | après `a=1`, `calls === 1`, `c.value === 2`, `calls === 2` | oui (README) | — |
| 3b | **BRANCHE** — Sans abonné, une écriture **non liée** ne fait pas non plus réévaluer | `L669` | `c(a)` puis `z=1; z=2`, puis `c.value` → `calls === 1` ; puis `a=10` puis `c.value` → `calls === 2`, valeur `11` | non | la voie rapide absorbe le compteur global quand tous les nœuds sont à jour |
| 4 | Invalidation par écriture, mais invalidé-puis-relu ≠ 1 évaluation | `L646-697` | `c.value` ×2 → 1 ; `a=1;b=2` ; `c.value` → `calls === 2`, valeur `12` | non | la version globale force un recalcul |
| 5 | Un résultat identique ne notifie pas les dépendants | `L679-687` | computed `%2`, effect : `a=2` → `cCalls: 2, eRuns: 1` | non | l'effet est notifié puis sauté par `needsToRecompute` |
| 6 | Le cas symétrique notifie | `L679-687` | `a=1` → `cCalls: 2, eRuns: 2` | non | — |
| 7 | L'écriture du computé le déconnecte et le reconnecte paresseusement | `L699-735` | `a=1; c.value; a=2; c.peek()` → 3 évaluations, `peek === 6` | oui (CHANGELOG 1.1.0 « stale value … deactivated ») | — |
| 8 | Dépendances dynamiques ajoutées/retirées | `L533-617` | `toggle` true→false puis `a="a2"` : journal `["a","b","b2"]`, `calls === 2` | oui (CHANGELOG 1.1.0 « conditional signals ») | — |
| 9 | Réactivation après abandon complet | `L250-284` | journal `["1","10","2","3"]`, `calls === 4` | non | à 100% non documenté |
| 10 | L'ordre des dépendances est l'ordre de première lecture | `L508-531` | `a*10+b` : la 1ʳᵉ dépendance change suffit | non | optimisation interne |
| 11 | Lecture re-entrée dans un batch : seul le chemin lu est recalculé | `L646-697` | journal `["0/0","mid:2","2/3"]` | oui (README §`batch`) | — |
| 12 | Auto-cycle : `Error: Cycle detected` immédiat | `L753-755` | `computed(() => c.value + 1)` → `Error: Cycle detected`, `name === "Error"` | non | **indépendant** de `batchIteration` |
| 13 | Cycle indirect à la relecture | `L753`,`L646-651` | 2 computeds mutuels : 1ʳᵉ lecture `1`, après `s=1` → `Cycle detected` | non | — |
| 14 | Écriture de signal dans un computé autorisée | `L678` | journal `["eval:0","e:0 mirror=0","eval:1","e:1 mirror=2"]` | oui (CHANGELOG 1.6.0) | l'effet voit la valeur *déjà* écrite |
| 15 | Erreur stockée dans `_value` + flag `HAS_ERROR` | `L688-692` | 6 lectures successives throw `"boom"`, `calls === 1`, `_value instanceof Error`, `_flags & 16` | non | `peek`/`toString`/`valueOf`/`toJSON` propagent aussi |
| 16 | L'erreur ne se résout que si une dépendance change | `L646-697` | après `s=1` : `c.value === 20`, `calls === 2` | non | pas de nouvelle tentative sur simple relecture |
| 17 | Propagation de l'erreur vers l'effect qui la lit | `L761-763` | `["create threw derived boom2","runs=1","c=1"]` : l'effect est **disposé** à la création, `s=1` ne le relance pas | non | l'effect ne survit pas à l'erreur du computé |
| 18 | 2 computeds → les 2 re-évaluent dans le même flush | `L737-749` | `["c1:0","c2:1","e1:2","e2:2"]` puis après `a=1` `["c1:1","c2:2","e1:3","e2:3"]` | non | ordre **bottom-up** : c1, c2, puis l'effet |
| 18b | **BRANCHE** — 2 computeds **indépendants** et 2 effets : l'ordre alterne, pas bottom-up | `L737-749` | `["c1:0","e1:1","c2:0","e2:2"]` puis après `a=1` `["c1:1","e1:2","c2:1","e2:3"]` | non | un computé n'est pas une génération de drainage : chaque effet suit le computé qu'il lit |
| 19 | `Computed.prototype` est une `instance` de `Signal` partagée | `L644` | `Object.getPrototypeOf(c1) === Object.getPrototypeOf(c2) === true` | non | singleton mutable |
| 20 | `Object.keys(computed)` = 12 clés d'instance | `L635-642` | `["_value","_version","_node","_targets","_batchSnapshotVersion","_watched","_unwatched","name","_fn","_sources","_globalVersion","_flags"]` | non | liste exacte |
| 21 | `for…in` sur un computed = 22 clés | `L644` | + `["_refresh","_subscribe","_unsubscribe","_notify","brand","subscribe","valueOf","toString","toJSON","peek"]` | non | 22 = 12 + 10 |
| 22 | Lire `.value` sur le prototype throw et l'empoisonne | `L644`,`L678` | `TypeError: this._fn is not a function` ; 12 → 15 clés, `_flags === 16`, `_version === 1`, computeds réels OK | non | effet de bord **global au module** |
| 22b | **BRANCHE** — Lire `.value` sur le prototype throw et l'empoisonne | `L644`,`L678` | `TypeError: this._fn is not a function` ; 12 → 15 clés, `_flags === 16`, `_version === 1`, computeds réels OK | non | effet de bord **global au module** |
| 23 | `instanceof Signal` **et** `instanceof Computed` vrais, `constructor.name === "Signal"` | `L644` | `true`, `true`, `"Signal"` | non | — |
| 24 | Pas de setter sur `value` | `L751-766` | sloppy : no-op silencieux ; strict : `TypeError: Cannot set property value …only a getter` | non | dépend de la strictness |
| 25 | `options.name` champ public | `L636` | `computed(()=>1,{name:"c"}).name === "c"`, modifiable après coup | oui (CHANGELOG 1.12.0) | — |
| 26 | `subscribe` sur un computed : notification immédiate puis à chaque changement | `L427-435` | `[0,2,4]`, puis plus rien après `unsub()` | non | voir §`Signal.subscribe` |
| 27 | `brand` présent → `wrapInAction` ne descend pas dedans | `L1081` | `"brand" in computed(()=>1) === true` | non | — |

---

# `effect(fn, options?)`

| # | Comportement | Localisation `src/index.ts` | Observé (résultat du probe) | Documenté ? | Quirk figé |
|---|---|---|---|---|---|
| 1 | Premier run synchrone, avant le retour | `L969-972` | `["e:0","after"]` | oui (README §`effect`) | — |
| 2 | Re-run à chaque changement de dépendance | `L937-943` | `["e:0","e:1","e:2"]` | oui | — |
| 3 | Sans dépendance : 1 run, jamais re-notifié | `L937-943` | `n === 1` après 2 écritures | oui | — |
| 4 | Retourne un dispositeur : fonction *bound*, `name === "bound "`, `length === 0`, `Object.keys === []` | `L979` | `{"type":"function","name":"bound ","length":0}` | oui (README) | ce n'est **pas** une arrow, ni l'instance `Effect` |
| 5 | Valeur de retour non-fonction ignorée | `L913-916` | `effect(() => 42)` : aucun cleanup | partiellement (CHANGELOG 1.3.1) | — |
| 6 | Cleanup appelé avant le run suivant | `L802-824`,`L928` | `["run:0","--","cleanup:0","run:1","--","cleanup:1","--end"]` | oui (README, CHANGELOG 1.2.0) | — |
| 7 | Cleanup exécuté hors de tout contexte de suivi | `L810-811` | `"cleanup reads other=5"` : la lecture de `other` n'abonne pas | oui (CHANGELOG 1.2.1 « cleanup functions always outside of any context ») | — |
| 8 | Le cleanup lit la valeur **courante** | `L813` | `"cleanup sees 7"` | non | — |
| 9 | `this` = instance `Effect` pour une fonction non fléchée | `L913` | `Object.keys(this)` = `["_fn","_cleanup","_sources","_nextBatchedEffect","_flags","name"]`, `this instanceof Effect` | partiellement (README, CHANGELOG 1.10.0) | API privée accessible via `this` |
| 10 | `this` **n'est pas** l'effet pour une flèche | `L913` | `typeof this === "object"`, `hasDispose === "undefined"` | partiellement (README dit « non-arrow ») | piège : une flèche capture le `this` du module |
| 11 | `this.dispose()` pendant le run : cleanup immédiat, plus de re-run | `L840-852` | `["run 0","cleanup 0","--"]`, `s=1` sans effet | oui (CHANGELOG 1.2.0) | le cleanup part via `endEffect`→`disposeEffect` |
| 12 | `this.dispose()` appelé 2× pendant le run : 1 seul cleanup | `L945-951` | `["run:0","cleanup:0"]` | non | — |
| 13 | `dispose()` externe : idempotent | `L945-955` | 3 appels → 1 cleanup, plus de run | non | — |
| 14 | Effet disposé **dans la file de flush** : sauté, aucun callback | `L62` | `["d1:0","d2:0","d1:1"]` — `d2` absent | non | vérifie le flag `DISPOSED` avant `needsToRecompute` |
| 15 | Effet A qui dispose B **après** le run de B : B tourne une fois | `L51-74` | `["d1:0","d2:0","d1:1","d1 disposed d2"]` | non | ordre BFS |
| 16 | Effet qui s'écrit lui-même : re-run dans la même flush | `L51-74`,`L937-943` | `["run:0","run:1","run:2","run:3"]` | non | — |
| 17 | Effet qui écrit le signal d'un autre effet : l'autre tourne après | `L51-74` | `["d2:0","d1:0","d1:1","d2:1","d1:1"]` (d1 tourne 2×) | non | ordre : chaîne courante vidée, puis nouvelle |
| 18 | Auto-cycle : `Cycle detected` après **102 runs** | `L463`,`L907-920` | `{"n":102,"err":"Cycle detected","a":101}` | non | seuil 100 itérations |
| 19 | Cycle borné : pas d'erreur | `L463` | `if (v < 50) a = v+1` → 51 runs, pas d'erreur | non | — |
| 20 | Erreur au 1ᵉʳ run : effet disposé, propagée, **aucun dispositeur retourné** | `L971-976` | `{"runs":1,"dUndefined":true,"targets":true,"runsAfter":1}` | oui (CHANGELOG 1.2.3) | `effect()` ne retourne rien |
| 21 | `watched`/`unwatched` déclenchés autour de cet effet | `L394-396`,`L419-421` | `"W2 watched"`, `"W2 unwatched"`, `_targets === undefined` | non | couplés à l'échec du premier run |
| 22 | Erreur à un re-run : l'effet **survit** | `L907-920` | `["run:0","run:1","threw:boom","run:2"]` | non | asymétrie avec le 1ᵉʳ run |
| 23 | 1ʳᵉ erreur mémorisée = 1ʳᵉ dans l'ordre de flush | `L65-70` | `["A","B","B","A","caught:EB"]` | non | ordre LIFO |
| 24 | Drain complet : les effets sans erreur tournent | `L51-74` | `["A","B","C","C","B","A","caught:EA"]` | non | — |
| 25 | Erreur re-throwée depuis le setter si écriture hors batch | `L481-483` | `write threw: E`, `value now: 1` | non | — |
| 26 | Erreur re-throwée depuis le `batch`, pas depuis le corps | `L101-105` | `["e:0","e:1","caught:body"]` | non | — |
| 27 | L'erreur d'effet écrase l'erreur du corps | `L101-105` | `["EFFECT"]` (le `BODY` est perdu) | non | `finally` throw pendant l'unwinding |
| 28 | Cleanup qui throw → effet disposé, même en flush | `L814-818` | `["run:0","cleanup0 throws","caught:cleanup boom"]`, `s=2` sans run | oui (CHANGELOG 1.2.1) | flags forcés à `DISPOSED` |
| 29 | Cleanup qui throw au `dispose()` : remonte, effet mort | `L814-818` | `["run:0","cleanup:0","caught:cleanup boom"]`, `s=1` sans run | oui (CHANGELOG 1.2.1) | — |
| 30 | Un cleanup qui throw ne casse pas le contexte | `L928` vs `L933` | pas de `"Out-of-order effect"` | non | — |
| 31 | Écriture dans un cleanup : flush selon le contexte | `L807-822` | hors flush → `"d2:1"` pendant `dispose()` ; pendant la flush → `"d2:99"` **après** `"d1:1"` | non | dépend de `batchDepth` |
| 32 | 3 niveaux (2 computeds + 2 effets) : ordre | `L737-749` | `["c1:0","c2:1","d1:2","d2:0","c1:1","c2:2","d1:3","d2:1"]` | non | pendant la flush : c1, c2, e1, e2 |
| 33 | Effets créés dans un effect : indépendants, non possédés | `L902-905` | `["outer:0","inner:0","inner:1"]` : après `outer.dispose()`, l'inner reste abonné et tourne | non | `capturedEffects` n'est actif que dans une factory |
| 34 | Effet créé dans un computé : fuite à chaque évaluation | `L902-905` | `["inner:0","outer:0","inner:0","outer:2","inner:1","inner:1"]` | non | un nouvel effet par évaluation |
| 35 | `options.name` non observable via le retour | `L900`,`L979` | `(d).name === "bound "`, `Object.keys(d) === []` | non | CHANGELOG 1.12.0 promet un nom pour le debug |
| 36 | `options.name` observable via `new Effect(...)` | `L900` | `e.name === "n"`, `Object.keys(e)` = `["_fn","_cleanup","_sources","_nextBatchedEffect","_flags","name"]` | non | — |
| 36b | **BRANCHE** — `options.name` observable via `new Effect(...)` | `L900` | `e.name === "n"`, `Object.keys(e)` = `["_fn","_cleanup","_sources","_nextBatchedEffect","_flags","name"]` | non | — |
| 37 | Flags initiaux | `L899`,`L641` | `new Effect(fn)._flags === 32` (`TRACKING`) ; `computed(fn)._flags === 4` (`OUTDATED`), `_globalVersion === -1` | non | — |
| 38 | Le callback ne reçoit aucun argument | `L913` | `arguments.length === 0` | non | — |
| 39 | `Effect` exporté, méthodes énumérables sur le prototype | `L894-955` | `Object.keys(Effect.prototype)` = `["_callback","_start","_notify","_dispose","dispose"]` | non | API interne entièrement publique |
| 40 | `"Out-of-order effect"` atteignable seulement via `_start` | `L840-843` | double appel du `finish` → `Error: Out-of-order effect` | non | inatteignable par l'API publique |
| 40b | `"Out-of-order effect"` atteignable seulement via `_start` | `L840-843` | double appel du `finish` → `Error: Out-of-order effect` | non | inatteignable par l'API publique |
| 41 | `effect(fn)` retourné est utilisable avec `using` | `L980` | `["run","body","cleanup"]` | oui (CHANGELOG 1.11.0) | — |

---

# `batch(fn)`

| # | Comportement | Localisation `src/index.ts` | Observé (résultat du probe) | Documenté ? | Quirk figé |
|---|---|---|---|---|---|
| 1 | Flush synchrone en fin de callback | `L95-106` | `["e:0","A","B","C","D","e:1","E"]` | oui (README §`batch`) | — |
| 2 | Coalesce les écritures | `L51-74` | 3 écritures → `["e:0","e:3"]` | oui | — |
| 3 | Retourne la valeur du callback | `L102` | `batch(() => "ret") === "ret"`, référence d'objet préservée | oui (JSDoc) | — |
| 4 | Laisse remonter l'erreur du corps **mais flush quand même** | `L101-105` | `["e:0","e:1","caught:boom"]` | non | — |
| 5 | Imbriqué = simple `fn()`, sans `startBatch`/`endBatch` | `L96-98` | `["A","B","C","D","e:1","E"]` : rien n'est flushé avant la sortie du batch externe | oui (README « nested ») | ⚠️ l'affirmation « sans comptabilité » est **imprécise** : `batch()` n'incrémente pas `batchDepth`, mais les setters internes font toujours `startBatch`/`endBatch` ; c'est `batchDepth > 0` qui diffère le flush |
| 6 | Imbriqué : la valeur de retour intérieure remonte | `L97` | `batch(() => batch(() => "inner")) === "inner"` | non | — |
| 7 | Profondeur 3 : un seul flush | `L42-45` | `["e:0","after3","after2","e:1"]` | non | — |
| 8 | Erreur du batch intérieur rattrapée dans l'extérieur : pas de flush intermédiaire | `L96-98` | `["e:0","caught inner","after","e:1","end"]` | non | pas de `try/finally` dans le cas imbriqué |
| 9 | Erreur extérieure avec batch ouvert : flush puis re-throw | `L101-105` | `["e:0","e:1","caught:out"]` | non | — |
| 10 | `batchDepth` restauré après une erreur | `L103-105` | après un `batch` qui throw, les écritures suivantes flushent normalement (`after: 2`, `final: 4`) | non | `finally` indispensable |
| 11 | Batch sans écriture : aucun flush | `L51` | `n === 1` | non | — |
| 12 | Écritures identiques dans un batch : une seule notification | `L462` | `n === 2` (1er run + 1 flush) | non | — |
| 13 | Un `batch` créé **dans** le flush d'un effect re-batche | `L96-98` | `["e1:0","e1:1","e1:2","e1:1","e1:2"]` | non | imbrication pendant le flush |
| 14 | Ordre de flush = inverse de l'ordre de notification | `L51-73`,`L937-943`,`L385-399` | 3 effets distincts, `batch(() => {a=1;b=1;c=1})` → `["C:1","B:1","A:1"]` ; 4 effets sur le même signal → `["d4:1","d3:1","d2:1","d1:1"]` | non | règle à écrire noir sur blanc |
| 15 | Un effet notifié 2× ne tourne qu'une fois par flush | `L938-942` | 3 écritures dans un batch → 1 run | non | flag `NOTIFIED` |
| 16 | `A → B → A` dans un batch : aucun re-run | `L180-206` | `cCalls: 1, eRuns: 1` | oui (CHANGELOG 1.14.0) | — |
| 17 | `A → B → A` **avec lecture paresseuse pendant le batch** : l'effet re-tourne | `L180-206` | `["e:0","mid:10","e:0","end:0"]`, `cCalls: 3`, `eRuns: 2` | oui (CHANGELOG 1.14.4) | le fast-forward ne s'applique qu'aux nodes qui ont vu la version *pré-batch* |
| 18 | `A → B → A` puis écriture ultérieure : pas de valeur figée | `L180-206` | `["e:0","e:0","e:20"]`, `cCalls: 4` | oui (CHANGELOG 1.14.4) | régression corrigée en 1.14.4 |
| 19 | Revert sur un signal et changement sur un autre : le computé change | `L180-206` | `runs: 2` | oui (CHANGELOG 1.14.0) | — |
| 20 | Snapshot uniquement pendant le corps du batch | `L163-178` | les écritures de l'utilisateur sont snapshotées, celles des effets non (`batchIteration !== 0`) ; effet de bord : les 3 scénarios de revert (#16, #17, #18) diffèrent | non | le fast-forward ne vise que les nodes ayant vu la version pré-batch |
| 21 | Effet créé dans le corps du batch : son premier run est immédiat | `L969-972` | `["before","new effect runs 0","after-create"]` | non | — |
| 22 | Cycle dans un batch : même seuil, 102 runs | `L463` | `{"n":102,"err":"Cycle detected"}` | non | `batchIteration` n'est incrémenté que dans le flush |
| 23 | Cycle dans un `batch` **appelé depuis** un effect : 102 runs | `L463` | `{"n":102,"err":"Cycle detected"}` | non | — |
| 24 | Ping-pong de 2 effets : 52 / 51 runs puis `Cycle detected` | `L463` | `{"an":52,"bn":51,"a":102,"b":101}` | non | chiffres exacts |
| 25 | Ping-pong à 3 effets : 35 / 35 / 34 puis `Cycle detected` | `L463` | `{"an":35,"bn":35,"cn":34}` | non | chiffres exacts |
| 26 | `batchIteration` remis à 0 après une erreur | `L75` | un effect auto-écrivant créé après un flush en erreur fait bien 102 runs | non | sinon le seuil serait consommé |
| 27 | Lire un computé invalidé **pendant** le batch ne consomme pas la file de drainage | `L737-749` | `["e:A:a","mid:A:T","e:A:T"]` : l'effet tourne à la sortie du batch | non | un computé ne s'empile PAS dans la file ; il pose les drapeaux et prévient par un parcours |

---

# `untracked(fn)`

| # | Comportement | Localisation `src/index.ts` | Observé (résultat du probe) | Documenté ? | Quirk figé |
|---|---|---|---|---|---|
| 1 | Aucune dépendance suivie dans le callback | `L126-141` | effect lisant `a.value` et `untracked(() => b.value)` : `b=1` puis `b=2` ne relancent pas, `a=1` relance | oui (README, CHANGELOG 1.4.0) | — |
| 2 | Restaure le contexte en fin de callback, même imbriqué | `L127`,`L138` | `["a=0","o=0","deep o=0","o2=0","a=1","o=1","deep o=1","o2=1"]` | oui (CHANGELOG 1.6.0) | — |
| 3 | Restaure le contexte après une exception | `L135-140` | `["a=0","caught","a2=0","a=1","caught","a2=1"]` | non | `finally` |
| 4 | N'empêche pas les écritures | `L136` | effect : `["a=0","after=99","a=99","after=99"]` (auto-notification) | non | — |
| 5 | Retourne la valeur du callback | `L136` | `untracked(() => 42) === 42`, une `Promise` est renvoyée telle quelle | oui (JSDoc) | — |
| 6 | Équivalent exact de `peek()` pour les lectures | `L449-451` | effect : `["0/0","2/1"]` | oui (CHANGELOG 1.14.2) | — |
| 7 | Ne désactive pas le rafraîchissement d'un computed lu | `L757` | `untracked(() => c.value)` : l'effet ne re-tourne pas, le computed garde sa valeur périmée | non | lire ≠ invalider |
| 8 | Effet créé dans `untracked` : indépendant du parent | `L131-134`,`L902-905` | effect parent lisant `a` : 2 runs du parent → **2** effets internes créés, chacun lancé **une** fois (`inner: 2`) | partiellement (CHANGELOG 1.14.4) | les effets internes ne re-tournent pas avec le parent |
| 9 | Effet créé dans `untracked` **hors factory** : rien à posséder | `L134` | effet « loose » exécuté, jamais disposé par un modèle ultérieur | non | — |
| 10 | `capturedEffects` neutralisé puis restauré | `L128`,`L132-134`,`L139` | un `createModel` imbriqué dans le `untracked` capture **ses** effets, le parent ne les possède pas | oui (CHANGELOG 1.14.4, cité dans le JSDoc `L118-121`) | le JSDoc est la seule source |
| 11 | Capture restaurée après une exception | `L135-140` | `["owned"]` : l'effet suivant de la factory est bien possédé | non | — |
| 12 | Effet créé dans un computé lu sous `untracked` : possédé | `L902` | `["owned:0","owned:1"]` | non | la capture est replantée après `stopCapturingEffects` |
| 13 | `untracked` est utilisé en interne pour `peek`, `watched`, `unwatched` et les callbacks `subscribe` | `L394`,`L419`,`L431`,`L450` | une lecture de signal dans `watched` n'abonne pas | non | 4 usages internes |

---

# `action(fn)`

| # | Comportement | Localisation `src/index.ts` | Observé (résultat du probe) | Documenté ? | Quirk figé |
|---|---|---|---|---|---|
| 1 | `batch(untracked(fn))` | `L991-993` | 2 écritures → un seul run : `["e:0","e:12"]` | oui (CHANGELOG 1.13.0) | — |
| 2 | Retourne la valeur de `fn` | `L992` | `action(() => "ret")() === "ret"`, une `Promise` traverse | oui | — |
| 3 | Transmet les arguments | `L991` | `action((a,b) => a+b)(1,2) === 3` | oui | `length === 0` malgré 2 params |
| 4 | Transmet `this` (appel membre) | `L991` | `{ n: 5, run: action(function(){ return this.n }) }` → `obj.run() === 5` | non | — |
| 5 | `this` = sloppy global / `undefined` si détaché | `L991-992` | CJS : `this === globalThis` ; ESM : `this === undefined` | non | dépend du module consommateur |
| 6 | Le wrapper est nommé `"actionWrapper"` | `L991` | `f.name === "actionWrapper"`, `f.length === 0` | non | — |
| 7 | Lecture non suivie (untracked) | `L992` | effect lisant `read.value` puis appelant l'action qui lit `read` : 1 run | oui (« untracked ») | — |
| 8 | Actions imbriquées : un seul flush | `L991-993` | `["e:0","e:12"]` | non | grâce au `L96-98` |
| 9 | L'erreur traverse, le flush a lieu | `L991-993` | `["e:0","e:1","caught:x"]` | non | — |
| 10 | Écriture déclenchée depuis un effect : flush différé à la fin de l'effect | `L991-993` vs `L851` | `["d2:0","d1:0","d1:1","d2:9"]` | non | le batch de l'action s'imbrique dans celui de l'effect |
| 11 | Pas de `brand`, pas de `Signal` | `L988-994` | `"brand" in f === false`, `Object.getPrototypeOf(f) === Function.prototype` | non | — |
| 12 | Effet créé dans une `action` pendant une factory : **non possédé** | `L131-134` | après `model[Symbol.dispose]()`, l'effet continue : `["in-action e:0","owned e:0","from method e:0",\|dispose\|,"in-action e:1","from method e:1"]` | oui (CHANGELOG 1.14.4), **non** dans le README | le CHANGELOG dit « untracked **and** action » ; le README n'en dit rien |
| 13 | Effet créé dans une `action` **appelée plus tard** (méthode) : non possédé | `L902-905` | idem, `"from method e:1"` survit au dispose | non | trivial mais à figer |

---

# `createModel(factory)`

| # | Comportement | Localisation `src/index.ts` | Observé (résultat du probe) | Documenté ? | Quirk figé |
|---|---|---|---|---|---|
| 1 | Retourne une fonction-constructeur, appelable avec ou sans `new` | `L1092` | `new M(1).s.value === 1` et `M(1).s.value === 1` | oui (README utilise `new`) | appel sans `new` toléré au runtime |
| 2 | L'instance est l'objet brut de la factory, muté en place | `L1109` | `inst === shared`, `shared.inc.name` passe de `"inc"` à `"actionWrapper"` après `new M()` | non | mutation du closure de la factory |
| 2b | **BRANCHE** — L'instance est l'objet brut de la factory, muté en place | `L1109` | `inst === shared`, `shared.inc.name` passe de `"inc"` à `"actionWrapper"` après `new M()` | non | mutation du closure de la factory |
| 3 | `instanceof M` faux, `constructor === Object` | `L1092-1122` | `isM: false`, `ctorName: "Object"`, `instanceof Object: true` | non | le CHANGELOG 1.13.0 parle de « classe » |
| 4 | Toutes les fonctions own énumérables sont wrappées | `L1076-1081` | `inst.inc.name === "actionWrapper"`, `this` conservé (`inc() === inst`) | oui (CHANGELOG 1.13.0/1.14.1) | — |
| 4b | **BRANCHE** — Toutes les fonctions own énumérables sont wrappées | `L1076-1081` | `inst.inc.name === "actionWrapper"`, `this` conservé (`inc() === inst`) | oui (CHANGELOG 1.13.0/1.14.1) | — |
| 5 | Récursion dans les objets imbriqués | `L1081-1084` | `inst.nested.deep.inc.name === "actionWrapper"` | oui (CHANGELOG 1.14.1) | — |
| 5b | **BRANCHE** — Récursion dans les objets imbriqués | `L1081-1084` | `inst.nested.deep.inc.name === "actionWrapper"` | oui (CHANGELOG 1.14.1) | — |
| 6 | Descend aussi dans les tableaux | `L1077` | `createModel(() => [signal(1)])` → `Array.isArray(inst) === true`, `inst[0].brand` intact | non | — |
| 7 | Ne descend pas dans un objet `brand` (signal/computed) | `L1081` | `String(inst.nested.s.brand) === "Symbol(preact-signals)"`, valeur intacte | non | c'est ce qui protège les signaux |
| 8 | `for…in` ⇒ les méthodes de classe ne sont PAS wrappées | `L1077` | `class Foo { m(){} n = signal(1) }` → `inst.m.name === "m"` | non | prototype = non énumérable |
| 9 | Les valeurs primitives sont intactes | `L1079-1084` | `{ n: 5, str: "x", nil: null, arr: [1,2] }` inchangé | non | — |
| 10 | `Date` non touché | `L1081` | `inst.d === d` | non | — |
| 11 | Objet cyclique → `RangeError`, mutation partielle | `L1077` | `RangeError: Maximum call stack size exceeded`, `o.m.name === "actionWrapper"` après le crash | non | — |
| 11b | **BRANCHE** — Objet cyclique → `RangeError`, mutation partielle | `L1077` | `RangeError: Maximum call stack size exceeded`, `o.m.name === "actionWrapper"` après le crash | non | — |
| 12 | Un getter est évalué une seule fois | `L1077-1080` | `gets === 1`, la valeur stockée est un signal (`"brand" in inst.v`) | non | le getter devient une propriété de données |
| 13 | Effet créé dans un getter : **non possédé** | `L1109` après `L1106` | `["from getter",\|dispose\|]` puis rien | non | `wrapInAction` est hors du scope de capture |
| 14 | Arguments transmis, `this` de la factory = sloppy global / `undefined` | `L1098` | `args: [1,2]` ; `selfType: "object"` (CJS) vs `undefined` (ESM) | non | `modelFactory(...args)` est un appel simple |
| 15 | Aucune validation à l'exécution | `L1001-1009` (types seuls) | `{ anything: 42, fn: () => 1 }` accepté, `fn` wrappé | oui (CHANGELOG 1.13.0 « TypeScript validates ») | la validation est **statique uniquement** |
| 16 | Factory qui throw : les effets capturés sont perdus | `L1099-1104` | `["leaked","caught:factory boom",\|dispose\|]` : l'effet leaké survit à tout dispose | non | `capturedEffects = undefined` |
| 17 | Factory imbriquée qui throw : le parent ne récupère rien | `L1099-1104` | `["outer-leak","inner-leak","caught:inner boom"]` | non | — |
| 18 | Effets de la factory possédés et disposés | `L1096-1119` | `["e:0","e:1",\|dispose\|]`, `s=2` sans run | oui (README, CHANGELOG 1.13.0) | — |
| 19 | Effets d'un modèle imbriqué remontés au parent | `L1064-1073` | dispose du parent → les cleanups interne **et** externe tournent | non | `prevCapturedEffects.concat(capturedEffects)` |
| 20 | Modèle imbriqué créé dans `untracked` : le parent ne possède pas ses effets | `L1057-1074` | `["inner-run","outer-run"]`, seul le parent est disposé | non | — |
| 21 | Effets créés dans un `batch()` : possédés | `L95-106` (n'effle pas `capturedEffects`) | effet de la factory disposé | non | `batch` ≠ `untracked` |
| 22 | Effect créé dans un computé de la factory : non possédé (évalué après la construction) | `L902-905` | `["from computed 0","from computed 1",\|dispose\|,"from computed 2"]` | non | — |
| 23 | Effect créé dans un cleanup de dispose : non possédé, fuit | `L1111-1119` | `["run","cleanup","from-cleanup"]` | non | — |
| 24 | `model[Symbol.dispose]` est une `action` | `L1111` | `["run 0","ping","cleanup 0","run 1",\|dispose\|,"cleanup 1"]` : le cleanup du re-run précède le body, celui du dispose est le dernier | non | — |
| 25 | Dispose idempotent | `L1118` | 2 appels → 1 seul cleanup | non | `modelEffects = undefined` |
| 26 | Un cleanup qui throw **interrompt** les disposes suivants | `L1113-1115` | `["cleanup1","cleanup2 throws"]`, `err: "m boom"`, `cleanup3` jamais lancé | non | boucle `for` sans `try` |
| 27 | Un effet déjà disposé ne rejoue pas son cleanup | `L945-951` | `["cleanup",\|model dispose\|]` | non | — |
| 28 | `model[Symbol.dispose]` n'est pas énumérable | `L1111` | `Object.keys(inst)` = clés du modèle seul ; `Object.getOwnPropertySymbols(inst)` = `["Symbol(Symbol.dispose)"]` | non | — |
| 29 | Écrase un `Symbol.dispose` fourni par l'utilisateur | `L1111` | log vide : le dispose custom est perdu, silencieusement | non | — |
| 30 | Utilisable avec `using` | `L1111` | `["body","cleanup"]` | oui (README) | — |
| 31 | Deux instances : captures indépendantes | `L1092` | `["e1:1","e2:2","e1:10","e2:20"]`, dispose de A sans effet sur B | non | — |
| 32 | Signal partagé entre deux modèles : chaque modèle possède son effect | `L1096-1119` | `["e:0","e:0","e:1","e:1","e:2"]` | non | — |
| 33 | Un effet d'un modèle qui s'inscrit sur un signal externe reste possédé | `L902-905` | dispose → plus de `"sub:1"` | non | — |
| 34 | Factory qui renvoie une primitive | `L1098`,`L1109-1111` | avec `new` : le retour primitif est ignoré, l'instance est un objet vide `{}` (`Object.keys === []`, `[Symbol.dispose] === undefined`) — l'affectation est un no-op silencieux. Avec `null` : `TypeError: Cannot set properties of null` dans les deux modes. ESM strict + primitif : `TypeError: Cannot create property 'Symbol(Symbol.dispose)' on number '42'` | non | dépend de la strictness et de `new` |

---

# `Signal.prototype.subscribe(fn)`

Implémentation : un `effect` nommé `"sub"` (`L427-435`) qui lit `this.value` puis appelle
`fn(value)` sous `untracked`. Le retour est le dispositeur de l'effect.

| # | Comportement | Localisation `src/index.ts` | Observé (résultat du probe) | Documenté ? | Quirk figé |
|---|---|---|---|---|---|
| 1 | Appel **immédiat et synchrone** à l'abonnement | `L428-434` | `["got 0","after subscribe","got 1"]` | non | le premier appel précède la ligne suivante |
| 2 | Le retour est le disposeur de l'effect, pas une fonction d'abonnement dédiée | `L428` | `unName === "bound "`, `unLength === 0`, `Object.keys(un) === []`, `Symbol.dispose in un === true` | non | — |
| 3 | Re-notifié à chaque changement de valeur | `L937-943` | `["got 0","got 1"]` | non | — |
| 4 | Après désabonnement : plus rien | `L945-951` | `s=2` sans log | non | — |
| 5 | Double désabonnement sans effet | `L945-951` | `["v:0"]` | non | idempotent |
| 6 | Le callback n'est pas suivi | `L431` | `b=1;b=2` ne notifient pas ; le `a=5` suivant lit `b === 2` | oui (CHANGELOG 1.2.0 « subscribe unexpectedly tracking ») | — |
| 7 | Les écritures du callback sont batchées | `L431` | `["sub 0 b now 0","sub 1 b now 2"]` | non | — |
| 8 | Exception au premier appel : `subscribe` throw, aucun retour | `L971-976` | `{"threw":"sub boom","ran":1}` | non | même chemin que `effect()` |
| 9 | Exception plus tard : remontée depuis l'écriture | `L65-70` | `["sub:0","sub:1","caught:later boom","sub:2"]` — l'effet **survit** | non | asymétrie 1ᵉʳ run / re-run |
| 10 | `this` du callback ≠ l'effet | `L431` | `typeof this === "object"`, `this instanceof Effect === false` (CJS : `globalThis`; ESM : `undefined`) | non | contraire au callback d'`effect` |
| 11 | Le callback reçoit exactement 1 argument | `L431` | `arguments.length === 1` | non | — |
| 12 | Effet interne nommé `"sub"` | `L433` | `s._targets._target.name === "sub"` (internes) | non | seule voie pour observer `EffectOptions.name` en pratique |
| 13 | `subscribe` dans un effect n'ajoute pas la source à l'effect parent | `L431` | `["sub:0","sub:0"]` : l'effect ne re-tourne pas sur `a` | non | — |
| 14 | `subscribe` dans un computé : l'effect interne suit la source | `L428-434` | `["sub0","sub1"]` | non | — |
| 15 | `subscribe` sous `untracked` fonctionne normalement | `L431` | `["v0","v1"]` | non | — |
| 16 | `subscribe` dans une factory de modèle : l'effect est possédé | `L902-905` | dispose du modèle → `s=1` ne notifie plus | non | — |
| 17 | Ordre avec plusieurs abonnés | `L385-399`,`L937-943` | `["1:0","2:0","1:1","2:1","2:2"]` | non | ordre de création |
| 18 | Utilisable avec `using` | `L980` | `["v0","body","v1"]`, `s=2` après le bloc | non | — |

---

# Conversions : `toString`, `toJSON`, `valueOf`, `brand`

| # | Comportement | Localisation `src/index.ts` | Observé (résultat du probe) | Documenté ? | Quirk figé |
|---|---|---|---|---|---|
| 1 | `toString()` = `this.value + ""` | `L441-443` | `signal(42).toString() === "42"`, `signal(10n) === "10"`, `signal(null) === "null"`, `signal({a:1}) === "[object Object]"` | non | concaténation JS, pas de formatage |
| 2 | `toString()` sur un `Symbol` throw | `L441-443` | `TypeError: Cannot convert a Symbol value to a string` | non | le message vient de V8 |
| 3 | Aucun `Symbol.toPrimitive` | `L441-447` | `signal(1)[Symbol.toPrimitive] === undefined` | non | `"${s}"` passe par `toString` ; `s * 2` par `valueOf` |
| 4 | `toString()` **suit** la dépendance | `L442` | dans un effect, 2 runs | non | `peek()` ne le ferait pas |
| 5 | `valueOf()` = `this.value` | `L437-439` | `s * 2 === 14`, `s + "" === "7"` | oui (CHANGELOG 1.2.0) | — |
| 6 | `valueOf()` suit la dépendance | `L438` | 2 runs | non | — |
| 7 | `toJSON()` = `this.value` | `L445-447` | `signal({a:1}).toJSON()` = l'objet ; `JSON.stringify({s: signal(5)}) === '{"s":5}'` | oui (CHANGELOG 1.3.0) | — |
| 8 | `toJSON()` suit la dépendance | `L446` | 2 runs | non | — |
| 9 | Les conversions propagent l'erreur d'un computed | `L437-447`,`L761-763` | `toString`/`valueOf`/`toJSON`/`peek` throw `"boom"` | non | aucune n'`untracked` |
| 10 | `toString`/`valueOf`/`toJSON`/`peek` sont des méthodes de prototype énumérables | `L437-451` | descripteurs `{writable:true, enumerable:true, configurable:true}` | non | — |
| 11 | `brand` = `Symbol.for("preact-signals")` sur `Signal.prototype` | `L3`,`L379` | `typeof s.brand === "symbol"`, `String(...) === "Symbol(preact-signals)"`, identique sur `computed` | oui (CHANGELOG 1.5.0) | — |
| 12 | `brand` est énumérable et **inscriptible** | `L379` | descripteur `{writable:true, enumerable:true, configurable:true}` ; `s.brand = "x"` fonctionne | non | un signal peut perdre son identité |
| 13 | `brand` est hérité, pas une prop d'instance | `L379` | `Object.getOwnPropertyNames(signal(1))` ne contient pas `brand` | non | — |
| 14 | `JSON.stringify(signal)` renvoie la valeur, pas l'objet | `L445-447` | `"5"` ; imbriqué : `JSON.stringify({a:[signal(1),{b:signal(2)}]})` = `'{"a":[1,{"b":2}]}'` | non | récursion sans garde |
| 15 | `s + ""` suit la dépendance | `L437-443` | dans un effect, 2 runs | non | passe par `valueOf` puis `toString` |

---

# `dispose` et `Symbol.dispose`

| # | Comportement | Localisation `src/index.ts` | Observé (résultat du probe) | Documenté ? | Quirk figé |
|---|---|---|---|---|---|
| 1 | `effect()` retourne `_dispose.bind(effect)` | `L979` | `{type:"function", name:"bound ", length:0}` | oui (README) | — |
| 2 | `Symbol.dispose` est la **même fonction** que le dispositeur | `L980` | `d[Symbol.dispose] === d`, `Symbol.dispose in d === true` | oui (CHANGELOG 1.11.0) | — |
| 3 | `using` déclenche le cleanup | `L980` | `["run","body","cleanup"]` | oui (CHANGELOG 1.11.0) | — |
| 4 | `subscribe` renvoie aussi un disposeur `Symbol.dispose` | `L428` | `hasSymbolDispose: true` | non | — |
| 5 | **`Symbol.dispose` absent ⇒ la clé devient la chaîne `"undefined"`** | `L980` | Sur le bundle réel dans un realm où `Symbol.dispose` est absent : `Object.getOwnPropertyNames(d)` = `["length","name","undefined"]`, `Object.getOwnPropertySymbols(d)` = `[]`, `typeof d["undefined"] === "function"`. Même pour un modèle : `["a","m","undefined"]`. | non | `Symbol.dispose` est non-configurable sur Node 24 ; vérifié en remplaçant le global `Symbol` du bundle, et l'équivalent `({})[undefined] = f` donne bien `Object.getOwnPropertyNames(o) === ["undefined"]` |
| 6 | `dispose()` est idempotent | `L945-955` | 3 appels → 1 cleanup | non | — |
| 7 | `dispose()` pendant le run : cleanup immédiat | `L848-850` | `["run:0","cleanup:0"]` | oui (CHANGELOG 1.2.0) | passe par `endEffect` |
| 8 | `dispose()` d'un effet en file : sauté au flush | `L62` | `["d1:0","d2:0","d1:1"]` | non | — |
| 9 | `dispose()` détache toutes les dépendances | `L826-838` | `s._targets === undefined` | oui (README) | — |
| 10 | `Effect.prototype.dispose` et `Effect.prototype._dispose` existent tous deux | `L945-955` | `Object.keys(Effect.prototype)` = `["_callback","_start","_notify","_dispose","dispose"]` | non | API interne exportée |
| 11 | `model[Symbol.dispose]` est une `action` | `L1111` | batché | non | — |
| 12 | `model[Symbol.dispose]` écrase un dispose utilisateur | `L1111` | silencieux | non | — |
| 13 | Le disposeur d'un modèle est un `action`, donc `this` fonctionne aussi | `L991`,`L1111` | `inst[Symbol.dispose].name === "actionWrapper"` | non | — |
| 14 | `dispose()` d'un modèle avec cleanup qui throw s'arrête | `L1113-1115` | `cleanup3` jamais exécuté | non | — |

---

# Vérification des 15 pistes initiales

| # | Piste | Verdict | Preuve / correction |
|---|---|---|---|
| 1 | `NaN` notifie car l'égalité est `!==` ; `0` et `-0` ne notifient pas | ✅ **confirmée** | `s=NaN` → 2 runs, `_version 1` ; `0→-0` et `-0→0` → 1 run, `_version 0`. Précision : `-0 → 0` **conserve** `-0` comme valeur (l'écriture est ignorée), alors que `0 → -0` garde `0`. |
| 2 | Le flush est synchrone : l'effet s'exécute avant la fin de l'instruction | ✅ **confirmée** | `["e:0","before","e:1","after"]`. Idem en ESM et en CJS. |
| 3 | `batch` imbriqué = simple appel de `fn`, sans comptabilité supplémentaire ; seul le batch externe flush | ⚠️ **partiellement fausse** | Vrai pour le flush et la valeur de retour. Faux pour la « comptabilité » : le `batch()` imbriqué ne fait *pas* `startBatch`, mais les setters internes font toujours `startBatch`/`endBatch` ; c'est `batchDepth > 0` qui diffère le flush, et une exception dans le `batch` imbriqué ne passe pas par `try/finally` (flush plus tard, au batch externe). |
| 4 | Première exception mémorisée, drain complet, re-throw en fin de batch | ✅ **confirmée, avec 2 nuances** | (a) « première » = première **dans l'ordre de flush** (LIFO) : `["A","B","B","A","caught:EB"]`. (b) L'erreur d'effet **écrase** l'erreur du corps du `batch` : `["EFFECT"]`. |
| 5 | Erreur au premier run : l'effect est disposé, l'erreur propagée | ✅ **confirmée** | `{runs:1, dUndefined:true, targets:true, runsAfter:1}` — et `effect()` ne retourne **aucun** disposeur. `watched` puis `unwatched` sont déclenchés. |
| 6 | Erreur dans un computed : stockée dans la valeur, re-throwée à la lecture de `.value` | ✅ **confirmée, avec 3 nuances** | (a) `peek`/`toString`/`valueOf`/`toJSON` propagent aussi. (b) Le corps n'est ré-évalué qu'au prochain changement de dépendance. (c) L'effet qui la lit est **disposé** au premier run. |
| 7 | Cycle détecté à `batchIteration > 100` (sur le setter **ET** dans un computed lu pendant son propre calcul) | ⚠️ **confusion de deux mécanismes** | Setter : `batchIteration > 100` → `Error: Cycle detected` après **102 runs** d'effet (`a === 101`). Computé : le getter (`L753`) teste le flag `RUNNING`, **pas** le compteur — il throw immédiatement, même hors batch, dès la première lecture qui référence le computé en cours de calcul (auto-cycle), ou dès la relecture après invalidation (cycle indirect). Seuls le setter et l'auto-notification d'un effet sont pilotés par `batchIteration`. |
| 8 | `subscribe` notifie immédiatement, de façon synchrone, à l'abonnement | ✅ **confirmée** | `["got 0","after subscribe","got 1"]`. |
| 9 | `watched`/`unwatched` au premier/dernier abonné seulement, dans un `untracked` | ✅ **confirmée, avec un ordre** | `["a+","b+","a-","b-"]` pour 2 signaux ; pour un computed : `["c:watched","a:watched","b:watched"]` puis `["c:unwatched","a:unwatched","b:unwatched"]`. Ils sont bien sous `untracked` (les lectures qu'ils font n'abonnent pas). |
| 10 | `Computed.prototype` est une *instance* de `Signal` : `for..in` et `Object.keys` exposent des props d'instance en plus | ✅ **confirmée** | `Object.keys(computed)` = 12 clés d'instance ; `for…in` = **22** clés. Bonus non prévu : c'est un **singleton partagé**, et lire `.value` dessus throw `TypeError: this._fn is not a function` **et l'empoisonne** (`_flags 16`, 15 clés). |
| 11 | `toString()` lève sur une valeur `Symbol` ; pas de `Symbol.toPrimitive` | ✅ **confirmée** | `TypeError: Cannot convert a Symbol value to a string` ; `s[Symbol.toPrimitive] === undefined`. |
| 12 | `createModel` mute en place, `instanceof` faux, appelable sans `new`, getter `get` invoqué une fois, aucune validation | ✅ **confirmée** | `inst === shared` et `shared.inc.name` devient `"actionWrapper"` ; `isM: false`, `ctorName: "Object"` ; `M(1).s.value === 1` ; `gets === 1` ; `{anything: 42}` accepté. Nuance : la mutation en place est *partielle* si le modèle est cyclique (`RangeError`). |
| 13 | Effets créés dans un `untracked()` ou une `action()` pendant une factory : non possédés | ✅ **confirmée** | `untracked` : `["untracked e:0","owned e:0",\|dispose\|,"untracked e:1"]`. `action` : l'effet survit aussi. Documenté dans le CHANGELOG 1.14.4 et le JSDoc `L118-121`, **pas** dans le README. |
| 14 | `Symbol.dispose` absent ⇒ clé `"undefined"` | ✅ **confirmée** | Via le bundle réel dans un realm sans `Symbol.dispose` : `Object.getOwnPropertyNames(d)` = `["length","name","undefined"]`, `d["undefined"]` est la fonction. Idem pour `model`. |
| 15 | `batch` avec auto-écriture : effet qui se modifie lui-même, effet qui en modifie un autre, ordre dans un graphe à 3 niveaux | ✅ **confirmée** | Soi-même : `["run:0","run:1","run:2","run:3"]` ; croisé : `["d2:0","d1:0","d1:1","d2:1","d1:1"]` ; 3 niveaux (c1→c2→e1/e2) : `["c1:1","c2:2","e1:3","e2:3"]` — les computeds se rafraîchissent **bottom-up** puis les effets, dans l'ordre inverse de notification. Ping-pong non borné : `Cycle detected` après 52/51 runs (2 effets) ou 35/35/34 (3 effets). |

## Pistes hors des 15, découvertes en cours de route

Voir la section **Zones non documentées** (60 entrées). Les plus structurantes pour la suite de tests :

- l'ordre de flush (LIFO sur la pile de notification) et la règle BFS entre itérations ;
- l'erreur d'effet qui écrase l'erreur du corps du `batch` ;
- le seuil exact de 102 runs ;
- `Computed.prototype` comme singleton empoisonnable ;
- `wrapInAction` et ses 6 trous (`for…in`, classes, cycles, `brand`, getters, primitives) ;
- la remontée des effets d'un modèle imbriqué vers le parent ;
- la fuite des effets à la construction quand la factory throw ;
- `this` en `effect` (instance `Effect`) vs `this` en `subscribe`/`action`/factory (strictness du consommateur) ;
- l'absence de setter sur `computed.value` (no-op sloppy, `TypeError` strict) ;
- le double mécanisme de détection de cycle ;
- le fast-forward 1.14.4 et ses 3 scénarios distincts.
