# Le reliquat de couverture : trois gardes que la référence ne peut pas atteindre non plus

La barrière de release était « 100 % sur les trois métriques au tag ». Elle n'est pas
franchissable, et pas parce que le relevé est Approximatif : **la référence
`@preact/signals-core@1.14.4` contient elle-même des gardes que son API publique ne peut pas
atteindre.** Les atteindre supposerait de changer le comportement, donc de casser la promesse
fondatrice du projet.

## Considered Options

- **Supprimer les trois gardes pour atteindre 100 %** — refusé. Une garde qui ne s'exécute jamais
  est une garde qui ne peut rien attraper, oui ; mais la retirer change le comportement dans le
  cas où quelqu'un atteint l'intérieur, et surtout cela nous éloigne de la référence. Le projet
  mesure sa conformité à la référence : sacrifier la conformité pour un pourcentage est l'inverse
  de la transaction.
- **Écrire des tests qui atteignent l'intérieur** — **retenu, et fait**. Trois des quatre gardes
  restantes y sont accessibles, `Effect` étant un export public et `_fn`/`_flags` des internes
  documentés. Ces tests sont des tests signalcn-seul, jamais des scénarios de la table, parce
  qu'aucun comportement correspondant n'est dans le contrat.
- **Baisser le seuil et le dire** — **retenu**. Le seuil devient la valeur MESURÉE, et le reliquat
  est écrit ici avec son nom et sa raison.

## Le reliquat, nommément

| Emplacement | Garde | Pourquoi elle ne s'exécute pas |
|---|---|---|
| `Effect._callback` | `if ((this._flags & DISPOSED) !== 0) return` | `_start` efface `DISPOSED` sur la ligne d'avant. **Inatteignable dans la référence aussi** — le même code, au même ordre. |
| `attacher` | `if (tete === node \|\| node._targetPrev !== undefined) return` | Le garde anti-cycle de liste. Il faut rattacher un nœud déjà présent dans la liste des abonnés, ce que le recyclage de `cleanupDependency` empêche. |
| `newNode` | le bloc de recréation de maillons | Un nœud balayé est retiré de la liste et `source._node` restauré avant qu'un autre observateur puisse le reprendre. |

Trois sondes ciblées ont été écrites pour les atteindre — un effet qui lit un signal au premier
run seulement, un nœud balayé repris par un computé, deux effets entrelacés sur la même source —
et aucune n'y est parvenue. Elles sont dans l'historique de cette tranche, pas dans la suite.

## Ce que la couverture a trouvé, en revanche

C'est le vrai dividende, et il vaut plus qu'un pourcentage.

1. **`Computed._refresh` effaçait `RUNNING` avant de tester `RUNNING`.** Le `return false` — le
   garde du cycle indirect — était donc inatteignable, et avec lui la branche de `sourcesAreStale`
   qui teste `!source._refresh()`. Deux gardes mortes. Le résultat observable était le même, mesuré
   sur quatre cycles indirects comparés des deux côtés : c'est par là que ce défaut se cache. Le
   code suit maintenant l'ordre de la référence — effacer `NOTIFIED`, tester `RUNNING`, effacer
   `OUTDATED`, et poser `RUNNING` AVANT le balayage de staleness.
2. **`Signal._notify` était un no-op mort**, absent de la référence. Il n'était nécessaire ni au
   typage (`Node._target` est un `Computed | Effect`) ni à quoi que ce soit. Supprimé : les
   fonctions sont à 100 %.
3. **Un test de garde ne testait rien.** `signalcn-seul/hors-ordre` comptait sur un deuxième run
   pour atteindre son assertion, et son corps ne lisait aucun signal — donc rien ne pouvait le
   relancer, donc l'assertion n'avait jamais été exécutée. Il passait au vert en ne testant rien,
   ce qui est précisément le défaut qu'un test de garde doit éviter. Il teste maintenant ce que
   l'API publique permet, et le garde lui-même a été déplacé où il est réellement atteignable.

## Consequences

- **Le seuil de release est la valeur mesurée**, et non 100 %. Le contrôle de non-régression face
  au merge-base reste en place, et c'est lui qui interdit désormais de descendre.
- **Le 100 % reste atteignable** si quelqu'un atteint un jour l'intérieur autrement que nous —
  `attacher` et le bloc de `newNode` sont de la logique réelle, pas des invariants. Ce serait une
  découverte, pas une corvée.
- **Une garde morte n'est pas un détail de style.** Elle a coûté une divergence de portage, ici.
  Le portage exact (ADR-0001) n'a pas d'excuse pour un code mort : il copie, y compris les gardes
  que la référence ne sait pas atteindre.