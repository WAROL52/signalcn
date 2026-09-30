# PROTOTYPE — jetable, ne pas fusionner

**Question :** à quoi ressemble `signals.test.ts`, ce fichier qui est à la fois la
source de vérité du dépôt ET l'artefact `signals-test` que l'utilisateur installe,
pour que la **même** batterie s'exécute contre la baseline et contre `signals.ts` ?

**Adaptation assumée :** la branche « logique » du skill prototype prescribe un fichier HTML
à cliquer. Cette question n'est pas une machine à états : il n'y a rien à presser. La
forme fidelle est un programme Node qu'on lance en une commande et qui imprime son
verdict. Le principe est gardé — jetable, trivial à lancer, l'état complet affiché, zéro
polish.

**Lancer :** `./run.sh`

## Le pari du prototype

La table de scénarios porte **ses propres assertions**. Le fichier distribué est donc un
vrai jeu de tests, lisible et déboguable, que l'utilisateur reçoit tel quel. Le harnais
du dépôt mainteneur n'a rien à comparer : il fait tourner la même table contre la
baseline, et les mêmes assertions font foi. Une divergence = un test en échec.
