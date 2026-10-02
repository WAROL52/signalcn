# signalcn — Roadmap des mainteneurs

> **Usage :** checklist interne du suivi d'implémentation.
> **Règle :** une case ne doit être cochée qu'avec une preuve : test, sortie de commande, revue, commit ou décision documentée.
> **Ce que ce fichier n'est pas :** ni le contrat, ni l'historique des décisions. Le contrat est
> [`SPEC.md`](./SPEC.md) ; les décisions sont dans [`docs/adr/`](./docs/adr/) ; l'état du projet est
> dans la [carte de wayfinding](https://github.com/WAROL52/signalcn/issues/1).

## 0. Tableau de bord

| Champ | Valeur |
|---|---|
| Phase actuelle | **`v1.0.0` taggée.** P0 a P8 livrées ; restent quatre cases de couverture |
| Version de référence | `@preact/signals-core@1.14.4` |
| Dépendances runtime | `0` |
| Sources de vérité | `signals.ts`, `signals.test.ts` |
| Référent de la matrice | **le paquet installé**, pas ses sources — marqueur dans `COUVERTURE`, raison au [§21](SPEC.md) |
| Artefacts générés | `4` |
| Registry items | `6`, exigeant `"tsx": true` chez le consommateur |
| Couverture mesurée | `99,61 / 98,50 / 100,00` — lignes, branches, fonctions |
| Seuil de release | La valeur mesurée, **pas 100 %** — [ADR-0011](docs/adr/0011-reliquat-de-couverture-non-atteignable.md) : les trois reliquats sont des gardes que la référence ne sait pas atteindre non plus |
| Prochaine version | **aucune** — les deux tags sont posés, et la ligne du dessous dit laquelle |
| Version courante | `v1.0.0`, tags `v0.1.0` et `v1.0.0` |
| Mainteneur | `WAROL52` |
| Dépôt | `github.com/WAROL52/signalcn`, public |
| Licence | MIT, en place depuis le premier commit |
| Dernière mise à jour | `2026-10-02` |

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
- [x] Les quatre fichiers `.js` sont reconstruits et jamais patchés à la main.
- [x] Toute affirmation de compatibilité possède un test ou une limitation explicitement documentée.
- [x] Aucune dépendance runtime n'est ajoutée sans décision explicite dans le PRD/SPEC.
- [x] Aucun code spécifique à un framework ne rentre dans le cœur.
- [x] Aucun comportement n'est « corrigé » sans vérifié qu'aucun scénario de la matrice ne le fige.

## 3. Phase P0 — Spécification et bootstrap

> **Preuve** — `ls registry.json registry/default tsconfig.json package.json .github/workflows`.

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
- [x] Construire une matrice des comportements upstream — 231 entrées, [`research/baseline-1.14.4.md`](./research/baseline-1.14.4.md).
- [x] Identifier les comportements ambigus ou sous-documentés — 60 entrées, aucune documentée.
- [x] Créer des probes de référence pour les comportements ambigus.
- [x] Décider explicitement le périmètre de `createModel()` — inclus dans le contrat v1.

### Repository

- [x] Initialiser Git.
- [x] Définir le propriétaire et le nom du dépôt.
- [x] Ajouter `registry.json`.
- [x] Créer `registry/default/`.
- [x] Ajouter les métadonnées du package de développement.
- [x] Ajouter `tsconfig.json`.
- [x] Ajouter la configuration du runner — `node:test`, sans dépendance.
- [x] Ajouter la configuration coverage.
- [x] Ajouter la configuration de build.
- [x] Ajouter la configuration de minification.
- [x] Ajouter la CI.
- [x] Ajouter les règles de contribution — [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## 4. Phase P1 — Squelette du moteur

> **Preuve** — `npm test` : 98 tests, 0 échec. Les dix exports sont dans `signals.ts`.
> Le cœur est complet ; `P1` n'attend plus rien.

Le modèle interne est spécifié dans [`docs/architecture.md`](./docs/architecture.md). Ce qui suit est
l'implémentation.

### Signal

- [x] Implémenter `Signal` et `signal()`.
- [x] Implémenter le getter `.value`.
- [x] Implémenter le setter `.value` et la sémantique d'égalité stricte.
- [x] Implémenter `.peek()`.
- [x] Implémenter `.subscribe()` et le désabonnement.
- [x] Implémenter les conversions `valueOf`, `toString`, `toJSON`.
- [x] Porter `brand` sur le prototype par fusion de déclaration.

### Computed

- [x] Implémenter `computed()` et l'évaluation paresseuse.
- [x] Implémenter le cache et la voie rapide par version globale.
- [x] Implémenter l'invalidation et la réconciliation des dépendances.
- [x] Implémenter l'auto-rentrée et la borne de drainage.

### Effect

- [x] Implémenter `effect()` et le suivi des dépendances.
- [x] Implémenter les callbacks de cleanup.
- [x] Implémenter le disposer.
- [x] Implémenter le drainage en détachant, en largeur.

### Batch / untracked

- [x] Implémenter `batch()` et le drainage LIFO.
- [x] Implémenter la réconciliation de snapshots.
- [x] Implémenter `untracked()`.
- [x] Garantir la restauration du contexte après exception.

### API étendue

- [x] Implémenter `action()`.
- [x] Implémenter `createModel()` — portée de capture, enveloppe en action, dispose.
- [x] Implémenter la mémoïsation des enveloppes.

## 5. Phase P2 — Suite de tests comportementaux

> **Preuve** — `npm run harnais` : 82 scénarios, 203 entrées de matrice, 5/5 tests
> `signalcn-seul` rejoués sur le paquet installé.
> **La case « 100 % » reste ouverte** : la couverture mesurée est `99,61 / 98,50 / 100,00`.
> Le reliquat est decide par [ADR-0011](docs/adr/0011-reliquat-de-couverture-non-atteignable.md),
> pas par renoncement.

Le découpage est spécifié dans [`docs/scenarios.md`](./docs/scenarios.md) : 82 scénarios pour
231 comportements, avec traçabilité obligatoire vers la matrice.

- [x] Écrire la table de scénarios.
- [x] Vérifier que chaque entrée de la matrice est référencée.
- [ ] Atteindre 100 % des lignes, branches et fonctions.

## 6. Phase P3 — Conformité avec la référence

> **Preuve** — `npm run harnais` puis `npm run parite` : 16 assertions, la table entière
> passe sur la baseline, la source, le build et le minifié.
> Les divergences sont au [§21](SPEC.md), et la porte de documentation refuse qu'une entrée
> non confrontable y soit omise.

- [x] Exécuter le harnais différentiel contre `@preact/signals-core@1.14.4`.
- [x] Porter la suite sur `signals.js`, `signals.min.js` et les tests générés.
- [x] Vérifier le compte de scénarios sur chaque cible.
- [x] Documenter toute différence intentionnelle — [`SPEC.md`](./SPEC.md) §21.

## 7. Phase P4 — Barrière de couverture

> **Preuve** — `npm run couverture` : seuils natifs, garde du code mort contre
> `NODE_V8_COVERAGE`, non-régression recalculée dans un worktree du merge-base.
> **Les deux cases « 100 % » restent ouvertes**, pour la raison de `P2`.

- [ ] Couverture locale à 100 %.
- [x] La CI refuse toute régression par rapport au merge-base.
- [x] La CI refuse le code mort — disque contre scripts vus par `NODE_V8_COVERAGE`.
- [x] Aucune exclusion artificielle — le drapeau est interdit.
- [ ] Au tag, le seuil passe à 100 % absolu.

## 8. Phase P5 — Génération JavaScript

> **Preuve** — `npm run build && npm run verifier-build` : reproductibilité, `--keep-names`
> load-bearing, tailles, et `npm run verifier-derive` : le build ne touche aucun artefact
> commité.

Chaîne spécifiée dans [`docs/build.md`](./docs/build.md).

- [x] `signals.js` et `signals.test.js` par `tsc`.
- [x] `signals.min.js` et `signals.test.min.js` par `esbuild --keep-names`.
- [x] Réécrire le specifier du test minifié vers le runtime minifié.
- [x] Aucun sourcemap.
- [x] La CI échoue si un artefact committé est périmé.

## 9. Phase P6 — Registry shadcn

> **Preuve** — `npm run verifier-installation` : 71 assertions, sept installations réelles
> sur `shadcn` 4.10.0 et 4.21.1, par l'adresse `owner/repo/item`.

- [x] Définir le `registry.json` racine — six items, `registry:file`, cible `~/`.
- [x] Déclarer les `registryDependencies` qualifiées.
- [x] Tester chaque item séparément dans un projet jetable.
- [x] La porte d'installation s'exécute à chaque PR, sur une matrice de deux versions.

## 10. Phase P7 — Documentation

> **Preuve** — `npm run documentation` : 15 assertions, dont le bloc d'import comparé aux
> exports réels du module construit.

- [x] Rédiger le `README.md` final — l'API n'existe pas encore.
- [x] Corriger les trois fautes de fait relevées dans [`docs/documentation.md`](./docs/documentation.md) §5.
- [x] Ajouter la section « Différences connues », pour l'adopter.
- [x] Ajouter la porte qui vérifie la surface publique du README.

## 11. Phase P8 — Release

> **Deux tags posés, CI verte sur les deux.** `v0.1.0` pointe sur le commit où le cœur fut complet
> et testé ; `v1.0.0` sur celui qui ajoute parité, portes, distribution et documentation. Les deux
> runs sont `success`.
>
> **Il reste quatre cases ouvertes, et les quatre d'entre elles disent la même chose** : la couverture
> n'est pas à 100 %. Ce n'est pas un oubli — c'est [ADR-0011](docs/adr/0011-reliquat-de-couverture-non-atteignable.md),
> et la case reste ouverte parce qu'elle est littéralement fausse, pas parce qu'on l'a oubliée.

- [x] CI complète verte — observée verte sur les DEUX tags, `v0.1.0` en 33 s et `v1.0.0` en 53 s.
- [ ] Couverture à 100 % au tag — **refusée, et c'est une décision** : [ADR-0011](docs/adr/0011-reliquat-de-couverture-non-atteignable.md). Le seuil au tag est la valeur mesurée, et les trois reliquats sont des gardes que la référence ne sait pas atteindre non plus.
- [x] Porte d'installation verte sur les deux versions de la CLI.
- [x] Tag `v0.1.0` — le cœur conforme, posé sur `ab08551`.
- [x] Tag `v1.0.0` — la distribution complète, posé sur `9aa60d4`.

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

Les releases sont les tags git ; leurs notes vivent avec eux. Le détail est dans les messages de
tag, qui sont ce que `git show v1.0.0` affiche.

### `v0.1.0` — le cœur conforme et testé

Posé sur `ab08551`, où les dix exports existent et où la suite est verte.

80 scénarios, 198 entrées de matrice, 95 tests. Couverture 99,61 / 95,91 / 98,41. Le registry
déclare **un** item, `signals` : le moteur est installable, la distribution ne l'est pas.

### `v1.0.0` — la distribution complète

Posé sur `9aa60d4`.

82 scénarios, 203 entrées de matrice, 98 tests, 144 assertions de porte. Parité sur quatre
cibles, garde du code mort, non-régression face au merge-base, six items du registry éprouvés par
installation réelle sur deux versions de la CLI, README final et porte de documentation.

Le référent de la matrice y change : il devient **le paquet installé**. Vingt-deux entrées portent
un marqueur et leur divergence est consignée au §21.

**Écart connu** : la couverture n'est pas à 100 %, par décision documentée.