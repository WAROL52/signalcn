/**
 * Outillage partagé des portes.
 *
 * `porte()` et le `RACINE` existaient en double dans deux verifieurs, et deux copies d'un
 * helper de test divergent : l'une gagne une option, l'autre non, et rien ne le dit. Le dépôt
 * a déjà tranché cette question — « une option qui vit à un seul endroit ne peut pas être
 * oubliée ailleurs » (`docs/ci.md`) — alors autant l'appliquer ici.
 */

import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Une assertion de porte. `condition` fausse fait tomber le code de sortie, et le détail dit
 * pourquoi — un « ECHEC » nu oblige à rejouer le test à la main.
 */
export function reporter(etat) {
  let echecs = 0

  const porte = (nom, condition, detail) => {
    if (condition) {
      console.log(`  ok   ${nom}`)
    } else {
      echecs++
      console.log(`  ECHEC ${nom}${detail ? ` — ${detail}` : ""}`)
    }
  }

  return {
    porte,
    /** Affiche le compte et rend la sortie. À appeler une fois, à la fin. */
    cloture: () => {
      console.log("")
      console.log(`  ${echecs} echec(s)`)
      if (echecs > 0) process.exit(1)
    },
    get echecs() {
      return echecs
    },
  }
}
