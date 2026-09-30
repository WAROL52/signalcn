/**
 * Spécification de la source de vérité du moteur et de sa suite de conformité.
 *
 * Ce fichier porte DEUX choses, et la distinction est ce qui le rend honnête :
 *
 *   - `scenarios`, la table DIFFÉRENTIELLE. Elle est rejouée par le harnais contre la baseline
 *     publiée, et par `node --test` contre nous. Tout ce qu'elle affirme doit donc être vrai
 *     des DEUX côtés. Elle ne peut rien affirmer que la baseline ne fait pas.
 *   - les tests signalcn-seuls, enregistrés sous le même `node:test` mais absents de la table.
 *     Ils couvrent ce qui nous est propre : la structure de classe de SPEC §5.3, et le compteur
 *     `_version` qui est le marqueur observable d'une notification.
 *
 * Les attentes de la table sont transcrites de la colonne « Observé » de la matrice. Le vrai
 * oracle reste la campagne rejouable — voir `SPEC.md` §22.
 *
 * PORTÉE DE CETTE TRANCHE. Les subscribers — computed, effect, subscribe — arrivent plus tard.
 * La règle de notification est implémentée et gardée, mais rien n'a encore le droit de
 * s'abonner : la seule trace observable d'une notification est le compteur `_version`, qui
 * n'est pas une surface publique commune aux deux implémentations. D'où les tests signalcn-seuls
 * en bas de fichier.
 *
 * ET POURQUOI LA STRUCTURE N'EST PAS DANS LA TABLE. SPEC §5.3 rend les huit noms de propriétés
 * un contrat de signalcn — `_value`, `_version`, et non les noms de la référence. La référence
 * publiée, elle, minifie les siens : `Object.keys(signal(1))` y vaut
 * `["v","i","n","t","l","W","Z","name"]`. Un scénario qui affine nos noms échouerait donc
 * contre la baseline par construction, et un scénario qui affirme les siens échouerait contre
 * nous. La table ne peut pas dire la structure ; les tests signalcn-seuls le font.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

// Type seul : efface a la compilation. La surface est INJECTEE dans chaque scenario, c'est ce qui
// permet au harnais de rejouer la meme table contre une autre implementation.
import type { signal } from "./signals.ts"

/** La surface publique injectée dans chaque scénario. */
export type Api = {
  signal: typeof signal
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

export function makeLog(): Log {
  const entries: string[] = []
  const log = (...parts: unknown[]) => {
    entries.push(parts.map(p => String(p)).join(" "))
  }
  log.entries = entries
  return log
}

export const scenarios: Scenario[] = [
    {
      // SPEC §5.2 — le seuil est `!==`. La matrice a observe 2 runs d'effet pour `NaN → NaN`.
      //
      // CE SCÉNARIO NE PROUVE PAS LA NOTIFICATION, et il ne prétend pas. Sans subscriber, le seul
      // compteur d'une notification est `_version`, qui n'a pas le même nom des deux côtés :
      // l'affirmer ici serait une hypothèse, pas une mesure. Une implémentation fondée sur
      // `Object.is` passerait ce scénario. C'est `signalcn-seul/notifie-sur-stricte-identite`, plus
      // bas, qui discrimine les deux — et c'est normal qu'il soit d'un seul côté.
      //
      // Ce que le scénario fixe, et que la forme de la matrice fixe avec lui : partir de `NaN` et
      // réécrire `NaN` laisse `NaN`. La forme est celle de `signal#6`.
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
]

// Le reliquat : sept lignes, et il n'a aucune raison d'exister ailleurs.
//
// Le garde n'est pas cosmetique. Le harnais doit pouvoir lire la table AVANT que le moteur
// existe — c'est tout l'interet d'un oracle : valider d'abord, ecrire ensuite. Si ce fichier
// importait le moteur au niveau superieur, l'oracle serait indisponible tant que le moteur
// manque, et l'ordre rouge-vert n'aurait plus de juge. `NODE_TEST_CONTEXT` est pose par
// `node --test` dans chaque fichier de test, et nowhere ailleurs.
//
// L'import est dynamique et la promesse est creee sans etre attendue. Un `await` de premier
// niveau serait du niveau ES2022, et la cible du projet est ES2020 : il casserait le build
// d'un fichier qui n'a rien d'exotique a part etre distribue.
if (process.env.NODE_TEST_CONTEXT) {
  const runtime = import("./signals.ts")

  for (const { name, run } of scenarios) {
    test(name, async () => {
      const { signal: moteur } = await runtime
      run({ signal: moteur }, makeLog())
    })
  }

  // ---- Tests signalcn-seuls --------------------------------------------------
  // Absents de `scenarios` à dessein : ils ne peuvent pas être rejoués contre la baseline.
  // Ils sont ici, et pas dans un fichier séparé, pour ne pas ajouter un troisième fichier à un
  // couple dont la composition est figée.
  test("signalcn-seul/notifie-sur-stricte-identite", async () => {
    const { signal: moteur } = await runtime

    // C'est ICI que se joue la moitié de SPEC §5.2 que la table ne peut pas voir. `_version`
    // est le marqueur d'une notification acceptée. Une implémentation `Object.is` resterait à 0
    // sur les deux écritures `NaN` et échouerait ici.
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
  })

  test("signalcn-seul/structure-de-classe", async () => {
    const { signal: moteur } = await runtime

    // SPEC §5.3 — l'ordre des propriétés-own est contractuel, donc observable, donc figé.
    assert.deepEqual(Object.keys(moteur(1)), [
      "_value",
      "_version",
      "_node",
      "_targets",
      "_batchSnapshotVersion",
      "_watched",
      "_unwatched",
      "name",
    ])

    // `name` est toujours présent comme clé, même absent comme valeur — la matrice l'a figé.
    assert.equal("name" in moteur(1), true)
    assert.equal(moteur(1).name, undefined)

    // `value` est un accesseur de prototype, donc non énumérable. S'il était énumérable, il
    // apparaîtrait dans `Object.keys` ci-dessus et le contrat des huit propriétés serait faux.
    const descripteur = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(moteur(1)), "value")
    assert.ok(descripteur, "value doit etre un descripteur de prototype")
    assert.equal(descripteur.enumerable, false)
    assert.equal(typeof descripteur.get, "function")
    assert.equal(typeof descripteur.set, "function")
  })
}