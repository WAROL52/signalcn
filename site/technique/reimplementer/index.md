# Le chapitre de reconstruction

Le moteur se relit comme on le réécrirait. Chaque étape rejoue une règle du mécanisme avec
code et journal, et dit la page de la norme qui la porte. L'ordre ci-dessous est celui de la
réécriture, et il ne vit nulle part ailleurs.

1. [la cellule et le nœud](./la-cellule) — ce qui décide qu'une écriture se tait, et quelle
   cible l'entend
2. [la dépendance](./la-dependance) — la collecte des dépendances du calcul courant, l'abandon,
   et la relecture qui ranime
3. [l'invalidation](./l-invalidation) — les drapeaux, l'effacement avant l'exécution, et la
   déduplication dans une génération
4. [le computé](./le-compute) — le cache, la péremption, et le résultat identique qui se tait
5. [l'effet et le drainage](./effet-et-drainage) — l'ordre inversé dans le batch, l'ordre de
   création sur un même signal, et la ré-exécution dans le même drainage coupée par l'identité
6. le batch
7. le cycle et la borne
8. `untracked`
9. `action`
10. la portée de capture et `createModel`

Chaque étape se rejoue de l'extérieur : aucun bloc de code n'entre dans le paquet, aucun
interne n'y est cité par son nom minifié. Les reconstitutions vivent dans la suite
`signalcn-seul` du registre, citées par des entrées de matrice existantes, et le harnais les
rejoue contre le paquet de référence.
