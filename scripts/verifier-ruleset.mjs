/**
 * Porte de dérive du ruleset.
 *
 *   node scripts/verifier-ruleset.mjs
 *
 * Elle répond à une seule question : **le ruleset versionné décrit-il encore la CI ?**
 *
 * GitHub n'a pas de « rulesets as code ». Un ruleset réglé à la main dans l'interface est un fait
 * que rien ne vérifie, donc un fait qui peut mentir. `.github/rulesets/master.json` est la seule
 * source, `gh api` l'applique, et cette porte compare ce que la source déclare aux jobs que les
 * workflows exécutent réellement.
 *
 * Elle lit TOUS les fichiers de `.github/workflows/`, et non `ci.yml` seul. Un job de publication
 * posé dans un autre fichier était invisible d'ici, et l'affirmation de cette porte devenait
 * fausse sans que personne ne le voie — dans un dépôt dont la règle est qu'une seule source de
 * vérité doit être gardée.
 *
 * Elle compare dans les DEUX sens, et c'est le premier qui compte : un job ajouté à `ci.yml` sans
 * être requis laisserait la PR suivante se fusionner sans son contrôle — le piège classique des
 * checks requis. Le sens inverse ne fait pas passer une PR par accident : il la bloque pour
 * toujours, parce qu'aucun run ne produira jamais ce check.
 *
 * Elle n'EXIGE pas le déploiement : son absence laisse la porte verte, comme avant qu'il existe.
 * Ce qu'elle exige, c'est que le job de publication soit le SEUL à ne pas être un check requis,
 * et qu'il ne porte pas de `continue-on-error`. Sans cela, l'égalité des listes dirait « conforme »
 * à un dépôt où un second déploiement s'est glissé dans les exceptions sans que personne ne le voie.
 *
 * Elle ne lit pas le ruleset APPLIQUÉ. Seul `gh` avec les droits d'administration peut le dire, et
 * ce n'est pas un test de CI. Ce qu'elle garantit, c'est que le fichier est la source et qu'il
 * décrit la CI — un règlement manuel dans l'interface reste possible et reste invisible.
 *
 * Elle ne lit pas non plus la FORME du déclencheur du déploiement au-delà de `pull_request` : un
 * `branches:` ajouté à son `push` publierait à chaque push sur `master` sans la faire tomber, parce
 * que ce job resterait hors des checks requis — ce qui est vrai, et qui est la seule chose que cette
 * porte affirme. Le §5 de `site/contributeurs/ci.md` écrit cette contrainte ; rien ne la garde.
 */

import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()

const ruleset = JSON.parse(
  await readFile(join(RACINE, ".github", "rulesets", "master.json"), "utf8"),
)

// Une section de premier niveau, de sa clé à la clé de premier niveau suivante : `jobs:` et `on:`
// sont les deux seules que cette porte lise, et toutes deux se terminent de la même façon. Un
// motif ancré sur deux espaces ne peut pas descendre dans un pas : les clés d'un pas sont
// indentées de six. Un commentaire ne borne rien, même collé à la marge — `ci.yml` en porte un
// entre le job `distribution` et le job `canari`.
function section(texte, cle) {
  const debut = texte.search(new RegExp(`^${cle}:$`, "m"))
  if (debut < 0) return ""
  const lignes = texte.slice(debut).split("\n").slice(1)
  const fin = lignes.findIndex((ligne) => /^\S/.test(ligne) && !ligne.startsWith("#"))
  return lignes.slice(0, fin < 0 ? undefined : fin).join("\n")
}

// Tous les workflows, et pas un seul fichier. Un job de publication posé ailleurs était invisible
// de cette porte, et son affirmation devenait fausse sans que personne ne le voie ; à l'inverse un
// cinquième job ajouté à `ci.yml` la faisait tomber en exigeant du ruleset qu'il liste un
// déploiement parmi les checks requis — exactement le travers que ce déploiement existe pour éviter.
const DOSSIER = join(RACINE, ".github", "workflows")
const workflows = await Promise.all(
  (await readdir(DOSSIER))
    .filter((nom) => /\.ya?ml$/.test(nom))
    .sort()
    .map(async (fichier) => {
      const texte = await readFile(join(DOSSIER, fichier), "utf8")
      const bloc = section(texte, "jobs")
      return {
        nom: fichier,
        texte,
        cles: [...bloc.matchAll(/^ {2}([\w-]+):/gm)].map(([, cle]) => cle),
        noms: [...bloc.matchAll(/^ {2}[\w-]+:\n {4}name: (.+)$/gm)].map(([, nomJob]) => nomJob),
        // Ce qui décide du statut d'un job est son DÉCLENCHEUR, jamais son nom : seul un workflow
        // qui se déclenche sur une pull request peut produire un check exigé. Renommer `deployer`
        // ne doit rien changer à ce que cette porte croit, et ajouter `pull_request` au
        // déploiement doit la faire tomber — jamais le contraire.
        bloquant: /^ {2}pull_request:/m.test(section(texte, "on")),
      }
    }),
)

// Une règle par type, parce que le ruleset est une liste et que le type est son seul index. Le
// `?? {}` fait qu'une règle retirée donne un `undefined` lu, donc une porte rouge qui nomme le
// manque, plutôt qu'une exception qui oblige à relire le fichier pour savoir lequel.
const regle = (type) => ruleset.rules.find((r) => r.type === type)?.parameters ?? {}

// Les jobs sont lus par une expression régulière, pas par un parseur YAML : le dépôt n'a aucune
// dépendance YAML et n'en veut pas — un parseur de plus à garder à jour pour lire quatre noms.
// Le motif est ancré sur la structure du fichier : deux espaces pour une clé de job, quatre pour
// son `name:`. C'est le `name:` que GitHub compare, pas la clé — `canari` s'annonce sous le nom
// « canari / derniere CLI publiee ».
const checks = regle("required_status_checks").required_status_checks?.map(({ context }) => context)
const bloquants = workflows.filter(({ bloquant }) => bloquant)

// L'ordre n'est pas comparé : il n'a aucun sens pour GitHub, et `ci.yml` a déjà une porte qui le
// garde contre `site/contributeurs/ci.md`. Ce qui compte est l'ensemble, donc il est comparé trié.
const ensemble = (liste) => [...liste].sort().join(" | ")

// Le déploiement est ÉCARTÉ AVANT le tri, et non retiré de la comparaison par son nom : c'est son
// déclencheur qui l'exclut, donc un job renommé reste un job non requis, et un job écrit dans un
// autre workflow ne se glisse pas dans les checks requis en changeant de nom. Le tri reste donc la
// comparaison des quatre contrôles, et l'égalité dit ce qu'elle dit : rien de plus que les jobs qui
// peuvent bloquer.
const jobs = bloquants.flatMap(({ noms }) => noms)

porte(
  "les checks requis sont exactement les jobs qui peuvent bloquer",
  ensemble(checks ?? []) === ensemble(jobs),
  `ruleset : ${ensemble(checks ?? []) || "(aucun)"} — workflows : ${bloquants
    .map(({ nom, noms }) => `${nom} : ${noms.join(", ")}`)
    .join(" ; ")}`,
)

// Les deux trous qu'un balayage de jobs laisse ouverts, et qu'un seul compte suffit à fermer. Un
// workflow sans job ne contribue rien à la comparaison et la laisse verte sans rien avoir lu ; un
// job sans `name:` produit un check que GitHub nomme par sa CLÉ, donc un check que cette porte ne
// voit pas — et dont l'absence dans le ruleset passerait inaperçue.
const trouves = workflows
  .filter(({ cles, noms }) => cles.length === 0 || cles.length !== noms.length)
  .map(({ nom, cles, noms }) => `${nom} : ${noms.length} nom(s) pour ${cles.length} job(s)`)

porte(
  "chaque workflow declare des jobs, et chaque job un nom",
  trouves.length === 0,
  trouves.length > 0
    ? trouves.join(" ; ")
    : "un job sans `name:` est un check que GitHub nomme par sa cle — donc un check invisible ici",
)

// Un seul workflow peut ne pas exiger de check : le déploiement. Zéro ne fait pas tomber la porte —
// elle n'exige pas que le site soit publié — mais deux signifieraient qu'une exception est devenue
// une règle, et c'est le trou que cette porte est là pour fermer.
const exceptions = workflows.filter(({ bloquant }) => !bloquant)

porte(
  "un seul workflow peut ne pas exiger de check, et c'est le deploiement",
  exceptions.length <= 1,
  exceptions.map(({ nom }) => nom).join(", "),
)

porte(
  "la branche doit etre a jour de master avant de fusionner",
  regle("required_status_checks").strict_required_status_checks_policy === true,
  "sans cette règle, les contrôles ont pu tourner sur une tête de branche que la fusion rejouée ne reproduit pas",
)

const pr = regle("pull_request")
porte(
  "la fusion se fait en rebase, par une PR, sans approbation humaine",
  JSON.stringify(pr.allowed_merge_methods) === JSON.stringify(["rebase"]) &&
    pr.required_approving_review_count === 0,
  `méthodes ${JSON.stringify(pr.allowed_merge_methods)}, ${pr.required_approving_review_count} approbation(s)`,
)

porte(
  "le ruleset est actif, sur la branche par defaut, sans bypass",
  ruleset.enforcement === "active" &&
    ruleset.conditions?.ref_name?.include?.includes("~DEFAULT_BRANCH") === true &&
    (ruleset.bypass_actors?.length ?? 0) === 0,
  `enforcement ${ruleset.enforcement}, cibles ${JSON.stringify(ruleset.conditions?.ref_name?.include)}, ${ruleset.bypass_actors?.length ?? 0} bypass`,
)

// La porte ci-dessus voit un job `continue-on-error` dans les deux listes et conclut que tout va
// bien. GitHub, lui, le tient pour non bloquant : le ruleset est alors appliqué avec un check qui
// ne protège rien, et rien ne le signale. C'est le seul cas où l'égalité des listes est un
// mensonge, donc il a sa propre porte. Elle vaut pour le déploiement comme pour les contrôles —
// c'est le job qui n'est PAS requis, donc `continue-on-error` y est le seul moyen de le rendre
// faux en vert.
//
// Le motif est ANCRÉ sur une clé de YAML, jamais une simple occurrence : les fichiers parlent de
// `continue-on-error` dans leurs commentaires, qui disent pourquoi il est interdit. Chercher le
// mot les ferait tomber sur leur propre explication.
const tolerants = workflows
  .filter(({ texte }) => /^\s*continue-on-error:\s*true\b/m.test(texte))
  .map(({ nom }) => nom)

porte(
  "aucun job n'est marque continue-on-error",
  tolerants.length === 0,
  tolerants.length > 0
    ? tolerants.join(", ")
    : "un job ainsi marque ne peut pas etre un check requis : le ruleset afficherait un controle qui ne bloque rien",
)

cloture()
