# Zéro-dépendance runtime — comment on le prouve

`PRD.md` §9 liste « zéro-dépendance runtime est vérifiée » parmi les critères de succès.
Rien dans le projet ne le vérifiait. Ce document est ce contrôle : deux passes, deux angles
morts différents, exécutées à chaque pull request.

## 1. La règle qui fonde la liste

> Le cœur ne sort pas de lui-même, et ne lit ni l'horloge ni l'aléa.

Ce n'est pas un inventaire : c'est **dérivé de la baseline**. `@preact/signals-core@1.14.4`
n'utilise aucun global, aucune horloge, aucun générateur aléatoire, et aucun primitives
asynchrone — vérifié sur les 1138 lignes de `src/index.ts`. Le seul `self` du fichier est le
mot anglais « itself » dans un commentaire.

Deux exigences distinctes, une seule liste :

| Préoccupation | Motifs |
|---|---|
| **Sortir du cœur** | `import`, `import(`, `require(`, framework, DOM, `fetch(`, `XMLHttpRequest`, `setTimeout`, `queueMicrotask`, `requestAnimationFrame`, `Promise`, `eval(`, `new Function` |
| **Ne pas être déterministe** | `Date`, `performance`, `Math.random`, `crypto` |

## 2. Passe 1 — le metafile, pour la structure

```sh
esbuild ./registry/default/signals.ts --bundle --format=esm --target=es2020 \
  --outfile=/dev/null --metafile=meta.json
```

Puis : `metafile.inputs` ne doit contenir **qu'un seul fichier**, `registry/default/signals.ts`.
Un import, qu'il soit relatif ou de paquet, ajoute son fichier à cette liste — donc la porte
ferme sans avoir à distinguer les deux cas.

**Vérifié** : un fichier qui importe `leftpad` produit `["node_modules/leftpad/index.js",
"registry/default/signals.ts"]`. Un fichier propre produit `["registry/default/signals.ts"]`.

Le `--bundle` est ici un **outil de mesure**, pas l'outillage de build. Le build n'en bundle
pas — voir [`docs/build.md`](./build.md) — donc un import ajouté par mégarde casse déjà
l'artefact. Cette
passe ne sert qu'à lire une liste de fichiers.

En complément, une seconde invocation avec `--packages=external` laisse les imports dans la
sortie, et `outputs.imports` doit être vide. Même conclusion par un autre chemin, pour le cas
où les métadonnées de build auraient été désactivées.

## 3. Passe 2 — la recherche, pour les constructions

Un grep à chaîne fixe sur **`registry/default/signals.min.js`**, l'artefact que l'utilisateur
installe, et non sur la source.

**Pourquoi le minifié.** Le minificateur renomme les variables locales mais **ni les globaux ni
les fonctions natives**. Mesuré : les onze motifs sont détectés dans `signals.min.js`, et un
fichier propre n'en déclenche aucun. La garantie porte donc sur le fichier distribué, et le
diagnostic pointe dans une sortie d'une seule ligne.

**Le rapport nomme le symbole.** Un échec qui dit seulement « interdit détecté » est une porte
qu'on contourne par lassitude.

## 4. Ce que le contrôle ne prouve pas

- **Qu'aucune dépendance ne sera chargée dynamiquement.** `import(chaîne)` est dans la liste
  des interdits, donc le canal est fermé ; un cas construit à l'exécution par une chaîne
  concaténée ne serait pas vu, et l'interdiction de `eval` et `new Function` est précisément
  ce qui rend ce cas inatteignable.
- **Que le cœur est correct.** C'est le rôle du harnais différentiel et de la couverture, pas
  de ce contrôle.
- **Que le fichier de test est sans dépendance.** Il peut importer `node:test` et
  `node:assert` — c'est le seul endroit où c'est permis, et il n'est pas un artefact runtime.

## 5. La porte

Elle s'exécute à chaque pull request, pour deux raisons : elle coûte quelques secondes, et une
dépendance ajoutée par mégarde est aussi grave qu'une régression de couverture.

Elle porte sur le **produit distribué**, jamais sur le dépôt. Le dépôt a une devDependency, la
baseline, et un `node_modules` de plusieurs centaines de mégaoctets : un contrôle qui viserait
le dépôt trouverait toujours des dépendances, et ne prouverait rien.

## 6. Vérifié

Le contrôle a été exécuté avant d'être documenté, sur un fichier contenant les onze motifs et
sur un fichier propre :

| | Fichier piégé | Fichier propre |
|---|---|---|
| Motifs détectés | **11 / 11** | 0 / 11 |
| Faux positifs | — | **aucun** |
| Fichiers listés par le metafile | 2 | 1 |
