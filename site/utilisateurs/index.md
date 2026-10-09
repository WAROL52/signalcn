# Utilisateurs

Installer la bibliothèque, écrire le premier programme, migrer depuis Preact, vérifier
l'artefact, et connaître les surprises. Le parcours suit cet ordre :

1. [`distribution.md`](./distribution.md) — installer : où atterrit l'artefact, les deux
   exigences, et ce que l'installation ne garantit pas.
2. [`premier-effet.md`](./premier-effet.md) — le premier programme qui marche : `signal`,
   `computed`, `effect`, `dispose()`.
3. [`migrer-depuis-preact.md`](./migrer-depuis-preact.md) — ce qui change dans du code écrit
   contre la baseline, et quoi relire.
4. [`verifier-artefact-installe.md`](./verifier-artefact-installe.md) — faire tourner la suite
   installée, et ne pas s'y fier plus qu'il ne faut.
5. [`batch-et-surprises.md`](./batch-et-surprises.md) — batchs, cascades, `action`, et les
   surprises à l'exécution.

Deux documents restent des références, et ne sont pas dans le parcours : le [`README.md`](/README.md), qui est la seule déclaration de surface, et la section « Différences connues » qu'il porte — c'est elle que la fiche de migration ne répète pas, et vers laquelle elle renvoie. La stratégie de parité est devenue un document interne, dans [`site/contributeurs/parity.md`](../contributeurs/parity.md).

`README.md` reste à la racine du dépôt : GitHub et npm le rendent, et c'est le premier obstacle d'un parcours de migration.