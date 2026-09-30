# Stratégie de test de la parité

`SPEC.md` §19 exige que `signals.js` et `signals.min.js` se comportent comme `signals.ts`.
Ce document est la stratégie qui le prouve. Vérifiée avant d'être écrite.

## 1. Le principe : la parité, c'est la suite, exécutée ailleurs

Il n'y a pas de test de parité. Il y a **une seule table de scénarios**, exécutée quatre fois.

| Exécution | Cible | Rôle |
|---|---|---|
| Harnais différentiel | `@preact/signals-core@1.14.4` | l'oracle — fige les attentes |
| `node --test` | `signals.ts` | l'implémentation |
| `node --test` | `signals.js` | le build |
| `node --test` | `signals.min.js` | le minifié |

Les attentes sont les mêmes dans les quatre cas, donc « les trois cibles passent » signifie
« les trois cibles sont indiscernables de la baseline ». C'est exactement `SPEC.md` §19, sans
un test supplémentaire.

## 2. Ce que la parité attrape, gratuitement

Un renommage de propriétés par le minificateur casserait la garantie. Vérifié : avec
`--mangle-props='^_'`, la suite **échoue**. Aucun contrôle supplémentaire sur les noms n'est
donc nécessaire — la suite les couvre déjà, parce que les scénarios observent `Object.keys`.

De même pour `--keep-names` : sans lui, le nom du wrapper d'`action` devient la chaîne vide et
la suite échoue. Le contrat est protégé par la suite, pas par une assertion dédiée.

## 3. Le compte de tests — deux trous mesurés

Le code de sortie de `node --test` ne suffit pas. Deux cas sont **verts sans qu'un seul test
n'ait tourné** :

| Cas | `exit` | `tests` | `pass` |
|---|---|---|---|
| Un fichier de test vide | **0** | 1 | 1 |
| Un fichier entièrement ignoré | **0** | 1 | 0 |

Le premier parce que Node compte le *fichier* comme test ; le second parce que rien n'échoue.

La parité compte donc. Le rapport TAP expose `# tests`, `# pass`, `# fail` et `# skipped`, tous
lisibles par machine. L'assertion est :

```text
# pass     == nombre de scénarios de la table
# fail     == 0
# skipped  == 0
```

Le nombre de scénarios vient de la table elle-même, donc la comparaison est automatique et ne
peut pas dériver. Un build qui vide la table, ou qui ignore tout, échoue ici.

## 4. La forme des artefacts

Les artefacts générés sont hors du périmètre de couverture — `SPEC.md` §18.2 l'exclut, à
raison. Trois assertions bon marché les couvrent quand même :

1. **Les dix exports sont présents** sur les trois cibles. Un build qui produit un module
   partial échoue ici plutôt que dans un scénario, trois jobs plus tard.
2. **La taille minifiée est strictement inférieure** à la taille buildée. Sans cela, une
   étape de minification cassée produirait un fichier identique, et personne ne le verrait.
3. **Chaque module s'importe** et répond au `import` dynamique.

## 5. Zéro tolérance

Aucune liste de divergences acceptables entre les cibles.

La raison est structurelle : les scénarios n'assertent **jamais** une chaîne de message
(`SPEC.md` §15.4), donc le minifié n'a rien à perdre. Vérifié — la suite du minifié passe. Si
une divergence apparaît un jour, c'est un bug de build, et la bonne réponse est de le corriger,
pas de l'inscrire.

## 6. Ce que la parité ne prouve pas

- **Que le code mort n'est pas livré.** Une branche inatteignable est couverte par la
  couverture de la source, pas par la parité.
- **Que le minifié est plus rapide.** Aucun critère de performance n'est dans le contrat.
- **Que la couverture des artefacts est mesurée.** Elle ne l'est pas, et ne doit pas l'être :
  ce sont des dérivés de la source, dont la couverture est déjà imposée à cent pour cent.

## 7. Vérifié

| Vérification | Résultat |
|---|---|
| `node --test signals.test.ts` | passe |
| `node --test signals.test.js` | passe |
| `node --test signals.test.min.js` | passe |
| Le module minifié importé par le test minifié est distinct du module buildé | oui |
| `actionWrapper` conservé dans le minifié | oui |
| `--mangle-props` fait échouer la suite | oui |
| Fichier de test vide | `exit 0` — d'où le comptage |
| Fichier entièrement ignoré | `exit 0`, `pass 0` — d'où le comptage |
| Import cassé | `exit 1` |
| Un test en échec | `exit 1`, `# fail 1` |
