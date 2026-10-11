/**
 * Le message de commit, et les caractères qui n'y ont pas leur place.
 *
 *   node scripts/verifier-message.mjs <chemin-du-message>
 *
 * Le dépôt écrit en français : commentaires, documentation, messages. Les accents, les guillemets
 * français et le tiret cadratin sont donc **légitimes**, et les refuser serait refuser la langue du
 * dépôt. Ce contrôle ne porte donc pas sur « est-ce de l'ASCII » — il refuse seulement les
 * caractères d'une écriture qui n'est ni le français ni le code.
 *
 * Ce n'est pas une porte de style. C'est la réponse à un fait : en une session, un caractère CJK
 * s'est glissé trois fois dans des messages de commit, et chacun a coûté un `git commit --amend`.
 * Aucun des deux contrôles voisins ne regarde le message — `biome format` voit des fichiers,
 * `tsc` voit du TypeScript — donc rien ne pouvait le dire.
 *
 * LA SOURCE EST L'ARGUMENT, ET C'EST LE CŒUR DU CONTRÔLE.
 *
 * Ce script a été écrit une première fois en lisant `.git/COMMIT_EDITMSG`, câblé sur `pre-commit`.
 * Les deux ensemble produisent un contrôle qui **valide le mauvais message** : pendant
 * `pre-commit`, le commit en cours n'existe pas encore, et `COMMIT_EDITMSG` porte le message du
 * commit **précédent**. Mesuré : un hook `pre-commit` qui affiche ce fichier lit
 * `premier commit de référence` pendant que le commit s'appelle `Un 一头 dans le titre` — et il
 * passe. Le motif est correct, la source ne l'est pas : un message propre était validé, et c'est
 * exactement le mode de défaillance observé.
 *
 * L'événement `commit-msg` reçoit le message du commit en cours **en argument** — c'est ce que git
 * écrit dans son hook généré, et `{1}` le transmet dans la configuration lefthook. Le chemin n'est
 * donc jamais reconstruit ici : un agent qui le reconstruirait réintroduirait le bug, puisque c'est
 * la reconstruction qui lit le fichier périmé.
 *
 * L'argument est `argv[2]` et non `argv[1]`, parce que `argv[1]` est le chemin DU SCRIPT. Mesuré :
 * avec `argv[1]`, le contrôle se lit lui-même — et comme le commentaire ci-dessus contient l'exemple
 * du caractère fautif, il tombe sur lui, à chaque exécution, quel que soit le message. Un contrôle
 * qui juge son propre texte source se signale par un refus inexplicable, pas par un silence.
 *
 * `git commit --amend` réécrit le fichier passé en argument, donc la correction se fait par
 * amendement et non par contournement. Et `--no-verify` passe toujours : c'est voulu, un hook qu'on
 * contourne dès qu'il gêne est une porte désactivée — voir `lefthook.yml`.
 *
 * Les PRISES de conversation d'un agent — les emojis — sont hors de ce contrôle : elles sont
 * intentionnelles, et ce n'est pas le rôle d'un hook de commit de dire le contraire.
 */

import { readFileSync } from "node:fs"

/**
 * Les écritures refusées, par nom.
 *
 * LE KANA EST DANS LE BLOC CJK, ET C'EST VOLONTAIRE — mais il ne doit être compté qu'UNE fois.
 *
 * Une version avait deux plages qui se recouvraient : `CJK = 2E80-9FFF`, qui CONTIENT kana
 * `3040-30FF`, et `KANA = 3040-30FF` en propre. Un message en kana était donc rapporté comme CJK
 * *et* comme KANA — les mêmes caractères comptés deux fois, sous un nom d'écriture qui n'était pas
 * celle du texte. Le compte était faux, donc le diagnostic l'était : il annonçait au contributeur
 * une écriture qu'il n'avait pas écrite. Le bloc CJK reste donc large — il englobe le kana — et la
 * plage KANA ne couvre plus que ce que le bloc ne couvre pas : le katakana DEMI-LARGEUR, qui est en
 * `FF66-FF9D` et n'y est pas.
 *
 * Une version de ce correctif a rétréci le bloc à `2E80-30FF` en croyant y voir les idéogrammes ;
 * c'est le bloc des radicaux, et `一` (`4E00`) est donc passé au travers — mesuré, le message est
 * ressorti vert. Les idéogrammes vont de `4E00` à `9FFF`, et c'est ce qui est écrit ici.
 *
 * LE CJK ASTRAL EST UN CAS À PART, et c'est mesuré : sans une plage au-dessus de `FFFF`, un
 * idéogramme hors du plan multilingue de base sort en 0. Il tient sur deux unités UTF-16, donc une
 * classe qui s'arrête à `FFFF` ne le voit pas — et c'est exactement le cas que ce contrôle existe
 * pour attraper. Les plans 2 et 3 sont donc énumérés, et le caractère est compté une fois.
 *
 * LE DRAPEAU `u` EST CE QUI PERMET CES PLAGES : sans lui, une classe qui monte à `20000` est
 * « Range out of order ». Avec lui, une classe compte des caractères et non des unités UTF-16,
 * donc le compte dit ce qu'il annonce. Il est au motif de la boucle, plus bas, et il est
 * indissociable des plages : les enlever casse le compte sans le message.
 */
const INTERDITS = [
  ["[\\u{2E80}-\\u{9FFF}]", "CJK"],
  ["[\\u{20000}-\\u{2A6DF}]", "CJK"],
  ["[\\u{AC00}-\\u{D7AF}]", "HANGUL"],
  ["[\\u{FF66}-\\u{FF9D}]", "KANA"],
  ["[\\u{0400}-\\u{04FF}]", "CYRILLIQUE"],
]

/**
 * La source du message.
 *
 * L'ARGUMENT EST EXIGÉ, et son absence se traite avant toute lecture. Sans ce test,
 * `readFileSync(undefined)` lirait l'entrée standard : le script consomme alors ce qui vient — le
 * premier `git commit` de la session inclus — et sort sur un verdict qui ne porte sur rien. Un
 * contrôle qui juge autre chose que son sujet est pire qu'un contrôle muet, donc l'absence
 * d'argument est un code de sortie distinct, et non une lecture qui ne lève pas.
 */
const chemin = process.argv[2]

if (!chemin) {
  console.error("  usage : node scripts/verifier-message.mjs <chemin-du-message>")
  console.error(
    "  Le message est passé par l'événement `commit-msg` de git, jamais lu à un chemin supposé.",
  )
  process.exit(2)
}

const source = readFileSync(chemin, "utf8")

const coupables = []
for (const [motif, nom] of INTERDITS) {
  const numero = (source.match(new RegExp(motif, "gu")) ?? []).length
  if (numero > 0) {
    coupables.push(`${nom} : ${numero} caractère${numero > 1 ? "s" : ""}`)
  }
}

if (coupables.length > 0) {
  console.error("  ECHEC le message de commit porte un caractère d'une écriture étrangère :")
  for (const coupable of coupables) console.error(`    ${coupable}`)
  console.error("\n  Le dépôt écrit en français : accents, guillemets et tiret cadratin sont fins.")
  console.error("  `git commit --amend` après les avoir supprimés.")
  process.exit(1)
}

console.log("  ok   le message de commit n'a aucun caractère hors français, code et ponctuation")
