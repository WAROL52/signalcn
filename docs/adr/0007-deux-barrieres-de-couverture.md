# Deux barrières de couverture : non-régression en PR, 100 % en release

La couverture est une barrière bloquante à 100 % sur les trois métriques **au moment de la release seulement**. Sur une pull request, la barrière est la non-régression par rapport au merge-base, et la base est **recalculée** dans un second worktree plutôt que stockée.

## Considered Options

- **100 % dès la première pull request** — refusé. L'implémentation se fait en tranches TDD, donc une tranche qui n'implémente que `signal()` laisserait tout le reste à zéro. Une porte impossible à franchir éteint les petits pas, ce qui est exactement l'inverse de ce qu'un projet TDD cherche à obtenir.
- **Aucun garde avant la release** — refusé. Le 100 % n'est alors atteint qu'à l'instant où l'on n'a plus le temps de le corriger, et une régression de couverture peut se loger entre deux tags sans que rien ne bronche.
- **La base stockée dans un fichier committé** — refusé, c'est le vrai piège. Une porte « courant ≥ stocké » se fore en abaissant la valeur stockée dans la même pull request qui échoue. La barrière ne repose plus alors que sur la relecture du diff, ce qui est un être humain, pas un outillage.

## Consequences

- **La non-régression est vérifiable seulement par le calcul.** Le runner natif n'a aucune notion de base, et V8 ne produit que des ranges bruts — pas des pourcentages. Les trois pourcentages sont donc extraits de la ligne `all files` du rapport, dans un `git worktree` du merge-base.
- **Le second relevé ne coûte presque rien, grâce à un arbitrage ancien.** La suite n'a aucune dépendance — c'est le choix de `node:test` sans outillage, consigné dans [ADR-0002](./0002-node-test-sans-dependance-de-test.md) — donc le worktree n'a rien à installer. Un projet avec `pnpm install` dans la base verrait ici le vrai coût de cette porte.
- **Le code mort est invisible par construction, donc gardé séparément.** Le runner ne mesure que ce qui est chargé : un fichier jamais importé n'apparaît nulle part, ni à zéro pour cent ni en avertissement. La garde compare les fichiers source sur disque aux scripts vus par `NODE_V8_COVERAGE`. Elle ne peut pas être fondue dans le seuil, car le seuil ne voit pas ce qui n'existe pas dans son rapport.
- **Les exclusions sont interdites par une recherche de drapeau.** `--test-coverage-exclude` est invisible par construction : le fichier sort du rapport et le seuil passe. Il n'y a pas de code tiers ici à exclure — la couverture porte sur une base entièrement écrite par ce projet — donc l'interdiction ne coûte rien.
- **Un seul concept à retenir pour le mainteneur** : la couverture ne doit jamais baisser. Le 100 % est l'état final, pas l'état de chaque commit.

## Suite

Ce qu'est concrètement une non-régression a été tranché plus tard, et contre la forme que ce document
laisse croire : elle compare le **reliquat**, pas le ratio, parce qu'un ratio se prête mal à une
comparaison entre deux commits. Voir [ADR-0012](./0012-la-non-regression-compare-le-reliquat.md).
