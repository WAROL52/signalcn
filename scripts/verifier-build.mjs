/**
 * Portes du build.
 *
 * Quatre propriétés qu'aucun test ne peut voir, parce qu'elles sont des propriétés du OUTIL et
 * non du moteur :
 *
 *   1. deux builds produisent des fichiers identiques — sinon la dérive est indétectable ;
 *   2. `--keep-names` fait vraiment son travail — la matrice fige des noms ;
 *   3. le minifié est plus petit que le non-minifié ;
 *   4. aucun artefact ne pointe vers un `.ts` — le projet utilisateur n'a pas de TypeScript.
 *
 *   node scripts/verifier-build.mjs
 */

import { build } from "esbuild"
import { readFile, readdir } from "node:fs/promises"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()
const ITEMS = join(RACINE, "registry", "default")


const empreintes = async () => {
  const sortie = {}
  for (const fichier of (await readdir(ITEMS)).sort()) {
    sortie[fichier] = createHash("sha256").update(await readFile(join(ITEMS, fichier))).digest("hex")
  }
  return sortie
}

// 1. Reproductibilité. On rejoue le build dans ce processus-ci plutôt que de faire confiance à
//    l'ordre des appels du script : la porte échoue si le build cesse d'être déterministe.
const avant = await empreintes()
const relance = spawnSync(process.execPath, [join(RACINE, "scripts", "build.mjs")], {
  encoding: "utf8",
})
if (relance.status !== 0) {
  console.log(`  ECHEC le second build a échoué\n${relance.stderr}`)
  process.exit(1)
}
const apres = await empreintes()
const identique = JSON.stringify(avant) === JSON.stringify(apres)
porte(
  "reproductibilite : deux builds, memes octets",
  identique,
  identique ? "" : `${JSON.stringify(avant)} != ${JSON.stringify(apres)}`,
)

/**
 * 2. `--keep-names`.
 *
 * Le drapeau ne sert qu'aux noms INTERNES. Un nom exporté survit de lui-même : c'est
 * l'interface publique du module, le minificateur ne peut pas y toucher. Et ce sont justement
 * les noms internes qui sont figés — la matrice lit `actionWrapper.name` dans des traces
 * d'erreur, et `actionWrapper` n'est pas exporté.
 *
 * On minifie donc une fonction locale nommée, avec et sans le drapeau. Sans lui, le nom part.
 * Cette porte échouera le jour où quelqu'un retire le drapeau — et ce jour-là, la moitié de la
 * matrice, celle qui fige des noms, devient fausse sans qu'aucun test ne le dise.
 */
const sonde = "function nomInterne(){ return 1 }\nexport function expose(){ return nomInterne() }"
const minifier = async keepNames => {
  const resultat = await build({
    stdin: { contents: sonde, sourcefile: "sonde.js", loader: "js" },
    bundle: false,
    format: "esm",
    target: "es2020",
    write: false,
    keepNames,
    minify: true,
  })
  return resultat.outputFiles[0].text
}
const avec = await minifier(true)
const sans = await minifier(false)
porte("keep-names conserve un nom interne", avec.includes("nomInterne"), avec.trim())
porte("keep-names est load-bearing (sans lui, le nom part)", !sans.includes("nomInterne"))

// 3. Le minifié est strictement plus petit que le non-minifié.
for (const item of ["signals", "signals.test"]) {
  const plein = await readFile(join(ITEMS, `${item}.js`), "utf8")
  const minifie = await readFile(join(ITEMS, `${item}.min.js`), "utf8")
  porte(
    `${item}.min.js est strictement plus petit`,
    minifie.length < plein.length,
    `${minifie.length} >= ${plein.length}`,
  )
}

// 4. Aucun ARTEFACT ne demande un fichier `.ts`. Les sources, elles, doivent en parler : la
//    source s'exécute là où le TypeScript est présent, et c'est `tsc` qui la réécrit à
//    l'émission. Ce que le projet utilisateur reçoit ne peut pas, lui, exiger un compilateur.
for (const fichier of (await readdir(ITEMS)).sort()) {
  if (!fichier.endsWith(".js")) continue
  const contenu = await readFile(join(ITEMS, fichier), "utf8")
  const fuite = [...contenu.matchAll(/(?:from|import)\s*\(?\s*"([^"]+\.ts)"/g)].map(m => m[1])
  porte(`${fichier} ne pointe vers aucun .ts`, fuite.length === 0, fuite.join(", "))
}

cloture()
