# Installer

Où atterrit un artefact, ce que le projet exige avant, et pourquoi il échoue bruyamment sinon.

| Vous voulez | Allez à |
| --- | --- |
| installer sans lire pourquoi | [Une commande](#une-commande) |
| savoir **quel** item installer | [Le premier item](#le-premier-item) |
| comprendre une exigence qu'on vous refuse | [Les deux exigences](#les-deux-exigences) |
| comprendre d'où vient un fichier installé | [Le fait qui décide de tout](#le-fait-qui-decide-de-tout) |
| savoir ce que l'installation **ne** garantit pas | [Ce que l'installation ne prouve pas](#ce-que-l-installation-ne-prouve-pas) |

Ce que vous copiez dans votre code — le chemin d'import et la surface publique — est dans le
[`README.md`](/README.md). Cette fiche ne les répète pas.

## Une commande

```bash
npx shadcn@latest add WAROL52/signalcn/signals
```

Le fichier atterrit à la **racine de votre projet**, sous le nom `signals.ts`. Ni alias, ni
`tsconfig` `paths`, ni paquet : c'est un fichier, et il s'importe par un chemin relatif.

Les cinq autres items existent, mais ils ne s'installent pas avec celui-là. Les six sont dans le
[`README.md`](/README.md).

## Le premier item

`signals` est le seul que vous installeriez d'abord. Il est le moteur.

Si vous migrez depuis `@preact/signals-core`, vous n'avez rien à installer en parallèle : c'est lui
que vous remplacez.

## Les deux exigences

Elles ne sont pas des recommandations. Sans elles, l'installation **réussit** et le fichier installé
**ne démarre pas**. Les deux sont vérifiées à chaque pull request sur deux versions de la CLI.

| Exigence | Raison |
|---|---|
| `"tsx": true` dans `components.json` | C'est ce drapeau — et lui seul — qui décide de l'extension du fichier installé. Les items TypeScript arrivent en `.ts` seulement avec lui ; sans lui, l'extension est imposée et le fichier contient du TypeScript sous un nom `.js`. |
| `shadcn` **`4.10.0`** ou plus récent | L'installation se fait par adresse `owner/repo/item`, et cet adressage n'existe pas avant cette version. En dessous, la commande ne résout rien. |

> **Marqueur** — si le fichier s'exécute, c'est tout ce qu'il fallait. Le reste explique d'où vient
> ce que vous voyez, et sert si une installation vous surprend.

## Le fait qui décide de tout

`components.json` porte un drapeau `tsx`, et c'est lui — pas le type de fichier, pas la cible — qui
décide de l'extension installée. Mesuré sur les seize combinaisons possibles :

| `tsx` | Type de fichier | Source `.ts` | Extension installée | Transpilation |
|---|---|---|---|---|
| **`true`** | `registry:file` | `signals.ts` | **`.ts`** | aucune, le TypeScript est conservé |
| **`true`** | `registry:lib` | `signals.ts` | `.ts` | aucune |
| `false` | `registry:lib` | `signals.ts` | `.js` | oui, correct |
| `false` | `registry:file` | `signals.ts` | `.js` | **aucune — fichier cassé** |

Avec `tsx: true`, `target` est respecté à l'extension près et **rien n'est transpilé**. Avec
`tsx: false`, l'extension est imposée et seule `registry:lib` transpile.

Conséquence directe : `signals.ts` et `signals.js` peuvent coexister **uniquement** si `tsx: true`.
Sinon les deux items convergent vers le même nom de fichier et s'écrasent.

La configuration du dépôt retient donc `registry:file` partout : l'artefact est installé tel qu'il
est, ce qui est la seule configuration correcte pour un projet `tsx: true`. Le raisonnement est dans
[ADR-0008](/docs/adr/0008-registry-file-partout-et-tsx-true-exige.md).

### L'échec bruyant

Un projet `tsx: false` qui installe `signals` obtient un `signals.js` contenant du TypeScript, qui
échoue à la première exécution — mesuré : `SyntaxError`. Nous avons choisi l'échec bruyant plutôt
que le silence : un fichier cassé se voit, un fonctionnement faux ne se voit pas.

## Ce que l'installation ne prouve pas

Trois choses que le fichier installé ne dit pas de lui-même.

**Que la version de CLI est compatible.** L'adressage `owner/repo/item` existe depuis `4.10.0` :
en dessous, la commande échoue. La matrice de la CI éprouve le plancher déclaré et la dernière
version connue, parce qu'une affirmation non testée est un vœu.

**Que le comportement est conforme.** Un fichier qui s'exécute n'est pas un fichier conforme. La
preuve est une **table de scénarios rejouée contre la référence réelle**, et elle est décrite dans
[la fiche de vérification](./verifier-artefact-installe.md).

**Que le code mort n'est pas livré.** La couverture mesure le chemin exercé, pas le chemin livré.

La preuve d'installation — six items installés dans un projet jetable, un par un, puis trois suites
exécutées chez un utilisateur qui n'a rien installé — est dans
[`site/contributeurs/ci.md`](../contributeurs/ci.md) §3.