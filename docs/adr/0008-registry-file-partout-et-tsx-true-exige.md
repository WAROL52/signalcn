# `registry:file` partout, et `tsx: true` exigé du consommateur

Les six items utilisent le type de fichier `registry:file` et une cible `~/<nom>`. Rien n'est transpilé à l'installation. Les items TypeScript exigent `"tsx": true` dans le `components.json` du consommateur ; un projet `tsx: false` qui installe l'item TypeScript obtient un fichier qui échoue bruyamment.

## Considered Options

- **`registry:lib` pour les items TypeScript** — refusé, et c'est la recommandation naturelle, celle de la recherche initiale. Elle ne fonctionne que pour un projet `tsx: false`, où elle transpile `.ts` vers `.js` correctement. Or dans ce cas les deux items — `signals` depuis `signals.ts`, et `signals-js` depuis `signals.js` — convergent vers **le même nom de fichier** et s'écrasent. Le modèle « six items indépendants » devient faux.
- **`target` qui choisit l'extension** — refusé parce que mesuré faux. Sur les seize combinaisons de `tsx`, de type de fichier, d'extension source et d'extension cible, **c'est `tsx` qui décide**, jamais la cible. Avec `tsx: true` la cible est respectée à la lettre ; avec `tsx: false` l'extension est imposée à `.js`.
- **Exiger `tsx: true` ou renoncer aux items TypeScript** — exigence retenue. Renoncer aurait supprimé la distribution TypeScript, qui est la raison d'être du projet : `site/contributeurs/PRD.md` §3 fait de la distribution de code source le cœur du modèle.
- **Rendre l'échec silencieux** — refusé. Un projet `tsx: false` qui installe l'item TypeScript obtient un `SyntaxError` à la première exécution. C'est bruyant et c'est voulu : un fichier cassé se voit.

## Consequences

- **La recherche initiale s'est trompée, et sur le point central.** Sa section 11 proposait `registry:lib` pour le TypeScript, déduite du cas `tsx: false` seulement. Le `registry.json` proposé **ne doit pas être appliqué tel quel** ; l'annotation a été ajoutée dans `research/shadcn-registry.md` pour que personne ne le reprenne.
- **Une contrainte de source de vérité, et la forme exacte qui y répond.** La transpilation de la CLI refuse `declare`. Comme `brand` doit rester sur le prototype — la matrice le fige, et `Object.keys` doit rester à huit clés — il faut un moyen de le typer **sans** champ dans le corps de classe.

  Une assertion d'assignation définie, `brand!: typeof BRAND_SYMBOL`, **ne convient pas**, et l'erreur est mesurée : le champ crée une propriété propre `undefined` sur chaque instance. Résultat, `signal(1).brand` vaut `undefined` — le prototype est masqué — et `Object.keys` passe de huit clés à neuf. Deux comportements figés cassés à la fois.

  La forme correcte est une **fusion de déclaration** sous le même nom que la classe :

  ```ts
  export class Signal<T> { /* brand absent du corps */ }
  export interface Signal<T> { brand: typeof BRAND_SYMBOL }
  ```

  Typecheck à zéro erreur, `brand` lisible, `Object.keys` à huit clés, et le tout survit à la vraie installation par la CLI — vérifié. `implements` ne convient pas : TypeScript exige que la classe déclare le membre pour le satisfaire.
- **Le README montre un import faux.** `@/lib/signals` suppose un `aliases.lib` et un `tsconfig` avec `paths`. Le chemin d'import est `./signals.js`, relatif, sans configuration.
- **L'avantage du chemin relatif vient d'un fait mesuré** : le CLI ne réécrit aucune importation, octet pour octet. Un chemin relatif survit donc à l'installation tant que les deux fichiers atterrissent dans le même répertoire, ce que `~/` garantit.
- **La porte d'installation de la CI est inevitable.** La validation de schéma ne prouve rien : un nom non qualifié installe silencieusement l'homonyme d'un autre registre, et un mauvais type de fichier produit un fichier non exécutable. Aucun des deux n'échoue à la validation. Le coût est le téléchargement de la CLI.
