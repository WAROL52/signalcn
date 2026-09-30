# `tsc` émet, esbuild minifie

Le build est fait par `tsc` avec `rewriteRelativeImportExtensions`, la minification par `esbuild --minify --keep-names`. Deux outils, deux étapes, une commande. Le test minifié est reconfiguré pour viser le runtime minifié.

## Considered Options

- **esbuild pour tout** — refusé, et c'est la tentation permanente. esbuild fait le build *et* la minification, alors pourquoi deux outils ? Parce qu'il ne réécrit pas les imports relatifs : son `signals.test.js` garderait `./signals.ts`, et l'artefact installé importerait un fichier absent. Le build du runtime seul fonctionnerait, ce qui rend le défaut **partiel** et donc facile à manquer.
- **Écrire `./signals.js` dans la source, pour que personne n'ait à réécrire** — refusé. `allowImportingTsExtensions` exige `noEmit`, `emitDeclarationOnly` ou `rewriteRelativeImportExtensions`, et Node 24 ne résout pas un `.js` vers un `.ts` absent. La voie est fermée, pas coûteuse.
- **terser pour la minification** — refusé. Plus lent, sans capacité de strip de types, et le build est déjà fait par `tsc`.
- **Le pipeline littéral de `SPEC.md`, où le test minifié vise le runtime non minifié** — refusé. Le runtime minifié est un artefact distribué ; le tester par smoke tests seulement laisserait le sixth item du registry avec une couverture anémique.

## Consequences

- **Le test distribué s'exécute chez l'utilisateur avec `node --test`, sans outillage.** C'est la raison d'être de `rewriteRelativeImportExtensions` : écrire l'extension réelle dans la source est la seule façon que `signals.test.ts` s'exécute sans transpilation.
- **`--keep-names` est obligatoire.** Mesuré : sans lui, le nom du wrapper d'`action` devient la chaîne vide — un comportement que la matrice de conformité a figé. Le coût est d'environ trente pour cent de taille minifiée en plus, et il est assumé : le nom fait partie du contrat.
- **Une réécriture de specifier après minification.** Elle est exacte et totale, parce qu'il n'existe que deux fichiers et un seul specifier à réécrire. Vérifié que le module importé par le test minifié est bien distinct du module non minifié, donc le test porte sur le bon artefact.
- **Aucun sourcemap.** Ce n'est pas un item du registry, donc il ne peut pas être distribué.
- **Ajouter un import au cœur doit faire échouer le build**, pas produire un bundle qui le contiendrait. `esbuild` est utilisé sans `--bundle` exprès, et le contrôle de zéro-dépendance runtime s'appuie dessus.
- Quelqu'un tentera un jour de simplifier l'outillage à une seule commande `esbuild`. C'est le piège que cet ADR existe pour empêcher.
