# Politique de documentation

Ce document décide **quelle** documentation existe et **ce qui la garde juste**. Il ne
rédige rien : l'API n'est pas encore figée, donc le README final attendra. Il ne décide pas
non plus des commentaires dans `signals.ts` — c'est l'objet d'un ticket séparé — ni du sort de
`site/contributeurs/ROADMAP.md`, qui en a un autre.

## 1. Deux publics, deux ensembles

Les mélanger est un service rendu : un adopter qui veut utiliser la bibliothèque n'a pas à lire
une CI pour savoir comment l'installer.

### Public — pour un adopter

| Document | Rôle |
|---|---|
| `README.md` | installation, exemple, surface publique, divergences |
| `SPEC.md` | le contrat normatif de comportement |
| `site/contributeurs/PRD.md` | ce que le produit est et pourquoi il existe |
| [`site/utilisateurs/distribution.md`](../utilisateurs/distribution.md) | installer : où atterrit un artefact, les deux exigences |
| [`site/utilisateurs/premier-effet.md`](../utilisateurs/premier-effet.md) | le premier programme qui marche |
| [`site/utilisateurs/migrer-depuis-preact.md`](../utilisateurs/migrer-depuis-preact.md) | ce qui change dans du code écrit contre la baseline |
| [`site/utilisateurs/verifier-artefact-installe.md`](../utilisateurs/verifier-artefact-installe.md) | faire tourner la suite installée, et ses limites |
| [`site/utilisateurs/batch-et-surprises.md`](../utilisateurs/batch-et-surprises.md) | batchs, cascades, `action`, et les surprises à l'exécution |
| `docs/adr/` | le raisonnement derrière les décisions, y compris les divergences |

### Interne — pour le mainteneur

| Document | Rôle |
|---|---|
| [`site/technique/architecture.md`](../technique/architecture.md) | comment le graphe est construit |
| [`site/technique/graphe-de-dependances.md`](../technique/graphe-de-dependances.md) | la figure du graphe : chaîne, diamant, dépendance dynamique |
| [`site/technique/regles-de-drainage.md`](../technique/regles-de-drainage.md) | les deux ordres d'exécution, et lequel s'applique |
| [`site/contributeurs/build.md`](./build.md) | la chaîne de build et de minification |
| [`site/contributeurs/ci.md`](./ci.md) | les jobs et leur ordre |
| [`site/contributeurs/parity.md`](./parity.md) | comment la garantie de conformité s'applique |
| [`site/contributeurs/scenarios.md`](./scenarios.md) | comment s'écrit un scénario, et ce qui garde les comptes |
| [`site/contributeurs/ROADMAP.md`](./ROADMAP.md) | le suivi interne des mainteneurs |
| [`site/technique/zero-dependency.md`](../technique/zero-dependency.md) | le contrôle de zéro-dépendance |
| `CONTEXT.md` | le glossaire du domaine |
| `docs/agents/` | la configuration des skills |
| `research/`, `prototype/README.md` | notes de travail, et le registre des prototypes dont le code vit sur une branche |

## 2. La surface publique : le README déclare, une porte vérifie

Le README n'est pas généré. Générer de la prose est un piège : on finit avec un tableau
généré collé dans un texte écrit à la main, donc deux sources pour la même chose.

À la place, **le bloc d'import que le lecteur copie est la déclaration de surface**. C'est ce
qu'il a sous les yeux, il n'y a aucun balisage à ajouter, et la porte le compare aux exports
réels du module.

```js
import { readFileSync } from "node:fs"

const listeModule = Object.keys(await import(process.argv[2])).sort()
const readme = readFileSync(process.argv[3], "utf-8")
const blocs = [...readme.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*"([^"]+)"/g)]
if (!blocs.length) { console.log("aucun bloc d'import dans le README"); process.exit(1) }
const corps = blocs[0][1]
const specifier = blocs[0][2]
const documentes = corps.split(",").map(s => s.trim()).filter(Boolean).sort()

// Le chemin doit etre relatif : c'est ce qui evite d'imposer un alias a l'utilisateur.
if (specifier !== "./signals.js" && specifier !== "./signals.ts") {
  console.log(`specifier inadmissible : ${specifier}`); process.exit(1)
}

const manquants = listeModule.filter(n => !documentes.includes(n))
const enTrop = documentes.filter(n => !listeModule.includes(n))
if (manquants.length) console.log("exports non documentes :", manquants.join(", "))
if (enTrop.length) console.log("noms documentes en trop :", enTrop.join(", "))
process.exit(manquants.length + enTrop.length > 0 ? 1 : 0)
```

**Vérifié** sur les quatre cas :

| Cas | Résultat |
|---|---|
| README complet | `exit 0` |
| export oublié | `exports non documentes : createModel` — `exit 1` |
| nom inventé | `noms documentes en trop : inexistant` — `exit 1` |
| specifier `@/lib/signals` | `specifier inadmissible` — `exit 1` |

L'assertion du specifier est indispensable : sans elle, la porte renvoie `exit 0` sur un
chemin faux. C'est mesuré, et c'est aussi l'erreur la plus probable — un utilisateur qui
recopie un chemin qui demande un alias qu'il n'a pas.

## 3. Les divergences assumées, pour l'adopter

`SPEC.md` §21 en porte **deux listes, et elles ne se recouvrent pas**. La première, §21.1, est le
registre des **vingt-deux entrées de matrice** que le paquet installé ne peut pas porter : chacune
est marquée dans `COUVERTURE`, et une porte refuse qu'une entrée marquée n'ait pas sa ligne — ou
qu'une ligne cite une entrée absente. Un adopter n'y cherche pas sa réponse : ce sont des entrées
de test, et la plupart n'annoncent qu'un nom que le paquet minifie. La seconde, §21.2, est la liste
des **écarts réels**, ceux qui n'ont pas d'entrée de matrice parce qu'aucun scénario ne peut les
rejouer.

C'est donc §21.2 qui répond à la seule question qu'un adopter qui migre depuis Preact se pose :
**qu'est-ce qui change pour moi ?**

Le README porte donc une section « Différences connues », reformulée dans ce seul sens, qui
pointe vers l'ADR pour le pourquoi. **Pas de duplication** : le README dit l'effet, l'ADR dit
la raison. Les deux ne dérivent pas l'un de l'autre.

| Divergence | Pour l'adopter |
|---|---|
| Internes de `Effect` / `Computed` non typés, et pas de `.d.ts` publié | Aucun impact : personne ne les appelle, et le typage se fait à la main |
| `EffectFn` non exporté | Un type de plus à écrire à la main, sans impact |
| Méthodes de prototype non énumérables | `for..in` sur un signal : 8 clés au lieu de 17 |
| `Computed.prototype` sans état | Plus d'empoisonnement global du prototype |
| `Computed.prototype.constructor` correct | Un correctif, pas une régression |
| Seuil de cycle non figé | Le compte peut différer, le comportement non |
| Les sept écarts de `createModel` | Le veto `brand` par valeur, les clés propres, la descension par descripteur, la mémoïsation, l'absence de clé `"undefined"`, l'avertissement asynchrone, quatre gardes |

Ces sept lignes sont celles de `SPEC.md` §21.2, reformulées pour l'adopter. Ce tableau n'est pas
gardé par une porte — une porte ne réécrit pas de la prose — donc il se garde à la relecture.
Ce qui est gardé par une porte, c'est le README, et c'est ce qui compte pour l'adopter.

## 4. Ce que ce document ne décide pas

- **Les commentaires et la JSDoc de `signals.ts`.** L'installation par la CLI supprime les
  commentaires flottants ; la forme du code source est un autre arbitrage.
- **Le sort de `site/contributeurs/ROADMAP.md`.** Document interne périmable ou document public tenu à jour.
- **La langue des exemples et des commentaires.** Le code est en anglais par nécessité ; le
  reste suit le projet.
- **Le contenu final du README.** Il ne peut pas être rédigé avant que l'API soit figée.

## 5. Les erreurs que le README portait, et ce qui les a fermées

Relevées avant que le contenu final soit possible. Ce sont des fautes de **fait**, pas de
rédaction, et les quatre sont corrigées :

1. Le bloc d'import montrait `@/lib/signals`. Le chemin correct est `./signals.js`.
2. La couverture était annoncée à « 100 % statements, branches, functions and lines », **deux
   fois**. Le contrat amendé est à **trois** métriques : lignes, branches, fonctions.
3. Le bloc d'import ne nommait que cinq symboles. Le contrat v1 en exporte dix : **`action`,
   `createModel`, `Signal`, `Effect` et `Computed` manquaient**. C'était la moitié de la surface
   publique qui n'était pas documentée.
4. Il n'y avait aucune section de divergences.

Les trois premières sont **détectables automatiquement** par la porte du §2. La quatrième ne
l'est pas et ne peut pas l'être — aucune porte n'écrit de la prose — mais son absence est
détectable : la porte refuse de laisser passer un README sans la section, ce qui force la question
« les divergences sont-elles documentées ? » plutôt que de la laisser se perdre. `scripts/verifier-documentation.mjs`
vérifie les quatre, y compris l'absence de la rubrique de couverture que le runner ne produit
pas.