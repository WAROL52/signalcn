/**
 * La parité : une seule table de scénarios, exécutée quatre fois.
 *
 * Il n'existe pas de test de parité distinct, et c'est le principe. La table est écrite une fois,
 * dans le fichier distribué, et le harnais la rejoue contre la BASELINE réelle. Puis la même table,
 * avec les mêmes attentes figées, doit passer contre la SOURCE, le BUILD et le MINIFIÉ. Ce qui
 * diffère d'une cible à l'autre est un défaut — et il n'y a pas de liste de divergences
 * acceptables, parce qu'une telle liste est un seuil qu'on déplace à chaque fois qu'il gêne.
 *
 * Trois choses que le simple « les trois cibles passent » ne verrait pas, et qui sont le sujet de
 * ce fichier :
 *
 *   1. LE COMPTE. Une suite qui perd la moitié de ses tests en passant par le build est verte. Le
 *      compte est comparé au nombre de tests que le FICHIER déclare enregistrer, sur chaque cible,
 *      et ce nombre se déduit des structures du fichier plutôt que d'être écrit à la main.
 *
 *   2. LES NOMS, pas seulement le compte. Deux cibles peuvent afficher le même nombre de tests et
 *      ne pas exécuter les mêmes. Les ENSEMBLES de noms sont donc comparés, ce qui attrape une
 *      substitution un-pour-un que le compte laisse passer.
 *
 *   3. LE RENOMMAGE. Le minificateur renomme-t-il les propriétés ? On le teste en le faisant :
 *      un build où les propriétés internes sont raccourcies doit faire ÉCHOIR la suite. Si elle
 *      passait, c'est qu'elle n'atteint rien — et une suite verte qui ne teste rien est
 *      indiscernable d'une suite verte.
 *
 *   node scripts/verifier-parite.mjs
 */

import { build } from "esbuild"
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()
const ITEMS = join(RACINE, "registry", "default")

// Les dix exports, nommés. Une surface qui en perd un, ou qui en gagne un, échoue — les deux
// sens, parce qu'un export superflu n'est pas moins un engagement de compatibilité qu'un export
// manquant.
const EXPORTS = [
  "Computed",
  "Effect",
  "Signal",
  "action",
  "batch",
  "computed",
  "createModel",
  "effect",
  "signal",
  "untracked",
]

/** Les trois cibles signalcn, et le fichier de test qui les juge chacune. */
const CIBLES = [
  ["source", "signals.test.ts"],
  ["build", "signals.test.js"],
  ["minifie", "signals.test.min.js"],
]

const ran = (args, cwd = RACINE) => spawnSync(process.execPath, args, { cwd, encoding: "utf8" })

/**
 * Un passage de suite, avec tout ce qu'il faut pour le juger : le décompte du runner et les noms
 * de ce qu'il a réellement exécuté. Le TAP donne les deux, et rien d'autre ne les donne.
 */
function passer(cible) {
  const sortie = ran(["--test", "--test-reporter=tap", join(ITEMS, cible)])
  const nombre = (cle) => Number(sortie.stdout.match(new RegExp(`^# ${cle} (\\d+)$`, "m"))?.[1] ?? -1)
  return {
    code: sortie.status,
    pass: nombre("pass"),
    fail: nombre("fail"),
    skipped: nombre("skipped"),
    todo: nombre("todo"),
    noms: [...sortie.stdout.matchAll(/^ok \d+ - (.+?) \(/gm)].map((m) => m[1]),
  }
}

// --- 0. La PREMIÈRE cible : la baseline réelle -------------------------------------------
//
// Elle n'a pas de fichier de test : c'est le harnais, qui rejoue la table contre
// `@preact/signals-core` installé. Il est donc partie de cette porte plutôt que d'en être voisine —
// « une seule table, quatre cibles » ne tient que si les quatre sont jugées au même endroit.
const harnais = ran([join(RACINE, "scripts", "harnais.mjs")])
porte(
  "la baseline rejoue la table entiere",
  harnais.status === 0,
  harnais.status === 0 ? harnais.stdout.match(/\d+ scenarios, \d+ entrees/)?.[0] : harnais.stderr.slice(0, 400),
)

// --- 1. Les trois cibles signalcn ---------------------------------------------------------
const passes = {}
for (const [cible, fichier] of CIBLES) {
  const resultat = passer(fichier)
  passes[cible] = resultat

  // Le nombre que le FICHIEL déclare enregistrer, importé depuis CETTE cible. C'est ce qui rend
  // le compte auto-référentiel : ajouter un scénario change le compte attendu sans qu'aucune
  // constante soit à mettre à jour.
  const { NB_TESTS } = await import(join(ITEMS, fichier))
  porte(
    `${cible} : succes exactement egal au nombre de tests enregistres`,
    resultat.pass === NB_TESTS && resultat.code === 0,
    `${resultat.pass} succes, ${NB_TESTS} attendus`,
  )

  // L'exigence de comptage se paie ici. Deux verdicts qu'un runner seul peut donner sans faire
  // tourner un test : un fichier vide, et un fichier dont tout est ignoré. Le second est le piège —
  // une suite entièrement `skip` passe partout.
  porte(
    `${cible} : zero echec, zero ignore, zero todo`,
    resultat.fail === 0 && resultat.skipped === 0 && resultat.todo === 0,
    `fail ${resultat.fail}, skipped ${resultat.skipped}, todo ${resultat.todo}`,
  )
}

// --- 2. La tolérance entre cibles est ZÉRO ------------------------------------------------
for (const cible of ["build", "minifie"]) {
  const ecart = passes[cible].noms.filter((nom) => !passes.source.noms.includes(nom))
  porte(
    `${cible} execute exactement les memes tests que la source`,
    ecart.length === 0 && passes[cible].noms.length === passes.source.noms.length,
    ecart.join(", "),
  )
}

// --- 3. La surface, sur chaque cible -------------------------------------------------------
for (const cible of ["signals.ts", "signals.js", "signals.min.js"]) {
  const module = await import(join(ITEMS, cible))
  const reels = Object.keys(module).sort()
  const attendus = [...EXPORTS].sort()
  porte(
    `${cible} expose exactement les dix exports`,
    reels.length === attendus.length && reels.every((nom, i) => nom === attendus[i]),
    reels.join(" "),
  )
}

// --- 4. Le test minifié vise le runtime MINIFIÉ, pas le même ------------------------------
//
// C'est la porte qui attrape le build « vert mais faux » : si `signals.test.min.js` importait
// `./signals.js`, la suite minifiée judge le moteur non minifié et n'a plus rien à dire du
// fichier qu'on distribue. On vérifie donc l'import réel, et que les deux runtimes sont bien deux
// fichiers distincts sur le disque.
const runtimeDuTest = async (fichier) =>
  (await readFile(join(ITEMS, fichier), "utf8")).match(/import\("\.\/(signals(?:\.min)?\.js)"\)/)?.[1]

const cibleDuBuild = await runtimeDuTest("signals.test.js")
const cibleDuMinifie = await runtimeDuTest("signals.test.min.js")
porte("le test du build vise signals.js", cibleDuBuild === "signals.js", cibleDuBuild)
porte("le test minifie vise signals.min.js", cibleDuMinifie === "signals.min.js", cibleDuMinifie)
porte(
  "le runtime minifie est un fichier distinct du runtime non minifie",
  cibleDuBuild !== cibleDuMinifie &&
    (await readFile(join(ITEMS, "signals.js"), "utf8")) !==
      (await readFile(join(ITEMS, "signals.min.js"), "utf8")),
)

// --- 5. Le renommage de propriétés doit faire ÉCHOIR la suite ------------------------------
//
// On fait réellement le coup : un build où les propriétés internes sont raccourcies, dans un
// dossier temporaire, avec la suite du build à côté. Si elle passait, elle n'atteindrait rien.
const sablier = await mkdtemp(join(tmpdir(), "signalcn-mangle-"))
try {
  const mangle = await build({
    entryPoints: [join(ITEMS, "signals.js")],
    bundle: false,
    format: "esm",
    target: "es2020",
    write: false,
    mangleProps: /_([a-zA-Z])/,
  })
  await writeFile(join(sablier, "signals.js"), mangle.outputFiles[0].text)
  await copyFile(join(ITEMS, "signals.test.js"), join(sablier, "signals.test.js"))

  const renommee = ran(["--test", "--test-reporter=tap", join(sablier, "signals.test.js")], sablier)
  porte(
    "un renommage de proprietes fait echouer la suite",
    renommee.status !== 0,
    `la suite passe encore sur un runtime aux proprietes raccourcies`,
  )
} finally {
  await rm(sablier, { recursive: true, force: true })
}

cloture()