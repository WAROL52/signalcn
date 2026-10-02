// ── LE HARNESS DU DÉPÔT MAINTEINEUR ──────────────────────────────────────────
// Il ne compare rien. Il fait tourner la MÊME table contre la baseline, et les
// MÊMES assertions font foi. Une divergence, c'est un test en échec.

import * as baseline from "@preact/signals-core"
import { makeLog, scenarios } from "./scenarios.mjs"

const api = {
  signal: baseline.signal,
  computed: baseline.computed,
  effect: baseline.effect,
  batch: baseline.batch,
}

let passed = 0
const failures = []

console.log("")

import { readFileSync } from "node:fs"

const version = JSON.parse(
  readFileSync("node_modules/@preact/signals-core/package.json", "utf8"),
).version
console.log(`  HARNES DIFFÉRENTIEL — baseline @preact/signals-core@${version}`)
console.log("  " + "─".repeat(74))
console.log("")

for (const { name, run } of scenarios) {
  const log = makeLog()
  try {
    run(api, log)
    console.log("  ✓  " + name)
    passed++
  } catch (err) {
    console.log("  ✗  " + name)
    console.log("       " + err.message.split("\n").slice(0, 6).join("\n       "))
    failures.push({ name, message: err.message })
  }
}

console.log("")
console.log("  " + "─".repeat(74))
console.log(`  ${passed} conforme(s) · ${failures.length} divergence(s)`)
console.log("")
process.exit(failures.length ? 1 : 0)
