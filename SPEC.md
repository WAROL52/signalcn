# signalcn — Spécification technique

> **Statut :** Normative
> **Rôle :** Contrat comportemental et technique
> **Référence de compatibilité :** `@preact/signals-core@1.14.4`, version figée
> **Annexe :** [`research/baseline-1.14.4.md`](./research/baseline-1.14.4.md) — 224 comportements observables, établis par probe
> **Structure :** [`docs/architecture.md`](./docs/architecture.md) — comment le graphe est construit

## 1. Objectif

Cette spécification définit les comportements que `signalcn` DOUT exposer ainsi que les contraintes d'implémentation.

L'implémentation est indépendante et écrite en TypeScript. Elle n'a pas besoin de reproduire la structure interne de Preact. La conformité est évaluée à travers les comportements observables et la sémantique de l'API.

**Règle de lecture :** ce document est le contrat sur le **comportement**. Il ne décrit pas la structure interne, qui relève de [`docs/architecture.md`](./docs/architecture.md) — sauf les points où la structure est elle-même observable, qui sont alors normatifs ici. L'annexe est la preuve. Quand ce document dit « DOUT », l'annexe donne le résultat observé qui le prouve ; quand ce document ne dit rien, l'annexe fait foi. En cas de contradiction entre les deux, l'annexe l'emporte et le présent document doit être amendé.

## 2. Baseline de compatibilité

Référence figée :

```text
@preact/signals-core@1.14.4
```

Elle est déclarée en `devDependencies` avec une **version exacte** (pas de `^`, pas de `~`). Elle n'apparaît dans aucun artefact distribué.

Toute montée de version upstream est un changement de contrat de compatibilité. Elle doit être documentée dans `ROADMAP.md` et accompagnée d'un audit des différences d'API et de comportement.

## 3. Contraintes runtime

### Obligatoire

- TypeScript comme langage source.
- Compatibilité avec des environnements JavaScript standards.
- Zéro dépendance runtime externe.
- Interdiction de toute sortie du cœur : framework, DOM, réseau, ordonnanceur asynchrone, `import()` dynamique, `require`, `eval`, `new Function`.
- Le drainage est synchrone. `setTimeout`, `queueMicrotask` et `Promise` sont donc interdits, et il n'y a rien à configurer.
- Interdiction de lire l'horloge, l'aléa ou un générateur cryptographique.
- Cœur autonome.
- Comportement observable déterministe selon le présent contrat.

Ces interdits sont **vérifiés en CI**, pas affirmés. Le contrôle, sa liste de motifs et sa
justification sont spécifiés dans [`docs/zero-dependency.md`](docs/zero-dependency.md). La liste
se dérive de la baseline, qui n'utilise aucun global, aucune horloge, aucun aléa et aucune
primitive asynchrone.

### Cible

- **ES2020**, navigateurs modernes et Node 18 ou plus.
- **Modules ES uniquement.** Pas de sortie CommonJS, pas de variante globale. Un seul format à produire, tester et distribuer.

### Autorisé

- Classes internes.
- Listes chaînées, compteurs de versions, files d'attente et autres structures adaptées au suivi efficace des dépendances.
- Outils de build qui disparaissent des artefacts runtime.

## 4. API publique

La surface normative est celle de la baseline : **dix exports de valeur**.

```ts
function signal<T>(value: T, options?: SignalOptions<T>): Signal<T>
function signal<T = undefined>(): Signal<T | undefined>

function computed<T>(fn: () => T, options?: SignalOptions<T>): ReadonlySignal<T>

function effect(fn: EffectFn, options?: EffectOptions): DisposeFn

function batch<T>(fn: () => T): T

function untracked<T>(fn: () => T): T

function action<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn

function createModel<TModel, TFactoryArgs extends any[] = []>(
  modelFactory: ModelFactory<TModel, TFactoryArgs>
): ModelConstructor<TModel, TFactoryArgs>
```

Plus trois classes exportées, **constructibles et utilisables** :

```text
Signal    — new Signal(value?, options?)
Computed  — new Computed(fn, options?)
Effect    — new Effect(fn, options?)
```

### 4.1 Options

```ts
interface SignalOptions<T = any> {
  watched?: (this: Signal<T>) => void
  unwatched?: (this: Signal<T>) => void
  name?: string
}

interface EffectOptions {
  name?: string
}
```

**Il n'existe aucune option de comparaison.** La baseline n'a ni `equals`, ni `comparator`, ni `equal` : la sémantique d'égalité est fixée par le langage (voir §5.2). Passer `equals: false` est rejeté par le typage et **sans effet** à l'exécution.

### 4.2 Effet observable des options

- `SignalOptions.name` est un champ public, mutable après coup, toujours présent dans l'énumération des clés d'instance, `undefined` s'il est absent. Il est lisible dans `watched` / `unwatched` via `this.name`.
- `SignalOptions.watched` est déclenché à l'ajout du **premier** abonné. `unwatched` est déclenché à la perte du **dernier**. Les deux s'exécutent dans un `untracked` : les lectures de signal qu'ils font n'abonnent personne.
- Le `watched` d'un computed se déclenche **avant** ceux de ses sources ; `unwatched` dans l'ordre inverse.
- `EffectOptions.name` **n'a aucun effet observable via la valeur de retour de `effect()`** : la fonction retournée est une fonction liée dont `.name` vaut `"bound "`. Le nom n'est visible que sur l'instance `Effect`, donc via le constructeur exporté.

## 5. Signal

`signal(initialValue)` crée un signal modifiable.

### 5.1 Comportements obligatoires

- `.value` retourne la valeur courante ;
- l'affectation à `.value` modifie le signal et, si la sémantique d'égalité le déclenche, propage l'invalidation selon les règles du graphe ;
- une lecture dans un contexte de suivi enregistre une dépendance ;
- `.peek()` lit la valeur sans enregistrer de dépendance ; c'est exactement `untracked(() => this.value)` ;
- `subscribe(fn)` appelle `fn` **immédiatement et de façon synchrone** à l'abonnement, puis à chaque changement ; le callback s'exécute sous `untracked` et ses écritures sont batchées ; la fonction retournée est le dispositeur de l'effet interne, qui porte le nom interne `"sub"` ;
- `toString()` vaut `this.value + ""`, `valueOf()` vaut `this.value`, `toJSON()` vaut `this.value`. **Ces trois méthodes suivent la dépendance** et ne sont pas untracked. `toString()` lève sur une valeur `Symbol` ;
- il n'existe **pas** de `Symbol.toPrimitive` ;
- `brand` vaut `Symbol.for("preact-signals")` ;
- un `Signal` n'a pas de méthode `dispose` : seuls les effets sont disposibles.

`signal()` sans argument équivaut à `signal(undefined)`.

### 5.2 Sémantique d'égalité

L'égalité est une **identité stricte `!==`**, pas une identité de valeur. Conséquences normatives :

| Écriture | Notification |
|---|---|
| même primitive | **non** |
| `NaN` → `NaN` | **oui** |
| `0` → `-0` | **non** (l'écriture est ignorée, la valeur reste `0`) |
| `-0` → `0` | **non** (l'écriture est ignorée, la valeur reste `-0`) |
| objet nouveau de même forme | **oui** |
| même référence | **non** |

`Object.is` n'est **pas** utilisé. Le seuil est interne à la baseline et n'est pas un choix de conception.

### 5.3 Structure d'instance observable

`Object.keys(signal(1))` renvoie exactement, **dans cet ordre** :

```text
_value, _version, _node, _targets, _batchSnapshotVersion, _watched, _unwatched, name
```

Un `Signal` n'a pas de `_flags` : ce n'est pas un effet. Ces noms sont un contrat de compatibilité, pas une documentation — voir §21.

## 6. Computed

`computed(fn)` crée un signal en lecture seule dont la valeur dérive d'autres signaux.

Le comportement inclut :

- évaluation paresseuse : rien ne s'exécute avant la première lecture ;
- mise en cache tant que le résultat est identique par identité stricte — trois lectures consécutives donnent **une** évaluation ;
- sans abonné, une écriture d'une source **ne réveille rien** ; le recalcul a lieu à la prochaine lecture ;
- invalidation lorsqu'une dépendance change ; recalcul uniquement lorsque nécessaire ;
- collecte des dépendances pendant l'évaluation, et réconciliation des dépendances dynamiques — une dépendance abandonnée cesse de notifier, et redevient notifiante si elle est relue ;
- support des computed imbriqués ;
- détection des cycles selon §15 ;
- **impossibilité de muter** via l'API publique : le descripteur `value` n'a pas de setter. En mode strict l'affectation lève `TypeError` ; en mode sloppy elle est silencieusement ignorée.

### 6.1 Surface d'énumération

`Object.keys(computed)` expose les **douze** propriétés-own d'instance, dans l'ordre : les huit de `Signal` puis `_fn`, `_sources`, `_globalVersion`, `_flags`.

`for..in` en expose les mêmes douze. Les méthodes de prototype sont **non énumérables**, ce qui est le comportement normal d'une classe.

`signalcn` diverge ici de la baseline, qui construit `Computed.prototype` comme une instance de `Signal` — un prototype partagé, mutable et vivant — et rend ses méthodes énumérables. Voir `SPEC.md` §21.

## 7. Dépendances dynamiques

Une dérivation ne conserve que ses dépendances effectivement lues lors de son exécution courante.

```ts
const enabled = signal(true)
const a = signal(1)
const b = signal(2)

const value = computed(() => {
  return enabled.value ? a.value : b.value
})
```

Après un passage à `enabled === false`, `a` ne doit plus provoquer d'invalidation de `value` s'il n'est plus lu. Si `enabled` repasse à `true`, `a` redevient notifiant.

Ce comportement s'applique aussi aux effects. Le nœud de dépendance abandonné est **réutilisé** à la réactivation, pas recréé.

## 8. Effect

`effect(fn)` exécute une fonction réactive et retourne une fonction de dispose.

### 8.1 Comportements obligatoires

- premier run **synchrone, avant le retour** de `effect()` ;
- le callback ne reçoit aucun argument ;
- collecte des dépendances lues, re-run à chaque changement de dépendance ;
- un effect sans dépendance ne tourne qu'une fois ;
- prise en charge d'un cleanup retourné par la fonction. Une valeur de retour non-fonction est ignorée ;
- exécution du cleanup juste avant le run suivant, **et** au moment du dispose ;
- le cleanup s'exécute hors de tout contexte de suivi et lit la valeur **courante** ;
- dispose explicite, idempotent : trois appels produisent un seul cleanup ;
- suppression des abonnements actifs après dispose ;
- restauration correcte du contexte de suivi en cas d'exception.

### 8.2 Forme de la valeur de retour

La fonction retournée n'est **ni une arrow, ni l'instance `Effect`** : `name === "bound "`, `length === 0`, `Object.keys()` vide, `[Symbol.dispose]` **est la même fonction**, et elle est utilisable avec `using`.

Le mécanisme est une **fonction ordinaire qui ferme sur l'instance**, et non `_dispose.bind(effect)`. La forme liée satisfait l'identité et casse `using` : V8 refuse une fonction *liée* dont `Symbol.dispose` pointe sur elle-même, et accepte une fonction ordinaire. Le `bind` était donc le seul obstacle — `§8.3` ne demande `this` qu'au *callback*, pas au dispositeur. Aucune divergence, aucun ADR.

### 8.3 `this`

Dans le callback d'un effect, `this` est l'instance `Effect` **pour une fonction non fléchée**. Une flèche capture le `this` lexical du module et n'obtient donc pas l'instance.

### 8.4 Ordre d'exécution

- L'ordre de drainage est l'**inverse** de l'ordre de notification (§13.4).
- Le drain est en **largeur** : une chaîne de notification est vidée entièrement avant la suivante ; les effets notifiés pendant l'exécution repartent dans une nouvelle chaîne.
- Un effet disposé alors qu'il est dans la file de drainage est **sauté silencieusement**, sans callback.
- Un effet qui écrit une dépendance qu'il lit se ré-exécute dans le même drainage.

## 9. Batch

`batch(fn)` regroupe les mutations et diffère la propagation observable jusqu'au drainage, qui est **synchrone**.

```ts
batch(() => {
  a.value = 1
  b.value = 2
})
```

### 9.1 Batches imbriqués

Un `batch` appelé alors qu'un `batch` est déjà ouvert n'incrémente pas la profondeur : il se comporte comme un simple appel de `fn`. **Seul le batch le plus externe draine.**

Précision normative : l'absence de comptabilité supplémentaire porte sur le drainage et sur la valeur de retour, **pas** sur le `try`/`finally`. Les setters internes ouvrent et ferment toujours leur propre portée ; et une exception dans un batch imbriqué **ne** passe pas par un `finally` local — elle remonte au batch externe, qui draine puis re-throw.

Un batch imbriqué propage la valeur de retour du callback. Trois niveaux d'imbrication produisent un seul drainage. Un batch sans écriture ne draine pas.

### 9.2 Erreurs

`batch` fait remonter l'erreur de son corps **mais draine quand même**. La profondeur de batch est restaurée, même après une exception. Le compteur de drainages est remis à zéro après une erreur.

### 9.3 Coalescence

Écrire plusieurs fois la même valeur dans un batch ne produit qu'une notification. Un effet notifié deux fois ne tourne qu'une fois par drainage. Le cas `A → B → A` dans un batch est traité par réconciliation de snapshots (§13.5).

### 9.4 Cas obligatoires de test

- batch simple ;
- batches imbriqués, dont trois niveaux ;
- plusieurs écritures ;
- lecture après écriture à l'intérieur d'un batch ;
- computed lu pendant le batch ;
- drainage après sortie du batch extérieur ;
- exception dans le callback, avec drainage quand même ;
- batch imbriqué dont le callback lève, rattrapé par l'extérieur ;
- valeur de retour de `batch()`, y compris imbriquée.

## 10. Untracked

`untracked(fn)` exécute une lecture sans ajouter les signaux consultés aux dépendances du contexte réactif extérieur.

```ts
const user = signal("Rolio")
const level = signal("debug")

effect(() => {
  console.log(user.value, untracked(() => level.value))
})
```

L'effect dépend de `user` mais pas de `level`.

Le contexte précédent est restauré même lorsqu'une exception est levée, par un `finally`. `untracked` **n'empêche pas** les écritures, et **ne désactive pas** le rafraîchissement d'un computed lu.

`untracked` a un second effet : il neutralise la portée de capture d'effets d'un `createModel` englobant, puis la restaure. Un effet créé dans un `untracked` au sein d'une fabrique de modèle **n'appartient pas** au modèle (§16.4).

## 11. Subscription

Les subscriptions publiques respectent la sémantique de la baseline :

- appel **immédiat et synchrone** du callback à l'abonnement, avant la ligne suivante ;
- notification à chaque changement de valeur ;
- le callback reçoit exactement un argument, la valeur courante ;
- le callback n'est pas suivi : les lectures qu'il fait n'abonnent personne, et ses écritures sont batchées ;
- un `subscribe` appelé dans un effect **n'ajoute pas** la source à l'effect parent ;
- le désabonnement est idempotent, et plus aucune notification n'a lieu ensuite ;
- une exception au premier appel fait thrower `subscribe` et ne retourne rien ; une exception plus tard remonte depuis l'écriture et **l'effet survit** ;
- le dispositeur retourné porte lui aussi `Symbol.dispose`.

## 12. Nettoyage et dispose

Tout abonnement ou effect ayant une opération de dispose doit pouvoir être nettoyé de manière déterministe.

Observations normatives :

- un cleanup qui **lève** dispose l'effet, y compris en plein drainage, et l'erreur est propagée ; un cleanup qui lève **interrompt** la boucle de dispose d'un modèle, les modèles suivants n'étant pas disposés ;
- un cleanup qui lit le signal dont dépend l'effet ne le réabonne pas, mais lit la valeur post-écriture ;
- les écritures faites dans un cleanup sont **différées** si le dispose a lieu pendant un drainage, **immédiates** s'il a lieu hors drainage ;
- un cleanup qui lève ne casse pas le contexte de suivi.

Les tests doivent vérifier :

- dispose avant toute nouvelle propagation ;
- dispose après plusieurs reruns ;
- dispose répété ;
- dispose pendant une propagation ;
- cleanup lors d'un rerun ;
- cleanup lors du dispose ;
- cleanup qui lève, et son effet sur les disposes suivants.

## 13. Graphe réactif

Le moteur doit prendre en charge au minimum :

### 13.1 Chaîne

```text
A → B → C → Effect
```

### 13.2 Diamant

```text
    A
   / \
  B   C
   \ /
    D
    |
  Effect
```

### 13.3 Dépendances dynamiques

```text
       condition
        /     \
       A       B
        \     /
        computed
```

### 13.4 Ordre de drainage

**Normatif.** La file d'effets différés est une **pile** :

- trois signaux distincts écrits dans un batch produisent l'ordre inverse des écritures : `["C:1","B:1","A:1"]` ;
- plusieurs effets sur le **même** signal sortent dans l'ordre de création : `["d4:1","d3:1","d2:1","d1:1"]` ;
- le drain entre deux drainages est en largeur.

Ce sont **deux règles distinctes**. Les confondre produit une suite qui passe sur les graphes simples et échoue sur les graphes réels.

### 13.5 Réconciliation de batch

Écrire `A → B → A` à l'intérieur d'un batch n'oblige pas les aval à se recalculer : les nœuds qui ont vu la version pré-batch sont advanced d'un cran.

**Le fast-forward ne s'applique qu'aux nœuds ayant vu la version pré-batch.** Une lecture paresseuse pendant le batch suffit à faire perdre cet avantage : le cas `A → B → A` **avec** lecture intermédiaire fait tourner l'effet une seconde fois, avec la valeur revertie. Le snapshot n'est enregistré que pendant le corps du `batch` utilisateur : une écriture faite par un effect pendant le drainage n'y entre pas.

### 13.6 Assertions obligatoires

- absence de notifications en double ;
- absence de recalcul inutile ;
- propagation correcte ;
- cohérence des compteurs d'évaluations — un computed invalidé puis relu sans abonné **réévalue** et intègre les écritures ;
- ordre observable conforme à §13.4 ;
- aucune dépendance croisée entre effets d'un même effect : un effect créé dans un effect est indépendant et non possédé.

## 14. Valeurs limites

La suite doit couvrir au minimum :

```text
undefined
null
NaN
0
-0
false
true
strings
BigInt
objects
arrays
functions
symbols
```

Comportement normatif, dérivé de la baseline et non de l'intuition :

- `NaN` **notifie** quand on écrit `NaN` ;
- `0` et `-0` sont indiscernables : l'écriture de l'un sur l'autre est **ignorée** et la valeur précédente est conservée ;
- `toString()` sur un `Symbol` lève `TypeError` ;
- `JSON.stringify(signal(5))` vaut `"5"` ; `JSON.stringify(signal(undefined))` vaut `undefined` ;
- `Object.keys(signal)` et `{...signal}` exposent les propriétés internes (§5.3).

## 15. Erreurs et cycles

### 15.1 Deux mécanismes distincts

L'auto-rentrée et la borne de drainage reposent sur **deux mécanismes**, et non un — et un seul des
deux détecte quoi que ce soit :

- le **compteur de drainages**, armé depuis le setter ;
- le flag `RUNNING` sur un computed en cours d'évaluation, indépendant du compteur. Lire un computed pendant son propre calcul lève immédiatement, même hors batch.

### 15.2 Borne de drainage

Ce mécanisme est une **limite de débit**, pas une reconnaissance : rien n'inspecte le graphe, et rien ne distingue une vraie boucle d'une chaîne légitime d'effets. Reconnaître exactement un cycle serait indécidable — un effet qui réécrit une valeur légèrement différente est un schéma légitime.

Le prix : une cascade légitime assez longue atteint la borne, et le moteur lève alors qu'aucun cycle n'existe. Une chaîne de 150 effets, chacun lisant le précédent et écrivant le suivant, lève `Error: Cycle detected` — aucun nœud ne se relit. Le message nomme donc « Cycle » un graphe qui n'en contient pas ; c'est celui de la baseline, et §15.4 ne fige pas la chaîne.

Le contrat est donc : **une oscillation asynchrone se termine par une `Error`, dans un nombre borné de drainages.** La borne elle-même est un paramètre d'implémentation, et son compte n'est pas figé. La baseline utilise cent drainages, ce qui produit une erreur après cent-deux exécutions d'effet ; un ping-pong de deux effets donne 52 / 51 exécutions, à trois effets 35 / 35 / 34.

Un cycle **borné** ne lève pas : `if (v < 50) a = v + 1` produit 51 exécutions sans erreur.

### 15.3 Type de l'erreur

`Cycle detected` est un `Error`, pas un `TypeError`.

### 15.4 Ce qui est figé, et ce qui ne l'est pas

**Le type** de l'erreur et **le moment** où elle est levée sont contractuels, et doivent être testés.

**Le message** ne l'est pas. Les tests n'assertent jamais la chaîne. La minification réécrit les chaînes, et figer `"Cycle detected"` produirait une garantie que `signals.min.js` ne peut pas tenir.

### 15.5 Asymétrie premier run / re-run

- une erreur au **premier** run dispose l'effet, propage, et **`effect()` ne retourne aucun dispositeur** — la valeur de retour est `undefined`. `watched` puis `unwatched` sont tous deux déclenchés ;
- une erreur à un **re-run** laisse l'effet **vivant**, et il s'exécutera de nouveau.

### 15.6 Drain et hiérarchie des erreurs

- la **première erreur mémorisée est la première rencontrée dans l'ordre de drainage**, pas la première chronologique ;
- le drain est **complet** : les effets sans erreur tournent malgré l'erreur d'un pair ;
- l'erreur est re-throwée depuis le setter si l'écriture a eu lieu hors batch, et depuis le `batch` sinon ;
- **l'erreur d'un effet écrase l'erreur du corps du `batch`**, y compris en cas d'imbrication.

### 15.7 Erreurs de computed

- l'erreur est mémorisée dans la valeur et re-throwée à la lecture de `.value` ;
- elle est re-throwée **aussi** par `peek`, `toString`, `valueOf` et `toJSON` ;
- le corps n'est évalué qu'une fois, et **la même instance** d'`Error` est re-throwée tant qu'aucune écriture n'a eu lieu ;
- après une écriture de la dépendance, le corps est réévalué, et l'erreur est soit remplacée, soit le computed redevient valide.

### 15.8 Autres

`Out-of-order effect` existe mais est **inatteignable par l'API publique** : il n'est atteignable qu'en appelant deux fois le `finish` renvoyé par `Effect.prototype._start`, c'est-à-dire en manipulant la classe exportée directement. Le cœur doit le produire dans ce cas.

## 16. `createModel()`

`createModel()` est **inclus dans le contrat v1**. La baseline l'expose depuis la 1.13.0 et son comportement est le plus richi de toute la surface.

### 16.1 Construction

La fonction retournée est appelable **avec ou sans `new`** au runtime, bien que le typage exige `new`. **L'objet retourné par la fabrique est l'instance**, muté en place : il n'est ni enveloppé, ni proxyfié. `instanceof` est donc **faux**, et `constructor` vaut `Object`.

### 16.2 Enveloppement en `action`

Toutes les fonctions **own énumérables** du modèle sont enveloppées en `action`, récursivement dans les objets imbriqués et les tableaux. `this` est préservé lors de l'appel.

- l'enveloppement s'appuie sur `for…in` : les **méthodes de classe ne sont pas enveloppées**, le prototype n'étant pas énumérable ;
- il ne descend pas dans un objet portant `brand` — c'est ce qui protège les signaux — et ne touche ni `null` ni les primitives. Un `Date` reste la même référence ;
- un objet **cyclique** produit un `RangeError`, l'objet ayant été **partiellement** muté avant le crash ;
- les **getters sont invoqués une seule fois**, et leur résultat est réassigné comme propriété de données. Un getter qui renvoie un signal le fait entrer dans le modèle.

### 16.3 Validation

La validation est **uniquement de niveau TypeScript**. À l'exécution, aucune propriété n'est contrôlée : `{ anything: 42, fn: () => 1 }` est accepté et `fn` est enveloppé.

### 16.4 Propriété des effets

Les effets créés pendant la construction de la fabrique sont **possédés** par le modèle et disposés par `model[Symbol.dispose]()`.

Est-ce qui **n'est pas** possédé, et qui doit donc être figé par test :

- un effet créé dans un `untracked()` ou dans une `action()` englobante ;
- un effet créé dans un **getter** de la fabrique, l'enveloppement ayant lieu hors de la portée de capture ;
- un effet créé dans un **computed** de la fabrique, évalué après la construction ;
- un effet créé dans un **cleanup** de dispose ;
- les effets d'un **modèle imbriqué**, qui sont remontés dans la propriété du parent.

Si la fabrique lève, les effets capturés sont perdus : ils survivent à tout dispose ultérieur.

### 16.5 Dispose

`model[Symbol.dispose]` est un `action`, donc il batche les disposes, les cleanups étant drainés dans l'ordre, un par un.

- il **écrase** silencieusement un `Symbol.dispose` fourni par l'utilisateur ;
- il n'est pas énumérable : `Object.keys` ne le contient pas, `Object.getOwnPropertySymbols` contient exactement `Symbol(Symbol.dispose)` ;
- il est **idempotent** ;
- si `Symbol.dispose` est absent du runtime, la clé de propriété posée devient la chaîne littérale `"undefined"` — ce qui est le cas du dispositeur retourné par `effect()` et par `subscribe()` ;
- une fabrique qui renvoie une primitive se comporte différemment selon le mode : avec `new`, le retour primitif est ignoré et l'instance est un objet vide ; avec `null`, `TypeError`.

### 16.6 Écarts par rapport à la baseline

`createModel` est le seul export qui a une logique propre, donc le seul où la structure n'est
pas dictée par la compatibilité. Sept écarts y sont assumés, tous couverts par
[ADR-0005](docs/adr/0005-defauts-non-figes-de-createmodel.md) et détaillés dans
[`docs/architecture.md`](docs/architecture.md) §11 à §14.

| Écart | Effet observable |
|---|---|
| Le veto qui protège les signaux compare la **valeur** de `brand`, pas son nom. | Un objet métier portant une propriété `brand` est enveloppé, alors que la baseline l'ignore silencieusement. Un signal et un computed portent le vrai symbole, donc restent protégés : §16.2 tient. |
| L'enveloppe ne parcourt que les **clés propres** énumérables. | Une propriété héritée énumérable n'est plus enveloppée ni recopiée comme propriété propre. Une pollution énumérable de `Object.prototype` n'atteint plus les modèles. Une pollution posée en getter ne fait plus lever `createModel`. |
| La descension consulte le **descripteur** avant d'écrire. | Un accesseur en lecture n'est jamais écrit. Un getter qui renvoie une fonction ne provoque plus de `TypeError` en mode strict, et n'est plus un no-op silencieux en sloppy. |
| Les enveloppes sont **mémoïsées**. | Deux clés pointant la même fonction partagent un wrapper, donc `model.a === model.b`. Un sous-arbre partagé n'est plus re-parcouru. |
| **`Symbol.dispose` absent ne produit aucune clé.** | Aucun modèle ne porte de propriété énumérable nommée `"undefined"`. `using` est indisponible sur un runtime sans le symbole, et c'est dit ; le désarmement explicite reste possible. |
| Une fonction **asynchrone** enveloppée déclenche un **avertissement**. | `action` reste synchrone, donc le comportement est inchangé : seule la silence disparaît. |
| **Quatre gardes** défensives. | Une fabrique qui ne renvoie pas un objet lève une `TypeError` nommée avant toute mutation, au lieu de réussir silencieusement en mode sloppy. Un `Symbol.dispose` fourni par l'utilisateur n'est plus écrasé. |

Aucun de ces écarts ne change le résultat d'un scénario de la matrice. Ils sont ajoutés à
`SPEC.md` §21.

## 17. Génération des artefacts

### 17.1 Emplacement

```text
registry/
└── default/
    ├── signals.ts          ← source de vérité
    ├── signals.test.ts     ← source de vérité
    ├── signals.js          ← généré
    ├── signals.test.js     ← généré
    ├── signals.min.js      ← généré
    └── signals.test.min.js ← généré
```

`registry.json` est à la racine du dépôt.

### 17.2 Pipeline

```text
signals.ts
  ├── build → signals.js
  └── minify → signals.min.js

signals.test.ts
  ├── build → signals.test.js
  └── minify → signals.test.min.js
```

La sortie est en **modules ES**. Les imports entre artefacts restent relatifs et doivent rester résolvables une fois les fichiers copiés dans le projet utilisateur.

Un changement manuel d'un artefact généré est interdit. La CI doit échouer si un artefact committé diffère de sa source.

**Le test minifié vise le runtime minifié.** Enchaîner `signals.test.ts → signals.test.js → signals.test.min.js` sans réécriture de l'import laisserait le test minifié importer `./signals.js`, et le runtime minifié — un artefact distribué — ne serait couvert que par des smoke tests. Le specifier est donc réécrit après minification.

**`--keep-names` est obligatoire à la minification.** Le nom du wrapper d'`action` vaut `"actionWrapper"` (§4, et la matrice de conformité le fige) ; sans ce drapeau, il devient la chaîne vide.

La chaîne complète est spécifiée dans [`docs/build.md`](docs/build.md) et justifiée dans [ADR-0006](docs/adr/0006-tsc-emet-esbuild-minifie.md).

### 17.3 Items du registry

Six items, un par artefact, chacun installable indépendamment. Les items de test déclarent une `registryDependencies` **pleinement qualifiée** vers l'item d'implémentation correspondant : un nom nu ne désigne jamais le même registre et installerait silencieusement l'homonyme d'un autre projet.

**Tous les items sont de type `registry:file`, et rien n'est transpilé à l'installation.** Un item installe le fichier tel qu'il est dans le dépôt.

C'est `tsx` dans le `components.json` du **consommateur** qui décide de l'extension installée, pas le type de fichier et pas la cible. Avec `tsx: true`, la cible est respectée à l'extension près et rien n'est transpilé : `signals.ts` et `signals.js` coexistent. Avec `tsx: false`, l'extension est imposée et les deux items convergeraient vers le même nom.

**Les items TypeScript exigent donc `"tsx": true` chez le consommateur.** Un projet `tsx: false` qui installe l'item TypeScript obtient un fichier qui échoue à la première exécution — bruyamment, et c'est voulu.

Le chemin d'import dans le README est **relatif** : `./signals.js`. Ni alias, ni `tsconfig` `paths`.

Le chemin d'installation est spécifié dans [`docs/distribution.md`](docs/distribution.md) et justifié dans [ADR-0008](docs/adr/0008-registry-file-partout-et-tsx-true-exige.md).

La distribution repose sur les adresses `owner/repo/item`, qui **n'existent pas avant `shadcn@4.10.0`**. C'est la version minimale supportée, et elle doit être déclarée à l'utilisateur.

Le plancher ne vient pas du schéma d'item, qui fonctionne jusqu'à `4.8.0` : il vient uniquement de cet adressage. La CI teste donc une **matrice de deux versions**, le plancher déclaré et la dernière connue, plus un canari non bloquant sur `latest`. La politique est spécifiée dans [`docs/distribution.md`](docs/distribution.md) §8.

## 18. Tests et couverture

L'oracle d'un test est la **baseline réelle exécutée**, jamais la prose de ce document. Un scénario produit un journal d'observables ; ce journal est comparé entre les deux implémentations.

Le runner est le module `node:test` de Node, sans dépendance. Le fichier de test est un artefact distribuable : il doit s'exécuter chez l'utilisateur sans rien installer.

### 18.1 Trois métriques

```text
Lines      = 100 %
Branches   = 100 %
Functions  = 100 %
```

Ces trois métriques sont imposées nativement par le runner, avec sortie en code d'échec :

```
node --test --experimental-test-coverage \
  --test-coverage-lines=100 \
  --test-coverage-branches=100 \
  --test-coverage-functions=100
```

Il n'existe pas de métrique « statements » distincte dans le relevé natif. L'exigence est ramenée à trois métriques : une ligne non couverte fait déjà échouer le seuil, donc la barrière réelle ne baisse pas.

La couverture doit être calculée sur le code source pertinent et non utilisée comme unique mécanisme de validation.

### 18.2 Périmètre du relevé

```text
--test-coverage-include=registry/default/**/*.ts
```

Un motif sur le répertoire, pas une liste de fichiers. Le motif est **indispensable** dès que la suite JavaScript est exécutée pour la parité : `signals.test.js` charge `signals.js`, et sans motif le seuil s'appliquerait à un artefact généré que l'on ne peut pas couvrir à la main.

Un motif borné exclut par construction `signals.js`, `signals.min.js`, `signals.test.js` et `signals.test.min.js`. Le fichier de test lui-même est déjà exclu par défaut par le runner.

### 18.3 Deux barrières, parce que l'implémentation est progressive

| Contexte | Barrière |
|---|---|
| **Pull request** | **Pas de régression** : chaque métrique est au moins égale à celle du merge-base. |
| **Release** | **100 %** sur les trois métriques. |

Le 100 % absolu est inapplicable en PR : une tranche TDD qui n'implémente que `signal()` laisserait tout le reste à zéro, ce qui décourage les petits pas — l'inverse de ce qu'un projet TDD veut. La non-régression est atteignable tranche par tranche, et le 100 % reste la barrière finale.

**La base est recalculée, jamais stockée.** Le runner natif n'a aucune notion de base, et V8 ne produit que des ranges bruts. Les trois pourcentages sont donc extraits de la ligne `all files` du rapport, dans un second `git worktree` du merge-base. Une base stockée dans un fichier committé se forge dans la même pull request qui la viole.

Au moment de la release, la même barrière passe en **100 % absolu**. Le passage du seuil est le seul changement entre une pull request et un tag.

Ce second relevé ne coûte presque rien : la suite n'a **aucune dépendance**, donc le worktree n'a rien à installer. C'est le dividende de l'arbitrage sur `node:test` sans dépendance.

### 18.4 Le code mort et les exclusions sont invisibles par construction

Le runner ne mesure que ce qui est chargé. Un fichier source jamais importé **n'apparaît nulle part** : pas de zéro pour cent, pas d'avertissement. Une exclusion `--test-coverage-exclude` est tout aussi invisible — le fichier sort simplement du rapport, et le seuil passe.

Deux gardes referment ces deux trous :

- **Code mort** : comparer les fichiers source présents sur disque aux scripts que V8 a vus pendant le relevé, et échouer si les deux ensembles diffèrent. `NODE_V8_COVERAGE` fournit cette liste de façon exploitable.
- **Exclusions artificielles** : refuser tout usage de `--test-coverage-exclude` dans le dépôt. Une exclusion ne se justifie pas ici : la couverture est mesurée sur une base de code entièrement écrite par ce projet, donc il n'y a pas de code tiers à exclure.

Aucun fichier d'exclusion n'a donc à exister : la liste des interdits tient en une ligne de recherche sur le drapeau.

## 19. Parité TypeScript / JavaScript

Le pipeline qui exécute l'ensemble de ces contrôles est spécifié dans [`docs/ci.md`](docs/ci.md).

Les comportements suivants doivent être équivalents entre :

```text
signals.ts
signals.js
signals.min.js
```

et entre :

```text
signals.test.ts
signals.test.js
signals.test.min.js
```

La version JavaScript est un artefact du TypeScript, jamais une seconde implémentation indépendante.

La minification réécrit les chaînes de diagnostic : `signals.min.js` ne reproduit pas `"Cycle detected"`. C'est cohérent avec §15.4, et cela signifie que ce qui est figé par test est le type et le moment, jamais le message.

**Chaque cible est couverte par la suite complète, pas par un smoke test.** Le test minifié cible le runtime minifié (§17.2), donc les trois versions du runtime sont soumises aux mêmes scénarios.

Une seule table de scénarios est exécutée quatre fois : contre la baseline, contre `signals.ts`, contre `signals.js` et contre `signals.min.js`. Les attentes étant identiques dans les quatre cas, « les trois cibles passent » signifie « les trois cibles sont indiscernables de la baseline ». Il n'existe pas de test de parité distinct.

**Le compte de tests est une assertion.** Le code de sortie de `node --test` est vert pour un fichier de test vide — Node compte le fichier — et pour un fichier entièrement ignoré. La parité exige donc `# pass == nombre de scénarios`, `# fail == 0` et `# skipped == 0`, le nombre de scénarios venant de la table elle-même.

**Tolérance zéro** entre les cibles. Aucune liste de divergences acceptables : une divergence est un bug de build, pas une tolérance à consigner.

La stratégie complète est spécifiée dans [`docs/parity.md`](docs/parity.md).

## 20. Contraintes d'architecture

Le cœur ne doit importer ni :

```text
React
Preact
Vue
Angular
DOM
scheduler de framework
```

Les futurs adaptateurs seront ajoutés hors du cœur :

```text
signalcn/react
signalcn/vue
signalcn/angular
```

sans changer le contrat du moteur central.

Le contrôle de zéro-dépendance runtime est spécifié dans
[`docs/zero-dependency.md`](docs/zero-dependency.md) : deux passes, un relevé de metafile qui
exige un seul fichier lu, et une recherche à chaîne fixe sur l'artefact minifié.

## 21. Divergences assumées

Les écarts suivants sont **volontaires**. Chacun est documenté ici, et aucun n'affecte le comportement observable au sens où la compatibilité le définit.

| Divergence | Raison |
|---|---|
| Les membres internes de `Effect` et `Computed` (`_fn`, `_flags`, `_notify`, `_start`, `_dispose`, `_sources`, `_nextBatchedEffect`) **ne sont pas typés**, alors qu'ils le sont dans le `.d.ts` de la baseline. | Ce sont des noms d'implémentation, dont la baseline elle-même ne garantit pas la stabilité. Aucun code applicatif ne les appelle. Les figer comme contrat reviendrait à hériter d'une fuite. |
| `EffectFn` n'est pas un type exporté nommé. | Il ne l'est pas dans la baseline. |
| Les méthodes de prototype sont **non énumérables**. `for..in` sur un signal expose 8 clés au lieu de 17, sur un computed 12 au lieu de 22. `Object.keys(Computed.prototype)` est vide au lieu de douze noms de champs. | Le comportement normal d'une classe ES2020. Aucun outil ne s'appuie sur l'énumération des méthodes. Voir [ADR-0004](docs/adr/0004-classes-es2020-plutot-que-prototypes-es5.md). |
| `Computed.prototype` **ne porte pas d'état**. Lire `.value` dessus échoue sans rien empoisonner. | La baseline en fait une instance de `Signal` : un prototype partagé dont une lecture `.value` condamne le prototype pour tous les computeds du même realm. Supprimer cet état supprime le quirk. Voir [ADR-0004](docs/adr/0004-classes-es2020-plutot-que-prototypes-es5.md). |
| `Computed.prototype.constructor` vaut `Computed`, et non `Signal`. | Conséquence directe du précédent, et un correctif : l'introspection de type par `.constructor` est juste. |
| La borne de drainage **n'est pas figée** à 102 (§15.2). | Cent est un ordre de grandeur, pas une constante sémantique. Le mécanisme est contractuel, le compte ne l'est pas. |
| Les **sept écarts de `createModel`** (§16.6). | Le veto `brand` par valeur, les clés propres, la descension par descripteur, la mémoïsation, l'absence de clé `"undefined"`, l'avertissement asynchrone, et quatre gardes. Voir [ADR-0005](docs/adr/0005-defauts-non-figes-de-createmodel.md). |

Toute divergence supplémentaire exige un ADR.

## 22. Le harnais différentiel

Aucun comportement ne peut être réputé conforme parce qu'un document le décrit. La procédure est :

1. le scénario s'exécute contre `@preact/signals-core@1.14.4` ;
2. le même scénario s'exécute contre `signals.ts` ;
3. les deux journaux sont comparés.

Un scénario qui n'est pas exécuté par le harnais différentiel n'est pas un test de conformité. C'est le harnais qui fait foi, et l'annexe n'est que la trace figée de son exécution.
