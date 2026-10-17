/**
 * Porte des figures.
 *
 * Le critère d'acceptation de #120, prouvé à la main le jour de la fusion du plugin Mermaid :
 * zéro `<svg` et zéro `xlink:href` dans le HTML de `dist/`. Le rendu vit côté client — le
 * composant s'importe en paresse et tourne au montage — donc la sortie publiée ne porte aucune
 * trace du rendu. Une preuve manuelle ne se rejoue pas : rien ne relisait la sortie publiée,
 * et le build qui contredirait le critère le ferait en silence. La preuve devient une porte.
 *
 * Les deux chaînes sont les marques qu'un rendu au build laisserait derrière lui. Mermaid
 * produit un SVG — sa balise ouvrante — et ses liens portent `xlink:href="#…"`. Les deux sont
 * refusées, et ce n'est pas un doublon : la balise attrape un SVG quelconque, l'attribut attrape
 * une figure de Mermaid même là où sa balise n'apparaît pas, et les deux ont été comptées à
 * zéro à la main sur le site fusionné — ce compte, ici, se rejoue.
 *
 * `verifier-liens-publies` couvrirait déjà une partie du symptôme : chaque `xlink:href="#…"`
 * du HTML est aussi un `href="#…"`, lu comme une ancre devant avoir son `id`, et les
 * identifiants qu'un diagramme invente (`#flowchart-…`) n'existent pas sur la page — ancre
 * orpheline, porte rouge. Mais un SVG sans lien, écrit cru dans une page ou sérialisé dans un
 * attribut, ne produit aucune ancre : c'est pour lui que le critère existe en propre, et qu'il
 * vise les deux chaînes, pas leurs conséquences.
 *
 * Elle lit la SORTIE PUBLIÉE — `site/.vitepress/dist/`, jamais les sources — et balaye chaque
 * fichier `.html`. Le critère est une absence, donc il ne porte ni drapeau ni exception : une
 * liste de fichiers tolérés dériverait avec le premier SVG écrit à la main.
 *
 *   node scripts/verifier-figures.mjs
 */

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()

const DIST = join(RACINE, "site", ".vitepress", "dist")

const pages = []
const promener = (dossier) => {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) promener(chemin)
    else if (entree.name.endsWith(".html")) pages.push(chemin)
  }
}
promener(DIST)

// Sans cette assertion, une sortie absente — un build jamais lancé — se lirait comme un site
// sans figure : le silence serait vert. Elle est posée avant la boucle, sur le fait qu'il y ait
// des pages, et non sur ce qu'il y a dedans — la même place et la même raison que chez
// `verifier-liens-publies`, qui lit le même espace.
porte("la sortie publiée a été lue", pages.length > 0, `${DIST} ne porte aucune page .html`)

// Les deux comptes se prennent PAR PAGE, et le détail d'un échec nomme chaque fichier fautif
// avec le sien — un compte global nommerait la faute sans dire où la corriger.
const svg = new Map()
const xlink = new Map()

for (const page of pages) {
  const emise = readFileSync(page, "utf8")
  const depuis = page.slice(DIST.length + 1)

  const balises = [...emise.matchAll(/<svg/g)].length
  if (balises > 0) svg.set(depuis, balises)

  const attributs = [...emise.matchAll(/xlink:href/g)].length
  if (attributs > 0) xlink.set(depuis, attributs)
}

porte(
  "le HTML publié ne porte aucune balise svg",
  svg.size === 0,
  [...svg].map(([page, compte]) => `${page} : ${compte}`).join(", "),
)

porte(
  "le HTML publié ne porte aucun xlink:href",
  xlink.size === 0,
  [...xlink].map(([page, compte]) => `${page} : ${compte}`).join(", "),
)

// Ce que la porte ne balaye pas, elle le dit, avec le préfixe `--` : les paquets `.js` de la
// sortie portent les chaînes cherchées — mesuré, `<svg` y vit dans les morceaux de mermaid,
// katex et du framework — et c'est là le code qui REND, pas un rendu. Le critère de #120 dit le
// HTML, et le HTML seul ; élargir le balayage aux paquets ferait refuser la bibliothèque du
// rendu client que la politique du dépôt exige.
console.log(
  "  --   le balayage vise le HTML seul : un `<svg` dans un paquet .js de la sortie appartient au code qui rend, pas à une figure rendue",
)
console.log(`  --   ${pages.length} pages .html balayées`)

cloture()
