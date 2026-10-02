# Pipeline CI

Trois jobs, sur chaque pull request comme sur chaque push — le tag de release n'y change rien. Le
troisième ne bloque rien : c'est un canari sur la dernière CLI publiée, et il répond à une seule
question. Voir [`ci.yml`](../.github/workflows/ci.yml).

Les commandes vivent dans `package.json`, pas dans le YAML. Le YAML appelle, il ne décide pas —
c'est la même règle que pour les drapeaux de couverture, et pour la même raison : une option
qui vit à un seul endroit ne peut pas être oubliée ailleurs.

## 1. Ce que chaque contrôle coûte

Mesuré sur ce dépôt, par la commande que la CI exécute (`npm run …`), médiane de cinq
exécutions. L'installation est un cas à part : deux exécutions, 107,6 s et 106,9 s.

| Contrôle | Coût |
|---|---|
| Documentation : surface déclarée contre surface réelle | 0,43 s |
| Harnais différentiel | 0,50 s |
| Suite source | 0,77 s |
| Couverture : seuils, code mort, non-régression | 1,53 s |
| Typecheck | 2,15 s |
| Parité, quatre cibles | 2,53 s |
| Build + minify + réécriture | 3,17 s |
| Dérive : le build ne touche aucun artefact committé | 3,17 s |
| Portes du build : reproductibilité, `--keep-names`, tailles | 4,51 s |
| **Installation des six items** | **107 s** |

Tous les contrôles rapides réunis coûtent **18,8 s**. L'installation en coûte **5,7 fois
plus**. C'est le seul coût réel de la CI, et c'est le seul qui mérite qu'on discute de sa
fréquence — ce qui a été fait, et la décision est : à chaque PR.

Le coût dominant n'est pas la commande, c'est le **démarrage de runner**. Trois jobs
représentent trois démarrages pour neuf contrôles qui coûtent ensemble 18,8 secondes.

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
| 5 | **Build** — `npm run build` | Un artefact que le projet utilisateur ne peut pas charger |
| 6 | **Portes du build** — `npm run verifier-build` | Un build non reproductible, un `--keep-names` inopérant, un minifié plus gros que l'original |
| 7 | **Parité** — `npm run parite` | Le build ne reproduit pas la source ; la suite perd des tests en route |
| 8 | **Dérive** — `npm run verifier-derive` | Un artefact committé que le build ne produit plus |
| 9 | **Documentation** — `npm run documentation` | Un README qui ment sur la surface, ou qui demande un alias |

Les contrôles 6, 7 et 8 dépendent du 5 : le test minifié vise le runtime minifié, et le diff se
fait sur ce que le build vient d'écrire. L'ordre n'est donc pas seulement une question de signal,
il est aussi un ordre de dépendance — ce qui rend la réponse par sévérité gratuite.

**Le contrôle 8 EST le diff** : `git diff --stat` sur `registry/default/`, après un build que la
porte relance elle-même. Un diff vide **est** le test, parce que le build est reproductible — et
c'est le contrôle 6 qui le vérifie, en rejouant le build et en comparant les condensats : deux
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

## 4. Au tag de release

Le job « rapide » ne change pas. La non-régression par rapport au merge-base s'applique au tag
comme en pull request, et le seuil mesuré ne se relâche pas non plus — rien à relâcher : il n'est
pas à 100 %, et ADR-0011 dit pourquoi.

Le job « distribution » s'exécute exactement comme sur une PR.

## 5. Le déclencheur de release

Rien de technique ne distingue une pull request de routine d'un cut de version. Un
mainteneur pousse un tag ; la CI doit être verte ; rien ne change sinon.

C'est volontaire. Une règle automatique qui décide de publier introduirait un état que personne
n'a demandé, et le coût d'une publication inutile dépasse celui d'une décision manuelle.

## 6. Le budget de maintenance

Chaque contrôle est une entrée `package.json`. Le YAML fait trois choses : installer, appeler
l'entrée, propager le code de sortie. Il ne contient aucun drapeau de couverture, aucun motif
d'inclusion, aucun chemin de fichier.

Une CI qu'on peut lire en trente secondes est une CI qu'on n'ose pas réécrire. Et quand un
contrôle change, il change à un seul endroit.