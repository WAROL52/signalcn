# Classes ES2020 plutôt que prototypes ES5

Le cœur est écrit en classes JavaScript natives, avec des champs et des méthodes, au lieu de déclarer chaque classe en TypeScript puis de l'implémenter à la main sur `Function.prototype`. Le seuil de détection de cycle est traité comme un paramètre d'implémentation et non comme une constante contractuelle.

## Considered Options

- **Reproduire le style de la baseline** — `declare class` pour le typage, puis fonctions et prototypes à la main. Refusé. Sa justification upstream est explicite dans sa source : « better control of the transpiled output size ». `signalcn` ne transpile pas — Node 24 exécute le TypeScript directement et la cible est ES2020 — donc la raison ne s'applique pas, et le style ne coûte que de la lisibilité.
- **Écrire un prototype à la main pour préserver l'énumérabilité** — refusé. Les méthodes d'une classe native sont non énumérables, celles d'un prototype écrit à la main le sont. Forcer l'énumérabilité exposerait des méthodes comme des données, et aucun outil ne s'appuie sur cette propriété pour fonctionner.

## Consequences

- **`for..in` rétrécit.** Huit clés sur un signal au lieu de dix-sept, douze sur un computed au lieu de vingt-deux. `Object.keys(Computed.prototype)` est vide au lieu de douze noms de champs. C'est l'écart le plus visible en comparant les deux bibliothèques côte à côte.
- **L'empoisonnement global du prototype disparaît.** Dans la baseline, `Computed.prototype` est une *instance* de `Signal` — donc un objet partagé, mutable et vivant — et lire `.value` dessus lève une `TypeError` qui le condamne pour tous les computeds du même realm. Avec `class Computed extends Signal`, le prototype est `Signal.prototype`, sans état. Le quirk le plus inquiétant du rapport d'inventaire n'existe plus.
- **`Computed.prototype.constructor` devient correct** : `Computed`, au lieu de `Signal`.
- **Le seuil de cycle cesse d'être contractuel.** `SPEC.md` §15.2 exige désormais qu'un cycle asynchrone finisse en `Error` dans un nombre borné d'itérations, sans figer le compte. C'est cohérent avec l'analyse : cent est un ordre de grandeur, pas une constante sémantique, et la détection exacte de cycle serait indécidable.
- **L'ordre des huit propriétés-own d'un signal ne change pas**, donc `Object.keys`, `{...signal}` et `JSON.stringify` restent compatibles. C'est la surface qui comptait réellement.
- Ces écarts sont consignés dans `SPEC.md` §21 et détaillés dans `site/technique/architecture.md` §11.
