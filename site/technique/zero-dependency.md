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
| **Sortir du cœur** | `import`, `import(`, `require(`, `window`, `document`, `self`, `fetch(`, `XMLHttpRequest`, `setTimeout`, `queueMicrotask`, `requestAnimationFrame`, `Promise`, `eval(`, `new Function` |
| **Ne pas être déterministe** | `Date`, `performance`, `Math.random`, `crypto` |

La liste compte **18 motifs**. Elle est **lue** par la porte, jamais recopiée : ce tableau est la
source, et une liste écrite deux fois dérive sans bruit.

Trois noms remplacent les deux mots `framework` et `DOM` de la première rédaction, et ils sont
nommés ici parce qu'ils n'étaient pas dans le document : `framework` → `window`, `DOM` →
`document`, et `self` — que le paragraphe ci-dessus cite déjà. Sans eux, deux cellules du tableau
étaient des **mots** et non des symboles, et une recherche à chaîne fixe sur « framework »
n'interdit rien. Un framework **bundlé**, lui, n'a pas à être dans la liste : la passe 1 le voit
autrement, par son fichier dans `metafile.inputs`.

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
pas — voir [`docs/build.md`](../contributeurs/build.md) — donc un import ajouté par mégarde casse déjà
l'artefact. Cette
passe ne sert qu'à lire une liste de fichiers.

En complément, une seconde invocation avec `--packages=external` laisse les imports dans la
sortie, et `outputs.imports` doit être vide. Même conclusion par un autre chemin, pour le cas
où les métadonnées de build auraient été désactivées.

## 3. Passe 2 — la recherche, pour les constructions

Un grep à chaîne fixe sur **`registry/default/signals.min.js`**, l'artefact que l'utilisateur
installe, et non sur la source.

**Pourquoi le minifié.** Le minificateur renomme les variables locales mais **ni les globaux ni
les fonctions natives**. Mesuré : les dix-huit motifs sont détectés dans `signals.min.js`, et un
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

Elle porte sur le **produit distribué**, jamais sur le dépôt. Le dépôt a huit `devDependencies` —
la baseline, le compilateur, le bundler, les types de Node, la CLI du registry, le formateur, le
hook de commit et le générateur de site — et un `node_modules` de plusieurs centaines de
mégaoctets : un contrôle qui viserait le dépôt trouverait toujours des dépendances, et ne
prouverait rien. Aucune de ces huit n'est lisible par le cœur distribué, et c'est ce que les deux
passes mesurent.

## 6. Vérifié

La porte a été rejouée sur un fichier contenant les dix-huit motifs de la liste ci-dessus, puis
sur l'artefact distribué, qui n'en contient aucun :

| | Fichier piégé | Fichier propre |
|---|---|---|
| Motifs détectés | **18 / 18** | 0 / 18 |
| Faux positifs | — | **aucun** |
| Fichiers listés par le metafile | 2 | 1 |

La troisième ligne est la vérification du §2 : un fichier qui importe `leftpad` en liste deux,
`["node_modules/leftpad/index.js", …]`, et un fichier propre en liste un.

La porte **remesure la colonne de droite** à chaque exécution — c'est ce `0 / 18` qu'elle imprime —
donc elle ne peut pas s'en éloigner sans tomber, et le dénominateur y est celui de la liste, pas un
nombre recopié. La colonne de gauche est le relevé d'une exécution manuelle, sur un fichier qui n'a
pas été committé : c'est le seul chiffre du document qu'aucune porte ne peut refaire.
