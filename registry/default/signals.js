/**
 * Moteur de signaux réactifs agnostique des frameworks.
 *
 * Source de vérité. Distribuée telle quelle : le fichier compilé est cette source, et les
 * fichiers `.js` d'un projet utilisateur ne sont que ses copies.
 */
/**
 * La marque. Un seul `Symbol.for`, donc un seul registre : deux charges de la bibliothèque dans
 * un même programme partagent la même marque, et c'est exactement ce que veut la détection de
 * sous-objet d'un modèle.
 *
 * Elle vit sur le prototype, jamais sur une instance : coût nul par signal, et `in` la traverse
 * sans la voir dans l'énumération des clés propres. Voir `docs/architecture.md` §2.
 */
const BRAND_SYMBOL = Symbol.for("preact-signals");
/**
 * Huit propriétés-own, dans cet ordre exact. L'ordre EST le contrat (SPEC §5.3) : il est
 * observable par `Object.keys`, donc figé.
 *
 * Quatre d'entre elles sont encore des `null` parce que rien ne les peuple : le graphe arrive
 * avec `computed` et `effect`. Elles sont déclarées `null` et non pas typées, parce qu'une classe
 * `Node` qui n'existe pas encore serait de l'imagination, et qu'un `any` ferait perdre la
 * vérification de type au moment exact où le graphe arrive.
 */
export class Signal {
    constructor(value, options) {
        this._value = value;
        this._version = 0;
        // `undefined` et non omis, pour que la forme de la classe ne change pas quand le graphe
        // arrivera — `docs/architecture.md` §2. Les quatre champs ci-dessous sont des positions
        // réservées : `_node` et `_targets` reçoivent un `Node` et sa liste, `_watched` et
        // `_unwatched` les crochets d'abonnement. Aucun n'est typé plus finement tant que rien ne
        // les peuple, parce qu'un `any` ferait perdre la vérification au moment exact où le graphe
        // arrive, et qu'un type `Node` qui n'existe pas serait de l'imagination.
        this._node = undefined;
        this._targets = undefined;
        this._batchSnapshotVersion = -1;
        this._watched = options?.watched;
        this._unwatched = options?.unwatched;
        // La clé doit exister même quand le nom est absent : `Object.keys` la révèle toujours.
        this.name = options?.name;
    }
    get value() {
        return this._value;
    }
    set value(next) {
        // SPEC §5.2. Le seuil est `!==`, et c'est le détail le plus piégeux du contrat.
        //
        // `Object.is` donnerait le résultat OPPOSÉ sur `NaN` : `Object.is(NaN, NaN)` est `true`,
        // donc l'écriture serait ignorée et personne ne serait notifié. Or la baseline notifie.
        //
        // `!==` donne exactement la table, sans cas particulier :
        //   NaN -> NaN    : `NaN !== NaN`  -> vrai  -> écriture acceptée, notifié
        //   0   -> -0     : `0 !== -0`     -> faux  -> écriture ignorée, valeur restée 0
        //   -0  -> 0      : `-0 !== 0`     -> faux  -> écriture ignorée, valeur restée -0
        //   objet ≠ objet : `!==`           -> vrai  -> notifié
        //   même référence : `!==`           -> faux  -> ignoré
        //
        // Donc pas de `Object.is` ici, et pas de branche spéciale pour `NaN`.
        if (this._value !== next) {
            this._value = next;
            this._version++;
        }
    }
    /**
     * SPEC §5.1 — une lecture qui n'enregistre aucune dépendance.
     *
     * C'est EXACTEMENT une lecture non abonnée, et cette phrase est une contrainte : la seule
     * façon de rendre cette méthode autre chose serait d'y passer par l'accesseur `value` quand le
     * suivi de dépendance existera. Un jour, ce sera `untracked(() => this.value)`. Pas
     * `this.value` : ce serait abonné. Pas `this._value` après que le suivi existe : ce serait
     * non abonné par accident, sans que le code le dise.
     *
     * Pour l'instant le suivi n'existe pas, donc `_value` est une lecture non abonnée de fait. Le
     * test qui le prouve — un effet qui ne se ré-exécute pas — appartient à #25.
     */
    peek() {
        return this._value;
    }
    /**
     * SPEC §5.1 — les trois conversions passent par l'accesseur `value`, PAS par `_value` : elles
     * SUIVENT la dépendance. C'est la seule différence entre elles et `peek()`, et elle est
     * intentionnelle.
     *
     * Aucun `try` ici : `symbole + ""` lève déjà, et nous ne faisons que laisser passer l'erreur.
     */
    toString() {
        return this.value + "";
    }
    valueOf() {
        return this.value;
    }
    toJSON() {
        return this.value;
    }
}
// Non énumérable, sinon `for..in` la remonterait sur chaque signal du programme, et une
// énumération d'API qui change selon le minificateur n'est pas une énumération d'API. C'est la
// SEULE divergence ici, et elle est déjà arbitrée : voir ADR-0004, « écrire un prototype à la
// main pour préserver l'énumérabilité — refusé », et SPEC §21.
//
// Inscriptible et configurable comme la baseline, qui fige `conv#12` à
// `{writable:true, enumerable:true, configurable:true}`. Rendre la marque non inscriptible
// aurait été une divergence de plus, donc un ADR de plus à écrire, pour protéger d'un accident
// qu'aucun code ne provoque. On ne s'écarte pas de la compatibilité sans raison.
Object.defineProperty(Signal.prototype, "brand", {
    value: BRAND_SYMBOL,
    enumerable: false,
    writable: true,
    configurable: true,
});
export function signal(value, options) {
    return new Signal(value, options);
}
