# Un computé ne s'empile pas dans la file de drainage, et la voie rapide 2 n'exige pas de cible

Trois structures que la baseline n'a pas ont été retirées du Cœur : le drapeau `enDrain`, l'empilement des computés dans la file de drainage, et le test `TRACKING` sur la voie rapide 2. Chacune avait une justification en prose, et aucune ne tenait.

## Considered Options

- **Reproduire le comportement fautif** — refusé, et c'est la seule règle qui compte ici. [ADR-0001](./0001-clone-exact-de-la-baseline.md) fait de la baseline le contrat, donc une Divergence non consignée est un oubli. Ces trois-là n'étaient pas consignés : `SPEC.md` §21 ne les mentionnait pas, et le harnais différentiel ne les voyait pas.
- **Les consigner comme divergences assumées** — refusé. Une divergence se justifie par un **gain**, or il n'y en avait aucun : ce sont trois recalculs inutiles et un effet qui ne tourne pas. Les consigner aurait figé un défaut sous le nom d'un choix.
- **Supprimer le drapeau `enDrain` sans vérifier ce qu'il protégeait** — refusé. Le drapeau avait une raison d'être écrite : empêcher un drainage imbriqué depuis un effet. Elle a été vérifiée avant de le retirer, sur les trois formes que son commentaire citait — effet imbriqué qui écrit, effet imbriqué qui relit un computé, deux effets qui s'écrivent l'un l'autre. **Les trois rendent le même journal avec et sans le drapeau**, donc il protégeait un cas qui ne se présente pas.

## Règle opératoire

> Une structure que la baseline n'a pas doit être justifiée par un comportement **observé** qui en dépend, jamais par un raisonnement sur ce qui pourrait mal tourner. Un calcul qui *pourrait* servir une valeur invalidée à tort n'est pas une preuve qu'il le fait — il faut le poser sur un graphe et le lire.

## Les trois retraits

**L'empilement des computés.** `Computed._notify` posait `NOTIFIED | OUTDATED` **et** empilait le computé dans `batchedEffect`. La baseline (`L737-749`) ne fait que le premier, puis prévient ses cibles par un parcours de `_targets`. Conséquence de l'empilement : la lecture d'un computé devenait une **consommation** de la file, puisque `_refresh` y efface `NOTIFIED`. Donc écrire une source puis relire son computé dans le même batch réveillait **personne** à la sortie du batch — l'effet ne tournait jamais. Le cas minimal tient en trois lignes, et un `untracked` autour de la lecture le déclenche aussi, parce qu'il neutralise le suivi, pas le rafraîchissement.

**Le drapeau `enDrain`.** Il rendait `endBatch` muet dès qu'un drainage était en cours. La baseline n'a rien de tel : son `endBatch` décrémente et draine. Retiré avec la branche morte qu'il commandait — le drainage des computés — et avec l'interface `Computed._nextBatchedEffect`, dont la seule raison d'être était de typer le champ que l'empilement posait.

**Le test `TRACKING` sur la voie rapide 2.** Il exigeait une cible avant de court-circuiter, au motif que « sans cible, aucune source ne prévient, donc court-circuiter servirait une valeur périmée ». C'est faux, et pas d'une nuance : `sourcesAreStale` compare les versions **nœud par nœud**, et ce parcours ne dépend d'aucun abonnement. La preuve est `computed/evaluation-dune-ecriture-non-liee` — un computé nu, deux écritures sur un signal qu'il ne lit pas, puis une relecture : **une** évaluation, chez la baseline comme ici. Avec le test, la même relecture en faisait **deux**.

Ce que le test coûtait n'était donc pas une valeur fausse — c'est bien le contre-exemple à la justification. C'était un **recalcul de trop** sur toute écriture non liée, donc la fuite d'effets déjà figée par `effect#34` en créait un de plus à chaque fois. Un scénario qui n'observe qu'une VALEUR ne voit rien de tout cela, puisque la valeur est juste des deux côtés : seul le compte diffère, et c'est ce que la matrice note à son entrée `computed#3b`.

## Consequences

- **Un quatrième écart de comportement était masqué par le même empilement, et il est corrigé du même coup.** L'ordre de drainage de deux computés indépendants et deux effets était `c1 c2 e2 e1` au lieu de `c1 e1 c2 e2` : le computé était rafraîchi comme une génération à part entière, donc il passait devant l'effet qui l'avait déclenché. La matrice l'avait observé en une forme CHAINÉE (`computed#18`) qui n'a jamais divergé ; la forme qui divergeait, deux computés INDÉPENDANTS, n'avait pas d'entrée — `computed#18b`. Même trou de registre que `computed#5` et `computed#6`.
- **La matrice gagne trois entrées, `batch#27`, `computed#3b` et `computed#18b`.** Aucune des entrées existantes ne décrivait ces comportements : `batch#26` porte sur `batchIteration`, pas sur la file ; `computed#3` compte les évaluations d'une écriture **liée** ; `computed#18` note l'ordre de deux computés **chaînés**, une forme qui n'a jamais divergé. Une entrée sans probe n'est pas une entrée — les trois viennent d'une exécution, comme les autres. Les deux dernières sont suffixées parce que leur sujet est plus étroit que l'entrée qu'elles prolongent.
- **`docs/architecture.md` §4 est corrigé, pas preserved.** Sa première sortie disait « si le computed a des abonnés », ce qui décrivait le test retiré. §4 décrit bien du **comment** — donc l'énoncé était à sa place — mais il était faux, et il serait resté faux en silence. La version corrigée dit ce que la voie rapide fait réellement, et nomme le scénario qui le prouve. C'est la forme que la règle ci-dessus impose : un énoncé de structure dans le document de structure, appuyé sur une garantie rejouable.
- **La correction de #38 s'appuie sur ce même geste.** Retirer `RUNNING` de la branche « la valeur a changé » et le relâcher inconditionnellement est le même mouvement : une structure de plus que la justification ne soutient pas. Voir l'entrée de matrice `computed#5` et `computed#6`, et le scénario `computed/valeur-identique-relisible`.
- **`SPEC.md` §21 est corrigé sur deux points.** `_nextBatchedEffect` a disparu de la liste des membres internes, et l'affirmation qu'ils « ne sont pas typés » était fausse depuis longtemps — ils le sont en huit endroits. [ADR-0009](./0009-geometrie-de-la-liste-des-dependances.md) l'avait signalé comme une ligne à ne pas laisser en place.

Voir [ADR-0001](./0001-clone-exact-de-la-baseline.md), dont cette décision est une application.
