# Pipeline CI

Deux jobs, sur chaque pull request. Le troisième n'existe qu'au tag de release, et il ne
change rien sauf un seuil.

Les commandes vivent dans `package.json`, pas dans le YAML. Le YAML appelle, il ne décide pas —
c'est la même règle que pour les drapeaux de couverture, et pour la même raison : une option
qui vit à un seul endroit ne peut pas être oubliée ailleurs.

## 1. Ce que chaque contrôle coûte

Mesuré, à froid, sans cache.

| Contrôle | Coût |
|---|---|
| Harnais différentiel | 0,06 s |
| Suite source | 0,06 s |
| Typecheck | 0,24 s |
| Zéro-dépendance, reproductibilité, tailles | 0,30 s |
| Build + minify + réécriture | 0,28 s |
| Couverture : seuils, code mort, non-régression | 1,58 s |
| **Parité, quatre cibles** | **2,47 s** |
| **Installation des six items** | **97 s** |

Tous les contrôles rapides réunis coûtent **5,1 s**. L'installation en coûte **dix-neuf fois
plus**. C'est le seul coût réel de la CI, et c'est le seul qui mérite qu'on discute de sa
fréquence — ce qui a été fait, et la décision est : à chaque PR.

Le coût dominant n'est pas la commande, c'est le **démarrage de runner**. Trois jobs
représentent trois démarrages pour neuf contrôles qui coûtent ensemble 5,1 secondes.

## 2. Job « rapide » — par sévérité

L'ordre est **par sévérité, pas par coût**. Un job de dix secondes exécute tout de toute
façon : l'ordre ne coûte rien et décide seulement du premier message lu.

| # | Contrôle | Ce qu'il attrape |
|---|---|---|
| 1 | **Conformité** — le harnais différentiel contre la baseline | Le produit est faux. Le seul échec qui le dit. |
| 2 | **Couverture** — suite, seuils, garde du code mort, base recalculée | Une couverture qui baisse, du code mort livré |
| 3 | **Build** — `tsc`, `esbuild`, réécriture, **puis diff vide** | Un artefact committé périmé |
| 4 | **Parité** — quatre cibles, comptage, noms, surface, renommage | Le build ne reproduit pas la source ; la suite perd des tests en route |
| 5 | **Zéro-dépendance** — metafile, grep sur le minifié | Une dépendance ou une construction interdite |
| 6 | **Typecheck** | Le code ne compile pas |

Le contrôle 4 dépend du 3 : le test minifié vise le runtime minifié. Le contrôle 5 aussi, pour
la même raison. L'ordre n'est donc pas seulement une question de signal, il est aussi un ordre
de dépendance — ce qui rend la réponse par sévérité gratuite.

**Le build précède les contrôles 4 et 5, et sa sortie est vérifiée immédiatement** : après le
build, `git diff --quiet` sur `registry/default/`. Un diff vide **est** le test, parce que le
build est reproductible — vérifié : deux exécutions donnent des condensats identiques, et une
source modifiée sans régénération produit bien un diff.

## 3. Job « distribution »

| Contrôle | Ce qu'il attrape |
|---|---|
| **Installation réelle** — les six items, puis les trois suites installées | Un item qui ne s'installe pas, un import qui ne résout pas |
| **Validation du schéma** du registry | Un `registry.json` mal formé |

Vingt-cinq secondes, à chaque PR. Une installation cassée qui passe une PR produit une release
cassée, et la corriger au moment du tag est le moment le plus cher.

La CLI shadcn est une **`devDependency` épinglée**, pas `shadcn@latest`. Le comportement du
registry peut changer d'une version à l'autre — et la recherche a établi que `4.10.0` est un
plancher fonctionnel — donc `shadcn@latest` en CI signifie que le dépôt peut devenir faux sans
qu'aucun commit n'ait changé. Gain secondaire mesuré : trente pour cent plus rapide.

## 4. Au tag de release

Le job « rapide » ne change pas, **sauf son seuil de couverture** : la non-régression par
rapport au merge-base devient du **100 % absolu** sur les trois métriques.

Rien d'autre ne change. Le job « distribution » s'exécute exactement comme sur une PR.

## 5. Le déclencheur de release

Rien de technique ne distingue une pull request de routine d'un cut de version. Un
mainteneur pousse un tag ; la CI doit être verte ; le seuil passe à cent pour cent.

C'est volontaire. Une règle automatique qui décide de publier introduirait un état que personne
n'a demandé, et le coût d'une publication inutile dépasse celui d'une décision manuelle.

## 6. Le budget de maintenance

Chaque contrôle est une entrée `package.json`. Le YAML fait trois choses : installer, appeler
l'entrée, propager le code de sortie. Il ne contient aucun drapeau de couverture, aucun motif
d'inclusion, aucun chemin de fichier.

Une CI qu'on peut lire en trente secondes est une CI qu'on n'ose pas réécrire. Et quand un
contrôle change, il change à un seul endroit.