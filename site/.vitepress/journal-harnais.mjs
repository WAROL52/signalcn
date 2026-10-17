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
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

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
    // Les lignes ` ECHEC ` du journal sont nommées dans le message : le rapport du harnais dit
    // QUI a levé et pourquoi, et un build qui ne montre pas cette raison oblige à relancer le
    // harnais à la main pour la voir.
    if (status !== 0) {
      const raisons = stdout
        .split("\n")
        .filter((ligne) => ligne.includes(" ECHEC "))
        .join("\n")
      throw new Error(
        `le harnais a échoué — le site ne peut pas afficher un harnais en échec :\n${raisons || stderr.trim() || error?.message}`,
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

// =============================================================================================
// Le lecteur d'injection — #122.
//
// Deux préfixes de marqueur de bloc de code, deux sources, UN pacte : le bloc nommé est exécuté
// contre `signalcn` au moment de la construction, et la page reçoit le code nettoyé et le journal
// que le moteur a produit. Rien ne se figurera à la main : un journal écrit d'avance dans une page
// est un mensonge en attente d'exécution, et la divergence ne se voit nulle part.
//
//   import { lecteurInjection } from "./journal-harnais.mjs"
//
// Les préfixes :
//
//   scenarios/<groupe>/<nom>     — un scénario de la table (`scenarios` du fichier de test) ;
//   reconstitution/<nom>         — UN test de la suite `signalcn-seul` (`testsSignalcnSeul`),
//                                  un nom à un seul segment, la source l'exige.
//
// La table vit dans `registry/default/signals.test.ts`, et elle porte les DEUX : ce qui rejoue
// contre la baseline (l'export `scenarios`), et ce qui est nôtre (`testsSignalcnSeul`). Elle est
// chargée UNE fois par construction, au premier bloc à résoudre — le même paresseux que le
// chargerMermaid de `mermaid.mjs`. Le moteur exécuté est l'artefact distribué, `signals.js`, parce
// que c'est LUI que la page dit importer — un bloc exécuté contre la source alors que la page
// nomme `signaljs` serait un second sens pour le même mot.
//
// Le nettoyage suit le pacte fixé par la page témoin :
//
//   1. la déstructuration du harnais devient un import lisible — `api.signal(1)` devient
//      `signal(1)`, et une ligne `import { signal } from "signalcn"` ouvre le bloc ;
//   2. les `log()` restent dans le code et redescendent en journal — c'est le seul lien entre
//      le code affiché et le journal affiché ;
//   3. l'`assert` terminal disparaît : il appartient à la suite, pas à l'exemple ;
//   4. `auRuntime(...)` est une enveloppe de TYPAGE de la table — le type se retire, la valeur
//      reste — et les commentaires s'en vont avec lui : ils parlent à la matrice, pas à un
//      utilisateur.
//
// **Un échec nomme fichier et ligne.** Un nom que le lecteur ne résout pas, un scénario qui lève,
// un journal vide : la construction s'arrête, et le message porte `chemin:marqueur` — c'est la
// règle du plugin du journal, étendue à la deuxième source. Une page ne se paie jamais un journal
// faux ; le lecteur refuse aussi le journal écrit à la main sur la page, qui restera caduc.
// =============================================================================================

/** Les dix noms de surface, dans l'ordre du bloc d'import du README — l'ordre que la page montre. */
const SURFACE = [
  "Signal",
  "Computed",
  "Effect",
  "signal",
  "computed",
  "effect",
  "batch",
  "untracked",
  "action",
  "createModel",
]

// Les DEUX préfixes de marqueur, sous la forme où la page les écrit. Le scénario porte UN groupe et
// UN nom ; la reconstitution porte UN nom, un seul segment — c'est la liste « REJOUABLES » du
// harnais qui en fait foi, et qui pourrait toujours être citée telle quelle.
const PREFIX_SCENARIO = "scenarios/"
const PREFIX_RECONSTITUTION = "reconstitution/"
const MARQUEUR_SCENARIO = /^scenarios\/[\w-]+\/[\w-]+$/
const MARQUEUR_RECONSTITUTION = /^reconstitution\/[\w-]+$/

// Le bloc de code d'une page : une fence dont l'info contient le marqueur. La capture est paresseuse
// jusqu'à la première fermure — un corps de la table ne porte jamais ```, vérifié par le lecteur
// ci-dessous, qui refuse un code ou un journal qui en porterait, plutôt que d'écrire une fence
// malade.
const BLOC_MARQUEUR =
  /```(\w*)[ \t]+(scenarios\/[\w-]+\/[\w-]+|reconstitution\/[\w-]+)[ \t]*\n([\s\S]*?)```/g

/**
 * La table et le moteur, UNE fois par construction. Deux imports dynamiques, au chemin du
 * RÉPERTOIRE COURANT — le répertoire est `package.json`, comme pour le harnais, pour la même
 * raison : `import.meta.url` ne dit rien ici.
 */
const lireSources = (() => {
  let memo
  return () => {
    if (memo) return memo

    const chemin = (relatif) => pathToFileURL(join(process.cwd(), relatif)).href

    memo = import(chemin("registry/default/signals.test.ts")).then(async (table) => ({
      scenarios: table.scenarios,
      suiteSeule: table.testsSignalcnSeul,
      makeLog: table.makeLog,
      // Le TEXTE de la table, et non le module : le code nettoyé s'y lit dans son mot, ce que
      // l'objet importé ne porte pas.
      source: readFileSync(join(process.cwd(), "registry/default/signals.test.ts"), "utf8"),
      moteur: await import(chemin("registry/default/signals.js")),
    }))
    return memo
  }
})()

/**
 * La résolution : le marqueur en son autorité, jamais en son espérance. Les trois fautes disent
 * chacune ce qu'elles attendaient, et la barre du message est faite par le plugin au moment du
 * fichier — la résolution ne connaît pas la page, elle nomme la source qui a parlé.
 */
export const resoudre = async (marqueur) => {
  if (MARQUEUR_SCENARIO.test(marqueur)) {
    const nom = marqueur.slice(PREFIX_SCENARIO.length)
    const { scenarios } = await lireSources()
    const scenario = scenarios.find((s) => s.name === nom)
    if (!scenario) {
      throw new Error(
        `le scénario « ${nom} » n'est pas nommé — un marqueur ne solutionne pas un espoir`,
      )
    }
    return { genre: "scenario", nom, scenario }
  }

  if (MARQUEUR_RECONSTITUTION.test(marqueur)) {
    const nom = marqueur.slice(PREFIX_RECONSTITUTION.length)
    if (nom.includes("/")) {
      throw new Error(`la reconstitution « ${nom} » porte un nom à un seul segment, jamais deux`)
    }
    const { suiteSeule } = await lireSources()
    if (!Object.hasOwn(suiteSeule, nom)) {
      throw new Error(`la reconstitution « ${nom} » n'est pas dans la suite signalcn-seul`)
    }
    return { genre: "reconstitution", nom }
  }

  throw new Error(
    `le marqueur « ${marqueur} » ne porte ni préfixe connu — ${PREFIX_SCENARIO} ou ${PREFIX_RECONSTITUTION}`,
  )
}

/**
 * Le scanneur des deux commentaires, puis le lecteur. Il ne SUBSTITUE jamais une région ignorée
 * par une approximation : les chaînes, les gabarits et leurs interpolations sont suivis
 * caractère par caractère, parce qu'un `//` dans l'une d'elles se lirait sinon comme un début
 * de commentaire — et le premier scénario qui le porterait serait amputé en silence.
 *
 * `garderChains` rend la régions ignorées telles quelles (pour le code affiché) ou vidées (pour
 * compter les noms de surface que le code VISIBLE utilise — un nom écrit dans une chaîne
 * n'est pas un appel).
 */
const marche = (source, garderChains = true) => {
  let sortie = ""
  let i = 0
  while (i < source.length) {
    const c = source[i]
    const suivant = source[i + 1]

    if (c === "/" && suivant === "/") {
      const fin = source.indexOf("\n", i)
      if (fin < 0) return sortie
      i = fin
      continue
    }
    if (c === "/" && suivant === "*") {
      const fin = source.indexOf("*/", i + 2)
      i = fin < 0 ? source.length : fin + 2
      continue
    }

    if (c === '"' || c === "'") {
      const guillemet = c
      let j = i + 1
      while (j < source.length) {
        if (source[j] === "\\") j += 2
        else if (source[j] === guillemet) break
        else j++
      }
      if (garderChains) sortie += source.slice(i, j + 1)
      else sortie += ' "" '
      i = j + 1
      continue
    }

    if (c === "`") {
      const ouverture = i
      let j = i + 1
      while (j < source.length) {
        if (source[j] === "\\") {
          j += 2
          continue
        }
        if (source[j] === "`") break
        if (source[j] === "$" && source[j + 1] === "{") {
          // L'interpolation est du CODE : ses chaînes, ses gabarits et ses commentaires sont
          // les mêmes que dehors, donc la même marche — récursive au lieu d'une regexp.
          let profondeur = 1
          let sousI = j + 2
          while (sousI < source.length && profondeur > 0) {
            const sousC = source[sousI]
            const sousSuivant = source[sousI + 1]
            if (sousC === "/" && sousSuivant === "/") {
              sousI = Math.min(source.indexOf("\n", sousI), source.length)
              continue
            }
            if (sousC === "/" && sousSuivant === "*") {
              const fin = source.indexOf("*/", sousI + 2)
              sousI = fin < 0 ? source.length : fin + 2
              continue
            }
            if (sousC === '"' || sousC === "'") {
              sousI++
              while (sousI < source.length && source[sousI] !== sousC)
                sousI += source[sousI] === "\\" ? 2 : 1
              sousI++
              continue
            }
            if (sousC === "`") {
              sousI++
              while (sousI < source.length && source[sousI] !== "`")
                sousI += source[sousI] === "\\" ? 2 : 1
              sousI++
              continue
            }
            if (sousC === "{") profondeur++
            else if (sousC === "}") profondeur--
            sousI++
          }
          j = sousI
          continue
        }
        j++
      }
      if (garderChains) sortie += source.slice(ouverture, j + 1)
      else sortie += " `` "
      i = j + 1
      continue
    }

    sortie += c
    i++
  }
  return sortie
}

/**
 * Un corps d'accolades : la première ouverture suivie dans la source, accolades jumelles
 * comprises, les mêmes régions ignorées que `marche`. `null` si la source s'arrête avant la
 * fermure — une extraction qui fait semblant serait la pire façon d'afficher moitié bloc.
 */
const corpsDe = (source, debut) => {
  let i = debut
  while (i < source.length && source[i] !== "{") i++
  if (i >= source.length) return null
  const ouverture = i
  let profondeur = 0
  while (i < source.length) {
    const c = source[i]
    const suivant = source[i + 1]
    if (c === "/" && suivant === "/") {
      const fin = source.indexOf("\n", i)
      if (fin < 0) return null
      i = fin
      continue
    }
    if (c === "/" && suivant === "*") {
      const fin = source.indexOf("*/", i + 2)
      i = fin < 0 ? source.length : fin + 2
      continue
    }
    if (c === '"' || c === "'" || c === "`") {
      i++
      while (i < source.length && source[i] !== c) i += source[i] === "\\" ? 2 : 1
      i++
      continue
    }
    if (c === "{") profondeur++
    else if (c === "}") {
      profondeur--
      if (profondeur === 0) return source.slice(ouverture + 1, i)
    }
    i++
  }
  return null
}

/**
 * Le bloc SOURCE d'un marqueur — à la main par les exercices du verifier, au fil de l'eau par
 * `executer` : quel que soit le préfixe, un corps, et les paires d'alias d'une reconstitution.
 */
export const blocDe = async (marqueur) => {
  const { genre, nom } = await resoudre(marqueur)
  const { source } = await lireSources()

  if (genre === "scenario") {
    const corps = corpsScenario(source, nom)
    return corps === null ? null : { corps, paires: [] }
  }

  const extrait = corpsReconstitution(source, nom)
  return extrait ?? null
}

/** Le corps d'un scénario de la table : sa ligne `name:`, puis son `run({...})`. */
const corpsScenario = (source, nom) => {
  const nomme = source.indexOf(`name: "${nom}"`)
  if (nomme < 0) return null
  return corpsDe(source, source.indexOf("run(api", nomme))
}

/**
 * Le corps d'une reconstitution de la suite : sa clé, ses paramètres déstructurés, son
 * `async ({...}) => {`. Les paires renommées — `{ signal: s }` — sont uniques à une paire,
 * et le corps les montrera sous leur nom de surface.
 */
const corpsReconstitution = (source, nom) => {
  const index = source.indexOf(`"${nom}":`)
  if (index < 0) return null
  const gache = source.slice(index)
  const ouvertureParams = gache.indexOf("{", gache.indexOf("async"))
  const fleche = /\}\s*\)\s*=>\s*\{/.exec(gache)
  if (fleche === null) return null
  const corps = corpsDe(gache, fleche.index + fleche[0].length - 1)
  if (corps === null) return null
  // Les alias : local (celui du corps) vers cle (celle du moteur) — l'affichage montre la cle.
  const paires = []
  for (const morceau of gache
    .slice(ouvertureParams + 1, gache.indexOf("}", ouvertureParams))
    .split(",")) {
    const net = morceau.trim()
    if (net === "") continue
    const renomme = /^([\w$]+)\s*:\s*([\w$]+)$/.exec(net)
    paires.push(renomme ? { local: renomme[1], cle: renomme[2] } : { local: net, cle: net })
  }
  return { corps, paires }
}

/** Le décalage commun, retiré : le bloc affiché commence au premier geste, pas à l'indentation. */
const dedent = (texte) => {
  const lignes = texte.split("\n")
  const nonVides = lignes.filter((ligne) => ligne.trim() !== "")
  const unite =
    nonVides.length > 0 ? Math.min(...nonVides.map((l) => l.length - l.trimStart().length)) : 0
  return lignes.map((l) => (l.trim() === "" ? "" : l.slice(unite)))
}

/**
 * Le DERNIER énoncé de premier niveau disparaît s'il commence par `assert.` — c'est lui le verdict
 * de la suite, et un verdict n'est ni recopiable ni éclairant dans une page. Un énoncé commence à
 * la colonne 0 ; ses suite sont indentées ou vides. Le marqueur est le DERNIER mot de premier
 * niveau : un `assert` au milieu du corps reste du corps — la règle demande qu'on retire le
 * verdict de fins de page, pas tout verbe de la langue.
 */
const sansAssertion = (lignes) => {
  let dernier = -1
  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i]
    if (ligne.trim() === "" || !/^\S/.test(ligne)) continue
    // Une fermure de premier niveau — `])`, `})`, `);` — clôt l'énoncé D'AVANT : ce n'est pas un
    // début. Sans ce cas, l'assert multiligne se terminait par `])` en colonne 0, le dernier
    // énoncé vu était la fermure — pas l'assertion — et le verdict restait dans la page.
    if (/^[}\])]/.test(ligne)) continue
    dernier = i
  }
  if (dernier < 0 || !lignes[dernier].startsWith("assert.")) return lignes
  return lignes.slice(0, dernier)
}

/**
 * L'enveloppe de TYPAGE : `auRuntime(x)` est x. Un déballage simple avec `[^()]+` manquait
 * l'imbrication — `auRuntime(api.signal(7))` — mesuré sur `signal/zero-and-negative-zero`.
 * Ici chaque enveloppe est déballée par ses acolades, les régions ignorées incluses, jusqu'à
 * ce qu'il n'y en ait plus.
 */
const deballerAuRuntime = (texte) => {
  let courant = texte
  for (;;) {
    const index = courant.indexOf("auRuntime(")
    if (index < 0) return courant

    let i = index + "auRuntime(".length
    let profondeur = 1
    let fermure = -1
    while (i < courant.length && fermure < 0) {
      const c = courant[i]
      if (c === '"' || c === "'" || c === "`") {
        i++
        while (i < courant.length && courant[i] !== c) i += courant[i] === "\\" ? 2 : 1
        i++
        continue
      }
      if (c === "(") profondeur++
      else if (c === ")") {
        profondeur--
        if (profondeur === 0) fermure = i
      }
      i++
    }
    if (fermure < 0) return courant

    courant =
      courant.slice(0, index) +
      courant.slice(index + "auRuntime(".length, fermure) +
      courant.slice(fermure + 1)
  }
}

/**
 * Le pacte du nettoyage, EXERCÉ par le verifier sur des corps réels : les commentaires s'en
 * vont, `api.surface` retourne bare, les enveloppes de typage sont déballées, l'assert terminal
 * est retiré du code affiché, et l'import nominal ouvre le bloc avec les surfaces réellement
 * utilisées — dans l'ordre du README, pas celui de l'utilisation.
 */
export const nettoyer = (corps, paires = []) => {
  let texte = sansAssertion(dedent(marche(corps))).join("\n")
  texte = texte
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+$/, "")

  for (const { local, cle } of paires) {
    if (local !== cle) texte = texte.replace(new RegExp(`\\b${local}\\b`, "g"), () => cle)
  }
  texte = texte.replace(new RegExp(`\\bapi\\.(${SURFACE.join("|")})\\b`, "g"), (_tout, nom) => nom)
  texte = deballerAuRuntime(texte)

  const nomsUtilises = [
    ...marche(texte, false).matchAll(new RegExp(`\\b(${SURFACE.join("|")})\\b`, "g")),
  ].map((m) => m[1])
  const noms = [...new Set(nomsUtilises)].sort((a, b) => SURFACE.indexOf(a) - SURFACE.indexOf(b))
  const code = `import { ${noms.join(", ")} } from "signalcn"\n\n${texte}\n`
  return { code, noms }
}

// ---------------------------------------------------------------------------------------------
// Le plugin Vite : il réécrit la SOURCE du fichier de page avant que le markdown n'y passe,
// exactement l'endroit de `validerMermaid`. Il ne lit que les `.md`, et ne réécrit que les
// blocs-marqueurs — une page sans marqueur sort de son transform telle qu'elle est entrée.
//
// Les marqueurs ne vivent QUE sur les PAGES qui les déclarent — un bloc-marqueur écrit ailleurs
// est un marqueur sans source au point où on s'attend à le lire, donc une faute, pas un oubli.
// La liste suit les pages d'API au fur et à mesure de leur atterrissage.
// ---------------------------------------------------------------------------------------------

const PAGES_LECTEUR = ["site/utilisateurs/api/signal.md", "site/utilisateurs/api/effect.md"]

/**
 * Le bloc exécuté, UNE fois par marqueur et par construction. Un échec s'efface de la mémoire :
 * une faute réessayée resterait fausse si la memo gardait sa promesse rejetée, et la construction
 * suivant ne verrait jamais sa vraie raison.
 */
const executer = (() => {
  const memo = new Map()

  return async (marqueur) => {
    if (memo.has(marqueur)) return memo.get(marqueur)

    const promesse = (async () => {
      const { genre, nom, scenario } = await resoudre(marqueur)
      const { moteur, makeLog, suiteSeule } = await lireSources()

      const log = makeLog()
      const api = Object.fromEntries(SURFACE.map((nomSurface) => [nomSurface, moteur[nomSurface]]))

      if (genre === "scenario") {
        scenario.run(api, log)
      } else {
        await suiteSeule[nom]({ ...api, log })
      }

      const bloc = await blocDe(marqueur)
      if (bloc === null) {
        throw new Error(
          `le corps de « ${marqueur} » n'est pas lisible dans sa source — le nom est résolu, le texte non ?`,
        )
      }
      const { corps, paires } = bloc

      const entries = log.entries
      if (entries.length === 0) {
        throw new Error(
          `« ${marqueur} » ne journalise rien — un bloc affiché sans journal mentirait par omission`,
        )
      }
      const entrees = entries.join("\n")
      const { code, noms } = nettoyer(corps, paires)

      // Les gardes : une fence écrite dans le corps ou dans le journal, un `auRuntime` ou un
      // `api` résiduels — chacun nommé, chacun un mensonge qu'une fence mal salie porterait.
      for (const [mot, raison] of [
        ["```", "le corps du bloc porte des triples accents — il fermerait sa propre fence"],
        [
          "api",
          "le bloc affiché garde « api » — la déstructuration du harnais n'a pas entièrement quitté",
        ],
        [
          "auRuntime",
          "le bloc affiché garde « auRuntime » — l'enveloppe de typage n'a pas entièrement quitté",
        ],
      ]) {
        if (marche(code, false).includes(mot)) throw new Error(raison)
      }
      if (entrees.includes("```"))
        throw new Error("le journal porte des triples accents — il fermerait sa propre fence")

      return { code, noms, journal: entrees }
    })()

    promesse.catch(() => memo.delete(marqueur))
    memo.set(marqueur, promesse)
    return promesse
  }
})()

/**
 * Le lecteur d'injection. La règle de ligne est celle de `validerMermaid` : l'indice du bloc sur
 * le TABLEAU de correspondance, pas sur la chaîne — la déstructuration d'un `match` perd
 * `match.index`, et la ligne annoncée serait celle du fichier entier.
 */
export const lecteurInjection = {
  name: "signalcn-injection",
  enforce: "pre",
  async transform(code, id) {
    if (!id.endsWith(".md")) return null
    const chemin = id.replaceAll("\\", "/")
    const estPage = PAGES_LECTEUR.some((page) => chemin.endsWith(`/${page}`))

    const blocs = [...code.matchAll(BLOC_MARQUEUR)]
    if (blocs.length === 0) return null
    if (!estPage) {
      throw new Error(
        `${chemin}:${code.slice(0, code.search(BLOC_MARQUEUR)).split("\n").length} — ` +
          `le bloc-marqueur ne vit que sur ${PAGES_LECTEUR.join(", ")}`,
      )
    }

    let sortie = ""
    let curseur = 0
    for (const bloc of blocs) {
      const ligne = code.slice(0, bloc.index).split("\n").length

      // Le journal porté à la main : la fence qui suit immédiatement le marqueur n'est pas
      // produite par l'exécution, donc elle restera caduc — et elle écrira PAR-DESSUS ce que le
      // lecteur inséra. La faute se nomme sur la fence à la main, pas sur le marqueur.
      const auManuelle = code.slice(bloc.index + bloc[0].length).indexOf("```text")
      const ouvertureManuelle = bloc.index + bloc[0].length + auManuelle
      if (
        auManuelle >= 0 &&
        /^\s*$/.test(code.slice(bloc.index + bloc[0].length, ouvertureManuelle))
      ) {
        throw new Error(
          `${chemin}:${code.slice(0, bloc.index + bloc[0].length + auManuelle).split("\n").length} — ` +
            "le journal qui suit le marqueur est écrit à la main : les journaux portés à la main quittent la page",
        )
      }

      let rendu
      try {
        rendu = await executer(bloc[2])
      } catch (cause) {
        const raison =
          cause instanceof Error ? cause.message.split("\n").slice(0, 3).join(" ") : String(cause)
        throw new Error(`${chemin}:${ligne} — ${raison}`)
      }

      sortie += code.slice(curseur, bloc.index)
      sortie += "```ts\n" + rendu.code + "```\n\n```text\n" + rendu.journal + "\n```\n"
      curseur = bloc.index + bloc[0].length
    }
    sortie += code.slice(curseur)
    return sortie
  },
}
