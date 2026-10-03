/**
 * Le journal du harnais, injecté dans la page des scénarios.
 *
 *   import { journalHarnais } from "./journal-harnais.mjs"
 *
 * La sortie de `scripts/harnais.mjs` entre dans la page **au moment du rendu**, et **aucun fichier
 * n'est écrit** : c'est ce qui garde l'arbre de travail propre, donc la porte de propreté verte —
 * un artefact généré sous `site/` y serait toléré, et c'est exactement l'arbre sale que #68 vient
 * de démontrer.
 *
 * **Un harnais en échec fait échouer le build.** Une page verte qui affiche un harnais rouge
 * mentirait, et `SPEC.md` §19 exige que les trois cibles soient indiscernables. La page ne peut
 * donc jamais afficher un échec : c'est ce qui rend « la sortie réelle » réellement réelle.
 *
 * Le harnais est lancé **une fois par construction**, pas une fois par page : le résultat est
 * mémorisé dans la closure, et le plugin est installé une fois par configuration. Le coût est donc
 * celui d'une commande de plus dans `porte`, mesuré et dit dans `site/contributeurs/ci.md` — qui est
 * la seule source des coûts, son tableau et non ce fichier.
 *
 * La racine est le répertoire courant, et c'est `package.json` qui l'impose : ce fichier est bundlé
 * par esbuild dans un temporaire, donc `import.meta.url` ne dit plus rien sur l'endroit d'où le
 * site est construit.
 */

import { spawnSync } from "node:child_process"

// Le marqueur ne remplace rien dans la page : il y est écrit, et il est RÉELLEMENT le seuil que le
// plugin exige — un commentaire indenté est un bloc indenté pour markdown-it, pas un `html_block`,
// donc il ne serait pas vu. La porte de documentation lit cette constante au lieu de la recopier,
// et l'ancre qu'elle pose dit la même chose.
export const MARQUEUR_INJECTION = "<!-- harnais -->"

// Le groupe qui montre l'ORDRE D'EXÉCUTION — les deux règles de drainage de `SPEC.md` §13.4, que la
// figure d'`architecture.md` doit dessiner et que ce ticket n'a pas encore tracée. Le journal
// confirme la figure, la figure explique le journal. Le groupe `model/*` était le candidat évident,
// sept écarts de `createModel` à l'appui, et c'est le mauvais : il illustre autre chose. Le groupe
// `subscribe/*` l'est aussi, et pour la même raison — ses notifications ne sont pas le drainage.
const GROUPE = "batch/"

// Le résumé est la ligne que le harnais écrit en dernier, et elle est la seule qui porte les deux
// comptes. Elle est RELUE et non reconstruite : la page montre ce que la commande a dit. Le motif
// s'arrête au premier mot variable — `82 scenarios,` — pour ne pas réécrire la phrase du harnais
// dans un second endroit, où elle dériverait de son premier mot.
const RESUME = /^\s+\d+ scenarios,/m

/**
 * Le bloc affiché : le résumé du harnais, puis un exemple complet — le groupe choisi plus haut.
 *
 * Un bloc VIDE est une erreur, pas une page sans journal : sans cette garde, une régression de la
 * lecture ferait rendre un bloc vide et le build resterait vert, ce qui est le pire mode de
 * défaillance d'une porte. C'est le même argument que celui du lexique vide, dans
 * `verifier-documentation.mjs`.
 */
const lireJournal = (() => {
  let memo

  return () => {
    if (memo !== undefined) return memo

    const { status, stdout, stderr, error } = spawnSync(process.execPath, ["scripts/harnais.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    })
    // `error` plutôt qu'un `status` faux : un binaire introuvable ne donne pas un code de sortie, il
    // donne une erreur de spawn. Sans elle, le message porterait un deux-points et rien derrière.
    if (status !== 0) {
      throw new Error(
        `le harnais a échoué — le site ne peut pas afficher un harnais en échec :\n${error?.message ?? stderr.trim()}`,
      )
    }

    const lignes = stdout.split("\n")
    const resume = lignes.find((ligne) => RESUME.test(ligne))
    const exemple = lignes.filter((ligne) => ligne.includes(` ${GROUPE}`))
    if (resume === undefined || exemple.length === 0) {
      throw new Error(
        `le journal du harnais est vide — résumé ${resume ?? "absent"}, ${exemple.length} lignes ${GROUPE}`,
      )
    }

    memo = `${[resume, ...exemple].join("\n")}\n`
    return memo
  }
})()

/**
 * Le plugin markdown-it. Il remplace le marqueur écrit dans la page par le bloc, et il ne touche
 * à rien d'autre : une page sans marqueur est une page sans journal.
 */
export const journalHarnais = (md) => {
  md.core.ruler.after("block", "journal-harnais", (etat) => {
    for (const jeton of etat.tokens) {
      if (jeton.type !== "html_block" || !jeton.content.includes(MARQUEUR_INJECTION)) continue

      jeton.type = "fence"
      jeton.info = "text"
      jeton.content = lireJournal()
    }
  })
}
