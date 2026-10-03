# Pipeline CI

Quatre jobs, sur chaque pull request comme sur chaque push sur `master` — le tag de release n'y
change rien. **Les quatre bloquent** : ce sont les quatre checks requis du ruleset, et le troisième
— un canari sur la dernière CLI publiée — ne bloquait pas tant qu'il ne l'était pas, un job
`continue-on-error` ne pouvant pas être un check requis. Le quatrième construit le site, et son
échec met la pull request en rouge. Voir [`ci.yml`](https://github.com/WAROL52/signalcn/blob/master/.github/workflows/ci.yml).

Les commandes vivent dans `package.json`, pas dans le YAML. Le YAML appelle, il ne décide pas —
c'est la même règle que pour les drapeaux de couverture, et pour la même raison : une option
qui vit à un seul endroit ne peut pas être oubliée ailleurs.

## 1. Ce que chaque contrôle coûte

Mesuré sur ce dépôt, par la commande que la CI exécute (`npm run …`), médiane de cinq
exécutions. L'installation est un cas à part : deux exécutions, 107,6 s et 106,9 s.

| Contrôle | Coût |
|---|---|
| Liens publiés : chaque lien interne existe dans la sortie du site | 0,09 s |
| Zéro-dépendance : metafile et recherche sur l'artefact | 0,31 s |
| Documentation : surface déclarée contre surface réelle | 0,43 s |
| Harnais différentiel | 0,50 s |
| Propreté : le build du site n'écrit pas dans les chemins d'artefacts | 0,32 s |
| Ruleset : les checks requis contre les jobs réels | 0,32 s |
| Biome : forme et ruleset `recommended` | 0,70 s |
| Suite source | 0,77 s |
| Couverture : seuils, code mort, non-régression | 1,53 s |
| Typecheck | 2,15 s |
| Parité, quatre cibles | 2,53 s |
| Build + minify + réécriture | 3,17 s |
| Dérive : le build ne touche aucun artefact committé | 3,17 s |
| Documentation statique : build du site | 5,42 s |
| Portes du build : reproductibilité, `--keep-names`, tailles | 4,51 s |
| **Installation des six items** | **107 s** |

Tous les contrôles, hors installation, réunis coûtent **25,9 s**. L'installation en coûte **4,1 fois
plus**. C'est le seul coût réel de la CI, et c'est le seul qui mérite qu'on discute de sa
fréquence — ce qui a été fait, et la décision est : à chaque PR.

Le coût dominant n'est pas la commande, c'est le **démarrage de runner**. Quatre jobs
représentent quatre démarrages pour quinze contrôles qui coûtent ensemble 25,9 secondes.

## 2. Job « rapide » — par sévérité

L'ordre est **par sévérité, pas par coût**. Un job qui exécute tout de toute façon paie
rien de plus pour être dans le bon ordre, et c'est le premier message lu qui décide de ce qu'on
regarde ensuite. Le tableau est l'ordre de `.github/workflows/ci.yml`, et la porte de
documentation le vérifie : un contrôle ajouté, retiré ou déplacé dans le YAML doit l'être ici.

| # | Contrôle | Ce qu'il attrape |
|---|---|---|
| 1 | **Conformité** — `npm run harnais` | Le produit est faux. Le seul échec qui le dit. |
| 2 | **Couverture** — `npm run couverture` | Une couverture qui baisse, du code mort livré |
| 3 | **Typecheck** — `npm run typecheck` | Le code ne compile pas |
| 4 | **Suite source** — `npm run test` | Un comportement faux, dans la source même |
| 5 | **Biome** — `npm run biome` | Une forme qui dérive, un smell que `recommended` sait nommer |
| 6 | **Build** — `npm run build` | Un artefact que le projet utilisateur ne peut pas charger |
| 7 | **Zéro-dépendance** — `npm run zero-dependance` | Une dépendance glissée dans le cœur distribué |
| 8 | **Portes du build** — `npm run verifier-build` | Un build non reproductible, un `--keep-names` inopérant, un minifié plus gros que l'original |
| 9 | **Parité** — `npm run parite` | Le build ne reproduit pas la source ; la suite perd des tests en route |
| 10 | **Dérive** — `npm run verifier-derive` | Un artefact committé que le build ne produit plus |
| 11 | **Documentation** — `npm run documentation` | Un README qui ment sur la surface, ou qui demande un alias |
| 12 | **Ruleset** — `npm run verifier-ruleset` | Un job que la CI exécute sans l'exiger, ou un check exigé qu'elle n'exécute plus |

Les contrôles 8, 9 et 10 dépendent du 6 : le test minifié vise le runtime minifié, et le diff se
fait sur ce que le build vient d'écrire. Le contrôle 7 en dépend aussi : il mesure l'artefact
minifié, pas la source. L'ordre n'est donc pas seulement une question de signal, il est aussi un
ordre de dépendance — ce qui rend la réponse par sévérité gratuite.

Le contrôle 12 est le seul qui ne dépende de rien : il lit deux fichiers du dépôt, et il ne peut
donc pas être plus tôt qu'un build. Il est aussi le seul qui ne juge pas le changement proposé —
il juge la configuration du dépôt, donc la prochaine PR plutôt que celle-ci, et c'est pour cela
qu'il est le dernier : quand les onze autres ont parlé du produit, ce qu'il reste à dire est une
question de gouvernance.

Le contrôle 5 est le seul dont la sévérité ne soit pas graduelle : il ne juge pas le code, il
juge sa **forme**. C'est pourquoi il est après les trois qui jugent le code lui-même, et non
avant : une ligne mal indentée n'est pas plus grave qu'un comportement faux, et la placer plus
haut gaspillerait le premier message lu sur un échec que `tsc` ou la suite aurait déjà signalé
autrement.

Trois choses sur ce contrôle, toutes dans `biome.json`, et toutes à savoir avant d'y toucher.

**Le périmètre, en une seule exclusion.** `registry/default/*.js` est hors du champ : ce sont les
quatre artefacts que `tsc` et esbuild produisent, et les reformater serait perdu par construction —
le contrôle 10 les régénère puis compare, donc un fichier reformaté à la main ferait tomber ce
contrôle. C'est la seule exclusion du dépôt, et c'est un glob sur ce seul répertoire plutôt qu'une
liste de fichiers, pour qu'un artefact ajouté demain soit couvert sans réécrire la configuration.
La porte reste verte sur les deux sources `.ts` du même répertoire : **le moteur est formaté**, comme
le reste.

**Le preset, et lui seul.** `recommended`, pas `strict` ni `style`. Cinq lignes sont coupées, sur
quatre règles distinctes, chacune avec sa raison écrite sur la ligne même — jamais une règle
coupée en bloc. Les quatre protègent un fait que le code porte, pas une convenance de gout :

- `noUnsafeDeclarationMerging`, deux fois dans `signals.ts`, où `brand` vient d'un
  `defineProperty` sur le prototype. La règle le déplacerait dans le corps de classe, ce qui crée
  une propriété propre et fait passer `Object.keys` de huit clés à neuf — SPEC §5.1 et §5.3.
- `useArrowFunction`, une fois dans `signals.ts` : le correctif transforme le dispositeur en arrow,
  et SPEC §8.2 exige qu'il ne soit « ni une arrow ni l'instance ». **Aucune porte ne l'aurait vu** :
  les six propriétés que §8.2 fige tiennent aussi bien sur une arrow.
- `noSelfAssign`, dans `signals.test.ts`, où `auto.value = auto.value` est le scénario `signal#12`
  et non une maladresse.
- `noPrototypeBuiltins`, dans `signals.test.ts` : la cible est ES2020 et `Object.hasOwn` est ES2022,
  donc le correctif de la règle — que Biome classe *sûr* — fait tomber `tsc`.

Le hook de commit n'écrit que la **forme** : l'entrée `formater` enchaîne `biome format --write` et
le seul assist `organizeImports`. Il n'applique aucun correctif de règle, parce qu'un formateur qui
réécrit des tests en silence est un formateur à qui on ne fait plus confiance — et c'est exactement
ce que faisait `biome check --write` sur les neuf `function () {}` de la table. Mesuré comme le
tableau du §1 — par `npm run …`, médiane de cinq : 3,0 s, dont 2,3 s de `tsc`.

**Ni Markdown ni YAML.** Biome 2.5.15 ne connaît pas ces deux types de fichiers et les ignore
silencieusement : `biome check` sur un `.md` ou un `.yml` répond « no files were processed ». C'est
une limite de l'outil, pas de la configuration — aucun réglage ne les ajoute. Aucun fichier
Markdown ni YAML du dépôt n'est donc vérifié par ce contrôle, et rien dans la CI ne prétend le
contraire.

**Le contrôle 10 EST le diff** : `git diff --stat` sur `registry/default/`, après un build que la
porte relance elle-même. Un diff vide **est** le test, parce que le build est reproductible — et
c'est le contrôle 8 qui le vérifie, en rejouant le build et en comparant les condensats : deux
exécutions donnent des fichiers identiques, et une source modifiée sans régénération produit bien
un diff.

## 3. Job « distribution »

| Contrôle | Ce qu'il attrape |
|---|---|
| **Installation réelle** — les six items, puis les trois suites installées | Un item qui ne s'installe pas, un import qui ne résout pas |
| **Validation du schéma** du registry | Un `registry.json` mal formé |

Le coût est celui du §1 — 107 s — et il se paie à chaque PR. Une installation cassée qui passe
une PR produit une release cassée, et la corriger au moment du tag est le moment le plus cher.

La CLI shadcn est une **`devDependency` épinglée**, pas `shadcn@latest`. Le comportement du
registry peut changer d'une version à l'autre — et la recherche a établi que `4.10.0` est un
plancher fonctionnel — donc `shadcn@latest` en CI signifie que le dépôt peut devenir faux sans
qu'aucun commit n'ait changé. Gain secondaire mesuré : trente pour cent plus rapide.

## 4. Job « documentation-statique »

| Contrôle | Ce qu'il attrape |
|---|---|
| **Build du site** — `npm run documentation-statique` | Une page qui ne se rend pas, un lien mort entre pages, une configuration illisible |
| **Propreté** — `npm run verifier-proprete` | Le build du site qui écrit dans `registry/` ou à la racine |
| **Liens publiés** — `npm run verifier-liens-publies` | Un lien interne qui, dans la sortie du site, ne pointe vers aucun fichier |

Les trois coûts sont ceux du §1 — 5,42 s, 0,32 s et 0,09 s — et ils sont dominés par le build : la
porte de propreté ne lit qu'un `git status`, et la porte des liens publiés trente-huit fichiers
HTML.
À comparer aux 107 s de l'installation, qui est le seul coût qui mérite qu'on discute de sa
fréquence.

Sur le runner, une fois observé : le job entier a pris **17 s** — `npm ci` 8 s, build 3 s, porte 1 s,
le reste en installation et en teardown. C'est un relevé unique et pas une médiane ; le tableau du
§1 reste la source des coûts, mesurés en local par la convention qui y est écrite.

**Ce que le build attrape, et ce qu'il n'attrape pas.** Mesuré sur VitePress 1.6.4 : un lien mort
écrit dans une page fait échouer le build, et une entrée de navigation qui pointe vers une page
inexistante le laisse **vert**. La navigation est donc le seul endroit où une page morte passerait
inaperçue — d'où les trois entrées du squelette, qui ne listent que des pages qui existent.

**La porte des liens publiés lit l'espace que le build ne lit pas.** Depuis #65 les liens sont
**relatifs et sans extension** — `site/x` — parce que c'est la seule forme qui marche à la fois
dans le dépôt GitHub et dans le site : une absolue `/x.md` y est rendue `blob/master/x.md`, donc
404, et GitHub n'a pas de `.html`.

Cette forme, le build la vérifie : il résout la cible dans l'espace SOURCE, et un `site/x` vers un
fichier absent le fait tomber — mesuré par injection, dans les deux sens. Le ticket annonçait le
contraire ; il a été rectifié.

Ce que le build ne vérifie pas, en revanche, et que la porte couvre :

- **L'espace publié.** VitePress valide dans l'espace source et publie dans l'autre. Un lien vers un
  fichier que le site ne publie pas est donc vert au build et mort au navigateur : c'est le trou que
  #48 a nommé sans le fermer, et que le crawl avait trouvé une fois — vingt-quatre liens.
- **Les extensions d'asset.** VitePress saute tout lien dont la cible porte une extension qu'il
  connaît — `.yml`, `.mjs` — sans rien demander : mesuré, un `site/x.yml` vers un fichier absent
  laisse le build vert.
- **La navigation.** `themeConfig.nav` et `logoLink` ne sont pas des liens Markdown : ni la
  conversion ni le build ne les touchent. #65 les a réécrits à la main, et rien d'autre ne les
  gardait.

La porte lit donc la **sortie publiée** — `site/.vitepress/dist/`, jamais les sources — extrait
chaque `href` de chaque page, et vérifie que la cible existe **sur le disque**. Aucun appel réseau :
une existence de fichier, rien d'autre, parce qu'une porte qui dépend d'un tiers est une porte
qu'on désactive au premier incident réseau. Elle couvre tous les liens internes, pas seulement les
trente convertis, et elle a attrapé dès sa première exécution deux trous que le build ne pouvait pas
voir : trois liens vers `.github/`, que le site ne publie pas, et le lien du titre de la barre, qui
visait la racine du site — devenue vide avec la réécriture.

Ce qu'elle ne vérifie pas, elle le dit dans sa sortie, avec le préfixe `--` : les **ancres**, que le
build ne valide pas non plus — Mermaid, les plugins et la numérotation rendent l'extraction des `id`
trop fragile pour qu'une porte reste stable —, et les **URL externes**, qui n'ont pas de cible sur
le disque. Un lien interne est un fait du dépôt ; une ancre et une adresse extérieure n'en sont pas.

**La propreté est une porte, pas une précaution.** Elle existe parce que `verifier-derive` ne voit
pas ce que le build du site pourrait écrire : son `git diff` ne parle que de fichiers **suivis** et
que de `registry/default/`, donc un fichier neuf déposé dans ce répertoire passe, et n'importe quoi
écrit à la racine passe aussi. Elle vérifie l'état **après** le build et ne le relance pas — l'ordre
est fait par l'appelant, `porte` comme la CI — et son périmètre est `registry/` plus la racine, soit
tout ce qu'un build a le droit d'écrire hors de `site/`. Elle vérifie enfin que la sortie du site
est un fichier ignoré, en posant la question à `git check-ignore` et non en lisant `.gitignore` : le
fichier reste la seule source, et aucune liste n'est écrite deux fois.

**Le déploiement sur GitHub Pages n'est pas dans ce job.** Un check requis juge la pull request ;
un déploiement agit sur l'extérieur, et un déploiement réussi ne doit surtout pas pouvoir masquer
un build cassé : c'est le contraire de ce qu'est un contrôle. Il est dans
[`deploy.yml`](https://github.com/WAROL52/signalcn/blob/master/.github/workflows/deploy.yml), déclenché par le **tag** — voir le §5.

**Le `base` du site vaut `/signalcn/`, et il est gardé.** Une page de projet est servie sous le
chemin du dépôt, donc sans ce préfixe chaque URL sort en 404 — et le build **passe au vert**, pour
la raison que cette section a mesurée : seul un lien de fichier mort fait tomber VitePress.
`npm run documentation` compare donc le `base` de `site/.vitepress/config.mts` au nom du dépôt lu
dans le champ `homepage` de `registry.json`, qui est l'adresse GitHub du dépôt : `/` plus son
dernier segment, rien de plus. Une assertion, pas une liste — un dépôt ne se déplace pas, et une
liste d'exceptions s'écarterait à chaque renommage.

## 5. Au tag de release

Le job « rapide » ne change pas. La non-régression par rapport au merge-base s'applique au tag
comme en pull request, et le seuil mesuré ne se relâche pas non plus — rien à relâcher : il n'est
pas à 100 %, et ADR-0011 dit pourquoi.

Le job « distribution » s'exécute exactement comme sur une PR.

Le job « documentation-statique » s'exécute aussi : `ci.yml` se déclenche sur `master` **et** sur
`v*`, donc le tag construit le site comme une pull request. Un site se construit sur une branche
comme sur un tag, et rien ne fait attendre d'un tag un fichier que le build du jour ne produit pas
non plus.

**Le déploiement, lui, se déclenche sur le tag** — et c'est la seule chose que le tag déclenche en
plus. Le site doit être **exactement la version livrée** : c'est la politique de versionnement du
site (#51), « version courante seule », et la même règle que le `README.md` que npm rend au
consommateur. Publié à chaque push sur `master`, il désignerait autre chose que ce que le lecteur a
installé. Le filtre `tags: ["v*"]` de `ci.yml` est repris tel quel, mais sous un `push:` qui ne
porte **aucun** `branches:` : le filtre borne donc la publication aux tags. Un `workflow_dispatch`
s'y ajoute pour qu'un déploiement raté se rejoue sans attendre un tag. **Pas** de push de branche :
ce serait publier à chaque pull request mergée.

Le workflow **construit le site lui-même** — `npm ci`, puis `npm run documentation-statique` — et ne
récupère pas l'artefact d'un autre workflow : un artefact déposé par une CI peut avoir été construit
sur une tête de branche que le tag ne désigne pas. Les permissions sont explicites parce que le
défaut du dépôt est `read` : `contents: read`, `pages: write`, `id-token: write`, ce dernier étant ce
qui permet à l'action de publication d'obtenir son jeton. L'action est la paire documentée,
`upload-pages-artifact` puis `deploy-pages`, et le job est **unique** : un découpage en deux —
construire, puis publier — laisserait le job de construction lui aussi hors des checks requis.

Il n'y a **qu'un seul job qui n'est pas un check requis**, et c'est celui-là. `npm run
verifier-ruleset` lit tous les fichiers de `.github/workflows/` — pas `ci.yml` seul, sinon un
déplissement posé ailleurs serait invisible et son affirmation deviendrait fausse sans que personne
ne le voie — et vérifie que ce job est le seul hors du ruleset, qu'il n'en est pas un deuxième, et
qu'il ne porte pas de `continue-on-error`. Elle n'exige pas que le site soit publié : son absence
laisse la porte verte.

Le tableau du §1 ne gagne aucune ligne. Le workflow de publication n'exécute que `npm ci` et le
build du site, tous deux déjà mesurés : une ligne de plus compterait le même coût deux fois et
fausserait le total que la porte somme.

## 6. Le déclencheur de release

Rien de technique ne distingue une pull request de routine d'un cut de version. Un
mainteneur pousse un tag ; la CI doit être verte ; rien ne change sinon.

C'est volontaire. Une règle automatique qui décide de publier introduirait un état que personne
n'a demandé, et le coût d'une publication inutile dépasse celui d'une décision manuelle.

## 7. Le budget de maintenance

Chaque contrôle est une entrée `package.json`. Le YAML fait trois choses : installer, appeler
l'entrée, propager le code de sortie. Il ne contient aucun drapeau de couverture, aucun motif
d'inclusion, aucun chemin de fichier.

Une CI qu'on peut lire en trente secondes est une CI qu'on n'ose pas réécrire. Et quand un
contrôle change, il change à un seul endroit.

## 8. Le ruleset est du code

GitHub n'a pas de « rulesets as code ». Un ruleset réglé à la main dans l'interface est donc un fait
que rien ne vérifie — donc un fait qui peut mentir. La source est
[`.github/rulesets/master.json`](https://github.com/WAROL52/signalcn/blob/master/.github/rulesets/master.json), dans le dépôt, et elle
s'applique par l'API :

```bash
gh api --method POST repos/WAROL52/signalcn/rulesets --input .github/rulesets/master.json
```

Ni Terraform ni une application GitHub : les deux introduiraient une seconde source de vérité
(le plan à relire avant chaque changement, l'état à committer) pour quatre règles, et le `gh` est
déjà là. Modifier le fichier sans réappliquer la commande laisse le dépôt et GitHub en désaccord —
c'est le seul endroit où une telle désynchronisation est possible, et elle est visible dans l'onglet
Rules du dépôt.

**Trois règles, et trois seulement.**

- **Une pull request, sans approbation humaine.** `allowed_merge_methods: ["rebase"]` et
  `required_approving_review_count: 0`. Le rebase seul est une décision, pas une préférence :
  l'historique du dépôt est sa documentation, et un squash effacerait la trace du lot vert. Zéro
  approbation parce que le relecteur est l'agent lui-même et qu'une approbation qu'on s'approuve
  soi-même ne prouve rien — la preuve, c'est le contrôle qui a tourné.
- **Un historique linéaire.** Aucun commit de fusion ne peut être poussé sur `master`. C'est la
  moitié machine de « jamais en merge commit », l'autre moitié étant la méthode de fusion
  autorisée.
- **Les quatre checks requis**, la branche devant être à jour de `master` avant de fusionner
  (`strict_required_status_checks_policy`). Sans cette dernière clause, les contrôles ont pu tourner
  sur une tête de branche que la fusion rejouée ne reproduit pas : ce qui a été testé n'est plus ce
  qui atterrit.

**Ce qui n'est pas activé, et pourquoi.** Les signatures de commits : le dépôt n'en a aucune, et la
règle bloquerait toutes les fusions sans rien prouver d'autre. La taille de fichier et la file
d'attente de fusion : aucun des deux ne répond à une question posée ici. Le `non_fast_forward` et
la suppression de branche : redondants dès qu'une PR est obligatoire, et la branche par défaut ne
se supprime pas de toute façon.

**La porte de dérive, et ce qu'elle ne voit pas.** Le contrôle 12 compare le ruleset aux jobs de
`ci.yml` dans les deux sens, refuse un job `continue-on-error` — GitHub le tiendrait pour non
bloquant, et l'égalité des deux listes dirait alors « conforme » à un ruleset qui ne protège rien —
et vérifie que le fichier dit bien rebase, PR obligatoire, actif, sans bypass. Ce qu'elle ne peut
pas voir, c'est le ruleset **appliqué** : seul `gh` avec les droits d'administration peut le lire,
et ce n'est pas un test de CI. Un règlement manuel dans l'interface reste donc possible, et reste
invisible jusqu'à la prochaine relecture du fichier.
<!-- sonde ephemere -->
