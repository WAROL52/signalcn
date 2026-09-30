# Les défauts non figés de `createModel` sont corrigés

Sept des dix-neuf défauts relevés dans `createModel` sont corrigés. Les douze autres sont reproduits à l'identique, y compris ceux qui sont franchement mauvais. La règle est une seule phrase : **un défaut est corrigé sauf si la matrice de conformité a observé un comportement qui en dépend.**

Cet ADR ne contredit pas [ADR-0001](./0001-clone-exact-de-la-baseline.md), il le rend opératoire. `createModel` est le seul export qui a une logique propre, donc le seul où « reproduire la sémantique » ne dicte pas la structure.

## Considered Options

- **Reproduire les dix-neuf défauts** — refusé. Douze le restent, parce que la garantie en dépend. Les sept autres n'ont aucun comportement observé qui en dépendre : les corriger ne coûte rien à la garantie de conformité, et laisse en place des pièges qui coûtent cher à l'utilisateur final.
- **Corriger les dix-neuf** — refusé, et c'est la tentation inverse. Un effet perdu quand la fabrique lève, un `RangeError` sur un objet cyclique, un cleanup qui interrompt les disposes suivants : ces comportements sont **figés par la matrice**. Les corriger ferait échouer le harnais différentiel, c'est-à-dire détruirait la seule chose qui distingue cette bibliothèque d'une approximation.

## Consequences

- **Le veto `brand` compare la valeur, plus le nom.** La baseline teste `!("brand" in val)`, donc tout objet métier portant une propriété `brand` — un catalogue, un DTO, un type brandé — était silencieusement ni validé ni enveloppé. Un signal porte le vrai symbole, donc reste protégé : la garantie de la matrice tient mot pour mot.
- **Les clés énumérables sont propres.** `for..in` remontait la chaîne de prototypes, donc une propriété héritée était enveloppée *et* recopiée comme propriété propre, une pollution énumérable de `Object.prototype` atterrissait sur chaque modèle du programme, et une pollution posée en getter faisait lever `createModel` en mode strict. Les méthodes de classe ne sont pas enveloppées, et cela ne change pas : les méthodes natives sont non énumérables.
- **La descension est contrôlée par descripteur.** La baseline lisait `value[key]` pour choisir une branche puis écrivait dans le même slot. Sur un accesseur, lire et écrire n'est pas la même opération : un getter qui renvoyait une fonction levait une `TypeError` en mode strict, et était un no-op silencieux en sloppy.
- **Les enveloppes sont mémoïsées par un cache faible.** Deux clés pointant la même fonction ne donnent plus deux wrappers, et un sous-arbre partagé n'est plus re-parcouru puis re-enveloppé en une seconde couche `batch` + `untracked`. Effet de bord volontaire : `model.a === model.b` devient vrai.
- **`Symbol.dispose` absent ne produit plus de clé `"undefined"`.** La baseline écrivait une propriété énumérable nommée `"undefined"`, et `using` devenait un no-op silencieux qui fuit tous les effets. Nous ne posons rien : le modèle reste utilisable, `using` est indisponible sur ce runtime, et c'est dit.
- **Une fonction asynchrone enveloppée déclenche un avertissement.** `action` ne batch que son préfixe synchrone, donc une méthode `async` sur un modèle observait deux flushs au lieu d'un, sans rien le signaler. Corriger — attendre la promesse avant de fermer le batch — changerait le contrat synchrone de `action` et rendrait le flush non déterministe. Avertir apprend sans casser.
- **Quatre gardes défensives** transforment un crash opaque en erreur nommée : fabrique qui ne renvoie pas un objet rejetée avant toute mutation, accesseur en lecture jamais écrit, `Symbol.dispose` utilisateur jamais écrasé, tableau d'effets effacé dans un `finally`. Aucune ne change un observable.
- **Ce qui reste reproduit, et le sait.** Un effet créé par une fabrique qui lève est perdu et continue de tourner sans poignée. Un objet cyclique provoque un dépassement de pile après mutation partielle. Un cleanup qui lève laisse les effets suivants en vie. Un `Symbol.dispose` fourni par l'utilisateur est écrasé sans bruit. Ces quatre-là sont dans la matrice, donc dans la garantie, donc dans le contrat.
