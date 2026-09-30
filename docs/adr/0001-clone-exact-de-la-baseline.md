# Clone exact de la baseline, quirks compris

`signalcn` reproduit le comportement observable de `@preact/signals-core@1.14.4` **y compris ses bugs**, au lieu de les corriger. L'égalité est donc une identité stricte `!==` — `NaN` notifie, `0` et `-0` ne notifient pas —, l'ordre de flush est LIFO, et le seuil de cycle est de 102 exécutions. Chaque quirk est figé par un test.

## Considered Options

- **Corriger les bugs upstream** — refusé. Le cas d'usage visé est de remplacer `@preact/signals-core` par `signals.ts` dans une application existante. « Corriger » une notification de trop ou un flush dans le mauvais ordre revient à introduire un bug chez celui qui migre, pour un comportement qu'il ne savait pas débusquer.
- **Réécrire la sémantique pour être plus intuitive** — refusé, pour la même raison.

## Règle opératoire

> Un défaut de la baseline est reproduit **sauf** si la matrice de conformité a observé un
> comportement qui en dépend. La garantie, c'est elle, pas l'implémentation.

Voir [ADR-0005](./0005-defauts-non-figes-de-createmodel.md) pour son application sur
`createModel`, la seule surface où la règle tranche réellement.

## Consequences

- Le code contient des expressions qui ressemblent à des erreurs et ne le sont pas. Elles portent un commentaire pointant vers l'entrée correspondante de l'annexe.
- Une montée de version de la baseline devient un changement de contrat, pas un simple bump : elle exige son propre audit, conformément à `SPEC.md` §2.
- Les ADR servent à documenter les divergences d'**API** (`SPEC.md` §21), jamais à réécrire la sémantique.
