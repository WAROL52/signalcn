/**
 * Spécification de la source de vérité du moteur et de sa suite de conformité.
 *
 * Ce fichier porte DEUX choses, et la distinction est ce qui le rend honnête :
 *
 *   - `scenarios`, la table DIFFÉRENTIELLE. Elle est rejouée par le harnais contre la baseline
 *     publiée, et par `node --test` contre nous. Tout ce qu'elle affirme doit donc être vrai
 *     des DEUX côtés. Elle ne peut rien affirmer que la baseline ne fait pas.
 *   - les tests signalcn-seuls, enregistrés sous le même `node:test` mais absents de la table.
 *     Ils couvrent ce qui nous est propre : la structure de classe de SPEC §5.3, les descripteurs
 *     de prototype, et le compteur `_version`.
 *
 * Et un TROISIÈME chose, `COUVERTURE`, qui rend le critère « aucune entrée de matrice laissée
 * sans scénario » VÉRIFIABLE au lieu d'être une promesse. Voir plus bas.
 *
 * Les attentes de la table sont transcrites de la colonne « Observé » de la matrice, et
 * confirmées par sonde contre le paquet publié. Le vrai oracle reste la campagne rejouable —
 * voir `SPEC.md` §22.
 *
 * ET POURQUOI LA STRUCTURE N'EST PAS DANS LA TABLE. SPEC §5.3 rend les huit noms de propriétés
 * un contrat de signalcn — `_value`, `_version`, et non les noms de la baseline. La baseline
 * publiée, elle, minifie les siens : `Object.keys(signal(1))` y vaut
 * `["v","i","n","t","l","W","Z","name"]`. Un scénario qui affirme nos noms échouerait donc
 * contre la baseline par construction, et un scénario qui affirme les siens échouerait contre
 * nous. La table ne peut pas dire la structure ; les tests signalcn-seuls le font. Voir #33.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

// Type seul : efface a la compilation. La surface est INJECTEE dans chaque scenario, c'est ce qui
// permet au harnais de rejouer la meme table contre une autre implementation.
import type {
  signal as signalFn,
  computed as computedFn,
  effect as effectFn,
  Effect as EffectClass,
  Signal as SignalClass,
  Computed as ComputedClass,
  ReadonlySignal,
} from "./signals.ts"

/** La surface publique injectée dans chaque scénario. */
export type Api = {
  signal: typeof signalFn
  computed: typeof computedFn
effect: typeof effectFn
    batch: <T>(fn: () => T) => T
    untracked: <T>(fn: () => T) => T
    Effect: typeof EffectClass
  Signal: typeof SignalClass
  Computed: typeof ComputedClass
}

/** Le journal : ce qui est comparé, ce qui est journalisé. */
export type Log = {
  (...entries: unknown[]): void
  entries: string[]
}

export type Scenario = {
  /** Renvoie au CONTRAT. */
  name: string
  /** Renvoie à la MATRICE. */
  matrice: string[]
  run: (api: Api, log: Log) => void
}

/**
 * Le `this` lexical du module. Une flèche le capture — et c'est ce que `effect#10` fige : une
 * fléchée n'obtient PAS l'instance d'effet.
 */
const thisGlobal: unknown = globalThis

/**
 * Les tests signalcn-seuls observent des comportements que le TYPAGE interdit : un appel sans
 * `new`, une écriture sur un signal gelé, la présence d'un membre qui n'existe pas, une
 * conversion arithmétique d'un objet. Ce sont des comportements RUNTIME, figés par la matrice —
 * et la baseline a exactement les mêmes refus de typage. Les affranchir tous par le même point
 * de sortie, c'est que le motif soit visible en un endroit au lieu d'être cinq `as` dispersés.
 */
const auRuntime = <T,>(valeur: T): any => valeur

export function makeLog(): Log {
  const entries: string[] = []
  const log = (...parts: unknown[]) => {
    entries.push(parts.map(p => String(p)).join(" "))
  }
  log.entries = entries
  return log
}

/**
 * Les tranches qui possedent une entree de matrice. Nommees, pas ecrites en clair dans le
 * registre : la revue a releve que « l'effet » etait pointe sur #25, qui est `subscribe()` — et
 * un rappel de `subscribe` s'execute en `untracked`, donc il ne peut pas prouver qu'une
 * conversion suit la dependance. Un numero written en clair dans une chaine n'est pas relu.
 */
export const TICHETS = {
  computed: "#23",
  effet: "#24",
  subscribe: "#25",
      batch: "#26",
      // La portee de CAPTURE d'effets n'existe qu'avec `createModel`.
      modele: "#28",
    } as const

export const scenarios: Scenario[] = [
  {
    // SPEC §5.1, §5.3 — l'instance, la classe exportée, et le `new` qui n'est pas requis.
    // `Signal(5)` sans `new` lève : le constructeur travaille sur `this`, et sans `new` il n'y
    // a pas de `this`. Le message d'erreur n'est pas figé, et c'est délibéré — il vient du
    // moteur, pas de nous. On n'affirme que le type.
    name: "signal/instance-et-classe",
    matrice: ["signal#1", "signal#18", "signal#19", "signal#20"],
    run(api, log) {
      const s = api.signal(1)
      log("valeur", String(s.value))
      log("instanceof", String(s instanceof api.Signal))
      log("proto partage", String(Object.getPrototypeOf(s) === api.Signal.prototype))

      const construit = new api.Signal(5)
      construit.value = 2
      log("new Signal(5) puis .value = 2", String(construit.value))

      // DÉTACHÉ, et c'est tout le scénario. `api.Signal(5)` serait un appel de MÉTHODE : `this`
      // vaudrait l'objet `api`, l'écriture réussirait, et rien ne lèverait. Il faut doncsortir la
      // fonction de l'objet avant de l'appeler, pour retrouver un `this` indéfini. Le harnais a
      //.attrapé ça : la baseline ne levait pas, et elle avait raison de ne pas lever.
      const Constructeur = auRuntime(api.Signal)
      let sansNew
      try {
        Constructeur(5)
        sansNew = "aucune erreur"
      } catch (erreur) {
        sansNew = erreur instanceof Error ? erreur.constructor.name : "autre"
      }
      log("Signal(5) sans new leve", sansNew)

      assert.deepEqual(log.entries, [
        "valeur 1",
        "instanceof true",
        "proto partage true",
        "new Signal(5) puis .value = 2 2",
        "Signal(5) sans new leve TypeError",
      ])
    },
  },
  {
    // SPEC §5.1 — `signal()` sans argument équivaut à `signal(undefined)`.
    name: "signal/sans-argument",
    matrice: ["signal#2"],
    run(api, log) {
      log("signal()", String(api.signal().value))
      log("signal(undefined)", String(api.signal(undefined).value))
      assert.deepEqual(log.entries, ["signal() undefined", "signal(undefined) undefined"])
    },
  },
  {
    // SPEC §5.2 — le seuil est `!==`. La matrice a observe 2 runs d'effet pour `NaN → NaN`.
    //
    // CE SCÉNARIO NE PROUVE PAS LA NOTIFICATION, et il ne prétend pas. Sans subscriber, le seul
    // compteur d'une notification est `_version`, qui n'a pas le même nom des deux côtés :
    // l'affirmer ici serait une hypothèse, pas une mesure. Une implémentation fondée sur
    // `Object.is` passerait ce scénario. C'est `signalcn-seul/notifie-sur-stricte-identite` qui
    // discrimine les deux — et c'est normal qu'il soit d'un seul côté.
    name: "signal/egalite-stricte-nan",
    matrice: ["signal#6"],
    run(api, log) {
      const s = api.signal(NaN)
      s.value = NaN
      log("valeur", String(s.value))
      assert.deepEqual(log.entries, ["valeur NaN"])
    },
  },
  {
    // SPEC §5.2 — 0 et -0 sont indiscernables : l'ecriture est IGNOREE, donc la valeur
    // precedente est conservee. C'est la trace observable du garde d'identite stricte.
    // Chaque direction part d'un signal neuf : l'ecriture rejetee ne change rien, donc
    // partir du meme signal pour les deux sens testerait deux fois la meme chose.
    name: "signal/zero-et-negative-zero",
    matrice: ["signal#7", "signal#8"],
    run(api, log) {
      const versMoinsZero = api.signal(0)
      versMoinsZero.value = -0
      log("0 vers -0 : la valeur reste 0", versMoinsZero.value === 0 && !Object.is(versMoinsZero.value, -0))

      const versZero = api.signal(-0)
      versZero.value = 0
      log("-0 vers 0 : la valeur reste -0", Object.is(versZero.value, -0))

      assert.deepEqual(log.entries, [
        "0 vers -0 : la valeur reste 0 true",
        "-0 vers 0 : la valeur reste -0 true",
      ])
    },
  },
  {
    // SPEC §5.2 — l'identité, pas la structure. La valeur relue est l'objet écrit, pas une
    // copie : rien ne clones. Le reste — « notifie », « la même référence n'a pas notifié » —
    // se constate sur `_version`, et c'est un test signalcn-seul.
    name: "signal/egalite-stricte-objet",
    matrice: ["signal#9", "signal#10", "signal#11"],
    run(api, log) {
      const premier = { forme: 1 }
      const s = api.signal(premier)
      log("la valeur relue est la reference ecrite", String(s.value === premier))

      s.value = { forme: 1 }
      log("un objet de meme forme est accepte", String(s.value.forme === 1))

      const vide = api.signal(undefined)
      vide.value = undefined
      log("undefined vers undefined, valeur", String(vide.value))

      assert.deepEqual(log.entries, [
        "la valeur relue est la reference ecrite true",
        "un objet de meme forme est accepte true",
        "undefined vers undefined, valeur undefined",
      ])
    },
  },
  {
    // SPEC §5.1 — `peek()` lit la valeur. CE QUE ÇA NE PREND PAS DE PAS, c'est l'absence de
    // dépendance : la matrice l'atteste par un effet qui ne se ré-exécute pas, et les effets
    // arrivent en #24. Le descripteur du prototype diverge — ADR-0004 — et n'est donc pas une
    // propriété commune : il est vérifié côté signalcn seulement.
    name: "signal/peek",
    matrice: ["signal#15"],
    run(api, log) {
      const s = api.signal(1)
      log("peek() vaut value", String(s.peek() === s.value))
      s.value = 2
      log("peek() apres ecriture", String(s.peek()))
      assert.deepEqual(log.entries, ["peek() vaut value true", "peek() apres ecriture 2"])
    },
  },
  {
    // SPEC §4.2 — `name` est un champ public, mutable apres coup, toujours present dans
    // l'enumeration des cles d'instance, `undefined` s'il est absent, et `""` conserve.
    name: "signal/options-name",
    matrice: ["signal#16"],
    run(api, log) {
      log("avec nom", String(api.signal(1, { name: "n" }).name))
      log("sans nom", String(api.signal(1).name))
      log("chaine vide conservee", JSON.stringify(api.signal(1, { name: "" }).name))

      const s = api.signal(1)
      s.name = "z"
      log("ecrit apres coup", String(s.name))
      log("la cle reste presente", String("name" in s))

      assert.deepEqual(log.entries, [
        "avec nom n",
        "sans nom undefined",
        "chaine vide conservee \"\"",
        "ecrit apres coup z",
        "la cle reste presente true",
      ])
    },
  },
  {
    // SPEC §5.1 — la marque, et l'absence de `dispose` sur un signal.
    // `brand` est sur le prototype : lisible depuis l'instance, absent des proprietes-own,
    // et traverse par `in`. C'est exactement ce dont la detection de sous-objet d'un modele a
    // besoin. Le descripteur, lui, diverge — voir `signalcn-seul/descripteurs-de-prototype`.
    name: "signal/brand-et-pas-de-dispose",
    matrice: ["signal#17", "signal#22", "signal#23", "conv#11", "conv#13"],
    run(api, log) {
      const s = api.signal(1)
      log("typeof brand", typeof s.brand)
      log("la marque", String(s.brand))
      log("marque partagee avec le prototype", String(s.brand === api.Signal.prototype.brand))
      log("brand in s", String("brand" in s))
      log("brand parmi les proprietes-own", String(Object.getOwnPropertyNames(s).includes("brand")))
      log("typeof dispose", typeof auRuntime(s).dispose)
      assert.deepEqual(log.entries, [
        "typeof brand symbol",
        "la marque Symbol(preact-signals)",
        "marque partagee avec le prototype true",
        "brand in s true",
        "brand parmi les proprietes-own false",
        "typeof dispose undefined",
      ])
    },
  },
  {
    // SPEC §5.1 — `toString()` vaut `this.value + ""` et `valueOf()` vaut `this.value`.
    // Les deux SUIVENT la dependance : ils passent donc par l'accesseur, pas par `_value`.
    // On ne peut pas encore le constater sans effet (#24) ; ce qui est constant, on le fige.
    name: "conversions/to-string-et-value-of",
    matrice: ["conv#1", "conv#5"],
    run(api, log) {
      log("toString(42)", api.signal(42).toString())
      log("toString(10n)", api.signal(10n).toString())
      log("toString(null)", api.signal(null).toString())
      const sept = auRuntime(api.signal(7))
      log("valueOf : sept * 2", String(sept * 2))
      log("valueOf : sept + ''", sept + "")
      assert.deepEqual(log.entries, [
        "toString(42) 42",
        "toString(10n) 10",
        "toString(null) null",
        "valueOf : sept * 2 14",
        "valueOf : sept + '' 7",
      ])
    },
  },
  {
    // SPEC §5.1 — la conversion en chaine leve sur un `Symbol`. Le moteur fait le travail :
    // `symbole + ""` leve. Aucun `try` dans `toString`, et c'est voulu.
    name: "conversions/to-string-throw-sur-symbol",
    matrice: ["conv#2"],
    run(api, log) {
      let type = "aucune erreur"
      try {
        api.signal(Symbol("x")).toString()
      } catch (erreur) {
        type = erreur instanceof Error ? erreur.constructor.name : "autre"
      }
      log("toString sur un symbole leve", type)
      assert.deepEqual(log.entries, ["toString sur un symbole leve TypeError"])
    },
  },
  {
    // SPEC §5.1 — il n'existe PAS de `Symbol.toPrimitive`. Sans lui, `+` passe par
    // `valueOf` puis `toString`, ce qui est le comportement fige.
    name: "conversions/pas-de-symbol-to-primitive",
    matrice: ["conv#3"],
    run(api, log) {
      log("s[Symbol.toPrimitive]", String(auRuntime(api.signal(1))[Symbol.toPrimitive]))
      assert.deepEqual(log.entries, ["s[Symbol.toPrimitive] undefined"])
    },
  },
  {
    // SPEC §5.1 — `toJSON()` vaut `this.value`, donc `JSON.stringify` plonge dans le signal.
    name: "conversions/to-json-et-stringify",
    matrice: ["conv#7", "conv#14"],
    run(api, log) {
      log("toJSON d'un objet", JSON.stringify(api.signal({ a: 1 }).toJSON()))
      log("JSON.stringify({s: signal(5)})", JSON.stringify({ s: api.signal(5) }))
      log("JSON.stringify imbrique", JSON.stringify({ a: [api.signal(1), { b: api.signal(2) }] }))
      assert.deepEqual(log.entries, [
        'toJSON d\'un objet {"a":1}',
        'JSON.stringify({s: signal(5)}) {"s":5}',
        'JSON.stringify imbrique {"a":[1,{"b":2}]}',
      ])
    },
  },
  {
    // SPEC §6 — paresseux, puis mis en cache. Rien ne s'exécute avant la première lecture, et
    // trois lectures consécutives donnent UNE évaluation : c'est le même fait, vu deux fois.
    name: "computed/paresseux-et-cache",
    matrice: ["computed#1", "computed#2"],
    run(api, log) {
      let calls = 0
      const a = api.signal(1)
      const c = api.computed(() => {
        calls++
        return a.value * 10
      })

      log("evaluations avant toute lecture", calls)
      log("valeur", String(c.value))
      log("evaluations apres la 1re lecture", calls)
      c.value
      c.value
      log("evaluations apres trois lectures", calls)

      assert.deepEqual(log.entries, [
        "evaluations avant toute lecture 0",
        "valeur 10",
        "evaluations apres la 1re lecture 1",
        "evaluations apres trois lectures 1",
      ])
    },
  },
  {
    // SPEC §6 — sans abonné, une écriture de source ne réveille rien, et la lecture suivante
    // intègre TOUTES les écritures. Le nombre d'évaluations reste 1 tant qu'on ne lit pas.
    name: "computed/sans-abonne",
    matrice: ["computed#3"],
    run(api, log) {
      let calls = 0
      const a = api.signal(1)
      const c = api.computed(() => {
        calls++
        return a.value + 1
      })

      log("valeur initiale", String(c.value))
      a.value = 2
      a.value = 3
      a.value = 4
      log("evaluations apres trois ecritures, sans lecture", calls)
      log("valeur, qui integre les trois ecritures", String(c.value))
      log("evaluations", calls)

      assert.deepEqual(log.entries, [
        "valeur initiale 2",
        "evaluations apres trois ecritures, sans lecture 1",
        "valeur, qui integre les trois ecritures 5",
        "evaluations 2",
      ])
    },
  },
  {
    // SPEC §6 — invalidation puis recalcul, et `peek()` qui passe par la voie de lecture. Le
    // recalcul n'a lieu qu'à la lecture : c'est ce qui rend le computé paresseux.
    name: "computed/invalidation-et-recalcul",
    matrice: ["computed#4", "computed#7"],
    run(api, log) {
      let calls = 0
      const a = api.signal(1)
      const c = api.computed(() => {
        calls++
        return a.value * 2
      })

      log("valeur", String(c.value))
      log("evaluations", calls)
      log("valeur, relue sans ecriture", String(c.value))
      log("evaluations, toujours 1", calls)
      a.value = 2
      log("evaluations apres ecriture, sans lecture", calls)
      log("valeur", String(c.value))
      log("evaluations", calls)

      assert.deepEqual(log.entries, [
        "valeur 2",
        "evaluations 1",
        "valeur, relue sans ecriture 2",
        "evaluations, toujours 1 1",
        "evaluations apres ecriture, sans lecture 1",
        "valeur 4",
        "evaluations 2",
      ])
    },
  },
  {
    // SPEC §7 — une dépendance abandonnée cesse de notifier. Le journal montre que `a` n'est
    // plus lue du tout, donc plus consultée.
    name: "computed/dependances-dynamiques",
    matrice: ["computed#8"],
    run(api, log) {
      const bascule = api.signal(true)
      const a = api.signal<number | string>(1)
      const b = api.signal("b")
      const journal: string[] = []

      const c = api.computed(() => {
        if (bascule.value) {
          journal.push("a")
          return a.value
        }
        journal.push("b")
        return b.value
      })

      log("1re lecture", String(c.value))
      bascule.value = false
      log("apres bascule", String(c.value))
      a.value = "a2"
      log("apres ecriture de a, qui n'est plus lue", String(c.value))
      log("journal : a n'apparait plus", JSON.stringify(journal.filter(e => e === "a").length === 1))

      assert.deepEqual(log.entries, [
        "1re lecture 1",
        "apres bascule b",
        "apres ecriture de a, qui n'est plus lue b",
        "journal : a n'apparait plus true",
      ])
    },
  },
  {
    // SPEC §7 — la réactivation. Même exigence que l'abandon, vue de l'autre côté : le journal
    // doit reprendre la lecture de `a`, et la valeurIntegrer l'écriture qui a eu lieu entre-temps.
    name: "computed/reactivation-apres-abandon",
    matrice: ["computed#9"],
    run(api, log) {
      const bascule = api.signal(true)
      const a = api.signal<number | string>(1)
      const journal: string[] = []

      const c = api.computed(() => {
        if (bascule.value) {
          journal.push("a")
          return a.value
        }
        journal.push("b")
        return "absent"
      })

      c.value
      bascule.value = false
      c.value
      a.value = 10
      bascule.value = true
      log("valeur apres reactivation", String(c.value))
      log("journal", JSON.stringify(journal.join("")))

      assert.deepEqual(log.entries, ["valeur apres reactivation 10", 'journal "aba"'])
    },
  },
  {
    // SPEC §15.2 — un cycle se détecte à la première relecture, pas après cent itérations. On ne
    // fige pas le message : il vient du moteur, pas de nous. On fige le type et le fait qu'une
    // seule évaluation a eu lieu.
    name: "computed/cycles",
    matrice: ["computed#12", "computed#13"],
    run(api, log) {
      let auto = 0
      // L'annotation est ce qui casse la circularite : sans elle, TypeScript ne peut pas typer
      // `soi` a partir de sa propre initialisation, et le cycle — le sujet meme du scenario —
      // deviendrait une erreur de typage au lieu d'un comportement observe.
      const soi: ReadonlySignal<number> = api.computed(() => {
        auto++
        return soi.value + 1
      })
      let typeAuto = "aucune erreur"
      try {
        soi.value
      } catch (erreur) {
        typeAuto = erreur instanceof Error ? erreur.constructor.name : "autre"
      }
      log("auto-cycle : type, evaluations", `${typeAuto} / ${auto}`)

      let indirect = 0
      const premier: ReadonlySignal<number> = api.computed(() => {
        indirect++
        return second.value + 1
      })
      const second: ReadonlySignal<number> = api.computed(() => {
        indirect++
        return premier.value + 1
      })
      let typeIndirect = "aucune erreur"
      try {
        premier.value
      } catch (erreur) {
        typeIndirect = erreur instanceof Error ? erreur.constructor.name : "autre"
      }
      log("cycle indirect : type, evaluations", `${typeIndirect} / ${indirect}`)

      assert.deepEqual(log.entries, [
        "auto-cycle : type, evaluations Error / 1",
        "cycle indirect : type, evaluations Error / 2",
      ])
    },
  },
  {
    // SPEC §15 — l'erreur de la dérivation est STOCKÉE, pas recalculée à chaque lecture. C'est ce
    // qui distingue une dérivation d'une fonction : six lectures ne font qu'une évaluation.
    name: "computed/erreur-stockee",
    matrice: ["computed#15", "computed#16"],
    run(api, log) {
      let calls = 0
      const declencheur = api.signal(false)
      const c = api.computed(() => {
        calls++
        if (declencheur.value) throw new Error("boom")
        return 10
      })

      log("valeur saine", String(c.value))
      declencheur.value = true

      const rejets: string[] = []
      for (let i = 0; i < 3; i++) {
        try {
          c.value
          rejets.push("aucune erreur")
        } catch (erreur) {
          rejets.push(erreur instanceof Error ? erreur.message : "autre")
        }
      }
      log("trois lectures apres declenchement", JSON.stringify(rejets))
      log("evaluations : l'erreur n'est pas recalculee", calls)

      declencheur.value = false
      log("valeur apres resolution", String(c.value))
      log("evaluations", calls)

      assert.deepEqual(log.entries, [
        "valeur saine 10",
        'trois lectures apres declenchement ["boom","boom","boom"]',
        "evaluations : l'erreur n'est pas recalculee 2",
        "valeur apres resolution 10",
        "evaluations 3",
      ])
    },
  },
  {
    // SPEC §6 — le computé est en lecture seule. Le descripteur n'a pas de setter, donc en mode
    // strict l'affectation lève. Le mode sloppy est un fichier à part, et la suite s'exécute en
    // strict : on n'affirme donc que le strict.
    name: "computed/lecture-seule",
    matrice: ["computed#23", "computed#24"],
    run(api, log) {
      const c = api.computed(() => 1)
      log("instanceof Signal", String(c instanceof api.Signal))
      log("instanceof Computed", String(c instanceof api.Computed))

      const descripteur = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(c), "value")
      log("le descripteur a un setter", String(typeof descripteur?.set))
      let type = "aucune erreur"
      try {
        ;(c as unknown as { value: number }).value = 2
      } catch (erreur) {
        type = erreur instanceof Error ? erreur.constructor.name : "autre"
      }
      log("ecriture en mode strict", type)

      // Le mode SLOPPY : l'affectation doit être silencieusement ignorée, sans lever ni changer la
      // valeur. Le module de test est en mode strict — c'est un module ESM — donc on passe par
      // `Function`, dont le corps est sloppy sauf s'il commence par « use strict ». C'est la
      // stdlib qui fournit le mode sloppy, pas un fichier `.cjs` de plus à distribuer.
      const sloppy = auRuntime(new Function("c", "c.value = 2; return c.value"))
      log("ecriture en mode sloppy, valeur inchangee", String(sloppy(c)))
      log("aucune erreur levee en mode sloppy", String(sloppy(c) === 1))

      assert.deepEqual(log.entries, [
        "instanceof Signal true",
        "instanceof Computed true",
        "le descripteur a un setter undefined",
        "ecriture en mode strict TypeError",
        "ecriture en mode sloppy, valeur inchangee 1",
        "aucune erreur levee en mode sloppy true",
      ])
    },
  },
  {
    // SPEC §4.2, §5.1 — `options.name` est un champ public mutable, et la marque est présente :
    // c'est ce qui empêche `createModel` de descendre dans un computé.
    name: "computed/options-et-marque",
    matrice: ["computed#25", "computed#27"],
    run(api, log) {
      const c = api.computed(() => 1, { name: "c" })
      log("nom", String(c.name))
      c.name = "z"
      log("nom modifie", String(c.name))
      log("marque", String(api.computed(() => 1).brand))
      log("marque partagee avec un signal", String(c.brand === api.signal(1).brand))

      assert.deepEqual(log.entries, [
        "nom c",
        "nom modifie z",
        "marque Symbol(preact-signals)",
        "marque partagee avec un signal true",
      ])
    },
  },
  {
    // SPEC §8.1 — premier run SYNCHRONE, avant même que `effect()` ne rende la main, et le
    // callback ne reçoit AUCUN argument.
    name: "effect/premier-run-et-arguments",
    matrice: ["effect#1", "effect#38"],
    run(api, log) {
      const journal: string[] = []
      api.effect(function (this: unknown) {
        journal.push(`${(arguments as unknown as unknown[]).length}/${typeof this}`)
      })
      log("arguments/this", JSON.stringify(journal))
      assert.deepEqual(log.entries, ['arguments/this ["0/object"]'])
    },
  },
  {
    // SPEC §8.1 — un effet SANS dépendance ne tourne qu'une fois et n'est jamais re-notifié : il
    // n'a rien à quoi s'abonner. Deux écritures ne le réveillent pas.
    name: "effect/sans-dependance",
    matrice: ["effect#3"],
    run(api, log) {
      const s = api.signal(0)
      let runs = 0
      // Le callback ne lit RIEN. C'est toute la différence avec un effet qui lit.
      api.effect(() => {
        runs++
      })
      s.value = 1
      s.value = 2
      log("runs", String(runs))
      assert.deepEqual(log.entries, ["runs 1"])
    },
  },
  {
    // SPEC §8.1, §12 — re-run à chaque changement, cleanup exécuté JUSTE AVANT le run suivant,
    // et le cleanup voit la valeur COURANTE : celle qui vient d'écrire, pas celle de son run.
    name: "effect/rerun-et-cleanup",
    matrice: ["effect#2", "effect#6", "effect#8"],
    run(api, log) {
      const s = api.signal(0)
      const journal: string[] = []
      api.effect(() => {
        journal.push(`run:${s.value}`)
        return () => journal.push(`cleanup:${s.value}`)
      })
        s.value = 1
        s.value = 2
        log("journal", JSON.stringify(journal))
        // `effect#2` dit « re-run à chaque CHANGEMENT de dépendance », pas « sur la dernière lue ».
        // La liste des sources est chaînée vers les plus ANCIENNES : écrire sur la première lue doit
        // réveiller autant que écrire sur la dernière. C'est la seule chose que le cas à une seule
        // source ne prouve pas.
        const p = api.signal(0)
        const q = api.signal(0)
        const chezSoi: string[] = []
        api.effect(() => {
          chezSoi.push(`${p.value}:${q.value}`)
        })
        p.value = 1
        q.value = 1
        p.value = 2
        log("deux sources", JSON.stringify(chezSoi))
        assert.deepEqual(log.entries, [
          'journal ["run:0","cleanup:1","run:1","cleanup:2","run:2"]',
          'deux sources ["0:0","1:0","1:1","2:1"]',
        ])
      },
  },
  {
    // SPEC §8.2 — le dispositeur est `_dispose.bind(effect)` : `name === "bound "`, `length === 0`,
    // `Object.keys()` vide. Ce n'est ni une arrow, ni l'instance.
    name: "effect/forme-du-dispositeur",
    matrice: ["effect#4", "effect#35"],
    run(api, log) {
      const d = api.effect(() => {})
      log("type", typeof d)
      log("name", JSON.stringify(d.name))
      log("length", String(d.length))
      log("cles", JSON.stringify(Object.keys(d)))
      assert.deepEqual(log.entries, ["type function", 'name "bound "', "length 0", "cles []"])
    },
  },
  {
    // SPEC §8.1 — une valeur de retour qui n'est pas une fonction est IGNORÉE. Pas d'erreur, pas
    // de cleanup : c'est le cas le plus courant du monde, un callback qui renvoie autre chose.
    name: "effect/retour-non-fonction-ignore",
    matrice: ["effect#5"],
    run(api, log) {
      const d = api.effect(() => 42)
      log("dispositeur rendu", typeof d)
      d()
      log("aucune erreur", "true")
      assert.deepEqual(log.entries, ["dispositeur rendu function", "aucune erreur true"])
    },
  },
  {
    // SPEC §12 — le cleanup s'exécute HORS de tout contexte de suivi : lire un autre signal ne
    // réabonne pas. Sans quoi le dispose laisserait une dépendance fantôme.
    name: "effect/cleanup-hors-suivi",
    matrice: ["effect#7"],
    run(api, log) {
      const pilote = api.signal(0)
      const autre = api.signal(0)
      const journal: string[] = []
      const d = api.effect(() => {
        journal.push(`run ${pilote.value}`)
        return () => journal.push(`cleanup voit ${autre.value}`)
      })
      autre.value = 5
      d()
      log("journal", JSON.stringify(journal))
      log("autre a-t-elle un abonne ?", String(auRuntime(autre)._targets === undefined))
      assert.deepEqual(log.entries, [
        'journal ["run 0","cleanup voit 5"]',
        "autre a-t-elle un abonne ? true",
      ])
    },
  },
  {
    // SPEC §8.3 — `this` est l'INSTANCE d'effet pour une fonction non fléchée ; une flèche capture
    // le `this` lexical du module. On vérifie l'identité de classe, PAS les noms de propriétés :
    // la baseline minifie les siens, donc ils ne sont pas lisibles. Même cause que #33.
    name: "effect/this-est-linstance",
    matrice: ["effect#9", "effect#10"],
    run(api, log) {
      let cleNonFlechee: unknown
      api.effect(function (this: unknown) {
        cleNonFlechee = this
      })
      log("non flechee : instanceof", String(cleNonFlechee instanceof api.Effect))

      let cleFlechee: unknown = undefined
      api.effect(() => {
        cleFlechee = thisGlobal
      })
      log("flechee : instanceof", String(cleFlechee instanceof api.Effect))
      log("flechee : this du module", String(cleFlechee === globalThis))
      assert.deepEqual(log.entries, [
        "non flechee : instanceof true",
        "flechee : instanceof false",
        "flechee : this du module true",
      ])
    },
  },
  {
    // SPEC §13.4 — HORS batch, chaque écriture draine immédiatement, donc l'ordre des runs suit
    // l'ordre des écritures. L'ordre INVERSÉ est normatif à l'intérieur d'un batch, et c'est #26 :
    // sans `batch`, la règle n'est pas observable et l'affirmer serait inventer.
    name: "effect/ordre-hors-batch",
    matrice: ["effect#15", "effect#17"],
    run(api, log) {
      const a = api.signal(0)
      const b = api.signal(0)
      const journal: string[] = []
      api.effect(() => {
        journal.push(`A:${a.value}`)
      })
      api.effect(() => {
        journal.push(`B:${b.value}`)
      })
      a.value = 1
      b.value = 1
      log("ordre des runs", JSON.stringify(journal.slice(2)))
      assert.deepEqual(log.entries, ['ordre des runs ["A:1","B:1"]'])
    },
  },
  {
    // SPEC §8.4 — un effet qui écrit une dépendance qu'il lit se ré-exécute dans la MÊME flush. Le
    // drain est en largeur : une génération est vidée entièrement avant la suivante.
    name: "effect/auto-ecriture",
    matrice: ["effect#16"],
    run(api, log) {
      const s = api.signal(0)
      let runs = 0
      api.effect(() => {
        runs++
        if (s.value < 2) s.value = s.value + 1
      })
      log("runs", String(runs))
      log("valeur", String(s.value))
      assert.deepEqual(log.entries, ["runs 3", "valeur 2"])
    },
  },
  {
    // SPEC §13.6 — un effet créé dans un effet est INDÉPENDANT et non possédé : le dispose de
    // l'extérieur ne doit pas emporter l'intérieur. L'intérieur est créé UNE FOIS, pas à chaque
    // run, sinon c'est un autre comportement qu'on mesurerait.
    name: "effect/nesting-et-independance",
    matrice: ["effect#33"],
    run(api, log) {
      const s = api.signal(0)
      const journal: string[] = []
      const interne = api.effect(() => {
        journal.push(`interne:${s.value}`)
      })
      const externe = api.effect(() => {
        journal.push(`externe:${s.value}`)
      })
      log("runs avant ecriture", journal.length)
      s.value = 1
      log("journal apres ecriture", JSON.stringify(journal))
      externe()
      s.value = 2
      // L'interne a tourné une fois de plus, et l'externe aucune : c'est exactement
      // « indépendant et non possédé ».
      log("seul l'interne a-t-il tourne ?", String(journal.length === 5))
      interne()
      assert.deepEqual(log.entries, [
        "runs avant ecriture 2",
        'journal apres ecriture ["interne:0","externe:0","interne:1","externe:1"]',
        "seul l'interne a-t-il tourne ? true",
      ])
    },
  },
  {
    // SPEC §15.2 — un cycle borné ne lève pas : c'est un cycle, pas une erreur. Le COMPTE de runs
    // d'un cycle non borné n'est pas figé, donc on ne l'affirme pas.
    name: "effect/cycle-borne",
    matrice: ["effect#19"],
    run(api, log) {
      const a = api.signal(0)
      let runs = 0
      api.effect(() => {
        runs++
        const v = a.value
        if (v < 50) a.value = v + 1
      })
      log("runs", String(runs))
      log("valeur", String(a.value))
      assert.deepEqual(log.entries, ["runs 51", "valeur 50"])
    },
  },
  {
    // SPEC §15 — une exception au PREMIER run dispose l'effet, se propage, et ne rend AUCUN
    // dispositeur. Une exception à un RE-RUN laisse l'effet vivant : la propagation suivante le
    // rappelle, et celle d'après ne lève plus.
    name: "effect/erreurs",
    matrice: ["effect#20", "effect#22", "effect#24", "effect#18"],
    run(api, log) {
      const s = api.signal(0)
      let runs = 0
      let rendu: unknown = "jamais rendu"
      try {
        rendu = api.effect(() => {
          runs++
          if (s.value === 0) throw new Error("boom premier")
        })
        log("aucune erreur au premier run", "inattendu")
      } catch (erreur) {
        rendu = "leve"
        log("erreur propagee", erreur instanceof Error ? erreur.message : "autre")
      }
      log("un dispositeur a-t-il ete rendu ?", String(rendu === "leve"))
      log("runs du premier effet", String(runs))

      const t = api.signal(0)
      let runsT = 0
      api.effect(() => {
        runsT++
        if (t.value === 1) throw new Error("boom rerun")
      })
      try {
        t.value = 1
        log("pas d'erreur au rerun", "inattendu")
      } catch (erreur) {
        log("erreur du rerun relancee par l'ecriture", erreur instanceof Error ? erreur.message : "autre")
      }
      t.value = 2
      log("runs de l'effet survivant", String(runsT))
      assert.deepEqual(log.entries, [
        "erreur propagee boom premier",
        "un dispositeur a-t-il ete rendu ? true",
        "runs du premier effet 1",
        "erreur du rerun relancee par l'ecriture boom rerun",
        "runs de l'effet survivant 3",
      ])
    },
  },
  {
    // SPEC §4.2 — `watched` à l'ajout du PREMIER abonné, `unwatched` à la perte du DERNIER, les
    // deux hors de tout suivi, et une seule fois chacun quel que soit le nombre d'abonnés.
    name: "effect/watchers",
    matrice: ["effect#21"],
    run(api, log) {
      const journal: string[] = []
      const s = api.signal<number>(0, {
        watched(this: { name: string | undefined }) {
          journal.push(`watched ${String(this.name)}`)
        },
        unwatched(this: { name: string | undefined }) {
          journal.push(`unwatched ${String(this.name)}`)
        },
      })
      s.name = "W"
      const d1 = api.effect(() => s.value)
      const d2 = api.effect(() => s.value)
        d1()
        d2()
        s.value = 1
        log("journal", JSON.stringify(journal))
        // `effect#21`, cas des DEUX sources : un dispose doit détacher TOUTES celles que l'effet
        // lit, pas seulement celle qu'il a lue en dernier — sinon les autres restent abonnées à des
        // sources prévenues par un effet mort. Et l'ordre est celui de LECTURE, pas l'inverse.
        const hooks: string[] = []
        const p = api.signal(0, { watched: () => hooks.push("+p"), unwatched: () => hooks.push("-p") })
        const q = api.signal(0, { watched: () => hooks.push("+q"), unwatched: () => hooks.push("-q") })
        const d3 = api.effect(() => {
          p.value
          q.value
        })
        d3()
        log("deux sources", JSON.stringify(hooks))
        assert.deepEqual(log.entries, [
          'journal ["watched W","unwatched W"]',
          'deux sources ["+p","+q","-p","-q"]',
        ])
      },
  },
  {
    // SPEC §13.1 — la chaîne A → B → C → Effect. Le drain est en largeur : une génération est
    // vidée entièrement avant la suivante.
    name: "effect/chaine-et-drain",
    matrice: ["effect#32"],
    run(api, log) {
      const a = api.signal(0)
      const journal: string[] = []
      const c1 = api.computed(() => {
        journal.push(`c1:${a.value}`)
        return a.value
      })
      const c2 = api.computed(() => {
        journal.push(`c2:${c1.value}`)
        return c1.value
      })
      api.effect(() => {
        journal.push(`d1:${c2.value}`)
      })
        a.value = 1
        log("journal", JSON.stringify(journal))
        // `effect#32` n'a qu'une source par computé. Un computé à DEUX sources doit raccorder les
        // DEUX à son effet : sinon la chaîne est coupée à son premier maillon, et une écriture sur
        // la source lue en premier ne réveille plus personne — alors que le computé, lui, se
        // recalcule. C'est ce que prouve ici : le computé se met à jour ET l'effet tourne.
        const p = api.signal(0)
        const q = api.signal(0)
        const deux = api.computed(() => p.value * 10 + q.value)
        const vuParEffet: string[] = []
        api.effect(() => {
          vuParEffet.push(String(deux.value))
        })
        p.value = 1
        q.value = 1
        log("computé a deux sources", JSON.stringify(vuParEffet))
        assert.deepEqual(log.entries, [
          'journal ["c1:0","c2:0","d1:0","c1:1","c2:1","d1:1"]',
          'computé a deux sources ["0","10","11"]',
        ])
      },
  },
  {
    // SPEC §12 — un cleanup qui LÈVE dispose l'effet, même en pleine flush : l'écriture suivante
    // ne propage plus. Et il ne casse pas le contexte de suivi, le moteur reste utilisable.
    name: "dispose/cleanup-qui-leve",
    matrice: ["effect#28", "effect#30", "effect#31"],
    run(api, log) {
      const s = api.signal(0)
      let runs = 0
      api.effect(() => {
        runs++
        // Le cleanup ne sera appelé qu'au run SUIVANT, donc il faut encore une écriture.
        if (s.value >= 1) return () => { throw new Error("cleanup boom") }
      })
      const tentatives: string[] = []
      for (const ecriture of [1, 2, 3]) {
        try {
          s.value = ecriture
          tentatives.push(`${ecriture}:aucune`)
        } catch (erreur) {
          tentatives.push(`${ecriture}:${erreur instanceof Error ? erreur.message : "autre"}`)
        }
      }
      log("tentatives", JSON.stringify(tentatives))
      log("runs", String(runs))

      const t = api.signal(0)
      let runsT = 0
      const d2 = api.effect(() => {
        runsT++
      })
      t.value = 1
      log("l'effet suivant tourne-t-il ?", String(runsT))
      d2()
      assert.deepEqual(log.entries, [
        "tentatives [\"1:aucune\",\"2:cleanup boom\",\"3:aucune\"]",
        "runs 2",
        "l'effet suivant tourne-t-il ? 1",
      ])
    },
  },
  {
    // SPEC §8.4 — un effet disposé ALORS qu'il est dans la file de flush est sauté
    // silencieusement, sans callback.
    name: "dispose/dans-la-file",
    matrice: ["effect#14", "dispose#8"],
    run(api, log) {
      const s = api.signal(0)
      const journal: string[] = []
      const d2 = api.effect(() => {
        journal.push(`d2:${s.value}`)
      })
      const d1 = api.effect(() => {
        journal.push(`d1:${s.value}`)
        d2()
      })
      s.value = 1
      log("journal", JSON.stringify(journal))
      s.value = 2
      log("d2 n'est pas revenu", String(journal.filter(e => e === "d2:1").length === 0))
      assert.deepEqual(log.entries, [
        'journal ["d2:0","d1:0","d1:1"]',
        "d2 n'est pas revenu true",
      ])
    },
  },
  {
    // SPEC §12 — dispose externe idempotent, et il détache toutes les dépendances : la source ne
    // garde plus d'abonné, donc plus aucune propagation.
    name: "dispose/idempotent-et-detachement",
    matrice: ["effect#13", "dispose#6", "dispose#9"],
    run(api, log) {
      const s = api.signal(0)
      const journal: string[] = []
      const d = api.effect(() => {
        journal.push(`run:${s.value}`)
        return () => journal.push("cleanup")
      })
      s.value = 1
      d()
      d()
      d()
      log("journal", JSON.stringify(journal))
      s.value = 2
      log("aucun run apres", String(journal.length))
      log("la source a-t-elle un abonne ?", String(auRuntime(s)._targets === undefined))
      assert.deepEqual(log.entries, [
        'journal ["run:0","cleanup","run:1","cleanup"]',
        "aucun run apres 4",
        "la source a-t-elle un abonne ? true",
      ])
    },
  },
  {
    // SPEC §8.3, §12 — `this.dispose()` pendant le run : cleanup IMMÉDIAT, et l'effet ne peut plus
    // être notifié. Appelé deux fois, un seul cleanup.
    name: "dispose/pendant-le-run",
    matrice: ["effect#11", "effect#12", "dispose#7"],
    run(api, log) {
      const s = api.signal(0)
      const journal: string[] = []
      api.effect(function (this: { dispose: () => void }) {
        journal.push(`run:${s.value}`)
        this.dispose()
        this.dispose()
      })
      log("journal", JSON.stringify(journal))
      s.value = 1
      log("aucun run apres", String(journal.length))
      assert.deepEqual(log.entries, ['journal ["run:0"]', "aucun run apres 1"])
    },
  },
  {
    // SPEC §12 — un cleanup qui lève AU MOMENT DU DISPOSE remonte, et l'effet est mort. La
    // différence avec `dispose/cleanup-qui-leve` est nette : là le cleanup était levé en pleine
    // propagation, ici il est levé par le dispositeur lui-même, donc rien ne le rattrape.
    name: "dispose/cleanup-qui-leve-au-dispose",
    matrice: ["effect#29", "effect#30"],
    run(api, log) {
      const s = api.signal(0)
      let runs = 0
      const d = api.effect(() => {
        runs++
        return () => {
          throw new Error("cleanup boom")
        }
      })
      let type = "aucune erreur"
      try {
        d()
      } catch (erreur) {
        type = erreur instanceof Error ? erreur.message : "autre"
      }
      log("erreur du dispose", type)
      log("runs", String(runs))
      // L'effet est mort : plus aucun run, quelle que soit l'écriture suivante.
      s.value = 1
      log("runs apres ecriture", String(runs))
      log("la source a-t-elle un abonne ?", String(auRuntime(s)._targets === undefined))
      // Et un second dispose ne lève plus : il n'y a plus rien à faire.
      let second = "aucune erreur"
      try {
        d()
      } catch (erreur) {
        second = erreur instanceof Error ? erreur.message : "autre"
      }
      log("second dispose", second)
      assert.deepEqual(log.entries, [
        "erreur du dispose cleanup boom",
        "runs 1",
        "runs apres ecriture 1",
        "la source a-t-elle un abonne ? true",
        "second dispose aucune erreur",
      ])
    },
  },
  {
    // SPEC §9.1 — un batch imbriqué ne compte pas la profondeur : il se comporte comme un simple
    // appel. Seul le plus externe flush, et la valeur de retour intérieure remonte.
    name: "batch/valeur-et-imbrication",
    matrice: ["batch#3", "batch#5", "batch#6"],
    run(api, log) {
      const a = api.signal(0)
      const journal: string[] = []
      api.effect(() => {
        journal.push(`e:${a.value}`)
      })
      const objet = { marque: 1 }
      log("retour simple", api.batch(() => "ret") === "ret" ? "ret" : "autre")
      log("reference d objet preservee", api.batch(() => objet) === objet ? "oui" : "non")
      log("retour imbrique remonte", api.batch(() => api.batch(() => "inner")) === "inner" ? "oui" : "non")
      // L'effet a déjà tourné À SA CRÉATION, avant tout batch.
      log("journal avant le batch", JSON.stringify(journal))
      let pendant = ""
      const rendu = api.batch(() => {
        journal.push("A")
        a.value = 1
        journal.push("B")
        a.value = 2
        journal.push("C")
        pendant = JSON.stringify(journal)
        return "hors"
      })
      log("journal PENDANT le batch", pendant)
      log("journal APRES le batch", JSON.stringify(journal))
      log("retour exterieur", rendu)
      log("valeur finale", String(a.value))
      assert.deepEqual(log.entries, [
        "retour simple ret",
        "reference d objet preservee oui",
        "retour imbrique remonte oui",
        'journal avant le batch ["e:0"]',
        'journal PENDANT le batch ["e:0","A","B","C"]',
        'journal APRES le batch ["e:0","A","B","C","e:2"]',
        "retour exterieur hors",
        "valeur finale 2",
      ])
    },
  },
  {
    // SPEC §9.1 — trois niveaux d'imbrication, un seul flush. Et l'ordre de flush est l'INVERSE de
    // l'ordre de notification, pas l'ordre de création : `b` est écrit en second, donc `C` passe
    // avant `A` et `B`. C'est la règle de §13.4, et elle se lit ici.
    name: "batch/trois-niveaux-et-ordre",
    matrice: ["batch#7", "batch#14"],
    run(api, log) {
      const a = api.signal(0)
      const b = api.signal(0)
      const journal: string[] = []
      const d1 = api.effect(() => journal.push(`A:${a.value}`))
      const d2 = api.effect(() => journal.push(`B:${a.value}`))
      const d3 = api.effect(() => journal.push(`C:${b.value}`))
      api.batch(() => {
        api.batch(() => {
          api.batch(() => {
            journal.push("niveau3")
            a.value = 1
            b.value = 1
          })
          journal.push("niveau2")
        })
        journal.push("niveau1")
      })
      log("journal", JSON.stringify(journal))
      d1()
      d2()
      d3()
      assert.deepEqual(log.entries, [
        'journal ["A:0","B:0","C:0","niveau3","niveau2","niveau1","C:1","A:1","B:1"]',
      ])
    },
  },
  {
    // SPEC §9.2 — l'erreur du corps remonte ET le flush a lieu quand meme. La profondeur doit etre
    // restauree, sinon l'ecriture suivante ne flusherait plus jamais.
    name: "batch/erreur-du-corps-et-profondeur",
    matrice: ["batch#4", "batch#10"],
    run(api, log) {
      const a = api.signal(0)
      const journal: string[] = []
      api.effect(() => journal.push(`e:${a.value}`))
      let type = "aucune"
      try {
        api.batch(() => {
          a.value = 1
          throw new Error("boom")
        })
      } catch (erreur) {
        type = erreur instanceof Error ? erreur.message : "autre"
      }
      log("erreur du corps", type)
      log("journal malgre l erreur", JSON.stringify(journal))
      // La profondeur est restauree : une ecriture hors batch doit flusher normalement.
      a.value = 2
      log("apres une ecriture hors batch", JSON.stringify(journal))
      assert.deepEqual(log.entries, [
        "erreur du corps boom",
        'journal malgre l erreur ["e:0","e:1"]',
        'apres une ecriture hors batch ["e:0","e:1","e:2"]',
      ])
    },
  },
  {
    // SPEC §9.1 et §9.2 — une exception dans un batch IMBRIQUE ne passe pas par un `finally` local :
    // elle remonte au batch externe, qui flush puis re-throw. Donc RIEN ne flush au milieu, meme si
    // l'exterieur rattrape : `end` passe avant le flush, et le flush voit la valeur finale.
    name: "batch/erreur-interieure-rateepee",
    matrice: ["batch#8", "batch#9"],
    run(api, log) {
      const a = api.signal(0)
      const journal: string[] = []
      api.effect(() => journal.push(`e:${a.value}`))
      api.batch(() => {
        try {
          api.batch(() => {
            a.value = 1
            throw new Error("inner")
          })
        } catch (erreur) {
          journal.push("caught inner")
          a.value = 2
          journal.push("after")
        }
        journal.push("end")
      })
      log("journal", JSON.stringify(journal))
      const b = api.signal(0)
      const journal2: string[] = []
      api.effect(() => journal2.push(`f:${b.value}`))
      let type = "aucune"
      try {
        api.batch(() => {
          b.value = 1
          throw new Error("out")
        })
      } catch (erreur) {
        type = erreur instanceof Error ? erreur.message : "autre"
      }
      log("erreur exterieure", type)
      log("journal exterieur malgre l erreur", JSON.stringify(journal2))
      assert.deepEqual(log.entries, [
        'journal ["e:0","caught inner","after","end","e:2"]',
        "erreur exterieure out",
        'journal exterieur malgre l erreur ["f:0","f:1"]',
      ])
    },
  },
  {
    // SPEC §9.3 — ecrire plusieurs fois la MEME valeur ne notifie qu'une fois, et un effet notifie
    // deux fois ne tourne qu'une fois par flush. Le temoin lit `a`, donc il a bien une dependance.
    name: "batch/ecriture-identique",
    matrice: ["batch#2", "batch#11", "batch#12", "batch#15"],
    run(api, log) {
      const a = api.signal(0)
      const journal: string[] = []
      api.effect(() => journal.push(`e:${a.value}`))
      api.batch(() => {
        a.value = 1
        a.value = 1
        a.value = 1
      })
      log("journal", JSON.stringify(journal))
      // Un batch sans ecriture ne flush pas du tout.
      api.batch(() => {
        a.value
      })
      log("apres un batch sans ecriture", JSON.stringify(journal))
      // Et une reecriture identique HORS batch ne notifie toujours pas.
      a.value = 1
      log("apres reecriture identique", JSON.stringify(journal))
      a.value = 2
      log("apres une vraie ecriture", JSON.stringify(journal))
      assert.deepEqual(log.entries, [
        'journal ["e:0","e:1"]',
        'apres un batch sans ecriture ["e:0","e:1"]',
        'apres reecriture identique ["e:0","e:1"]',
        'apres une vraie ecriture ["e:0","e:1","e:2"]',
      ])
    },
  },
  {
    // SPEC §13.5 — `A → B → A` dans un batch : l'aval n'a pas a recalculer. Mais un revert sur `a`
    // et un changement reel sur `b` font changer le computé, donc le fast-forward n'est pas un
    // passe-partout.
    name: "batch/revert-a-b-a",
    matrice: ["batch#16", "batch#19", "batch#21"],
    run(api, log) {
      const a = api.signal(0)
      const b = api.signal(0)
      let cCalls = 0
      let eRuns = 0
      const c = api.computed(() => {
        cCalls++
        return a.value + b.value
      })
      api.effect(() => {
        eRuns++
        c.value
      })
      log("etat initial", `cCalls:${cCalls} eRuns:${eRuns}`)
      api.batch(() => {
        a.value = 1
        a.value = 2
        a.value = 0
      })
      log("apres un revert simple", `cCalls:${cCalls} eRuns:${eRuns}`)
      api.batch(() => {
        a.value = 5
        a.value = 0
        b.value = 10
      })
      log("apres revert et changement", `cCalls:${cCalls} eRuns:${eRuns}`)
      log("valeur du computé", String(c.value))
      // Un effet créé DANS le corps du batch voit son premier run immediatement : le batch retarde
      // la propagation, pas l'exécution. C'est `batch#21`.
      let dansLeBatch = "jamais"
      const d = api.signal(0)
      api.batch(() => {
        d.value = 1
        api.effect(() => {
          dansLeBatch = `vu:${d.value}`
        })
      })
      log("effet cree dans le batch", dansLeBatch)
      assert.deepEqual(log.entries, [
        "etat initial cCalls:1 eRuns:1",
        "apres un revert simple cCalls:1 eRuns:1",
        "apres revert et changement cCalls:2 eRuns:2",
        "valeur du computé 10",
        "effet cree dans le batch vu:1",
      ])
    },
  },
  {
    // SPEC §13.5 — MAIS une lecture paresseuse PENDANT le batch fait perdre le fast-forward. Le
    // noeud a consume la version intermediaire, donc l'effet tourne une seconde fois, avec la
    // valeur REVERTIE. C'est le cas le plus subtil de la tranche, et il tient en un scenario.
    name: "batch/revert-avec-lecture-paresseuse",
    matrice: ["batch#17", "batch#18", "batch#20"],
    run(api, log) {
      const a = api.signal(0)
      const journal: string[] = []
      let cCalls = 0
      const c = api.computed(() => {
        cCalls++
        return a.value
      })
      // L'effet lit le COMPUTÉ, pas `a` : c'est lui qui consomme la version intermediaire.
      api.effect(() => journal.push(`e:${c.value}`))
      api.batch(() => {
        a.value = 10
        journal.push(`mid:${c.value}`)
        a.value = 0
      })
      log("journal", JSON.stringify(journal))
      log("cCalls", String(cCalls))
      log("fin", `end:${c.value}`)
      // Une ecriture ulterieure ne doit pas rester figee sur la valeur revertee.
      a.value = 20
      log("cCalls apres ecriture ulterieure", String(cCalls))
      assert.deepEqual(log.entries, [
        'journal ["e:0","mid:10","e:0"]',
        "cCalls 3",
        "fin end:0",
        "cCalls apres ecriture ulterieure 4",
      ])
    },
  },
  {
    // SPEC §9.3 — la reconciliation compare les VALEURS avec `===`, pas avec `Object.is`. Lu dans la
    // baseline ligne 180 : `source._value === snapshots._value`.
    //
    // Deux consequences, et il faut les deux cas pour les voir :
    // - un signal LAISSE a `NaN` n'est jamais considere comme revenu, donc l'effet tourne ;
    // - un signal passe de `-0` a `0` l'est toujours, donc l'effet ne tourne pas. Il faut
    //   CONSTRUIRE le signal a `-0` : ecrire `-0` sur un `0` est ignore (§14), donc l'ecriture
    //   n/registerait meme pas de version.
    name: "batch/identite-stricte-du-snapshot",
    matrice: ["batch#16", "batch#20"],
    run(api, log) {
      const nan = api.signal(0)
      let runsNaN = 0
      api.effect(() => {
        runsNaN++
        nan.value
      })
      api.batch(() => {
        nan.value = Number.NaN
      })
      log("laisses a NaN : runs", String(runsNaN))
      const zero = api.signal(-0)
      let runsZero = 0
      api.effect(() => {
        runsZero++
        zero.value
      })
      api.batch(() => {
        zero.value = 1
        zero.value = 0
      })
      log("reparti de -0 : runs", String(runsZero))
      assert.deepEqual(log.entries, [
        "laisses a NaN : runs 2",
        "reparti de -0 : runs 1",
      ])
    },
  },
  {
    // SPEC §15.2 — un cycle BORNE ne leve pas : cinquante et une executions, silencieusement. Un
    // cycle non borne finit par une `Error`, en un nombre borne de generations.
    //
    // Le compte n'est PAS fige (§15.2 et §21 : le seuil est un parametre d'implementation), donc ce
    // scenario verifie le CARACTERE de la sortie — « une Error, et un compte borne » — pas un
    // nombre exact. Une assertion sur 102 serait fausse des que le seuil bouge.
    name: "batch/cycle-borne-et-non-borne",
    matrice: ["batch#13", "batch#22", "batch#23", "batch#26"],
    run(api, log) {
      const borne = api.signal(0)
      let runs = 0
      api.effect(() => {
        runs++
        const v = borne.value
        if (v < 50) borne.value = v + 1
      })
      log("cycle borne : runs", String(runs))
      let type = "aucune"
      try {
        api.batch(() => {
          borne.value = 1
        })
      } catch (erreur) {
        type = erreur instanceof Error ? erreur.constructor.name : "autre"
      }
      log("cycle borne : leve", type)
      // L'effet infini n'ecrit qu'une fois ARME, sinon il cyclerait des sa creation.
      const infini = api.signal(0)
      let arme = false
      let runsInfini = 0
      api.effect(() => {
        // La lecture est HORS du garde : un effet qui ne lit rien n'a aucune dependance, donc
        // l'ecriture du batch ne le réveillerait pas et le cycle ne demarrerait jamais.
        const v = infini.value
        runsInfini++
        if (arme) infini.value = v + 1
      })
      arme = true
      let typeInfini = "aucune"
      try {
        api.batch(() => {
          infini.value = 1
        })
      } catch (erreur) {
        typeInfini = erreur instanceof Error ? erreur.constructor.name : "autre"
      }
      log("cycle non borne : type", typeInfini)
      log("cycle non borne : compte borne", runsInfini > 1 && runsInfini <= 500 ? "oui" : "non")
      // `batch#26` — le compteur d'iterations est REMIS A ZERO apres une erreur. Donc un effet
      // auto-ecrivant cree APRES le cycle doit encore cycler : s'il heritants du seuil consomme, il
      // ne tournerait qu'une fois.
      const apresErreur = api.signal(0)
      let arme2 = false
      let runsApres = 0
      api.effect(() => {
        const v = apresErreur.value
        runsApres++
        if (arme2) apresErreur.value = v + 1
      })
      arme2 = true
      let typeApres = "aucune"
      try {
        api.batch(() => {
          apresErreur.value = 1
        })
      } catch (erreur) {
        typeApres = erreur instanceof Error ? erreur.constructor.name : "autre"
      }
      log("apres une erreur : type", typeApres)
      log("apres une erreur : le compteur repart", runsApres > 1 ? "oui" : "non")
      // `batch#13` — un effect qui ouvre SON PROPRE batch pendant le flush re-batche : la
      // notification de l'effet exterieur attend la sortie de ce batch-la.
      const exterieur = api.signal(0)
      const journal: string[] = []
      api.effect(() => {
        journal.push(`avant:${exterieur.value}`)
        api.batch(() => {
          journal.push("dans le batch de l effect")
        })
        journal.push(`apres:${exterieur.value}`)
      })
      exterieur.value = 1
        // `batch#23` — le meme cycle, mais l effet ouvre son PROPRE batch pour ecrire. Le seuil est
        // alors atteint a l interieur d un drainage : c est ce qui distingue ce cas du precedent, ou
        // l ecriture venait du batch de l utilisateur.
        const propre = api.signal(0)
        let armePropre = false
        let runsPropre = 0
        api.effect(() => {
          const v = propre.value
          runsPropre++
          if (armePropre) api.batch(() => (propre.value = v + 1))
        })
        armePropre = true
        let typePropre = "aucune"
        try {
          propre.value = 1
        } catch (erreur) {
          typePropre = erreur instanceof Error ? erreur.constructor.name : "autre"
        }
        log("batch ecrit par l effet : type", typePropre)
        log("batch ecrit par l effet : compte borne", runsPropre > 1 && runsPropre <= 500 ? "oui" : "non")
        // `batch#24` et `batch#25` — le ping-pong entre DEUX et TROIS effets, chacun abonné à DEUX
        // signaux et écrivant celui de l'autre. C'est la LECTURE CROISÉE qui rend la liste des
        // dépendances à plus d'un élément, et donc ce qui fait que le drainage a une file à vider.
        //
        // Les COMPTES EXACTS (52/51, 35/35/34) ne sont pas affirmés : SPEC §15.2 refuse de figer
        // le seuil, §21 le confirme. Ce qui se fige, c'est le CARACTÈRE — chaque effet tourne
        // plusieurs fois, et une erreur sort. C'est ce que la divergence observée faisait échouer.
        const formePingPong = (nb: number): [string, boolean] => {
          const signaux = Array.from({ length: nb }, () => api.signal(0))
          const runs = new Array<number>(nb).fill(0)
          const armes = new Array<boolean>(nb).fill(false)
          for (let i = 0; i < nb; i++) {
            const idx = i
            const mien = signaux[idx]
            if (mien === undefined) continue
            const suivant = signaux[(idx + 1) % nb]
            api.effect(() => {
              // La LECTURE CROISÉE est ce qui compte : sans elle, chaque effet n'a qu'une seule
              // dépendance, et le ping-pong n'a rien à vider.
              mien.value
              suivant?.value
              runs[idx] = (runs[idx] ?? 0) + 1
              if (armes[idx] && suivant !== undefined && (runs[idx] ?? 0) < PLAFOND) suivant.value++
            })
          }
          for (let i = 0; i < nb; i++) armes[i] = true
          try {
            const premier = signaux[0]
            if (premier === undefined) return ["aucune", false]
            premier.value++
          } catch (erreur) {
            return [erreur instanceof Error ? erreur.constructor.name : "autre", true]
          }
          return ["aucune", false]
        }
        // Le PLAFOND borne les écritures pour que le test TERMINE même sur un moteur qui ne
        // détecte pas le cycle — un test qui pend n'est pas un test, c'est un minuteur. Un moteur
        // sain s'arrête bien avant : 203 runs pour deux effets, 303 pour trois.
        const PLAFOND = 500
        const [typePing, pingTourne] = formePingPong(2)
        log("ping pong a 2 effets : type", typePing)
        log("ping pong a 2 effets : tous ont tourne", pingTourne ? "oui" : "non")
        const [typePing3, ping3Tourne] = formePingPong(3)
        log("ping pong a 3 effets : type", typePing3)
        log("ping pong a 3 effets : tous ont tourne", ping3Tourne ? "oui" : "non")
        log("batch cree dans le flush", JSON.stringify(journal))
      assert.deepEqual(log.entries, [
        "cycle borne : runs 51",
        "cycle borne : leve aucune",
        "cycle non borne : type Error",
        "cycle non borne : compte borne oui",
          "apres une erreur : type Error",
          "apres une erreur : le compteur repart oui",
          "batch ecrit par l effet : type Error",
          "batch ecrit par l effet : compte borne oui",
          "ping pong a 2 effets : type Error",
          "ping pong a 2 effets : tous ont tourne oui",
          "ping pong a 3 effets : type Error",
          "ping pong a 3 effets : tous ont tourne oui",
        'batch cree dans le flush ["avant:0","dans le batch de l effect","apres:0","avant:1","dans le batch de l effect","apres:1"]',
      ])
    },
  },
  {
    // SPEC §10 — une lecture sous `untracked` n'etablit AUCUNE dependance. Et c'est exactement
    // equivalent a `peek`. Les deux effects lisent `x` par des chemins differents, et ni l'un ni
    // l'autre ne se reveille.
    name: "untracked/aucune-dependance",
    matrice: ["untracked#1", "untracked#6"],
    run(api, log) {
      const a = api.signal(0)
      const b = api.signal(0)
      const journal: string[] = []
      api.effect(() => {
        journal.push(`e:${a.value}/${api.untracked(() => b.value)}`)
      })
      log("apres creation", JSON.stringify(journal))
      b.value = 1
      log("b ecrit, non suivi", JSON.stringify(journal))
      b.value = 2
      log("b reecrit", JSON.stringify(journal))
      a.value = 1
      log("a ecrit", JSON.stringify(journal))
      // Meme effet avec `peek` : aucune dependance non plus.
      const c = api.signal(0)
      let runsPeek = 0
      api.effect(() => {
        runsPeek++
        c.peek()
      })
      c.value = 1
      log("runs avec peek", String(runsPeek))
      const d = api.signal(0)
      let runsUntracked = 0
      api.effect(() => {
        runsUntracked++
        api.untracked(() => d.value)
      })
      d.value = 1
      log("runs avec untracked", String(runsUntracked))
      assert.deepEqual(log.entries, [
        'apres creation ["e:0/0"]',
        'b ecrit, non suivi ["e:0/0"]',
        'b reecrit ["e:0/0"]',
        'a ecrit ["e:0/0","e:1/2"]',
        "runs avec peek 1",
        "runs avec untracked 1",
      ])
    },
  },
  {
    // SPEC §10 — `untracked` n'empeche pas les ecritures, et restaure le contexte meme apres une
    // exception. Sans le `finally`, l'ecriture suivante ne reverait plus l'effet.
    name: "untracked/ecritures-et-restauration",
    matrice: ["untracked#2", "untracked#3", "untracked#4"],
    run(api, log) {
      const a = api.signal(0)
      const journal: string[] = []
      api.effect(() => journal.push(`e:${a.value}`))
      api.untracked(() => {
        journal.push("dans untracked")
        a.value = 1
        journal.push("apres ecriture")
      })
      log("ecritures autorisees", JSON.stringify(journal))
      try {
        api.untracked(() => {
          journal.push("va lever")
          throw new Error("boom")
        })
      } catch (erreur) {
        journal.push("caught")
      }
      a.value = 2
      log("restaure apres exception", JSON.stringify(journal))
      assert.deepEqual(log.entries, [
        'ecritures autorisees ["e:0","dans untracked","e:1","apres ecriture"]',
        'restaure apres exception ["e:0","dans untracked","e:1","apres ecriture","va lever","caught","e:2"]',
      ])
    },
  },
  {
    // SPEC §10 — `untracked` NE DESACTIVE PAS le rafraîchissement d'un computé lu : l'effet ne
    // re-tourne pas, mais le computé a été RAFRAICHI. Lire n'est pas invalider. La valeur périmée
    // ne s'observe qu'en lisant le computé HORS de tout effet — c'est ce que fait la derniere ligne.
    name: "untracked/refresh-de-compute",
    matrice: ["untracked#7"],
    run(api, log) {
      const a = api.signal(0)
      let runs = 0
      let cCalls = 0
      const c = api.computed(() => {
        cCalls++
        return a.value * 2
      })
      api.effect(() => {
        runs++
        api.untracked(() => c.value)
      })
      log("etat initial", `runs:${runs} cCalls:${cCalls}`)
      a.value = 5
      log("apres ecriture", `runs:${runs} cCalls:${cCalls}`)
      // La lecture dehors RAFRAICHI le computé sans réveiller l'effet : c'est ça le quirk.
      log("valeur lue dehors", String(c.value))
      log("apres la lecture", `runs:${runs} cCalls:${cCalls}`)
      assert.deepEqual(log.entries, [
        "etat initial runs:1 cCalls:1",
        "apres ecriture runs:1 cCalls:1",
        "valeur lue dehors 10",
        "apres la lecture runs:1 cCalls:2",
      ])
    },
  },
  {
    // SPEC §10 — la valeur de retour, y compris une `Promise` renvoyee telle quelle.
    name: "untracked/valeur-de-retour",
    matrice: ["untracked#5"],
    run(api, log) {
      log("nombre", String(api.untracked(() => 42)))
      const objet = { a: 1 }
      log("objet", api.untracked(() => objet) === objet ? "la reference" : "une copie")
      const promesse = Promise.resolve(7)
      log("promesse passee telle quelle", api.untracked(() => promesse) === promesse ? "oui" : "non")
      log("undefined", String(api.untracked(() => undefined)))
      assert.deepEqual(log.entries, [
        "nombre 42",
        "objet la reference",
        "promesse passee telle quelle oui",
        "undefined undefined",
      ])
    },
  },
  {
    // SPEC §13.6 — un effet cree dans un `untracked` est INDEPENDANT du parent. Le parent lit `a`,
    // donc il se reveille et cree un second interieur. Mais le PREMIER interieur ne re-tourne pas
    // avec le parent : chacun a ete lance une fois, jamais deux. L'interieur lit `b`, qui ne change
    // jamais — donc tout re-run qu'il ferait serait imputable au parent, et c'est ce que le compte
    // verifie.
    name: "untracked/effet-cree-dedans",
    matrice: ["untracked#8", "untracked#9"],
    run(api, log) {
      const a = api.signal(0)
      const b = api.signal(0)
      let parents = 0
      let interieurs = 0
      let crees = 0
      api.effect(() => {
        parents++
        a.value
        api.untracked(() => {
          crees++
          api.effect(() => {
            interieurs++
            b.value
          })
        })
      })
      log("apres le run initial", `parents:${parents} crees:${crees} interieurs:${interieurs}`)
      a.value = 1
      log("apres ecriture", `parents:${parents} crees:${crees} interieurs:${interieurs}`)
      assert.deepEqual(log.entries, [
        "apres le run initial parents:1 crees:1 interieurs:1",
        "apres ecriture parents:2 crees:2 interieurs:2",
      ])
    },
  },
]

// ---- Le registre de couverture -----------------------------------------------------
//
// Le critère du ticket est « aucune entrée de la matrice `signal` ni conversions n'est laissée
// sans scénario ». Tel quel, ce n'est pas une phrase : rien ne la rendait vérifiable, et une
// entrée pouvait disparaître en silence.
//
// Ici, chaque entrée est nommée, et son sort est écrit. Deux valeurs possibles :
//   - le nom d'un scénario de la table ou d'un test signalcn-seul, qui la couvre ;
//   - un numéro de ticket, qui la reprendra. Parce que certaines entrées ne sont pas
//     couvrables ici : elles ont besoin d'un abonné, et le premier arrive en #24.
//
// Le test `registre-complet` échoue si une entrée manque, et si un nom de scénario cité n'existe
// pas. Une entrée ne peut donc plus être perdue sans que la suite le dise.
export const COUVERTURE: Record<string, string> = {
  // --- groupe `signal` : 23 entrées
  "signal#1": "signal/instance-et-classe",
  "signal#2": "signal/sans-argument",
  // signal#3 et #4 sont des affirmations de structure : elles ne peuvent PAS passer contre la
  // baseline, qui minifie ses noms de propriétés. Elles sont donc nôtres seules.
  "signal#3": "signalcn-seul/structure-de-classe",
  "signal#4": "signalcn-seul/structure-de-classe",
  // La notification demande un observateur. Un effet la rendra visible.
  "signal#5": TICHETS.effet,
  "signal#6": "signal/egalite-stricte-nan + signalcn-seul/notifie-sur-stricte-identite",
  "signal#7": "signal/zero-et-negative-zero + signalcn-seul/notifie-sur-stricte-identite",
  "signal#8": "signal/zero-et-negative-zero + signalcn-seul/notifie-sur-stricte-identite",
  "signal#9": `signal/egalite-stricte-objet + ${TICHETS.effet}`,
  "signal#10": `signal/egalite-stricte-objet + ${TICHETS.effet}`,
  "signal#11": `signal/egalite-stricte-objet + ${TICHETS.effet}`,
  "signal#12": TICHETS.effet,
  "signal#13": TICHETS.effet,
  // L'absence de dependance de `peek()` ne se voit qu'a travers un effet.
  "signal#14": TICHETS.effet,
  "signal#15": "signal/peek + signalcn-seul/descripteurs-de-prototype",
  "signal#16": "signal/options-name",
  "signal#17": "signal/brand-et-pas-de-dispose",
  "signal#18": "signal/instance-et-classe",
  "signal#19": "signal/instance-et-classe",
  "signal#20": "signal/instance-et-classe",
  "signal#21": "signalcn-seul/signal-gele",
  "signal#22": "signal/brand-et-pas-de-dispose",
  "signal#23": "signal/brand-et-pas-de-dispose",

  // --- groupe conversions : 15 entrées
  "conv#1": "conversions/to-string-et-value-of",
  "conv#2": "conversions/to-string-throw-sur-symbol",
  "conv#3": "conversions/pas-de-symbol-to-primitive",
  // Les quatre « suit la dependance » attendent un effet.
  "conv#4": TICHETS.effet,
  "conv#5": "conversions/to-string-et-value-of",
  "conv#6": TICHETS.effet,
  "conv#7": "conversions/to-json-et-stringify",
  "conv#8": TICHETS.effet,
  // La propagation d'erreur par une conversion demande un computed qui jette.
  "conv#9": TICHETS.computed,
  // DIVERGENCE ASSUMÉE : la baseline écrit son prototype à la main, donc ses méthodes y sont
  // énumérables. SPEC §20 impose des classes natives ES2020, dont les méthodes de prototype
  // sont non énumérables. Nous divergons, et c'est le nôtre qui est vérifié.
  "conv#10": "signalcn-seul/descripteurs-de-prototype",
  "conv#11": "signal/brand-et-pas-de-dispose",
  "conv#12": "signalcn-seul/descripteurs-de-prototype",
  "conv#13": "signal/brand-et-pas-de-dispose",
  "conv#14": "conversions/to-json-et-stringify",
  "conv#15": TICHETS.effet,

  // --- groupe `computed` : 27 entrées
  "computed#1": "computed/paresseux-et-cache",
  "computed#2": "computed/paresseux-et-cache",
  "computed#3": "computed/sans-abonne",
  "computed#4": "computed/invalidation-et-recalcul",
  // computed#5 et #6 : un résultat identique n'a pas de versions différentes à comparer sans
  // observateur. Un effet les rend visibles.
  "computed#5": TICHETS.effet,
  "computed#6": TICHETS.effet,
  "computed#7": "computed/invalidation-et-recalcul",
  "computed#8": "computed/dependances-dynamiques",
  "computed#9": "computed/reactivation-apres-abandon",
  // computed#10 : l'ordre de sortie anticipée de `checkDirty` ne se voit qu'à travers le nombre
  // de recalculs d'un effet. Ici on fige l'ordre de la liste, ce qui en est la cause.
  "computed#10": "signalcn-seul/ordre-des-sources",
  "computed#11": TICHETS.batch,
  "computed#12": "computed/cycles",
  "computed#13": "computed/cycles",
  "computed#14": TICHETS.effet,
  "computed#15": "computed/erreur-stockee",
  "computed#16": "computed/erreur-stockee",
  "computed#17": TICHETS.effet,
  "computed#18": TICHETS.effet,
  // computed#19, #20, #21, #22 : le prototype partagé de la baseline est un écart ASSUMÉ, voir
  // SPEC §21 et ADR-0004. Notre prototype ne porte pas d'état, nos noms sont lisibles, et
  // `constructor` vaut `Computed` et non `Signal` — le correctif que SPEC §21 enregistre. Ces
  // quatre entrées ne sont donc pas différentielles : elles sont nôtres seules.
  "computed#19": "signalcn-seul/structure-de-classe",
  "computed#20": "signalcn-seul/structure-de-classe",
  "computed#21": "signalcn-seul/structure-de-classe",
  "computed#22": "signalcn-seul/structure-de-classe",
  "computed#23": "computed/lecture-seule",
  "computed#24": "computed/lecture-seule",
  "computed#25": "computed/options-et-marque",
  "computed#26": TICHETS.subscribe,
  "computed#27": "computed/options-et-marque",
  // --- groupe `effect` : 41 entrées
  "effect#1": "effect/premier-run-et-arguments",
  "effect#2": "effect/rerun-et-cleanup",
  "effect#3": "effect/sans-dependance",
  "effect#4": "effect/forme-du-dispositeur",
  "effect#5": "effect/retour-non-fonction-ignore",
  "effect#6": "effect/rerun-et-cleanup",
  "effect#7": "effect/cleanup-hors-suivi",
  "effect#8": "effect/rerun-et-cleanup",
  "effect#9": "effect/this-est-linstance",
  "effect#10": "effect/this-est-linstance",
  "effect#11": "dispose/pendant-le-run",
  "effect#12": "dispose/pendant-le-run",
  "effect#13": "dispose/idempotent-et-detachement",
  "effect#14": "dispose/dans-la-file",
  // effect#15 et #17 : l'ordre INVERSÉ est normatif à l'intérieur d'un batch. Hors batch chaque
  // écriture draine seule, donc l'ordre ne s'observe pas — ce que le scénario vérifie.
  "effect#15": "effect/ordre-hors-batch + #26",
  "effect#16": "effect/auto-ecriture",
  "effect#17": "effect/ordre-hors-batch + #26",
  "effect#18": "effect/erreurs",
  "effect#19": "effect/cycle-borne",
  "effect#20": "effect/erreurs",
  "effect#21": "effect/watchers",
  "effect#22": "effect/erreurs",
  // effect#23, #25, #26, #27 : la propagation d'erreur passe par le batch ou par un setter, donc
  // par #26.
  "effect#23": "#26",
  "effect#24": "effect/erreurs",
  "effect#25": "#26",
  "effect#26": "#26",
  "effect#27": "#26",
  "effect#28": "dispose/cleanup-qui-leve",
  "effect#29": "dispose/cleanup-qui-leve-au-dispose",
  "effect#30": "dispose/cleanup-qui-leve + dispose/cleanup-qui-leve-au-dispose",
  "effect#31": "dispose/cleanup-qui-leve + dispose/dans-la-file",
  "effect#32": "effect/chaine-et-drain",
  "effect#33": "effect/nesting-et-independance",
  // effect#34 : un effet créé dans un COMPUTÉ fuit à chaque évaluation. C'est un quirk figé, et le
  // mesurer demande un observateur — donc un effet dans un effet.
  "effect#34": "signalcn-seul/effet-dans-un-calcule",
  "effect#35": "effect/forme-du-dispositeur",
  "effect#36": "signalcn-seul/options-de-linstance",
  "effect#37": "signalcn-seul/drapeaux-initiaux",
  "effect#38": "effect/premier-run-et-arguments",
  // effect#39 : la baseline écrit son prototype à la main, donc ses méthodes y sont énumérables.
  // ADR-0004 refuse cette énumérabilité. DIVERGENCE ASSUMÉE.
  "effect#39": "signalcn-seul/descripteurs-de-prototype",
  "effect#40": "signalcn-seul/hors-ordre",
  "effect#41": "signalcn-seul/symbol-dispose-et-using",

  // ---- `batch` et `untracked` -----------------------------------------------------------------
  //
  // Vingt-quatre des vingt-six entrées `batch` et neuf des treize `untracked` sont couvertes par
  // les quatorze scénarios de la tranche. Les sept restantes sont ci-dessous, avec la raison.
  //
  // `batch#24` et `batch#25` — le ping-pong entre effets — n'ont NI fauxificateur NI scénario, parce
  // qu'ils ne passent pas. La chaîne d'une SEULE génération croît sans fin : le compteur
  // `batchIteration` reste donc figé, et le seuil n'arrive jamais. La baseline s'arrête en 2 ms sur
  // 52/51 runs ; nous ne nous arrêtons pas. C'est un défaut du DRAINAGE, et il est REPRODUCTIBLE
  // SANS `batch` — deux signaux et deux effets suffisent — donc il ne tombe pas sous cette tranche.
  // C'est #35.
  //
  // Deux dépendances à plusieurs sources ont été trouvées EN CHEMIN et corrigées — `sourcesAreStale`,
  // `disposeSelf`, `Computed._addNode` et `Computed._removeNode` parcouraient la liste des dépendances
  // par `_next`, qui ne rend que la tête. Elles ne suffisent pas à arrêter le ping-pong, et il ne faut
  // pas prétendre le contraire : la chaîne qui croît est un autre mécanisme, encore à trouver.
  //
  // `batch#20` reste sans falsificateur pour une raison STRUCTURELLE, et non de flemme : une
  // écriture de drainage a pour valeur de snapshot la valeur d'AVANT elle, donc elle s'en est déjà
  // éloignée quand la réconciliation du batch SUIVANT la compare. La faire passer demanderait une
  // écriture restaurative ULTÉRIEURE et un nœud qui n'a pas relu entre-temps — soit deux fois la
  // machinerie de `batch#17`. La garde est en place et se lit ; son falsificateur arrive avec le
  // registre dérivé de la matrice, en #33.
    "batch#1": "batch/valeur-et-imbrication",
  "batch#2": "batch/ecriture-identique",
  "batch#3": "batch/valeur-et-imbrication",
  "batch#4": "batch/erreur-du-corps-et-profondeur",
  "batch#5": "batch/valeur-et-imbrication",
  "batch#6": "batch/valeur-et-imbrication",
  "batch#7": "batch/trois-niveaux-et-ordre",
  "batch#8": "batch/erreur-interieure-rateepee",
  "batch#9": "batch/erreur-interieure-rateepee",
  "batch#10": "batch/erreur-du-corps-et-profondeur",
  "batch#11": "batch/ecriture-identique",
  "batch#12": "batch/ecriture-identique",
  "batch#13": "batch/cycle-borne-et-non-borne",
  "batch#14": "batch/trois-niveaux-et-ordre",
  "batch#15": "batch/ecriture-identique",
  "batch#16": "batch/revert-a-b-a",
  "batch#17": "batch/revert-avec-lecture-paresseuse",
  "batch#18": "batch/revert-avec-lecture-paresseuse",
  "batch#19": "batch/revert-a-b-a",
  "batch#20": "batch/revert-avec-lecture-paresseuse",
  "batch#21": "batch/revert-a-b-a",
  "batch#22": "batch/cycle-borne-et-non-borne",
  "batch#23": "batch/cycle-borne-et-non-borne",
  "batch#24": "batch/cycle-borne-et-non-borne",
  "batch#25": "batch/cycle-borne-et-non-borne",
  "batch#26": "batch/cycle-borne-et-non-borne",
  // `untracked#10` a `#11` et `#12` portent sur la portee de capture d'effets d'un modele : ils
  // ne sont atteignables qu'avec `createModel`, qui est #28. `untracked#13` est un usage INTERNE —
  // `peek` est deja couvert par `untracked/aucune-dependance`, `watched`/`unwatched` arrivent avec
  // `subscribe` en #25.
  "untracked#1": "untracked/aucune-dependance",
  "untracked#2": "untracked/ecritures-et-restauration",
  "untracked#3": "untracked/ecritures-et-restauration",
  "untracked#4": "untracked/ecritures-et-restauration",
  "untracked#5": "untracked/valeur-de-retour",
  "untracked#6": "untracked/aucune-dependance",
  "untracked#7": "untracked/refresh-de-compute",
  "untracked#8": "untracked/effet-cree-dedans",
  "untracked#9": "untracked/effet-cree-dedans",
    "untracked#10": TICHETS.modele,
    "untracked#11": TICHETS.modele,
    "untracked#12": TICHETS.modele,
    "untracked#13": `untracked/aucune-dependance + ${TICHETS.subscribe}`,

  // --- groupe `dispose` : 10 entrées
  "dispose#1": "effect/forme-du-dispositeur",
  // dispose#2 : la baseline fait pointer `Symbol.dispose` sur le dispositeur, qui est une fonction
  // LIÉE, et V8 refuse alors cette méthode. On garde l'identité en passant par une fermeture :
  // le `bind` de la baseline était le seul obstacle, et il était évitable. CONFORME.
  "dispose#2": "signalcn-seul/symbol-dispose-et-using",
  "dispose#3": "signalcn-seul/symbol-dispose-et-using",
  // dispose#4 : `subscribe` renvoie aussi un disposeur — #25.
  "dispose#4": "#25",
  // dispose#5 : un realm où `Symbol.dispose` est ABSENT. La matrice note que ce cas n'est
  // atteignable que sur le bundle réel dans un tel realm ; l'affirmer demanderait de l'éteindre.
  "dispose#5": "signalcn-seul/symbol-dispose-absent",
  "dispose#6": "dispose/idempotent-et-detachement + dispose/cleanup-qui-leve-au-dispose",
  "dispose#7": "dispose/pendant-le-run",
  "dispose#8": "dispose/dans-la-file",
  "dispose#9": "dispose/idempotent-et-detachement",
  "dispose#10": "signalcn-seul/descripteurs-de-prototype",
}

/**
 * Les entrées de matrice des cinq groupes traités ici. Les COMPTES sont écrits en dur, et c'est
 * une faiblesse connue : une entrée ajoutée à la matrice laisserait `registre-complet`
 * vert. Le durcissement — lire la matrice pour en dériver la liste — est [#33](#33), qui a trouvé
 * le problème en冲着 les entrées structurelles.
 */
export const ENTREES_ATTENDUES = [
  ...Array.from({ length: 23 }, (_, i) => `signal#${i + 1}`),
  ...Array.from({ length: 15 }, (_, i) => `conv#${i + 1}`),
  ...Array.from({ length: 27 }, (_, i) => `computed#${i + 1}`),
  ...Array.from({ length: 41 }, (_, i) => `effect#${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `dispose#${i + 1}`),
  ...Array.from({ length: 26 }, (_, i) => `batch#${i + 1}`),
  ...Array.from({ length: 13 }, (_, i) => `untracked#${i + 1}`),
]

// Le reliquat : il n'a aucune raison d'exister ailleurs.
//
// Le garde n'est pas cosmetique. Le harnais doit pouvoir lire la table AVANT que le moteur
// existe — c'est tout l'interet d'un oracle : valider d'abord, ecrire ensuite. Si ce fichier
// importait le moteur au niveau superieur, l'oracle serait indisponible tant que le moteur
// manque, et l'ordre rouge-vert n'aurait plus de juge. `NODE_TEST_CONTEXT` est pose par
// `node --test` dans chaque fichier de test, et nowhere ailleurs.

// ---- Une seule source pour `matrice` ----------------------------------------------------
//
// Le registre `COUVERTURE` est l'unique endroit qui dit quelle entrée est couverte par quoi.
// Le champ `matrice` d'un scénario en est DÉDUIT, jamais écrit à la main : les deux ne
// peuvent donc pas diverger. Écrire les deux, c'est garantir qu'un jour l'un des deux aura tort
// en silence — et personne ne verrait rien, parce que le harnais ne fait qu'un décompte.
function entreesCouvertesPar(nomScenario: string): string[] {
  return Object.entries(COUVERTURE)
    .filter(([, destination]) => destination.split("+").map(d => d.trim()).includes(nomScenario))
    .map(([id]) => id)
    .sort()
}

for (const scenario of scenarios) {
  scenario.matrice = entreesCouvertesPar(scenario.name)
}

if (process.env.NODE_TEST_CONTEXT) {
  const runtime = import("./signals.ts")

  // L'unique façon d'obtenir le moteur, et elle est volontairement une FONCTION.
  //
  // Un `await` au niveau du bloc serait du niveau ES2022, alors que la cible est ES2020. Le
  // piège est que `node --test` sur la SOURCE accepte l'`await` de premier niveau — le
  // type-stripping de Node le supporte — et qu'esbuild le refuse seulement à la minification.
  // Résultat : la suite source verte, l'artefact cassé, et le décalage découvert au moment du
  // build. C'est arrivé deux fois dans cette tranche. Ici la forme rend l'erreur impossible.
  const moteurDe = async () => await runtime

  for (const { name, run } of scenarios) {
    test(name, async () => {
const { signal: s, computed, effect, batch, untracked, Signal, Computed, Effect } = await runtime
        run(
          {
            signal: s,
            computed,
            effect,
            Signal,
            Computed,
            Effect,
            batch,
            untracked,
          },
          makeLog(),
        )
    })
  }

  /** Ce que reçoit un test signalcn-seul. */
  type Moteur = {
    signal: typeof signalFn
    computed: typeof computedFn
    effect: typeof effectFn
    Signal: typeof SignalClass
    Computed: typeof ComputedClass
    Effect: typeof EffectClass
  }

  // ---- Les tests signalcn-seuls, en une seule source --------------------------------
  // Cet objet alimente `node:test` ET le contrôle du registre. Avant, les noms vivaient dans une
  // liste à côté : on pouvait y ajouter un nom, le citer dans le registre, et le registre passer
  // sans qu'aucun test n'existe derrière. Un contrôle à sens unique n'est pas un contrôle.
  //
  // Ils sont ici, et pas dans un fichier séparé, pour ne pas ajouter un troisième fichier à un
  // couple dont la composition est figée.
  const testsSignalcnSeul: Record<string, (moteur: Moteur) => Promise<void>> = {
    // C'est ICI que se joue la moitié de SPEC §5.2 que la table ne peut pas voir. `_version`
    // est le marqueur d'une notification acceptée. Une implémentation `Object.is` resterait à 0
    // sur les deux écritures `NaN` et échouerait ici.
    "notifie-sur-stricte-identite": async ({ signal: moteur }) => {
      const nan = moteur(1)
      assert.equal(nan._version, 0)
      nan.value = NaN
      assert.equal(nan._version, 1, "1 -> NaN est une écriture acceptée")
      nan.value = NaN
      assert.equal(nan._version, 2, "NaN -> NaN est AUSSI acceptée : c'est tout le contrat")

      const identique = moteur(1)
      identique.value = 1
      assert.equal(identique._version, 0, "une écriture identique ne notifie pas")

      const objet = {}
      const parReference = moteur(objet)
      parReference.value = objet
      assert.equal(parReference._version, 0, "la même référence ne notifie pas")
      parReference.value = {}
      assert.equal(parReference._version, 1, "un objet de même forme notifie : identité, pas structure")

      const vide = moteur(undefined)
      vide.value = undefined
      assert.equal(vide._version, 0, "undefined -> undefined ne notifie pas")
    },

    // DIVERGENCE ASSUMÉE, déjà arbitrée par ADR-0004 et SPEC §21 : la baseline écrit son prototype
    // à la main, donc ses méthodes y sont énumérables et `for..in` les fait remonter. Une classe
    // ES2020 ne le fait pas. Le prix est ici, et il est bon : une énumération d'API qui change
    // selon le minificateur n'est pas une énumération d'API.
    "descripteurs-de-prototype": async ({ signal: moteur, Signal, Effect: ClasseEffet }) => {
      for (const proto of [Signal.prototype, ClasseEffet.prototype]) {
        for (const nom of ["peek", "toString", "toJSON", "valueOf", "dispose"]) {
          const d = Object.getOwnPropertyDescriptor(proto, nom)
          if (d === undefined) continue
          assert.equal(d.enumerable, false, `${nom} ne doit pas être énumérable`)
        }
      }

      // `brand` est sur le prototype et non énumérable — la divergence ci-dessus. Il reste
      // inscriptible et configurable comme la baseline, sur `conv#12` : s'écarter de la
      // compatibilité ici coûterait un ADR de plus pour protéger d'un accident.
      const marque = Object.getOwnPropertyDescriptor(Signal.prototype, "brand")
      assert.ok(marque, "brand doit etre sur le prototype")
      assert.equal(marque.value, Symbol.for("preact-signals"))
      assert.equal(marque.enumerable, false, "sinon for..in le remonterait sur chaque signal")
      assert.equal(marque.writable, true, "la baseline l'inscrit : conv#12")
      assert.equal(marque.configurable, true, "la baseline le rend configurable : conv#12")

      // Et le `for..in` d'un signal ne remonte que ses propres clés, rien du prototype.
      for (const nom in moteur(1)) {
        assert.ok(!(nom in Signal.prototype), `${nom} ne doit pas traverser le for..in`)
      }
    },

    // `computed#10` — l'ordre des dépendances est l'ordre de lecture, et la liste se parcourt
    // depuis la source lue EN DERNIER. `docs/architecture.md` §3 le dit de la même façon, et le
    // sens n'est pas indifférent : partir de la plus récemment utilisée, c'est ce qui autorise à
    // sortir dès qu'une version diffère.
    //
    // La baseline range sa liste à l'envers — sa tête est la source lue en PREMIER. C'est mesuré,
    // et c'est une différence d'implémentation interne, pas de comportement : la liste est à sens
    // unique et rien d'observable par la surface publique n'en dépend. Le nôtre suit le document,
    // parce qu'un seul sens de parcours rend le balayage non ambigu.
    "ordre-des-sources": async ({ signal: moteur, computed }) => {
      const premier = moteur(1)
      const second = moteur(2)
      const troisieme = moteur(3)
      const c = computed(() => premier.value * 100 + second.value * 10 + troisieme.value)
      c.value

      const lus: unknown[] = []
      for (let n = auRuntime(c)._sources; n !== undefined; n = n._prev) lus.push(n._source)
      // `assert.equal` et non `deepEqual` : deux objets se comparent ici par RÉFÉRENCE, et c'est
      // l'identité qu'on vérifie. Un `deepEqual` traverserait le graphe entier — circulaire — et
      // comparerait des nœuds, ce qui n'est pas du tout la même question.
      assert.equal(lus.length, 3)
      assert.equal(lus[0], troisieme, "_sources est la source lue en dernier")
      assert.equal(lus[1], second)
      assert.equal(lus[2], premier)

      c.value
      c.value
      const apres: unknown[] = []
      for (let n = auRuntime(c)._sources; n !== undefined; n = n._prev) apres.push(n._source)
      assert.equal(apres.length, 3, "trois lectures de plus ne perdent aucune dépendance")

      // Une dépendance quittée est retirée, même AU MILIEU de la liste.
      const bascule = moteur(true)
      const gauche = moteur("g")
      const milieu = moteur("m")
      const droite = moteur("d")
      const dyn = computed(() => (bascule.value ? milieu.value : `${gauche.value}${droite.value}`))
      dyn.value

      // Le nœud de `milieu` est capturé PENDANT qu'il est dans la liste. Après l'abandon il n'y
      // est plus — c'est tout l'intérêt de la réconciliation — donc le chercher après ne
      // reviendrait pas, et la comparaison n'aurait rien à comparer.
      const nœudMilieuAvant = (() => {
        for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._prev) {
          if (n._source === milieu) return n
        }
        return undefined
      })()
      assert.ok(nœudMilieuAvant, "sanity : `milieu` a un nœud tant qu'elle est lue")

      bascule.value = false
      dyn.value
      const restants: unknown[] = []
      for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._prev) restants.push(n._source)
      assert.equal(restants.length, 3, "`milieu`, lue en second, est retirée")
      assert.equal(restants[0], droite)
      assert.equal(restants[1], gauche)
      assert.equal(restants[2], bascule)
      assert.equal(restants.includes(milieu), false, "et elle a disparu de la liste")

      // Le NŒUD est RÉACTIVÉ, pas réalloué. C'est SPEC §7, et c'est la seule façon de le voir :
      // la VALEUR serait juste même avec une réallocation, donc la valeur ne prouve rien.
      const noeudMilieuApres = (() => {
        for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._prev) {
          if (n._source === milieu) return n
        }
        return undefined
      })()
      assert.equal(noeudMilieuApres, undefined, "après abandon, `milieu` n'a plus de nœud dans la liste")

      bascule.value = true
      dyn.value
      const milieuReactive: unknown[] = []
      for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._prev) milieuReactive.push(n._source)
      assert.equal(milieuReactive.length, 2, "`milieu` redevient une dépendance")
      assert.equal(milieuReactive.includes(milieu), true, "`milieu` est de nouveau dans la liste")
      // Le nœud RÉACTIVÉ est le MÊME objet.
      const nœudMilieuReactive = (() => {
        for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._prev) {
          if (n._source === milieu) return n
        }
        return undefined
      })()
      assert.equal(nœudMilieuReactive, nœudMilieuAvant, "le nœud est RÉACTIVÉ, pas réalloué")

      // Et la liste ne grossit pas : trois allers-retours ne laissent aucun nœud derrière.
      for (let i = 0; i < 3; i++) {
        bascule.value = !bascule.value
        dyn.value
      }
      const finale: unknown[] = []
      for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._prev) finale.push(n._source)
      assert.equal(finale.length, 3, "aucune fuite de nœud après six évaluations")
      assert.equal(finale.includes(bascule), true, "`bascule` est lue à chaque calcul, elle reste")
    },

    // SPEC §6.1 — douze propriétés-own pour un computé, dans l'ordre : les huit du signal puis
    // `_fn`, `_sources`, `_globalVersion`, `_flags`. Et `for..in` ne remonte rien du prototype.
    //
    // DIVERGENCE ASSUMÉE, arbitrée par ADR-0004 et SPEC §21 : la baseline construit
    // `Computed.prototype` comme une INSTANCE de signal, donc un prototype partagé, mutable et
    // vivant. Lire `.value` dessus condamne le prototype pour tous les computeds du même realm. Nous
    // ne le faisons pas, et `constructor` vaut `Computed` et non `Signal`.
    "structure-de-classe": async ({ signal: moteur, computed, Signal, Computed, Effect: ClasseEffet }) => {
      const c = computed(() => 1)
      assert.deepEqual(Object.keys(c), [
        "_value",
        "_version",
        "_node",
        "_targets",
        "_batchSnapshotVersion",
        "_watched",
        "_unwatched",
        "name",
        "_fn",
        "_sources",
        "_globalVersion",
        "_flags",
      ])

      assert.equal(c instanceof Signal, true)
      assert.equal(c instanceof Computed, true)
      assert.equal(c.constructor, Computed, "et non Signal : le prototype ne porte pas d'état")

      // Le prototype ne porte AUCUNE donnée d'instance. C'est le défaut qu'on supprime.
      const proto = Object.getPrototypeOf(c) as Record<string, unknown>
      assert.equal(proto._value, undefined, "le prototype ne doit porter aucune valeur")
      assert.equal(proto._fn, undefined, "le prototype ne doit porter aucune dérivation")

      // `for..in` expose les douze, et rien du prototype.
      const enumerables: string[] = []
      for (const nom in c) enumerables.push(nom)
      assert.deepEqual(enumerables, Object.keys(c), "for..in ne doit rien ajouter du prototype")

      // L'effet a six propriétés-own, et le prototype n'en porte aucune.
      const e = new ClasseEffet(() => 1)
      assert.deepEqual(Object.keys(e), ["_fn", "_cleanup", "_sources", "_nextBatchedEffect", "_flags", "name"])
      const protoEffet = Object.getPrototypeOf(e) as Record<string, unknown>
      assert.equal(protoEffet._fn, undefined, "le prototype d'effet ne porte rien")
    },

    // `effect#34` — un effet créé dans un COMPUTÉ fuit : il en est créé un nouveau à chaque
    // évaluation. C'est un quirk FIGÉ de la baseline, pas un oubli de notre implémentation : un
    // computé est paresseux et sans destructeur, donc l'effet qu'il fabrique n'a personne pour le
    // ramasser. On fige le comportement, on ne le corrige pas.
    "effet-dans-un-calcule": async ({ signal: moteur, computed, effect: effet }) => {
      const a = moteur(0)
      const journal: string[] = []
      const fabrique = computed(() => {
        journal.push(`outer:${a.value}`)
        effet(() => {
          journal.push(`inner:${a.value}`)
        })
        return a.value
      })

      assert.equal(journal.length, 0, "rien avant la première lecture : le computé est paresseux")
      assert.equal(fabrique.value, 0)
      a.value = 1
      assert.equal(fabrique.value, 1)
      a.value = 2
      assert.equal(fabrique.value, 2)

      // Trois évaluations, donc trois effets intérieurs créés, et le journal compte six runs : c'est la
      // fuite, figée. Le compte est vérifié contre la baseline, qui donne exactement le même.
      assert.equal(journal.filter(e => e.startsWith("outer:")).length, 3, "trois évaluations")
      assert.equal(journal.filter(e => e.startsWith("inner:")).length, 6, "et six runs d'effets")
    },

    // `effect#36` — `options.name` est visible sur l'INSTANCE, et pas via la valeur de retour :
    // le retour est une fonction liée, dont le nom est `bound `. C'est ce qui rend l'instance
    // exportée indispensable.
    "options-de-linstance": async ({ Effect: ClasseEffet }) => {
      const e = new ClasseEffet(() => 1, { name: "n" })
      assert.equal(e.name, "n")
      e.name = "z"
      assert.equal(e.name, "z", "et le nom est mutable après coup")

      const sansNom = new ClasseEffet(() => 1)
      assert.equal(sansNom.name, undefined, "absent, c'est `undefined`")
      assert.equal("name" in sansNom, true, "mais la clé est toujours là")
    },

    // `effect#37` — les drapeaux initiaux. Un effet naît DÉJÀ observed, donc il ouvre les
    // abonnements de ses sources ; un computé naît en train de collecter, mais pas observed.
    "drapeaux-initiaux": async ({ signal: moteur, computed, Effect: ClasseEffet }) => {
      const TRACKING = 32
      const OUTDATED = 4
      const e = new ClasseEffet(() => moteur(0).value)
      assert.equal(e._flags, TRACKING, "un effet est observed dès la construction")
      assert.equal((e._flags & OUTDATED) !== 0, false, "et pas encore périmé")

      const c = auRuntime(computed(() => 1)) as { _flags: number }
      assert.equal(c._flags, OUTDATED, "un computé naît en collectant")
      assert.equal((c._flags & TRACKING) !== 0, false, "mais pas observed")
    },

    // `effect#40` — `Out-of-order effect` n'est atteignable qu'en refermant deux fois : le
    // collecteur de dépendances appartient à un effet à la fois.
    "hors-ordre": async ({ signal: moteur, effect: effet }) => {
      const s = moteur(0)
      let first = true
      const d = effet(function (this: { _start: () => () => void; _callback: () => void }) {
        if (!first) {
          // Refermer le PREMIER effet alors que le second est sur la pile : c'est le désordre.
          const finir = auRuntime(this)._start()
          assert.throws(() => finir(), /Out-of-order effect/)
          return
        }
        first = false
        effet(() => s.value)
      })
      d()
    },

    // `dispose#5` — un realm où `Symbol.dispose` est ABSENT fait de la clé la chaîne
    // `"undefined"` chez la baseline, et c'est un quasi-leak : `using` devient un no-op qui fuit
    // tous les effets. Le cas POSITIF n'est pas mesurable ici — il faudrait éteindre le symbole
    // dans le realm — donc on ne fige que ce qui l'empêche.
    "symbol-dispose-absent": async ({ effect: effet }) => {
      const d = effet(() => {})
      assert.equal(
        Object.prototype.hasOwnProperty.call(d, "undefined"),
        false,
        "aucune clé `\"undefined\"` n'est posée sur le dispositeur",
      )
    },

    // Les deux exigences de SPEC §8.2, côte à côte, parce qu'elles semblaient s'exclure.
    // Elles ne s'excluent pas : V8 refuse une fonction *liée* dont `Symbol.dispose` pointe sur
    // elle-même, et accepte une fonction simple. Le `bind` de la baseline était le seul
    // obstacle — un effet, et non une divergence.
    "symbol-dispose-et-using": async ({ effect: effet }) => {
      const journal: string[] = []
      const d = effet(() => {
        journal.push("run")
        return () => journal.push("cleanup")
      })

      assert.equal(Symbol.dispose in (d as unknown as object), true, "Symbol.dispose doit être présent")
      assert.equal(
        typeof (d as unknown as Record<symbol, unknown>)[Symbol.dispose],
        "function",
        "et DOIT être une fonction, sinon `using` échoue",
      )
// Et l'IDENTITÉ : `d[Symbol.dispose] === d`, comme l'exige SPEC §8.2. Elle ne coûte pas
        // `using`, parce que V8 ne refuse que les fonctions *liées* dont la méthode pointe sur
        // elles-mêmes — une fonction simple passe. C'est ce que le test ci-dessous mesure.
        assert.equal(
          (d as unknown as Record<symbol, unknown>)[Symbol.dispose],
          d,
          "SPEC §8.2 exige que la méthode de libération soit le dispositeur lui-même",
        )

      const portee = () => {
        using _ = d as unknown as { [Symbol.dispose](): void }
        journal.push("corps")
      }
      portee()
      assert.deepEqual(journal, ["run", "corps", "cleanup"])
    },

    // SPEC §14 — un signal gelé lève en écriture. Le mode strict du module de test le fait.
    "signal-gele": async ({ signal: moteur }) => {
      const s = auRuntime(Object.freeze(moteur(1)))
      assert.throws(() => {
        s.value = 2
      }, TypeError)
    },
  }

  for (const [nom, corps] of Object.entries(testsSignalcnSeul)) {
    test(`signalcn-seul/${nom}`, async () => {
      await corps(await moteurDe())
    })
  }

  // ---- Le registre est complet ------------------------------------------------------
  test("registre-complet", () => {
    const manquantes = ENTREES_ATTENDUES.filter(id => !(id in COUVERTURE))
    assert.deepEqual(manquantes, [], `entrées de matrice sans aucune destination : ${manquantes.join(", ")}`)

    const surnumeraires = Object.keys(COUVERTURE).filter(id => !ENTREES_ATTENDUES.includes(id))
    assert.deepEqual(surnumeraires, [], `entrées de couverture qui n'existent pas : ${surnumeraires.join(", ")}`)

    // Chaque destination nommée doit exister. Les noms viennent de deux côtés : les scénarios d'une
    // part, les clés de l'objet de tests d'autre part — donc aucune liste séparée qui pourrait
    // outliver ce qu'elle désigne.
    const noms = new Set([
      ...scenarios.map(s => s.name),
      ...Object.keys(testsSignalcnSeul).map(nom => `signalcn-seul/${nom}`),
    ])
    const tickets = new Set<string>(Object.values(TICHETS))

    for (const [id, destination] of Object.entries(COUVERTURE)) {
      for (const morceau of destination.split("+").map(d => d.trim())) {
        assert.ok(
          tickets.has(morceau) || noms.has(morceau),
          `${id} cite "${morceau}", qui n'est ni un test ni un ticket propriétaire connu`,
        )
      }
    }

    // Et le champ `matrice` de chaque scénario est bien ce que le registre lui attribue. La
    // déduction le garantit, donc un écart ici serait un bug : on le vérifie quand même, parce
    // qu'une déduction peut être cassée sans que rien ne le signale.
    for (const scenario of scenarios) {
      assert.deepEqual(
        scenario.matrice,
        entreesCouvertesPar(scenario.name),
        `${scenario.name} a un champ matrice désynchronisé du registre`,
      )
    }
  })
}
