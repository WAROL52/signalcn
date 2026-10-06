# signalcn — instructions pour les agents

## Écrire ici

**Une seule réponse, l'essentiel, et c'est tout.** Pas de récit, pas de résumé de ce que tu viens de
faire, pas de tableau récapitulatif, pas de mise en valeur. L'essentiel, puis tu t'arrêtes.

Si un détail manque, **une ligne** en bas — « tu veux le détail sur X ? » — et tu attends. Ne le
déplie pas seul : c'est le lecteur qui décide ce qu'il lit.

Une réserve ne devient pas un pavé. Mesure : si on ne peut pas le lire en dix secondes, elle est trop
longue.

## Publier

`master` **ne prend aucun commit direct** : une branche, une pull request, quatre checks requis. Les
PR se fusionnent **en rebase** — le dépôt refuse `squash` et refuse le commit de fusion, donc
`gh pr merge <n> --rebase`. Si la branche est en retard sur `master`, `git rebase origin/master` puis
pousser, et non un force-push aveugle. Règle et forme d'une PR : `CONTRIBUTING.md` →
« Tout passe par une pull request ».

## Outillage

Le formateur du dépôt n'applique `biome.json` **que dans le dépôt**. Pour demander ce qu'il ferait à
un fichier, depuis la racine :

```
npx biome format --stdin-file-path=registry/default/signals.ts < fichier.ts
```

Sans le `--stdin-file-path` qui porte un chemin **du dépôt**, la configuration ne s'applique pas et la
réponse est fausse.

`npm run porte` enchaîne les quinze contrôles, dans l'ordre du job `rapide`. `verifier-derive` exige un
**arbre propre** : sur un arbre sale, il accuse vos propres modifications. `docs/contributeurs/ci.md`
§1 est le tableau des coûts mesurés, le seul endroit où un coût est écrit.

## Agent skills

### Issue tracker

Tickets et specs dans les GitHub Issues du repo, via le CLI `gh`. Voir `docs/agents/issue-tracker.md`.

### Triage labels

Vocabulaire par défaut des 5 rôles : `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Voir `docs/agents/triage-labels.md`.

### Domain docs

Disposition single-context : `CONTEXT.md` + `docs/adr/` à la racine. Voir `docs/agents/domain.md`.
