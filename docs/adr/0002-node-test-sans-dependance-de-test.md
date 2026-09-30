# `node:test` natif, aucune dépendance de test

La suite s'exécute avec le module `node:test` et `node:assert` de Node, et la couverture vient du relevé natif du runner avec ses seuils opposables. Aucun runner tiers n'est installé.

## Considered Options

- **Vitest** — refusé. `PRD.md` le prévoyait initialement. Mais `signals.test.ts` est un **artefact distribuable** : l'utilisateur qui fait `shadcn add signalcn/signals-test` doit pouvoir l'exécuter sans adopter une dépendance dans son projet. Le coût est une couverture à trois métriques au lieu de quatre, ce qui ne affaiblit pas la barrière : une ligne non couverte échoue déjà.
- **Vitest au développement, `node:test` dans l'artefact** — refusé. Deux runners, deux syntaxes, deux Adoption.

## Consequences

- `SPEC.md` §18 est ramené à trois métriques : `lines`, `branches`, `functions`. Il n'y a pas de « statements » distincte dans le relevé natif.
- L'outillage de couverture, de build et de minification reste libre : il ne s'exécute que dans le dépôt mainteneur.
- Le seuil est posé par des drapeaux de CLI, ce qui rend la barrière auto-portante et lisible dans la commande de test.
