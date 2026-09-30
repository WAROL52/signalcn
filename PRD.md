# signalcn — PRD

> **Statut :** Brouillon / Source de vérité produit  
> **Projet :** `signalcn`  
> **Langage source :** TypeScript  
> **Distribution :** GitHub Registry consommé via la CLI `shadcn`  
> **Dépendances runtime :** Aucune

## 1. Résumé du produit

`signalcn` est une bibliothèque de signaux réactifs, agnostique des frameworks, écrite en TypeScript et conçue pour les applications JavaScript vanilla.

Son comportement public vise une compatibilité comportementale avec `@preact/signals-core`, tout en restant indépendant de Preact, React, Vue, Angular, du DOM et de tout autre framework.

La bibliothèque est distribuée comme du code source depuis un dépôt GitHub configuré comme registry shadcn. Il n'y a pas d'installation npm de `signalcn` : l'utilisateur ajoute individuellement les artefacts voulus avec la CLI `shadcn`.

Le projet sépare volontairement :

- le moteur réactif ;
- les deux sources de vérité TypeScript ;
- les artefacts JavaScript générés ;
- les artefacts JavaScript minifiés ;
- les tests ;
- les futurs adaptateurs de framework.

## 2. Vision

Créer un moteur réactif petit, prévisible et portable, directement copiable dans une application sans ajouter de dépendance runtime.

Expérience cible :

```text
Dépôt GitHub
      |
      v
   CLI shadcn
      |
      v
Projet utilisateur
      |
      v
signals.ts / signals.js
      |
      v
Application JavaScript vanilla
```

À terme, des adaptateurs pourront connecter le même cœur à React, Vue, Angular ou d'autres écosystèmes sans modifier le cœur.

## 3. Problème à résoudre

Les bibliothèques de signaux sont généralement consommées comme des packages et peuvent être associées à un framework, à un gestionnaire de paquets ou à une dépendance runtime.

`signalcn` adopte un autre modèle :

- distribution orientée source ;
- aucune dépendance runtime ;
- agnosticité framework ;
- propriété directe du code installé par le projet consommateur ;
- artefacts TypeScript ou JavaScript au choix ;
- installation exclusivement via la CLI shadcn.

## 4. Principes produit

### 4.1 Agnosticité framework

Le cœur NE DOIT dépendre d'aucun :

- React ;
- API runtime de Preact ;
- Vue ;
- Angular ;
- JSX ;
- API DOM ;
- globale navigateur obligatoire ;
- ordonnanceur propre à un framework.

Le cœur DOIT être utilisable dans un environnement JavaScript standard.

### 4.2 Zéro dépendance runtime

Le runtime distribué DOIT avoir zéro dépendance externe.

Les outils de développement tels que TypeScript, l'outillage de build et de minification, et la bibliothèque de référence elle-même sont autorisés dans le dépôt mainteneur et ne doivent jamais devenir des dépendances runtime du code installé.

**Aucune dépendance de test.** La suite s'exécute avec le module `node:test` de Node, et la couverture est produite par le relevé natif du runner. Le fichier `signals.test.ts` est un artefact distribuable : il doit fonctionner chez l'utilisateur sans qu'il ait quoi que ce soit à installer.

### 4.3 Compatibilité comportementale

La cible de compatibilité est le comportement public de `@preact/signals-core` pour une version de référence explicitement figée.

Baseline initiale du projet : **`@preact/signals-core@1.14.4`**.

La version de référence doit être considérée comme faisant partie du contrat. Toute mise à jour nécessite un audit de compatibilité, des tests de régression et une mise à jour de la documentation.

La compatibilité concerne le comportement observable, la forme de l'API, le suivi des dépendances, l'invalidation, l'ordonnancement, le nettoyage, les batches, les erreurs et les cas limites — pas une copie de l'implémentation interne upstream.

### 4.4 Sources de vérité

Seuls ces deux fichiers sont maintenus manuellement comme sources de vérité d'implémentation :

```text
signals.ts
signals.test.ts
```

Ces quatre fichiers sont générés et ne doivent jamais être modifiés à la main :

```text
signals.js
signals.test.js
signals.min.js
signals.test.min.js
```

### 4.5 Un fichier = un registry item

Chaque artefact distribuable est exposé comme un item shadcn indépendant.

L'installation d'un item n'installe implicitement aucun autre item. Un item de test déclare cependant, explicitement, une `registryDependencies` vers l'item d'implémentation correspondant : c'est une déclaration de l'utilisateur, pas une dépendance implicite du registry. Elle est nécessairement **pleinement qualifiée** (`WAROL52/signalcn/signals`) — un nom nu désignerait un autre registre et installerait silencieusement un homonyme.

### 4.6 Testabilité avant tout

Tout comportement public et toute branche interne pertinente doivent être testables.

La CI doit imposer :

```text
Branches   : 100 %
Functions  : 100 %
Lines      : 100 %
```

Trois métriques, pas quatre : le relevé natif de Node ne distingue pas les « statements » des lignes, et une ligne non couverte fait déjà échouer le seuil. La barrière réelle ne baisse pas.

La couverture à 100 % est une barrière de qualité, pas une preuve suffisante de correction sémantique. Une suite de conformité comportementale est donc obligatoire en plus de la couverture.

## 5. Utilisateurs cibles

### Utilisateurs principaux

Développeurs qui :

- construisent des applications JavaScript ou TypeScript vanilla ;
- veulent un état réactif de type signals sans framework ;
- préfèrent posséder le code source copié plutôt qu'ajouter une dépendance npm runtime ;
- utilisent déjà la CLI shadcn comme mécanisme de distribution de code.

### Utilisateurs secondaires

Développeurs construisant plus tard des adaptateurs de framework ou des bibliothèques nécessitant un moteur réactif indépendant.

## 6. Périmètre

### Inclus

Le produit initial doit fournir le cœur nécessaire pour émuler le comportement public de la cible de compatibilité, notamment :

- `signal()` ;
- `computed()` ;
- `effect()` ;
- `batch()` ;
- `untracked()` ;
- `action()` ;
- `createModel()` ;
- les classes exportées `Signal`, `Computed`, `Effect`, constructibles et utilisables ;
- `peek()` ;
- les subscriptions ;
- cleanup et dispose des effects ;
- suivi dynamique des dépendances ;
- batching et batches imbriqués ;
- évaluation lazy et invalidation ;
- comportement des erreurs et cycles ;
- les options couvertes par la baseline.

La surface publique est celle de la baseline, **sans réduction** : c'est la condition pour que `signals.ts` remplace `@preact/signals-core` sans modification du code appelant.

Le contrat normatif exact est défini dans `SPEC.md`.

### Hors périmètre du cœur

- intégration React ;
- intégration Vue ;
- intégration Angular ;
- bindings DOM ;
- transformations JSX ;
- ordonnanceurs spécifiques aux frameworks ;
- interface devtools ;
- intégration SSR ;
- protocole de persistance ou de sérialisation autre que celui nécessaire au comportement de l'API cible.

Ces éléments pourront être développés ultérieurement comme adaptateurs ou outils indépendants.

## 7. Modèle de distribution

Le dépôt est lui-même un GitHub Registry shadcn.

Le `registry.json` racine définit le catalogue. Les six items distribuables sont :

| Item | Fichier | Origine | Rôle |
|---|---|---|---|
| `signals` | `signals.ts` | source | Implémentation TypeScript |
| `signals-test` | `signals.test.ts` | source | Tests TypeScript |
| `signals-js` | `signals.js` | généré | Runtime JavaScript |
| `signals-test-js` | `signals.test.js` | généré | Tests JavaScript |
| `signals-min` | `signals.min.js` | généré | Runtime JavaScript minifié |
| `signals-test-min` | `signals.test.min.js` | généré | Tests JavaScript minifiés |

Les fichiers vivent dans `registry/default/`, et `registry.json` à la racine du dépôt.

Chaque item doit être installable séparément par la CLI shadcn. Le distribution repose sur les adresses `owner/repo/item`, qui **n'existent pas avant `shadcn@4.10.0`** : c'est la version minimale supportée.

Un item TypeScript est de type `registry:lib`, un item JavaScript de type `registry:file`. L'inversion produit un fichier `.js` contenant du TypeScript, non exécutable.

## 8. Pipeline de génération

Pipeline unidirectionnel obligatoire :

```text
signals.ts
   |
   +----> build TypeScript ----> signals.js
   |
   +----> minification --------> signals.min.js

signals.test.ts
   |
   +----> build TypeScript ----> signals.test.js
   |
   +----> minification --------> signals.test.min.js
```

Aucun fichier généré ne doit être source de vérité.

Les artefacts sont des **modules ES**, sans variante CommonJS ni variante globale. Un seul format à produire, tester et distribuer.

## 9. Critères de succès

Le projet est prêt pour une version stable lorsque :

- [ ] l'API publique ciblée est implémentée ;
- [ ] le comportement est conforme à la baseline de référence ;
- [ ] les tests TypeScript passent ;
- [ ] les tests JavaScript générés passent ;
- [ ] les artefacts minifiés sont valides ;
- [ ] la couverture est de 100 % sur les quatre métriques ;
- [ ] zéro dépendance runtime est vérifiée ;
- [ ] les six registry items sont installables indépendamment ;
- [ ] la CI reconstruit et vérifie les artefacts ;
- [ ] le zéro-dépendance runtime est **vérifié** par la CI, et pas seulement affirmé ;
- [ ] le harnais différentiel ne signale aucune divergence contre la baseline ;
- [ ] la documentation publique est cohérente avec le comportement réel.

## 10. Non-objectifs

`signalcn` n'a pas pour objectif de :

- devenir un framework ;
- remplacer React, Vue ou Angular ;
- fournir un rendu d'interface ;
- imposer un système de state management complet ;
- reproduire le code source de Preact ;
- accumuler des fonctionnalités simplement parce qu'elles existent ailleurs.
