# Les décisions d'architecture

Chaque fichier est une décision : son contexte, les options écartées, ses conséquences. Les liens
vers ce répertoire — dans le ROADMAP, dans le CONTRIBUTING, dans le SPEC — ne peuvent pas nommer un
dossier sans page, sans quoi ils ne mènent nulle part une fois le dépôt publié en site.

- [ADR-0001 — Clone exact de la baseline, quirks compris](./0001-clone-exact-de-la-baseline.md)
- [ADR-0002 — `node:test` natif, aucune dépendance de test](./0002-node-test-sans-dependance-de-test.md)
- [ADR-0003 — ESM pur, sans build dual](./0003-esm-pur-sans-build-dual.md)
- [ADR-0004 — Classes ES2020 plutôt que prototypes ES5](./0004-classes-es2020-plutot-que-prototypes-es5.md)
- [ADR-0005 — Les défauts non figés de `createModel` sont corrigés](./0005-defauts-non-figes-de-createmodel.md)
- [ADR-0006 — `tsc` émet, esbuild minifie](./0006-tsc-emet-esbuild-minifie.md)
- [ADR-0007 — Deux barrières de couverture : non-régression en PR, 100 % en release](./0007-deux-barrieres-de-couverture.md)
- [ADR-0008 — `registry:file` partout, et `tsx: true` exigé du consommateur](./0008-registry-file-partout-et-tsx-true-exige.md)
- [ADR-0009 — La liste des dépendances reprend la géométrie de la baseline](./0009-geometrie-de-la-liste-des-dependances.md)
- [ADR-0010 — Un computé ne s'empile pas dans la file de drainage, et la voie rapide 2 n'exige pas de cible](./0010-une-structure-sans-justification-nest-pas-contrat.md)
- [ADR-0011 — Le reliquat de couverture : trois gardes que la référence ne peut pas atteindre non plus](./0011-reliquat-de-couverture-non-atteignable.md)