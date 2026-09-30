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
 * un contrat de signalcn — `_value`, `_version`, et non les noms de la référence. La référence
 * publiée, elle, minifie les siens : `Object.keys(signal(1))` y vaut
 * `["v","i","n","t","l","W","Z","name"]`. Un scénario qui affirme nos noms échouerait donc
 * contre la baseline par construction, et un scénario qui affirme les siens échouerait contre
 * nous. La table ne peut pas dire la structure ; les tests signalcn-seuls le font. Voir #33.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
/**
 * Les tests signalcn-seuls observent des comportements que le TYPAGE interdit : un appel sans
 * `new`, une écriture sur un signal gelé, la présence d'un membre qui n'existe pas, une
 * conversion arithmétique d'un objet. Ce sont des comportements RUNTIME, figés par la matrice —
 * et la référence a exactement les mêmes refus de typage. Les affranchir tous par le même point
 * de sortie, c'est que le motif soit visible en un endroit au lieu d'être cinq `as` dispersés.
 */
const auRuntime = (valeur) => valeur;
export function makeLog() {
    const entries = [];
    const log = (...parts) => {
        entries.push(parts.map(p => String(p)).join(" "));
    };
    log.entries = entries;
    return log;
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
};
export const scenarios = [
    {
        // SPEC §5.1, §5.3 — l'instance, la classe exportée, et le `new` qui n'est pas requis.
        // `Signal(5)` sans `new` lève : le constructeur travaille sur `this`, et sans `new` il n'y
        // a pas de `this`. Le message d'erreur n'est pas figé, et c'est délibéré — il vient du
        // moteur, pas de nous. On n'affirme que le type.
        name: "signal/instance-et-classe",
        matrice: ["signal#1", "signal#18", "signal#19", "signal#20"],
        run(api, log) {
            const s = api.signal(1);
            log("valeur", String(s.value));
            log("instanceof", String(s instanceof api.Signal));
            log("proto partage", String(Object.getPrototypeOf(s) === api.Signal.prototype));
            const construit = new api.Signal(5);
            construit.value = 2;
            log("new Signal(5) puis .value = 2", String(construit.value));
            // DÉTACHÉ, et c'est tout le scénario. `api.Signal(5)` serait un appel de MÉTHODE : `this`
            // vaudrait l'objet `api`, l'écriture réussirait, et rien ne lèverait. Il faut doncsortir la
            // fonction de l'objet avant de l'appeler, pour retrouver un `this` indéfini. Le harnais a
            //.attrapé ça : la baseline ne levait pas, et elle avait raison de ne pas lever.
            const Constructeur = auRuntime(api.Signal);
            let sansNew;
            try {
                Constructeur(5);
                sansNew = "aucune erreur";
            }
            catch (erreur) {
                sansNew = erreur instanceof Error ? erreur.constructor.name : "autre";
            }
            log("Signal(5) sans new leve", sansNew);
            assert.deepEqual(log.entries, [
                "valeur 1",
                "instanceof true",
                "proto partage true",
                "new Signal(5) puis .value = 2 2",
                "Signal(5) sans new leve TypeError",
            ]);
        },
    },
    {
        // SPEC §5.1 — `signal()` sans argument équivaut à `signal(undefined)`.
        name: "signal/sans-argument",
        matrice: ["signal#2"],
        run(api, log) {
            log("signal()", String(api.signal().value));
            log("signal(undefined)", String(api.signal(undefined).value));
            assert.deepEqual(log.entries, ["signal() undefined", "signal(undefined) undefined"]);
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
            const s = api.signal(NaN);
            s.value = NaN;
            log("valeur", String(s.value));
            assert.deepEqual(log.entries, ["valeur NaN"]);
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
            const versMoinsZero = api.signal(0);
            versMoinsZero.value = -0;
            log("0 vers -0 : la valeur reste 0", versMoinsZero.value === 0 && !Object.is(versMoinsZero.value, -0));
            const versZero = api.signal(-0);
            versZero.value = 0;
            log("-0 vers 0 : la valeur reste -0", Object.is(versZero.value, -0));
            assert.deepEqual(log.entries, [
                "0 vers -0 : la valeur reste 0 true",
                "-0 vers 0 : la valeur reste -0 true",
            ]);
        },
    },
    {
        // SPEC §5.2 — l'identité, pas la structure. La valeur relue est l'objet écrit, pas une
        // copie : rien ne clones. Le reste — « notifie », « la même référence n'a pas notifié » —
        // se constate sur `_version`, et c'est un test signalcn-seul.
        name: "signal/egalite-stricte-objet",
        matrice: ["signal#9", "signal#10", "signal#11"],
        run(api, log) {
            const premier = { forme: 1 };
            const s = api.signal(premier);
            log("la valeur relue est la reference ecrite", String(s.value === premier));
            s.value = { forme: 1 };
            log("un objet de meme forme est accepte", String(s.value.forme === 1));
            const vide = api.signal(undefined);
            vide.value = undefined;
            log("undefined vers undefined, valeur", String(vide.value));
            assert.deepEqual(log.entries, [
                "la valeur relue est la reference ecrite true",
                "un objet de meme forme est accepte true",
                "undefined vers undefined, valeur undefined",
            ]);
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
            const s = api.signal(1);
            log("peek() vaut value", String(s.peek() === s.value));
            s.value = 2;
            log("peek() apres ecriture", String(s.peek()));
            assert.deepEqual(log.entries, ["peek() vaut value true", "peek() apres ecriture 2"]);
        },
    },
    {
        // SPEC §4.2 — `name` est un champ public, mutable apres coup, toujours present dans
        // l'enumeration des cles d'instance, `undefined` s'il est absent, et `""` conserve.
        name: "signal/options-name",
        matrice: ["signal#16"],
        run(api, log) {
            log("avec nom", String(api.signal(1, { name: "n" }).name));
            log("sans nom", String(api.signal(1).name));
            log("chaine vide conservee", JSON.stringify(api.signal(1, { name: "" }).name));
            const s = api.signal(1);
            s.name = "z";
            log("ecrit apres coup", String(s.name));
            log("la cle reste presente", String("name" in s));
            assert.deepEqual(log.entries, [
                "avec nom n",
                "sans nom undefined",
                "chaine vide conservee \"\"",
                "ecrit apres coup z",
                "la cle reste presente true",
            ]);
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
            const s = api.signal(1);
            log("typeof brand", typeof s.brand);
            log("la marque", String(s.brand));
            log("marque partagee avec le prototype", String(s.brand === api.Signal.prototype.brand));
            log("brand in s", String("brand" in s));
            log("brand parmi les proprietes-own", String(Object.getOwnPropertyNames(s).includes("brand")));
            log("typeof dispose", typeof auRuntime(s).dispose);
            assert.deepEqual(log.entries, [
                "typeof brand symbol",
                "la marque Symbol(preact-signals)",
                "marque partagee avec le prototype true",
                "brand in s true",
                "brand parmi les proprietes-own false",
                "typeof dispose undefined",
            ]);
        },
    },
    {
        // SPEC §5.1 — `toString()` vaut `this.value + ""` et `valueOf()` vaut `this.value`.
        // Les deux SUIVENT la dependance : ils passent donc par l'accesseur, pas par `_value`.
        // On ne peut pas encore le constater sans effet (#24) ; ce qui est constant, on le fige.
        name: "conversions/to-string-et-value-of",
        matrice: ["conv#1", "conv#5"],
        run(api, log) {
            log("toString(42)", api.signal(42).toString());
            log("toString(10n)", api.signal(10n).toString());
            log("toString(null)", api.signal(null).toString());
            const sept = auRuntime(api.signal(7));
            log("valueOf : sept * 2", String(sept * 2));
            log("valueOf : sept + ''", sept + "");
            assert.deepEqual(log.entries, [
                "toString(42) 42",
                "toString(10n) 10",
                "toString(null) null",
                "valueOf : sept * 2 14",
                "valueOf : sept + '' 7",
            ]);
        },
    },
    {
        // SPEC §5.1 — la conversion en chaine leve sur un `Symbol`. Le moteur fait le travail :
        // `symbole + ""` leve. Aucun `try` dans `toString`, et c'est voulu.
        name: "conversions/to-string-throw-sur-symbol",
        matrice: ["conv#2"],
        run(api, log) {
            let type = "aucune erreur";
            try {
                api.signal(Symbol("x")).toString();
            }
            catch (erreur) {
                type = erreur instanceof Error ? erreur.constructor.name : "autre";
            }
            log("toString sur un symbole leve", type);
            assert.deepEqual(log.entries, ["toString sur un symbole leve TypeError"]);
        },
    },
    {
        // SPEC §5.1 — il n'existe PAS de `Symbol.toPrimitive`. Sans lui, `+` passe par
        // `valueOf` puis `toString`, ce qui est le comportement fige.
        name: "conversions/pas-de-symbol-to-primitive",
        matrice: ["conv#3"],
        run(api, log) {
            log("s[Symbol.toPrimitive]", String(auRuntime(api.signal(1))[Symbol.toPrimitive]));
            assert.deepEqual(log.entries, ["s[Symbol.toPrimitive] undefined"]);
        },
    },
    {
        // SPEC §5.1 — `toJSON()` vaut `this.value`, donc `JSON.stringify` plonge dans le signal.
        name: "conversions/to-json-et-stringify",
        matrice: ["conv#7", "conv#14"],
        run(api, log) {
            log("toJSON d'un objet", JSON.stringify(api.signal({ a: 1 }).toJSON()));
            log("JSON.stringify({s: signal(5)})", JSON.stringify({ s: api.signal(5) }));
            log("JSON.stringify imbrique", JSON.stringify({ a: [api.signal(1), { b: api.signal(2) }] }));
            assert.deepEqual(log.entries, [
                'toJSON d\'un objet {"a":1}',
                'JSON.stringify({s: signal(5)}) {"s":5}',
                'JSON.stringify imbrique {"a":[1,{"b":2}]}',
            ]);
        },
    },
];
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
export const COUVERTURE = {
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
};
/** Les 23 entrées du groupe `signal` et les 15 du groupe conversions. */
export const ENTREES_ATTENDUES = [
    ...Array.from({ length: 23 }, (_, i) => `signal#${i + 1}`),
    ...Array.from({ length: 15 }, (_, i) => `conv#${i + 1}`),
];
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
function entreesCouvertesPar(nomScenario) {
    return Object.entries(COUVERTURE)
        .filter(([, destination]) => destination.split("+").map(d => d.trim()).includes(nomScenario))
        .map(([id]) => id)
        .sort();
}
for (const scenario of scenarios) {
    scenario.matrice = entreesCouvertesPar(scenario.name);
}
if (process.env.NODE_TEST_CONTEXT) {
    const runtime = import("./signals.js");
    // L'unique façon d'obtenir le moteur, et elle est volontairement une FONCTION.
    //
    // Un `await` au niveau du bloc serait du niveau ES2022, alors que la cible est ES2020. Le
    // piège est que `node --test` sur la SOURCE accepte l'`await` de premier niveau — le
    // type-stripping de Node le supporte — et qu'esbuild le refuse seulement à la minification.
    // Résultat : la suite source verte, l'artefact cassé, et le décalage découvert au moment du
    // build. C'est arrivé deux fois dans cette tranche. Ici la forme rend l'erreur impossible.
    const moteurDe = async () => await runtime;
    for (const { name, run } of scenarios) {
        test(name, async () => {
            const { signal: s, Signal } = await runtime;
            run({ signal: s, Signal }, makeLog());
        });
    }
    // ---- Les tests signalcn-seuls, en une seule source --------------------------------
    // Cet objet alimente `node:test` ET le contrôle du registre. Avant, les noms vivaient dans
    // une liste à côté : on pouvait y ajouter un nom, le citer dans le registre, et le registre
    // passer sans qu'aucun test n'existe derrière. Un contrôle à sens unique n'est pas un
    // contrôle.
    //
    // Ils sont ici, et pas dans un fichier séparé, pour ne pas ajouter un troisième fichier à un
    // couple dont la composition est figée.
    const testsSignalcnSeul = {
        // C'est ICI que se joue la moitié de SPEC §5.2 que la table ne peut pas voir. `_version`
        // est le marqueur d'une notification acceptée. Une implémentation `Object.is` resterait à 0
        // sur les deux écritures `NaN` et échouerait ici.
        "notifie-sur-stricte-identite": async ({ signal: moteur }) => {
            const nan = moteur(1);
            assert.equal(nan._version, 0);
            nan.value = NaN;
            assert.equal(nan._version, 1, "1 -> NaN est une écriture acceptée");
            nan.value = NaN;
            assert.equal(nan._version, 2, "NaN -> NaN est AUSSI acceptée : c'est tout le contrat");
            const identique = moteur(1);
            identique.value = 1;
            assert.equal(identique._version, 0, "une écriture identique ne notifie pas");
            const objet = {};
            const parReference = moteur(objet);
            parReference.value = objet;
            assert.equal(parReference._version, 0, "la même référence ne notifie pas");
            parReference.value = {};
            assert.equal(parReference._version, 1, "un objet de même forme notifie : identité, pas structure");
            const vide = moteur(undefined);
            vide.value = undefined;
            assert.equal(vide._version, 0, "undefined -> undefined ne notifie pas");
        },
        // SPEC §5.3 — l'ordre des propriétés-own est contractuel, donc observable, donc figé.
        "structure-de-classe": async ({ signal: moteur }) => {
            assert.deepEqual(Object.keys(moteur(1)), [
                "_value",
                "_version",
                "_node",
                "_targets",
                "_batchSnapshotVersion",
                "_watched",
                "_unwatched",
                "name",
            ]);
            // Un Signal n'a pas de `_flags` : ce n'est pas un effet. Ni sur l'instance, ni hérité.
            assert.equal("_flags" in moteur(1), false);
            assert.equal(auRuntime(moteur(1))._flags, undefined);
            // `name` est toujours présent comme clé, même absent comme valeur — la matrice l'a figé.
            assert.equal("name" in moteur(1), true);
            assert.equal(moteur(1).name, undefined);
            // `value` est un accesseur de prototype, donc non énumérable. S'il était énumérable, il
            // apparaîtrait dans `Object.keys` ci-dessus et le contrat des huit propriétés serait faux.
            const descripteur = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(moteur(1)), "value");
            assert.ok(descripteur, "value doit etre un descripteur de prototype");
            assert.equal(descripteur.enumerable, false);
            assert.equal(typeof descripteur.get, "function");
            assert.equal(typeof descripteur.set, "function");
        },
        // DIVERGENCE ASSUMÉE, déjà arbitrée par ADR-0004 et SPEC §21 : la baseline écrit son
        // prototype à la main, donc ses méthodes y sont énumérables et `for..in` les fait remonter.
        // Une classe ES2020 ne le fait pas. Le prix est ici, et il est bon : une énumération d'API
        // qui change selon le minificateur n'est pas une énumération d'API.
        "descripteurs-de-prototype": async ({ signal: moteur, Signal }) => {
            const proto = Signal.prototype;
            for (const nom of ["peek", "toString", "toJSON", "valueOf"]) {
                const d = Object.getOwnPropertyDescriptor(proto, nom);
                assert.ok(d, `${nom} doit exister sur le prototype`);
                assert.equal(d.enumerable, false, `${nom} ne doit pas être énumérable`);
                assert.equal(d.writable, true, `${nom} doit rester inscriptible`);
                assert.equal(d.configurable, true, `${nom} doit rester configurable`);
            }
            // `brand` est sur le prototype et non énumérable — la divergence ci-dessus. Il reste
            // inscriptible et configurable comme la baseline, sur `conv#12` : s'écarter de la
            // compatibilité ici coûterait un ADR de plus pour protéger d'un accident.
            const marque = Object.getOwnPropertyDescriptor(proto, "brand");
            assert.ok(marque, "brand doit etre sur le prototype");
            assert.equal(marque.value, Symbol.for("preact-signals"));
            assert.equal(marque.enumerable, false, "sinon for..in le remonterait sur chaque signal");
            assert.equal(marque.writable, true, "la baseline l'inscrit : conv#12");
            assert.equal(marque.configurable, true, "la baseline le rend configurable : conv#12");
            // Et le `for..in` d'un signal ne remonte que ses propres clés, rien du prototype.
            for (const nom in moteur(1)) {
                assert.ok(!(nom in Signal.prototype), `${nom} ne doit pas traverser le for..in`);
            }
        },
        // SPEC §14 — un signal gelé lève en écriture. Le mode strict du module de test le fait.
        "signal-gele": async ({ signal: moteur }) => {
            const s = auRuntime(Object.freeze(moteur(1)));
            assert.throws(() => {
                s.value = 2;
            }, TypeError);
        },
    };
    for (const [nom, corps] of Object.entries(testsSignalcnSeul)) {
        test(`signalcn-seul/${nom}`, async () => {
            await corps(await moteurDe());
        });
    }
    // ---- Le registre est complet ------------------------------------------------------
    test("registre-complet", () => {
        const manquantes = ENTREES_ATTENDUES.filter(id => !(id in COUVERTURE));
        assert.deepEqual(manquantes, [], `entrées de matrice sans aucune destination : ${manquantes.join(", ")}`);
        const surnumeraires = Object.keys(COUVERTURE).filter(id => !ENTREES_ATTENDUES.includes(id));
        assert.deepEqual(surnumeraires, [], `entrées de couverture qui n'existent pas : ${surnumeraires.join(", ")}`);
        // Chaque destination nommée doit exister. Les noms viennent de deux côtés : les scénarios
        // d'une part, les clés de l'objet de tests d'autre part — donc aucune liste Maintenance
        // séparée qui pourrait outliver ce qu'elle désigne.
        const noms = new Set([
            ...scenarios.map(s => s.name),
            ...Object.keys(testsSignalcnSeul).map(nom => `signalcn-seul/${nom}`),
        ]);
        const tickets = new Set(Object.values(TICHETS));
        for (const [id, destination] of Object.entries(COUVERTURE)) {
            for (const morceau of destination.split("+").map(d => d.trim())) {
                assert.ok(tickets.has(morceau) || noms.has(morceau), `${id} cite "${morceau}", qui n'est ni un test ni un ticket propriétaire connu`);
            }
        }
        // Et le champ `matrice` de chaque scénario est bien ce que le registre lui attribue. La
        // déduction le garantit, donc un écart ici serait un bug : on le vérifie quand même, parce
        // qu'une déduction peut être cassée sans que rien ne le signale.
        for (const scenario of scenarios) {
            assert.deepEqual(scenario.matrice, entreesCouvertesPar(scenario.name), `${scenario.name} a un champ matrice désynchronisé du registre`);
        }
    });
}
