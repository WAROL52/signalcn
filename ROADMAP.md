# signalcn — Roadmap des mainteneurs

> **Usage :** document interne de suivi du développement et des releases.  
> **Règle :** une case ne doit être cochée qu'avec une preuve : test, sortie de commande, revue, commit ou décision documentée.

## 0. Tableau de bord

| Champ | Valeur |
|---|---|
| Phase actuelle | `P0 — Spécification` |
| Version de référence | `@preact/signals-core@1.14.4` |
| Dépendances runtime | `0` |
| Sources de vérité | `signals.ts`, `signals.test.ts` |
| Artefacts générés | `4` |
| Registry items | `6` |
| Objectif coverage | `100 / 100 / 100 / 100` |
| Première version stable | `v1.0.0` |
| Version actuelle | `v0.0.0` |
| Mainteneur | `À définir` |
| Dépôt | `À définir` |
| Dernière mise à jour | `À renseigner` |

## 1. Règles de travail

- [ ] `PRD.md` décrit ce que nous construisons.
- [ ] `SPEC.md` décrit précisément les comportements à respecter.
- [ ] `ROADMAP.md` est mis à jour lorsque le périmètre ou le statut change.
- [ ] Seuls `signals.ts` et `signals.test.ts` sont des sources maintenues manuellement.
- [ ] Les quatre fichiers `.js` sont reconstruits et jamais patchés à la main.
- [ ] Toute affirmation de compatibilité possède un test ou une limitation explicitement documentée.
- [ ] Aucune dépendance runtime n'est ajoutée sans décision explicite dans le PRD/SPEC.
- [ ] Aucun code spécifique à un framework ne rentre dans le cœur.

## 2. Phase P0 — Spécification et bootstrap

### Produit

- [x] Définir la vision.
- [x] Définir l'agnosticité framework.
- [x] Définir le zéro-runtime-dependency.
- [x] Définir les six artefacts indépendants.
- [x] Définir les deux sources de vérité.
- [x] Définir la génération automatique des artefacts JavaScript.
- [ ] Confirmer la disponibilité du nom `signalcn`.
- [ ] Définir le propriétaire et le nom final du dépôt GitHub.
- [ ] Choisir la licence finale.

### Compatibilité

- [x] Choisir la baseline initiale.
- [x] Figer `@preact/signals-core@1.14.4`.
- [ ] Inventorier précisément toute l'API publique de la baseline.
- [ ] Construire une matrice des comportements upstream.
- [ ] Identifier les comportements ambigus ou sous-documentés.
- [ ] Créer des probes de référence pour les comportements ambigus.
- [ ] Décider explicitement le périmètre de `createModel()`.

### Repository

- [ ] Initialiser Git.
- [ ] Ajouter `registry.json`.
- [ ] Créer `registry/default/`.
- [ ] Ajouter les métadonnées du package de développement.
- [ ] Ajouter `tsconfig.json`.
- [ ] Ajouter la configuration Vitest.
- [ ] Ajouter la configuration coverage.
- [ ] Ajouter la configuration de build.
- [ ] Ajouter la configuration de minification.
- [ ] Ajouter la CI.
- [ ] Ajouter les règles de contribution.

## 3. Phase P1 — Squelette du moteur

### Signal

- [ ] Définir le modèle interne de nœud réactif.
- [ ] Implémenter l'abstraction `Signal`.
- [ ] Implémenter `signal()`.
- [ ] Implémenter le getter `.value`.
- [ ] Implémenter le setter `.value`.
- [ ] Implémenter les sémantiques d'égalité de référence.
- [ ] Implémenter `.peek()`.
- [ ] Implémenter `subscribe()`.
- [ ] Implémenter unsubscribe.
- [ ] Implémenter les helpers de conversion requis.

### Computed

- [ ] Implémenter `computed()`.
- [ ] Implémenter l'évaluation lazy.
- [ ] Implémenter le cache.
- [ ] Implémenter l'invalidation.
- [ ] Implémenter la collecte des dépendances.
- [ ] Implémenter la réconciliation des dépendances.
- [ ] Implémenter les dépendances dynamiques.
- [ ] Implémenter le comportement read-only.
- [ ] Implémenter la détection de cycle.

### Effect

- [ ] Implémenter `effect()`.
- [ ] Implémenter l'exécution initiale.
- [ ] Implémenter le suivi des dépendances.
- [ ] Implémenter les callbacks de cleanup.
- [ ] Implémenter le disposer.
- [ ] Implémenter les effects imbriqués.
- [ ] Implémenter la réconciliation dynamique.
- [ ] Implémenter le comportement d'erreur compatible.

### Batch / untracked

- [ ] Implémenter `batch()`.
- [ ] Implémenter la profondeur des batches imbriqués.
- [ ] Implémenter la file d'effets différés.
- [ ] Implémenter le flush.
- [ ] Implémenter `untracked()`.
- [ ] Garantir la restauration du contexte après exception.

### API étendue

- [ ] Décider définitivement du périmètre de `createModel()`.
- [ ] Si retenu, implémenter `createModel()`.
- [ ] Implémenter son lifecycle/dispose.
- [ ] Implémenter les options publiques de la baseline.

## 4. Phase P2 — Suite de tests comportementaux

### Signal

- [ ] Construction.
- [ ] Lecture.
- [ ] Écriture.
- [ ] Réécriture avec même valeur.
- [ ] `undefined`.
- [ ] `null`.
- [ ] `NaN`.
- [ ] `0` et `-0`.
- [ ] Objets.
- [ ] Tableaux.
- [ ] Fonctions.
- [ ] `peek()`.
- [ ] Subscribe.
- [ ] Unsubscribe.
- [ ] Plusieurs subscribers.

### Computed

- [ ] Lazy.
- [ ] Première évaluation.
- [ ] Lecture mise en cache.
- [ ] Invalidation.
- [ ] Recalcul.
- [ ] Computed imbriqués.
- [ ] Dépendances dynamiques.
- [ ] Suppression d'une dépendance.
- [ ] Réactivation d'une dépendance.
- [ ] Graphe en diamant.
- [ ] Graphe profond.
- [ ] Propagation d'erreur.
- [ ] Détection de cycle.
- [ ] Mutation interdite.

### Effect

- [ ] Exécution initiale.
- [ ] Dépendance à un signal.
- [ ] Dépendance à un computed.
- [ ] Plusieurs dépendances.
- [ ] Dépendances dynamiques.
- [ ] Cleanup lors d'un rerun.
- [ ] Cleanup lors du dispose.
- [ ] Dispose répété.
- [ ] Effects imbriqués.
- [ ] Dispose pendant propagation.
- [ ] Gestion des erreurs.

### Batch

- [ ] Batch simple.
- [ ] Batch imbriqué.
- [ ] Plusieurs écritures.
- [ ] Lecture après écriture dans un batch.
- [ ] Lecture d'un computed dans un batch.
- [ ] Flush après le batch extérieur.
- [ ] Exception dans le batch.
- [ ] Valeur de retour.

### Untracked

- [ ] Ne crée pas de dépendance.
- [ ] Appels imbriqués.
- [ ] Restauration du contexte.
- [ ] Sécurité en cas d'exception.
- [ ] Interaction avec effect.
- [ ] Interaction avec computed.

## 5. Phase P3 — Conformité avec la référence Preact

- [ ] Préparer un harness de référence.
- [ ] Exécuter les probes contre `@preact/signals-core`.
- [ ] Porter les scénarios comportementaux applicables.
- [ ] Comparer les sorties observables.
- [ ] Comparer le nombre de notifications.
- [ ] Comparer le nombre de cleanup.
- [ ] Comparer le nombre d'évaluations.
- [ ] Comparer l'ordre de propagation lorsqu'il est observable.
- [ ] Comparer le comportement d'erreur.
- [ ] Comparer le dispose.
- [ ] Documenter toute différence intentionnelle.
- [ ] Corriger toutes les différences non intentionnelles.

### Barrière de compatibilité

- [ ] Aucune différence d'API inexpliquée.
- [ ] Aucune différence sémantique inexpliquée.
- [ ] Aucune différence d'ordonnancement inexpliquée.
- [ ] Aucune différence de cleanup inexpliquée.
- [ ] Aucune différence de dispose inexpliquée.

## 6. Phase P4 — Barrière de couverture

Objectifs obligatoires :

```text
Lines      = 100 %
Statements = 100 %
Functions  = 100 %
Branches   = 100 %
```

Checklist :

- [ ] Coverage locale = 100 % partout.
- [ ] CI bloque toute baisse.
- [ ] Aucune exclusion artificielle pour faire monter la couverture.
- [ ] Chaque branche défensive a un test ou une justification documentée.
- [ ] Les tests d'erreur sont couverts.
- [ ] Les cas limites sont couverts.

## 7. Phase P5 — Génération JavaScript

### `signals.js`

- [ ] Build à partir de `signals.ts`.
- [ ] Vérifier les imports/exports.
- [ ] Vérifier l'exécution dans un environnement JS supporté.
- [ ] Vérifier qu'aucune dépendance runtime n'est introduite.

### `signals.min.js`

- [ ] Générer depuis `signals.js` ou depuis la source via le pipeline officiel.
- [ ] Vérifier la syntaxe.
- [ ] Vérifier les exports.
- [ ] Vérifier l'équivalence comportementale.

### Tests JS

- [ ] Générer `signals.test.js` depuis `signals.test.ts`.
- [ ] Générer `signals.test.min.js`.
- [ ] Exécuter les tests JS.
- [ ] Ajouter des smoke tests pour le fichier minifié.

## 8. Phase P6 — Registry shadcn

- [ ] Définir le `registry.json` racine.
- [ ] Déclarer `signals`.
- [ ] Déclarer `signals-test`.
- [ ] Déclarer `signals-js`.
- [ ] Déclarer `signals-test-js`.
- [ ] Déclarer `signals-min`.
- [ ] Déclarer `signals-test-min`.
- [ ] Vérifier les `target`.
- [ ] Tester chaque item séparément dans un projet exemple.
- [ ] Vérifier qu'un item n'installe pas les autres.
- [ ] Vérifier les alias shadcn.
- [ ] Documenter les commandes exactes d'installation.

## 9. Phase P7 — Documentation et DX

- [ ] Finaliser `README.md`.
- [ ] Ajouter les exemples API.
- [ ] Documenter TypeScript.
- [ ] Documenter JavaScript.
- [ ] Documenter les builds minifiés.
- [ ] Documenter la politique zéro dépendance.
- [ ] Documenter la compatibilité avec Preact.
- [ ] Documenter les limitations connues.
- [ ] Ajouter guide de contribution.
- [ ] Ajouter politique de versioning.

## 10. Phase P8 — CI / Release

- [ ] CI sur chaque PR.
- [ ] Lint/typecheck.
- [ ] Tests TS.
- [ ] Coverage 100 %.
- [ ] Build JS.
- [ ] Tests JS.
- [ ] Minification.
- [ ] Vérification des artefacts générés.
- [ ] Vérification zéro dépendance runtime.
- [ ] Vérification du registry.
- [ ] GitHub release.
- [ ] Tag `v0.1.0`.

## 11. Roadmap de versions

### v0.1.0 — Fondations

- [ ] Signal core minimal.
- [ ] Architecture du graphe.
- [ ] Tests de base.
- [ ] Build TypeScript → JavaScript.
- [ ] Registry initial.

### v0.2.0 — Computed

- [ ] Lazy evaluation.
- [ ] Cache.
- [ ] Invalidation.
- [ ] Dépendances dynamiques.
- [ ] Tests de graphes.

### v0.3.0 — Effect

- [ ] Dependency tracking.
- [ ] Cleanup.
- [ ] Dispose.
- [ ] Effects imbriqués.

### v0.4.0 — Batch / Untracked

- [ ] Batching.
- [ ] Batches imbriqués.
- [ ] Queue/flush.
- [ ] `untracked()`.

### v0.5.0 — Conformité

- [ ] Suite de comparaison avec la référence.
- [ ] Cas limites.
- [ ] Erreurs et cycles.
- [ ] Parité TS/JS.

### v0.6.0 — Distribution

- [ ] Six registry items.
- [ ] Build automatique.
- [ ] Artefacts minifiés.
- [ ] Tests d'installation.

### v0.7.0 — Stabilisation

- [ ] API auditée.
- [ ] Documentation complète.
- [ ] 100 % coverage durable.
- [ ] CI de qualité.

### v0.8.0 — Release Candidate

- [ ] Aucun bug critique connu.
- [ ] Conformité documentée.
- [ ] DX validée dans plusieurs projets.
- [ ] Tests d'installation reproductibles.

### v0.9.0 — API Freeze

- [ ] Gel de l'API publique.
- [ ] Audit final du contrat.
- [ ] Dernière campagne de compatibilité.

### v1.0.0 — Stable

- [ ] API stable.
- [ ] Documentation stable.
- [ ] Registry stable.
- [ ] CI complète.
- [ ] Coverage 100 %.
- [ ] Zéro dépendance runtime.
- [ ] Release publique.

## 12. Backlog futur — après v1.0

### Adaptateurs

- [ ] `signalcn/react`
- [ ] `signalcn/vue`
- [ ] `signalcn/angular`
- [ ] Autres frameworks selon demande.

### Outillage

- [ ] Devtools éventuels.
- [ ] Utilitaires de debug.
- [ ] Benchmarks reproductibles.
- [ ] Tests de performance.

### Recherche

- [ ] Analyse des alternatives émergentes.
- [ ] Audit périodique de compatibilité Preact.
- [ ] Étude de nouvelles primitives uniquement si elles respectent le cœur minimaliste.

## 13. Journal des décisions

| Date | Décision | Motif | Impact | Auteur |
|---|---|---|---|---|
| `YYYY-MM-DD` | À renseigner | À renseigner | À renseigner | À renseigner |

## 14. Journal des releases

| Version | Date | Statut | Points clés | Notes |
|---|---|---|---|---|
| `v0.0.0` | `À renseigner` | Planifiée | Bootstrap | — |

## 15. Notes de maintenance

- Toute modification de `SPEC.md` doit être reliée à un ou plusieurs tests.
- Toute modification de la source doit régénérer les quatre artefacts JavaScript.
- Aucun artefact généré ne doit être modifié à la main.
- Toute différence avec `@preact/signals-core` doit être classée : `bug`, `différence intentionnelle`, `comportement ambigu` ou `version upstream différente`.
- Toute montée de version de la baseline upstream doit passer par une phase d'audit avant intégration.
