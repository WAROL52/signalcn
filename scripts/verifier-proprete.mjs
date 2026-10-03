/**
 * Porte de propreté.
 *
 *   node scripts/verifier-proprete.mjs
 *
 * Elle répond à une seule question : **le build du site a-t-il écrit hors de `site/` ?**
 *
 * Elle est nécessaire parce que `verifier-derive` ne voit pas tout ce qu'elle voit. Celle-là fait
 * un `git diff` sur `registry/default/`, et un `git diff` sans `--cached` ne parle QUE de fichiers
 * suivis : un fichier NEUF déposé dans ce répertoire passe, et un fichier écrit dans `docs/` passe
 * aussi. Un générateur de site n'a donc aucune raison de le faire tomber.
 *
 * Elle ne lance pas le build : elle en observe l'état, et c'est l'appelant qui pose l'ordre —
 * `porte` les enchaîne, le job de la CI les pose l'un après l'autre. Relancer le site ici
 * coûterait un build de plus à chaque exécution, pour observer la même chose.
 *
 * D'où l'instantané. `documentation-statique` écrit `git status` dans le répertoire que
 * `git rev-parse --git-dir` nomme — `.git/avant-build` dans un clone — AVANT de construire ; cette
 * porte relit cet instantané, relit l'état courant, et n'accuse que ce qui est devenu sale ENTRE LES
 * DEUX. Un arbre de travail sale n'est donc plus un échec : il est l'ensemble « avant ». Avant, elle
 * lisait le seul état courant et sa réponse était « la racine et `registry/` sont propres » — donc
 * une ligne modifiée de `CONTRIBUTING.md` suffisait à la faire tomber, avec un message qui
 * attribuait au build du site un fichier qu'il n'avait pas écrit. Voir
 * [#68](https://github.com/WAROL52/signalcn/issues/68).
 */

import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

import { cheminsGit, ecritsParBuild, RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()

// La preuve que le build a produit sa sortie est UN NOMBRE DE PAGES, pas un nom de fichier. Un nom
// était écrit dans l'espace de publication, donc il changeait avec lui : `dist/index.html` a
// disparu en même temps que la réécriture de #65, et la porte serait tombée au premier build sans
// qu'aucun site soit cassé. Un compte ne bouge pas quand l'espace de publication bouge.
const SORTIE = join(RACINE, "site", ".vitepress", "dist")
const pages = readdirSync(SORTIE, { recursive: true }).filter((nom) => nom.endsWith(".html"))

porte(
  "le build du site a produit sa sortie",
  pages.length > 0,
  `${SORTIE} ne porte aucune page — la porte se place APRES le build, jamais seule`,
)

// L'instantané est dans le répertoire que GIT nomme, et non dans `.git` en dur : un worktree a le
// sien, et une ligne qui l'écrit en dur casserait le job de déploiement — qui appelle le même
// `package.json`. C'est la même expression que celle de `documentation-statique`.
const instantane = resolve(
  RACINE,
  spawnSync("git", ["rev-parse", "--git-dir"], { cwd: RACINE, encoding: "utf8" }).stdout.trim(),
  "avant-build",
)

// Un instantané périmé ne prouve rien : il faut que le build ait tourné ENTRE les deux lectures, et
// c'est une DATE qui le dit. La page la plus récemment écrite de la sortie la donne — donc la
// preuve ne tient aucun nom de fichier, pour la raison que la première assertion porte déjà. Le
// test est `>=` et non `>` : sur un système de fichiers à la seconde, deux écritures de la même
// seconde tombent à égalité, et le cas le plus probable des deux est que le build ait tourné. Une
// sortie absente est un ÉCHEC bruyant, jamais un silence.
const mtimeDernierePage =
  pages.length === 0 ? 0 : Math.max(...pages.map((nom) => statSync(join(SORTIE, nom)).mtimeMs))
const avantStat = statSync(instantane, { throwIfNoEntry: false })

porte(
  "l'instantane d'avant-build precede la sortie du build",
  avantStat !== undefined && mtimeDernierePage >= avantStat.mtimeMs,
  avantStat === undefined
    ? `${instantane} est absent — la porte se place APRES \`npm run documentation-statique\`, qui l'ecrit avant de construire`
    : "la sortie du build n'est pas plus recente que l'instantane — donc le build n'a pas tourne depuis",
)

// Les DEUX lectures passent par le lecteur de `porte.mjs`, qui dit ce que `-z` garantit et ce qu'il
// ne garantit pas. `--untracked-files=all` déplie les répertoires : sans lui un fichier neuf dans un
// répertoire neuf n'apparaît que comme `?? site/`, et le build aurait alors écrit un nom de
// répertoire.
//
// Sans instantané, il n'y a rien à comparer et l'assertion précédente vient de nommer la cause : la
// comparaison ne s'y ferait pas, plutôt que d'y accuser le build d'un arbre de travail qu'il n'a pas
// sale. Une porte ne dit pas deux fois la même chose, et surtout pas la même chose à deux causes.
if (avantStat !== undefined) {
  const etatCourant = spawnSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], {
    cwd: RACINE,
    encoding: "utf8",
  })
  const ecrits = ecritsParBuild(
    cheminsGit(readFileSync(instantane, "utf8")),
    cheminsGit(etatCourant.stdout),
  )

  porte("le build du site n'ecrit rien hors de site/", ecrits.length === 0, ecrits.join(", "))
}

// La sortie du site est régénérée à chaque exécution : elle n'a rien à faire dans un diff, et elle
// n'y est que si `.gitignore` la couvre. La question est posée à GIT et pas lue dans le fichier —
// `.gitignore` reste la seule source, donc il n'y a pas de seconde liste à mettre à jour ici.
const ignore = spawnSync("git", ["check-ignore", "-q", "site/.vitepress/dist"], { cwd: RACINE })
porte(
  "la sortie du site est un fichier ignore par git",
  ignore.status === 0,
  "site/.vitepress/dist/ n'est pas dans .gitignore",
)

// La comparaison porte sur les CHEMINS, pas sur le contenu : un chemin déjà sale avant le build et
// modifié par lui passe, parce qu'il est dans les deux ensembles. Le `ponytail:` de `porte.mjs` en
// dit la portée et son seuil ; ici c'est ce que la porte admet ne pas voir, donc c'est écrit — sinon
// elle est verte sur deux tiers de son périmètre. Voir [#68](https://github.com/WAROL52/signalcn/issues/68).
console.log("  --   un chemin deja sale avant le build et modifie par lui passe")

cloture()
