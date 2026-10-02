/**
 * Porte de dérive du ruleset.
 *
 *   node scripts/verifier-ruleset.mjs
 *
 * Elle répond à une seule question : **le ruleset versionné décrit-il encore la CI ?**
 *
 * GitHub n'a pas de « rulesets as code ». Un ruleset réglé à la main dans l'interface est un fait
 * que rien ne vérifie, donc un fait qui peut mentir. `.github/rulesets/master.json` est la seule
 * source, `gh api` l'applique, et cette porte compare ce que la source déclare aux jobs que
 * `ci.yml` exécute réellement.
 *
 * Elle compare dans les DEUX sens, et c'est le premier qui compte : un job ajouté à `ci.yml` sans
 * être requis laisserait la PR suivante se fusionner sans son contrôle — le piège classique des
 * checks requis. Le sens inverse ne fait pas passer une PR par accident : il la bloque pour
 * toujours, parce qu'aucun run ne produira jamais ce check.
 *
 * Elle ne lit pas le ruleset APPLIQUÉ. Seul `gh` avec les droits d'administration peut le dire, et
 * ce n'est pas un test de CI. Ce qu'elle garantit, c'est que le fichier est la source et qu'il
 * décrit la CI — un règlement manuel dans l'interface reste possible et reste invisible.
 */

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { RACINE, reporter } from "./porte.mjs"

const { porte, cloture } = reporter()

const ruleset = JSON.parse(
  await readFile(join(RACINE, ".github", "rulesets", "master.json"), "utf8"),
)
const workflow = await readFile(join(RACINE, ".github", "workflows", "ci.yml"), "utf8")

// Une règle par type, parce que le ruleset est une liste et que le type est son seul index. Le
// `?? {}` fait qu'une règle retirée donne un `undefined` lu, donc une porte rouge qui nomme le
// manque, plutôt qu'une exception qui oblige à relire le fichier pour savoir lequel.
const regle = (type) => ruleset.rules.find((r) => r.type === type)?.parameters ?? {}

// Les jobs sont lus par une expression régulière, pas par un parseur YAML : le dépôt n'a aucune
// dépendance YAML et n'en veut pas — un parseur de plus à garder à jour pour lire quatre noms.
// Le motif est ancré sur la structure du fichier : deux espaces pour une clé de job, quatre pour
// son `name:`. C'est le `name:` que GitHub compare, pas la clé — `canari` s'annonce sous le nom
// « canari / derniere CLI publiee ».
const jobs = [...workflow.matchAll(/^ {2}[\w-]+:\n {4}name: (.+)$/gm)].map(([, nom]) => nom)
const checks = regle("required_status_checks").required_status_checks?.map(({ context }) => context)

// L'ordre n'est pas comparé : il n'a aucun sens pour GitHub, et `ci.yml` a déjà une porte qui le
// garde contre `site/contributeurs/ci.md`. Ce qui compte est l'ensemble, donc il est comparé trié.
const ensemble = (liste) => [...liste].sort().join(" | ")

porte(
  "les checks requis sont exactement les jobs de la CI",
  ensemble(checks ?? []) === ensemble(jobs),
  `ruleset : ${ensemble(checks ?? []) || "(aucun)"} — ci.yml : ${ensemble(jobs)}`,
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
// mensonge, donc il a sa propre porte.
//
// Le motif est ANCRÉ sur une clé de YAML, jamais une simple occurrence : le fichier parle de
// `continue-on-error` dans ses commentaires, qui disent pourquoi il est interdit. Chercher le
// mot le ferait tomber sur sa propre explication.
porte(
  "aucun job de la CI n'est marque continue-on-error",
  !/^\s*continue-on-error:\s*true\b/m.test(workflow),
  "un job ainsi marque ne peut pas etre un check requis : le ruleset afficherait un controle qui ne bloque rien",
)

cloture()
