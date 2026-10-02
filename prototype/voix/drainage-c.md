# Le drainage du batch

> **Variante C — fiche.** Aucune narration. Le détail est dès la première ligne, mais découpé en
> unités courtes : une idée par section, et une table de lecture en tête qui dit où s'arrêter. Il n'y
> a pas de marqueur « vous pouvez sauter ici » dans le texte — la promesse est faite une fois, en
> tête.

## Où s'arrêter

| Vous voulez | Lire |
|---|---|
| écrire du code correct avec un `batch` | §2 |
| comprendre l'ordre d'exécution | §3, §4 |
| comprendre l'implémentation | tout, §1 à §7 |
| modifier le moteur | §1 à §7, plus `architecture.md` §5 |

Cette page est une **référence**, pas un tutoriel. Elle n'explique pas d'où vient le drainage.

## 1. Variables

```text
batchDepth        profondeur d'imbrication
batchIteration    compteur de générations de notification
batchedEffect     tête de pile
```

## 2. Contrat

Un `batch` regroupe les écritures ; à sa sortie, les effets réveillés sont exécutés **une fois**,
dans l'ordre d'empilement. L'état du graphe est intégralement restauré avant que la première
erreur ne soit levée.

## 3. Ordre : LIFO

La sortie suit l'ordre inverse de l'empilement.

**Mécanisme.** `batchedEffect` est à la fois tête de pile et tête de liste chaînée, via
`_nextBatchedEffect`. Insertion en tête, sortie en LIFO. Aucune allocation.

**Effet pratique.** Localité : si un effet réveille deux aval, le plus proche s'exécute juste après
son producteur.

## 4. Générations

Un drainage est en **largeur de notification** : une génération = tout ce que la même écriture a
réveillé, puis tout ce que ces effets ont réveillé. `batchIteration` compte ces générations et
revient à zéro à la fin du drain.

## 5. L'algorithme

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

## 6. Deux barrières

**Le détachement.** `.batchedEffect` est vidé **avant** le parcours. Aucune chaîne n'est donc
atteignable pendant le drainage : une écriture faite par un effet empile sur une pile vide, donc
dans la génération suivante.

**Le drapeau `NOTIFIED`.** Effacé **avant** l'invocation, jamais après — il déduplique dans une
génération, pas dans un drainage.

**L'unlinking.** La chaîne est en outre défaite nœud par nœud au fil du parcours : un effet disposé
pendant le drainage ne ressort pas au tour suivant.

## 7. Erreurs

Pas de `try`/`finally`. La première erreur gagne, les suivantes sont avalées, le drain se termine,
l'état global est intégralement restauré, et **ensuite** l'erreur est levée.

**Pourquoi pas de `finally` en sortie d'exception.** Un batch qui avorterait son drain laisserait des
effets non exécutés et des versions incohérentes dans le graphe.

## Références

- `architecture.md` §5 — la version longue et annotée.
- `architecture.md` §7 — la borne de drainage, mécanisme distinct de tout ce qui précède.