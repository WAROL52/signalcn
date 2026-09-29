# Docs de domaine

Comment les skills d'ingénierie doivent consommer la documentation de domaine de ce repo pendant l'exploration du code.

## Avant d'explorer, lis ceci

- **`CONTEXT.md`** à la racine du repo, ou
- **`CONTEXT-MAP.md`** à la racine s'il existe — il pointe vers un `CONTEXT.md` par contexte. Lis chacun des contextes pertinents pour le sujet.
- **`docs/adr/`** — lis les ADR qui touchent la zone dans laquelle tu vas travailler.

Si l'un de ces fichiers n'existe pas, **continue silencieusement**. Ne signale pas son absence et ne propose pas de le créer en amont. Le skill `/domain-modeling` (atteint via `/grill-with-docs` et `/improve-codebase-architecture`) les crée au moment où des termes ou des décisions sont réellement résolus.

## Structure des fichiers

Repo single-context (le cas de ce repo) :

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-evenements-source-ordres.md
│   └── 0002-postgres-pour-le-modele-lecture.md
└── src/
```

## Utilise le vocabulaire du glossaire

Quand ta sortie nomme un concept de domaine (titre d'issue, proposition de refactor, hypothèse, nom de test), utilise le terme tel que défini dans `CONTEXT.md`. Ne dérive pas vers des synonymes que le glossaire évite explicitement.

Si le concept dont tu as besoin n'est pas encore dans le glossaire, c'est un signal — soit tu inventes un langage que le projet n'utilise pas (reconsidère), soit il y a un vrai manque (note-le pour `/domain-modeling`).

## Signale les conflits avec les ADR

Si ta sortie contredit un ADR existant, surface-le explicitement plutôt que de l'écraser silencieusement :

> _Contredit l'ADR-0007 (commandes event-sourced) — mais vaut la peine de le rouvrir car…_
