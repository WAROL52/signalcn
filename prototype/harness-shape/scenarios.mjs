// ── LE MORCEAU QUI VIT DANS signals.test.ts ────────────────────────────────
// Une table pure : aucun import de framework, aucune dépendance.
// Chaque scénario reçoit l'API et un journal, et porte ses propres assertions.

import assert from "node:assert/strict"

export const scenarios = [
  {
    // SPEC §5.2 — l'égalité est une identité stricte, PAS une identité de valeur
    name: "signal/egalite-stricte-nan-notifie",
    run(api, log) {
      const s = api.signal(1)
      api.effect(() => log("run", s.value))
      s.value = NaN
      s.value = NaN
      log("valeur", String(s.value))
      assert.deepEqual(log.entries, ["run 1", "run NaN", "run NaN", "valeur NaN"])
    },
  },
  {
    // SPEC §5.2 — 0 et -0 sont indiscernables, l'écriture est ignorée
    name: "signal/zero-et-negative-zero",
    run(api, log) {
      const s = api.signal(0)
      api.effect(() => log("run", s.value))
      s.value = -0
      log("apres 0 -> -0", Object.is(s.value, -0))
      s.value = 0
      log("apres -0 -> 0", Object.is(s.value, 0))
      assert.deepEqual(log.entries, ["run 0", "apres 0 -> -0 false", "apres -0 -> 0 true"])
    },
  },
  {
    // SPEC §13.4 — le flush est l'INVERSE de l'ordre de notification
    name: "batch/ordre-de-flush-lifo",
    run(api, log) {
      const a = api.signal(0), b = api.signal(0), c = api.signal(0)
      api.effect(() => log("A", a.value))
      api.effect(() => log("B", b.value))
      api.effect(() => log("C", c.value))
      api.batch(() => { a.value = 1; b.value = 1; c.value = 1 })
      assert.deepEqual(log.entries, ["A 0", "B 0", "C 0", "C 1", "B 1", "A 1"])
    },
  },
  {
    // SPEC §13.4 — MAIS sur un seul signal, c'est l'ordre de création
    name: "batch/ordre-sur-un-seul-signal",
    run(api, log) {
      const s = api.signal(0)
      for (let i = 1; i <= 4; i++) api.effect(() => log("d" + i, s.value))
      s.value = 1
      assert.deepEqual(log.entries, ["d1 0", "d2 0", "d3 0", "d4 0", "d1 1", "d2 1", "d3 1", "d4 1"])
    },
  },
  {
    // SPEC §6 — trois lectures ne donnent qu'une évaluation
    name: "computed/evaluation-mise-en-cache",
    run(api, log) {
      const a = api.signal(1)
      let calls = 0
      const c = api.computed(() => { calls++; return a.value * 2 })
      c.value; c.value; c.value
      log("evaluations", calls)
      a.value = 2
      log("apres ecriture", calls)
      assert.deepEqual(log.entries, ["evaluations 1", "apres ecriture 1"])
    },
  },
]

// Le journal : ce qui est comparé, ce qui est journalisé
export function makeLog() {
  const entries = []
  const log = (...parts) => entries.push(parts.join(" "))
  log.entries = entries
  return log
}
