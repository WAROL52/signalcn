// PROTOTYPE — ce que le mainteneur voit à CHAQUE échec.
// Les deux assertions sont correctes. Elles ne sont pas aussi lisibles.
import assert from "node:assert/strict"

const log = ["run 0", "A 0", "B 0", "C 0", "C 1", "B 1"]
const attendu = ["run 0", "A 0", "B 0", "C 0", "C 1", "B 1", "A 1"]

console.log("── A. assert.deepEqual(journal, attendu) ──")
try {
  assert.deepEqual(log, attendu)
} catch (e) {
  console.log(
    e.message
      .split("\n")
      .map((l) => "  " + l.replace(/\s+/g, " "))
      .join("\n"),
  )
}
console.log("")
console.log('── B. assert.equal(journal.join(" | "), attendu.join(" | ")) ──')
try {
  assert.equal(log.join(" | "), attendu.join(" | "))
} catch (e) {
  console.log(
    "  " + e.message.split("\n")[0].replace("actual:", "obtenu :").replace("expected:", "attendu:"),
  )
}
