// PROTOTYPE — un motor NAÏF, écrit exprès pour diverger de la baseline.
// Il se trompe d'une seule façon, et de la façon la plus plausible qui soit :
// il utilise Object.is pour comparer, parce que c'est « la bonne » comparaison.

let active = null
const BATCH = []

export function signal(value) {
  const targets = new Set()
  return {
    get value() {
      if (active) active.deps.add(this)
      return this._v
    },
    set value(v) {
      if (Object.is(v, this._v)) return          // ← LE BUG
      this._v = v
      queue([...targets])
    },
    _v: value,
    _targets: targets,
  }
}

export function computed(fn) {
  const box = {
    _fn: fn, _v: undefined, _dirty: true, _deps: new Set(), _targets: new Set(),
    get value() {
      if (active) active.deps.add(this)
      if (this._dirty) {
        const prev = active
        const deps = new Set()
        active = { deps }
        this._v = this._fn()
        active = prev
        this._deps = deps
        for (const d of deps) d._targets.add(this)
        this._dirty = false
      }
      return this._v
    },
    toString() { return String(this.value) },
    valueOf() { return this.value },
  }
  return box
}

export function effect(fn) {
  const node = { deps: new Set() }
  const run = () => {
    const prev = active
    const deps = new Set()
    active = { deps }
    try { fn() } finally { active = prev }
    for (const d of node.deps) d._targets.delete(node)
    node.deps = deps
    for (const d of deps) d._targets.add(node)
  }
  run()
  return () => { for (const d of node.deps) d._targets.delete(node) }
}

export const batch = (fn) => { const r = fn(); flush(); return r }
export const untracked = (fn) => { const prev = active; active = null; try { return fn() } finally { active = prev } }

// PILE : le flush sort dans l'ordre inverse de la notification
function queue(targets) { for (const t of targets) BATCH.unshift(t) }
function flush() { while (BATCH.length) BATCH.pop()() }
