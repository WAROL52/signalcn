/**
 * Porte d'installation.
 *
 * Ce qu'elle prouve, et seulement ça : que les items de `registry.json` sont bien installables
 * par la CLI, au bon endroit, avec `tsx: true`, sans toucher `src/`, et que le fichier installé
 * tourne dans un projet qui n'a RIEN d'autre que Node.
 *
 *   node scripts/verifier-installation.mjs
 *
 * Les versions de la CLI sont les deux bornes de la matrice de documentation : la 2.x la plus
 * récente et la 3.x la plus récente. Une version de plus n'est pas une preuve de plus.
 *
 * L'item est passé par CHEMIN LOCAL, pas par URL GitHub. L'adressage GitHub demande un
 * `raw.githubusercontent.com` résolvable et un nom de domaine propre : les deux appartiennent à
 * la tranche #21. Ce que cette porte teste — `type`, `target`, le contenu livré — lui
 * appartient déjà.
 */

import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()

const CLI = [
  { nom: "shadcn 2.x", paquet: "shadcn@2.10.0" },
  { nom: "shadcn 3.x", paquet: "shadcn@3.8.5" },
]


/**
 * Le contrat minimal qu'un fichier installé doit tenir. Ce n'est PAS la table différentielle, et
 * c'est assumé : aucun subscriber n'existe encore, il n'y a donc ni baseline ni surface commune
 * à comparer. Rien ici n'est un détail de test. C'est un SOUS-ENSEMBLE du contrat, reduit a ce
 * qu'un fichier .ts doit tenir quand il n'y a autour de lui qu'un Node nu : pas de tsconfig,
 * pas de node_modules, pas de resolution d'alias. C'est plus court que la table differentielle
 * parce qu'il n'y a ni baseline ni subscriber a comparer — pas parce qu'il en verifierait moins.
 */
const CONTRAT = `import { signal } from "./signals.ts"
const echecs = []
const verifie = (nom, condition) => { if (!condition) echecs.push(nom) }

// SPEC §5.2 — NaN notifie, et chaque ecriture NaN est une notification distincte.
const nan = signal(1)
nan.value = NaN
nan.value = NaN
verifie("NaN ecrit deux fois, version 2", nan._version === 2)

// SPEC §5.2 — 0 et -0 sont indiscernables : l'ecriture est ignoree.
const versMoinsZero = signal(0)
versMoinsZero.value = -0
verifie("0 vers -0 ignore", Object.is(versMoinsZero.value, 0))

const versZero = signal(-0)
versZero.value = 0
verifie("-0 vers 0 ignore", Object.is(versZero.value, -0))

// SPEC §5.2 — la meme reference n'ecrit rien.
const stable = signal(1)
stable.value = 1
verifie("ecriture identique ignoree", stable._version === 0)

// SPEC §5.3 — l'ordre des proprietes-own est contractuel.
verifie(
  "ordre des proprietes",
  JSON.stringify(Object.keys(signal(1))) ===
    JSON.stringify(["_value","_version","_node","_targets","_batchSnapshotVersion","_watched","_unwatched","name"]),
)

if (echecs.length) { console.error(echecs.join(", ")); process.exit(1) }
`

const registre = JSON.parse(await readFile(join(RACINE, "registry.json"), "utf8"))
const source = await readFile(join(RACINE, "registry", "default", "signals.ts"), "utf8")

for (const { nom, paquet } of CLI) {
  console.log(`  ${nom} (${paquet})`)

  const projet = await mkdtemp(join(tmpdir(), "signalcn-porte-"))
  try {
    // Un projet utilisateur ordinaire : un dossier `src/` qu'il ne faut pas toucher.
    await mkdir(join(projet, "src"), { recursive: true })
    await writeFile(join(projet, "src", "app.ts"), "// contenu utilisateur\n")
    await writeFile(
      join(projet, "components.json"),
      JSON.stringify({
        $schema: "https://ui.shadcn.com/schema.json",
        style: "new-york",
        rsc: false,
        tsx: true,
        tailwind: { config: "", css: "", baseColor: "neutral", cssVariables: true },
        aliases: { components: "~/components", utils: "~/lib/utils", ui: "~/components/ui" },
      }),
    )
    // La CLI refuse de travailler sans tsconfig.json, même pour un item en JavaScript.
    // Ce n'est pas un détail : c'est une exigence de la porte d'installation à consigner.
    await writeFile(
      join(projet, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "Bundler",
          allowImportingTsExtensions: true,
          rewriteRelativeImportExtensions: true,
          verbatimModuleSyntax: true,
          noEmit: true,
        },
      }),
    )

    // Un item passé par chemin doit porter son CONTENU : le transport local ne résout pas un
    // chemin de fichier. C'est une limite du transport, pas du schéma — et c'est pourquoi
    // `target` reste obligatoire et c'est lui qui décide de l'atterrissage.
    // L'item est DÉRIVÉ de `registry.json`, pas recopié ici. Comparer une constante à elle-même
    // ne prouve rien : si `registry.json` se trompait de `target`, cette porte le dirait quand
    // même. Le seul ajout est `content`, que le transport par chemin exige et qu'aucun registre
    // distant n'a besoin de porter.
    const item = structuredClone(registre.items[0])
    porte(`${nom} : registry.json declare un item`, item !== undefined)
    if (!item) continue
    item.$schema = "https://ui.shadcn.com/schema/registry-item.json"
    item.registryDependencies = item.registryDependencies ?? []
    for (const fichier of item.files ?? []) {
      porte(`${nom} : ${fichier.path} porte un target`, typeof fichier.target === "string")
      fichier.content = source
    }
    const cheminItem = join(projet, "item.json")
    await writeFile(cheminItem, JSON.stringify(item, null, 2))

    const ajout = spawnSync("npx", ["--yes", paquet, "add", "./item.json", "-y"], {
      cwd: projet,
      encoding: "utf8",
    })

    if (ajout.status !== 0) {
      porte(`${nom} : installation`, false, (ajout.stderr || ajout.stdout).replace(/\s+/g, " ").slice(0, 300))
      continue
    }
    porte(`${nom} : installation`, true)

    // À la racine du projet, pas dans `src/` : c'est `target` qui le décide, et non le nom.
    const aLaRacine = await readFile(join(projet, "signals.ts"), "utf8").catch(() => null)
    porte(`${nom} : signals.ts atterrit a la racine`, aLaRacine !== null)
    porte(
      `${nom} : src/ intact`,
      (await readFile(join(projet, "src", "app.ts"), "utf8")) === "// contenu utilisateur\n",
    )

    // Zéro dépendance d'exécution : c'est une promesse de la distribution, pas un souhait.
    const importsExternes = [...(aLaRacine ?? "").matchAll(/from\s*"([^"]+)"/g)]
      .map(m => m[1])
      .filter(spec => !spec.startsWith(".") && !spec.startsWith("node:"))
    porte(`${nom} : zero dependance d'execution`, importsExternes.length === 0, importsExternes.join(", "))

    // La CLI REÉCRIT le fichier qu'elle installe, et pas toutes les versions pareil : 2.x
    // supprime les commentaires, 3.x les garde. On ne compare donc pas les octets — comparer les
    // octets ferait échouer la porte sur une différence qui n'a aucun effet sur le moteur, et
    // surtout la laisserait passer si le réécriture cassait quelque chose. Ce qu'on compare,
    // c'est le CONTRAT.
    if (aLaRacine !== source) {
      const commentaires = (source.match(/\/\*[\s\S]*?\*\//g) ?? []).length
      const gardes = (aLaRacine.match(/\/\*[\s\S]*?\*\//g) ?? []).length
      console.log(
        `  note ${nom} : la CLI a reecrit le fichier (${commentaires} -> ${gardes} commentaire(s))`,
      )
    }

    // Et il tourne, dans ce projet qui n'a que Node : pas de `node_modules`, pas de TypeScript
    // installé, pas de résolution d'alias. C'est la promesse du code distribué.
    await writeFile(join(projet, "sonde.mjs"), CONTRAT)
    porte(`${nom} : le projet n'a pas de node_modules`, !(await readdir(projet)).includes("node_modules"))
    const tourne = spawnSync(process.execPath, ["sonde.mjs"], { cwd: projet, encoding: "utf8" })
    porte(
      `${nom} : le fichier installe tient le contrat sur Node nu`,
      tourne.status === 0,
      tourne.status === 0 ? "" : (tourne.stderr || "").replace(/\s+/g, " ").slice(0, 300),
    )
  } finally {
    await rm(projet, { recursive: true, force: true })
  }
}

cloture()
