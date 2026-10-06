# Migrer depuis Preact

Si vous avez du code écrit contre `@preact/signals-core`, ce qui change là où il change : les
comportements visibles, et rien d'autre. La surface des divergences est tenue à jour dans le
`README.md`, section « Différences connues » — cette fiche vous dit **quoi relire** dans votre
code, pas ce que l'écart est. Les raisons sont dans [`SPEC.md`](/SPEC.md) §21.2 et les ADR.

| Vous voulez | Allez à |
| --- | --- |
| savoir si vos boucles `for..in` tiennent | [L'énumération](#l-enumeration) |
| savoir si votre objet métier garde sa forme | [Le `brand`](#le-brand) |
| savoir si votre test sur un cycle tient | [Les cycles](#les-cycles) |
| savoir ce que touche une lecture de prototype | [Le prototype de `Computed`](#le-prototype-de-computed) |
| une liste courte pour relire votre code | [La liste de relecture](#la-liste-de-relecture) |

## L'énumération

C'est l'écart qui casse le plus souvent, parce qu'il est silencieux. Sur une classe ES2020, les
méthodes de prototype sont non énumérables — la baseline les expose. Conséquence :

- `for..in` sur un signal expose **8 clés**, pas 17 ;
- `for..in` sur un computed, **12**, pas 22 ;
- `Object.keys(Computed.prototype)` est **vide**, là où la référence en expose douze.

À relire : toute boucle qui part d'un signal ou d'un computed, et toute comparaison qui fonde
un test sur le **nombre** de clés.

## Le `brand`

Un signal et un computed portent le vrai symbole `brand`, donc toute protection par identité
dans le paquet les épargne — comme la référence. Mais un **objet métier qui porte une propriété
`brand` est enveloppé** par `createModel()`, là où la référence l'ignorait.

À relire : toute fabrique de modèle dont un champ s'appelle `brand`. C'est le DTO, le catalogue,
le type brandé qui surprend. L'écart tient à la valeur du veto, pas à sa présence : la référence
teste `!("brand" in val)` — un nom, jamais une valeur.

## Les cycles

Une auto-récursion dans un effet s'arrête, et c'est le mécanisme qui est contractuel — pas le
compte. La borne n'est **pas figée** à 102 : un test qui l'affirme se casse sur une évolution
normale du moteur, et elle n'est pas une promesse. Un cycle **indirect** — `a → b → a` — est
le cas normal du graphe réactif, et le drapeau d'erreur est ce qu'il faut observer.

À relire : tout test qui compare le **nombre** d'exécutions, et toute boucle dans un effet qui
écrit sa propre dépendance — elle n'est pas un bug, elle se ré-exécute dans le même drainage
([`SPEC.md`](/SPEC.md) §15).

## Le prototype de `Computed`

`Computed.prototype.constructor` vaut `Computed`, pas `Signal` — un correctif. Lire `.value`
dessus **échoue**, mais ne condamne plus le prototype pour tous les computeds du même realm : la
baseline en faisait une fois un objet poison global.

À relire : toute introspection de type par `.constructor`, et tout code qui lit `.value` sur un
prototype pour détecter le type — il verra une erreur au lieu d'un poison qu'il a lui-même
semé.

## La liste de relecture

Cinq recherches, à lancer dans l'ordre :

1. `for (... in ...)` sur un signal ou un computed ;
2. `Object.keys(` sur l'un ou l'autre ;
3. une propriété `brand` sur un objet passé à `createModel()` ;
4. un compte d'exécutions dans un effet qui s'écrit ;
5. `.constructor` comparé à `Signal` sur un computed.

Si aucune n'en retourne, votre code est au même niveau de confiance qu'avant la migration.
Sinon, la section « Différences connues » du [`README.md`](/README.md) a l'écart précis, et
[`SPEC.md`](/SPEC.md) §21.2 a la raison.