# Scénarios de conformité

Comment les comportements de
[`research/baseline-1.14.4.md`](/research/baseline-1.14.4.md) deviennent la table de
scénarios de `signals.test.ts`. Ce document est l'entrée de la plus grosse pièce de travail du
projet : le corpus de tests.

## 1. La règle de découpage

> **Un scénario par comportement observable isolément.**

Ce qui n'est observable qu'en combinaison se greffe sur un scénario existant, et le scénario
ajoute alors une ligne de traçabilité de plus. La règle est énonçable, donc vérifiable — ce qui
était la condition posée.

Un scénario n'appartient pas à une primitive : il en couvre souvent plusieurs, et c'est le champ
`matrice:` qui le dit. La colonne de droite compte donc les scénarios qui citent au moins une
entrée de la primitive — elle totalise 89, et le nombre de scénarios se lit au §7.

Les **60 zones transverse** ne s'ajoutent pas : ce sont les comportements 1 à 60 déjà comptés
dans les tables par primitive, présentés comme un hors-sujet. Elles se répartissent sur les dix
primitives, pas dans une onzième.

| Primitive | Entrées de matrice | Scénarios qui la couvrent |
|---|---|---|
| `signal` | 26 | 9 |
| `computed` | 30 | 17 |
| `effect` | 43 | 21 |
| `batch` | 27 | 9 |
| `untracked` | 13 | 7 |
| `action` | 11 | 3 |
| `createModel` | 38 | 7 |
| `subscribe` | 18 | 3 |
| Conversions | 15 | 7 |
| `dispose` | 10 | 6 |

## 2. La forme d'un scénario

```ts
{
  // Le nom porte la référence du CONTRAT. Il se comprend seul, sans la matrice.
  name: "signal/egalite-stricte-nan-notifie",

  // Le champ porte la référence de la MATRICE. Plusieurs entrées si le scénario
  // en couvre plus d'une.
  matrice: ["signal#6"],

  run(api, log) {
    const s = api.signal(1)
    api.effect(() => log("run", s.value))
    s.value = NaN
    log("valeur", String(s.value))
    assert.deepEqual(log.entries, ["run 1", "run NaN", "valeur NaN"])
  },
}
```

Deux références, deux publics : le nom sert le **lecteur** du contrat, le champ sert le
**mainteneur** qui vérifie qu'aucun comportement n'a été oublié.

## 3. Les attentes viennent de la matrice, pas de la tête de quelqu'un

Chaque entrée de la matrice porte déjà, dans sa colonne **Observé**, le résultat du probe qui
l'a établie. Transcrire cette colonne dans une attente n'invente rien : c'est recopier une
mesure déjà faite.

Le vrai oracle reste la campagne rejouable — c'est elle qui établit la colonne *Observé*, et le
harnais différentiel la rejoue. Mais **l'attente figée dans le fichier est un fait**, pas une
opinion.

## 4. L'exhaustivité se vérifie

C'est le trou que la carte signalait comme non tranché. Le champ `matrice:` le ferme.

Une porte extrait tous les couples `(section, n)` référencés par les scénarios et les compare
à l'ensemble des couples de la matrice. **Un comportement de la matrice non référencé est un
échec.**

```text
signal#1..23      conv#1..15
computed#1..27    dispose#1..10
effect#1..41      subscribe#1..18
batch#1..27       action#1..11
untracked#1..13   modele#1..34
```

Cinq des dix sections sont des tables préfixées par un nom de primitive ; la sixth,
« Conversions », et la septième, « dispose et `Symbol.dispose` », ont des noms à part. Les zones
transverse ne sont pas une onzième : ce sont les comportements 1 à 60 déjà comptés dans les tables
par primitive, et elles n'ont pas d'entrée propre — elles ne se comptent pas deux fois.

La porte est un script de quelques lignes, comme celle de
[`site/contributeurs/documentation.md`](./documentation.md) §2. Elle tourne dans le job rapide.

## 5. Les trois sondes destructives ne le sont plus

Le ticket annonçait trois sondes qui exigeraient un isolation. Après
[ADR-0004](/docs/adr/0004-classes-es2020-plutot-que-prototypes-es5.md),
[ADR-0005](/docs/adr/0005-defauts-non-figes-de-createmodel.md) et
[ADR-0008](/docs/adr/0008-registry-file-partout-et-tsx-true-exige.md), aucune n'en est une :

| Sonde | Ce qu'elle est devenue |
|---|---|
| Prototype partagé empoisonné | **Supprimé.** L'assertion est positive : un computed réel reste fonctionnel après une lecture sur le prototype. |
| Objet cyclique dans `wrapInAction` | **Local.** Il mute l'objet qu'on lui donne, pas le processus. Un `RangeError` attendu, puis un scénario normal : deux sur deux. |
| Clé `"undefined"` sans `Symbol.dispose` | **Plus posée.** L'absence de la clé est l'assertion, et elle se teste dans un `vm` isolé. |

Le besoin d'isolation n'a pas été résolu : il a disparu.

## 6. Ce que ce découpage ne garantit pas

- **Que les attentes sont justes.** Elles viennent de mesures, mais une mesure peut être mal
  interprétée. C'est le rôle de la relecture des scénarios suspects.
- **Que la matrice est exhaustive.** Elle a été produite par lecture de la source **plus**
  probes, et un comportement qu'aucun probe n'a cherché est invisible. C'est la limite
  assumée du projet, pas un oubli.
- **Que la couverture du code est complète.** Elle est mesurée séparément, par le relevé de
  `SPEC.md` §18. Un scénario peut couvrir un comportement et laisser une branche non couverte,
  et réciproquement.

## 7. Le journal du harnais

Ce qui suit n'est pas écrit : c'est la sortie de `npm run harnais`, rendue au moment du build du
site. Si un scénario diverge, **le build échoue** — une page qui afficherait un harnais rouge
mentirait, et le contrat exige que les trois cibles soient indiscernables.

Le résumé compte les **références** portées par les scénarios, pas les entrées de la matrice : un
scénario qui cite cinq entrées en porte cinq. La matrice en compte une fois chacune, et son total
est dans [`research/baseline-1.14.4.md`](/research/baseline-1.14.4.md).

<!-- harnais -->