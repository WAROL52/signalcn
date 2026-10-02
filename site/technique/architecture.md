# Architecture du moteur réactif

Spécification d'implémentation de `registry/default/signals.ts`. Elle ne décrit pas ce que
le cœur **fait** — c'est le rôle de [`SPEC.md`](/SPEC.md), qui est normatif — mais **comment**
le graphe est construit pour produire ce comportement.

Deux documents, deux lecteurs. Un comportement observé doit se lire dans `SPEC.md` et se
retrouver dans [`research/baseline-1.14.4.md`](/research/baseline-1.14.4.md) avec sa
localisation. Une décision de structure se lit ici, et se justifie dans `docs/adr/`.

## 1. Le principe directeur

**La sémantique est figée, l'architecture est libre.**

Le comportement observable est reproduit exactement, quirks compris — c'est
[ADR-0001](/docs/adr/0001-clone-exact-de-la-baseline.md). La structure interne ne l'est pas :
elle est redessinée pour être lisible et pour servir une cible ES2020 sans transpilation,
tant que la structure ne change aucun résultat observable.

Le test de recevabilité d'un écart est simple : *si un test de la matrice de conformité
change de résultat, l'écart est interdit.*

## 2. Le nœud et ses champs

Trois classes natives ES2020, aucun `declare class`, aucun prototype écrit à la main.

### `Signal`

Huit propriétés-own, assignées **dans cet ordre** — l'ordre est normatif, `Object.keys` le
révèle :

```text
_value, _version, _node, _targets, _batchSnapshotVersion, _watched, _unwatched, name
```

`_node` et `_targets` sont explicitement initialisés à `undefined` plutôt qu'omis, pour que
leur présence dans l'énumération soit garantie indépendamment de l'implémentation.

`Signal` ne porte **pas** de champ `_flags`. Cette absence est un dispatch, pas un oubli :
le test d'abonnement paresseux des computeds s'appuie sur `flags & TRACKING` valant `0` pour
un signal, qui n'a aucune cible à réveiller.

### `Computed extends Signal`

Huit champs hérités, plus quatre assignés par le constructeur :

```text
_fn, _sources, _globalVersion, _flags
```

`_flags` vaut `OUTDATED` à la construction, `_globalVersion` vaut `globalVersion - 1` — donc
un computed neuf échoue toujours la voie rapide et se recalcule au moins une fois.

### `Effect`

Six propriétés-own, et **aucun héritage** :

```text
_fn, _cleanup, _sources, _nextBatchedEffect, _flags, name
```

Pas de `_value`, pas de `_version`, pas de `value`. Un effet n'est pas un signal : il ne cache
rien, donc il n'a pas besoin d'un drapeau de cache invalide. Son seul drapeau initial est
`TRACKING`, ce qui le fait toujours abonner ses sources.

### `brand`

`Symbol.for("preact-signals")` sur `Signal.prototype`, donc hérité par `Computed`. Jamais sur
une instance : coût nul par signal, et l'opérateur `in` le traverse, ce qui est exactement ce
dont la détection de sous-objet d'un modèle a besoin.

## 3. Les deux listes chaînées

Un seul objet `Node` sert de liaison dans deux listes doublement chaînées indépendantes. Son
champ `_source` est un `Signal`, son champ `_target` un `Computed` ou un `Effect`.

| Liste | Tête | Insertion | Parcours | Raison |
|---|---|---|---|---|
| `signal._targets` — les abonnés | la cible la plus récente | en tête, O(1) | `_targetPrev`, vers les plus anciennes | seule la longueur compte |
| `node._sources` — les dépendances | la source lue en premier | en tête, O(1) | `_next`, vers les plus récentes | l'ordre d'utilisation est sémantique |

**La règle est dans [ADR-0009](/docs/adr/0009-geometrie-de-la-liste-des-dependances.md)**, qui donne le
sens de chaque maillon et pourquoi le mauvais est silencieux. Ce tableau ne fait que nommer les
colonnes.

Les deux listes ont la même géométrie, celle de la baseline : insertion en tête, tête à l'opposé du
parcours. Une version de ce paragraphe affirmait le contraire — que nous étions le miroir, et que
l'asymétrie était avec la baseline — sur la foi d'un argument `O(1)` qui est vrai des deux côtés.
L'écart a duré jusqu'à ce correctif et il a produit une divergence observable, celle de l'ordre de
`unwatched`.

Le piège que l'ADR-0009 décrit est toujours là pour qui parcourt la liste par le mauvais maillon : il
ne lève rien, il rend un nœud. C'est ce qui a produit les quatre traversages corrigés en `0d61427` —
`sourcesAreStale`, `disposeSelf`, et les deux surcharges de `Computed`.

### La sentinelle de recyclage

`Node._version` prend cinq valeurs, et la cinquième est la plus importante :

| Valeur | Sens |
|---|---|
| `0` | nœud créé, pas encore observé |
| `n` | version de la source **telle que la cible l'a vue** |
| `-1` | **potentiellement abandonné, mais récupérable** |

`-1` est une sentinelle, pas une version. Le balayage la consomme ; une réactivation remet le
nœud à `0` **sans réallouer**, ce qui est le mécanisme du recyclage.

Le choix de la version plutôt que de la valeur est le cœur du design : les valeurs de source
peuvent occuper une quantité arbitraire de mémoire, et un computed les retiendrait
indéfiniment puisqu'il est évalué paresseusement. **On compare des entiers, jamais des
valeurs.**

## 4. Le compteur global

Un unique `let globalVersion` de module, incrémenté par toute écriture de signal, jamais par
un computed.

La voie rapide de lecture d'un computed a deux sorties successives :

1. si le computed n'a pas été signalé périmé et qu'aucune de ses sources n'est en retard, sa
   valeur ne peut pas avoir changé — court-circuite sans recalculer ;
2. sinon, si le compteur global n'a pas bougé depuis le dernier rafraîchissement, rien n'a pu
   changer.

La première sortie ne demande **aucun abonné**. Une version de ce paragraphe en exigeait un, au
motif que « sans abonné, aucune source ne prévient, donc court-circuiter rendrait une valeur
périmée ». C'était faux : la comparaison des versions se fait nœud par nœud et ne dépend d'aucun
abonnement. Ce que le test coûtait : un computed nu réévaluait sur toute écriture non liée. La
preuve est le scénario `computed/evaluation-dune-ecriture-non-liee`.

La seconde sortie est **délibérément trop large** : n'importe quelle écriture de n'importe quel
signal invalide le cache de tous les computeds du programme. Le pire cas est un recalcul
inutile, jamais une valeur fausse. C'est le bon échange : la voie rapide est bon marché à
échouer, parce que l'échec ne coûte qu'un recalcul.

Un effet n'a pas de `_globalVersion` : il ne cache rien, donc rien à raccourcir. Sa
détermination se fait nœud par nœud, à la demande.

## 5. Le batch et le drainage

Trois variables de module :

```text
batchDepth        profondeur d'imbrication
batchIteration    compteur de générations de notification
batchedEffect     tête de pile
```

`batchedEffect` est à la fois **tête de pile** et **tête de liste chaînée**, grâce au champ
`_nextBatchedEffect` d'un effet. La liste chaînée *est* la pile : aucune allocation, et le
drain sort dans l'ordre inverse de l'empilement, donc **LIFO**.

Ce LIFO n'est pas un choix séparé, c'est la conséquence de l'insertion en tête. Son effet
pratique est la **localité** : si un effet réveille deux aval, le plus proche s'exécute
immédiatement après son producteur, sans jamais attendre la génération suivante.

### Le drainage se fait en détachant

L'algorithme, et le cœur de tout le mécanisme :

```text
faire :
  chaîne ←.batchedEffect
  .batchedEffect ← vide                    ← LE DÉTACHEMENT
  batchIteration ← batchIteration + 1
  pour chaque effet de la chaîne, en la défaisant nœud par nœud :
      effacer NOTIFIED                    ← AVANT d'exécuter
      si non disposé ET dépendances périmées :
          exécuter, en mémorisant la première erreur sans l'interrompre
remettre batchIteration à zéro
lever la première erreur, s'il y en a une
```

Le détachement **avant** toute exécution est indispensable, pas optimisant. Il garantit
qu'aucune chaîne n'est atteignable pendant le drainage : une écriture faite par un effet
empile sur une pile vide, donc dans la génération suivante. Et la chaîne est **aussi** défaisie
nœud par nœud au fil du parcours, ce qui est la seconde barrière.

Le drapeau `NOTIFIED` est effacé **avant** l'invocation, jamais après. Il déduplique donc
dans une génération, pas dans un drainage.

Le drain est ainsi en **largeur de notification** : une génération = tout ce que la même
écriture a réveillé, puis tout ce que ces effets ont réveillé.

### Erreurs

Le drainage n'a pas de `try`/`finally`. Il accumule explicitement : la première erreur gagne,
les suivantes sont avalées, le drain se termine, l'état global est intégralement restauré,
et **ensuite** l'erreur est levée.

C'est une sûreté d'exception par construction, et c'est délibéré : un batch ne doit jamais
avorter son drain, sinon on laisserait des effets non exécutés et des versions incohérentes.

## 6. Les snapshots de batch

Un snapshot ne capture pas la liste des abonnés. Il capture la source, sa valeur **avant
batch** et sa version **avant batch**. Les abonnés sont relus au moment de la réconciliation.

### La condition d'enregistrement

Un snapshot n'est pris que si l'on est dans le corps du `batch` de l'utilisateur, et pas
pendant le drainage. Les deux exclusions ont une raison chacune, et la seconde est contre-intuitive :

- hors de tout batch, il n'y a pas d'état pré-batch auquel se comparer ;
- **pendant le drainage, la propagation de version est un canal voulu.** C'est par lui qu'un effet qui écrit un signal réveille ses propres dépendants pour la génération suivante. Désactiver la propagation ici casserait les cascades multi-effets, et ferait boucler une auto-écriture jusqu'à la borne.

Un jeton de lot, porté par la source, garantit **un seul snapshot par source par batch**,
même si elle est écrite dix fois.

### L'algorithme de fast-forward

Au moment du drainage, **avant** la boucle de drain :

1. détacher la pile de snapshots, comme pour la pile d'effets ;
2. pour chaque snapshot, comparer `source._value === snapshot._value` ;
3. si la valeur est revenue à l'état pré-batch, parcourir `source._targets` et, pour chaque
   nœud dont la version vue est **exactement** la version pré-batch, avancer sa version vue
   jusqu'à la version courante de la source.

`source._version` n'est **jamais** modifié.

### Pourquoi les versions avancent et ne reculent jamais

Reculer la version romprait la monotonie, et le scénario est précis : un computed paresseux
peut avoir **lu** la source à une version intermédiaire pendant le batch, et l'avoir cachée. Si
la version reculait, la prochaine écriture émettrait le même numéro pour une valeur
totalement différente ; le computed verrait « rien n'a changé » et renverrait sa valeur
en cache **pour toujours**. Corruption silencieuse, non récupérable.

La compensation se fait donc sur les numéros **observés par les abonnés**, et seulement
ceux qui n'ont rien observé d'autre.

### Pourquoi la condition est aussi stricte

Un abonné qui a observé une version intermédiaire a réellement lu une **autre valeur**. Lui
dire que cette valeur n'a jamais existé rendrait son cache silencieusement faux. La condition
« version vue == version pré-batch » est une garantie de fidélité temporelle.

C'est pourquoi une lecture paresseuse pendant le batch suffit à faire perdre l'avantage : le
fast-forward ne s'applique qu'aux nœuds ayant vu la version pré-batch.

**Conséquence à écrire dans les tests :** la comparaison du snapshot est une identité `===`,
pas un `Object.is`. Donc un signal passé à `NaN` n'est **jamais** considéré comme réverti,
et un signal passé de `-0` à `0` l'est **toujours**.

## 7. L'auto-rentrée et la borne de drainage

**Deux mécanismes distincts**, parce qu'ils ne répondent pas au même problème. Un seul détecte quoi
que ce soit, et il ne voit que l'auto-rentrée.

### Mécanisme A — le compteur de drainages

Armé depuis le setter d'un signal, à l'intérieur de la garde d'égalité, donc avant toute
mutation. Un cycle borné ne lève pas : c'est une **limite de débit**.

Ce n'est pas une reconnaissance de cycle, et ce n'est pas présenté comme tel : rien n'inspecte le
graphe, rien ne distingue une vraie boucle d'une chaîne légitime d'effets. Reconnaître exactement
un cycle serait indécidable — un effet qui réécrit une valeur *légèrement
différente* est un schéma légitime. La limite de débit est le bon outil.

Et le prix se paie : une cascade légitime assez longue atteint la borne, et le moteur lève alors
qu'aucun cycle n'existe. Exemple mesuré, identique sur la baseline : une chaîne de 150 effets, chacun
lisant le précédent et écrivant le suivant **sans le relire**, lève `Error: Cycle detected` alors
qu'aucun nœud ne se relit. À 101 maillons, la même chaîne passe. La borne exacte n'est pas figée,
§15.2 — ce qui compte ici n'est pas le nombre, c'est qu'un graphe sans cycle puisse lever.

Le setter **imbrique son propre batch**, donc le drainage imbriqué ne fait rien et chaque
génération correspond à exactement une exécution d'effet. La borne compte des générations, pas
des tours de boucle.

**La borne est un paramètre d'implémentation, pas une constante sémantique.** Il n'existe pas
de valeur correcte : seulement une valeur assez grande pour ne pas casser les cascades
légitimes, assez petite pour ne pas figer. `SPEC.md` §15.2 exige que le cycle **existe**, pas
qu'il tombe à 102.

### Mécanisme B — le drapeau `RUNNING`

Posé sur un computed **avant** de vérifier ses dépendances, ce qui est toute l'idée : c'est
cette anticipation qui rend la détection possible. Vérifié **en toute première instruction**
du getter, donc avant toute création de nœud, avant tout rafraîchissement, avant toute mutation.

Nettoyé en trois endroits, dont un garanti : le rafraîchissement ne jette jamais, il convertit
toute exception de la fonction en valeur. La restauration du contexte, le nettoyage des
sources et l'effacement du drapeau s'exécutent donc toujours.

L'erreur d'un computed se propage en becoming **la valeur** du computed externe, qui la
relancera à sa lecture. L'utilisateur voit l'erreur originale, levée depuis le **site de
lecture**, pas depuis le site d'écriture.

### Pourquoi il en faut deux

Le mécanisme B détecte un cycle de **lecture**, synchrone, dans la pile d'appels. Le
mécanisme A détecte une oscillation **asynchrone**, dans le drainage. Avec B seul, une
auto-écriture boucle pour toujours. Avec A seul, un cycle de lecture passe 100 fois dans le
drainage avant de lever — lent mais correct.

## 8. Le tracking

Un **emplacement unique**, pas une pile. C'est la source du message `Out-of-order effect` :
sans pile, un effet imbriqué qui se désimbrique dans le désordre est détectable. `SPEC.md`
§15.8 note que ce message est inatteignable par l'API publique, mais atteignable en
manipulant la classe `Effect` exportée — et le cœur doit le produire dans ce cas.

Tout le tracking tient en une garde, en tête de l'ajout de dépendance : si l'emplacement est
vide, on renvoie `undefined`, aucun nœud n'est créé, aucun abonnement n'a lieu. C'est le
mécanisme de base de la bibliothèque.

`untracked` vide l'emplacement **et** la portée de capture d'effets, puis restaure les deux
dans un `finally`. Ce qu'il ne neutralise pas : les écritures, qui passent le pipeline
complet.

## 9. La réconciliation des dépendances

Trois fonctions, un seul protocole : **marquer, balayer, réemployer**.

1. **Marquer** — tous les nœuds de la liste passent à `-1`, et la source prend possession de
   son emplacement de liaison, en sauvegardant l'étranger qui s'y trouvait.
2. **Balayer** — parcours **arrière** via le chaînage précédent. Un nœud encore à `-1` est
   réellement abandonné : on le désabonne et on le décroche. Un nœud à `0` a été réutilé, et
   le dernier rencontré en parcourant à l'envers devient la tête de la nouvelle liste.
3. **Restaurer** — chaque source rend l'emplacement qu'elle avait pris, exactement une fois
   par passe.

Trois défenses contre l'itération invalide :

- **discipline stricte** : l'abonnement ne touche que la liste des cibles, le balayage ne
  touche que la liste des sources. Les deux ensembles sont disjoints, donc rien de ce que la
  boucle déclenche ne réécrit le lien que la boucle suit ;
- **la sauvegarde de l'emplacement** de la source, par nœud, exactement une fois par passe —
  sans elle, un computed imbriqué qui lit une source déjà lue laisserait la source pointant
  sur le nœud du parent, et le parent perdrait sa correspondance ;
- **l'insertion en tête** : un nœud écrit tombe là où le pointeur de course vient de passer, donc
  toujours **derrière** lui, jamais devant. On n'ajoute jamais dans une liste qu'on parcourt.

## 10. Les drapeaux

Six puissances de deux, masquées par `&` et posées par `|`.

| Drapeau | Posé quand | Effacé quand |
|---|---|---|
| `RUNNING` | la fonction d'un nœud est sur la pile | sortie rapide, fin de rafraîchissement, fin d'effet, cleanup en échec |
| `NOTIFIED` | une notification est émise | **avant** l'exécution, début de rafraîchissement |
| `OUTDATED` | construction d'un computed, premier abonné, notification | avant recalcul |
| `DISPOSED` | `dispose()`, cleanup en échec | début d'exécution |
| `HAS_ERROR` | la valeur est une exception | succès du recalcul |
| `TRACKING` | le nœud a au moins un abonné | dernier abonné perdu |

Un `Effect` ne porte jamais `OUTDATED` : sa logique est inversée. Au lieu de « ma valeur est
périmée », c'est « **une** de mes dépendances est peut-être périmée », déterminée à la demande
en lisant les nœuds. Il n'a pas de cache, donc pas besoin d'un drapeau de cache.

Les deux effacements de `NOTIFIED` sont inconditionnels et	positionnés **avant** tout test.
C'est ce qui permet à un computed de notifier ses propres abonnés en cascade au tour suivant du
drainage, au lieu de devenir silencieusement définitif.

## 11. `createModel` — la portée de capture

`createModel` est le seul export qui a une logique propre : le reste est de la propagation.
C'est aussi le seul qui demande de concevoir plutôt que de transcrire.

### Le principe : un défaut est corrigé sauf s'il est figé

[ADR-0001](/docs/adr/0001-clone-exact-de-la-baseline.md) impose de reproduire la sémantique, quirks
compris. Il faut le lire avec [ADR-0005](/docs/adr/0005-defauts-non-figes-de-createmodel.md), qui
précise la règle opératoire :

> Un défaut de la baseline est corrigé **sauf** si la matrice de conformité a observé un
> comportement qui en dépend. La garantie de conformité, c'est elle, pas l'implémentation.

Dix-neuf défauts ont été relevés dans cette surface. **Douze sont figés** par la matrice et
doivent être reproduits à l'identique — dont le plus contre-intuitif : un effet créé par une
fabrique qui lève est **perdu**, jamais disposé, et continue de tourner sans poignée. Sept sont
libres et sont corrigés.

### Un emplacement global, pas une pile

Une variable de module, `capturedEffects`, indéfinie ou pointant un tableau d'effets. Le seul
point d'insertion est le constructeur `Effect`, **avant le premier run**.

Deux règles qui doivent rester solidaires :

- l'ouverture d'une portée est **inconditionnelle**. Sans elle, un `createModel` imbriqué dans
  un `untracked` n'aurait pas de tableau, ses effets ne seraient poussés nulle part, et ils ne
  seraient possédés par personne ;
- la remontée vers la portée englobante est **gardée** sur le fait que cette portée existe. Un
  enfant n'est jamais promu vers un parent neutralisé.

La concaténation à la fermeture d'un modèle produit une **propriété dupliquée, pas exclusive** :
un effet appartient à l'enfant et au parent. Il n'y a pas de compteur de référence —
**le premier disposeur gagne**. Disposer un parent tue les effets d'un enfant vivant, et le
dispose de l'enfant devient ensuite sans effet.

### Neutralisation par `untracked`

`untracked` vide aussi cette portée, et la restaure dans son `finally`. C'est pourquoi un
effet créé dans un `untracked` ou dans une `action` englobante **n'appartient pas** au modèle.
Un `batch` ne la touche pas : un effet créé dans un `batch` est donc possédé.

### Quand la fabrique lève

L'ordre des opérations est **constitutif** : neutraliser la portée **avant** la fermeture, dans
un `catch` qui précède le `finally`. Inverser l'ordre concaténerait au parent des effets
appartenant à un modèle mort.

Ce qui n'est pas récupérable est ce que la matrice a figé : les tableaux sont perdus. Ce qui
est évité est la fuite de **propriété** vers le mauvais modèle — pas la fuite de ressource.

## 12. `createModel` — le constructeur

`createModel` retourne une **expression de fonction nommée**, pas une classe. Le typage exige
`new`, le runtime accepte un appel nu.

L'ordre des étapes est contrainte, pas préférence :

1. ouvrir la portée de capture ;
2. appeler la fabrique — arguments transmis, `this` non transmis ;
3. fermer la portée, dans un `finally` ;
4. envelopper l'objet, **en place** ;
5. poser le disposeur ;
6. retourner l'objet de la fabrique, tel quel.

L'objet de la fabrique **est** le modèle. Toute autre référence à cet objet — une closure, une
variable de module — voit les mêmes enveloppes. Ni copie, ni proxy, ni gel.

L'étape 4 avant l'étape 5 est obligatoire : poser le disposeur d'abord expose l'enveloppe à une
clé qu'elle ne doit pas voir. Le placer après garantit qu'un modèle enveloppé à moitié n'est
jamais retourné avec un disposeur — c'est-à-dire qu'un modèle jamais obtenu ne peut pas
disposer de l'utilisateur qui l'attend.

**Garde ajoutée** : une fabrique qui ne renvoie pas un objet est rejetée **avant** toute
mutation. Dans la baseline, un retour primitif lève une `TypeError` de V8 en mode strict, et en
mode sloppy réussit **silencieusement** : le modèle est construit, ses effets tournent, et
personne ne peut les arrêter.

## 13. `createModel` — l'enveloppement

C'est un transformateur de fonctions récursif, et rien de plus. **Il ne valide rien** : toute la
garantie d'un modèle est portée par le type. Le runtime n'en apporte aucune.

### Le test de descente, par valeur

Un objet est parcouru s'il n'est pas nul et si `val.brand !== BRAND_SYMBOL`.

La baseline teste `!("brand" in val)` — un **nom**, jamais une valeur. Conséquence : tout objet
métier portant une propriété `brand` — un catalogue, un DTO, un type brandé — est
silencieusement **ni validé ni enveloppé**. Comparer la valeur corrige le cas et préserve la
garantie : un signal et un computed portent le vrai symbole, donc restent protégés.

### Les clés : propres, énumérables, chaînes

Trois vecteurs que la baseline ouvre et que nous fermons :

- `for..in` remonte la chaîne de prototypes, donc une propriété héritée énumérable est
  enveloppée **et recopiée comme propriété propre** ;
- une pollution énumérable de `Object.prototype` atterrit sur **chaque modèle** du programme ;
- une pollution posée en **getter** fait `createModel` lever une `TypeError` en mode strict, et
  reste un no-op silencieux en mode sloppy.

Les méthodes de classe ne sont pas enveloppées, et cela ne change pas : les méthodes natives
sont non énumérables, donc absentes d'un parcours de clés énumérables comme d'un `for..in`.

### La descension est contrôlée par descripteur

La baseline **lit** `value[key]` pour choisir la branche, puis **écrit** dans le même slot.
Mélanger les deux sur un accesseur est incohérent par construction : un getter qui renvoie une
fonction provoque une `TypeError` « which has only a getter » en mode strict, et un no-op
silencieux en sloppy.

Nous consultons le descripteur **avant** de décider. Un accesseur en lecture n'est jamais écrit.
La garantie figée par la matrice — un getter est évalué une fois — reste tenue.

### Mémoïsation

Un cache faible fonction → wrapper. Trois défauts corrigés d'un coup : deux clés pointant la
même fonction ne donnent plus deux wrappers, un sous-arbre partagé n'est plus re-parcouru, et
une valeur déjà passée par `action` n'est plus re-enveloppée en couche supplémentaire.

Effet de bord volontaire : `model.a === model.b` devient vrai. Les actions deviennent des
valeurs référentiellement stables.

### Détection des fonctions asynchrones

Une fonction asynchrone est enveloppée sans avertissement, et `action` ne batch que son préfixe
synchrone. Un modèle avec une méthode `async` observe donc **deux drainages** au lieu d'un, et rien
ne le signale.

Nous **avertissons** au moment de l'enveloppement. Corriger — attendre la promesse avant de
fermer le batch — changerait le contrat synchrone de `action` et rendrait le drainage non
déterministe pour les observateurs. Avertir apprend sans casser.

## 14. `createModel` — le dispose

Le disposeur est un `action`. Donc il **batche** les écritures des cleanups, et les cleanups
s'exécutent hors de tout contexte de suivi. Un observateur voit `[0, 2]`, jamais l'état
intermédiaire `1`.

Il est posé **sans garde** dans la baseline, donc sans écraser un `Symbol.dispose` fourni par
l'utilisateur — silencieusement. **Garde ajoutée** : on ne l'écrase pas.

Si `Symbol.dispose` est absent du runtime, la baseline écrit une propriété **énumérable nommée
`"undefined"`**, et `using` devient un no-op silencieux qui fuit tous les effets. **Nous ne posons
rien du tout** : le modèle reste utilisable, son désarmement explicite reste possible, et `using`
est simplement indisponible sur ce runtime. C'est un écart assumé, car la clé littérale n'apporte
rien et coûte une fuite muette.

### La boucle

```text
si des effets sont possédés :
    pour chacun : dispose()
les effets possédés ← aucun
```

Un cleanup qui **lève** interrompt la boucle : les suivants ne sont jamais disposés. C'est
**figé par la matrice**, donc reproduit. La ligne d'effacement est dans un `finally` — garde
ajoutée — ce qui rend l'état prévisible sans changer l'observable.

L'idempotence a **deux couches** : l'explicite, qui lâche le tableau, et l'implicite, au niveau
de l'effet, dont chaque étape du dispose est rejouable sans effet. C'est la seconde qui fait
réellement le travail.

Un effet créé **pendant** le dispose n'est capturé nulle part : il tourne immédiatement, reste
abonné, et fuit. Le modèle ne le détiendra jamais. Ce n'est pas un défaut corrigible — la portée
est déjà refermée.

## 15. Écrire la source de vérité

`signals.ts` et `signals.test.ts` sont des sources **manuellement maintenues** et des
**artefacts installés**. Ils sont donc écrits pour être lus deux fois : par le mainteneur qui
les modifie, et par l'utilisateur qui les installe.

**Aucune contrainte d'installation ne s'applique aux commentaires.** Vérifié : avec
`registry:file`, le fichier installé est identique à la source, octet pour octet. Avec
`registry:lib`, seul le bloc JSDoc d'en-tête aurait été perdu. C'est une raison de plus pour
`registry:file`, et c'est pourquoi `docs/distribution.md` porte cette mesure.

### Deux formes, deux besoins

| Forme | Rôle |
|---|---|
| **JSDoc attachée à une déclaration** | Sert l'auto-complétion de l'utilisateur qui lit le fichier installé. Écrire chaque export public. |
| **Commentaire flottant** | Explique un choix qui ne se devine pas à la lecture. N'est justifié que là où la ligne suivante surprend. |

Un commentaire flottant qui répète le code est du bruit : il sera ignoré, donc il n'informe
personne.

### La langue

Les commentaires sont en **français**, comme `SPEC.md`, `PRD.md`, le `README.md` et les ADR.
Les identifiants, les mots-clés et les noms d'API restent en anglais par nécessité.

### La règle anti-bug

[ADR-0001](/docs/adr/0001-clone-exact-de-la-baseline.md) impose de reproduire la sémantique de la
baseline, quirks compris. Le code contient donc des expressions qui **ressemblent** à des bugs
et n'en sont pas :

```ts
// Pas une erreur : la baseline compare par identité stricte, donc NaN notifie.
// research/baseline-1.14.4.md#signal
if (value !== this._value) { … }
```

**Chaque ligne de ce genre porte un renvoi vers son entrée de matrice.** Sans cela, quelqu'un
finira par « corriger » la compatibilité en croyant améliorer le code — et cassera le
remplacement de `@preact/signals-core` par `signals.ts`, qui est le cas d'usage visé.

Le commentaire est court et double : il affirme que ce n'est pas un bug, et il donne où c'est
figé.

### Dans les scénarios

Le **nom** d'un scénario porte la traçabilité — il contient la référence du contrat. Un
commentaire n'explique que ce qui ne se devine pas : pourquoi un ordre de drainage est normatif,
pourquoi une valeur ne doit pas être observée.

## 16. Les écarts assumés



Cinq écarts avec l'architecture de la baseline : les quatre premiers sont couverts par
[ADR-0004 — Classes ES2020 plutôt que prototypes ES5](/docs/adr/0004-classes-es2020-plutot-que-prototypes-es5.md),
le cinquième par `SPEC.md` §15.2. [ADR-0005 — Les défauts non figés de `createModel` sont
corrigés](/docs/adr/0005-defauts-non-figes-de-createmodel.md) couvre les sept écarts de `createModel`
ci-dessous, qui sont d'une autre nature.

| Écart | Effet observable |
|---|---|
| Méthodes de prototype non énumérables | `for..in` sur un signal : 8 clés au lieu de 17. Sur un computed : 12 au lieu de 22. |
| `Object.keys(Computed.prototype)` | vide, au lieu de douze noms de champs |
| `Computed.prototype` sans état | plus d'empoisonnement global par une lecture `.value` sur le prototype |
| `Computed.prototype.constructor` | `Computed`, au lieu de `Signal` |
| La borne de drainage n'est pas figée à 102 | `SPEC.md` §15.2 |

Et les sept écarts de `createModel` listés dans `SPEC.md` §16.6, tous couverts par
[ADR-0005](/docs/adr/0005-defauts-non-figes-de-createmodel.md).

Aucun de ces écarts ne change le résultat d'un test de la matrice. Ils sont consignés dans
`SPEC.md` §21.2 et, pour `createModel`, dans `SPEC.md` §16.6.
