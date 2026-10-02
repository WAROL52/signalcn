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
