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

C'est le trou que la carte signalait comme non tranché. Le registre `COUVERTURE` le ferme.

**Une entrée de la matrice a une DESTINATION, pas nécessairement une référence.** Une destination
est l'une de trois choses : le nom d'un scénario, le nom d'un test `signalcn-seul`, ou un
**marqueur** — `source:<ref>` quand l'observation n'existe que sur les sources de la référence,
`divergence:<ref>` quand `signalcn` fait délibérément autre chose. Un numéro de ticket n'en est pas
une : un ticket est une promesse, et une promesse se périme sans bruit.

Mesuré sur le registre : **231 entrées**, dont **198** couvertes par au moins un scénario, **22**
par un marqueur, **11** par un `signalcn-seul` seul. Les trois ensembles sont disjoints, donc
**33 entrées ne sont couvertes par aucun scénario** — et il n'en reste rien à faire, puisque ce qui
est demandé est une destination, pas un rejeu par la table.

Deux contrôles, qui ne vivent pas au même endroit. `registre-complet`, dans `signals.test.ts` —
donc dans la **suite distribuée** — vérifie les trois directions : toute entrée a une destination,
aucune destination ne cite une entrée inexistante, toute destination nommée existe. Il ne peut pas
vivre dans une porte : une suite qui lit un fichier du dépôt lèverait chez l'utilisateur, et
`SPEC.md` n'est pas distribué. `npm run documentation` ne porte que sur les **marqueurs**, qui doivent
se répondre avec `SPEC.md` §21 dans les deux sens — la raison d'être d'un marqueur est au §21,
jamais dans le registre.

Les comptes par primitive du tableau du §1 ne sont adossés à **aucune** porte. Ils sont justes, ils
ont été mesurés contre le registre, et ils peuvent se périmer sans bruit : c'est arrivé, et les
plages qu'affichait le §4 avant cette réécriture totalisaient 219 au lieu de 231 sans que rien ne le
dise. Les garder demanderait un mapping entre les orthographes que portent les dix primitives —
`createModel` au §1, `model` dans les noms de scénario, `modele` dans la matrice — donc c'est une
décision qui n'a pas été prise.

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