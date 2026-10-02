# Technique

Le contrat de comportement, l'architecture du graphe, les décisions et leurs raisons.

- [`SPEC.md`](/SPEC.md) — le contrat normatif de comportement, et l'annexe qui en est la preuve.
- [`architecture.md`](./architecture.md) — comment le graphe est construit.
- [`zero-dependency.md`](./zero-dependency.md) — le contrôle de zéro-dépendance.
- [`CONTEXT.md`](/CONTEXT.md) — le glossaire du domaine.
- [`docs/adr/`](/docs/adr/) — le raisonnement derrière les décisions, y compris les divergences.

`SPEC.md`, `CONTEXT.md` et `docs/adr/` sont à la racine du dépôt : ils sont épinglés par
`docs/agents/domain.md` et cités par quatre portes, donc le site les publie sans les déplacer.
