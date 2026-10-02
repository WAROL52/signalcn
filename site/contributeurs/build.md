# Chaîne de build et de minification

Spécification du pipeline qui produit les quatre artefacts générés à partir des deux
sources de vérité. Le **pourquoi** de chaque choix est dans
[ADR-0006 — `tsc` émet, esbuild minifie](/docs/adr/0006-tsc-emet-esbuild-minifie.md).

Deux commandes, dans cet ordre. Toutes deux sont reproductibles : deux exécutions
produisent des fichiers au condensat identique.

## 1. Pourquoi deux outils, et pas un

`signalcn` n'a qu'un seul fichier source sans import relatif, et un fichier de test avec un
import relatif. Cette différence est tout ce qui décide de l'outillage.

Le fichier de test importe son implémentation par `./signals.ts` — l'extension réelle, parce
que `signals.test.ts` doit s'exécuter chez l'utilisateur avec `node --test` et **sans aucun
outillage**. Node 24 exécute du TypeScript directement ; il ne sait pas deviner qu'un
`.js` manquant est un `.ts`.

À l'émission, ce `./signals.ts` doit devenir `./signals.js`, sinon le fichier installé
importerait un `.ts` absent. **Seul `tsc` sait faire cette réécriture**, via
`rewriteRelativeImportExtensions`.

`esbuild` ne la fait pas. Il sait stripper les types — donc il builderait `signals.ts` sans
problème — mais son `signals.test.js` garderait `./signals.ts`. Utiliser esbuild pour les
deux produirait un artefact cassé.

La voie inverse, écrire `./signals.js` dans la source, est **morte** : `allowImportingTsExtensions`
exige `noEmit`, `emitDeclarationOnly` ou `rewriteRelativeImportExtensions`, et Node ne résout
pas un `.js` vers un `.ts` absent.

## 2. Le build

```jsonc
// registry/default/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "types": ["node"]
  },
  "include": ["signals.ts", "signals.test.ts"]
}
```

```sh
tsc -p registry/default/tsconfig.json
```

Pas de `outDir` : la sortie atterrit à côté des sources, dans `registry/default/`, ce qui est
exactement là où le registry pointe.

Produit `signals.js` et `signals.test.js`, en modules ES, avec l'extension réécrite.

## 3. La minification

```sh
esbuild ./signals.js      --minify --keep-names --outfile=./signals.min.js
esbuild ./signals.test.js --minify --keep-names --outfile=./signals.test.min.js
```

### `--keep-names` n'est pas optionnel

La matrice de conformité a figé le nom du wrapper d'`action` : il vaut `"actionWrapper"`.
Mesuré, sans ce drapeau : le nom devient la chaîne vide, et le nommage de fonction disparaît
entièrement du fichier minifié.

Le coût est réel — environ trente pour cent de taille minifiée en plus sur le cas d'essai — et
il est assumé : le nom fait partie du contrat, donc la taille paie.

### Le test minifié vise le runtime minifié

C'est une **correction** du pipeline littéral de `SPEC.md` §17, qui enchaîne
`signals.test.ts → signals.test.js → signals.test.min.js` sans réécriture de l'import. Pris au
mot, le test minifié continuerait de viser `./signals.js`, et le runtime minifié — un artefact
que l'utilisateur installe — ne serait couvert que par des smoke tests.

Une réécriture du specifier, après minification :

```sh
sed -i 's|"\./signals\.js"|"./signals.min.js"|' registry/default/signals.test.min.js
```

Exacte et totale : il n'existe que deux fichiers, et un seul specifier à réécrire. Vérifié que
le module minifié importé est bien **distinct** du module non minifié — le test porte donc
réellement sur l'artefact distribué, pas sur son jumeau.

## 4. Ce que la chaîne ne fait pas

- **Aucun sourcemap.** Ce n'est pas un item du registry, donc il ne peut pas être distribué.
  Le débogage se fait sur la source, qui est elle-même distribuée.
- **Aucun bundle.** Un fichier, donc rien à relier. `esbuild` est utilisé sans `--bundle`, et
  toute importation de dépendance dans le cœur doit faire échouer le build plutôt que produire
  un bundle qui la contiendrait.
- **Aucune minification des messages de diagnostic.** `SPEC.md` §15.4 ne fige jamais une
  chaîne de message, précisément parce que la minification la réécrit.

## 5. Le pipeline complet

```sh
npm run build     # tsc, puis esbuild ×2, puis la réécriture du specifier
```

C'est l'unique commande. La CI échoue si elle modifie un artefact committé : les artefacts sont
versionnés, donc un diff vide **est** le test.

## 6. Vérifié

Le pipeline a été exécuté de bout en bout avant d'être écrit ici. Constats :

| Vérification | Résultat |
|---|---|
| `node --test signals.test.ts` sur la source | passe |
| `node --test signals.test.js` sur le build | passe |
| `node --test signals.test.min.js` sur le minifié | passe |
| Import du runtime minifié | ESM valide, `actionWrapper` conservé |
| Le module minifié est distinct du module build | oui |
| Reproductibilité | deux exécutions, condensats identiques |
