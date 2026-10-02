# Contribuer à signalcn

`signalcn` reproduit le comportement observable de `@preact/signals-core@1.14.4` — quirks
compris. Ce document est le **mode d'emploi** : comment travailler ici, et les quatre pièges qui
mordent sans prévenir. Les règles de fond sont ailleurs, et il n'y a pas de troisième version
d'elles ici : [`ROADMAP.md`](/contributeurs/ROADMAP.md) §2 les porte, [`SPEC.md`](./SPEC.md) est le contrat
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

## Le nommage des descripteurs

Un descripteur est un groupe de mots anglais. La préposition reste, en anglais : `in`, `with`,
`on`, `after`, `during`, `outside`. Un mot français est banni — sauf s'il figure à la liste
d'exception.

Un descripteur, c'est un nom de scénario, un nom de test `signalcn-seul`, ou un identifiant du
cœur. **Le registre est fonctionnel plutôt que calque** : on nomme ce que le test vérifie, pas ce
que le français dit — `recompute`, `cached-error`, `draining`, `suspended-capture`. Les
commentaires, eux, restent en français, et la porte ne les lit pas.

La liste d'exception compte **12** mots. Ils sont français *et* anglais, donc le signal « mot
français » les refuse à tort ; sans elle, la porte tomberait sur du code sain dès son premier
passage. `lien` n'y figure pas, et n'y a jamais figuré : il apparaît plus haut, comme exemple de
mot français qui est aussi anglais — c'est l'argument contre une liste de mots à refuser, pas une
exception à la règle.

- `parent`
- `brand`
- `dispose`
- `batch`
- `untracked`
- `watch`
- `snapshot`
- `consumer`
- `peek`
- `revert`
- `cleanup`
- `chain`

`npm run documentation` applique la règle et lit cette section — il ne recopie ni la phrase ni la
liste. Son périmètre est ce qu'il sait lire : les 97 descripteurs que la suite enregistre, et les
cinq identifiants que [#46](https://github.com/WAROL52/signalcn/issues/46) a renommés dans le
cœur. Les mots anglais qu'il accepte sont versionnés dans
`scripts/vocabulaire-identifiants.txt` : un mot anglais nouveau s'y ajoute, et rien d'autre ne se
touche.

## Les portes

`npm run porte` enchaîne tout, sauf `verifier-installation` : celle-là est le job `distribution`,
qui tourne en parallèle et coûte à elle seule plus que tous les autres réunis — le chiffre est
mesuré en [`site/contributeurs/ci.md`](/contributeurs/ci.md) §1, qui est sa seule source. Pour le reste, c'est le seul
juge : un commit qui laisse `porte` rouge n'est pas prêt, quelle que soit la qualité du diff.

L'ordre des lignes est celui du job rapide de la CI, qui est **par sévérité et non par coût** : le
premier message lu est celui qui décide de ce qu'on regarde ensuite. Les deux dernières lignes
n'appartiennent pas à ce job, et leurs lignes le disent.

| Porte | Ce qu'elle attrape |
|---|---|
| `npm run harnais` | Le produit est faux. La table entière rejouée contre la baseline. |
| `npm run couverture` | Une couverture qui baisse, du code mort, une exclusion de couverture. |
| `npm run typecheck` | Le code ne compile pas. |
| `npm test` | La suite, source. |
| `npm run build` + `verifier-build` | Un artefact non reproductible, `--keep-names` inopérant, une taille. |
| `npm run zero-dependance` | Le cœur distribué qui lit autre chose que lui-même — 18 motifs interdits, sur l'artefact minifié. |
| `npm run parite` | La table sur les quatre cibles — baseline, source, build, minifié. |
| `verifier-derive` | Un artefact committé périmé. |
| `npm run documentation` | Un `README` qui ment sur la surface, une divergence non consignée, un descripteur français. |
| `npm run verifier-ruleset` | Un job que la CI exécute sans l'exiger, ou un check exigé qu'elle n'exécute plus. |
| `npm run documentation-statique` + `verifier-proprete` | Un site qui ne se construit pas, un build qui écrit dans les chemins des artefacts. **Hors `rapide`** : c'est le job `documentation-statique`, en parallèle, et dans cet ordre — la propreté observe ce que le build vient d'écrire. |
| `npm run verifier-installation` | Un item du registry qui ne s'installe plus, ou ne s'exécute plus chez l'utilisateur. **Hors `porte`** : c'est le job `distribution`, en parallèle. |

[`site/contributeurs/ci.md`](/contributeurs/ci.md) donne le détail et le coût de chacune.

## Tout passe par une pull request

`master` n'accepte plus de commit direct : chaque changement part d'une branche et arrive par une
PR dont les contrôles sont verts. Les six règles ci-dessous ont été arrêtées une par une ; leurs
raisons sont dans [la carte](https://github.com/WAROL52/signalcn/issues/41).

**La branche s'appelle `NNN-kebab-du-ticket`** — le numéro relie à la carte, le kebab la rend
lisible dans `git branch`. Un ticket, une branche ; si le ticket demande plusieurs PR, on suffixe
`-2`, `-3`. Une branche dont le numéro ne correspond à aucun ticket est une branche orpheline, et
elle se voit.

**Le titre reprend la manière des commits** : une phrase qui dit ce qui a été trouvé, puis un tiret
cadratin et le numéro du ticket. *`La table ne comptait pas les branches — #45`*. Un nom de ticket
tel quel serait une description de tâche ; ce dépôt écrit des constats dans ses sujets.

**Le corps déclare trois choses, et se tait sur tout le reste** : le lien du ticket, le **pourquoi**
cette approche plutôt que l'alternative écartée, et **ce qui n'a pas été vérifié**. Ni le diff —
GitHub l'affiche — ni la CI — elle tourne — ni le ticket — il est lié.

Ce dernier point n'est pas une politesse. Ce dépôt tient en une phrase : *toute affirmation se
prouve par exécution*. Une PR qui se tait sur ce qu'elle n'a pas exécuté affirme par omission ce
qu'elle n'a pas présent.

**Une PR est une unité relisible, pas un ticket.** Un ticket peut produire plusieurs PR. Plusieurs
tickets dans une PR sont interdits : sinon la carte ne sait plus rien.

**La fusion se fait en rebase**, jamais en squash ni en commit de fusion — les commits de la
branche survivent, dans l'ordre. Ce n'est pas une préférence de fusion : c'est un réglage du
ruleset, et la porte `verifier-ruleset` le garde.

**Les quatre jobs sont des checks requis, et cette liste est du code versionné.** Le ruleset est
`.github/rulesets/master.json`, il s'applique par `gh api`, et il n'a **aucun** bypass — pas même
pour le propriétaire. `npm run verifier-ruleset` le compare aux jobs que `ci.yml` déclare : un
cinquième job ajouté sans être exigé fait tomber la pull request, ce qui est le seul moyen de voir
un jour le check que la PR suivante n'aurait pas fait tourner. Voir
[`site/contributeurs/ci.md`](/contributeurs/ci.md) §8.

**Ce qui n'est pas vérifié en local, et qu'il faut savoir**

`npm run porte` et le job `rapide` exécutent les mêmes scripts, mais la CI ajoute trois choses que
le poste de développement n'a pas. Une seule compte vraiment :

`actions/checkout@v4` est configuré avec `fetch-depth: 0`. Sans cette référence complète,
`scripts/porte-couverture.mjs` cherche `origin/master`, puis `master`, puis `main`, ne trouve rien,
et **affiche « pas de merge-base » — la non-régression de couverture se désactive sans jamais avoir
échoué.** Un `porte` vert en local ne dit donc pas que la non-régression a été évaluée.

Les deux autres sont `setup-node` épinglé à Node 24 et `npm ci` sur une arborescence propre. Sans
effet aujourd'hui, mais c'est la raison pour laquelle la CI reste le juge.

## Les quatre pièges

**1. Ne jamais éditer un `.js` généré.** `registry/default/` contient deux sources tenues à la main
et quatre artefacts construits. Un `.js` modifié à la main est écrasé au prochain build, et
`verifier-derive` échoue. Si un artefact doit changer, c'est la source qui change.

**2. Un test s'écrit en exécutant la baseline, pas en relisant `SPEC.md`.** C'est l'erreur dont sont
sortis la moitié des bugs de ce dépôt. Une attente écrite à la main depuis une spécification ne
prouve que la lecture de cette spécification. Écrivez la sonde, exécutez-la contre
`@preact/signals-core`, et figez **ce qu'elle a répondu** — y compris quand la réponse est
contre-intuitive. [`site/contributeurs/scenarios.md`](/contributeurs/scenarios.md).

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
  [`site/technique/zero-dependency.md`](/technique/zero-dependency.md).
- **Pas de `.d.ts` publié.** La référence en publie un, nous non : c'est une divergence assumée au
  §21.2 de la SPEC.
- **Pas de code de framework dans le cœur.** Ni React, ni Preact, ni Vue, ni Angular.
- **Pas de dépendance de test.** `node:test` et les modules natifs, rien d'autre.

## Où lire

| Question | Document |
|---|---|
| Que doit faire le cœur, exactement ? | [`SPEC.md`](./SPEC.md) |
| Comment est construit le graphe ? | [`site/technique/architecture.md`](/technique/architecture.md) |
| Comment s'écrit un scénario ? | [`site/contributeurs/scenarios.md`](/contributeurs/scenarios.md) |
| Comment se prouve la conformité ? | [`site/utilisateurs/parity.md`](/utilisateurs/parity.md) |
| Comment sont produits les artefacts ? | [`site/contributeurs/build.md`](/contributeurs/build.md) |
| Comment s'installent les artefacts ? | [`site/utilisateurs/distribution.md`](/utilisateurs/distribution.md) |
| Que fait la CI, et dans quel ordre ? | [`site/contributeurs/ci.md`](/contributeurs/ci.md) |
| Qui garde quel document juste ? | [`site/contributeurs/documentation.md`](/contributeurs/documentation.md) |
| Qu'est-ce que le vocabulaire du projet ? | [`CONTEXT.md`](./CONTEXT.md) |

Pour les **agents** : [`AGENTS.md`](./AGENTS.md).