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
 *   5. LE PIPELINE EST CELUI QU'IL DÉCRIT. `site/contributeurs/ci.md` est la référence des coûts, et ses
 *      chiffres se périment sans bruit : rien n'exécute un coût, et une ligne fausse dans son
 *      tableau ne fait tomber aucune porte. Le tableau doit donc sommer — le total annoncé est
 *      la somme de ses lignes, le multiple annoncé est celui de la ligne d'installation sur ce
 *      total — et l'ordre de ses contrôles doit être l'ordre des étapes du YAML, parce qu'un
 *      document qui décrit une CI différente de celle qui tourne est un mensonge de plus.
 *
 *   6. LA CONVENTION DE NOMMAGE EST APPLIQUÉE, pas seulement écrite. La règle et sa liste
 *      d'exception vivent dans `CONTRIBUTING.md` ; cette porte les lit et refuse un descripteur
 *      anglais qui ne l'est pas. Le lexique des mots anglais est une liste de mots ACCEPTÉS, jamais
 *      de mots français à refuser : une liste de refus refuse `parent` dès son premier passage, donc
 *      on la désactive. Le §7 dit pourquoi l'analyse lexicale ne peut pas reconnaître un mot
 *      français, et ce qui la remplace.
 *
 *   8. LE `base` DU SITE EST CELUI DU DÉPÔT. Le site est publié sur `warol52.github.io/<dépôt>` ;
 *      un `base` faux met chaque page en 404 sans faire tomber le build, donc cette assertion est
 *      la seule chose qui s'en aperçoive avant le premier visiteur. Le §8 dit d'où vient le nom.
 *
 *   9. LA LECTURE D'UN `git status` EST EXERCÉE. Le lecteur vit dans `porte.mjs` avec `RACINE` et
 *      `reporter()`, donc cette porte peut lui passer une sortie et exiger le résultat. Trois
 *      assertions : un renommage, seul cas où `-z` produit deux enregistrements, un changement de
 *      type, seule lettre d'état qu'un lecteur oublie, et la différence des deux lectures que la
 *      porte de propreté compare. Le §9 et le §10 disent pourquoi ces cas-là.
 *
 *   node scripts/verifier-documentation.mjs
 */

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { cheminsGit, ecritsParBuild, RACINE, reporter } from "./porte.mjs"

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
const blocExigences = texte.slice(
  texte.indexOf("## Deux exigences"),
  texte.indexOf("## API principale"),
)
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
const { COUVERTURE, MARQUEUR, morceaux } = COUVERTURE_MODULE
const spec = await readFile(join(RACINE, "SPEC.md"), "utf8")

// La forme d'un marqueur est celle du fichier de test — `MARQUEUR` — et non un motif écrit ici.
// Un motif écrit deux fois dérive, et ceux-ci divergeaient déjà : celui de la suite testait la
// destination entière, celui-ci la cherchait n'importe où dedans. Un seul mot, une seule définition.
const marquees = Object.entries(COUVERTURE)
  .filter(([, destination]) => morceaux(destination).some((morceau) => MARQUEUR.test(morceau)))
  .map(([id]) => id)

// La section §21, et les identifiants d'entrée que ses lignes de tableau portent.
const section = spec.slice(spec.indexOf("\n## 21. "), spec.indexOf("\n## 22. "))
const consignees = new Set(
  [
    ...section.matchAll(
      /`(?:signal|computed|effect|subscribe|action|dispose|modele|conv)#\d+[a-z]?`/g,
    ),
  ].map((m) => m[0].replaceAll("`", "")),
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
// Le compte reste en dur, et c'est délibéré : c'est le SEUL contrôle de ce fichier qui ne se
// déduit pas, et il ne peut pas se déduire. Les deux portes au-dessus comparent deux listes ; celle
//-ci compare la longueur d'une liste à une constante. Elle existe parce que les deux autres
// passent sur un §21 vidé : si la réécriture avait supprimé le registre, chaque entrée marquée
// aurait gardé sa ligne et chaque ligne aurait gardé son entrée — dans le vide. Une constante en
// dur est ici un garde-fou, pas une faiblesse : la changer, c'est dire à voix haute que le nombre
// d'entrées non confrontables vient de bouger.
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

porte(
  "le README porte une section « Différences connues »",
  /^## Différences connues$/m.test(texte),
)

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

const { ENTREES_ATTENDUES, scenarios, testsSignalcnSeul } = COUVERTURE_MODULE
const attendus = { entrees: ENTREES_ATTENDUES.length, scenarios: scenarios.length }

// Chaque ancre est [fichier, motif, une valeur attendue par groupe capturé, libellé].
//
// Deux chiffres dans la même phrase sont DEUX contrôles, pas un : le motif du ROADMAP capture le
// nombre de scénarios ET celui des comportements, et comparer le premier seulement laissait le
// second libre de mentir — « 999 comportements » passait. Le libellé est écrit, jamais déduit du
// fichier et de l'unité : deux ancres du même document en portaient sinon le même, et un échec ne
// disait pas laquelle des deux était tombée.
const ancrees = [
  [
    "SPEC.md",
    /> \*\*Annexe :\*\*.*?— (\d+) comportements/,
    [attendus.entrees],
    "SPEC.md annonce le bon nombre de comportements",
  ],
  [
    "research/baseline-1.14.4.md",
    /^\*\*(\d+) comportements\*\* documentés/m,
    [attendus.entrees],
    "research/baseline-1.14.4.md annonce le bon nombre de comportements",
  ],
  [
    "research/baseline-1.14.4.md",
    /^\| \*\*Total\*\* \| \*\*(\d+)\*\* \|/m,
    [attendus.entrees],
    "le tableau recapitulatif de la baseline annonce le bon total",
  ],
  [
    "site/contributeurs/scenarios.md",
    /Comment les \*\*(\d+) comportements\*\*/,
    [attendus.entrees],
    "site/contributeurs/scenarios.md annonce le bon nombre de comportements",
  ],
  [
    "site/contributeurs/scenarios.md",
    /pour (\d+) comportements\./,
    [attendus.entrees],
    "site/contributeurs/scenarios.md annonce le bon nombre de comportements, dans la repartition",
  ],
  [
    "site/contributeurs/ROADMAP.md",
    /comportements upstream — (\d+) entrées,/,
    [attendus.entrees],
    "ROADMAP.md annonce le bon nombre de entrées",
  ],
  [
    "site/contributeurs/ROADMAP.md",
    /scenarios\.md\) : (\d+) sc[ée]narios pour\n(\d+) comportements/,
    [attendus.scenarios, attendus.entrees],
    "ROADMAP.md annonce le bon nombre de scenarios ET de comportements",
  ],
]

for (const [fichier, motif, attendusAncre, libelle] of ancrees) {
  const texteFichier = await readFile(join(RACINE, fichier), "utf8")
  const trouve = texteFichier.match(motif)
  const cites = trouve ? trouve.slice(1, 1 + attendusAncre.length).map(Number) : null
  porte(
    libelle,
    cites !== null && cites.every((cite, i) => cite === attendusAncre[i]),
    cites === null
      ? "l'ancre est introuvable — la phrase a ete reecrite ?"
      : `${cites.join(" / ")} annonces, ${attendusAncre.join(" / ")} reels`,
  )
}

// ---- 6. Le pipeline décrit par `site/contributeurs/ci.md`, et celui qui tourne ----------------------------
//
// Trois faits, tous dans le même fichier, tous impossibles à voir à l'œil : un coût mesuré ne
// s'exécute nulle part, et une étape déplacée dans le YAML ne dit rien au document qui l'explique.
// Le YAML fait foi pour l'ORDRE — c'est lui qui tourne — et le tableau fait foi pour les DURÉES,
// parce que c'est lui qui les porte. La porte ne mesure rien : elle vérifie que le document
// répond à lui-même, et qu'il décrit le YAML.

const ci = await readFile(join(RACINE, "site", "contributeurs", "ci.md"), "utf8")

// L'ordre du YAML, dans le job « rapide ». `npm ci` ne porte pas de `npm run` et n'est donc pas
// capté : ce sont les contrôles, pas l'installation des dépendances.
const yaml = await readFile(join(RACINE, ".github", "workflows", "ci.yml"), "utf8")
const jobRapide = yaml.slice(yaml.indexOf("\n  rapide:"), yaml.indexOf("\n  distribution:"))
const etapes = [...jobRapide.matchAll(/run: npm run ([\w-]+)/g)].map((m) => m[1])

// Le §2 annonce les mêmes contrôles, dans le même ordre, nommés par leur entrée `package.json`.
const sectionOrdre = ci.slice(ci.indexOf("\n## 2. "), ci.indexOf("\n## 3. "))
const annonces = [...sectionOrdre.matchAll(/`(npm run [\w-]+)`/g)].map((m) => m[1].slice(8))

porte(
  "site/contributeurs/ci.md annonce les controles du job rapide, dans l'ordre du YAML",
  annonces.length === etapes.length && annonces.every((c, i) => c === etapes[i]),
  `${annonces.length} annonces (${annonces.join(", ")}), ${etapes.length} etapes (${etapes.join(", ")})`,
)

// Le tableau des coûts doit sommer. La virgule est une virgule : le document écrit `18,8`, pas
// `18.8`, et une mesure qui l'ignorerait lirait `18` — un total faux, qui passerait. La partie
// décimale est facultative parce que la ligne la plus longue du tableau, 107 s, n'en a pas.
const dix = "(\\d+)(?:,(\\d+))?"
const sectionCouts = ci.slice(ci.indexOf("\n## 1. "), ci.indexOf("\n## 2. "))
const couts = [
  ...sectionCouts.matchAll(new RegExp(`^\\| (.+?) \\| \\*{0,2}${dix} s\\*{0,2} \\|`, "gm")),
].map((m) => ({ label: m[1], secondes: Number(m[2]) + Number(m[3] ?? 0) / 100 }))
const installation = couts.find(({ label }) => label.includes("Installation"))
const rapides = couts.filter(({ label }) => !label.includes("Installation"))
const somme = rapides.reduce((total, { secondes }) => total + secondes, 0)

// L'arrondi à une décimale est toléré, et doit l'être : la somme de neuf médianes n'est pas un
// nombre qu'on écrit — 18,76 s s'écrit « 18,8 s ». Cinq centièmes laissent passer cet arrondi et
// tombent dès qu'une ligne est périmée, car le plus petit écart possible entre deux médianes de
// cette liste est de dixièmes de seconde. Le test est `presque(annoncé − mesuré)`, jamais
// l'inverse : arrondir la différence ferait passer n'importe quoi, y compris treize secondes.
const presque = (ecart) => Math.abs(ecart) <= 0.05
const annonceTotal = ci.match(/réunis coûtent \*\*([\d,]+) s\*\*/)
const annonceRatio = ci.match(/\*\*([\d,]+) fois\s+plus\*\*/)

porte(
  "le total du tableau des couts est la somme de ses lignes",
  annonceTotal !== null &&
    rapides.length > 0 &&
    presque(Number(annonceTotal[1].replace(",", ".")) - somme),
  annonceTotal === null
    ? "l'ancre du total est introuvable"
    : `${annonceTotal[1].replace(".", ",")} annonces, ${somme.toFixed(2).replace(".", ",")} mesures`,
)
porte(
  "le multiple de l'installation est celui du tableau",
  annonceRatio !== null &&
    installation !== undefined &&
    presque(Number(annonceRatio[1].replace(",", ".")) - installation.secondes / somme),
  annonceRatio === null || installation === undefined
    ? "l'ancre du multiple est introuvable"
    : `${annonceRatio[1].replace(".", ",")} annonces, ` +
        `${(installation.secondes / somme).toFixed(2).replace(".", ",")} mesures`,
)

// ---- 7. La convention de nommage, et le lexique anglais qu'elle applique --------------------------
//
// Une convention que rien n'applique se perd au premier commit d'un jour de fatigue. Celle-ci est
// dans `CONTRIBUTING.md`, et cette porte la fait appliquer — elle lit le fichier, elle ne recopie
// ni la règle ni la liste.
//
// Le signal n'est pas « ce mot a une allure française » : il n'existe pas. `ordre`, `structure`,
// `effet`, `interne` et `nom` sont des mots français dont l'équivalent anglais est un AUTRE mot, et
// aucun voisinage de lettres ne les distingue de `order`, `structure`, `effect`, `internal` ou
// `name`. Le refus porte donc sur ce qu'on peut mesurer : « ce mot n'existe nulle part en anglais
// dans ce dépôt ». Un mot français ne peut pas l'éviter, et un mot anglais neuf le déclare — une
// ligne dans le lexique, qui est la seule liste que cette porte possède.
//
// Le périmètre est celui du ticket : les 97 descripteurs que la suite enregistre (82 scénarios et
// 15 tests `signalcn-seul`), et les cinq identifiants que #46 a renommés dans le cœur. Les
// commentaires ne sont pas lus, et c'est voulu : ils sont en français. Le contrôle ne couvre pas
// les AUTRES identifiants du cœur — `tete`, `noeud`, `effet` sont encore français — parce que les
// angliciser n'est pas le travail de ce ticket. La sortie le dit, en bas de ce §7 : une exclusion
// que rien n'affiche est une exclusion que le lecteur ne peut pas voir.

const contribution = await readFile(join(RACINE, "CONTRIBUTING.md"), "utf8")

// Un SEUL motif, ancré sur les deux titres : la section se lit entre son titre et le titre suivant.
// Les portes voisines découpent par `indexOf` sur une phrase du texte, ce qui tient jusqu'au jour
// où la phrase est réécrite ; ici il faut deux titres, et le second est une frontière de structure.
const nommage = contribution.match(/^## Le nommage des descripteurs$\n([\s\S]*?)^## /m)
porte(
  "CONTRIBUTING.md porte une section de nommage, et elle se lit",
  nommage !== null,
  "le titre « ## Le nommage des descripteurs » est absent, ou suivi d'aucun autre titre",
)

// Une ligne, un mot : la liste d'exception est la seule structure que la porte y lit, et elle se
// lit par ligne entière. Un mot français listé à côté d'autre chose n'est pas dans la liste.
const exceptions = [...(nommage?.[1].matchAll(/^- `([a-z-]+)`$/gm) ?? [])].map((m) => m[1])
const annonce = nommage?.[1].match(/\*\*(\d+)\*\* mots/)
porte(
  "la liste d'exception compte autant de mots que la section en annonce",
  exceptions.length > 0 && annonce !== null && Number(annonce[1]) === exceptions.length,
  annonce === null
    ? "l'ancre du compte est introuvable"
    : `${exceptions.length} lus, ${annonce[1]} annonces`,
)

const LEXIQUE = "scripts/vocabulaire-identifiants.txt"
const lexique = new Set(
  (await readFile(join(RACINE, LEXIQUE), "utf8"))
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== "" && !ligne.startsWith("#")),
)
// Un lexique vide ferait passer le contrôle sans rien vérifier : c'est le seul mode de défaillance
// d'un contrôle par liste — le même que la liste de motifs de `zero-dependance`.
porte("le lexique anglais se lit", lexique.size > 0, `${LEXIQUE} ne porte aucun mot`)

const autorise = (mot) => lexique.has(mot) || exceptions.includes(mot)

// Les descripteurs viennent du MÊME objet que `COUVERTURE`, plus haut : pas de seconde liste, et
// un nom qui n'est plus enregistré ne peut pas être vérifié.
const descripteurs = [...scenarios.map(({ name }) => name), ...Object.keys(testsSignalcnSeul)]
const horsLexique = descripteurs
  .map((nom) => [
    nom,
    nom
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((mot) => mot !== "")
      .filter((mot) => !autorise(mot)),
  ])
  .filter(([, mots]) => mots.length > 0)
  .map(([nom, mots]) => `${nom} : ${mots.join(", ")}`)
porte(
  "aucun descripteur ne porte un mot absent du lexique anglais",
  horsLexique.length === 0,
  horsLexique.join(", "),
)

// Les cinq identifiants que #46 a renommés dans le cœur, et les vingt et une occurrences qu'ils
// comptent. C'est le SEUL filet sur le cœur, et il est fait de leur présence : un identifiant
// renommé — en français ou autrement — ne se compte plus, et le détail nomme lequel manque. Un
// contrôle de leur orthographe ne dirait rien de plus : leurs mots sont déjà ceux du lexique, donc
// il serait vert quoi qu'il arrive.
//
// Le compte est pris sur le fichier entier, commentaires compris. Les commentaires sont français —
// y écrire le nom ferait bouger le compte, et c'est le détail de l'échec qui le montre.
const RENOMMES = [
  "previousObserver",
  "previousCapture",
  "previousNode",
  "nextEffect",
  "previousCapturedEffects",
]
const coeur = await readFile(join(RACINE, "registry", "default", "signals.ts"), "utf8")
const comptes = Object.fromEntries(
  RENOMMES.map((nom) => [nom, (coeur.match(new RegExp(`\\b${nom}\\b`, "g")) ?? []).length]),
)
porte(
  "les cinq identifiants renommes par #46 tiennent leurs 21 occurrences",
  Object.values(comptes).reduce((total, compte) => total + compte, 0) === 21,
  Object.entries(comptes)
    .map(([nom, compte]) => `${nom} ${compte}`)
    .join(", "),
)

// ---- 8. Le `base` du site, et le nom du dépôt -----------------------------------------------
//
// Le site est publié sur `warol52.github.io/<dépôt>`. Sans `base`, chaque URL sort en 404 — et le
// build passe AU VERT : mesuré sur VitePress 1.6.4, un `base` faux ne fait tomber que le lien de
// FICHIER mort, jamais une entrée de navigation vers une page inexistante. C'est le trou le plus
// cher du dépôt parce qu'il ne se voit qu'au premier navigateur : tant que le site n'a jamais été
// servi, rien ne le demande.
//
// Le nom du dépôt est lu dans `registry.json`, au champ `homepage` : c'est l'adresse du dépôt
// GitHub, dont le DERNIER segment est le nom. C'est la source la plus fiable du dépôt parce que
// `registry.json` déclare le schéma shadcn — donc `verifier-installation` en vérifie la forme — et
// que le champ y est unique. Les `registryDependencies` portent la même adresse en
// `owner/repo/item`, mais le dépôt y est le segment du MILIEU, et seulement sur les items qui ont
// une dépendance : il faudrait choisir un item, donc une seconde décision à justifier. Et
// `package.json#name` est le nom du PAQUET npm, qui n'a pas de propriétaire et dont le renommage
// ne doit pas déplacer le site.

const config = await readFile(join(RACINE, "site", ".vitepress", "config.mts"), "utf8")
const { homepage } = JSON.parse(await readFile(join(RACINE, "registry.json"), "utf8"))
const depot = new URL(homepage).pathname.split("/").filter(Boolean).pop()
const base = config.match(/^\s*base:\s*"([^"]*)"/m)?.[1]

porte(
  "le base du site est le chemin du depot sur Pages",
  base === `/${depot}/`,
  `base ${base ?? "(absent)"}, dépôt ${depot} donc /${depot}/`,
)

// ---- 9. La lecture d'un `git status`, qu'aucune porte n'exerce ------------------------------
//
// Le lecteur est dans `porte.mjs` avec `RACINE` et `reporter()` : c'est de l'outillage partagé, et
// c'est ce qui le rend testable. Le test tient dans une seule assertion, et une seule : un
// renommage est le SEUL cas où `-z` produit deux enregistrements, donc le seul qui ait jamais
// cassé la lecture — `git status -z` nomme le nouveau chemin puis l'ancien, sur deux
// enregistrements NUL, et l'ancien n'a pas de préfixe d'état.
//
// C'est le filet qui manquait, et il manque pour une raison mesurable : la porte de propreté
// tourne dans `porte` comme dans la CI, mais la CI travaille sur un arbre propre, où elle ne lit
// aucun nom de fichier, et le seul cas à deux enregistrements suppose un renommage — qu'aucun
// script du dépôt ne fait. Une régression de ce lecteur n'avait donc aucune exécution pour la
// montrer. Voir [#79](https://github.com/WAROL52/signalcn/issues/79).
const renomme = cheminsGit("R  docs/nouveau.md\0ancien.md\0")
porte(
  "la lecture d'un git status ignore l'ancien chemin d'un renommage",
  renomme.length === 1 && renomme[0] === "docs/nouveau.md",
  `${renomme.length} chemins : ${renomme.join(", ")}`,
)

// La seconde assertion ne porte pas sur un deuxième cas à deux enregistrements — il n'y en a
// qu'un — mais sur la LISTE des lettres d'état, qui est une liste donc peut être incomplète. La
// première version en oubliait une : `T`, le changement de type. Un ` T fichier` — un fichier
// régulier remplacé par un lien — passait alors **sans bruit**, ce qui est pire que l'amputation
// d'un chemin, qui criait.
const typeChange = cheminsGit(" T fichier\0")
porte(
  "la lecture d'un git status garde un changement de type",
  typeChange.length === 1 && typeChange[0] === "fichier",
  `${typeChange.length} chemins : ${typeChange.join(", ")}`,
)

// ---- 10. Ce que le build a écrit, et lui seul ------------------------------------------------
//
// La porte de propreté ne lit plus UN `git status` : elle en lit deux — l'instantané que
// `documentation-statique` écrit avant de construire, et l'état courant. Ce qui compte est donc la
// différence, et son SENS n'est pas symétrique : `apres \ avant` accuse le build, `avant \ apres`
// ne l'accuserait jamais et la porte resterait verte sur n'importe quoi.
//
// Les trois cas tiennent dans une assertion parce qu'ils tiennent dans une différence : ce qui est
// devenu sale, ce qui l'était déjà — le plafond que la porte annonce par sa ligne `--` —, et ce qui
// est sous `site/`, qui est le droit du build. Aucun n'est atteignable en CI, qui travaille sur un
// arbre propre : c'est ce qui les rend nécessaires ici plutôt que dans une porte qui les rejouerait
// sur un dépôt jetable à chaque exécution.
const ecrits = ecritsParBuild(
  ["README.md", "docs/avant.md"],
  ["README.md", "docs/avant.md", "docs/neuf.md", "site/.vitepress/dist/index.html"],
)
porte(
  "le build n'ecrit que ce qui est devenu sale, et rien sous site/",
  ecrits.length === 1 && ecrits[0] === "docs/neuf.md",
  `${ecrits.length} chemins : ${ecrits.join(", ")}`,
)

// ---- La porte dit ce qu'elle ne vérifie pas -----------------------------------------------
//
// Une porte verte sur un tiers de son périmètre ment par omission, et c'est le défaut que
// [#68] décrit pour une autre porte. Le dépôt a déjà l'état qui dit « ni passé ni échoué » : `--`,
// dans `porte-couverture`. Cette ligne est donc écrite avec ce préfixe et avec rien d'autre — ni
// `ok`, ni `ECHEC` — donc elle ne compte ni comme un succès ni comme un échec.
//
// ELLE NE PORTE AUCUN NOMBRE, et c'est délibéré. Compter les mots du cœur que le lexique refuse
// compterait d'abord le vocabulaire de TypeScript : sur vingt et un mots du langage, dix-sept sont
// absents du lexique, donc `const`, `void`, `any` et les paramètres de type passeraient pour des
// mots français. Les exclure demanderait une liste — les mots réservés, les abréviations — donc une
// seconde liste à maintenir pour un chiffre faux. La zone, elle, ne périme pas : elle reste vraie
// tant que la porte compte cinq identifiants, quoi qu'il advienne du cœur.
console.log("  --   les identifiants du cœur autres que les cinq de #46 ne sont pas vérifiés")

cloture()
