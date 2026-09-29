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
- Couverture de test cible : 100 % statements, branches, functions et lines.

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
  signal,
  computed,
  effect,
  batch,
  untracked,
} from "@/lib/signals"

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

Le cœur est centré sur :

```text
signal()
computed()
effect()
batch()
untracked()
```

Il prend également en charge les comportements publics associés à la baseline de compatibilité : types de signal, `peek()`, subscriptions, cleanup/dispose et autres mécanismes retenus dans `SPEC.md`.

La spécification normative complète se trouve dans [`SPEC.md`](./SPEC.md).

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

Toute évolution de la version de référence doit être traitée comme un changement de contrat et documentée dans `ROADMAP.md`.

## Zéro dépendance runtime

Le code installé dans une application ne dépend d'aucun package runtime externe.

Les dépendances utilisées par le dépôt pour développer, tester, compiler et minifier le projet restent des dépendances de développement et ne sont pas injectées dans le runtime distribué.

## Couverture de test

Le projet impose :

```text
100 % statements
100 % branches
100 % functions
100 % lines
```

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
├── vitest.config.ts
├── README.md
├── PRD.md
├── SPEC.md
└── ROADMAP.md
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

- [`PRD.md`](./PRD.md) — vision, objectifs, périmètre et contraintes produit.
- [`SPEC.md`](./SPEC.md) — contrat comportemental et technique.
- [`ROADMAP.md`](./ROADMAP.md) — suivi interne de l'implémentation et des releases.

## Statut

Le projet est en phase de spécification et de construction initiale. La baseline de compatibilité et les règles de distribution sont fixées ; l'implémentation du moteur et la suite de conformité restent à réaliser.
