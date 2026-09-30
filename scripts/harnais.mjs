/**
 * Harnais différentiel.
 *
 * Un seul principe : la table de scénarios est écrite UNE fois, dans le fichier distribué, et
 * jouée contre deux API. Ce qui n'est pas le même sort des deux est un défaut, de notre côté
 * ou du côté de la baseline.
 *
 * Ce programme ne juge que la baseline. Le côté signalcn, c'est `node --test`, et ce sont les
 * mêmes scénarios. Deux jugements indépendants, une seule table.
 *
 *   node scripts/harnais.mjs
 */

import * as baseline from "@preact/signals-core"

import { reporter } from "./porte.mjs"

// Le fichier distribué n'enregistre ses tests `node:test` que si `NODE_TEST_CONTEXT` est posé,
// et il ne l'est pas ici. L'import ne déclenche donc AUCUN test : le harnais ne recompte pas la
// suite de signalcn, il rejoue la table contre la seule baseline. C'est le comportement voulu —
// la cible signalcn, c'est `node --test`, et ce sont les mêmes scénarios.
import { scenarios, makeLog } from "../registry/default/signals.test.ts"

const { porte, cloture: reporterCloture } = reporter()

// La surface injectee est celle de la table, pas celle du premier jet : le harnais rejoue la
// table, et la table ne demande que ce qu elle utilise.
const baselineApi = {
  signal: baseline.signal,
  computed: baseline.computed,
  Signal: baseline.Signal,
  Computed: baseline.Computed,
}

let nan = 0
let total = 0

for (const scenario of scenarios) {
  total++
  nan += scenario.matrice.length
  const libelle = `${scenario.name}  [${scenario.matrice.join(" ")}]`

  let raison
  try {
    scenario.run(baselineApi, makeLog())
    porte(libelle, true)
  } catch (erreur) {
    raison = erreur instanceof Error ? erreur.message.split("\n").slice(0, 3).join(" ") : String(erreur)
    porte(libelle, false, raison)
  }
}

console.log("")
console.log(`  ${total} scenarios, ${nan} entrees de matrice`)

reporterCloture()
