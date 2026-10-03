/**
 * Porte de propreté.
 *
 *   node scripts/verifier-proprete.mjs
 *
 * Elle répond à une seule question : **le build du site a-t-il écrit ailleurs que sous `site/` ?**
 *
 * Elle est nécessaire parce que `verifier-derive` ne voit pas tout ce qu'elle voit. Celle-là fait
 * un `git diff` sur `registry/default/`, et un `git diff` sans `--cached` ne parle QUE de fichiers
 * suivis : un fichier NEUF déposé dans ce répertoire passe, et n'importe quoi écrit à la racine
 * passe aussi. Un générateur de site n'a donc aucune raison de le faire tomber.
 *
 * Elle ne lance pas le build : elle en observe l'état, et c'est l'appelant qui pose l'ordre —
 * `porte` les enchaîne, le job de la CI les pose l'un après l'autre. Relancer le site ici
 * coûterait un build de plus à chaque exécution, pour observer la même chose.
 *
 * Le périmètre est `registry/` et la racine, soit TOUT ce qu'un build a le droit d'écrire hors de
 * `site/`. Il ne couvre pas `site/` lui-même, qui contient des sources tenues à la main : y voir
 * du travail non committé serait normal, pas un défaut.
 */

import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

import { cheminsGit, RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()

const SORTIE = "site/.vitepress/dist/index.html"

porte(
  "le build du site a produit sa sortie",
  existsSync(join(RACINE, SORTIE)),
  `${SORTIE} est absent — la porte se place APRES le build, jamais seule`,
)

// Le lecteur est celui de `porte.mjs`, qui dit ce que `-z` garantit et ce qu'il ne garantit pas.
// `--untracked-files=all` déplie les répertoires : sans lui un fichier neuf dans un répertoire
// neuf n'apparaît que comme `?? site/`, et le test « la racine est-elle propre ? » verrait un nom
// de répertoire.
const etat = spawnSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], {
  cwd: RACINE,
  encoding: "utf8",
})

const sales = cheminsGit(etat.stdout).filter((p) => p.startsWith("registry/") || !p.includes("/"))

porte(
  "le build du site n'ecrit dans ni registry/ ni la racine",
  sales.length === 0,
  sales.join(", "),
)

// La sortie du site est régénérée à chaque exécution : elle n'a rien à faire dans un diff, et elle
// n'y est que si `.gitignore` la couvre. La question est posée à GIT et pas lue dans le fichier —
// `.gitignore` reste la seule source, donc il n'y a pas de seconde liste à mettre à jour ici.
const ignore = spawnSync("git", ["check-ignore", "-q", "site/.vitepress/dist"], { cwd: RACINE })
porte(
  "la sortie du site est un fichier ignore par git",
  ignore.status === 0,
  "site/.vitepress/dist/ n'est pas dans .gitignore",
)

cloture()
