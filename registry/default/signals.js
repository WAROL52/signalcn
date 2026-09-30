/**
 * Moteur de signaux réactifs agnostique des frameworks.
 *
 * Source de vérité. Distribuée telle quelle : le fichier compilé est cette source, et les
 * fichiers `.js` d'un projet utilisateur ne sont que ses copies.
 */
/**
 * Huit propriétés-own, dans cet ordre exact. L'ordre EST le contrat (SPEC §5.3) : il est
 * observable par `Object.keys`, donc figé.
 */
class Signal {
    constructor(value) {
        this._value = value;
        this._version = 0;
        this._node = null;
        this._targets = null;
        this._batchSnapshotVersion = -1;
        this._watched = null;
        this._unwatched = null;
        // La clé doit exister même quand le nom est absent : `Object.keys` la révèle toujours.
        this.name = undefined;
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
        //   NaN -> NaN   : `NaN !== NaN`  -> vrai  -> écriture acceptée, notifié
        //   0   -> -0    : `0 !== -0`     -> faux  -> écriture ignorée, valeur restée 0
        //   -0  -> 0     : `-0 !== 0`     -> faux  -> écriture ignorée, valeur restée -0
        //   objet ≠ objet: `!==`           -> vrai  -> notifié
        //   même référence: `!==`           -> faux  -> ignoré
        //
        // Donc pas de `Object.is` ici, et pas de branche spéciale pour `NaN`.
        if (this._value !== next) {
            this._value = next;
            this._version++;
        }
    }
}
/**
 * Crée un signal en lecture-écriture.
 *
 * Les options arrivent plus tard : la surface de `signal()` complète est une autre tranche.
 */
export function signal(value) {
    return new Signal(value);
}
