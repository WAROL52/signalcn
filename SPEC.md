# signalcn — Spécification technique

> **Statut :** Brouillon / Normative  
> **Rôle :** Contrat comportemental et technique  
> **Référence de compatibilité :** `@preact/signals-core@1.14.4`

## 1. Objectif

Cette spécification définit les comportements que `signalcn` DOIT exposer ainsi que les contraintes d'implémentation.

L'implémentation est indépendante et écrite en TypeScript. Elle n'a pas besoin de reproduire la structure interne de Preact. La conformité est évaluée à travers les comportements observables et la sémantique de l'API.

## 2. Baseline de compatibilité

Référence initiale :

```text
@preact/signals-core@1.14.4
```

La version de référence doit être figée dans l'outillage du dépôt avant d'accepter la première suite de conformité.

Toute montée de version upstream est un changement de contrat de compatibilité. Elle doit être documentée dans `ROADMAP.md` et accompagnée d'un audit des différences d'API et de comportement.

## 3. Contraintes runtime

### Obligatoire

- TypeScript comme langage source.
- Compatibilité avec des environnements JavaScript standards.
- Zéro dépendance runtime externe.
- Aucun import de framework.
- Aucune dépendance obligatoire au DOM.
- Interdiction de `eval`, `new Function` ou équivalent pour générer du code dynamiquement.
- Cœur autonome.
- Comportement observable déterministe selon le présent contrat.

### Autorisé

- Classes internes.
- Listes chaînées, compteurs de versions, files d'attente et autres structures adaptées au suivi efficace des dépendances.
- Outils de build qui disparaissent des artefacts runtime.

## 4. API publique

Surface initiale visée :

```ts
signal<T>(value?: T, options?: SignalOptions<T>): Signal<T>
computed<T>(fn: () => T, options?: SignalOptions<T>): ReadonlySignal<T>
effect(fn: EffectFn, options?: EffectOptions): () => void
batch<T>(fn: () => T): T
untracked<T>(fn: () => T): T
```

L'API doit également couvrir les types/classes publics et les comportements correspondants de la baseline, notamment les inspections, subscriptions, conversions et mécanismes de dispose pertinents.

`createModel()` fait partie du périmètre v1 uniquement si son comportement est retenu après inventaire précis de la baseline. Sa présence ou son exclusion doit être explicitement documentée.

## 5. Signal

`signal(initialValue)` crée un signal modifiable.

Comportements obligatoires :

- `.value` retourne la valeur courante ;
- l'affectation à `.value` modifie le signal selon la sémantique d'égalité de référence ;
- une lecture dans un contexte de suivi enregistre une dépendance ;
- une écriture propage l'invalidation selon les règles du graphe ;
- `.peek()` lit la valeur sans enregistrer de dépendance ;
- les subscriptions publiques respectent le contrat de référence.

Exemple :

```ts
const count = signal(0)

count.value // 0
count.value = 1
count.value // 1

count.peek() // 1, sans suivi de dépendance
```

## 6. Computed

`computed(fn)` crée un signal en lecture seule dont la valeur dérive d'autres signaux.

Le comportement doit inclure :

- évaluation lazy ;
- mise en cache ;
- invalidation lorsqu'une dépendance pertinente change ;
- recalcul uniquement lorsque nécessaire ;
- collecte des dépendances pendant l'évaluation ;
- réconciliation des dépendances dynamiques ;
- support des computed imbriqués ;
- détection des cycles selon le comportement de référence ;
- impossibilité de muter le computed via son API publique.

Exemple :

```ts
const firstName = signal("John")
const lastName = signal("Doe")

const fullName = computed(
  () => `${firstName.value} ${lastName.value}`
)
```

## 7. Dépendances dynamiques

Une dérivation ne doit conserver que ses dépendances effectivement lues lors de son exécution courante.

Exemple :

```ts
const enabled = signal(true)
const a = signal(1)
const b = signal(2)

const value = computed(() => {
  return enabled.value ? a.value : b.value
})
```

Après un passage à `enabled === false`, `a` ne doit plus provoquer d'invalidation de `value` s'il n'est plus lu.

Ce comportement doit également être vérifié pour les effects.

## 8. Effect

`effect(fn)` exécute une fonction réactive et retourne une fonction de dispose.

Comportements obligatoires :

- exécution initiale selon la baseline ;
- collecte des dépendances lues ;
- rerun lorsque les dépendances changent ;
- prise en charge d'un cleanup retourné par la fonction ;
- exécution du cleanup au moment défini par la référence ;
- dispose explicite ;
- suppression des abonnements actifs après dispose ;
- restauration correcte du contexte de suivi en cas d'exception.

Exemple :

```ts
const count = signal(0)

const dispose = effect(() => {
  console.log(count.value)
})

dispose()
```

Après `dispose()`, la modification de `count` ne doit plus déclencher cet effect.

## 9. Batch

`batch(fn)` regroupe les mutations et diffère la propagation observable jusqu'au point de flush défini par la référence.

Exemple :

```ts
batch(() => {
  a.value = 1
  b.value = 2
})
```

Les batches imbriqués doivent être gérés correctement. Le batch extérieur reste responsable du flush final lorsque le comportement de référence l'exige.

Cas obligatoires de test :

- batch simple ;
- batches imbriqués ;
- plusieurs écritures ;
- lecture après écriture à l'intérieur d'un batch ;
- computed lu pendant le batch ;
- flush après sortie du batch extérieur ;
- exception dans le callback ;
- valeur de retour de `batch()`.

## 10. Untracked

`untracked(fn)` exécute une lecture sans ajouter les signaux consultés aux dépendances du contexte réactif extérieur.

Exemple :

```ts
const user = signal("Rolio")
const level = signal("debug")

effect(() => {
  console.log(user.value, untracked(() => level.value))
})
```

L'effect dépend de `user` mais pas de `level`.

Le contexte précédent doit être restauré même lorsqu'une exception est levée.

## 11. Subscription

Les subscriptions publiques doivent respecter la sémantique de la baseline :

- abonnement ;
- notification ;
- désabonnement ;
- comportement avec plusieurs subscribers ;
- comportement lors d'une propagation ;
- absence de notification après désabonnement lorsque la référence l'exige.

## 12. Nettoyage et dispose

Tout abonnement ou effect ayant une opération de dispose doit pouvoir être nettoyé de manière déterministe.

Les tests doivent vérifier :

- dispose avant toute nouvelle propagation ;
- dispose après plusieurs reruns ;
- dispose répété ;
- cleanup lors d'un rerun ;
- cleanup lors du dispose ;
- dispose pendant une propagation, lorsque ce cas est applicable.

## 13. Graphe réactif

Le moteur doit prendre en charge au minimum :

### Chaîne

```text
A → B → C → Effect
```

### Diamant

```text
    A
   / \
  B   C
   \ /
    D
    |
  Effect
```

### Dépendances dynamiques

```text
       condition
        /     \
       A       B
        \     /
        computed
```

Les tests doivent vérifier :

- absence de notifications en double ;
- absence de recalcul inutile ;
- propagation correcte ;
- cohérence des compteurs d'évaluation ;
- ordre observable lorsque celui-ci fait partie du contrat.

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
objects
arrays
functions
symbols, si supportés par la cible
```

Pour `NaN`, `0` et `-0`, le comportement attendu doit être dérivé explicitement de la baseline et figé par un test.

## 15. Erreurs et cycles

Les erreurs observables doivent être testées, notamment :

- mutation interdite pendant un computed lorsqu'elle fait partie du contrat ;
- détection de cycles ;
- exceptions utilisateur dans computed ;
- exceptions utilisateur dans effect ;
- restauration correcte du contexte après exception.

Les messages d'erreur ne doivent être considérés comme contractuels que s'ils font partie de la surface officiellement retenue. Sinon, seul le type et le comportement doivent être exigés.

## 16. `createModel()`

`createModel()` est hors implémentation définitive tant que l'inventaire de la baseline n'est pas finalisé.

S'il est inclus dans v1, sa signature, ses mutations, ses actions, son lifecycle et son dispose doivent être documentés ici avant implémentation.

## 17. Génération des artefacts

Sources :

```text
signals.ts
signals.test.ts
```

Artefacts générés :

```text
signals.js
signals.test.js
signals.min.js
signals.test.min.js
```

Règle :

```text
signals.ts
  ├── build → signals.js
  └── minify → signals.min.js

signals.test.ts
  ├── build → signals.test.js
  └── minify → signals.test.min.js
```

Un changement manuel d'un artefact généré est interdit.

## 18. Tests et couverture

La CI doit refuser toute baisse sous :

```text
Lines      = 100 %
Statements = 100 %
Functions  = 100 %
Branches   = 100 %
```

La couverture doit être calculée sur le code source pertinent et non utilisée comme unique mécanisme de validation.

## 19. Parité TypeScript / JavaScript

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
