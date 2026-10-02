/**
 * Porte d'installation.
 *
 * Ce qu'elle prouve, et seulement ça : que les SIX items de `registry.json` sont installables par
 * la CLI, à la racine du projet, par l'adressage GitHub réel — et que les items de test
 * n'installent rien d'autre que l'item d'implémentation qu'ils déclarent.
 *
 *   node scripts/verifier-installation.mjs
 *
 * Deux versions de la CLI : le PLANCHER DÉCLARÉ et la DERNIÈRE CONNUE. Pas `@latest` — un
 * `@latest` ici rendrait le dépôt faux sans qu'aucun commit n'ait changé, et c'est pour ça que la
 * CI porte en plus un canari non bloquant sur la dernière version publiée. Une version de plus
 * n'est pas une preuve de plus.
 *
 * L'ADRESSE EST RÉELLE, `owner/repo/item`. Un item passé par chemin local n'éprouverait rien de ce
 * qui est distribué : la CLI y lit un `content` injecté, alors que sur une adresse elle lit le
 * fichier DANS le dépôt. La différence a été mesurée — c'est elle qui avait laissé `path` et
 * `target` confondus dans `registry.json`.
 *
 * LA COUTURE ENTRE LES DEUX MOITIÉS. Les contrôles de FORME portent sur l'arbre de travail, les
 * installations portent sur ce que GitHub sert. Une pull request qui casse `registry.json` est
 * donc vue par les contrôles de forme, qui ne coûtent rien, tandis que l'adressage lui-même est
 * éprouvé sur la branche `master`. C'est un défaut connu, pas un oubli : une adresse publique ne
 * peut pas,/ne veut pas, désigner une pull request.
 *
 * La sonde de contrat minimale qui precedait cette version est partie. Elle affirmait cinq
 * proprietes de `signals.ts` dans un projet jetable — or les TROIS suites installees s'y executent
 * sur un Node nu, sans `node_modules`, sans TypeScript installe, sans resolution d'alias. C'est la
 * meme promesse, avec quatre-vingt-dix assertions au lieu de cinq.
 */

import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()

/**
 * La matrice, ou une liste fournie par `SIGNALCN_CLI`.
 *
 * Le canari de la CI passe la DERNIÈRE VERSION PUBLIÉE, qu'on ne peut pas épingler par nature. Il
 * passe donc sa liste ici plutôt que de dupliquer la porte dans un second fichier : deux fichiers
 * qui font la même chose divergent, et le canari est précisément le contrôle qu'on oublie de
 * mettre à jour. Format : JSON, la même forme que la liste par défaut.
 */
const CLI = process.env.SIGNALCN_CLI
  ? JSON.parse(process.env.SIGNALCN_CLI)
  : [
      { nom: "shadcn 4.10.0", paquet: "shadcn@4.10.0", plancher: true },
      { nom: "shadcn 4.21.1", paquet: "shadcn@4.21.1" },
    ]

/**
 * Chaque item de test, l'item d'implementation qu'il doit installer, et l'ensemble de fichiers
 * ATTENDU — pas « au moins », l'ensemble. C'est la seule forme qui prouve l'isolation : une liste
 * de fichiers presents accepte l'installation d'un homonyme, et l'homonyme est precisement ce
 * qu'un nom nu dans `registryDependencies` provoquerait.
 */
const PAIRES = [
  { item: "signals-test", impl: "signals", fichiers: ["signals.ts", "signals.test.ts"] },
  { item: "signals-test-js", impl: "signals-js", fichiers: ["signals.js", "signals.test.js"] },
  {
    item: "signals-test-min",
    impl: "signals-min",
    fichiers: ["signals.min.js", "signals.test.min.js"],
  },
]

// ---- 1. La FORME du registre. Aucun réseau, aucun coût -------------------------------------
const registre = JSON.parse(await readFile(join(RACINE, "registry.json"), "utf8"))
const items = registre.items ?? []
const parNom = new Map(items.map((item) => [item.name, item]))

porte("six items declares", items.length === 6, `${items.length} declares`)
porte("les noms sont uniques", parNom.size === items.length)

for (const item of items) {
  porte(`${item.name} : type registry:file`, item.type === "registry:file", item.type)
  for (const fichier of item.files ?? []) {
    porte(
      `${item.name} : ${fichier.path} vise la racine du projet`,
      fichier.target?.startsWith("~/"),
      fichier.target,
    )
    porte(
      `${item.name} : ${fichier.path} est type registry:file`,
      fichier.type === "registry:file",
      fichier.type,
    )
    // `path` est un chemin DU REPO. Le confondre avec `target` est l'erreur qui a valu ce ticket :
    // l'installation passe en local, parce que le transport par chemin lit `content`, et échoue en
    // GitHub, parce que la CLI y lit `path`.
    porte(
      `${item.name} : ${fichier.path} existe dans le depot`,
      existsSync(join(RACINE, fichier.path)),
      fichier.path,
    )
  }
}

// Une dependance pleinement qualifiee porte deux barres : `owner/repo/item`. Un nom nu ne
// designe pas CE registre, et installerait silencieusement l'homonyme d'un autre projet.
for (const { item, impl } of PAIRES) {
  const declare = parNom.get(item)
  const deps = declare?.registryDependencies ?? []
  porte(
    `${item} declare une dependance pleinement qualifiee`,
    deps.length === 1 && /^\S+\/\S+\/\S+$/.test(deps[0]),
    JSON.stringify(deps),
  )
  porte(`${item} depend de ${impl}`, deps[0]?.endsWith(`/${impl}`), JSON.stringify(deps))
}

// ---- 2. L'INSTALLATION, sur l'adresse réelle ------------------------------------------------
const preparer = async (dossier) => {
  await mkdir(join(dossier, "src"), { recursive: true })
  await writeFile(join(dossier, "src", "app.ts"), "// contenu utilisateur\n")
  // La CLI refuse de travailler sans tsconfig.json, meme pour un item en JavaScript. Ce n'est pas
  // un detail : c'est une exigence de la porte d'installation a consigner.
  await writeFile(
    join(dossier, "tsconfig.json"),
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
}

const componentsJson = (tsx) =>
  JSON.stringify({
    $schema: "https://ui.shadcn.com/schema.json",
    style: "new-york",
    rsc: false,
    tsx,
    tailwind: { config: "", css: "", baseColor: "neutral", cssVariables: true },
    aliases: { components: "~/components", utils: "~/lib/utils", ui: "~/components/ui" },
  })

const installer = (dossier, paquet, item) =>
  spawnSync("npx", ["--yes", paquet, "add", `WAROL52/signalcn/${item}`, "-y"], {
    cwd: dossier,
    encoding: "utf8",
  })

for (const { nom, paquet, plancher } of CLI) {
  console.log(`  ${nom} (${paquet})`)

  for (const { item, fichiers } of PAIRES) {
    const dossier = await mkdtemp(join(tmpdir(), "signalcn-porte-"))
    try {
      await preparer(dossier)
      await writeFile(join(dossier, "components.json"), componentsJson(true))

      const ajout = installer(dossier, paquet, item)
      if (ajout.status !== 0) {
        porte(
          `${nom} : ${item} s'installe`,
          false,
          (ajout.stderr || ajout.stdout).replace(/\s+/g, " ").slice(0, 300),
        )
        continue
      }
      porte(`${nom} : ${item} s'installe`, true)

      // L'ensemble, pas un sous-ensemble. Le dossier de travail du projet est le seul endroit où
      // une installation laisse des traces, donc c'est la seule mesure possible.
      const presents = (await readdir(dossier))
        .filter((f) => !["components.json", "tsconfig.json", "src"].includes(f))
        .sort()
      porte(
        `${nom} : ${item} installe exactement ${fichiers.join(", ")}`,
        JSON.stringify(presents) === JSON.stringify([...fichiers].sort()),
        presents.join(", "),
      )

      // Zéro dépendance d'exécution : c'est une promesse de la distribution, pas un souhait. Elle
      // est VÉRIFIÉE, pas supposee, et la preuve est la suite qui tourne ci-dessous.
      porte(`${nom} : le projet n'a pas de node_modules`, !presents.includes("node_modules"))

      // `src/` intact : c'est `target` qui decide de l'atterrissage, et non le nom de l'item.
      porte(
        `${nom} : src/ intact`,
        (await readFile(join(dossier, "src", "app.ts"), "utf8")) === "// contenu utilisateur\n",
      )

      // La suite installee, sur ce Node nu. Et son COMPTE.
      const { NB_TESTS, scenarios } = await import(join(dossier, fichiers[1]))
      const suite = spawnSync(process.execPath, ["--test", "--test-reporter=tap", fichiers[1]], {
        cwd: dossier,
        encoding: "utf8",
      })
      const nombre = (cle) =>
        Number(suite.stdout.match(new RegExp(`^# ${cle} (\\d+)$`, "m"))?.[1] ?? -1)
      porte(
        `${nom} : ${item} — ${nombre("pass")} succes sur ${NB_TESTS} attendus`,
        suite.status === 0 && nombre("pass") === NB_TESTS && nombre("fail") === 0,
        suite.status === 0 ? "" : (suite.stderr || "").replace(/\s+/g, " ").slice(0, 300),
      )

      // Le compte de SCENARIOS, distinct du compte de tests : une suite peut(display) tous ses
      // tests et n'en jouer aucun. On recompte donc les noms de scenarios attendus dans la sortie.
      const noms = new Set([...suite.stdout.matchAll(/^ok \d+ - (.+)$/gm)].map((m) => m[1]))
      const joues = scenarios.filter((s) => noms.has(s.name)).length
      porte(
        `${nom} : ${item} joue les ${scenarios.length} scenarios de la table`,
        joues === scenarios.length,
        `${joues} joues`,
      )
    } finally {
      await rm(dossier, { recursive: true, force: true })
    }
  }

  // ---- 3. `tsx: false` doit ECHOUER BRUYAMMENT ---------------------------------------------
  //
  // Un `tsx: false` impose l'extension : l'item TypeScript arrive en `signals.js` contenant du
  // TypeScript. Ce n'est pas un cas d'erreur de la distribution mais un EXIGENCE documentée
  // (SPEC §17.3, docs/distribution.md §4) — et une exigence qui se manifeste par un silence
  // serait pire qu'une exigence non documentée. On vérifie donc qu'il y a du bruit, et que ce
  // bruit vient bien du TypeScript. Mesuré une fois : sur la version plancher seulement, qui est
  // celle que la documentation déclare comme le plancher.
  if (plancher) {
    const dossier = await mkdtemp(join(tmpdir(), "signalcn-porte-tsx-faux-"))
    try {
      await preparer(dossier)
      await writeFile(join(dossier, "components.json"), componentsJson(false))
      const ajout = installer(dossier, paquet, "signals")
      porte(`${nom} : tsx:false installe quand meme signals`, ajout.status === 0)
      const installe = join(dossier, "signals.js")
      porte(`${nom} : tsx:false impose signals.js`, existsSync(installe))
      const tourne = spawnSync(process.execPath, [installe], { cwd: dossier, encoding: "utf8" })
      porte(
        `${nom} : tsx:false echoue bruyamment`,
        tourne.status !== 0 && (tourne.stderr || "").trim().length > 0,
        "le fichier installe a reussi : l'exigence documentee ne tient plus",
      )
    } finally {
      await rm(dossier, { recursive: true, force: true })
    }
  }
}

cloture()
