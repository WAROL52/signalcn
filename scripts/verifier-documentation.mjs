/**
 * Porte de documentation.
 *
 * Le README est le seul document qui parle à un consommateur, et il est le seul qui peut mentir
 * sans qu'aucune machine le remarque : rien dans la suite ne dit que le bloc d'import nomme la
 * vraie surface, ni que le chemin d'import ne demande pas un alias que le projet consommateur
 * n'a pas. Cette porte le dit.
 *
 * Ce qu'elle vérifie, et pourquoi chaque chose existe :
 *
 *   1. LE BLOC D'IMPORT EST LA SURFACE. Les noms documentés sont comparés aux exports réels du
 *      module CONSTRUIT, dans les deux sens. Un export non documenté est un nom de trop dans le
 *      README ; un nom documenté qui n'existe pas est une promesse que le code ne tient pas. Le
 *      README étant le premier obstacle d'un parcours de migration, une surface fausse y coûte une
 *      heure à quelqu'un qui n'a aucun moyen de le savoir.
 *
 *   2. LE CHEMIN EST RELATIF. Ni alias, ni `paths`, ni paquet : le fichier installé est un
 *      fichier, et un chemin qui exige une configuration est un chemin que le consommateur n'a
 *      pas à connaître.
 *
 *   3. LES DEUX EXIGENCES SONT DÉCLARÉES, avec leur raison. `tsx: true` et le plancher de CLI ne
 *      sont pas des détails d'implémentation : sans eux, l'installation réussit et le fichier
 *      installé ne démarre pas.
 *
 *   4. LE CONTRAT DE COUVERTURE EST À TROIS MÉTRIQUES. Le README annonçait quatre rubriques
 *      d'un runner qui n'en a que trois ; le contrat qu'il annonce doit être celui qu'on applique.
 *
 *   node scripts/verifier-documentation.mjs
 */

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()

const README = join(RACINE, "README.md")
const texte = await readFile(README, "utf8")

// ---- 1. Le bloc d'import, et la surface qu'il nomme ----------------------------------------

// Un SEUL bloc porte l'import. Deux blocs permettraient d'en documenter un et d'en tester un
// autre, et la porte choisirait le premier — donc le moins contraignant, par construction.
const blocs = [...texte.matchAll(/```[a-z]*\n(import \{[\s\S]*?\}) from "([^"]+)"\n```/g)]
porte("le README a exactement un bloc d'import", blocs.length === 1, `${blocs.length} blocs`)

const surface = await import(join(RACINE, "registry", "default", "signals.js"))
const reels = Object.keys(surface).sort()
const [, corps, specifier] = blocs[0] ?? ["", "", ""]
const documentes = [...corps.matchAll(/^\s*(\w+),?$/gm)].map((m) => m[1]).sort()

const nonDocumentes = reels.filter((nom) => !documentes.includes(nom))
const inexistants = documentes.filter((nom) => !reels.includes(nom))

porte(
  "chaque export du module construit est nomme dans le README",
  nonDocumentes.length === 0,
  nonDocumentes.join(", "),
)
porte(
  "chaque nom du bloc d'import est un export reel",
  inexistants.length === 0,
  inexistants.join(", "),
)

// ---- 2. Le chemin d'import est relatif ------------------------------------------------------

// Ce qui est refusé est nommé une par une, parce que « relatif » n'est pas un mot que tout le
// monde entend de la même façon : `@/` est l'alias shadcn, `~/` son cousin, et un nom nu est un
// paquet — donc un alias de paquet, c'est-à-dire une dépendance d'exécution qui n'est pas
// déclarée comme telle.
const raison = []
if (specifier && !/^\.{1,2}\//.test(specifier)) raison.push("pas un chemin relatif")
if (specifier.includes("@/")) raison.push("alias shadcn @/")
if (specifier.includes("~/")) raison.push("alias ~/")
if (specifier && !/^\.{1,2}\//.test(specifier) && !specifier.startsWith("node:")) {
  raison.push("specifier nu, donc un paquet")
}
porte("le chemin d'import est relatif, sans alias", raison.length === 0, raison.join(", "))

// ---- 3. Les deux exigences, et leurs raisons ------------------------------------------------

porte("le README exige tsx: true", /"?tsx"?:? true|tsx`? :? `?true/i.test(texte))
porte("le README declare le plancher de CLI", /4\.10\.0/.test(texte))
// La raison est exigée avec l'exigence : une exigence sans raison secontredit au premier
// utilisateur qui se plaint, et l'équipe n'a alors plus d'argument à lui opposer.
const blocExigences = texte.slice(texte.indexOf("## Deux exigences"), texte.indexOf("## API principale"))
porte(
  "chaque exigence porte sa raison",
  (blocExigences.match(/\|/g) ?? []).length >= 6,
  "le tableau des exigences est absent ou trop court",
)

// ---- 4. Le registre et SPEC §21 : deux listes qui doivent se répondre ------------------------
//
// Une vingtaine d'entrées de matrice ne sont pas confrontables au paquet installé, et chacune porte
// dans `COUVERTURE` un marqueur qui dit OÙ son observation a été faite. Aucune ne dit POURQUOI
// elle ne l'est pas — cette raison est une prose, dans `SPEC.md` §21. Deux listes, donc : celle du
// code et celle du contrat. Elles doivent se répondre exactement, dans les deux sens.
//
// C'est ici, et pas dans `signals.test.ts`, que la vérification vit. La suite est un artefact
// DISTRIBUÉ : elle s'exécute chez un utilisateur qui n'a pas `SPEC.md`, et une assertion qui lit
// un fichier du dépôt y lèverait. C'est aussi pourquoi `registre-complet` ne valide que la FORME
// du marqueur, et laisse la correspondance à cette porte.

const COUVERTURE_MODULE = await import(join(RACINE, "registry", "default", "signals.test.ts"))
const { COUVERTURE } = COUVERTURE_MODULE
const spec = await readFile(join(RACINE, "SPEC.md"), "utf8")

const marquees = Object.entries(COUVERTURE)
  .filter(([, destination]) => /source:|divergence:/.test(destination))
  .map(([id]) => id)

// La section §21, et les identifiants d'entrée que ses lignes de tableau portent.
const section = spec.slice(spec.indexOf("\n## 21. "), spec.indexOf("\n## 22. "))
const consignees = new Set(
  [...section.matchAll(/`(?:signal|computed|effect|subscribe|action|dispose|modele|conv)#\d+[a-z]?`/g)].map(
    (m) => m[0].replaceAll("`", ""),
  ),
)

const sansLigne = marquees.filter((id) => !consignees.has(id))
const sansMarqueur = [...consignees].filter((id) => !marquees.includes(id))

porte(
  "chaque entree non confrontable au paquet a une ligne au §21",
  sansLigne.length === 0,
  `${sansLigne.length} sans ligne : ${sansLigne.join(", ")}`,
)
porte(
  "chaque ligne du §21 correspond a une entree reellement marquee",
  sansMarqueur.length === 0,
  `${sansMarqueur.length} sans marqueur : ${sansMarqueur.join(", ")}`,
)
porte(
  "le §21 consigne les 22 entrees non confrontables",
  marquees.length === 22,
  `${marquees.length} marquees, ${consignees.size} consignees`,
)

// ---- 4. Le contrat de couverture, et la section des differences ------------------------------

porte(
  "le README ne promet pas quatre rubriques de couverture",
  !/100 ?% statements/i.test(texte),
  "une rubrique que le runner ne produit pas",
)
for (const metrique of ["lignes", "branches", "fonctions"]) {
  porte(`le contrat de couverture nomme « ${metrique} »`, new RegExp(metrique, "i").test(texte))
}

porte("le README porte une section « Différences connues »", /^## Différences connues$/m.test(texte))

// ---- 5. Les COMPTES cités, contre le registre ---------------------------------------------
//
// Un chiffre écrit dans une prose ne se périme pas en criant : il devient faux et personne ne le
// voit. Le fichier de test assume cette faiblesse par écrit — « les COMPTES sont écrits en dur, et
// c'est une faiblesse connue » — donc c'est ici qu'elle se ferme.
//
// Chaque contrôle est ANCRÉ sur une affirmation précise, pas sur un balayage du document. Un
// balayage attraperait le journal des releases, où les chiffres d'un tag sont justes et doivent le
// rester : `v0.1.0` dit 80 scénarios, et c'est vrai de `v0.1.0`. Une ancre ne le peut pas.
//
// Le registre fait foi. Les chiffres de la prose doivent le suivre, jamais l'inverse.

const { ENTREES_ATTENDUES, scenarios } = COUVERTURE_MODULE
const attendus = { entrees: ENTREES_ATTENDUES.length, scenarios: scenarios.length }

const ancrees = [
  ["SPEC.md", /> \*\*Annexe :\*\*.*?— (\d+) comportements/, attendus.entrees, "comportements"],
  ["research/baseline-1.14.4.md", /^\*\*(\d+) comportements\*\* documentés/m, attendus.entrees, "comportements"],
  ["docs/scenarios.md", /Comment les \*\*(\d+) comportements\*\*/, attendus.entrees, "comportements"],
  ["docs/scenarios.md", /pour (\d+) comportements\./, attendus.entrees, "comportements"],
  ["ROADMAP.md", /comportements upstream — (\d+) entrées,/, attendus.entrees, "entrées"],
  ["ROADMAP.md", /scenarios\.md\) : (\d+) sc[ée]narios pour\n(\d+) comportements/, attendus.scenarios, "scénarios"],
]

for (const [fichier, motif, attendu, unite] of ancrees) {
  const texteFichier = await readFile(join(RACINE, fichier), "utf8")
  const trouve = texteFichier.match(motif)
  const cite = trouve ? Number(trouve[1]) : null
  porte(
    `${fichier} annonce le bon nombre de ${unite}`,
    cite === attendu,
    cite === null ? "l'ancre est introuvable — la phrase a ete reecrite ?" : `${cite} annonces, ${attendu} reels`,
  )
}

cloture()