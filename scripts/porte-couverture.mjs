/**
 * La porte de couverture. Elle porte trois choses, et chacune répond à un trou qu'aucune des
 * deux autres ne voit.
 *
 *   1. TROIS SEUILS NATIFS. Lines, branches, fonctions, appliqués par le runner lui-même
 *      (`--test-coverage-lines` et consorts), qui sort en code d'échec. On ne recalcule rien :
 *      opposables veut dire « le runner dit non », pas « notre script dit non ».
 *
 *   2. LA GARDE DU CODE MORT. Un relevé de couverture ne mesure que ce qui a été CHARGÉ. Un
 *      fichier source que personne n'importe est donc invisible : il n'apparaît ni dans les
 *      lignes, ni dans les branches, ni dans les fonctions, et aucun seuil ne peut le voir. On
 *      compare donc le disque aux scripts que le moteur de couverture a vus. C'est le seul
 *      contrôle de la porte qui ne soit pas un pourcentage.
 *
 *   3. LA NON-RÉGRESSION. En pull request, chaque métrique doit être au moins égale à celle du
 *      MERGE-BASE — et cette base est RECALCULÉE dans un worktree secondaire. Une base stockée
 *      dans un fichier committé se forge dans la pull request même qui la viole : le fichier
 *      et le changement de seuil arrivent dans le même commit. Il n'y a donc rien à stocker,
 *      et c'est pour cette raison qu'il n'y a rien àITORiser non plus.
 *
 * Le relevé ne porte que sur la source, par un MOTIF sur le répertoire de la source. Les
 * artefacts générés sont en `.js` et le motif ne les prend pas — ce n'est pas un filtrage
 * afterthought, c'est ce qui rend le chiffre lisible : « la couverture de `signals.ts` » et
 * « la couverture de ce qu'on distribue » sont deux questions différentes.
 */

import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ICI = fileURLToPath(import.meta.url)
const RACINE = join(ICI, "..", "..")
const MOTIF = "registry/default/*.ts"
const SUITE = "registry/default/signals.test.ts"

/**
 * Le plancher, et la seule chose qui distingue un commit d'une release.
 *
 * Au tag, les trois seuils passent à cent pour cent absolus. Ailleurs, ce sont les valeurs
 * MESURÉES au moment où le plancher est écrit, arrondies à l'entier inférieur. L'entier est une
 * limite assumée : un seuil natif ne sait pas dire 99,62. C'est exactement le trou que la
 * non-régression comble, puisqu'elle compare des valeurs calculées et non des entiers — d'où
 * les deux mécanismes plutôt qu'un seul.
 */
function seuils() {
  const auTag =
    spawnSync("git", ["tag", "--points-at", "HEAD"], { cwd: RACINE, encoding: "utf8" }).stdout.trim() !==
    ""
  if (auTag) return { lignes: 100, branches: 100, fonctions: 100 }
  return { lignes: 99, branches: 95, fonctions: 98 }
}

/**
 * Le relevé. `spawnSync` et non `execFileSync` parce qu'on veut le CODE DE SORTIE sans que le
 * jeton arrête le contrôle suivant : un seul run doit pouvoir dire « les seuils ne passent pas »
 * ET « il y a du code mort ». Deux runs donneraient deux messages, pour le même état du dépôt.
 */
function mesurer(dossier, planifier = {}) {
  const nom = planifier.nom ?? "courant"
  const sortie = join(tmpdir(), `signalcn-lcov-${nom}.info`)
  const vus = mkdtempSync(join(tmpdir(), `signalcn-v8c-${nom}-`))
  const drapeaux = [
    "--experimental-test-coverage",
    `--test-coverage-include=${MOTIF}`,
    "--test-reporter=lcov",
    `--test-reporter-destination=${sortie}`,
  ]
  if (planifier.lignes !== undefined) drapeaux.push(`--test-coverage-lines=${planifier.lignes}`)
  if (planifier.branches !== undefined) drapeaux.push(`--test-coverage-branches=${planifier.branches}`)
  if (planifier.fonctions !== undefined) drapeaux.push(`--test-coverage-functions=${planifier.fonctions}`)
  drapeaux.push("--test", SUITE)

  const resultat = spawnSync(process.execPath, drapeaux, {
    cwd: dossier,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, NODE_V8_COVERAGE: vus },
  })
  const brut = { ...lireLcov(sortie), vus: scriptsVus(vus, dossier) }
  rmSync(vus, { recursive: true, force: true })
  rmSync(sortie, { force: true })
  return { metriques: brut, code: resultat.status }
}

/**
 * Les scripts que V8 a RÉELLEMENT exécutés, par `NODE_V8_COVERAGE`. C'est la source de la garde
 * du code mort, et pas les enregistrements du rapport de couverture : le rapport ne liste que ce
 * qui a été mesuré, alors que V8 sait en plus dire ce qui a été exécuté SANS être mesuré — le
 * fichier de test en est le cas, et c'est pourquoi on n'a aucune exception à écrire pour lui.
 *
 * L'ensemble est ramené à des chemins relatifs au dépôt, sinon la comparaison avec le disque
 * serait un match de chaînes qui ne se rencontre jamais.
 */
function scriptsVus(dossier, racine) {
  const vus = new Set()
  for (const fichier of readdirSync(dossier)) {
    for (const rapport of JSON.parse(readFileSync(join(dossier, fichier), "utf8")).result ?? []) {
      if (!rapport.url?.startsWith("file://")) continue
      vus.add(relative(racine, fileURLToPath(rapport.url)))
    }
  }
  return vus
}

/** Somme les compteurs lcov de tous les enregistrements, et retient les fichiers vus. */
function lireLcov(fichier) {
  if (!existsSync(fichier)) throw new Error(`le runner n'a produit aucun relevé : ${fichier}`)
  const brut = readFileSync(fichier, "utf8")
  const compte = { lignes: [0, 0], branches: [0, 0], fonctions: [0, 0] }

  for (const ligne of brut.split("\n")) {
    if (ligne.startsWith("LF:")) compte.lignes[1] += Number(ligne.slice(3))
    else if (ligne.startsWith("LH:")) compte.lignes[0] += Number(ligne.slice(3))
    else if (ligne.startsWith("BRF:")) compte.branches[1] += Number(ligne.slice(4))
    else if (ligne.startsWith("BRH:")) compte.branches[0] += Number(ligne.slice(4))
    else if (ligne.startsWith("FNF:")) compte.fonctions[1] += Number(ligne.slice(4))
    else if (ligne.startsWith("FNH:")) compte.fonctions[0] += Number(ligne.slice(4))
  }

  const taux = (pair) => (pair[1] === 0 ? 100 : (pair[0] / pair[1]) * 100)
  return {
    lignes: taux(compte.lignes),
    branches: taux(compte.branches),
    fonctions: taux(compte.fonctions),
  }
}

const METRIQUES = ["lignes", "branches", "fonctions"]
const deux = (n) => (Math.floor(n * 100) / 100).toFixed(2)

/**
 * Le code mort. Le disque d'un côté, les scripts vus par V8 de l'autre, et ce qui est sur le
 * premier sans être sur le second n'a jamais été exécuté — donc n'apparaît dans aucun relevé, à
 * aucun pourcentage, et qu'aucun seuil ne peut voir.
 */
function codeMort(dossier, vus) {
  const source = join(dossier, "registry", "default")
  return readdirSync(source)
    .filter((fichier) => fichier.endsWith(".ts"))
    .map((fichier) => `registry/default/${fichier}`)
    .filter((chemin) => !vus.has(chemin))
}

/**
 * Les exclusions de couverture sont INTERDITES dans ce dépôt. On ne cherche pas seulement le
 * drapeau du runner : `c8 ignore`, `istanbul ignore` et `v8 ignore` sont les trois autres
 *arkdowndu même geste, et chacun baisse le chiffre sans changer une ligne de comportement.
 *
 * Le fichier qui contient les motifs est le seul qu'on ne cherche pas — sans quoi la porte
 * s'échouerait elle-même à sa deuxième exécution. C'est une exception nommée, pas une exclusion
 * silencieuse : elle vaut pour ce fichier-ci et pas pour les suivants.
 */
function exclusionsInterdites() {
  const suspects = [
    ["--test-coverage-exclude", "exclusion de couverture du runner"],
    ["c8 ignore", "commentaire d'exclusion c8"],
    ["istanbul ignore", "commentaire d'exclusion istanbul"],
    ["v8 ignore", "commentaire d'exclusion v8"],
  ]
  const trouves = []
  const suivis = spawnSync("git", ["ls-files", "-z"], { cwd: RACINE, encoding: "utf8" })
    .stdout.split("\0")
    .filter(Boolean)

  for (const fichier of suivis) {
    if (join(RACINE, fichier) === ICI) continue
    // La PROSE peut nommer le drapeau interdit — SPEC.md et ADR-0007 le font, en le
    // interdisant. Chercher dans un document qui écrit « n'utilisez pas X » échouerait la porte
    // sur la règle qui la définit. Seuls l'outillage et sa configuration sont cherchés : un
    // drapeau n'yVit que s'il peut être exécuté.
    if (fichier.endsWith(".js")) continue
    if (fichier.endsWith(".md") || fichier.startsWith("research/")) continue
    if (!/^(scripts\/|\.github\/|registry\/default\/)/.test(fichier) && fichier !== "package.json") continue
    const texte = readFileSync(join(RACINE, fichier), "utf8")
    for (const [motif, nom] of suspects) {
      if (texte.includes(motif)) trouves.push(`${fichier} — ${nom}`)
    }
  }
  return trouves
}

/**
 * La base, recalculée. Un worktree détaché sur le merge-base, dans le répertoire temporaire du
 * système : rien n'entre dans le dépôt, donc rien n'y peut être falsifié par la pull request qui
 * déclenche la porte.
 *
 * `node_modules` est un lien symbolique vers celui du dépôt courant : le runner natif exécute le
 * `.ts` par retrait de types, il n'a besoin de rien d'autre que `@preact/signals-core`. Le
 * généraliser — une installation complète par worktree — coûterait vingt-cinq secondes pour le
 * même chiffre.
 *
 * ponytail: un `node_modules` partagé suppose que le merge-base a les mêmes dépendances que
 * HEAD. Vrai tant que la seule chose qui change entre deux commits est le moteur ; si une
 * dépendance bouge, il faut `npm ci` dans le worktree.
 */
function baseDuMergeBase() {
  const candidat = ["origin/master", "master", "main"]
    .map((ref) => ({ ref, present: spawnSync("git", ["rev-parse", "--verify", ref], { cwd: RACINE }).status === 0 }))
    .find((c) => c.present)

  if (!candidat) return null
  const fusion = spawnSync("git", ["merge-base", "HEAD", candidat.ref], {
    cwd: RACINE,
    encoding: "utf8",
  }).stdout.trim()
  if (!fusion || fusion === "") return null

  const typeFusion = spawnSync("git", ["merge-base", "--is-ancestor", fusion, "HEAD"], {
    cwd: RACINE,
  }).status
  const worktree = mkdtempSync(join(tmpdir(), "signalcn-base-"))
  const ajoute = spawnSync("git", ["worktree", "add", "--detach", worktree, fusion], {
    cwd: RACINE,
    stdio: ["ignore", "inherit", "inherit"],
  })
  if (ajoute.status !== 0) {
    rmSync(worktree, { recursive: true, force: true })
    return null
  }

  try {
    symlinkSync(join(RACINE, "node_modules"), join(worktree, "node_modules"), "dir")
    const { metriques } = mesurer(worktree, { nom: "base" })
    return { ref: candidat.ref, fusion, metriques, ancetre: typeFusion === 0 }
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", worktree], { cwd: RACINE })
    rmSync(worktree, { recursive: true, force: true })
  }
}

let echecs = 0
const planter = (message) => {
  console.error(`  ECHEC ${message}`)
  echecs++
}

// --- 1. les seuils, appliqués par le runner -----------------------------------------------
const plancher = seuils()
console.log(`  motifs ${MOTIF} / seuils ${METRIQUES.map((m) => `${m} ${plancher[m]}`).join(", ")}`)
const courant = mesurer(RACINE, plancher)
const base = baseDuMergeBase()

if (courant.code !== 0) {
  planter(`un seuil natif n'est pas atteint (sortie ${courant.code})`)
} else {
  console.log(
    `  ok   releve ${METRIQUES.map((m) => `${m} ${deux(courant.metriques[m])}%`).join(", ")}`,
  )
}

// --- 2. la non-régression, base recalculée ------------------------------------------------
if (!base) {
  console.log("  --   pas de merge-base : non-regression non applicable (branche de travail)")
} else if (!base.ancetre) {
  console.log("  --   le merge-base n'est pas un ancetre de HEAD : non-regression non applicable")
} else {
  for (const metrique of METRIQUES) {
    if (courant.metriques[metrique] < base.metriques[metrique]) {
      planter(
        `regression ${metrique} : ${deux(base.metriques[metrique])}% a la base (${base.ref}) ` +
          `-> ${deux(courant.metriques[metrique])}%`,
      )
    }
  }
  if (echecs === 0) {
    console.log(
      `  ok   pas de regression face a ${base.fusion.slice(0, 8)} (${base.ref}), recalculee sur place`,
    )
  }
}

// --- 3. le code mort -----------------------------------------------------------------------
const morts = codeMort(RACINE, courant.metriques.vus)
if (morts.length > 0) {
  planter(`jamais charges par la suite : ${morts.join(", ")}`)
} else {
  console.log("  ok   aucun fichier source jamais charge")
}

// --- 4. les exclusions interdites ---------------------------------------------------------
const exclusions = exclusionsInterdites()
if (exclusions.length > 0) {
  planter(`exclusion de couverture : ${exclusions.join(", ")}`)
} else {
  console.log("  ok   aucune exclusion de couverture dans le depot")
}

if (echecs > 0) {
  console.error(`\n  ${echecs} echec(s)`)
  process.exit(1)
}