# La liste des dépendances reprend la géométrie de la baseline

La tête de `node._sources` désigne la source lue **en premier**, et le parcours se fait par `_next`
vers les plus récentes — exactement comme chez `@preact/signals-core`. Elle ne s'y apparentait plus.

## Considered Options

- **Garder la géométrie miroir** — refusée. `docs/architecture.md` §3 l'argumentait par « insertion
  en tête, `O(1)` », ce qui est vrai des deux côtés : l'argument ne distinguait rien. Elle a coûté
  quatre traversages faux, corrigés en `0d61427`, dont **un seul** trouvé par un test. Un parcours par
  `_prev` part de la tête, où il vaut `undefined`, et rend donc **un nœud au lieu d'une liste** — sans
  lever, ce qui produit une valeur périmée. Le pire mode de défaillance possible.
- **Le documenter comme une Divergence** — refusé. La matrice a observé le comportement, donc
  ADR-0001 impose de le reproduire. Ce n'était pas une divergence, c'était un écart, et le consigner
  dans `SPEC.md` §21 aurait déplacé le problème sans le résoudre.
- **Revenir à la géométrie de la baseline** — retenue. Les deux listes s'y comparent, le piège du
  `_prev` disparaît, et l'ordre de `unwatched` revient à ce que la matrice a observé.

## Règle opératoire

> La tête de `node._sources` est la source lue **en premier** ; `_next` est le seul sens qui remonte
> toute la liste. Un parcours par `_prev` rend **un nœud** — la tête — et c'est la faute la plus
> coûteuse du Cœur, parce qu'elle est muette.
>
> Même règle pour `signal._targets`, qui est toujours dans ce sens-là. Les deux listes partagent
> donc la même géométrie : insertion en tête, parcours à l'opposé de la tête.
>
> Toute affirmation de géométrie hors de ce document est un risque : si `docs/architecture.md` §3 la
> répète, elle la **cite**.

## Consequences

- **`unwatched` change d'ordre observable.** Les sources sont libérées dans l'ordre de lecture, comme
  la baseline : entrée 52 de la matrice, `["c:unwatched","a:unwatched","b:unwatched"]`. C'était
  l'inverse chez nous, et `SPEC.md:111` décrivait notre écart en le présentant comme le sien — la
  ligne est corrigée.
- **`disposeSelf` redevient un parcours simple.** La double passe qui descendait jusqu'au maillon
  `_prev` puis remontait par `_next` n'a plus de raison d'être.
- **Les deux implémentations sont enfin comparables**, sens de parcours compris. Les comparer avec des
  sens différents avait produit un faux diagnostic, et c'est ce qui a laissé passer l'écart.
- **`SPEC.md` §21 porte encore une ligne fausse**, et elle n'est pas corrigée ici : elle affirme que
  les internes de `Effect` et `Computed` « ne sont pas typés » alors qu'ils le sont en huit endroits.
  L'écart qu'elle cherche à décrire est autre chose — nous ne produisons aucun `.d.ts` alors que la
  baseline en publie un — et le trancher est une décision de distribution, pas de géométrie. Cela
  appartient à #30, et la ligne est signalée pour lui.
- **Le harnais différentiel ne voit pas ce genre d'écart** : `scripts/harnais.mjs` n'importe que la
  baseline et les scénarios, jamais `signals.ts`. Seul un scénario qui l'assert le voit, d'où le cas
  ajouté à `effect/watchers`, rejoué des deux côtés.

Voir [ADR-0001](./0001-clone-exact-de-la-baseline.md), dont cette décision est une application.
