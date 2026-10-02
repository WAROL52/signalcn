/**
 * Porte de zéro-dépendance runtime.
 *
 *   node scripts/zero-dependance.mjs
 *
 * Deux passes, deux angles morts, spécifiées dans
 * [`docs/zero-dependency.md`](../docs/zero-dependency.md) — le document est la spécification, ce
 * script n'est que son exécution :
 *
 *   1. LE METAFILE, pour la STRUCTURE. esbuild en `--bundle` — ici un OUTIL DE MESURE, pas
 *      l'outillage de build, qui n'en bundle pas : le rôle est de résoudre le graphe de fichiers.
 *      `metafile.inputs` ne doit nommer qu'un seul fichier, `registry/default/signals.ts`. Un
 *      import, relatif ou de paquet, ajoute son fichier à cette liste — donc la porte ferme sans
 *      avoir à distinguer les deux cas. Une seconde invocation, `--packages=external`, laisse les
 *      imports dans la sortie et exige `outputs.imports` vide : même conclusion par un autre
 *      chemin, pour le cas où les métadonnées de build seraient désactivées.
 *
 *   2. LA RECHERCHE, pour les CONSTRUCTIONS. Une recherche à chaîne fixe sur
 *      `registry/default/signals.min.js` — l'artefact que l'utilisateur installe, pas la source.
 *      Le minificateur renomme les variables locales mais ni les globaux ni les fonctions
 *      natives, donc la garantie porte sur le fichier distribué. Un échec nomme le symbole : un
 *      « interdit détecté » sans nom est une porte qu'on contourne par lassitude.
 *
 * LA LISTE EST LUE, JAMAIS RECOPIÉE : elle est extraite du tableau de `docs/zero-dependency.md`.
 * Une liste écrite deux fois dérive sans bruit, et celle-ci serait la seconde à le faire.
 */

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { build } from "esbuild"

import { RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()

const SPEC = "docs/zero-dependency.md"
const COEUR = "registry/default/signals.ts"
const ARTEFACT = "registry/default/signals.min.js"

const spec = await readFile(join(RACINE, SPEC), "utf8")

// ---- La liste, et l'ancre de compte qui la garde ----------------------------------------------
//
// Les deux lignes du tableau de motivation sont les seules du document qui commencent par `| **`.
const lignes = spec
  .slice(spec.indexOf("\n## 1. "), spec.indexOf("\n## 2. "))
  .split("\n")
  .filter((ligne) => ligne.startsWith("| **"))
const motifs = lignes.flatMap((ligne) => [...ligne.matchAll(/`([^`]+)`/g)].map((m) => m[1]))

// Une liste vide ferait passer la recherche sans rien vérifier : c'est le seul mode de défaillance
// d'un contrôle par liste, et il se voit ici plutôt que dans un faux VERT.
porte("la liste du document se lit", motifs.length > 0, `${lignes.length} ligne(s) de tableau`)

const annonce = spec.match(/La liste compte \*\*(\d+) motifs\*\*/)
porte(
  "la liste compte autant de motifs que le document n'en annonce",
  annonce !== null && Number(annonce[1]) === motifs.length,
  annonce === null ? "l'ancre est introuvable" : `${motifs.length} lus, ${annonce[1]} annonces`,
)

// ---- Passe 1 : le metafile, pour la structure -----------------------------------------------

const mesure = async (options) =>
  await build({
    entryPoints: [COEUR],
    // Les clés de `metafile.inputs` sont relatives au répertoire de travail : sans cette ligne,
    // le contrôle ne mordrait QUE si on lance la porte depuis la racine. C'est le genre de porte
    // qui semble verte et ne l'est pas.
    absWorkingDir: RACINE,
    outfile: "hors-chemin.js",
    bundle: true,
    format: "esm",
    target: "es2020",
    // `write: false` : le fichier de sortie ne sert à rien, il ne devait servir qu'à faire
    // produire les métadonnées. Sans cela, chaque exécution laisserait un `hors-chemin.js`.
    write: false,
    metafile: true,
    ...options,
  })

const { metafile } = await mesure({})
const lus = Object.keys(metafile.inputs)
porte(
  "le metafile ne lit que le cœur",
  lus.length === 1 && lus[0] === COEUR,
  `${lus.length} fichier(s) : ${lus.join(", ")}`,
)

const { metafile: externe } = await mesure({ packages: "external" })
const imports = Object.values(externe.outputs).flatMap((sortie) => sortie.imports)
porte(
  "aucun import dans la sortie, imports laissés externes",
  imports.length === 0,
  imports.map((i) => `${i.path} (${i.kind})`).join(", "),
)

// ---- Passe 2 : la recherche à chaîne fixe, sur l'artefact minifié ----------------------------

const artefact = await readFile(join(RACINE, ARTEFACT), "utf8")
const trouves = motifs.filter((motif) => artefact.includes(motif))
porte(
  `${ARTEFACT} ne contient aucun des ${motifs.length} motifs interdits`,
  trouves.length === 0,
  trouves.join(", "),
)

// ---- Le §6 : la colonne « fichier propre », que la passe 2 vient de mesurer ------------------
//
// La ligne porte deux nombres pour le fichier piégé et deux pour le fichier propre. Seuls ceux du
// fichier propre portent sur l'artefact réel, et la porte les remesure à chaque exécution : c'est
// donc le seul endroit où un chiffre du document et une mesure peuvent se contredire. Ceux du
// fichier piégé sont le relevé d'une exécution sur un fichier qui n'existe plus.
const verifie = spec.match(/^\| Motifs détectés \| \*\*\d+ \/ \d+\*\* \| (\d+) \/ (\d+) \|$/m)
porte(
  `${SPEC} annonce le nombre de motifs que la porte mesure sur l'artefact`,
  verifie !== null && Number(verifie[1]) === trouves.length && Number(verifie[2]) === motifs.length,
  verifie === null
    ? "l'ancre est introuvable"
    : `${verifie[1]} / ${verifie[2]} annonces, ${trouves.length} / ${motifs.length} mesures`,
)

cloture()
