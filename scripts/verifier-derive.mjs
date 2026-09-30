/**
 * Porte de dérive.
 *
 * Le build produit des fichiers committés. Après l'avoir lancé, on exige que le dépôt soit
 * propre : ce qui est committé est exactement ce que le build produit.
 *
 *   node scripts/verifier-derive.mjs
 *
 * Ce que la porte attrape, et il faut le dire précisément parce que la forme est trompeuse :
 * elle lance le build AVANT le diff, donc elle ne détecte pas un artefact qu'on a modifié à la
 * main — le build le régénère et le diff est vide. C'est le comportement voulu : le build fait
 * autorité.
 *
 * Elle attrape deux choses, toutes deux réelles :
 *   - un artefact committé que le build ne produit plus, typiquement un `.js` laissé derrière
 *     après un renommage de source : le build le supprime, le diff le montre ;
 *   - un build devenu non reproductible, où le build réécrit ce qui est committé à chaque
 *     exécution. La reproductibilité elle-même est vérifiée par `verifier-build`.
 *
 * Le contrôle est un `git diff`, pas une comparaison de condensats : c'est équivalent puisque
 * le build est reproductible, et le diff dit QUOI a changé, ce qu'un « condensats différents »
 * ne dit pas.
 */

import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function dansRacine(args) {
  return spawnSync(args[0], args.slice(1), { cwd: RACINE, encoding: "utf8" })
}

const build = dansRacine([process.execPath, "scripts/build.mjs"])
if (build.status !== 0) {
  console.error("  ECHEC le build a échoué")
  console.error(build.stdout || build.stderr)
  process.exit(1)
}

const diff = dansRacine(["git", "diff", "--stat", "--", "registry/default/"])
const modifie = diff.stdout.trim() !== ""

if (modifie) {
  console.log("  ECHEC le build a modifie un artefact commite :")
  console.log(
    diff.stdout
      .split("\n")
      .map(l => `    ${l}`)
      .join("\n"),
  )
  process.exit(1)
}

console.log("  ok   le build ne modifie aucun artefact commite")
