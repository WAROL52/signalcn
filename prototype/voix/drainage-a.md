# Le drainage du batch

> **Variante A — entoncement.** L'algorithme d'abord, en entier, dans une seule liste. Sa
> justification ensuite. Le détail à la fin, derrière un marqueur.

Quand vous écrivez plusieurs signaux dans un `batch`, le moteur ne les traite pas une par une : il
les regroupe, puis il exécute les effets qu'elles ont réveillés **une fois**, dans l'ordre où ils
ont été empilés. C'est ce passage qu'on appelle le **drainage**.

## L'algorithme, en entier

Il tient dans une seule liste, et il n'y a rien d'autre à savoir pour l'utiliser :

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

Trois variables de module suffisent à l'exécuter : `batchDepth` (la profondeur d'imbrication),
`batchIteration` (le compteur de générations) et `batchedEffect` (la tête de pile).

## Ce que ça veut dire

**La pile est vidée *avant* d'être parcourue.** C'est le mot important de la page. Aucune chaîne
n'est donc atteignable pendant le drainage : si un effet écrit un signal en s'exécutant, cet effet
arrive sur une pile **vide**, donc dans la génération suivante — et pas au milieu de celle qui est
en cours. Sans cette ligne, un effet qui écrit peut être exécuté dans la génération qu'il a
déclenchée, et le batch ne garantit plus rien.

**Un drainage est en largeur de notification.** Une génération = tout ce que la même écriture a
réveillé, puis tout ce que ces effets ont réveillé. Le `batchIteration` compte ces générations, et
il est remis à zéro à la fin du drain.

**Le drapeau `NOTIFIED` est effacé avant l'invocation, jamais après.** Il déduplique donc dans une
génération, pas dans un drainage.

::: tip Vous pouvez sauter ici
Tout ce qui suit explique des choix, il n'explique pas le fonctionnement. Un lecteur qui veut
utiliser le batch s'arrête ici sans rien manquer.

- **Pourquoi LIFO** — la liste chaînée *est* la pile, via `_nextBatchedEffect` ; aucune allocation.
  Le LIFO n'est pas un choix séparé, c'est la conséquence de l'insertion en tête. Son effet
  pratique est la **localité** : si un effet réveille deux aval, le plus proche s'exécute juste après
  son producteur.
- **Pourquoi la chaîne est aussi défaite nœud par nœud** — c'est la seconde barrière. Un effet
  disposé pendant le drainage ne doit pas ressortir au tour suivant.
- **Les erreurs** — le drainage n'a pas de `try`/`finally`. Il accumule explicitement : la première
  erreur gagne, les suivantes sont avalées, le drain se termine, l'état global est intégralement
  restauré, et **ensuite** l'erreur est levée. Un batch qui avorterait son drain laisserait des
  effets non exécutés et des versions incohérentes.
- **La borne** — le setter d'un signal arme un compteur de drainages. Ce n'est pas une
  reconnaissance de cycle, c'est une limite de débit, et une cascade légitime assez longue peut la
  toucher.
:::

La version longue et annotée de tout ceci est `architecture.md` §5.