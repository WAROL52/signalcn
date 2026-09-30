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
            horsSuivi(() => this._watched?.call(this));
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
                horsSuivi(() => this._unwatched?.call(this));
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
/** La profondeur de portée. `0` signifie « pas dans une portée », et c'est le seul compte qui décide du flush. */
let batchDepth = 0;
/**
 * Le compteur de générations de flush — le troisième état de module de `docs/architecture.md` §5.
 *
 * Il compte de MODULE, pas dans `endBatch`, et c'est délibéré : un compteur local serait remis à
 * zéro par une entrée réentrante, donc le seuil posé dessus ne tomberait jamais. C'est lui qui
 * distingue « un programme lent » d'« un cycle ».
 */
let batchIteration = 0;
/**
 * La tête de la file d'effets différés.
 *
 * Elle est à la fois tête de PILE et tête de liste chaînée : la liste EST la pile, donc aucune
 * allocation à l'empilement et le drainage sort dans l'ordre inverse — LIFO. Cet ordre est
 * normatif, SPEC §13.4.
 */
let batchedEffect = undefined;
/**
 * Le drainage est-il en cours ?
 *
 * Un effect ouvre sa propre portée — c'est ce qui borne son cycle d'auto-écriture — et la referme en
 * appelant `endBatch`. S'il appelle `endBatch` depuis l'intérieur d'un drainage, il ne doit pas
 * lancer un second drainage IMBRIQUÉ : deux drains imbriqués décrémenteraient deux fois la
 * profondeur, et chacun viderait une génération que l'autre vide aussi. Le drapeau dit au drainage
 * en cours de s'en charger : la file est déjà détachée, donc tout ce qui est empilé pendant ce
 * temps sera pris au tour suivant de SA boucle.
 */
let enDrain = false;
/**
 * Le seuil au-delà duquel un flush est un cycle et non un programme lent.
 *
 * Cent est un ORDRE DE GRANDEUR, pas une constante : la matrice fige le seuil de la baseline à
 * 102, et SPEC §15.2 refuse explicitement de figer le nôtre. Un cycle borné doit pouvoir faire
 * cinquante tours sans lever — `effect#19` le vérifie.
 */
const SEUIL_CYCLE = 100;
/**
 * Exécute `fn` sans qu'aucune lecture n'inscrive de dépendance.
 *
 * C'est `untracked`, mais interne et restreint : ici il sert aux crochets `watched` et
 * `unwatched`, qui ne doivent pas s'abonner à ce qu'ils lisent, et à `Computed.peek`, qui doit
 * actualiser sans laisser de dépendance. #26 en fera la fonction publique — et son corps y ira
 * tel quel, à un `capturedEffects` près que le flush de batch amènera.
 */
function horsSuivi(fn) {
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
    // Parcours par `_prev` depuis la tête, donc depuis la source lue en dernier : c'est le sens qui
    // remonte toute la liste. Une version de cette fonction suivait `_next`, et — `_sources` pointant
    // alors la source la plus ancienne après le balayage — ne visitait que le PREMIER nœud. Seule la
    // tête était alors marquée abandonnée, si bien qu'une dépendance quittée au milieu de la liste
    // n'était jamais détachée et continuait de notifier à jamais.
    for (let current = node._sources; current !== undefined; current = current._prev) {
        const source = current._source;
        if (source._node !== undefined)
            current._recycled = source._node;
        source._node = current;
        current._version = ABANDONNE;
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
    let tete = undefined;
    let premier = undefined;
    for (let current = node._sources; current !== undefined;) {
        const precedent = current._prev;
        if (current._version === ABANDONNE) {
            current._source._removeNode(current);
            current._dansListe = false;
        }
        else {
            // On parcourt de la plus récente vers les plus anciennes, et on raccroche chaque survivant
            // APRÈS celui déjà posé. `premier` reste le premier survu — donc le plus récent — et c'est
            // lui qui redevient la tête : `_sources` pointe toujours la source lue en dernier.
            current._next = tete;
            if (tete !== undefined)
                tete._prev = current;
            if (premier === undefined)
                premier = current;
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
    if (premier !== undefined)
        premier._next = undefined;
    node._sources = premier;
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
 * L'erreur retenue est la PREMIÈRE dans l'ordre de flush, pas la première chronologique, et le
 * drainage continue malgré les erreurs — un effet qui lève n'en empêche pas dix autres de tourner.
 */
function endBatch() {
    if (batchDepth > 1) {
        batchDepth--;
        return;
    }
    if (enDrain) {
        // Profondeur rendue, mais le drainage en cours reprendra ce qui a été empilé entre-temps.
        batchDepth--;
        return;
    }
    let premiereErreur;
    let aErreur = false;
    enDrain = true;
    try {
        while (batchedEffect !== undefined) {
            // Le garde de cycle. Une chaîne qui avance d'un maillon à chaque génération SANS qu'aucune
            // écriture ne la relance est un cycle : on le dit, plutôt que de tourner jusqu'à épuisement
            // de la mémoire, ce qui est la pire manière de planter.
            if (++batchIteration > SEUIL_CYCLE) {
                aErreur = true;
                premiereErreur = new Error("Cycle detected");
                break;
            }
            let generation = batchedEffect;
            batchedEffect = undefined;
            while (generation !== undefined) {
                // Défaire le maillon AVANT de lancer le nœud : il ne doit pas se voir lui-même dans la
                // chaîne qu'on vide, sinon il s'y retrouverait deux fois.
                const suivant = generation._nextBatchedEffect;
                generation._nextBatchedEffect = undefined;
                generation._flags &= ~(RUNNING | NOTIFIED);
                try {
                    if (generation instanceof Effect) {
                        if ((generation._flags & DISPOSED) === 0 && sourcesAreStale(generation)) {
                            generation._callback();
                        }
                    }
                    else {
                        const calcule = generation;
                        // Un computé se RÉACTUALISE, et ne réveille ses abonnés que si sa valeur a changé.
                        // C'est ce notify qui fait avancer la chaîne d'un maillon.
                        const versionAvant = calcule._version;
                        if (sourcesAreStale(calcule))
                            calcule._refresh();
                        if (calcule._version !== versionAvant) {
                            for (let noeud = calcule._targets; noeud !== undefined; noeud = noeud._targetPrev) {
                                noeud._target._notify();
                            }
                        }
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
        // L'état est rendu ICI, et l'erreur est levée APRÈS : un `throw` depuis le `finally`
        // remplacerait celle du cycle par celle d'un effet, et le cycle serait perdu sans un bruit.
        // C'est ce que dit `docs/architecture.md` §5 — le flush n'a pas de `try`/`finally` qui porte
        // l'erreur.
        enDrain = false;
        batchIteration = 0;
        batchDepth--;
    }
    if (aErreur)
        throw premiereErreur;
}
/**
 * Un nœud a-t-il une source périmée ? La même question pour un effet et pour un computé, donc
 * UNE fonction pour les deux — la duplication répondait à la même question deux fois, en
 * anglais et en français.
 *
 * Le cycle indirect est ici : `_refresh` ne renvoie `false` que si la source est DÉJÀ en train de
 * se calculer, donc si l'on est à l'intérieur d'elle. C'est périmé, donc `true` — l'inverse
 *这么大, la source serait servie périmée et le cycle ne serait jamais détecté.
 */
function sourcesAreStale(node) {
    for (let current = node._sources; current !== undefined; current = current._next) {
        const source = current._source;
        if (source._version !== current._version)
            return true;
        if (source instanceof Computed && !source._refresh())
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
            // qu'il traite, mais un premier run_Create-declenché hors drainage ne repasse jamais par là :
            // sans ce relâchement, `RUNNING` restait posé pour toujours, et `_dispose()` différait vers
            // une fermeture qui ne reviendrait jamais — donc le cleanup ne tournait plus jamais.
            this._flags &= ~(RUNNING | NOTIFIED);
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
    const dispositeur = effet._dispose.bind(effet);
    // `name === "bound "` est figé par SPEC §8.2 et par la matrice. Un nom de méthode ne peut pas être
    // vide — `bind` produit `bound _dispose` — donc la valeur est écrite explicitement.
    Object.defineProperty(dispositeur, "name", { value: "bound ", configurable: true });
    // `Symbol.dispose` est une FONCTION, et pas le dispositeur lui-même. SPEC §8.2 veut les deux et
    // ils sont MUTUELLEMENT EXCLUSIFS : V8 refuse une fonction liée comme méthode de libération, donc
    // `d[Symbol.dispose] === d` EMPÊCHE `using` de fonctionner. On garde `using`, parce que c'est la
    // seule des deux visible depuis du code utilisateur — voir #34.
    dispositeur[Symbol.dispose] = () => dispositeur();
    return dispositeur;
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
        // Sortie rapide 2 : des abonnés, et aucune source en retard. Court-circuite sans même lire le
        // compteur global — un computé observé ne peut pas avoir changé.
        //
        // Le test d'abonné n'est pas une optimisation, c'est une CORRECTION. Sans abonné, aucune
        // source ne prévient : la seule chose qui dise que le cache est périmé, c'est le compteur
        // global. Court-circuiter ici rendrait une valeur périmée, silencieusement.
        if ((this._flags & TRACKING) !== 0 && this._version > 0 && !sourcesAreStale(this)) {
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
                this._flags &= ~(HAS_ERROR | RUNNING);
                this._version++;
            }
        }
        catch (erreur) {
            // L'erreur est STOCKÉE dans `_value` et `CALCUL` relâché. Relâché est ce qui compte : le
            // compteur global ayant été mis à jour avant le calcul, la voie rapide 2 court-circuite
            // ensuite, donc une deuxième lecture RELANCE l'erreur stockée sans réévaluer une seule fois.
            // Six lectures d'une dérivation qui jette coûtent une évaluation, pas six.
            this._value = erreur;
            this._flags = (this._flags & ~RUNNING) | HAS_ERROR;
            this._version++;
        }
        finally {
            currentObserver = precedentObservateur;
        }
        cleanupDependency(this);
        this._flags &= ~NOTIFIED;
        return true;
    }
    /**
     * Vrai si une source a bougé depuis que la cible l'a vue.
     *
     * Le parcours part de `_sources`, c'est-à-dire de la source lue EN DERNIER, et remonte vers les
     * plus anciennes. C'est ce qui autorise la sortie anticipée : si la plus récemment utilisée est
     * périmée, il est inutile de regarder les autres.
     *
     * Le second test sur la version n'est pas redondant : `_refresh()` peut être appelé sur une
     * source computé ci-dessus et faire bouger sa version.
     */
    /** Une écriture reçue. Sans abonné, il n'y a personne à réveiller : le calcul est paresseux. */
    _notify() {
        if ((this._flags & NOTIFIED) !== 0)
            return;
        // `OUTDATED` AVEC `NOTIFIED`, et pas seulement `NOTIFIED`. La sortie rapide de `_refresh` teste
        // `(flags & (OUTDATED | TRACKING)) === TRACKING` : un computé suivi et notifié mais pas encore
        // marqué périmé s'en sort par là, et ne se recalcule jamais. C'est ce drapeau qui distingue
        // « suivi » de « suivi et périmé » — voir `docs/architecture.md` §10.
        this._flags |= NOTIFIED | OUTDATED;
        this._nextBatchedEffect = batchedEffect;
        batchedEffect = this;
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
        return horsSuivi(() => this.value);
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
