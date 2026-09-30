# Politique de documentation

Ce document décide **quelle** documentation existe et **ce qui la garde juste**. Il ne
rédige rien : l'API n'est pas encore figée, donc le README final attendra. Il ne décide pas
non plus des commentaires dans `signals.ts` — c'est l'objet d'un ticket séparé — ni du sort de
`ROADMAP.md`, qui en a un autre.

## 1. Deux publics, deux ensembles

Le dépôt compte désormais huit documents. Les mélanger est un service rendu : un adopter qui
veut utiliser la bibliothèque n'a pas à lire une CI pour savoir comment l'installer.

### Public — pour un adopter

| Document | Rôle |
|---|---|
| `README.md` | installation, exemple, surface publique, divergences |
| `SPEC.md` | le contrat normatif de comportement |
| `PRD.md` | ce que le produit est et pourquoi il existe |
| [`docs/distribution.md`](./distribution.md) | où atterrit un artefact, quel chemin d'import |
| [`docs/parity.md`](./parity.md) | comment la garantie de conformité s'applique |
| `docs/adr/` | le raisonnement derrière les décisions, y compris les divergences |

### Interne — pour le mainteneur

| Document | Rôle |
|---|---|
| [`docs/architecture.md`](./architecture.md) | comment le graphe est construit |
| [`docs/build.md`](./build.md) | la chaîne de build et de minification |
| [`docs/ci.md`](./ci.md) | les jobs et leur ordre |
| [`docs/zero-dependency.md`](./zero-dependency.md) | le contrôle de zéro-dépendance |
| `CONTEXT.md` | le glossaire du domaine |
| `docs/agents/` | la configuration des skills |
| `research/`, `prototype/` | notes de travail et code jetable, explicitement marqués comme tels |

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

`SPEC.md` §21 compte sept divergences assumées, spécifiées pour un mainteneur. Un adopter qui
migre depuis Preact a besoin d'une réponse à une seule question : **qu'est-ce qui change pour
moi ?**

Le README porte donc une section « Différences connues », reformulée dans ce seul sens, qui
pointe vers l'ADR pour le pourquoi. **Pas de duplication** : le README dit l'effet, l'ADR dit
la raison. Les deux ne dérivent pas l'un de l'autre.

Les sept entrées de `SPEC.md` §21 se répartissent ainsi :

| Divergence | Pour l'adopter |
|---|---|
| Internes de `Effect` / `Computed` non typés | Aucun impact : personne ne les appelle |
| `EffectFn` non exporté | Un type de plus à écrire à la main, sans impact |
| Méthodes de prototype non énumérables | `for..in` sur un signal : 8 clés au lieu de 17 |
| `Computed.prototype` sans état | Plus d'empoisonnement global du prototype |
| `Computed.prototype.constructor` correct | Un correctif, pas une régression |
| Seuil de cycle non figé | Le compte peut différer, le comportement non |
| Les sept écarts de `createModel` | Le veto `brand` par valeur, les clés propres, la descension par descripteur, la mémoïsation, l'absence de clé `"undefined"`, l'avertissement asynchrone, quatre gardes |

## 4. Ce que ce document ne décide pas

- **Les commentaires et la JSDoc de `signals.ts`.** L'installation par la CLI supprime les
  commentaires flottants ; la forme du code source est un autre arbitrage.
- **Le sort de `ROADMAP.md`.** Document interne périmable ou document public tenu à jour.
- **La langue des exemples et des commentaires.** Le code est en anglais par nécessité ; le
  reste suit le projet.
- **Le contenu final du README.** Il ne peut pas être rédigé avant que l'API soit figée.

## 5. Les erreurs que le README porte aujourd'hui

Relevées au passage, pour qu'elles ne se perdent pas. Ce sont des fautes de **fait**, pas de
rédaction :

1. Le bloc d'import montre `@/lib/signals`. Le chemin correct est `./signals.js`.
2. La couverture est annoncée à « 100 % statements, branches, functions and lines », **deux
   fois**. Le contrat amendé est à **trois** métriques : lignes, branches, fonctions.
3. Le bloc d'import ne nomme que cinq symboles. Le contrat v1 en exporte dix : **`action`,
   `createModel`, `Signal`, `Effect` et `Computed` manquent**. C'est la moitié de la surface
   publique qui n'est pas documentée.
4. Aucune section de divergences.

Les trois premières sont **détectables automatiquement** par la porte du §2, vérifié contre le
README d'aujourd'hui : `specifier inadmissible`, `exports non documentes : action, createModel,
Signal, Effect, Computed`. Le point 4 n'existe pas encore, et aucune porte ne peut le créer.