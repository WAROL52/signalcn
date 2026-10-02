# Pipeline CI

Quatre jobs, sur chaque pull request comme sur chaque push sur `master` — le tag de release n'y
change rien. Le troisième ne bloque rien : c'est un canari sur la dernière CLI publiée, et il
répond à une seule question. Le quatrième construit le site, et c'est un contrôle : son échec met
la pull request en rouge. Voir [`ci.yml`](../.github/workflows/ci.yml).

Les commandes vivent dans `package.json`, pas dans le YAML. Le YAML appelle, il ne décide pas —
c'est la même règle que pour les drapeaux de couverture, et pour la même raison : une option
qui vit à un seul endroit ne peut pas être oubliée ailleurs.

## 1. Ce que chaque contrôle coûte

Mesuré sur ce dépôt, par la commande que la CI exécute (`npm run …`), médiane de cinq
exécutions. L'installation est un cas à part : deux exécutions, 107,6 s et 106,9 s.

| Contrôle | Coût |
|---|---|
| Zéro-dépendance : metafile et recherche sur l'artefact | 0,31 s |
| Documentation : surface déclarée contre surface réelle | 0,43 s |
| Harnais différentiel | 0,50 s |
| Propreté : le build du site n'écrit pas dans les chemins d'artefacts | 0,32 s |
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

Tous les contrôles, hors installation, réunis coûtent **25,5 s**. L'installation en coûte **4,2 fois
plus**. C'est le seul coût réel de la CI, et c'est le seul qui mérite qu'on discute de sa
fréquence — ce qui a été fait, et la décision est : à chaque PR.

Le coût dominant n'est pas la commande, c'est le **démarrage de runner**. Quatre jobs
représentent quatre démarrages pour treize contrôles qui coûtent ensemble 25,5 secondes.

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

Les contrôles 8, 9 et 10 dépendent du 6 : le test minifié vise le runtime minifié, et le diff se
fait sur ce que le build vient d'écrire. Le contrôle 7 en dépend aussi : il mesure l'artefact
minifié, pas la source. L'ordre n'est donc pas seulement une question de signal, il est aussi un
ordre de dépendance — ce qui rend la réponse par sévérité gratuite.

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

Les deux coûts sont ceux du §1 — 5,42 s et 0,32 s — et ils sont dominés par le build : la porte de
propreté ne lit qu'un `git status`. À comparer aux 107 s de l'installation, qui est le seul coût qui
mérite qu'on discute de sa fréquence.

**Ce que le build attrape, et ce qu'il n'attrape pas.** Mesuré sur VitePress 1.6.4 : un lien mort
écrit dans une page fait échouer le build, et une entrée de navigation qui pointe vers une page
inexistante le laisse **vert**. La navigation est donc le seul endroit où une page morte passerait
inaperçue — d'où les trois entrées du squelette, qui ne listent que des pages qui existent.

**La propreté est une porte, pas une précaution.** Elle existe parce que `verifier-derive` ne voit
pas ce que le build du site pourrait écrire : son `git diff` ne parle que de fichiers **suivis** et
que de `registry/default/`, donc un fichier neuf déposé dans ce répertoire passe, et n'importe quoi
écrit à la racine passe aussi. Elle vérifie l'état **après** le build et ne le relance pas — l'ordre
est fait par l'appelant, `porte` comme la CI — et son périmètre est `registry/` plus la racine, soit
tout ce qu'un build a le droit d'écrire hors de `site/`. Elle vérifie enfin que la sortie du site
est un fichier ignoré, en posant la question à `git check-ignore` et non en lisant `.gitignore` : le
fichier reste la seule source, et aucune liste n'est écrite deux fois.

**Le déploiement sur GitHub Pages n'est pas dans ce job.** Un job qui déploie ne peut pas être un
check requis — GitHub le tient pour non bloquant, exactement comme le canari — et surtout un
déploiement réussi ne doit pas pouvoir masquer un build cassé : c'est le contraire de ce qu'est un
contrôle. Il ira dans un workflow distinct, déclenché par le push sur `master`. Ce qui reste à y
trancher : le `base` du site, qui vaut `/signalcn/` pour une page de projet et n'est écrit nulle
part tant que le déploiement n'existe pas, et la politique de versionnement du site (#51).

## 5. Au tag de release

Le job « rapide » ne change pas. La non-régression par rapport au merge-base s'applique au tag
comme en pull request, et le seuil mesuré ne se relâche pas non plus — rien à relâcher : il n'est
pas à 100 %, et ADR-0011 dit pourquoi.

Le job « distribution » s'exécute exactement comme sur une PR.

Le job « documentation-statique » ne s'exécute pas au tag : ses déclencheurs sont la pull request et
le push sur `master`. Un site se construit sur une branche comme sur `master`, et rien ne fait
attendre d'un tag un fichier que le build du jour ne produit pas non plus.

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
<!-- sonde ephemere -->
