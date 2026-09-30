# signalcn — Roadmap des mainteneurs

> **Usage :** checklist interne du suivi d'implémentation.
> **Règle :** une case ne doit être cochée qu'avec une preuve : test, sortie de commande, revue, commit ou décision documentée.
> **Ce que ce fichier n'est pas :** ni le contrat, ni l'historique des décisions. Le contrat est
> [`SPEC.md`](./SPEC.md) ; les décisions sont dans [`docs/adr/`](./docs/adr/) ; l'état du projet est
> dans la [carte de wayfinding](https://github.com/WAROL52/signalcn/issues/1).

## 0. Tableau de bord

| Champ | Valeur |
|---|---|
| Phase actuelle | `P1 — Squelette du moteur` |
| Version de référence | `@preact/signals-core@1.14.4` |
| Dépendances runtime | `0` |
| Sources de vérité | `signals.ts`, `signals.test.ts` |
| Artefacts générés | `4` |
| Registry items | `6`, exigeant `"tsx": true` chez le consommateur |
| Objectif coverage | `100 / 100 / 100` — lignes, branches, fonctions |
| Prochaine version | `v0.1.0` |
| Version courante | `v0.0.0`, aucun tag |
| Mainteneur | `WAROL52` |
| Dépôt | `github.com/WAROL52/signalcn`, public |
| Licence | MIT, en place depuis le premier commit |
| Dernière mise à jour | `2026-09-30` |

## 1. Où lire quoi

| Question | Document |
|---|---|
| Que doit faire le cœur, exactement ? | [`SPEC.md`](./SPEC.md) |
| Comment est construit le graphe ? | [`docs/architecture.md`](./docs/architecture.md) |
| Comment s'écrit la source de vérité ? | [`docs/architecture.md`](./docs/architecture.md) §15 |
| Comment sont produits les artefacts ? | [`docs/build.md`](./docs/build.md) |
| Comment se prouve la conformité ? | [`docs/parity.md`](./docs/parity.md), [`docs/scenarios.md`](./docs/scenarios.md) |
| Comment s'installent les artefacts ? | [`docs/distribution.md`](./docs/distribution.md) |
| Que fait la CI ? | [`docs/ci.md`](./docs/ci.md) |
| Qu'est-ce qui est interdit, et comment on le vérifie ? | [`docs/zero-dependency.md`](./docs/zero-dependency.md) |
| Quelle documentation existe, et qui la garde juste ? | [`docs/documentation.md`](./docs/documentation.md) |
| Comment on écrit un scénario ? | [`docs/scenarios.md`](./docs/scenarios.md) |
| Qu'est-ce que le vocabulaire du projet ? | [`CONTEXT.md`](./CONTEXT.md) |

## 2. Règles de travail

- [x] `PRD.md` décrit ce que nous construisons.
- [x] `SPEC.md` décrit précisément les comportements à respecter.
- [x] `ROADMAP.md` est mis à jour lorsque le périmètre ou le statut change.
- [x] Seuls `signals.ts` et `signals.test.ts` sont des sources maintenues manuellement.
- [ ] Les quatre fichiers `.js` sont reconstruits et jamais patchés à la main.
- [ ] Toute affirmation de compatibilité possède un test ou une limitation explicitement documentée.
- [x] Aucune dépendance runtime n'est ajoutée sans décision explicite dans le PRD/SPEC.
- [x] Aucun code spécifique à un framework ne rentre dans le cœur.
- [ ] Aucun comportement n'est « corrigé » sans vérifié qu'aucun scénario de la matrice ne le fige.

## 3. Phase P0 — Spécification et bootstrap

### Produit

- [x] Définir la vision.
- [x] Définir l'agnosticité framework.
- [x] Définir le zéro-runtime-dependency.
- [x] Définir les deux sources de vérité.
- [x] Définir la génération automatique des artefacts JavaScript.
- [x] Confirmer la disponibilité du nom `signalcn`.
- [x] Définir le propriétaire et le nom final du dépôt GitHub.
- [x] Choisir la licence finale.
- [x] **Définir les six artefacts indépendants** — sous réserve de `"tsx": true` chez le consommateur. Sans lui, les items TypeScript et JavaScript convergent vers le même nom de fichier. Voir [`docs/distribution.md`](./docs/distribution.md) §2.

### Compatibilité

- [x] Choisir la baseline initiale.
- [x] Figer `@preact/signals-core@1.14.4`.
- [x] Inventorier précisément toute l'API publique de la baseline.
- [x] Construire une matrice des comportements upstream — 224 entrées, [`research/baseline-1.14.4.md`](./research/baseline-1.14.4.md).
- [x] Identifier les comportements ambigus ou sous-documentés — 60 entrées, aucune documentée.
- [x] Créer des probes de référence pour les comportements ambigus.
- [x] Décider explicitement le périmètre de `createModel()` — inclus dans le contrat v1.

### Repository

- [x] Initialiser Git.
- [x] Définir le propriétaire et le nom du dépôt.
- [ ] Ajouter `registry.json`.
- [ ] Créer `registry/default/`.
- [ ] Ajouter les métadonnées du package de développement.
- [ ] Ajouter `tsconfig.json`.
- [ ] Ajouter la configuration du runner — `node:test`, sans dépendance.
- [ ] Ajouter la configuration coverage.
- [ ] Ajouter la configuration de build.
- [ ] Ajouter la configuration de minification.
- [ ] Ajouter la CI.
- [ ] Ajouter les règles de contribution.

## 4. Phase P1 — Squelette du moteur

Le modèle interne est spécifié dans [`docs/architecture.md`](./docs/architecture.md). Ce qui suit est
l'implémentation.

### Signal

- [ ] Implémenter `Signal` et `signal()`.
- [ ] Implémenter le getter `.value`.
- [ ] Implémenter le setter `.value` et la sémantique d'égalité stricte.
- [ ] Implémenter `.peek()`.
- [ ] Implémenter `.subscribe()` et le désabonnement.
- [ ] Implémenter les conversions `valueOf`, `toString`, `toJSON`.
- [ ] Porter `brand` sur le prototype par fusion de déclaration.

### Computed

- [ ] Implémenter `computed()` et l'évaluation paresseuse.
- [ ] Implémenter le cache et la voie rapide par version globale.
- [ ] Implémenter l'invalidation et la réconciliation des dépendances.
- [ ] Implémenter la détection de cycle.

### Effect

- [ ] Implémenter `effect()` et le suivi des dépendances.
- [ ] Implémenter les callbacks de cleanup.
- [ ] Implémenter le disposer.
- [ ] Implémenter le flush en détachant, en largeur.

### Batch / untracked

- [ ] Implémenter `batch()` et le flush LIFO.
- [ ] Implémenter la réconciliation de snapshots.
- [ ] Implémenter `untracked()`.
- [ ] Garantir la restauration du contexte après exception.

### API étendue

- [ ] Implémenter `action()`.
- [ ] Implémenter `createModel()` — portée de capture, enveloppe en action, dispose.
- [ ] Implémenter la mémoïsation des enveloppes.

## 5. Phase P2 — Suite de tests comportementaux

Le découpage est spécifié dans [`docs/scenarios.md`](./docs/scenarios.md) : 78 scénarios pour
224 comportements, avec traçabilité obligatoire vers la matrice.

- [ ] Écrire la table de scénarios.
- [ ] Vérifier que chaque entrée de la matrice est référencée.
- [ ] Atteindre 100 % des lignes, branches et fonctions.

## 6. Phase P3 — Conformité avec la référence

- [ ] Exécuter le harnais différentiel contre `@preact/signals-core@1.14.4`.
- [ ] Porter la suite sur `signals.js`, `signals.min.js` et les tests générés.
- [ ] Vérifier le compte de scénarios sur chaque cible.
- [ ] Documenter toute différence intentionnelle — [`SPEC.md`](./SPEC.md) §21.

## 7. Phase P4 — Barrière de couverture

- [ ] Couverture locale à 100 %.
- [ ] La CI refuse toute régression par rapport au merge-base.
- [ ] La CI refuse le code mort — disque contre scripts vus par `NODE_V8_COVERAGE`.
- [ ] Aucune exclusion artificielle — le drapeau est interdit.
- [ ] Au tag, le seuil passe à 100 % absolu.

## 8. Phase P5 — Génération JavaScript

Chaîne spécifiée dans [`docs/build.md`](./docs/build.md).

- [ ] `signals.js` et `signals.test.js` par `tsc`.
- [ ] `signals.min.js` et `signals.test.min.js` par `esbuild --keep-names`.
- [ ] Réécrire le specifier du test minifié vers le runtime minifié.
- [ ] Aucun sourcemap.
- [ ] La CI échoue si un artefact committé est périmé.

## 9. Phase P6 — Registry shadcn

- [ ] Définir le `registry.json` racine — six items, `registry:file`, cible `~/`.
- [ ] Déclarer les `registryDependencies` qualifiées.
- [ ] Tester chaque item séparément dans un projet jetable.
- [ ] La porte d'installation s'exécute à chaque PR, sur une matrice de deux versions.

## 10. Phase P7 — Documentation

- [ ] Rédiger le `README.md` final — l'API n'existe pas encore.
- [ ] Corriger les trois fautes de fait relevées dans [`docs/documentation.md`](./docs/documentation.md) §5.
- [ ] Ajouter la section « Différences connues », pour l'adopter.
- [ ] Ajouter la porte qui vérifie la surface publique du README.

## 11. Phase P8 — Release

- [ ] CI complète verte.
- [ ] Couverture à 100 % au tag.
- [ ] Porte d'installation verte sur les deux versions de la CLI.
- [ ] Tag `v0.1.0` — le cœur conforme.
- [ ] Tag `v1.0.0` — la distribution complète.

## 12. Roadmap de versions

Deux versions. Les huit intermédiaires de la version précédente de ce fichier étaient un suivi
de projet, pas des cuts de release.

### v0.1.0 — Cœur conforme

Le cœur implémenté, la suite de conformité verte, 100 % de couverture, la CI bloquante. C'est
la première version publiable.

### v1.0.0 — Distribution complète

Les six items installables et vérifiés par la porte d'installation, le `README.md` final, la
documentation de compatibilité, et la porte de surface.

## 13. Journal des décisions

**Il n'y en a pas ici.** Les décisions sont dans [`docs/adr/`](./docs/adr/), avec leur contexte,
les options écartées et leurs conséquences. Les dupliquer créerait un deuxième registre, et le
registre qu'on oublie est celui qui ment.

## 14. Journal des releases

**Il n'y en a pas encore.** Le projet n'a aucun tag. Les releases sont les tags git ; leurs
notes vivent avec eux.