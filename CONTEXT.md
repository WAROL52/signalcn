# signalcn

Moteur de signaux réactifs pour JavaScript et TypeScript vanilla, sans framework et sans dépendance runtime, distribué comme code source via un registry shadcn. Son référentiel de comportement est la bibliothèque [`@preact/signals-core`](https://www.npmjs.com/package/@preact/signals-core) : `signalcn` cherche à être indiscernable d'elle, pas à la copier.

## La conformité

**Baseline** :
Version figée de la bibliothèque de référence dont le comportement observable doit être reproduit. C'est le contrat : toute divergence est une décision, pas un oubli.
_Avoid_ : référence, cible, référence upstream, upstream

**Quirk** :
Comportement de la baseline qui contredit l'intuition — `NaN` notifie parce que l'égalité est une identité stricte et non une identité de valeur — mais qui fait partie du contrat et doit être reproduit tel quel.
_Avoid_ : bug, anomalie, détail

**Divergence** :
Écart entre `signalcn` et la baseline, assumé, documenté et figé par un test.
_Avoid_ : écart, différence, non-conformité

**Conformité** :
État d'une implémentation dont le comportement observable est indiscernable de celui de la baseline.
_Avoid_ : compatibilité, similarité

**Cœur** :
La partie du projet qui implémente le moteur réactif, livrée dans le fichier source de vérité de l'implémentation. Il n'a ni framework, ni DOM, ni dépendance runtime.
_Avoid_ : moteur, bibliothèque, package

## La preuve

**Scénario** :
Programme qui exécute une séquence d'appels sur une implémentation et enregistre un journal d'observables — sorties, notifications, évaluations, appels de nettoyage, erreurs.
_Avoid_ : test, cas de test, fixture

**Journal** :
Trace ordonnée des observables produite par un scénario. C'est ce qui se compare, pas le retour de la fonction.
_Avoid_ : sortie, historique, log d'exécution

**Oracle** :
Source de vérité qui décide si un scénario passe. Pour `signalcn`, c'est la baseline réelle exécutée, jamais la documentation.
_Avoid_ : attendu, référence, vérité terrain

**Harnais différentiel** :
Outillage qui exécute un même scénario contre la baseline et contre `signalcn`, puis compare les deux journaux.
_Avoid_ : double test, test miroir, comparaison

**Garantie** :
Propriété selon laquelle un test échoue dès qu'un comportement change. Une garantie couvre la correction sémantique, pas seulement l'exécution des lignes.
_Avoid_ : couverture

**Couverture** :
Proportion de lignes, de branches et de fonctions atteignues par les tests. C'est une barrière de qualité, jamais une preuve que le comportement est juste.
_Avoid_ : garantie, preuve, validation

## La distribution

**Source de vérité** :
Fichier maintenu manuellement et faisant seul autorité. Le projet n'en compte que deux.
_Avoid_ : source, fichier source

**Artefact** :
Fichier dérivé d'une source de vérité par le pipeline de génération, jamais modifiable à la main.
_Avoid_ : sortie, build, fichier généré

**Pipeline de génération** :
Transformation unidirectionnelle d'une source de vérité vers ses artefacts. Aucun artefact ne peut devenir une entrée.
_Avoid_ : build, chaîne de compilation

**Item de registry** :
Poignée d'installation indépendante, addressable par la CLI shadcn, qui pointe vers un artefact. Un item n'en instalarait jamais un autre par lui-même.
_Avoid_ : package, module, dépendance

**Registry** :
Catalogue shadcn du dépôt, qui rend chaque artefact installable individuellement.
_Avoid_ : catalogue, store, dépôt

## Le vocabulaire du moteur

Ces termes héritent de la baseline et portent la même sémantique observable que chez elle.

**Signal** :
Cellule de valeur modifiable qui prévient ses cibles lorsqu'elle change.
_Avoid_ : variable, state, store

**Computed** :
Signal en lecture seule dont la valeur dérive d'autres signals, évalué à la demande puis mis en cache jusqu'à invalidation.
_Avoid_ : selector, dérivé, getter

**Effect** :
Fonction réactive exécutée immédiatement puis à chaque changement de ses dépendances, capable de retourner un nettoyage exécuté avant chaque réexécution et au moment du dispose.
_Avoid_ : watcher, observateur, abonné

**Dépendance** :
Lien établi entre un effect ou un computed et un signal effectivement lu pendant son exécution courante. Les dépendances sont rejouées à chaque exécution.
_Avoid_ : binding, lien, abonnement

**Cible** :
Effect ou computed qui observe un signal.
_Avoid_ : abonné, listener, consommateur

**Invalidation** :
Marquage d'un nœud comme obsolète, sans le réévaluer. Le recalcul n'a lieu qu'à la lecture.
_Avoid_ : dirty, périmé, sale

**Drainage** :
Passage par lequel le moteur réexécute les cibles invalidées. Chaque drainage vide la file d'attente accumulée depuis la dernière passe et n'en fait apparaître aucune nouvelle ; la passe suivante ne s'ouvre que lorsque la file est vide.
_Avoid_ : flush, vidage, passe

**Cycle** :
Auto-rentrée : un nœud se réévalue alors qu'il est encore en cours d'évaluation. Détecté exactement, par construction, sans aucun comptage, et levé immédiatement. Un cycle n'implique pas de chaîne : deux nœuds qui se relisent ne sont pas un cycle.
_Avoid_ : boucle infinie, deadlock, cycle de dépendances

**Borne de drainage** :
Limite du nombre de drainages qu'une portée peut enchaîner avant que le moteur n'abandonne et ne lève. Ce n'est pas une détection de cycle : rien n'inspecte le graphe, et rien ne distingue une boucle d'une cascade légitime. Une cascade assez longue atteint la borne, et le moteur lève alors qu'aucun cycle n'existe.
_Avoid_ : seuil de cycle, détection de cycle, limite de récursion

**Batch** :
Portée qui regroupe des écritures et diffère la propagation de leurs effets jusqu'à la sortie de la portée la plus externe.
_Avoid_ : transaction, flush, lot

**Untracked** :
Lecture qui n'établit aucune dépendance, même lorsqu'elle survient au milieu d'une exécution réactive.
_Avoid_ : lecture détachée, peek

**Action** :
Enveloppe qui exécute une mutation en la groupant et en la détachant du contexte de suivi courant.
_Avoid_ : mutateur, méthode

**Model** :
Objet d'état produit par une fabrique, dont chaque fonction est transformée en action et dont les effets créés pendant la construction lui appartiennent.
_Avoid_ : store, entité, modèle de données

**Dispose** :
Opération par laquelle un effect cesse définitivement d'être reactivé et perd ses abonnements. Elle est idempotente.
_Avoid_ : unmount, destruction, nettoyage

**Nettoyage** (cleanup) :
Fonction retournée par un effect, exécutée juste avant sa réexécution suivante et au moment de son dispose.
_Avoid_ : teardown, finalizer
