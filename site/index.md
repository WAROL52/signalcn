# signalcn

Un moteur de signaux réactifs agnostique des frameworks, distribué comme code source.

Trois publics, trois sections :

- [**Utilisateurs**](/utilisateurs/) — installer la bibliothèque, migrer depuis Preact, connaître
  les divergences assumées.
- [**Contributeurs**](/contributeurs/) — travailler ici : les portes, les commits, la revue.
- [**Technique**](/technique/) — le contrat de comportement, l'architecture, les décisions.

Les documents des trois sections sont des fichiers de `site/`. Les autres sont rendus ici sans
avoir bougé : `SPEC.md`, `README.md`, `CONTEXT.md`, `CONTRIBUTING.md`, `AGENTS.md` et `docs/adr/`
restent à la racine du dépôt et à la place que le dépôt leur donne, parce que quatre portes les
lisent en dur ou les citent par ce chemin.

**Ce que le build vérifie, et ce qu'il ne vérifie pas.** Le build échoue sur un lien de **fichier**
mort, dans le site comme ailleurs dans le dépôt. Il ne regarde pas les **ancres** : Mermaid, les
plugins et la numérotation automatique rendent l'extraction des `id` trop fragile, et une porte
instable se désactive — donc un lien vers un titre qui n'existe plus passe sans bruit.

## Une version, pas une archive

Ce site ne garde **qu'un instantané : la version courante**. Pas de copie par version.

La raison est mesurée, et c'est elle qui tranche : entre `v1.0.0` et cette version,
`registry/default/signals.min.js` est **identique octet pour octet**. Le moteur distribué n'a pas
bougé. Ce qui a changé, c'est la forme du source — le reformat du formateur et le renommage de
quelques variables locales — et 448 lignes de documentation en plus.

Un instantané de `v1.0.0` décrirait donc le même moteur avec moins de texte. Il n'y a rien à y
consulter que le tag ne réponde pas — et le tag répond **mieux**, puisque `git log` le cherche dans
tout le dépôt et qu'un instantané figé ne sait répondre qu'à ce qu'il répète.

**L'archive, c'est Git.** Une version passée se lit ainsi :

```bash
git show v1.0.0:SPEC.md          # un fichier, tel qu'il était
git log --oneline v1.0.0..HEAD    # ce qui a changé depuis
```

`v0.1.0` et `v1.0.0` sont publiés avant que ce site existe : ils n'ont pas de version publiée ici.
Leurs fichiers se lisent au tag, ci-dessus.
