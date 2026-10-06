# Le graphe de dépendances

Ce que se réveille quand vous écrivez, et pourquoi c'est toujours le même objet.

```text
  a ───▶ b                chaîne      b ne s'exécute que si a a changé

  a ──┬──▶ b
      └──▶ c              diamant     b ET c se déclenchent, une seule fois

  a ───▶ b
  c ───▶ a                dynamique   le graphe a un cycle, et c'est le cas normal
```

Une écriture ne réveille que ce que **ses** lecteurs ont lu depuis, et rien d'autre. Les deux premiers
graphes n'ont rien de particulier : ce sont des cas particuliers du troisième, où une dépendance
n'existait pas au dernier calcul. Rien n'y est cassé — le moteur ne regarde que ce qu'il a lu, donc
il ne voit pas le cycle, et n'a pas à le voir.

La propagation suit le chemin inverse de la lecture et **s'arrête au premier objet déjà à jour** : un
objet à jour n'a rien à transmettre, donc la boucle s'arrête là. C'est ce qui rend le coût
proportionnel à ce qui a changé, et non à la taille du graphe.

Le fond — comment le graphe est construit, et pourquoi la réconciliation a trois défenses — est dans
[`architecture.md`](./architecture.md). Le contrat de comportement est dans
[`SPEC.md`](/SPEC.md) §7.

L'ordre d'exécution dans un batch est un autre sujet : voir
[Les deux règles de drainage](./regles-de-drainage).