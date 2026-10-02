# Contribuer à signalcn

`signalcn` reproduit le comportement observable de `@preact/signals-core@1.14.4` — quirks
compris. Ce document est le **mode d'emploi** : comment travailler ici, et les quatre pièges qui
mordent sans prévenir. Les règles de fond sont ailleurs, et il n'y a pas de troisième version
d'elles ici : [`ROADMAP.md`](./ROADMAP.md) §2 les porte, [`SPEC.md`](./SPEC.md) est le contrat
normatif.

## Prérequis

Node **`22.6`** ou plus récent. C'est tout : pas d'installation globale, pas de bundler, pas de
framework, pas de configuration à écrire. La suite de tests est le module `node:test` du runtime et
les scripts sont des programmes `node` — voir [ADR-0002](docs/adr/0002-node-test-sans-dependance-de-test.md)
pour pourquoi ce choix a été fait et ce qu'il a rapporté.

```bash
npm ci
```

## Le contrat en une phrase

Toute affirmation de compatibilité se prouve par **exécution**, jamais par relecture. Un scénario
existe dans la table pour être rejoué contre le paquet installé, et s'il passe chez nous sans y
passer, c'est un défaut chez nous.

## Les portes

`npm run porte` enchaîne tout, sauf `verifier-installation` : celle-là est le job `distribution`,
qui tourne en parallèle et coûte 97 secondes à lui seul. Pour le reste, c'est le seul juge : un
commit qui laisse `porte` rouge n'est pas prêt, quelle que soit la qualité du diff.

L'ordre des lignes est celui du job rapide de la CI, qui est **par sévérité et non par coût** : le
premier message lu est celui qui décide de ce qu'on regarde ensuite. La dernière ligne n'appartient
pas à ce job, et sa ligne le dit.

| Porte | Ce qu'elle attrape |
|---|---|
| `npm run harnais` | Le produit est faux. La table entière rejouée contre la baseline. |
| `npm run couverture` | Une couverture qui baisse, du code mort, une exclusion de couverture. |
| `npm run typecheck` | Le code ne compile pas. |
| `npm test` | La suite, source. |
| `npm run build` + `verifier-build` | Un artefact non reproductible, `--keep-names` inopérant, une taille. |
| `npm run parite` | La table sur les quatre cibles — baseline, source, build, minifié. |
| `verifier-derive` | Un artefact committé périmé. |
| `npm run documentation` | Un `README` qui ment sur la surface, ou une divergence non consignée. |
| `npm run verifier-installation` | Un item du registry qui ne s'installe plus, ou ne s'exécute plus chez l'utilisateur. **Hors `porte`** : c'est le job `distribution`, en parallèle. |

[`docs/ci.md`](./docs/ci.md) donne le détail et le coût de chacune.

## Les quatre pièges

**1. Ne jamais éditer un `.js` généré.** `registry/default/` contient deux sources tenues à la main
et quatre artefacts construits. Un `.js` modifié à la main est écrasé au prochain build, et
`verifier-derive` échoue. Si un artefact doit changer, c'est la source qui change.

**2. Un test s'écrit en exécutant la baseline, pas en relisant `SPEC.md`.** C'est l'erreur dont sont
sortis la moitié des bugs de ce dépôt. Une attente écrite à la main depuis une spécification ne
prouve que la lecture de cette spécification. Écrivez la sonde, exécutez-la contre
`@preact/signals-core`, et figez **ce qu'elle a répondu** — y compris quand la réponse est
contre-intuitive. [`docs/scenarios.md`](./docs/scenarios.md).

**3. Le référent est le paquet installé, pas ses sources.** Une propriété y vaut `i`, pas `_version` :
le paquet minifie les siennes. Une entrée dont l'observable ne peut rien porter sur l'artefact se
marque dans `COUVERTURE` — `source:<réf>` ou `divergence:<ancre>` — et sa raison se consigne au §21
de la SPEC.

Une destination pouvait aussi être un numéro de ticket. C'était une **promesse**, et le mécanisme
a coûté cher : cinq entrées étaient couvertes par un ticket clos, donc par rien du tout. La liste a
été retirée quand la dernière promesse a été tenue. Ne la réintroduisez pas — si une entrée n'est
pas couverte, écrivez le scénario qui la couvre.

**4. Aucune exclusion de couverture.** `--test-coverage-exclude`, `c8 ignore`, `istanbul ignore` et
`v8 ignore` sont interdits, et la porte les cherche dans tout le dépôt. Le seuil porte sur la
**source** et sur elle seule, par un motif sur `registry/default/`. Une exclusion est invisible par
construction : le fichier sort du rapport et le chiffre passe.

## Ce qu'on ne fait pas

- **Pas de dépendance runtime.** Le code distribué s'exécute sur un Node nu, sans `node_modules`.
  Le zéro-dépendance est vérifié par deux passes disjointes — voir
  [`docs/zero-dependency.md`](./docs/zero-dependency.md).
- **Pas de `.d.ts` publié.** La référence en publie un, nous non : c'est une divergence assumée au
  §21.2 de la SPEC.
- **Pas de code de framework dans le cœur.** Ni React, ni Preact, ni Vue, ni Angular.
- **Pas de dépendance de test.** `node:test` et les modules natifs, rien d'autre.

## Où lire

| Question | Document |
|---|---|
| Que doit faire le cœur, exactement ? | [`SPEC.md`](./SPEC.md) |
| Comment est construit le graphe ? | [`docs/architecture.md`](./docs/architecture.md) |
| Comment s'écrit un scénario ? | [`docs/scenarios.md`](./docs/scenarios.md) |
| Comment se prouve la conformité ? | [`docs/parity.md`](./docs/parity.md) |
| Comment sont produits les artefacts ? | [`docs/build.md`](./docs/build.md) |
| Comment s'installent les artefacts ? | [`docs/distribution.md`](./docs/distribution.md) |
| Que fait la CI, et dans quel ordre ? | [`docs/ci.md`](./docs/ci.md) |
| Qui garde quel document juste ? | [`docs/documentation.md`](./docs/documentation.md) |
| Qu'est-ce que le vocabulaire du projet ? | [`CONTEXT.md`](./CONTEXT.md) |

Pour les **agents** : [`AGENTS.md`](./AGENTS.md).