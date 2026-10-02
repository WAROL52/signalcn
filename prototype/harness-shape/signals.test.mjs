// ── LA FORME DU FICHIER DISTRIBUÉ ──────────────────────────────────────────
// C'est ce que l'utilisateur reçoit avec `shadcn add signalcn/signals-test`.
// Il ne connaît pas la baseline. Il ne voit aucun harnais. Il a juste des tests.

import { test } from "node:test"
import { makeLog, scenarios } from "./scenarios.mjs"
import { batch, computed, effect, signal } from "./signals-standin.mjs"

const api = { signal, computed, effect, batch }

// ── le reliquat : six lignes, et il n'a aucune raison d'exister ailleurs ─────
for (const { name, run } of scenarios) {
  test(name, () => {
    const log = makeLog()
    run(api, log)
  })
}
