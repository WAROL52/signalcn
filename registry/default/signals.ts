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
const BRAND_SYMBOL = Symbol.for("preact-signals")

/**
 * Huit propriétés-own, dans cet ordre exact. L'ordre EST le contrat (SPEC §5.3) : il est
 * observable par `Object.keys`, donc figé.
 *
 * Quatre d'entre elles sont encore des `null` parce que rien ne les peuple : le graphe arrive
 * avec `computed` et `effect`. Elles sont déclarées `null` et non pas typées, parce qu'une classe
 * `Node` qui n'existe pas encore serait de l'imagination, et qu'un `any` ferait perdre la
 * vérification de type au moment exact où le graphe arrive.
 */
export class Signal<T = undefined> {
  _value: T
  _version: number
  _node: Node | undefined
  _targets: Node | undefined
  _batchSnapshotVersion: number
  _watched: (() => void) | undefined
  _unwatched: (() => void) | undefined
  name: string | undefined

  constructor(value?: T, options?: SignalOptions<T>) {
    this._value = value as T
    this._version = 0
    // `undefined` et non omis, pour que la forme de la classe ne reste pas stable quand le
    // grapage arrive — `docs/architecture.md` §2 : la forme de la classe est un contrat, pas un
    // accident de la phase de développement.
    this._node = undefined
    this._targets = undefined
    // 0, comme la baseline. Ce champ note à quel instant de batch le signal a été photographié,
    // et l'instant d'un batch top-level vaut toujours un entier positif : 0 ne peut donc jamais
    // entrer en collision avec un instant réel, et un -1 serait une divergence gratuitement
    // inventée.
    this._batchSnapshotVersion = 0
    this._watched = options?.watched
    this._unwatched = options?.unwatched
    // La clé doit exister même quand le nom est absent : `Object.keys` la révèle toujours.
    this.name = options?.name
  }

  get value(): T {
    // L'ALLOCATION DU NŒUD EST ICI, pas dans le calculateur. Une lecture enregistre sa dépendance
    // en passant par `newNode`, qui renvoie `undefined` s'il n'y a personne pour l'accueillir : une
    // lecture hors de tout computé est donc aussi bon marché qu'une lecture de propriété.
    const node = newNode(this)
    if (node !== undefined) node._version = this._version
    return this._value
  }

  set value(next: T) {
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
      this._value = next
      this._version++
      globalVersion++
      for (let node = this._targets; node !== undefined; node = node._targetNext) {
        node._target._notify()
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
  peek(): T {
    return this._value
  }

  /**
   * Ajoute un abonné. Insertion en TÊTE de `_targets` : seule la longueur compte pour cette
   * liste, alors que l'ordre des dépendances est sémantique.
   *
   * Le premier abonné déclenche `watched`, en dehors de tout suivi : un crochet qui s'abonnerait
   * à ce qu'il lit transformerait une observation en dépendance, et le graphe croirait avoir une
   * source de plus.
   */
  _addNode(node: Node): void {
    const tete = this._targets
    if (tete === node || node._targetNext !== undefined) return
    node._targetPrev = tete
    this._targets = node
    if (tete !== undefined) tete._targetNext = node
    else horsSuivi(() => this._watched?.call(this))
  }

  /**
   * Retire un abonné. Le DERNIER departing déclenche `unwatched`, pour la même raison que
   * `watched` est en dehors du suivi.
   */
  _removeNode(node: Node): void {
    if (this._targets === undefined) return
    const suivant = node._targetNext
    const precedent = node._targetPrev
    if (suivant === undefined) {
      if (precedent !== undefined) precedent._targetNext = undefined
      node._targetPrev = undefined
    }
    if (precedent !== undefined) {
      precedent._targetNext = suivant
      node._targetPrev = undefined
    }
    if (node === this._targets) {
      this._targets = suivant
      if (suivant === undefined) horsSuivi(() => this._unwatched?.call(this))
    }
  }

  /** Un nœud a été invalidé. Un signal n'a rien à faire : c'est lui la source. */
  _notify(): void {}

  /**
   * SPEC §5.1 — les trois conversions passent par l'accesseur `value`, PAS par `_value` : elles
   * SUIVENT la dépendance. C'est la seule différence entre elles et `peek()`, et elle est
   * intentionnelle.
   *
   * Aucun `try` ici : `symbole + ""` lève déjà, et nous ne faisons que laisser passer l'erreur.
   */
  toString(): string {
    return this.value + ""
  }

  valueOf(): T {
    return this.value
  }

  toJSON(): T {
    return this.value
  }
}

/**
 * SPEC §5.1 — la marque, posée sur le prototype.
 *
 * La fusion de déclaration n'est pas un détail de typage, c'est la SEULE forme qui satisfies
 * trois contraintes à la fois :
 *
 *   - `brand!: typeof BRAND_SYMBOL` dans le corps de classe crée une propriété propre
 *     `undefined` sur chaque instance : le prototype est masqué, et `Object.keys` passe de huit
 *     clés à neuf. Deux comportements figés cassés d'un coup.
 *   - `declare brand` est refusé par la transpilation de la CLI, qui est un effacement de types :
 *     `signals.ts` est la source distribuée, il doit passer à travers.
 *   - `implements` ne convient pas non plus, TypeScript exige que la classe déclare le membre.
 *
 * Le TYPE vient d'ici ; la VALEUR vient du `defineProperty` ci-dessous. Voir
 * `docs/distribution.md` §5.
 */
export interface Signal<T = undefined> {
  brand: typeof BRAND_SYMBOL
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
})

export interface SignalOptions<T = any> {
  watched?: (this: Signal<T>) => void
  unwatched?: (this: Signal<T>) => void
  name?: string
}

/**
 * Crée un signal modifiable. Sans argument, c'est `signal(undefined)`.
 *
 * La classe est exportée et constructible en plus de la fonction : c'est la surface normative,
 * dix fonctions et trois classes — SPEC §4.
 */
export function signal<T>(value: T, options?: SignalOptions<T>): Signal<T>
export function signal<T = undefined>(): Signal<T | undefined>
export function signal<T>(value?: T, options?: SignalOptions<T>): Signal<T | undefined> {
  return new Signal(value as T, options)
}

// ---- Le graphe de dépendances ------------------------------------------------------------------
//
// Une liaison sert dans deux listes doublement chaînées, et un seul objet les sert toutes les
// deux. C'est le choix central : un nœud porte son `_source` et son `_target`, et sa présence
// dans la liste des abonnés de la source et dans la liste des dépendances de la cible n'est pas
// deux objets, c'est le même.

/** La version d'un nœud `-1` est une sentinelle, pas une version. Voir `docs/architecture.md` §3. */
const ABANDONNE = -1

type Node = {
  /** Version de la source telle que la cible l'a vue. `ABANDONNE` = potentielle sentinelle. */
  _version: number
  _source: Signal<any> | Computed<any>
  /**
   * Liste des abonnés de la source, insertion en TÊTE : seule la longueur compte pour celle-là.
   * C'est la source qui fait tourner cette liste, donc elle est chaînée par `_targetNext`.
   */
  _targetPrev: Node | undefined
  _targetNext: Node | undefined
  /**
   * Liste des dépendances de la cible. Les lectures s'y empilent en TÊTE, donc `_sources` est la
   * plus récemment lue et `_prev` ramène vers les précédentes. Après le nettoyage, `_sources`
   * désigne la plus ANCIENNE survivante et `_next` repart vers les plus récentes : c'est
   * l'invariant que la baseline a de mesuré, et il est vérifié côté signalcn.
   */
  _next: Node | undefined
  _prev: Node | undefined
  /** La cible qui possède ce nœud. */
  _target: Computed<any>
  /** Le nœud que celui-ci occupait chez la même source avant d'être balayé. */
  _recycled: Node | undefined
}

/** Qui est en train de calculer. Un seul, donc une pile serait du gaspillage. */
let currentObserver: Computed<any> | undefined = undefined

/** Le compteur global. Incrémenté par toute écriture de signal, jamais par un computé. */
let globalVersion = 0

/**
 * Exécute `fn` sans qu'aucune lecture n'inscrive de dépendance.
 *
 * C'est `untracked`, mais interne et restreint : ici il sert aux crochets `watched` et
 * `unwatched`, qui ne doivent pas s'abonner à ce qu'ils lisent, et à `Computed.peek`, qui doit
 * actualiser sans laisser de dépendance. #26 en fera la fonction publique — et son corps y ira
 * tel quel, à un `capturedEffects` près que le flush de batch amènera.
 */
function horsSuivi<T>(fn: () => T): T {
  const precedent = currentObserver
  currentObserver = undefined
  try {
    return fn()
  } finally {
    currentObserver = precedent
  }
}

function createNode(source: Signal<any> | Computed<any>, target: Computed<any>): Node {
  const node: Node = {
    _version: 0,
    _source: source,
    _targetPrev: undefined,
    _targetNext: undefined,
    _next: undefined,
    _prev: target._sources,
    _target: target,
    _recycled: undefined,
  }
  if (target._sources !== undefined) target._sources._next = node
  target._sources = node
  source._node = node
  // Le nœud entre TOUJOURS dans la liste des dépendances : c'est elle qui porte la réconciliation.
  // Mais la source ne s'abonne au computé que si quelqu'un le REGARDE. Sans abonné, personne ne
  // n'a besoin d'être prévenu, et le crochet `watched` ne doit pas se déclencher pour un calcul
  // que personne n'observe.
  if ((target._flags & TRACKING) !== 0) source._addNode(node)
  return node
}

/**
 * Le nœud d'une dépendance, alloué ou recyclé.
 *
 * Trois cas, et le troisième est tout l'intérêt : un nœud balayé qui est relu est **réactivé**,
 * pas réalloué. C'est ce qui borne la mémoire d'un computed dont les dépendances varient — sans
 * cela, chaque bascule d'un interrupteur laisserait un nœud orphelin derrière lui.
 */
function newNode(source: Signal<any> | Computed<any>): Node | undefined {
  if (currentObserver === undefined) return undefined
  const node = source._node

  // Cas 1 — le nœud est à nous. Il suffit de le rendre vivant si le balayage l'avait marqué : le
  // nœud survécu, il n'est ni réalloué ni recopié. C'est la réactivation.
  if (node !== undefined && node._target === currentObserver) {
    if (node._version === ABANDONNE) node._version = 0
    return node
  }

  // Cas 2 — le nœud a été balayé et n'appartient plus à personne d'utile. On le prend, en le
  // sortant d'abord de la liste de la source : un nœud ne peut pas appartenir à deux cibles à la
  // fois, sinon la source le préviendrait deux fois.
  if (node !== undefined && node._version === ABANDONNE) {
    node._version = 0
    if (node._targetNext !== undefined) {
      node._targetNext._targetPrev = node._targetPrev
      if (node._targetPrev !== undefined) node._targetPrev._targetNext = node._targetNext
    }
    node._targetPrev = source._targets
    node._targetNext = undefined
    if (source._targets !== undefined) source._targets._targetNext = node
    source._targets = node

    node._target = currentObserver
    if (currentObserver._sources !== undefined) currentObserver._sources._next = node
    currentObserver._sources = node
    return node
  }

  // Cas 3 — pas de nœud, ou un nœud vivant d'une autre cible. Allocation neuve.
  return createNode(source, currentObserver)
}
/**
 * Prépare la liste des dépendances pour le prochain calcul : chaque nœud encore présent est
 * marqué `ABANDONNE`, et chacun mémorise le nœud qu'il évince. Rien n'est encore détaché — la
 * collecte d'un nœud survécu décidera après le calcul, ce qui garantit qu'une dépendance lue
 * puis abandonnée dans le MÊME passage reste valide.
 */
function cleanupSources(node: Computed<any>): void {
  // Parcours par `_prev` depuis la tête, donc depuis la source lue en dernier : c'est le sens qui
  // remonte toute la liste. Une version de cette fonction suivait `_next`, et — `_sources` pointant
  // alors la source la plus ancienne après le balayage — ne visitait que le PREMIER nœud. Seule la
  // tête était alors marquée abandonnée, si bien qu'une dépendance quittée au milieu de la liste
  // n'était jamais détachée et continuait de notifier à jamais.
  for (let current = node._sources; current !== undefined; current = current._prev) {
    const source = current._source
    if (source._node !== undefined) current._recycled = source._node
    source._node = current
    current._version = ABANDONNE
  }
}

/**
 * Balaye les nœuds que le calcul n'a pas resservis, et réenracine la liste.
 *
 * La liste est reconstruite en ne gardant que les survivants. Un nœud abandonné se détache de la
 * liste des abonnés de sa source : sans cela il la préviendrait à jamais, et une dépendance
 * qu'on a ceased de lire coûterait un calcul à chaque écriture de la programme.
 */
function cleanupDependency(node: Computed<any>): void {
  let tete: Node | undefined = undefined
  let premier: Node | undefined = undefined
  for (let current = node._sources; current !== undefined; ) {
    const precedent = current._prev
    if (current._version === ABANDONNE) {
      current._source._removeNode(current)
    } else {
      // On parcourt de la plus récente vers les plus anciennes, et on raccroche chaque survivant
      // APRÈS celui déjà posé. `premier` reste le premier survu — donc le plus récent — et c'est
      // lui qui redevient la tête : `_sources` pointe toujours la source lue en dernier.
      current._next = tete
      if (tete !== undefined) tete._prev = current
      if (premier === undefined) premier = current
      tete = current
    }
    current._source._node = current._recycled
    current._recycled = undefined
    current = precedent
  }
  if (premier !== undefined) premier._next = undefined
  node._sources = premier
}

// ---- Le computé --------------------------------------------------------------------------------

/**
 * Les six bits de `_flags`. Ils sont un ENSEMBLE, pas une liste : `_refresh` teste
 * `(flags & (OUTDATED | TRACKING)) === TRACKING`, et c'est le masque qui compte. Six puissances
 * de deux, comme `docs/architecture.md` §10 ; `DISPOSED` n'est posé par personne dans cette tranche.
 */
const RUNNING = 1
const NOTIFIED = 2
/**
 * Posé à la construction, au premier abonné et à chaque notification ; effacé avant recalcul.
 * C'est lui qui rend le garde-fou du cycle indirect : une source en cours d'évaluation le
 * renvoie encore, et `sourcesAreStale` en conclut qu'il faut recalculer.
 */
const OUTDATED = 4
/** Réservé aux effets — `dispose()` et cleanup en échec. Rien ne le pose dans cette tranche. */
const DISPOSED = 8
/** `_value` contient une exception, pas une valeur. Une dérivation peut valoir `undefined`. */
const HAS_ERROR = 16
/**
 * Le nœud a au moins un abonné.
 *
 * Une source ne s'abonne à un computé que si quelqu'un le regarde, et c'est ce drapeau qui
 * commande ce raccord. Sans abonné, personne n'a besoin d'être prévenu — et c'est aussi pourquoi
 * la voie rapide de l'abonné ne peut court-circuiter que dans ce cas : sinon elle servirait une
 * valeur périmée en silence.
 */
const TRACKING = 32

/**
 * Un signal dont la valeur dérive d'autres signaux, en lecture seule.
 *
 * DOUZE propriétés-own, dans cet ordre : les huit de `Signal` puis celles-ci. L'ordre est
 * contractuel (SPEC §6.1) et il découle de l'héritage — le constructeur de la base assigne les
 * huit premières, puis celles d'ici.
 */
export class Computed<T = undefined> extends Signal<T | undefined> {
  _fn: () => T
  _sources: Node | undefined
  _globalVersion: number
  _flags: number

  constructor(fn: () => T, options?: SignalOptions<T>) {
    super(undefined, options as SignalOptions<T | undefined> | undefined)
    this._fn = fn
    this._sources = undefined
    this._globalVersion = globalVersion - 1
    this._flags = OUTDATED
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
  _refresh(): boolean {
    this._flags &= ~(RUNNING | NOTIFIED)
    if ((this._flags & RUNNING) !== 0) return false
    if ((this._flags & (OUTDATED | TRACKING)) === TRACKING) return true

    // `OUTDATED` retombe ici : chaque calcul repart d'une collecte de dépendances neuve. C'est ce
    // qui rend la réconciliation dynamique correcte — on ne garde d'un calcul à l'autre que ce
    // qui a été réellement relu.
    this._flags &= ~(OUTDATED | RUNNING)

    // Sortie rapide 1, dans l'ordre de `docs/architecture.md` §4 : le compteur global d'abord.
    // Elle est délibérément trop large — n'importe quelle écriture invalide le cache de tous les
    // computeds du programme. Le pire cas est un recalcul inutile, jamais une valeur fausse.
    if (this._globalVersion === globalVersion) return true
    this._globalVersion = globalVersion

    // Sortie rapide 2 : des abonnés, et aucune source en retard. Court-circuite sans même lire le
    // compteur global — un computé observé ne peut pas avoir changé.
    //
    // Le test d'abonné n'est pas une optimisation, c'est une CORRECTION. Sans abonné, aucune
    // source ne prévient : la seule chose qui dise que le cache est périmé, c'est le compteur
    // global. Court-circuiter ici rendrait une valeur périmée, silencieusement.
    if ((this._flags & TRACKING) !== 0 && this._version > 0 && !this._sourcesAreStale()) {
      this._flags &= ~NOTIFIED
      return true
    }

    this._flags |= RUNNING
    const precedentObservateur = currentObserver
    try {
      cleanupSources(this)
      currentObserver = this
      const valeur = this._fn()
      // On n'écrit que si quelque chose a bougé : sinon chaque lecture incrémenterait la version
      // et invaliderait les abonnés, alors que rien n'a changé.
      if ((this._flags & HAS_ERROR) !== 0 || this._value !== valeur || this._version === 0) {
        this._value = valeur
        this._flags &= ~(HAS_ERROR | RUNNING)
        this._version++
      }
    } catch (erreur) {
      // L'erreur est STOCKÉE dans `_value` et `CALCUL` relâché. Relâché est ce qui compte : le
      // compteur global ayant été mis à jour avant le calcul, la voie rapide 2 court-circuite
      // ensuite, donc une deuxième lecture RELANCE l'erreur stockée sans réévaluer une seule fois.
      // Six lectures d'une dérivation qui jette coûtent une évaluation, pas six.
      this._value = erreur as never
      this._flags = (this._flags & ~RUNNING) | HAS_ERROR
      this._version++
    } finally {
      currentObserver = precedentObservateur
    }
    cleanupDependency(this)
    this._flags &= ~NOTIFIED
    return true
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
  private _sourcesAreStale(): boolean {
    for (let current = this._sources; current !== undefined; current = current._next) {
      const source = current._source
      if (source._version !== current._version || !(source instanceof Computed ? source._refresh() : true)) {
        return true
      }
      if (source._version !== current._version) return true
    }
    return false
  }

  /** Une écriture reçue. Sans abonné, il n'y a personne à réveiller : le calcul est paresseux. */
  override _notify(): void {
    this._flags |= NOTIFIED
  }

  override get value(): T {
    // Cycle auto, détecté à la première relecture. Cent itérations pour découvrir qu'on se
    // regarde soi-même serait une dépense et une mauvaise nouvelle en production.
    if ((this._flags & RUNNING) !== 0) throw new Error("Cycle detected")
    const node = newNode(this)
    this._refresh()
    if (node !== undefined) node._version = this._version
    if ((this._flags & HAS_ERROR) !== 0) throw this._value
    return this._value as T
  }

  override peek(): T {
    // `peek()` est une lecture non abonnée — donc elle n'inscrit pas de nœud. Elle actualise
    // quand même, sinon `peek()` servirait une valeur périmée.
    return horsSuivi(() => this.value)
  }

  override toString(): string {
    return this.value + ""
  }
  override valueOf(): T | undefined {
    return this.value
  }
  override toJSON(): T | undefined {
    return this.value
  }
}

/**
 * Un computé, vu par l'appelant : la même chose qu'un signal, sauf que `value` n'a pas de
 * setter. C'est un type séparé, et non une propriété optionnelle — un appelant qui reçoit un
 * `ReadonlySignal` ne doit pas pouvoir écrire dedans, et le typage doit le dire.
 */
export type ReadonlySignal<T = undefined> = Omit<Signal<T | undefined>, "value"> & { readonly value: T }

export function computed<T>(fn: () => T, options?: SignalOptions<T>): ReadonlySignal<T> {
  return new Computed(fn, options)
}
