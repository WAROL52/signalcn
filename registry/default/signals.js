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
        // `undefined` et non omis, pour que la forme de la classe ne reste pas stable quand le
        // grapage arrive — `docs/architecture.md` §2 : la forme de la classe est un contrat, pas un
        // accident de la phase de développement.
        this._node = undefined;
        this._targets = undefined;
        // 0, comme la baseline. Ce champ note à quel instant de batch le signal a été photographié,
        // et l'instant d'un batch top-level vaut toujours un entier positif : 0 ne peut donc jamais
        // entrer en collision avec un instant réel, et un -1 serait une divergence gratuitement
        // inventée.
        this._batchSnapshotVersion = 0;
        this._watched = options?.watched;
        this._unwatched = options?.unwatched;
        // La clé doit exister même quand le nom est absent : `Object.keys` la révèle toujours.
        this.name = options?.name;
    }
    get value() {
        // L'ALLOCATION DU NŒUD EST ICI, pas dans le calculateur. Une lecture enregistre sa dépendance
        // en passant par `newNode`, qui renvoie `undefined` s'il n'y a personne pour l'accueillir : une
        // lecture hors de tout computé est donc aussi bon marché qu'une lecture de propriété.
        const node = newNode(this);
        if (node !== undefined)
            node._version = this._version;
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
            // SPEC §15.1 — le compteur d'itérations de drainage est armé DEPUIS LE SETTER. Le compteur,
            // lui, n'avance que dans le drainage : écrire dans le corps d'un batch ne l'avance pas, et
            // c'est ce qui compte les itérations de drainage et non les écritures.
            if (batchIteration > SEUIL_CYCLE)
                throw new Error("Cycle detected");
            recordBatchSnapshot(this);
            this._value = next;
            this._version++;
            globalVersion++;
            // Notifier DANS une portée, puis la refermer. La profondeur monte AVANT les notifications pour
            // qu'un effet réveillé ici s'empile dans la file au lieu de se lancer immédiatement, et le
            // `finally` garantit que la profondeur est rendue même si un effet lève — sans quoi une
            // exception laisserait le moteur dans une portée permanent, et plus rien ne drainerait jamais.
            batchDepth++;
            try {
                for (let node = this._targets; node !== undefined; node = node._targetPrev) {
                    node._target._notify();
                }
            }
            finally {
                endBatch();
            }
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
     * Ajoute un abonné. Insertion en TÊTE de `_targets` : seule la longueur compte pour cette
     * liste, alors que l'ordre des dépendances est sémantique.
     *
     * Le premier abonné déclenche `watched`, en dehors de tout suivi : un crochet qui s'abonnerait
     * à ce qu'il lit transformerait une observation en dépendance, et le graphe croirait avoir une
     * source de plus.
     */
    _addNode(node) {
        const tete = this._targets;
        // Le nœud est-il DÉJÀ abonné ? `tete === node` couvre la tête, et `_targetPrev !== undefined`
        // couvre le reste de la chaîne. Sans ce second test, réattacher un nœud déjà présent le
        // rattachait à la tête alors qu'il était plus loin dans la liste : la liste devenait
        // CYCLED, et le parcours des abonnés ne finissait jamais. `_removeNode` remet les deux maillons
        // à `undefined`, donc c'est aussi ce qui rend le ré-abonnement possible après un retrait.
        if (tete === node || node._targetPrev !== undefined)
            return;
        // Le nouveau devient la tête. `_targetPrev` pointe donc vers l'ANCIEN, et l'ancien pointe vers
        // le nouveau par `_targetNext` — les deux maillons en sens opposé, comme dans la liste des
        // dépendances. Le parcours part de `_targetPrev`.
        node._targetPrev = tete;
        node._targetNext = undefined;
        if (tete !== undefined)
            tete._targetNext = node;
        this._targets = node;
        if (tete === undefined)
            untracked(() => this._watched?.call(this));
    }
    /**
     * Retire un abonné. Le DERNIER departing déclenche `unwatched`, pour la même raison que
     * `watched` est en dehors du suivi.
     */
    _removeNode(node) {
        if (this._targets === undefined)
            return;
        // On recoud les deux voisins, et on ne touche à la tête que si le nœud en est une.
        if (node._targetNext !== undefined)
            node._targetNext._targetPrev = node._targetPrev;
        if (node._targetPrev !== undefined)
            node._targetPrev._targetNext = node._targetNext;
        if (node === this._targets) {
            this._targets = node._targetPrev;
            if (this._targets === undefined)
                untracked(() => this._unwatched?.call(this));
        }
        node._targetPrev = undefined;
        node._targetNext = undefined;
    }
    /** Un nœud a été invalidé. Un signal n'a rien à faire : c'est lui la source. */
    _notify() { }
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
    /**
     * SPEC §11 — s'abonner aux changements de ce signal.
     *
     * C'EST UN EFFECT INTERNE, et c'est ce que fait la baseline (`L427-435`) : un `effect` nommé
     * `"sub"` qui lit `this.value` puis appelle le rappel sous `untracked`. Aucun état propre, donc
     * rien qui distingue un abonné d'un effet — et c'est ce qui rend le rappel NON suivi.
     *
     * Le `untracked` autour du rappel est normatif : sans lui, une lecture faite dans le rappel
     * abonnerait l'appelant, et une écriture y propagerait. Le CHANGELOG 1.2.0 appelle ça
     * « subscribe unexpectedly tracking ».
     *
     * Le retour est le DISPOSITEUR de cet effet interne, pas une fonction dédiée : même forme que
     * celui de `effect()`, donc `name === "bound "` et `length === 0`.
     *
     * Lisons la valeur DANS le callback, avant le `untracked` : c'est cette lecture qui abonne
     * l'effet interne à ce signal. La poser à l'intérieur l'abonnerait aussi, mais par un chemin
     * qui n'a pas de nom ici — donc une seule lecture, avant, et le `untracked` ne couvre que le
     * rappel.
     */
    subscribe(fn) {
        const source = this;
        return effect(function () {
            const value = source.value;
            untracked(() => {
                fn(value);
            });
        }, { name: "sub" });
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
// ---- Le graphe de dépendances ------------------------------------------------------------------
//
// Une liaison sert dans deux listes doublement chaînées, et un seul objet les sert toutes les
// deux. C'est le choix central : un nœud porte son `_source` et son `_target`, et sa présence
// dans la liste des abonnés de la source et dans la liste des dépendances de la cible n'est pas
// deux objets, c'est le même.
/** La version d'un nœud `-1` est une sentinelle, pas une version. Voir `docs/architecture.md` §3. */
const ABANDONNE = -1;
/**
 * Qui est en train de calculer. UN SEUL : la collecte de dépendances est récursive par
 * construction, donc une pile serait inutile — un computé qui en appelle un autre REMPLACE le
 * collecteur, et le précédent est rendu par la closure de fin.
 */
let currentObserver = undefined;
/** Le compteur global. Incrémenté par toute écriture de signal, jamais par un computé. */
let globalVersion = 0;
/** La profondeur de portée. `0` signifie « pas dans une portée », et c'est le seul compte qui décide du drainage. */
let batchDepth = 0;
/**
 * Le compteur de drainages — le troisième état de module de `docs/architecture.md` §5.
 *
 * Il compte de MODULE, pas dans `endBatch`, et c'est délibéré : un compteur local serait remis à
 * zéro par une entrée réentrante, donc la borne posée dessus ne tomberait jamais. C'est lui qui
 * distingue « un programme lent » d'« un cycle ».
 */
let batchIteration = 0;
/**
 * La tête de la file d'effets différés.
 *
 * Elle est à la fois tête de PILE et tête de liste chaînée : la liste EST la pile, donc aucune
 * allocation à l'empilement et le drainage sort dans l'ordre inverse — LIFO. Cet ordre est
 * normatif, SPEC §13.4.
 *
 * Elle ne porte QUE des effets, et la raison est dans `Computed._notify`. Voir l'entrée de matrice
 * `batch#27`.
 */
let batchedEffect = undefined;
/**
 * Les écritures faites pendant le corps d'un `batch` utilisateur, pour pouvoir les REVERTIR.
 *
 * C'est une liste chaînée à part, distincte de la file d'effets : celle-ci dit « qui doit tourner »,
 * celle-là dit « qui est peut-être revenu ». Les deux se vident au même moment, mais pour des
 * raisons sans rapport, et les confondre ferait perdre la réconciliation.
 */
let batchSnapshots = undefined;
/**
 * Le jeton des snapshots. Il DÉDUPLIQUE : une seule entrée par signal et par batch.
 *
 * Sans lui, un signal écrit dix fois dans la même portée produirait dix entrées, dont neuf ne
 * décrivent plus rien. Le jeton est MONOTONE, jamais remis à zéro : le remettre à zéro ferait rejouer
 * les snapshots de la portée précédente, déjà consommés.
 */
let batchSnapshotVersion = 0;
/** Le jeton de la portée EN COURS. Comparé au jeton porté par chaque signal. */
let currentBatchSnapshotVersion = 0;
/**
 * La borne au-delà de laquelle un drainage s'arrête, et non programme lentement.
 *
 * Cent est un ORDRE DE GRANDEUR, pas une constante : la matrice fige la borne de la baseline à
 * 102, et SPEC §15.2 refuse explicitement de figer le nôtre. Un cycle borné doit pouvoir faire
 * cinquante tours sans lever — `effect#19` le vérifie.
 */
const SEUIL_CYCLE = 100;
/**
 * Exécute `fn` sans qu'aucune lecture n'inscrive de dépendance.
 *
 * C'est la fonction publique de SPEC §10, et elle sert aussi en interne aux crochets `watched` et
 * `unwatched`, qui ne doivent pas s'abonner à ce qu'ils lisent, et à `Computed.peek`, qui doit
 * actualiser sans laisser de dépendance. UNE implémentation pour les trois : les recopier ferait
 * trois endroits où le `finally` de restauration pourrait manquer.
 *
 * Elle neutralise le contexte de suivi, PAS le rafraîchissement : lire un computé ici le rafraîchit
 * quand même, elle ne réveille simplement aucune cible. Lire n'est pas invalider.
 *
 * Il lui manque un cas, et il est ailleurs : neutraliser aussi la portée de CAPTURE d'effets d'un
 * modèle englobant. Cela n'existe pas tant que `createModel` n'existe pas — c'est #28, et le JSDoc
 * de la baseline le signale déjà.
 */
export function untracked(fn) {
    const precedent = currentObserver;
    currentObserver = undefined;
    try {
        return fn();
    }
    finally {
        currentObserver = precedent;
    }
}
/**
 * Accroche un nœud à la liste des dépendances de son cible, EN TÊTE.
 *
 * UN SEUL point d'accrochage pour l'allocation et le recyclage. C'est la seule façon de garantir
 * que les deux font la même chose, et la différence s'était déjà payée une fois.
 */
function attacher(noeud, cible, source) {
    noeud._prev = cible._sources;
    noeud._next = undefined;
    if (cible._sources !== undefined)
        cible._sources._next = noeud;
    cible._sources = noeud;
    noeud._dansListe = true;
    // Une source ne s'abonne que si quelqu'un REGARDE l'cible. Sans abonné, personne n'a
    // besoin d'être prévenu, et le crochet `watched` ne doit pas se déclencher pour un calcul que
    // personne n'observe.
    if ((cible._flags & TRACKING) !== 0)
        source._addNode(noeud);
}
function createNode(source, target) {
    const node = {
        _version: 0,
        _source: source,
        _targetPrev: undefined,
        _targetNext: undefined,
        _next: undefined,
        _prev: undefined,
        _target: target,
        _dansListe: false,
        _recycled: undefined,
    };
    source._node = node;
    attacher(node, target, source);
    return node;
}
/**
 * Le nœud d'une dépendance, alloué ou recyclé.
 *
 * Deux cas seulement, et le second est tout l'intérêt : un nœud balayé qui est relu est
 * RÉACTIVÉ, pas réalloué. C'est ce qui borne la mémoire d'un computé dont les dépendances varient —
 * sans cela, chaque bascule d'un interrupteur laisserait un nœud orphelin derrière lui.
 */
function newNode(source) {
    if (currentObserver === undefined)
        return undefined;
    const node = source._node;
    // Pas de nœud, ou un nœud VIVANT d'un autre cible : allocation neuve.
    if (node === undefined || (node._target !== currentObserver && node._version !== ABANDONNE)) {
        return createNode(source, currentObserver);
    }
    // Réutilisable : à nous, ou balayé et n'appartenant plus à personne d'utile. On le réactive sans
    // réallouer, et on l'accroche s'il n'y est plus : un nœud retiré par la réconciliation reste
    // trouvable ici, et le rendre sans le réinsérer le ferait disparaître de la liste tout en
    // restant lisible.
    node._version = 0;
    if (node._target !== currentObserver) {
        if (node._targetNext !== undefined)
            node._targetNext._targetPrev = node._targetPrev;
        if (node._targetPrev !== undefined)
            node._targetPrev._targetNext = node._targetNext;
        node._targetPrev = undefined;
        node._targetNext = undefined;
    }
    node._target = currentObserver;
    if (!node._dansListe)
        attacher(node, currentObserver, source);
    return node;
}
/**
 * Prépare la liste des dépendances pour le prochain calcul : chaque nœud encore présent est
 * marqué `ABANDONNE`, et chacun mémorise le nœud qu'il évince. Rien n'est encore détaché — la
 * collecte d'un nœud survécu décidera après le calcul, ce qui garantit qu'une dépendance lue
 * puis abandonnée dans le MÊME passage reste valide.
 */
function cleanupSources(node) {
    // Parcours par `_next` depuis la tête, donc depuis la source la PLUS ANCIENNE, vers les plus
    // récentes — ADR-0009. La liste se parcourt dans cet ordre, et à la fin la tête est recrochée sur
    // la queue, c'est-à-dire sur la source lue en dernier.
    //
    // La version qui suivait `_prev` visitait la liste à l'envers et ne recoupait pas la tête : le
    // recalcul partait de la mauvaise extrémité, et une version de cette fonction oubliait le
    // recoupement — la liste ne contenait alors plus que les nœuds ajoutés pendant le calcul.
    for (let current = node._sources; current !== undefined; current = current._next) {
        const source = current._source;
        if (source._node !== undefined)
            current._recycled = source._node;
        source._node = current;
        current._version = ABANDONNE;
        if (current._next === undefined) {
            node._sources = current;
            break;
        }
    }
}
/**
 * Balaye les nœuds que le calcul n'a pas resservis, et réenracine la liste.
 *
 * La liste est reconstruite en ne gardant que les survivants. Un nœud abandonné se détache de la
 * liste des abonnés de sa source : sans cela il la préviendrait à jamais, et une dépendance
 * qu'on a ceased de lire coûterait un calcul à chaque écriture de la programme.
 */
function cleanupDependency(node) {
    // `cleanupSources` a pointé `_sources` sur la QUEUE, donc on redescend vers la tête par `_prev`.
    // Le dernier survivant croisé est le plus ancien — c'est lui la nouvelle tête, et l'ordre de
    // lecture est donc l'ordre de la liste. ADR-0009.
    let tete = undefined;
    for (let current = node._sources; current !== undefined;) {
        const precedent = current._prev;
        if (current._version === ABANDONNE) {
            current._source._removeNode(current);
            current._dansListe = false;
            // Le nœud quitté se détache de la liste des dépendances, sinon il resterait atteignable par un
            // parcours et continuerait d'y figurer. Les deux maillons sont recousus autour de lui.
            if (precedent !== undefined)
                precedent._next = current._next;
            if (current._next !== undefined)
                current._next._prev = precedent;
        }
        else {
            tete = current;
        }
        // Restaurer le pointeur du nœud d'origine SEULEMENT s'il y en avait un. Un nœud alloué
        // PENDANT ce calcul n'a pas d'origine à restaurer : `createNode` vient de poser
        // `source._node = node`, et le remettre à `undefined` effacerait l'abonnement qu'on vient de
        // créer. C'est ce qui faisait disparaître le premier effet de la liste des abonnés de sa source.
        if (current._recycled !== undefined)
            current._source._node = current._recycled;
        current._recycled = undefined;
        current = precedent;
    }
    if (tete !== undefined)
        node._sources = tete;
}
/**
 * Enregistre l'état pré-batch d'un signal, une fois par portée.
 *
 * Deux conditions, et chacune compte. `batchIteration !== 0` : on est dans un DRAINAGE — donc dans
 * l'exécution d'un effet, pas dans le callback de l'utilisateur. Sans celle-là, une écriture faite
 * par un effet pendant le drainage serait snapshotée, et la réconciliation pourrait « reverdir » un
 * signal que l'utilisateur n'a jamais écrit. `batch#20` le vérifie.
 *
 * `currentBatchSnapshotVersion === 0` : aucune portée UTILISATEUR n'est ouverte. C'est le filet de la
 * seconde, et il est ici parce que le jeton se lit ici. `Effect._start` ouvre et referme lui aussi une
 * portée, mais SANS jeton — donc son premier run, qui s'exécute hors drainage, verrait sinon une
 * écriture snapshotée avec le jeton de la portée précédente, et son `endBatch` la réconcilierait. Le
 * jeton est remis à zéro en fin de drainage ; il ne peut donc être non nul que dans un `batch`.
 */
function recordBatchSnapshot(source) {
    if (batchIteration !== 0 || currentBatchSnapshotVersion === 0)
        return;
    if (source._batchSnapshotVersion !== currentBatchSnapshotVersion) {
        source._batchSnapshotVersion = currentBatchSnapshotVersion;
        batchSnapshots = {
            _source: source,
            _value: source._value,
            _version: source._version,
            _next: batchSnapshots,
        };
    }
}
/**
 * Avance la version des nœuds dont la source est revenue à son état pré-batch.
 *
 * La comparaison est `===` et NON `Object.is` — c'est toute la différence entre les deux
 * comportements observables : `NaN === NaN` est faux, donc un signal laissé à `NaN` n'est jamais
 * considéré comme revenu ; `-0 === 0` est vrai, donc un signal qui passe de `-0` à `0` l'est
 * toujours. Lu dans la baseline, ligne 180.
 *
 * Les versions n'avANCENT JAMAIS à rebours. Un computé a pu observer une version intermédiaire
 * pendant le batch ; la lui rendre autoriserait une future écriture à réémettre ce numéro pour une
 * autre valeur, et le computé la jugerait à jamais inchangée. D'où le fast-forward : on SAUTE la
 * génération, pas le temps.
 */
function reconcileBatchSnapshots() {
    let snapshots = batchSnapshots;
    batchSnapshots = undefined;
    while (snapshots !== undefined) {
        const source = snapshots._source;
        if (source._value === snapshots._value) {
            for (let node = source._targets; node !== undefined; node = node._targetPrev) {
                if (node._version === snapshots._version) {
                    node._version = source._version;
                }
            }
        }
        snapshots = snapshots._next;
    }
}
/**
 * Vide la file d'effets différés.
 *
 * Le drainage est en LARGEUR et c'est le cœur du moteur. Quatre règles, et les confondre produit
 * une suite qui passe sur les graphes simples et échoue sur les vrais :
 *
 *   1. la file est DÉTACHÉE avant tout drainage, et la chaîne est DÉFAITE nœud par nœud pendant le
 *      drainage. Un effet notifié pendant le drainage s'empile donc dans la génération SUIVANTE,
 *      jamais dans celle qu'on est en train de vider — sans quoi la boucle ne finirait jamais ;
 *   2. on boucle JUSQU'À FILE VIDE. Ce qui est notifié pendant le drainage atterrit dans
 *      `batchedEffect` et sera pris au tour suivant. Compter sur une ré-entrée pour finir la
 *      chaîne obligerait `endBatch` à s'appeler lui-même, donc deux drains imbriqués ;
 *   3. les effets de la génération courante sont vidés EN ENTIER avant la suivante. C'est la
 *      différence entre largeur et profondeur ;
 *   4. un effet DISPOSÉ au moment où son tour arrive est sauté, sans callback.
 *
 * L'erreur retenue est la PREMIÈRE dans l'ordre de drainage, pas la première chronologique, et le
 * drainage continue malgré les erreurs — un effet qui lève n'en empêche pas dix autres de tourner.
 */
function endBatch() {
    if (batchDepth > 1) {
        batchDepth--;
        return;
    }
    let premiereErreur;
    let aErreur = false;
    try {
        // La réconciliation passe AVANT la boucle, jamais dedans : elle avance la version des nœuds
        // qui ont vu l'état pré-batch, et le drainage les CONSOMMERait avant qu'elle puisse le faire.
        reconcileBatchSnapshots();
        while (batchedEffect !== undefined) {
            batchIteration++;
            let generation = batchedEffect;
            batchedEffect = undefined;
            while (generation !== undefined) {
                // Défaire le maillon AVANT de lancer le nœud : il ne doit pas se voir lui-même dans la
                // chaîne qu'on vide, sinon il s'y retrouverait deux fois.
                const suivant = generation._nextBatchedEffect;
                generation._nextBatchedEffect = undefined;
                generation._flags &= ~(RUNNING | NOTIFIED);
                try {
                    if ((generation._flags & DISPOSED) === 0 && sourcesAreStale(generation)) {
                        generation._callback();
                    }
                }
                catch (erreur) {
                    if (!aErreur) {
                        aErreur = true;
                        premiereErreur = erreur;
                    }
                }
                generation = suivant;
            }
        }
    }
    finally {
        // L'état est rendu ICI, et l'erreur est levée APRÈS. Un `throw` depuis le `finally`
        // ÉCRASERAIT celle d'un effet — et SPEC §15.6 le veut : l'erreur d'un effet passe avant celle du
        // corps du `batch`. Rendre l'état d'abord est donc ce qui rend cet écrasement VOLONTAIRE.
        batchIteration = 0;
        batchDepth--;
        // Le jeton meurt avec la portée. Le remettre à zéro est sûr pour la déduplication parce que
        // `batchSnapshotVersion`, lui, reste MONOTONE : un jeton passé ne peut jamais_EQUALS un jeton
        // à venir, donc aucune entrée ancienne ne peut rejouer.
        currentBatchSnapshotVersion = 0;
    }
    if (aErreur)
        throw premiereErreur;
}
/**
 * Un nœud a-t-il une source périmée ? La même question pour un effet et pour un computé, donc
 * UNE fonction pour les deux — la duplication répondait à la même question deux fois, en
 * anglais et en français.
 *
 * Le parcours part de `_sources`, c'est-à-dire de la source lue EN PREMIER, et suit `_next` vers les
 * plus RÉCENTES — le seul sens qui remonte toute la liste. La règle est dans
 * `docs/adr/0009-geometrie-de-la-liste-des-dependances.md`, `docs/architecture.md` §3 la cite. C'est
 * ce qui autorise la sortie anticipée, et surtout ce qui fait qu'une cible à plusieurs sources en
 * VOIT toutes.
 *
 * `_prev` est le piège, et il est silencieux : il part de la tête, où il vaut `undefined`, donc il ne
 * rend qu'UN nœud. Partir par là visitait un nœud au lieu de la liste, sans lever — c'est ce qui
 * produisait une valeur périmée. Les trois autres parcours qui faisaient pareil sont au même endroit :
 * `disposeSelf`, et les deux surcharges de `Computed`.
 *
 * Le cycle indirect est ici : `_refresh` ne renvoie `false` que si la source est DÉJÀ en train de
 * se calculer, donc si l'on est à l'intérieur d'elle. C'est périmé, donc `true` — l'inverse
 * de cela, la source serait servie périmée et le cycle ne serait jamais détecté.
 */
function sourcesAreStale(node) {
    for (let current = node._sources; current !== undefined; current = current._next) {
        const source = current._source;
        if (source._version !== current._version)
            return true;
        if (source instanceof Computed && !source._refresh())
            return true;
        // Le refus, puis NOUVELLEMENT la version. `_refresh` vient d'évaluer la source, donc de lui
        // avancer sa version — même quand elle s'évalue bien. Sans cette troisième vérification, une
        // source fraîchement recalculée passerait pour inchangée et l'amont ne tournerait pas. C'est ce
        // que SPEC §13.6 exige : un computé invalidé puis relu sans cible réévalue et intègre les
        // écritures.
        if (source._version !== current._version)
            return true;
    }
    return false;
}
/**
 * Exécute un cleanup hors de tout contexte de suivi.
 *
 * `_sources` n'est PAS vidé ici, et c'est délibéré. Le vider « paraît » correct — le cleanup ne doit
 * pas se réabonner — mais le collecteur est déjà à `undefined` ci-dessous, donc AUCUN nœud ne peut
 * être créé : le vidage n'empêche rien et fait perdre la dépendance. `newNode` réactive les nœuds
 * existants, donc une liste vidée ne se reconstruit jamais.
 */
function runCleanupUntracked(effet) {
    const cleanup = effet._cleanup;
    if (typeof cleanup !== "function")
        return;
    effet._cleanup = undefined;
    const precedentObservateur = currentObserver;
    currentObserver = undefined;
    try {
        cleanup();
    }
    catch (erreur) {
        // Un cleanup qui lève DISPOSE l'effet. Il a lecteurs au milieu d'un drainage, et le laisser
        // en vie l'obligerait à tourner avec des nœuds incohérents.
        effet._flags |= DISPOSED;
        disposeSelf(effet);
        throw erreur;
    }
    finally {
        currentObserver = precedentObservateur;
    }
}
/** Détache l'effet de toutes ses sources. Sans l'effet, il ne peut plus être réveillé. */
function disposeSelf(effet) {
    // Un seul parcours, dans l'ordre de LECTURE : la tête est la source la plus ancienne, donc `_next`
    // descend vers les plus récentes — ADR-0009. C'est aussi l'ordre des crochets `unwatched`, et il est
    // observable. La version précédente devait descendre jusqu'au maillon `_prev` puis remonter par
    // `_next`, en deux passages, précisément parce que la tête était du bon côté.
    for (let noeud = effet._sources; noeud !== undefined; noeud = noeud._next) {
        noeud._source._removeNode(noeud);
    }
    effet._fn = undefined;
    effet._sources = undefined;
    runCleanupUntracked(effet);
}
// ---- La classe Effect ------------------------------------------------------------------------
/**
 * Un effect : une fonction qui rejoue tant que ses dépendances changent.
 */
export class Effect {
    constructor(fn, options) {
        this._fn = fn;
        this._cleanup = undefined;
        this._sources = undefined;
        this._nextBatchedEffect = undefined;
        // `TRACKING` dès la construction : l'effet est le PREMIER cible de ce qu'il lit, donc il
        // ouvre les abonnements de ses sources sans attendre un second.
        this._flags = TRACKING;
        this.name = options?.name;
    }
    /** Le corps de l'effet, collecte des dépendances comprise. C'est ce qu'une écriture déclenche. */
    _callback() {
        const finir = this._start();
        try {
            if ((this._flags & DISPOSED) !== 0)
                return;
            if (this._fn === undefined)
                return;
            const rendu = this._fn();
            // Une valeur de retour qui n'est pas une fonction est IGNORÉE, sans erreur — SPEC §8.1.
            if (typeof rendu === "function")
                this._cleanup = rendu;
        }
        finally {
            finir();
        }
    }
    /**
     * Ouvre une exécution : collecte les dépendances, et rend la fermeture qui la termine.
     *
     * Le `_cleanup` du run précédent est exécuté ICI, avant la collecte — SPEC §8.1. Donc un
     * cleanup voit la valeur qui vient d'écrire, pas celle de son propre run.
     */
    _start() {
        if ((this._flags & RUNNING) !== 0)
            throw new Error("Cycle detected");
        // `RUNNING` se POSE et reste pose pendant tout le corps, et c'est ce qui rend le garde du
        // cycle auto vrai. Le poser puis l'effacer sur la ligne suivante — ce que faisait une version
        // de ce code — le rendait inobservable : le garde ne s'attrapait jamais, et `this.dispose()`
        // appelé DANS le run démontait l'effet au lieu de differer à la fermeture.
        //
        // `DISPOSED` s'efface en même temps : un effet était disposé pendant une génération
        // précédente et se réveille — il ne doit pas heriter de son propre dispose.
        this._flags |= RUNNING;
        this._flags &= ~(NOTIFIED | DISPOSED);
        runCleanupUntracked(this);
        cleanupSources(this);
        const precedentObservateur = currentObserver;
        currentObserver = this;
        batchDepth++;
        return () => {
            // Se refermer dans le désordre est un BUG, pas un cas : le collecteur de dépendances
            // appartient à un effet à la fois, et deux effets imbriqués se referment en ordre inverse.
            if (currentObserver !== this)
                throw new Error("Out-of-order effect");
            cleanupDependency(this);
            currentObserver = precedentObservateur;
            // Relâcher `RUNNING` ICI, et nulle part ailleurs. Le drainage le fait aussi pour le nœud
            // qu'il traite, mais un premier run_Create-déclenché hors drainage ne repasse jamais par là :
            // sans ce relâchement, `RUNNING` restait posé pour toujours, et `_dispose()` différait vers
            // une fermeture qui ne reviendrait jamais — donc le cleanup ne tournait plus jamais.
            //
            // `NOTIFIED` n'est PAS relâché ici, et c'est `#35`. Personne ne le pose pendant le run non
            // plus : au moment où l'effet a fini, il est encore marqué notifié de ce qu'il vient
            // d'écrire, et c'est cette mémoire qui l'empêche de se réempiler dans la file que le drainage
            // vient de vider. Effacer ce drapeau ici effaçait cette mémoire : l'effet se notifiait
            // lui-même à l'écriture suivante, et deux effets qui s'écrivent l'un l'autre refermaient la
            // chaîne sur elle-même — la génération ne finissait plus, `batchIteration` ne montait plus,
            // et la borne de drainage n'arrivait jamais. La baseline `endEffect` ne relâche que
            // `RUNNING` (`L847`).
            this._flags &= ~RUNNING;
            if ((this._flags & DISPOSED) !== 0)
                disposeSelf(this);
            // Refermer la portée que `_start` a ouvert. C'est ce qui borne le cycle d'auto-écriture ET ce
            // qui draine ce que le run vient d'écrire.
            endBatch();
        };
    }
    /**
     * Une écriture a touché une source. On n'empile que si l'effet ne l'est pas déjà : deux écritures
     * dans la même portée ne doivent produire qu'un passage.
     */
    _notify() {
        if ((this._flags & NOTIFIED) !== 0)
            return;
        this._flags |= NOTIFIED;
        this._nextBatchedEffect = batchedEffect;
        batchedEffect = this;
    }
    /** Le dispositeur externe, et celui que `this.dispose()` appelle. */
    _dispose() {
        this._flags |= DISPOSED;
        // Si l'effet est en train de tourner, on ne peut pas le démonter maintenant : `_start` s'en
        // chargera à la fermeture, et le callback en cours se terminera proprement.
        if ((this._flags & RUNNING) === 0)
            disposeSelf(this);
    }
    dispose() {
        this._dispose();
    }
}
// La marque sur le prototype de l'effet, et non seulement sur celui du signal : `Effect` ne
// descend pas de `Signal`, donc il ne l'hérite pas. C'est la même extension de
// `docs/architecture.md` §2, et elle est nécessaire : sans elle, la détection de sous-objet d'un
// modèle (`createModel`, #28) descendedrait dans un effet — un objet qui n'a aucune source à
// liquider — et lui attribuerait des dépendances.
Object.defineProperty(Effect.prototype, "brand", {
    value: BRAND_SYMBOL,
    enumerable: false,
    writable: true,
    configurable: true,
});
export function effect(fn, options) {
    const effet = new Effect(fn, options);
    try {
        effet._callback();
    }
    catch (erreur) {
        effet._dispose();
        throw erreur;
    }
    // `SPEC.md` §8.2 exige `name === "bound "`, `length === 0`, `Object.keys()` vide,
    // `[Symbol.dispose] === d`, utilisable avec `using`, ni une arrow ni l'instance.
    //
    // Les six tiennent — mais PAS avec `_dispose.bind(effet)`. V8 refuse une fonction LIÉE dont
    // `Symbol.dispose` pointe sur elle-même ; une fonction simple passe, une liée non. Le refus
    // vient donc du `bind`, pas de l'identité — et `this` n'est jamais demandé au dispositeur,
    // `§8.3` ne le demande qu'au CALLBACK. D'où la fermeture : elle rend les six-tenables.
    // C'est mesuré, pas supposé : `signalcn-seul/symbol-dispose-et-using` rejoue les deux.
    const dispositeur = function () {
        effet._dispose();
    };
    // Un nom de méthode ne peut pas être vide — il serait `dispositeur` — donc la valeur est
    // écrite explicitement, comme l'exige §8.2.
    Object.defineProperty(dispositeur, "name", { value: "bound ", configurable: true });
    dispositeur[Symbol.dispose] = dispositeur;
    return dispositeur;
}
/**
 * Regroupe les écritures et diffère leur propagation jusqu'à la sortie du callback.
 *
 * Un `batch` appelé alors qu'une portée est DÉJÀ ouverte n'ouvre rien : il se comporte comme un
 * simple appel. Donc seul le plus externe draine — SPEC §9.1.
 *
 * L'absence de comptabilité porte sur le DRAINAGE et sur la valeur de retour, pas sur le
 * `try`/`finally` : une exception dans un batch imbriqué remonte telle quelle au batch externe, qui
 * drainage puis re-throw. Sans ce `finally`, la profondeur resterait levée et plus rien ne drainerait.
 */
export function batch(fn) {
    if (batchDepth > 0)
        return fn();
    // Un jeton neuf pour la portée, attribué ICI et nulle part ailleurs : `currentBatch…` change donc
    // une fois par batch, et un signal ne peut être snapshoté qu'une fois par jeton.
    currentBatchSnapshotVersion = ++batchSnapshotVersion;
    batchDepth++;
    try {
        return fn();
    }
    finally {
        endBatch();
    }
}
// ---- Le computé --------------------------------------------------------------------------------
/**
 * Les six bits de `_flags`. Ils sont un ENSEMBLE, pas une liste : `_refresh` teste
 * `(flags & (OUTDATED | TRACKING)) === TRACKING`, et c'est le masque qui compte. Six puissances
 * de deux, comme `docs/architecture.md` §10.
 */
const RUNNING = 1;
const NOTIFIED = 2;
/**
 * Posé à la construction, au premier abonné et à chaque notification ; effacé avant recalcul.
 * C'est lui qui rend le garde-fou du cycle indirect : une source en cours d'évaluation le
 * renvoie encore, et `sourcesAreStale` en conclut qu'il faut recalculer.
 */
const OUTDATED = 4;
/**
 * Posé par `dispose()` et par un cleanup qui lève.
 *
 * Un effet disposé est SAUTÉ par le drainage quand son tour arrive, et un cleanup qui lève le
 * pose pour que le drainage ne le relance pas avec des nœuds incohérents.
 */
const DISPOSED = 8;
/** `_value` contient une exception, pas une valeur. Une dérivation peut valoir `undefined`. */
const HAS_ERROR = 16;
/**
 * Le nœud a au moins un abonné.
 *
 * Une source ne s'abonne à un computé que si quelqu'un le regarde, et c'est ce drapeau qui
 * commande ce raccord. Sans abonné, personne n'a besoin d'être prévenu — et c'est aussi pourquoi
 * la voie rapide de l'abonné ne peut court-circuiter que dans ce cas : sinon elle servirait une
 * valeur périmée en silence.
 */
const TRACKING = 32;
/**
 * Un signal dont la valeur dérive d'autres signaux, en lecture seule.
 *
 * DOUZE propriétés-own, dans cet ordre : les huit de `Signal` puis celles-ci. L'ordre est
 * contractuel (SPEC §6.1) et il découle de l'héritage — le constructeur de la base assigne les
 * huit premières, puis celles d'ici.
 */
export class Computed extends Signal {
    constructor(fn, options) {
        super(undefined, options);
        this._fn = fn;
        this._sources = undefined;
        this._globalVersion = globalVersion - 1;
        this._flags = OUTDATED;
    }
    /**
     * Actualise si besoin, et dit si quelque chose a bougé.
     *
     * Effet de bord assumé, et c'est un piège à connaître : appeler ceci sur une source COMPLÈTE
     * l'actualise. C'est ce qui rend le calcul transitif — un computed dont la source est un autre
     * computed ne peut pas servir une valeur périmée. Le `false` ne sort que si la cible est
     * DÉJÀ en train de se calculer, donc si l'on est à l'intérieur d'elle : c'est le garde du cycle
     * indirect, et il est là depuis le début plutôt que d'être découvert en comptant.
     */
    _refresh() {
        this._flags &= ~(RUNNING | NOTIFIED);
        if ((this._flags & RUNNING) !== 0)
            return false;
        if ((this._flags & (OUTDATED | TRACKING)) === TRACKING)
            return true;
        // `OUTDATED` retombe ici : chaque calcul repart d'une collecte de dépendances neuve. C'est ce
        // qui rend la réconciliation dynamique correcte — on ne garde d'un calcul à l'autre que ce
        // qui a été réellement relu.
        this._flags &= ~(OUTDATED | RUNNING);
        // Sortie rapide 1, dans l'ordre de `docs/architecture.md` §4 : le compteur global d'abord.
        // Elle est délibérément trop large — n'importe quelle écriture invalide le cache de tous les
        // computeds du programme. Le pire cas est un recalcul inutile, jamais une valeur fausse.
        if (this._globalVersion === globalVersion)
            return true;
        this._globalVersion = globalVersion;
        // Sortie rapide 2 : aucune source en retard. Court-circuite sans recalculer — et sans même lire
        // le compteur global au-delà du test ci-dessus, qui l'a déjà fait.
        //
        // AUCUN test de cible ici, comme la baseline (`L669`). Une version de ce code en exigeait un, au
        // motif que « sans cible, aucune source ne prévient, donc court-circuiter servirait une valeur
        // périmée ». C'était faux : `sourcesAreStale` compare les versions nœud par nœud, et ce parcours
        // ne dépend d'aucun abonnement. La preuve est le scénario
        // `computed/evaluation-dune-ecriture-non-liee` — un computé nu, deux écritures sur un signal
        // qu'il ne lit pas, puis une relecture : UNE évaluation des deux côtés, DEUX avec le test. Le
        // coût n'était donc jamais une valeur fausse, mais un recalcul de trop sur toute écriture non
        // liée — donc un effet de plus dans la fuite figée par `effect#34`.
        if (this._version > 0 && !sourcesAreStale(this)) {
            this._flags &= ~NOTIFIED;
            return true;
        }
        this._flags |= RUNNING;
        const precedentObservateur = currentObserver;
        try {
            cleanupSources(this);
            currentObserver = this;
            const valeur = this._fn();
            // On n'écrit que si quelque chose a bougé : sinon chaque lecture incrémenterait la version
            // et invaliderait les abonnés, alors que rien n'a changé.
            if ((this._flags & HAS_ERROR) !== 0 || this._value !== valeur || this._version === 0) {
                this._value = valeur;
                this._flags &= ~HAS_ERROR;
                this._version++;
            }
        }
        catch (erreur) {
            // L'erreur est STOCKÉE dans `_value`, et `RUNNING` est relâché plus bas comme partout : le
            // compteur global ayant été mis à jour avant le calcul, la voie rapide 2 court-circuite
            // ensuite, donc une deuxième lecture RELANCE l'erreur stockée sans réévaluer une seule fois.
            // Six lectures d'une dérivation qui jette coûtent une évaluation, pas six.
            this._value = erreur;
            this._flags |= HAS_ERROR;
            this._version++;
        }
        finally {
            currentObserver = precedentObservateur;
        }
        cleanupDependency(this);
        // `RUNNING` se relâche ICI, inconditionnellement, et NULLE PART ailleurs — la baseline aussi
        // (`L695`). Le mettre dans le `if` « la valeur a changé » le laissait POSÉ quand la valeur
        // restait identique, et le computé levait `Cycle detected` à la lecture SUIVANTE alors qu'il
        // n'avait aucune auto-rentrée : un `a % 2` qui vaut toujours 1 suffisait. Le Cycle devenait
        // donc indétectable par construction — exactement ce que le glossaire exige.
        this._flags &= ~(RUNNING | NOTIFIED);
        return true;
    }
    /** Une écriture reçue. Sans abonné, il n'y a personne à réveiller : le calcul est paresseux. */
    _notify() {
        if ((this._flags & NOTIFIED) !== 0)
            return;
        // `OUTDATED` AVEC `NOTIFIED`, et pas seulement `NOTIFIED`. La sortie rapide de `_refresh` teste
        // `(flags & (OUTDATED | TRACKING)) === TRACKING` : un computé suivi et notifié mais pas encore
        // marqué périmé s'en sort par là, et ne se recalcule jamais. C'est ce drapeau qui distingue
        // « suivi » de « suivi et périmé » — voir `docs/architecture.md` §10.
        this._flags |= NOTIFIED | OUTDATED;
        for (let node = this._targets; node !== undefined; node = node._targetPrev) {
            node._target._notify();
        }
    }
    /**
     * Le PREMIER abonné est ce qui raccorde le computé à ses sources.
     *
     * Sans cette surcharge, la chaîne `A → B → C → Effect` est coupée à son premier maillon : le
     * computé garde sa liste de dépendances — il se recalcule donc à la lecture — mais la source ne
     * le réveille jamais, et l'effet ne tourne pas.
     */
    _addNode(node) {
        if (this._targets === undefined) {
            this._flags |= OUTDATED | TRACKING;
            // Le parcours suit `_next` vers les plus récentes : `_prev` ne rendrait que la tête, donc un
            // computé à deux sources ne raccorderait que la première, et la chaîne `A → B → C → Effect`
            // serait coupée à son premier maillon. `effect#2` le vérifie.
            for (let source = this._sources; source !== undefined; source = source._next) {
                source._source._addNode(source);
            }
        }
        super._addNode(node);
    }
    /**
     * Le DERNIER abonné parti, on raccorde les sources. La symétrie est exacte : un computé observé
     * s'abonne, un computé abandonné se désabonne, et `watched`/`unwatched` suivent.
     */
    _removeNode(node) {
        super._removeNode(node);
        if (this._targets === undefined && (this._flags & TRACKING) !== 0) {
            this._flags &= ~(OUTDATED | TRACKING);
            // La symetrie exacte de l'abonnement, et donc le meme sens de parcours.
            for (let source = this._sources; source !== undefined; source = source._next) {
                source._source._removeNode(source);
            }
        }
    }
    get value() {
        // Cycle auto, détecté à la première relecture. Cent itérations pour découvrir qu'on se
        // regarde soi-même serait une dépense et une mauvaise nouvelle en production.
        if ((this._flags & RUNNING) !== 0)
            throw new Error("Cycle detected");
        const node = newNode(this);
        this._refresh();
        if (node !== undefined)
            node._version = this._version;
        if ((this._flags & HAS_ERROR) !== 0)
            throw this._value;
        return this._value;
    }
    peek() {
        // `peek()` est une lecture non abonnée — donc elle n'inscrit pas de nœud. Elle actualise
        // quand même, sinon `peek()` servirait une valeur périmée.
        return untracked(() => this.value);
    }
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
export function computed(fn, options) {
    return new Computed(fn, options);
}
/**
 * `action(fn)` rend une fonction qui, à chaque appel, regroupe ses écritures et les détache du
 * contexte de suivi courant.
 *
 * C'EST EXACTEMENT `batch` autour de `untracked`, et c'est tout — la baseline (`L991-993`) ne fait
 * rien d'autre. Aucune sémantique propre, donc aucun état propre à justifiesimplement, et c'est ce
 * qui permet à `createModel` de s'en servir pour envelopper chaque fonction d'un modèle.
 *
 * Le `fn` est appelé avec le `this` et les arguments reçus, et sa valeur de retour traverse — y
 * compris une promesse, l'appel n'en fait rien de particulier.
 */
export function action(fn) {
    // Le nom est un CONTRACT, pas une étiquette : la matrice de conformité le fige, et le pipeline de
    // génération a besoin de `--keep-names` pour le conserver. Sans lui il devient la chaîne vide,
    // et la trace d'erreur qui le cite devient fausse.
    const actionWrapper = function (...args) {
        return batch(() => untracked(() => fn.apply(this, args)));
    };
    return actionWrapper;
}
