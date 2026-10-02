# Distribution — chemin d'installation et nom d'import

Spécification de la façon dont les six items du registry arrivent dans le projet d'un
utilisateur. Vérifiée par installation réelle avant d'être écrite.

## 1. Le fait qui décide de tout

`components.json` du **consommateur** porte un drapeau `tsx`, et c'est lui — pas le type de
fichier, pas la cible — qui décide de l'extension du fichier installé. Mesuré sur les seize
combinaisons possibles :

| `tsx` | Type de fichier | Source `.ts` | Extension installée | Transpilation |
|---|---|---|---|---|
| **`true`** | `registry:file` | `signals.ts` | **`.ts`** | aucune, le TypeScript est conservé |
| **`true`** | `registry:lib` | `signals.ts` | `.ts` | aucune |
| `false` | `registry:lib` | `signals.ts` | `.js` | oui, correct |
| `false` | `registry:file` | `signals.ts` | `.js` | **aucune — fichier cassé** |

Avec `tsx: true`, **`target` est respecté à l'extension près** et **rien n'est transpilé**.
Avec `tsx: false`, l'extension est imposée et seule `registry:lib` transpile.

Conséquence directe : `signals.ts` et `signals.js` peuvent coexister **uniquement** si
`tsx: true`. Sinon les deux items convergent vers le même nom de fichier et s'écrasent.

## 2. La configuration retenue

```jsonc
// registry.json — pour les six items
{
  "name": "signals",
  "type": "registry:item",
  "files": [{ "path": "registry/default/signals.ts", "type": "registry:file", "target": "~/signals.ts" }]
}
```

- **`registry:file` partout.** L'artefact est installé tel qu'il est dans le dépôt. C'est la
  seule configuration correcte pour un projet `tsx: true`, et la seule qui permette
  d'installer `signals.ts` **et** `signals.js` sans collision.
- **`target: "~/<nom>"`.** Vérifié : le préfixe `~` joint la racine du projet **sans**
  injection de `src/`, donc l'artefact atterrit au même endroit dans tous les projets. Un
  dossier `src/` préexistant n'est pas touché.
- **Aucune transpilation.** Notre artefact TypeScript est la source de vérité, et le
  outillage du consommateur s'en charge. Faire transpiler par la CLI reviendrait à maintenir la
  même chose deux fois.

## 3. Ce que l'utilisateur écrit

```ts
import { signal, computed, effect } from "./signals.js"
```

Un chemin relatif. Rien d'autre : ni alias, ni `tsconfig` `paths`, ni `components.json`.

Le CLI **ne réécrit aucune importation** — vérifié octet pour octet sur cinq formes
d'import différentes. Un chemin relatif entre deux artefacts installés survit donc à
l'installation, **à condition que les deux fichiers atterrissent dans le même répertoire**,
ce que `~/` garantit.

`README.md` montre aujourd'hui `@/lib/signals`. C'est faux et ça doit changer : cet import
suppose un `aliases.lib` et un `tsconfig` avec `paths`, que rien dans le projet n'exige.

## 4. L'exigence `tsx: true`, et son coût

Les items **TypeScript** exigent `"tsx": true` dans le `components.json` du consommateur. Les
items **JavaScript** n'en ont pas besoin.

Un projet `tsx: false` qui installe `signals` obtient un `signals.js` contenant du
TypeScript, qui **échoue bruyamment** à la première exécution — mesuré : `SyntaxError`. Nous
avons choisi l'échec bruyant plutôt que le silence : un fichier cassé se voit, un
fonctionnement faux ne se voit pas.

## 5. Une contrainte sur la source de vérité

La transpilation de la CLI est un effacement de types, pas une compilation : elle **refuse
`declare`**. `declare brand: typeof BRAND_SYMBOL` est donc exclu de `signals.ts`.

`brand` doit rester sur le prototype — la matrice de conformité le fige, et `Object.keys` doit
rester à huit clés.

**Une assertion d'assignation définie ne convient pas.** `brand!: typeof BRAND_SYMBOL` crée une
propriété propre `undefined` sur chaque instance : le prototype est masqué et `Object.keys` passe
de huit clés à neuf. Mesuré, deux comportements figés cassés à la fois.

La forme correcte est une **fusion de déclaration**, hors du corps de classe :

```ts
export class Signal<T> { /* brand absent */ }
export interface Signal<T> { brand: typeof BRAND_SYMBOL }
```

Vérifié : typecheck à zéro erreur, `brand` lisible, huit clés, et survie à la vraie installation.
`implements` ne convient pas non plus — TypeScript exige que la classe déclare le membre.

Conséquence mesurée sur les commentaires : avec `registry:file`, le fichier installé est
**identique à la source, octet pour octet** — JSDoc d'en-tête, commentaires de ligne et JSDoc
attachés compris. Avec `registry:lib`, seul le bloc JSDoc d'en-tête était perdu. La convention
de commentaire de la source de vérité est donc libre de toute contrainte d'installation, et
elle est spécifiée dans [`site/technique/architecture.md`](../technique/architecture.md) §15.

## 6. La preuve : installation réelle

Les six items ont été installés dans un projet jetable, un par un, avec leurs dépendances.

| Item | Fichiers écrits | Erreurs |
|---|---|---|
| `signals` | 1 | 0 |
| `signals-test` | 2 | 0 |
| `signals-js` | 1 | 0 |
| `signals-test-js` | 2 | 0 |
| `signals-min` | 1 | 0 |
| `signals-test-min` | 2 | 0 |

Chaque item de test a tiré **exactement une** implémentation, jamais les cinq autres. Les six
fichiers ont atterri à la racine du projet, et le dossier `src/` du consommateur n'a pas été
touché.

Puis, chez un utilisateur qui n'a rien installé :

| Suite installée | Résultat |
|---|---|
| `signals.test.ts` | passe |
| `signals.test.js` | passe |
| `signals.test.min.js` | passe |
| import de `signals.min.js` | ESM valide |

## 7. La porte de CI

Un job crée un projet jetable, installe les six items, et exécute les trois suites installées.
C'est la seule preuve du critère « les six items sont installables » de `site/contributeurs/PRD.md` §9.

La validation de schéma ne suffit pas, et le projet en a deux exemples mesurés : un nom non
qualifié dans `registryDependencies` installe silencieusement l'homonyme d'un autre registre,
et un mauvais type de fichier produit un fichier non exécutable. Aucun des deux n'échoue à la
validation.

Cette porte a un coût qu'il faut assumer : elle télécharge la CLI shadcn.

## 8. Politique de version de la CLI shadcn

### Ce que le plancher protège, et ce qu'il ne protège pas

Le plancher est **`shadcn@4.10.0`**. Il ne vient pas du schéma d'item.

Vérifié en mesurant les quatre versions, avec `tsx: true`, sur un registry local :

| Version | Installation | Suite installée |
|---|---|---|
| 4.8.0 | 2 fichiers `.ts` | passe |
| 4.9.0 | 2 fichiers `.ts` | passe |
| 4.10.0 | 2 fichiers `.ts` | passe |
| 4.21.0 | 2 fichiers `.ts` | passe |

Le schéma d'item, les cibles `~/`, les `registryDependencies` et l'extension `.ts` fonctionnent
donc **jusqu'à 4.8.0**. Le plancher vient uniquement de l'**adressage `owner/repo/item`** —
c'est-à-dire de la façon dont un adopter réel installe, qui n'existe pas avant `4.10.0`.

Cette distinction est ce qui rend la matrice de la section 9 nécessaire : le plancher ne peut pas
être vérifié par un registry local, seulement par une adresse GitHub publiée.

### Ce que la CI teste

Une **matrice de deux versions** : le plancher déclaré, et la dernière connue.

Le plancher est une affirmation, et une affirmation non testée est un vœu. La dernière connue
est ce que la majorité des adoptes a installée. Tester les deux, c'est prouver qu'on sert
correctement les deux bouts.

Le coût est mesuré : le job d'installation passe de vingt-cinq à environ cinquante secondes.
C'est le seul surcoût, et il est connu.

### Les deux exigences de l'utilisateur

Le README les déclare dans sa section d'installation, **avec leur raison** :

| Exigence | Raison |
|---|---|
| `"tsx": true` dans le `components.json` | C'est ce drapeau qui décide de l'extension installée. Sans lui, l'item TypeScript arrive en `.js` contenant du TypeScript, et échoue bruyamment. |
| `shadcn@4.10.0` ou plus récent | L'adressage `owner/repo/item` n'existe pas avant. En dessous, l'installation échoue sur un item introuvable. |

Les deux sont vérifiées par la porte d'installation. Aucune n'est laissée à la relecture.

### Voir venir les ruptures

Un **canari non bloquant** exécute la porte d'installation avec `shadcn@latest`. Il ne bloque
aucune pull request, mais il signale à l'avance qu'une version à venir casse l'installation —
donc la montée se prépare au lieu d'être subie.

La version reste épinglée en `devDependency`. Le canari ne la remplace pas : il donne le
signal, la montée reste une décision.

### Ce que cette politique ne peut pas prouver

Tant que le `registry.json` n'est pas publié, **l'adressage `owner/repo/item` n'est pas
testable** — donc le plancher repose sur la recherche, pas sur une exécution de la CI. La
matrice le rend testable dès la première release, et c'est ce qui transforme le plancher en
fait.
