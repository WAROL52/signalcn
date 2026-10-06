# Vérifier l'artefact installé

Comment savoir que le fichier installé fonctionne — et, sans ambiguïté, ce que ça ne prouve
pas. La confiance qu'on place dans une installation est la dernière chose qui doit rester
verte sans contrôle.

| Vous voulez | Allez à |
| --- | --- |
| vérifier en une commande | [Faire tourner la suite installée](#faire-tourner-la-suite-installee) |
| savoir si `node --test` suffit | [Le code de sortie ne suffit pas](#le-code-de-sortie-ne-suffit-pas) |
| connaître les limites de la vérification | [Ce que ça ne prouve pas](#ce-que-ca-ne-prouve-pas) |

## Faire tourner la suite installée

Les items de test s'installent avec l'item d'implémentation, et ne dépendent de rien d'autre
que le fichier installé. La promesse est la même pour les trois artefacts :

```bash
npx shadcn@latest add WAROL52/signalcn/signals-test
node --test signals.test.ts
```

```bash
npx shadcn@latest add WAROL52/signalcn/signals-test-js
node --test signals.test.js
```

```bash
npx shadcn@latest add WAROL52/signalcn/signals-test-min
node --test signals.test.min.js
```

Deux fichiers écrits à chaque fois : l'item de test attire exactement son item
d'implémentation — jamais les cinq autres. Les trois suites sont la **même table de scénarios**,
rejouée contre le paquet installé : c'est la promesse de `SPEC.md` §19, prouvée sans une
assertion supplémentaire de parité.

Si Node refuse de charger un `.ts`, vous êtes sur un Node antérieur à 22.6 — la cible de
compilation est ES2020 et le runtime s'exécute sans `node_modules`.

## Le code de sortie ne suffit pas

`node --test` répond `exit 0` pour un fichier de test **vide** — Node compte le fichier comme
un test — et pour un fichier entièrement **ignoré**. Deux murs verts sans qu'une seule
assertion ait tourné. Il faut donc lire le rapport TAP :

```text
# tests        == nombre de scénarios de la table
# pass         == ce nombre
# fail         == 0
# skipped      == 0
```

Le nombre de scénarios vient de la table elle-même : une comparaison manuelle qui ne dérive
pas. La stratégie de comptage, mesurée, est dans
[`site/contributeurs/parity.md`](../contributeurs/parity.md).

## Ce que ça ne prouve pas

Une suite verte prouve que **ce fichier** satisfait la table des scénarios, sur **ce runtime**,
à **cette heure**. Elle ne prouve pas :

- **Que votre application est conforme.** Vous l'installez, vous n'en remontez pas le registre ;
  la suite fige le moteur, pas votre usage.
- **Que le paquet résout contre la dernière base.** La compatibilité est mesurée contre
  `@preact/signals-core@1.14.4` ; un décalage de votre usage sur une autre version de référence
  sort du contrat.
- **Que les trois métriques de couverture tiennent.** Elles sont mesurées sur la source dans le
  dépôt, pas chez vous. La suite installée n'énumère pas les branches — elle les parcourt.
- **Que la minification est bonne pour vous.** Elle est identique octet pour octet à la suite
  de la source, donc plus petite : les noms de champs internes sont stables, mais ce n'est pas
  ce que la couverture mesure.
- **Que le code mort n'est pas livré.** Une branche inatteignable passe la suite ; c'est la
  couverture qui la déclare, et elle n'est pas exécutée chez vous.

La stratégie exacte, avec les deux trous mesurés et le comptage de tests, est dans
[`site/contributeurs/parity.md`](../contributeurs/parity.md).