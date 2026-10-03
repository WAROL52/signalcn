# Prototypes

Code **jetable**, conservé comme source primaire, **jamais fusionné dans `main`**.

Chaque prototype pose une question de conception et contient la réponse sous forme
exécutable. Le verdict est consigné en commentaire de résolution sur le ticket qui a posé
la question, et la décision validée est repliée dans le vrai code.

Le code vit donc sur une branche, jamais ici. Ce registre est le seul endroit où il est
annoncé, et la seule trace qu'un prototype a existé depuis `main`.

| Prototype | Question | Ticket | Branche |
|---|---|---|---|
| `harness-shape` | À quoi ressemble `signals.test.ts`, pour que la même batterie s'exécute contre la baseline et contre `signals.ts` ? | [#4](https://github.com/WAROL52/signalcn/issues/4) | [`prototype/harness-shape`](https://github.com/WAROL52/signalcn/tree/prototype/harness-shape) |

Le prototype `harness-shape` a fait son office : son pari — les assertions vivent dans le
scénario — est replié dans `registry/default/signals.test.ts`, et son verdict est consigné dans
#4.