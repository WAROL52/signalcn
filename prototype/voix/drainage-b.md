# Le drainage du batch

> **Variante B — parcours.** On part du problème qu'un lecteur a réellement, on lui donne une
> intuition utilisable, et on ne montre le mécanisme qu'ensuite. Le marqueur de saut arrive **avant**
> l'algorithme.

## Le problème

Vous écrivez deux signaux dans un `batch`. Chacun réveille des effets. exécutés immédiatement,
ces effets lireaient un graphe à moitié changé : le premier voit la nouvelle valeur de `a` et
l'ancienne de `b`.

Alors on diffère. On empile les effets qu'on a réveillés, on laisse le programme continuer, et à la
sortie du `batch` on les exécute d'un coup. Le graphe est alors dans son état final. Ce coup de
pied s'appelle le **drainage**.

La question que ce nom cache : **dans quel ordre ?**

## L'intuition, utilisable telle quelle

Une pile. Les effets sont empilés au fil des écritures, et le drainage les dépile : celui qui a été
réveillé en premier part en premier.

C'est tout ce qu'il faut savoir pour écrire du code correct avec un `batch`. Le reste de cette page
explique pourquoi le moteur fait exactement cela — et il y a une raison qui n'est pas « par
habitude ».

::: warning Vous pouvez sauter ici
Si vous savez déjà qu'un `batch` regroupe les écritures, tout ce qui suit est une justification. Il
n'y a **aucune consequence pratique** pour votre code : rien de ce qui est écrit plus bas ne
change ce que vous devez écrire.

Passer à [le mécanisme](#le-mecanisme), ou à `architecture.md` §5, si vous préférez la version
annotée.
:::

## Le mécanisme

Trois variables de module, et une liste :

```text
batchDepth        profondeur d'imbrication
batchIteration    compteur de générations de notification
batchedEffect     tête de pile
```

`batchedEffect` est **à la fois** tête de pile et tête de liste chaînée, grâce au champ
`_nextBatchedEffect` d'un effet. La liste chaînée *est* la pile : aucune allocation. Et comme on
insère en tête, on sort en LIFO — donc dans l'ordre inverse de l'empilement. Le LIFO n'est pas un
choix séparé, c'est la conséquence mécanique de l'insertion en tête.

Son effet pratique est la **localité** : si un effet réveille deux aval, le plus proche s'exécute
juste après son producteur, sans attendre la génération suivante.

Et voici le drainage :

```text
faire :
  chaîne ← .batchedEffect
  .batchedEffect ← vide                    ← LE DÉTACHEMENT
  batchIteration ← batchIteration + 1
  pour chaque effet de la chaîne, en la défaisant nœud par nœud :
      effacer NOTIFIED                    ← AVANT d'exécuter
      si non disposé ET dépendances périmées :
          exécuter, en mémorisant la première erreur sans l'interrompre
remettre batchIteration à zéro
lever la première erreur, s'il y en a une
```

Le **détachement** est la ligne qui porte tout le reste. La pile est vidée *avant* d'être parcourue,
donc aucune chaîne n'est atteignable pendant que le drainage tourne. Un effet qui écrit un signal en
s'exécutant trouve une pile vide : il appartient à la génération suivante. La chaîne est en outre
défaite nœud par nœud au fil du parcours, ce qui est la seconde barrière.

Le drapeau `NOTIFIED`, lui, est effacé **avant** l'invocation et jamais après : il déduplique dans
une génération, pas dans un drainage. Et le drain est en **largeur de notification** — une génération
= tout ce que la même écriture a réveillé, puis tout ce que ces effets ont réveillé.

## Et quand un effet lève

Le drainage n'a pas de `try`/`finally`. Il accumule explicitement : la première erreur gagne, les
suivantes sont avalées, le drain se termine, l'état global est intégralement restauré, et **ensuite**
l'erreur est levée.

C'est délibéré. Un batch qui avorterait son drain laisserait des effets non exécutés et des versions
incohérentes dans le graphe — pire que l'erreur qu'il cherchait à propager.