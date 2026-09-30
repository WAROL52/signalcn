/**
 * La chaîne de build. Une commande, et c'est tout.
 *
 *   node scripts/build.mjs
 *
 * Trois temps, dans cet ordre :
 *
 *   1. `tsc` émet le `.js` À CÔTÉ de la source, dans `registry/default/`. Pas de `outDir` : les
 *      artefacts sont committés à côté des `.ts`, et la CI échoue si cette commande modifie un
 *      fichier committé — donc un artefact périmé ne peut pas passer.
 *   2. esbuild minifie chaque `.js` en `.min.js`, avec `--keep-names`.
 *   3. la suite minifiée pointe vers le runtime minifié. C'est le SEUL fichier dont le
 *      specifier est réécrit, et c'est nécessaire : sans cela `signals.test.min.js` importerait
 *      `signals.js`, et la cible « minifiée » ne testerait en réalité que le build.
 *
 * Le specifier `.ts` du fichier de test, lui, n'est PAS réécrit à la main : c'est
 * `rewriteRelativeImportExtensions` de `tsc` qui le transforme en `.js` à l'émission — y
 * compris pour un `import()` dynamique.
 *
 * Rien n'est compilé deux fois et rien n'est bundlé : le produit distribué est la source.
 */

import { build } from "esbuild"
import { readdir, unlink, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ITEMS = join(RACINE, "registry", "default")

// Les artefacts périmés disparaissent avant le build : un `.min.js` dont la source a été
// renommée resterait là, et rien ne le signalerait.
for (const fichier of await readdir(ITEMS)) {
  if (fichier.endsWith(".js") || fichier.endsWith(".js.map")) await unlink(join(ITEMS, fichier))
}

const tsc = spawnSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: ITEMS, encoding: "utf8" })
if (tsc.status !== 0) {
  console.error(tsc.stdout || tsc.stderr)
  process.exit(1)
}

let nombre = 0
for (const fichier of (await readdir(ITEMS)).sort()) {
  if (!fichier.endsWith(".js")) continue

  const minifie = await build({
    entryPoints: [join(ITEMS, fichier)],
    bundle: false,
    format: "esm",
    target: "es2020",
    platform: "neutral",
    write: false,
    // `--keep-names` n'est pas une coquetterie : la matrice fige le nom du wrapper d'action, qui
    // se lit dans les traces d'erreur. Une matrice figée sur un nom ne tient pas si le
    // minificateur le renomme. Seuls les noms INTERNES sont en jeu : un nom exporté survit de
    // lui-même, puisque c'est l'interface publique du module.
    keepNames: true,
    minify: true,
  })

  let code = minifie.outputFiles[0].text
  if (fichier === "signals.test.js") {
    code = code.replaceAll('"./signals.js"', '"./signals.min.js"')
  }

  await writeFile(join(ITEMS, fichier.replace(/\.js$/, ".min.js")), code)
  nombre++
}

console.log(`  ${nombre} artefacts minifiés dans registry/default/`)
