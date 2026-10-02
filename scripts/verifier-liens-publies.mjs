/**
 * Porte des liens PUBLIES.
 *
 * VitePress valide un lien dans l'espace SOURCE et émet une URL dans l'espace PUBLICATION. Les
 * deux n'ont pas les mêmes noms : la forme `site/x` — la seule qui marche dans le dépôt GitHub ET
 * dans le site, mesurée sur #65 — sort `./site/x.html` et n'est PAS validée par le build, parce
 * que le build cherche `site/x.md` dans les sources. Trente liens sont donc entrés dans le dépôt
 * en perdant le seul contrôle qui les gardait.
 *
 * Cette porte le remplace, et elle est plus large que lui : elle lit la SORTIE PUBLIÉE, extrait
 * chaque `href` de chaque page, et vérifie que la cible existe SUR LE DISQUE. Aucun appel réseau —
 * des existences de fichiers, rien d'autre. Une URL morte est un fichier absent, et c'est tout ce
 * qu'elle prouve.
 *
 * Elle couvre tout lien interne, pas seulement les trente convertis : c'est le trou que #48 a
 * nommé sans le fermer, et que le crawl avait trouvé une fois — vingt-quatre liens verts au build
 * pour des URL mortes.
 *
 *   node scripts/verifier-liens-publies.mjs
 */

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()

const DIST = join(RACINE, "site", ".vitepress", "dist")
// Le `base` est lu dans la configuration parce que c'est elle qui décide où une URL absolue commence
// ; le retirer ici serait supposer que le dépôt est servi à la racine, et c'est précisément ce qui
// mettrait chaque page en 404 sans faire tomber le build. Sa valeur, elle, est gardée ailleurs.
const base = readFileSync(join(RACINE, "site", ".vitepress", "config.mts"), "utf8").match(
  /^\s*base:\s*"([^"]*)"/m,
)?.[1]
porte("le site declare un base", base !== undefined, "aucune ligne `base:` dans config.mts")

const pages = []
const promener = (dossier) => {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) promener(chemin)
    else if (entree.name.endsWith(".html")) pages.push(chemin)
  }
}
promener(DIST)

// Sans cette assertion, une sortie absente — un build non lancé — se lirait comme un site sans
// lien : le silence serait vert. Elle est donc lue avant tout, et la porte ne compte rien sans elle.
porte("la sortie publiée a été lue", pages.length > 0, `${DIST} ne porte aucune page .html`)

const ORIGINE = "https://localhost"
const morts = []
let internes = 0
let externes = 0
let ancres = 0

for (const page of pages) {
  const emise = readFileSync(page, "utf8")
  const depuis = page.slice(DIST.length + 1)

  for (const [, href] of emise.matchAll(/href="([^"]*)"/g)) {
    // Une ancre ne se résout pas comme un fichier, et le build ne la valide pas non plus : #47 a
    // mesuré que Mermaid, les plugins et la numérotation rendent l'extraction des `id` trop
    // fragile pour qu'une porte dessus reste stable. Elle est donc comptée et laissée, jamais
    // vérifiée — et c'est dit en bas, avec la ligne `--`.
    if (href.startsWith("#")) {
      ancres++
      continue
    }

    const url = new URL(href, `${ORIGINE}/${depuis}`)
    // Une origine différente est une adresse extérieure : elle n'a pas de cible dans `dist/`, et la
    // demander à un appel réseau ferait dépendre une porte de la disponibilité d'un tiers. Elle est
    // comptée et laissée, jamais vérifiée — et c'est dit en bas, avec la ligne `--`.
    if (url.origin !== ORIGINE) {
      externes++
      continue
    }

    internes++
    const chemin = url.pathname.replace(base, "")
    // Les trois formes que la publication peut produire : la racine du site et une barre finale sont
    // un répertoire, un nom sans extension est une page — c'est VitePress qui l'a émise ainsi —, et
    // le reste est un fichier, typiquement un asset.
    const fichier =
      chemin === "" || chemin.endsWith("/")
        ? `${chemin}index.html`
        : /\.[^/]+$/.test(chemin)
          ? chemin
          : `${chemin}.html`

    if (!existsSync(join(DIST, fichier))) morts.push(`${depuis} → ${href}`)
  }
}

porte(
  "chaque lien interne pointe vers un fichier de la sortie publiée",
  morts.length === 0,
  morts.join(", "),
)

// La porte dit ce qu'elle ne vérifie pas, comme `verifier-documentation` : ni `ok` ni `ECHEC`, donc
// ni succès ni échec compté. Aucune des deux lignes ne porte de nombre — un compte périmé serait
// un mensonge de plus dans une sortie qui prétend être une mesure.
console.log(
  "  --   les ancres (#section) ne sont pas vérifiées : le build ne les valide pas non plus",
)
console.log(
  "  --   les URL externes ne sont pas vérifiées : aucune requête réseau, par construction",
)
console.log(`  --   ${internes} liens internes, ${externes} externes et ${ancres} ancres lus`)

cloture()
