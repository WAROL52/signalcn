/**
 * Porte des liens PUBLIES.
 *
 * VitePress valide un lien dans l'espace SOURCE et publie dans l'espace PUBLICATION. Les deux ne
 * sont pas le même espace : un lien peut donc être vert au build et mort au navigateur, et c'est
 * ce qui est arrivé — vingt-quatre liens, trouvés par crawl, jamais par le build.
 *
 * Ce que le build vérifie, mesuré par injection le 2026-10-03 : un lien Markdown relatif sans
 * extension (`site/x`) est résolu dans l'espace source, donc il fait tomber le build si la cible
 * n'existe pas. Une ancre passe en revanche sans que rien regarde si le titre existe.
 *
 * Ce qu'il ne vérifie pas, et que cette porte couvre :
 *
 *   1. L'ESPACE PUBLIÉ. Un lien vers un fichier que le site ne publie pas est vert au build et
 *      mort au navigateur. C'est le trou que #48 a nommé sans le fermer.
 *   2. LES EXTENSIONS D'ASSET. VitePress saute tout lien dont la cible porte une extension qu'il
 *      connaît — `.yml`, `.mjs`, `.png` — sans rien demander : mesuré, un `site/x.yml` vers un
 *      fichier absent laisse le build vert.
 *   3. LA NAVIGATION. `themeConfig.nav` et `logoLink` ne sont pas des liens Markdown : ni la
 *      conversion ni le build ne les touchent. #65 les a réécrits à la main, et rien d'autre ne les
 *      gardait.
 *
 * Elle lit la SORTIE PUBLIÉE — `site/.vitepress/dist/`, jamais les sources — extrait chaque `href`
 * de chaque page, et vérifie que la cible existe SUR LE DISQUE. Aucun appel réseau : des
 * existences de fichiers, rien d'autre.
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

// Sans cette assertion, une sortie absente — un build jamais lancé — se lirait comme un site sans
// lien : le silence serait vert. Elle est donc posée avant la boucle, sur le fait qu'il y ait des
// pages, et non sur ce qu'il y a dedans.
porte("la sortie publiée a été lue", pages.length > 0, `${DIST} ne porte aucune page .html`)

const ORIGINE = "https://localhost"
const morts = []
const orphelines = new Map()
let internes = 0
let externes = 0
let ancres = 0

for (const page of pages) {
  const emise = readFileSync(page, "utf8")
  const depuis = page.slice(DIST.length + 1)

  // Tous les `id` de la page, pas seulement ceux d'un titre : une ancre peut viser n'importe quel
  // `id`, et c'est la page elle-même qui fait foi. C'est ce qui rend le contrôle ci-dessous
  // indépendant de tout slugifier — voir l'ancre au bas de la boucle.
  const ids = new Set([...emise.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]))

  for (const [, href] of emise.matchAll(/href="([^"]*)"/g)) {
    // Une ancre ne se résout pas comme un fichier, et le build ne la valide pas non plus : #47 a
    // mesuré que Mermaid, les plugins et la numérotation rendent l'extraction des `id` trop
    // fragile pour qu'une porte dessus reste stable. Elle est donc comptée, jamais comparée à un
    // slug calculé — mais elle n'est pas NON PLUS laissée passer : voir l'orpheline ci-dessous.
    if (href.startsWith("#")) {
      ancres++
      // LA COHÉRENCE INTERNE, et c'est tout ce qu'on peut vérifier d'une ancre. Les deux
      // slugifiers — GitHub et VitePress — divergent systématiquement (mesuré, §86) : le même
      // titre donne `2-le-nœud-et-ses-champs` sur GitHub et `_2-le-nœud-et-ses-champs` sur le
      // site, parce que VitePress préfixe d'un `_` un slug qui commence par un chiffre et décompose
      // les diacritiques latins — mais garde `œ`, qui n'en est pas un. Une ancre ne peut donc pas
      // être VALIDÉE, et pas davantage REFUSÉE : 421 des 422 ancres de ce site sont la barre
      // latérale et la table des matières que VitePress émet lui-même, indiscernables d'une ancre
      // écrite à la main dans le HTML publié.
      //
      // Ce qui reste, et qui ne demande aucun slugifier : une ancre est une promesse FAITE PAR LA
      // PAGE, et la page doit la tenir. Un `href="#x"` sans `id="x"` sur la même page est un lien
      // mort, quelle que soit la forme du slug — et le contrôle reste stable quand les titres
      // changent, parce qu'il ne les lit pas. C'est ce qui attrape le seul cas réel : mesuré, une
      // seule ancre du site est écrite à la main, et elle était morte.
      if (href.length > 1 && !ids.has(href.slice(1))) {
        orphelines.set(depuis, [...(orphelines.get(depuis) ?? []), href])
      }
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

// La troisième assertion, et la seule qui parle d'une ancre. Elle ne calcule aucun slug : elle
// confronte chaque promesse de la page à la page elle-même.
porte(
  "chaque ancre a un id sur la page qui la porte",
  orphelines.size === 0,
  [...orphelines].map(([page, liste]) => `${page} → ${liste.join(", ")}`).join(" ; "),
)

// La porte dit ce qu'elle ne vérifie pas, comme `verifier-documentation` : le préfixe `--` ne compte
// ni comme un succès ni comme un échec. Les deux premières lignes ne portent aucun nombre, parce
// qu'un compte de zones non vérifiées se périme et deviendrait un mensonge ; la troisième porte le
// volume lu, qui est un relevé de ce passage et pas une affirmation sur le dépôt.
//
// La première ligne ne dit pas que les ancres sont ignorées : elle dit ce qui reste hors de
// portée, et pourquoi. Une ancre RESOLUE ne veut pas dire ancre JUSTE : la page garantit qu'elle
// mène quelque part, pas que c'était la section voulue. Dire seulement « non vérifiées » laissait
// croire qu'une porte Anhangerait le jour où on le déciderait ; elle ne le peut pas, et la
// divergence des deux slugifiers, mesurée, est la raison.
console.log(
  "  --   une ancre resolue n'est pas une ancre juste : les slugifiers GitHub et VitePress divergent, mesuré — #86",
)
console.log(
  "  --   les URL externes ne sont pas vérifiées : aucune requête réseau, par construction",
)
console.log(`  --   ${internes} liens internes, ${externes} externes et ${ancres} ancres lus`)

cloture()
