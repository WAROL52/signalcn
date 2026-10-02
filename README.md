# signalcn

> Signaux réactifs agnostiques de framework pour JavaScript et TypeScript vanilla.

`signalcn` est un moteur de signaux réactifs inspiré de `@preact/signals-core`, mais conçu comme une bibliothèque **indépendante de tout framework** et distribuée comme du code source via un **GitHub Registry shadcn**.

Il n'y a pas de package npm runtime à installer.

## Caractéristiques

- TypeScript comme source de vérité.
- JavaScript généré automatiquement.
- Zéro dépendance runtime.
- Aucun React, Preact, Vue ou Angular dans le cœur.
- Aucun DOM requis.
- Installation uniquement via la CLI shadcn.
- Chaque artefact est installable indépendamment.
- Compatibilité comportementale visée avec `@preact/signals-core@1.14.4` comme baseline initiale.
- Couverture mesurée sur **trois métriques** : lignes, branches, fonctions.

## Installation

| Artefact | Fichier installé | npm | pnpm | bun |
| --- | --- | --- | --- | --- |
| TypeScript | `signals.ts` | `npx shadcn@latest add WAROL52/signalcn/signals` | `pnpm dlx shadcn@latest add WAROL52/signalcn/signals` | `bunx --bun shadcn@latest add WAROL52/signalcn/signals` |
| Tests TypeScript | `signals.test.ts` | `npx shadcn@latest add WAROL52/signalcn/signals-test` | `pnpm dlx shadcn@latest add WAROL52/signalcn/signals-test` | `bunx --bun shadcn@latest add WAROL52/signalcn/signals-test` |
| JavaScript généré | `signals.js` | `npx shadcn@latest add WAROL52/signalcn/signals-js` | `pnpm dlx shadcn@latest add WAROL52/signalcn/signals-js` | `bunx --bun shadcn@latest add WAROL52/signalcn/signals-js` |
| Tests JavaScript générés | `signals.test.js` | `npx shadcn@latest add WAROL52/signalcn/signals-test-js` | `pnpm dlx shadcn@latest add WAROL52/signalcn/signals-test-js` | `bunx --bun shadcn@latest add WAROL52/signalcn/signals-test-js` |
| JavaScript minifié | `signals.min.js` | `npx shadcn@latest add WAROL52/signalcn/signals-min` | `pnpm dlx shadcn@latest add WAROL52/signalcn/signals-min` | `bunx --bun shadcn@latest add WAROL52/signalcn/signals-min` |
| Tests JavaScript minifiés | `signals.test.min.js` | `npx shadcn@latest add WAROL52/signalcn/signals-test-min` | `pnpm dlx shadcn@latest add WAROL52/signalcn/signals-test-min` | `bunx --bun shadcn@latest add WAROL52/signalcn/signals-test-min` |

Chaque item est indépendant. L'installation de l'un n'installe pas les cinq autres.

## Utilisation de base

```ts
import {
  Signal,
  Computed,
  Effect,
  signal,
  computed,
  effect,
  batch,
  untracked,
  action,
  createModel,
} from "./signals.js"
```

Le chemin d'import est **relatif** et il l'est volontairement : ni alias, ni `paths` de
`tsconfig`, ni paquet. Le fichier installé est un fichier, et un chemin d'import qui demande une
configuration est un fichier que le projet consommateur n'a pas à connaître.

```ts
const count = signal(0)

const doubled = computed(() => count.value * 2)

const dispose = effect(() => {
  console.log("count:", count.value)
  console.log("doubled:", doubled.value)
})

batch(() => {
  count.value = 1
  count.value = 2
})

dispose()
```

## Deux exigences, et leurs raisons

| Exigence | Raison |
|---|---|
| `"tsx": true` dans le `components.json` | C'est ce drapeau qui décide de l'extension installée. Les items TypeScript arrivent en `.ts` seulement avec lui ; sans lui, l'extension est imposée et le fichier installé contient du TypeScript sous un nom `.js` — il échoue bruyamment à la première exécution. |
| `shadcn` **`4.10.0`** ou plus récent | L'installation se fait par adresse `owner/repo/item`, et cet adressage n'existe pas avant cette version. Un plancher plus bas produirait une commande qui ne résout rien. |

Ces deux exigences sont mesurées, pas supposées : la porte d'installation les éprouve à chaque
pull request sur deux versions de la CLI, et le canari surveille la dernière version publiée.

`untracked()` permet de lire un signal sans en faire une dépendance du contexte réactif courant :

```ts
const user = signal("Rolio")
const level = signal("debug")

effect(() => {
  console.log(
    user.value,
    untracked(() => level.value),
  )
})
```

## API principale

Le cœur expose dix exports :

```text
signal()      computed()   effect()      batch()      untracked()
action()      createModel()
Signal        Computed     Effect
```

Il prend en charge les comportements publics associés à la baseline de compatibilité : `peek()`,
`subscribe()`, `peek()` sur un abonnement, cleanup/dispose, `using` et le reste des mécanismes
retenus dans [`SPEC.md`](./SPEC.md), qui reste normatif.

`peek()` est sur le prototype d'un signal, donc il est énumérable et inscriptible — c'est un
comportement de la baseline, et il fait partie du contrat.

La spécification normative complète se trouve dans [`SPEC.md`](./SPEC.md).

## Différences connues

Si vous migrez depuis `@preact/signals-core`, voici ce qui vous surprendra. Ce sont des **effets
observables**, pas des raisons : les raisons restent dans les décisions, où elles ont leur place,
et une raison dans un README devient une excuse qu'on lit sans la comprendre.

Aucun de ces écarts ne change le résultat d'un scénario comportemental. Ils changent ce qu'on peut
faire **autour** du moteur — énumérer, introspecter, ou construire un objet qui porte un `brand`.

### Sur les classes

- **`for..in` sur un signal expose 8 clés, pas 17. Sur un computé, 12, pas 22.** Les méthodes de
  prototype sont non énumérables, comme dans toute classe ES2020.
- **`Object.keys(Computed.prototype)` est vide**, là où la référence en expose douze.
- **`Computed.prototype.constructor` vaut `Computed`**, pas `Signal`.
- **Lire `.value` sur `Computed.prototype` échoue**, et ne condamne pas le prototype pour tous les
  computés du même realm. Si votre code fait cette lecture pour détecter le type, il verra une
  erreur au lieu d'un poison global.
- Les membres internes de `Effect` et `Computed` (`_fn`, `_flags`, `_notify`, `_start`, `_dispose`,
  `_sources`) sont typés sur des structures internes, et `Node` n'est pas exporté.
- **`EffectFn` n'est pas un type exporté nommé.**

### Sur les cycles

- **Une auto-cycle dans un effet s'arrête à 102 runs ; ce nombre n'est pas figé.** Le mécanisme
  s'arrête, le compte ne l'est pas : ne construisez pas de test qui l'affirme.

### Sur `createModel`

C'est le seul export dont la structure n'est pas dictée par la compatibilité, donc le seul qui en
a. Sept écarts, tous sur la *forme* du modèle, jamais sur le comportement de ce qu'il contient :

- **Un objet métier qui porte une propriété `brand` est enveloppé**, là où la référence
  l'ignore. Un signal et un computé portent le vrai symbole, donc restent protégés — mais un
  objet qui a sa propre notion de `brand` change de traitement.
- **Seules les clés propres énumérables sont parcourues.** Une propriété héritée énumérable n'est
  ni enveloppée, ni recopiée. Une pollution énumérable de `Object.prototype` n'atteint plus vos
  modèles.
- **Un accesseur en lecture n'est jamais écrit.** Un getter qui renvoie une fonction ne lève plus
  de `TypeError` en mode strict.
- **Deux clés pointant la même fonction partagent un wrapper** : `model.a === model.b`. Un
  sous-arbre partagé n'est pas reparcouru.
- **`Symbol.dispose` absent ne crée aucune clé.** Aucun modèle ne porte de propriété nommée
  `"undefined"`. Sur un runtime sans le symbole, `using` est indisponible — c'est dit ; le
  désarmement explicite reste possible.
- **Une fonction asynchrone enveloppée déclenche un avertissement.** Le comportement reste
  synchrone ; c'est le silence qui disparaît.
- **Quatre gardes défensives.** Une fabrique qui ne renvoie pas un objet lève une `TypeError`
  nommée avant toute mutation, au lieu de réussir silencieusement. Un `Symbol.dispose` fourni par
  vous n'est plus écrasé.

## Sources et artefacts générés

Deux fichiers sont maintenus manuellement :

```text
signals.ts
signals.test.ts
```

Tous les autres fichiers sont générés :

```text
signals.js
signals.test.js
signals.min.js
signals.test.min.js
```

Pipeline :

```text
signals.ts
   ├── build ─────> signals.js
   └── minify ────> signals.min.js

signals.test.ts
   ├── build ─────> signals.test.js
   └── minify ────> signals.test.min.js
```

Les artefacts générés ne doivent jamais être modifiés manuellement.

## Compatibilité

La baseline initiale est :

```text
@preact/signals-core@1.14.4
```

Le but est d'obtenir une compatibilité de comportement observable, et non de copier le code source upstream.

Toute évolution de la version de référence doit être traitée comme un changement de contrat et documentée dans `site/contributeurs/ROADMAP.md`.

## Zéro dépendance runtime

Le code installé dans une application ne dépend d'aucun package runtime externe.

Les dépendances utilisées par le dépôt pour développer, tester, compiler et minifier le projet restent des dépendances de développement et ne sont pas injectées dans le runtime distribué.

## Couverture de test

Le contrat porte sur **trois métriques**, et sur trois seuils opposables :

```text
lignes
branches
fonctions
```

Le seuil de release est **la valeur mesurée** : `99 / 98 / 100`. Ce n'est pas 100, et la raison
tient en une phrase — **les trois branches restantes sont des gardes que la bibliothèque de
référence ne sait pas atteindre non plus**, dont une morte par construction dans son propre code.
Les atteindre supposerait de changer le comportement, donc de casser la promesse du projet. Elles
sont nommées ligne par ligne dans
[`docs/adr/0011-reliquat-de-couverture-non-atteignable.md`](docs/adr/0011-reliquat-de-couverture-non-atteignable.md).

Sur une pull request, la barrière est de toute façon l'**absence de régression** face au
merge-base — base recalculée sur place, jamais stockée. Une base stockée dans un fichier se forge
dans la pull request même qui la viole.

Deux trous qu'aucun pourcentage ne voit sont gardés à part : un fichier source jamais chargé par
la suite, et une exclusion de couverture posée dans le dépôt. Les deux sont interdits.

La couverture ne remplace pas les tests comportementaux. La suite doit également vérifier les graphes de dépendances, les dépendances dynamiques, les batches, les cleanup/dispose, les cycles et les erreurs.

## Structure du dépôt

```text
signalcn/
├── registry.json
├── registry/
│   └── default/
│       ├── signals.ts
│       ├── signals.test.ts
│       ├── signals.js
│       ├── signals.test.js
│       ├── signals.min.js
│       └── signals.test.min.js
├── package.json
├── tsconfig.json
├── README.md
├── SPEC.md
├── CONTEXT.md
└── site/
    ├── utilisateurs/
    ├── technique/
    └── contributeurs/
```

## Philosophie du projet

`signalcn` cherche à rester petit, explicite et prévisible.

Le cœur ne doit pas devenir dépendant d'un framework. Les intégrations futures seront traitées séparément :

```text
signalcn
├── core
├── signalcn/react   ← futur
├── signalcn/vue     ← futur
└── signalcn/angular ← futur
```

## Documentation

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — **pour contribuer** : les portes, et les quatre pièges qui mordent sans prévenir.
- [`PRD.md`](site/contributeurs/PRD) — vision, objectifs, périmètre et contraintes produit.
- [`SPEC.md`](./SPEC.md) — contrat comportemental et technique.
- [`ROADMAP.md`](site/contributeurs/ROADMAP) — suivi interne de l'implémentation et des releases.

## Statut

Le moteur est implémenté et la suite de conformité est complète : les dix exports sont couverts
par une table de scénarios rejouée contre la baseline réelle, et les portes de couverture, de
parité et d'installation sont en place. Ce qui reste ouvert est dans [`ROADMAP.md`](site/contributeurs/ROADMAP).
