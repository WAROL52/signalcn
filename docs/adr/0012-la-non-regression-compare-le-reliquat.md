# La non-régression compare le RELIQUAT, pas le ratio

La barrière de non-régression d'une pull request ne compare plus des **pourcentages** de couverture
mais le **nombre de lignes, de branches et de fonctions non couvertes** : elle échoue quand ce
nombre AUGMENTE, et plus quand un ratio baisse.

## Ce qui a fait la décision

#74 a renommé dix-huit identifiants du cœur, dont le type exporté `Dispositeur` en `Disposer`. Le
renommage est sans effet observable — le harnais différentiel rejoue les 82 scénarios sans écart, et
les dix exports du runtime sont les mêmes noms. Et pourtant la porte a échoué :

```text
ECHEC regression lignes : 99.62% a la base (origin/master) -> 99.62%
```

Les deux nombres affichés sont **identiques**. Ils diffèrent à la quatrième décimale : 99,623210 contre
99,624060. La cause est une seule ligne de code :

```diff
-export function effect<FnReturn = void>(
-  fn: () => FnReturn,
-  options?: { name?: string },
-): Disposer {
+export function effect<FnReturn = void>(fn: () => FnReturn, options?: { name?: string }): Disposer {
```

`Dispositeur` → `Disposer` gagne un caractère de marge, la signature de `effect()` repasse sous les
100 colonnes, et Biome la recolle sur une ligne. Quatre lignes comptées deviennent une : le
dénominateur perd 3, le numérateur perd 3, et le ratio baisse de 0,0009 point alors que **le reliquat
non couvert est resté à 5**, et que **la ligne disparue n'exécute rien** — une signature n'est pas une
instruction.

La barrière criait donc sur une mise en forme. C'est le pire mode de défaillance qu'une porte puisse
avoir : un jour où elle tombe, elle apprend à être ignorée.

## Décisions

- **Comparer le reliquat, en nombre, sur les trois métriques** — retenu. Une fonction `non couvert`
  est un compte absolu, donc insensible au format du fichier. Il n'augmente que si du code a
  vraiment cessé d'être exécuté, ou s'il a été ajouté sans être exercé.
- **Comparer le ratio, mais sur les seules lignes portant une instruction** — refusé. Cela
  demanderait de savoir ce qu'est « une ligne qui a du code », c'est-à-dire de refaire le travail de
  V8 : un motif de plus, fragile, et dont le mode de défaillance est justement celui qu'on vient
  corriger.
- **Garder le ratio, etAligned le renommage pour qu'il tienne sur quatre lignes** — refusé. C'est
  le formateur qui décide de la largeur, pas nous. Lui écrire pour qu'un renommage ne bouge rien, ou
  bien c'est le renommage qui passe.
- **Ajouter du code couvert relève mécaniquement le ratio, et le reliquat ne le voit pas** — assumé,
  et c'est le prix. Le ratio n'était pas l'invariant qu'on croyait garder : il était partly une
  fonction du nombre de lignes du fichier, donc partly une mesure de la mise en forme. Le seuil de
  release, lui, reste un pourcentage — voir [ADR-0007](./0007-deux-barrieres-de-couverture.md) et
  [ADR-0011](./0011-reliquat-de-couverture-non-atteignable.md).

## Ce que ça ne change pas

La porte de release. Elle compare toujours les trois pourcentages aux seuils mesurés, et le seuil
reste entier, donc arrondi vers le bas. Seule la barrière de pull request change de base.

Et la porte garde ses trois autres contrôles, qui sont les plus贵的 et qui n'ont pas bougé : les
**trois seuils natifs**, la **garde du code mort** contre `NODE_V8_COVERAGE`, et l'**interdiction des
exclusions**. Aucun n'a été affaibli.

## La preuve que la barrière mord encore

Changer de base aurait pu la transformer en porte verte. Une fonction morte a été injectée dans le
cœur le temps de la mesure :

```text
ECHEC regression lignes : 10 non couvertes a la tete (origin/master), 5 au merge-base
ECHEC regression fonctions : 1 non couvertes a la tete (origin/master), 0 au merge-base
```

Le seuil natif a tiré en même temps. La barrière compare donc bien deux bases commensurables, et elle
ne laisse pas passer du code non exercé.

## Ce que cette décision n'est pas

Elle ne dit pas que le ratio ne sert à rien : il est toujours affiché, et il reste le seuil de
release. Elle dit que le ratio **ne se prête pas à une comparaison entre deux commits**, parce que
son dénominateur est un fait de mise en forme. Une non-régression se mesure sur une quantité qui ne
dépend pas du format du fichier.