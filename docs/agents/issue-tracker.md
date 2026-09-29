# Issue tracker : GitHub

Les tickets et specs de ce repo vivent dans les GitHub Issues. Utilise le CLI `gh` pour toutes les opérations.

## Conventions

- **Créer une issue** : `gh issue create --title "..." --body "..."`. Utilise un heredoc pour les corps multilignes.
- **Lire une issue** : `gh issue view <number> --comments`, en filtrant les commentaires avec `jq` et en récupérant aussi les labels.
- **Lister les issues** : `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` avec les filtres `--label` et `--state` appropriés.
- **Commenter une issue** : `gh issue comment <number> --body "..."`
- **Appliquer / retirer des labels** : `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Fermer** : `gh issue close <number> --comment "..."`

Déduis le repo depuis `git remote -v` — `gh` le fait automatiquement lorsqu'il est lancé dans un clone.

## Pull requests comme surface de triage

**PRs comme surface de requêtes : non.** _(Passe à `yes` si ce repo traite les PRs externes comme des demandes de fonctionnalité ; `/triage` lit ce flag.)_

Quand le flag est à `yes`, les PRs passent par les mêmes labels et états que les issues, avec les équivalents `gh pr` :

- **Lire une PR** : `gh pr view <number> --comments` et `gh pr diff <number>` pour le diff.
- **Lister les PRs externes à trier** : `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` puis ne garder que les `authorAssociation` `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` ou `NONE` (exclure `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Commenter / labeliser / fermer** : `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub partage un seul espace de numérotation entre issues et PRs, donc un `#42` nu peut être l'un ou l'autre — résous avec `gh pr view 42` et repli sur `gh issue view 42`.

## Quand une skill dit « publier dans l'issue tracker »

Crée une GitHub issue.

## Quand une skill dit « récupérer le ticket concerné »

Lance `gh issue view <number> --comments`.

## Opérations de wayfinding

Utilisées par `/wayfinder`. La **carte** est une issue unique, les **tickets enfants** sont des issues filles.

- **Carte** : une issue avec le label `wayfinder:map`, contenant le corps Notes / Décisions prises / Brouillard. `gh issue create --label wayfinder:map`.
- **Ticket enfant** : une issue liée à la carte comme sous-issue GitHub (endpoint sub-issues via `gh api`). Quand les sous-issues ne sont pas activées, ajouter l'enfant à une task list dans le corps de la carte et mettre `Part of #<carte>` en tête du corps de l'enfant. Labels : `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Une fois claimé, le ticket est assigné au dev qui le porte.
- **Blocage** : les **dépendances natives d'issues** de GitHub — la représentation canonique, visible dans l'UI. Ajouter une arête avec `gh api --method POST repos/<owner>/<repo>/issues/<enfant>/dependencies/blocked_by -F issue_id=<id-db-bloquant>`, où `<id-db-bloquant>` est l'**id de base de données** numérique du bloquant (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _pas_ le `#number` ni le `node_id`). GitHub expose `issue_dependencies_summary.blocked_by` (bloquants ouverts seulement — le gate vivant). Sans dépendances disponibles, repli sur une ligne `Blocked by: #<n>, #<n>` en tête du corps de l'enfant. Un ticket est débloqué quand tous ses bloquants sont fermés.
- **Requête de frontière** : lister les enfants ouverts de la carte (`gh issue list --state open`, restreint à ses sous-issues / task list), écarter ceux qui ont un bloquant ouvert (`issue_dependencies_summary.blocked_by > 0`, ou une issue ouverte dans la ligne `Blocked by`) ou un assigné ; le premier dans l'ordre de la carte gagne.
- **Claim** : `gh issue edit <n> --add-assignee @me` — la première écriture de la session.
- **Résolution** : `gh issue comment <n> --body "<réponse>"`, puis `gh issue close <n>`, puis ajouter un pointeur de contexte (gist + lien) aux Décisions prises de la carte.
