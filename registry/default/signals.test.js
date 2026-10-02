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
 * sans destination » VÉRIFIABLE au lieu d'être une promesse. Une destination est soit un nom de
 * test, soit le numéro d'un ticket ENCORE OUVERT — jamais celui d'un ticket clos, qui ne promet
 * plus rien. Voir plus bas.
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
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import assert from "node:assert/strict";
import { test } from "node:test";
/**
 * Le `this` lexical du module. Une flèche le capture — et c'est ce que `effect#10` fige : une
 * fléchée n'obtient PAS l'instance d'effet.
 */
const thisGlobal = globalThis;
/**
 * Les tests signalcn-seuls observent des comportements que le TYPAGE interdit : un appel sans
 * `new`, une écriture sur un signal gelé, la présence d'un membre qui n'existe pas, une
 * conversion arithmétique d'un objet. Ce sont des comportements RUNTIME, figés par la matrice —
 * et la baseline a exactement les mêmes refus de typage. Les affranchir tous par le même point
 * de sortie, c'est que le motif soit visible en un endroit au lieu d'être cinq `as` dispersés.
 */
const auRuntime = (valeur) => valeur;
/**
 * Combien de fois un effet a tourné, après chaque écriture. C'est LE compteur qui existe des deux
 * côtés : `_version` n'a pas le même nom chez la baseline publiée, qui minifie les siens, donc
 * « notifie » ne peut pas se compter autrement.
 *
 * Renvoyer le COMPTE APRÈS chaque écriture, et non le total, est ce qui permet d'affirmer deux
 * choses dans la même assertion : qu'une écriture a notifié, et que la suivante, qui ne change
 * rien, ne l'a pas fait.
 *
 * `lire` est ce que l'effet fait du signal, et ne rien lire est un cas LÉGITIME — c'est
 * `effect#3` — pas une omission de l'appelant.
 */
function compteRuns(api, initiale, lire, ecritures) {
    const jalons = [];
    const s = api.signal(initiale);
    let runs = 0;
    api.effect(() => {
        runs++;
        lire(s);
    });
    jalons.push(runs);
    for (const ecriture of ecritures) {
        s.value = ecriture;
        jalons.push(runs);
    }
    return jalons;
}
export function makeLog() {
    const entries = [];
    const log = (...parts) => {
        entries.push(parts.map((p) => String(p)).join(" "));
    };
    log.entries = entries;
    return log;
}
/**
 * La table des scénarios rejoues contre le paquet installé. Chacun porte un NOM, et c'est ce nom
 * que le registre cite, jamais un numero d'entree : la revue a releve que « l'effet » etait
 * pointe sur #25, qui est `subscribe()` — et un rappel de `subscribe` s'execute en `untracked`,
 * donc il ne peut pas prouver qu'une conversion suit la dependance. Un numero ecrit en clair dans
 * une chaine n'est pas relu.
 *
 * IL Y AVAIT UNE SECONDE FORME de destination : le numéro d'un ticket encore ouvert, avec la liste
 * `TICHETS` qui portait la promesse et `registre-complet` qui la vérifiait. Elle a été retirée —
 * voir la JSDoc de `COUVERTURE` pour la mesure qui l'a tuée. Ce qu'il en reste ici, c'est la
 * leçon, et elle vaut pour toutes les listes de ce fichier : une liste ne peut pas vérifier ce
 * qu'elle affirme, seulement ce qu'elle contient. `COUVERTURE` ne peut donc pas dire « cet
 * observable est conforme » — il dit « voici qui l'atteint », et c'est l'exécution qui tranche.
 */
export const scenarios = [
    {
        // SPEC §5.1, §5.3 — l'instance, la classe exportée, et le `new` qui n'est pas requis.
        // `Signal(5)` sans `new` lève : le constructeur travaille sur `this`, et sans `new` il n'y
        // a pas de `this`. Le message d'erreur n'est pas figé, et c'est délibéré — il vient du
        // moteur, pas de nous. On n'affirme que le type.
        name: "signal/instance-and-class",
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
        name: "signal/no-argument",
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
        // `Object.is` passerait ce scénario. C'est `signalcn-seul/notification-follows-object-is` qui
        // discrimine les deux — et c'est normal qu'il soit d'un seul côté.
        name: "signal/strict-equality-nan",
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
        name: "signal/zero-and-negative-zero",
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
        // copie : rien ne clones.
        //
        // ET LA NOTIFICATION, COMPTE PAR UN EFFET. C'est le seul compteur qui existe des DEUX côtés :
        // `_version` n'a pas le même nom chez la baseline publiée, qui minifie les siens. Ces trois
        // entrées pointaient sur le ticket #24, clos, et n'étaient donc couvertes par AUCUN test — un
        // numéro de ticket est accepté comme destination, donc le vide passait pour une couverture.
        name: "signal/strict-equality-object",
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
            // Le compteur de notifications. « Notifie » et « ne notifie pas » ne sont plus des mots. Le
            // helper rend un jalon par écriture — le premier est le run initial. La troisième écriture
            // réécrit `premier`, et ELLE NOTIFIÉ : la valeur courante est l'objet de forme 2, donc
            // `premier` n'est plus la même référence. C'est la chaîne que la matrice relève pour
            // `signal#9` — « 2 runs, puis ré-écriture de l'objet d'origine », et la version passe à 2.
            log("runs : objet de meme forme puis la meme reference", compteRuns(api, premier, (s) => s.value, [{ forme: 2 }, premier]).join(" puis "));
            log("runs : 0 vers undefined puis undefined vers undefined", compteRuns(api, 0, (s) => s.value, [undefined, undefined]).join(" puis "));
            log("runs : ecriture identique", String(compteRuns(api, 1, (s) => s.value, [1]).join(" puis ")));
            assert.deepEqual(log.entries, [
                "la valeur relue est la reference ecrite true",
                "un objet de meme forme est accepte true",
                "undefined vers undefined, valeur undefined",
                "runs : objet de meme forme puis la meme reference 1 puis 2 puis 3",
                "runs : 0 vers undefined puis undefined vers undefined 1 puis 2 puis 2",
                "runs : ecriture identique 1 puis 1",
            ]);
        },
    },
    {
        // SPEC §5.1, §8.1 — CE QU'UNE ÉCRITURE RÉVEILLE, ET CE QU'ELLE NE RÉVEILLE PAS. Les quatre
        // entrées de ce scénario pointaient sur le ticket #24, clos : rien ne les rejouait. Un effet
        // est le seul observateur qui existe des deux côtés, donc c'est par lui qu'elles se constatent.
        //
        // `signal#5` est la SEULE des quatre qui notifie, et elle le fait AVANT l'instruction suivante :
        // le drain est terminé, pas\Component à faire. Les trois autres disent ce qui ne réveille pas,
        // et sans elles `signal#5` n'affirmerait qu'un flush, pas une frontière.
        name: "signal/synchronous-notification",
        matrice: [],
        run(api, log) {
            const s = api.signal(0);
            const journal = [];
            api.effect(() => {
                journal.push(`e:${s.value}`);
            });
            journal.push("before");
            s.value = 1;
            journal.push("after");
            log("drain termine avant l'instruction suivante", JSON.stringify(journal));
            // `signal#12` : écrire sa propre dépendance ne boucle pas, parce que l'écriture est
            // identique et que l'identité stricte la refuse. C'est le seul des quatre que le helper ne
            // couvre pas : l'effet y ÉCRIT, donc il ne se contente pas de lire.
            let autoRuns = 0;
            const auto = api.signal(1);
            api.effect(() => {
                autoRuns++;
                // biome-ignore lint/correctness/noSelfAssign: c'est le SCÉNARIO — écrire une valeur identique doit être refusé par l'identité stricte et ne pas réveiller l'effet (`signal#12`).
                auto.value = auto.value;
            });
            log("runs : auto-ecriture identique", String(autoRuns));
            // `signal#13` : un effet sans dépendance n'a rien à quoi s'abonner. Deux écritures ne le
            // réveillent pas — c'est ce qui rend `effect#3` et `signal#13` le MÊME fait, et c'est
            // pourquoi ils partagent ce scénario.
            log("runs : effet sans dependance, deux ecritures", String(compteRuns(api, 0, () => undefined, [1, 2]).join(" puis ")));
            // `signal#14` : `peek()` est exactement `untracked(() => value)`, donc la lecture ne
            // s'abonne à rien.
            log("runs : lecture par peek, une ecriture", String(compteRuns(api, 1, (s) => s.peek(), [1]).join(" puis ")));
            assert.deepEqual(log.entries, [
                'drain termine avant l\'instruction suivante ["e:0","before","e:1","after"]',
                "runs : auto-ecriture identique 1",
                "runs : effet sans dependance, deux ecritures 1 puis 1 puis 1",
                "runs : lecture par peek, une ecriture 1 puis 1",
            ]);
        },
    },
    {
        // SPEC §5.1 — `peek()` lit la valeur. CE QUE ÇA NE PREND PAS DE PAS, c'est l'absence de
        // dépendance : la matrice l'atteste par un effet qui ne se ré-exécute pas, et c'est
        // `signal/synchronous-notification` qui s'en charge. Le descripteur du prototype diverge —
        // ADR-0004 — et n'est donc pas une propriété commune : il est vérifié côté signalcn seul.
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
                'chaine vide conservee ""',
                "ecrit apres coup z",
                "la cle reste presente true",
            ]);
        },
    },
    {
        // SPEC §5.1 — la marque, et l'absence de `dispose` sur un signal.
        // `brand` est sur le prototype : lisible depuis l'instance, absent des proprietes-own,
        // et traverse par `in`. C'est exactement ce dont la detection de sous-objet d'un modele a
        // besoin. Le descripteur, lui, diverge — voir `signalcn-seul/enumeration-skips-the-prototype`.
        name: "signal/brand-and-no-dispose",
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
        // Ce qui est CONSTANT est figé ici ; le fait que les deux SUIVENT la dépendance est rejoué par
        // `conversions/follow-the-dependency`, parce qu'il demande un observateur.
        name: "conversions/to-string-and-value-of",
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
        name: "conversions/to-string-throw-on-symbol",
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
        name: "conversions/no-symbol-to-primitive",
        matrice: ["conv#3"],
        run(api, log) {
            log("s[Symbol.toPrimitive]", String(auRuntime(api.signal(1))[Symbol.toPrimitive]));
            assert.deepEqual(log.entries, ["s[Symbol.toPrimitive] undefined"]);
        },
    },
    {
        // SPEC §5.1 — `toJSON()` vaut `this.value`, donc `JSON.stringify` plonge dans le signal.
        name: "conversions/to-json-and-stringify",
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
    {
        // SPEC §5.1 — LES QUATRE CONVERSIONS SUIVENT LA DÉPENDANCE : elles passent par l'accesseur
        // `value`, pas par `_value`. Chacune vaut deux runs, ce qui est le fait que la matrice note,
        // et `s + ""` passe par `valueOf` puis `toString` — donc il figure ici aussi, pour la même
        // raison. Ces quatre entrées pointaient sur le ticket #24, clos : rien ne les rejouait.
        //
        // Le `peek()` qui NE suit pas la dépendance est le contre-exemple de ce scénario, et il vit
        // dans `signal/synchronous-notification` : sans lui, « suit la dépendance » ne serait qu'un mot
        // plus assertif que son contraire.
        name: "conversions/follow-the-dependency",
        matrice: [],
        run(api, log) {
            log("toString", String(compteRuns(api, 1, (s) => s.toString(), [2]).join(" puis ")));
            log("valueOf", String(compteRuns(api, 1, (s) => s.valueOf(), [2]).join(" puis ")));
            log("toJSON", String(compteRuns(api, 1, (s) => s.toJSON(), [2]).join(" puis ")));
            log("s + ''", String(compteRuns(api, 1, (s) => s + "", [2]).join(" puis ")));
            assert.deepEqual(log.entries, [
                "toString 1 puis 2",
                "valueOf 1 puis 2",
                "toJSON 1 puis 2",
                "s + '' 1 puis 2",
            ]);
        },
    },
    {
        // SPEC §6, §15.7 — LES CONVERSIONS PROPAGENT L'ERREUR D'UN COMPUTÉ, et aucune ne fait
        // d'`untracked`. C'est la contrepartie de `computed/cached-error` : le moteur stocke
        // l'erreur dans `_value`, et les cinq points de lecture la relancent — `.value`, `peek`,
        // `toString`, `valueOf`, `toJSON` — la relancent telle quelle. Une conversion qui absorberait
        // l'erreur donnerait `undefined`, ou une chaîne, au lieu de lever.
        //
        // `conv#9` pointait sur le ticket #23, clos : le seul scénario qui l'aurait couvert n'a jamais
        // été écrit. Les quatre autres conversions de la série — `toString`, `valueOf`, `toJSON`,
        // `peek` — sont ici avec `.value`, parce que la matrice les relève sur la même ligne.
        name: "computed/conversions-propagate-the-error",
        matrice: [],
        run(api, log) {
            const declencheur = api.signal(false);
            const c = api.computed(() => {
                if (declencheur.value)
                    throw new Error("boom");
                return 10;
            });
            // L'amorçage, et il n'est pas décoratif : sans cette lecture, la DERNIÈRE valeur de `declencheur`
            // n'aurait jamais été évaluée, donc les cinq points de lecture reliraient un cache sain et ne
            // lèveraient rien. C'est ce que la matrice relève — `conv#9`, six lectures qui propagent
            // `boom`. La ligne surprend parce qu'elle ne produit aucune valeur.
            c.value;
            declencheur.value = true;
            // La liste est ÉCRITE, pas construite par nom : un dispatch sur des chaînes pour atteindre des
            // méthodes publiques typées court-circuite le compilateur, et rien ici ne le mérite.
            const pointsDeLecture = [
                ["value", () => c.value],
                ["toString", () => c.toString()],
                ["valueOf", () => c.valueOf()],
                ["toJSON", () => c.toJSON()],
                ["peek", () => c.peek()],
            ];
            for (const [nom, lire] of pointsDeLecture) {
                try {
                    log(nom, `aucune erreur, valeur ${String(lire())}`);
                }
                catch (erreur) {
                    // Le TYPE, jamais le message : SPEC §15.4. Ce que la matrice fige ici, c'est que la
                    // conversion PROPAGE, pas le texte qu'elle transporte.
                    log(nom, erreur instanceof Error ? erreur.constructor.name : "autre");
                }
            }
            assert.deepEqual(log.entries, [
                "value Error",
                "toString Error",
                "valueOf Error",
                "toJSON Error",
                "peek Error",
            ]);
        },
    },
    {
        // SPEC §13.4, §9.3 — LECTURE RE-ENTRÉE DANS UN BATCH : SEUL LE CHEMIN LU EST RECALCULÉ.
        // Le scénario relit le computé au milieu du batch, et le compteur d'évaluations dit qu'il n'a
        // été évalué que DEUX fois : la relecture paresseuse ne relance rien, elle renvoie le cache.
        // C'est ce qui distingue une lecture dans un batch d'une écriture — et c'est aussi ce qui
        // donne à la réconciliation des versions un état pré-batch à comparer.
        //
        // `computed#11` pointait sur le ticket #26, clos. La forme est celle de la colonne « Observé »
        // de la matrice, rejouée telle quelle.
        name: "computed/reentrant-read-in-batch",
        matrice: [],
        run(api, log) {
            const a = api.signal(0);
            const b = api.signal(0);
            let evaluations = 0;
            const c = api.computed(() => {
                evaluations++;
                return `${a.value}/${b.value}`;
            });
            const journal = [];
            api.batch(() => {
                journal.push(c.value);
                a.value = 2;
                b.value = 3;
                c.value;
                journal.push(`mid:${evaluations}`);
                journal.push(c.value);
            });
            log("journal", JSON.stringify(journal));
            assert.deepEqual(log.entries, ['journal ["0/0","mid:2","2/3"]']);
        },
    },
    {
        // SPEC §6 — paresseux, puis mis en cache. Rien ne s'exécute avant la première lecture, et
        // trois lectures consécutives donnent UNE évaluation : c'est le même fait, vu deux fois.
        name: "computed/lazy-and-cache",
        matrice: ["computed#1", "computed#2"],
        run(api, log) {
            let calls = 0;
            const a = api.signal(1);
            const c = api.computed(() => {
                calls++;
                return a.value * 10;
            });
            log("evaluations avant toute lecture", calls);
            log("valeur", String(c.value));
            log("evaluations apres la 1re lecture", calls);
            c.value;
            c.value;
            log("evaluations apres trois lectures", calls);
            assert.deepEqual(log.entries, [
                "evaluations avant toute lecture 0",
                "valeur 10",
                "evaluations apres la 1re lecture 1",
                "evaluations apres trois lectures 1",
            ]);
        },
    },
    {
        // SPEC §6.1 — ÉCRIRE UN SIGNAL DANS UN COMPUTÉ EST AUTORISÉ, et l'effet voit la valeur DÉJÀ
        // écrite. Le computé lit `a`, écrit un Miroir, et rend `a` : au premier run l'effet observe
        // `mirror=0` alors que le Miroir valait -1. C'est le fait figé — l'écriture a lieu pendant
        // l'évaluation, donc avant le run de l'effet qui l'a déclenchée.
        //
        // Cette entrée pointait sur le ticket #24, clos : rien ne la rejouait.
        name: "computed/write-in-a-computed",
        matrice: [],
        run(api, log) {
            const a = api.signal(0);
            const miroir = api.signal(-1);
            const c = api.computed(() => {
                log("eval", String(a.value));
                miroir.value = a.value * 2;
                return a.value;
            });
            const journal = [];
            api.effect(() => {
                const v = c.value;
                journal.push(`e:${v} mirror=${miroir.value}`);
            });
            a.value = 1;
            log("journal", JSON.stringify(journal));
            assert.deepEqual(log.entries, ["eval 0", "eval 1", 'journal ["e:0 mirror=0","e:1 mirror=2"]']);
        },
    },
    {
        // SPEC §15.7 — L'ERREUR D'UN COMPUTÉ PROPAGE À L'EFFET QUI LA LIT, et cet effet est DISPOSÉ
        // à la création : il ne survit pas. Le journal le dit en trois temps — la création lève, un
        // seul run a eu lieu, et l'écriture de la source ne relance rien.
        //
        // L'asymétrie est le point : une erreur au RE-RUN laisse l'effet vivant
        // (`effect/errors`), une erreur lue pendant la PREMIÈRE évaluation l'enterre. C'est
        // `computed#17` qui l'atteste, et c'est ce qui fait de `computed/cached-error` un fait sur
        // la LECTURE et de ce scénario un fait sur l'OBSERVATEUR.
        //
        // Cette entrée pointait sur le ticket #24, clos.
        name: "computed/error-to-effect",
        matrice: [],
        run(api, log) {
            const s = api.signal(1);
            const c = api.computed(() => {
                if (s.value === 1)
                    throw new Error("derived boom2");
                return 1;
            });
            let runs = 0;
            try {
                api.effect(() => {
                    runs++;
                    c.value;
                });
                log("creation", "aucune erreur");
            }
            catch (erreur) {
                // Le TYPE, jamais le message — SPEC §15.4. Ce que `computed#17` fige, c'est que la
                // création PROPAGE et que l'effet meurt, pas le texte transporté.
                log("creation", erreur instanceof Error ? erreur.constructor.name : "autre");
            }
            log("runs", String(runs));
            s.value = 2;
            log("apres ecriture de la source, l'effet a-t-il tourne ?", String(runs));
            log("valeur du compute une fois resolu", String(c.value));
            assert.deepEqual(log.entries, [
                "creation Error",
                "runs 1",
                "apres ecriture de la source, l'effet a-t-il tourne ? 1",
                "valeur du compute une fois resolu 1",
            ]);
        },
    },
    {
        // SPEC §6 — sans abonné, une écriture de source ne réveille rien, et la lecture suivante
        // intègre TOUTES les écritures. Le nombre d'évaluations reste 1 tant qu'on ne lit pas.
        name: "computed/no-subscriber",
        matrice: ["computed#3"],
        run(api, log) {
            let calls = 0;
            const a = api.signal(1);
            const c = api.computed(() => {
                calls++;
                return a.value + 1;
            });
            log("valeur initiale", String(c.value));
            a.value = 2;
            a.value = 3;
            a.value = 4;
            log("evaluations apres trois ecritures, sans lecture", calls);
            log("valeur, qui integre les trois ecritures", String(c.value));
            log("evaluations", calls);
            assert.deepEqual(log.entries, [
                "valeur initiale 2",
                "evaluations apres trois ecritures, sans lecture 1",
                "valeur, qui integre les trois ecritures 5",
                "evaluations 2",
            ]);
        },
    },
    {
        // SPEC §6 — une écriture d'un signal que le computé ne lit PAS ne le fait pas réévaluer. C'est
        // le pendant exact du scénario précédent : là, les écritures portent sur sa source et il DOIT
        // recalculer ; ici, elles ne le concernent pas et il ne doit PAS le faire. Les deux ensemble
        // disent ce que vaut « périmé », et un seul des deux laisserait la moitié de la règle libre.
        //
        // C'est l'entrée 47 de la matrice, « le compteur d'évaluations d'un computed invalidé puis relu
        // dépend de la version globale ». Une voie rapide qui exigeait un abonné passait ici sans
        // rejouer ce compte : elle ne servait jamais de valeur périmée, seulement un recalcul de trop.
        // Aucun test ne le voyait, parce que la plupart des scénarios observent une VALEUR, et qu'ici la
        // valeur est juste des deux côtés — seul le compte change.
        name: "computed/unlinked-write-evaluation",
        matrice: [],
        run(api, log) {
            let calls = 0;
            const a = api.signal(1);
            const sansLien = api.signal(0);
            const c = api.computed(() => {
                calls++;
                return a.value + 1;
            });
            log("1re lecture", `${c.value} evaluations:${calls}`);
            // Deux écritures sur un signal que `c` ne lit pas. Elles font avancer le compteur global,
            // donc elles invalident le cache de TOUS les computeds — et c'est justement ce compteur, trop
            // large, que la voie rapide est censée absorber quand les nœuds sont tous à jour.
            sansLien.value = 1;
            sansLien.value = 2;
            log("apres deux ecritures non liees", `evaluations:${calls}`);
            log("relue", `${c.value} evaluations:${calls}`);
            // Et l'écriture qui, ELLE, compte : le calcul doit repartir.
            a.value = 10;
            log("apres une ecriture liee", `${c.value} evaluations:${calls}`);
            assert.deepEqual(log.entries, [
                "1re lecture 2 evaluations:1",
                "apres deux ecritures non liees evaluations:1",
                "relue 2 evaluations:1",
                "apres une ecriture liee 11 evaluations:2",
            ]);
        },
    },
    {
        // SPEC §6 — invalidation puis recalcul, et `peek()` qui passe par la voie de lecture. Le
        // recalcul n'a lieu qu'à la lecture : c'est ce qui rend le computé paresseux.
        name: "computed/invalidation-and-recompute",
        matrice: ["computed#4", "computed#7"],
        run(api, log) {
            let calls = 0;
            const a = api.signal(1);
            const c = api.computed(() => {
                calls++;
                return a.value * 2;
            });
            log("valeur", String(c.value));
            log("evaluations", calls);
            log("valeur, relue sans ecriture", String(c.value));
            log("evaluations, toujours 1", calls);
            a.value = 2;
            log("evaluations apres ecriture, sans lecture", calls);
            log("valeur", String(c.value));
            log("evaluations", calls);
            assert.deepEqual(log.entries, [
                "valeur 2",
                "evaluations 1",
                "valeur, relue sans ecriture 2",
                "evaluations, toujours 1 1",
                "evaluations apres ecriture, sans lecture 1",
                "valeur 4",
                "evaluations 2",
            ]);
        },
    },
    {
        // SPEC §15.3 — un calcul qui rend la MÊME valeur ne notifie personne, mais le computé reste
        // parfaitement relisible. Les deux moitiés sont une seule garantie : le drapeau `RUNNING` doit
        // être relâché à la SORTIE du calcul, inconditionnellement, pas dans la branche « la valeur a
        // changé ». Relâché dans cette branche seulement, il restait posé après un calcul à valeur
        // identique, et la LECTURE SUIVANTE levait `Cycle detected` — un Cycle sans auto-rentrée, donc
        // exactement ce que le glossaire interdit : un `Cycle` détecté « sans aucun comptage ».
        //
        // Le cas du ticket #38 — un computé nu dont la branche change deux fois — ne le prouve PAS : la
        // valeur y change à chaque bascule, donc la branche inconditionnelle n'a pas lieu. Le
        // déclencheur est la valeur INCHANGÉE, et `a % 2` est le calcul minimal qui la produit. C'est
        // aussi pour ça que le cas est ici, dans un SCÉNARIO, et pas dans le bloc signalcn-seul : seul
        // le harnais rejoue la table des deux côtés, donc seul un scénario reverra cette garantie.
        name: "computed/identical-value-reread",
        matrice: [],
        run(api, log) {
            // `computed#5` et `computed#6`, dans leur forme exacte : le résultat identique ne notifie
            // pas, le résultat symétrique notifie.
            const a = api.signal(2);
            let cCalls = 0;
            let eRuns = 0;
            const c = api.computed(() => {
                cCalls++;
                return a.value % 2;
            });
            api.effect(() => {
                eRuns++;
                log("effet", String(c.value));
            });
            log("etat initial", `cCalls:${cCalls} eRuns:${eRuns}`);
            a.value = 4; // pairs -> pairs : la valeur dérivée ne bouge pas, donc personne n'est notifié
            log("apres une ecriture sans changement", `cCalls:${cCalls} eRuns:${eRuns}`);
            a.value = 3; // pairs -> impairs : elle bouge
            log("apres une ecriture avec changement", `cCalls:${cCalls} eRuns:${eRuns}`);
            // Le computé NU, relu autant de fois qu'on veut. C'est la moitié que la matrice ne voyait pas :
            // aucun abonné, donc aucune voie rapide, donc le calcul repasse par `RUNNING` à chaque
            // relecture après une écriture.
            const nu = api.signal(1);
            const k = api.computed(() => nu.value % 2);
            log("nu, 1re lecture", String(k.value));
            nu.value = 3;
            log("nu, apres une ecriture sans changement", String(k.value));
            log("nu, relu", String(k.value));
            log("nu, relu encore", String(k.value));
            // Et l'écriture suivante DOIT rester prise en compte : un computé bloqué ne serait pas un
            // Cycle, ce serait pire — une valeur figée.
            nu.value = 4;
            log("nu, apres une ecriture avec changement", String(k.value));
            assert.deepEqual(log.entries, [
                "effet 0",
                "etat initial cCalls:1 eRuns:1",
                "apres une ecriture sans changement cCalls:2 eRuns:1",
                "effet 1",
                "apres une ecriture avec changement cCalls:3 eRuns:2",
                "nu, 1re lecture 1",
                "nu, apres une ecriture sans changement 1",
                "nu, relu 1",
                "nu, relu encore 1",
                "nu, apres une ecriture avec changement 0",
            ]);
        },
    },
    {
        // SPEC §7 — une dépendance abandonnée cesse de notifier. Le journal montre que `a` n'est
        // plus lue du tout, donc plus consultée.
        name: "computed/dynamic-dependencies",
        matrice: ["computed#8"],
        run(api, log) {
            const bascule = api.signal(true);
            const a = api.signal(1);
            const b = api.signal("b");
            const journal = [];
            const c = api.computed(() => {
                if (bascule.value) {
                    journal.push("a");
                    return a.value;
                }
                journal.push("b");
                return b.value;
            });
            log("1re lecture", String(c.value));
            bascule.value = false;
            log("apres bascule", String(c.value));
            a.value = "a2";
            log("apres ecriture de a, qui n'est plus lue", String(c.value));
            log("journal : a n'apparait plus", JSON.stringify(journal.filter((e) => e === "a").length === 1));
            assert.deepEqual(log.entries, [
                "1re lecture 1",
                "apres bascule b",
                "apres ecriture de a, qui n'est plus lue b",
                "journal : a n'apparait plus true",
            ]);
        },
    },
    {
        // SPEC §7 — la réactivation. Même exigence que l'abandon, vue de l'autre côté : le journal
        // doit reprendre la lecture de `a`, et la valeurIntegrer l'écriture qui a eu lieu entre-temps.
        name: "computed/reactivation-after-abandon",
        matrice: ["computed#9"],
        run(api, log) {
            const bascule = api.signal(true);
            const a = api.signal(1);
            const journal = [];
            const c = api.computed(() => {
                if (bascule.value) {
                    journal.push("a");
                    return a.value;
                }
                journal.push("b");
                return "absent";
            });
            c.value;
            bascule.value = false;
            c.value;
            a.value = 10;
            bascule.value = true;
            log("valeur apres reactivation", String(c.value));
            log("journal", JSON.stringify(journal.join("")));
            assert.deepEqual(log.entries, ["valeur apres reactivation 10", 'journal "aba"']);
        },
    },
    {
        // SPEC §15.2 — un cycle se détecte à la première relecture, pas après cent itérations. On ne
        // fige pas le message : il vient du moteur, pas de nous. On fige le type et le fait qu'une
        // seule évaluation a eu lieu.
        name: "computed/cycles",
        matrice: ["computed#12", "computed#13"],
        run(api, log) {
            let auto = 0;
            // L'annotation est ce qui casse la circularite : sans elle, TypeScript ne peut pas typer
            // `soi` a partir de sa propre initialisation, et le cycle — le sujet meme du scenario —
            // deviendrait une erreur de typage au lieu d'un comportement observe.
            const soi = api.computed(() => {
                auto++;
                return soi.value + 1;
            });
            let typeAuto = "aucune erreur";
            try {
                soi.value;
            }
            catch (erreur) {
                typeAuto = erreur instanceof Error ? erreur.constructor.name : "autre";
            }
            log("auto-cycle : type, evaluations", `${typeAuto} / ${auto}`);
            let indirect = 0;
            const premier = api.computed(() => {
                indirect++;
                return second.value + 1;
            });
            const second = api.computed(() => {
                indirect++;
                return premier.value + 1;
            });
            let typeIndirect = "aucune erreur";
            try {
                premier.value;
            }
            catch (erreur) {
                typeIndirect = erreur instanceof Error ? erreur.constructor.name : "autre";
            }
            log("cycle indirect : type, evaluations", `${typeIndirect} / ${indirect}`);
            assert.deepEqual(log.entries, [
                "auto-cycle : type, evaluations Error / 1",
                "cycle indirect : type, evaluations Error / 2",
            ]);
        },
    },
    {
        // SPEC §15 — l'erreur de la dérivation est STOCKÉE, pas recalculée à chaque lecture. C'est ce
        // qui distingue une dérivation d'une fonction : six lectures ne font qu'une évaluation.
        name: "computed/cached-error",
        matrice: ["computed#15", "computed#16"],
        run(api, log) {
            let calls = 0;
            const declencheur = api.signal(false);
            const c = api.computed(() => {
                calls++;
                if (declencheur.value)
                    throw new Error("boom");
                return 10;
            });
            log("valeur saine", String(c.value));
            declencheur.value = true;
            const rejets = [];
            for (let i = 0; i < 3; i++) {
                try {
                    c.value;
                    rejets.push("aucune erreur");
                }
                catch (erreur) {
                    rejets.push(erreur instanceof Error ? erreur.message : "autre");
                }
            }
            log("trois lectures apres declenchement", JSON.stringify(rejets));
            log("evaluations : l'erreur n'est pas recalculee", calls);
            declencheur.value = false;
            log("valeur apres resolution", String(c.value));
            log("evaluations", calls);
            assert.deepEqual(log.entries, [
                "valeur saine 10",
                'trois lectures apres declenchement ["boom","boom","boom"]',
                "evaluations : l'erreur n'est pas recalculee 2",
                "valeur apres resolution 10",
                "evaluations 3",
            ]);
        },
    },
    {
        // SPEC §6 — le computé est en lecture seule. Le descripteur n'a pas de setter, donc en mode
        // strict l'affectation lève. Le mode sloppy est un fichier à part, et la suite s'exécute en
        // strict : on n'affirme donc que le strict.
        name: "computed/read-only",
        matrice: ["computed#23", "computed#24"],
        run(api, log) {
            const c = api.computed(() => 1);
            log("instanceof Signal", String(c instanceof api.Signal));
            log("instanceof Computed", String(c instanceof api.Computed));
            const descripteur = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(c), "value");
            log("le descripteur a un setter", String(typeof descripteur?.set));
            let type = "aucune erreur";
            try {
                ;
                c.value = 2;
            }
            catch (erreur) {
                type = erreur instanceof Error ? erreur.constructor.name : "autre";
            }
            log("ecriture en mode strict", type);
            // Le mode SLOPPY : l'affectation doit être silencieusement ignorée, sans lever ni changer la
            // valeur. Le module de test est en mode strict — c'est un module ESM — donc on passe par
            // `Function`, dont le corps est sloppy sauf s'il commence par « use strict ». C'est la
            // stdlib qui fournit le mode sloppy, pas un fichier `.cjs` de plus à distribuer.
            const sloppy = auRuntime(new Function("c", "c.value = 2; return c.value"));
            log("ecriture en mode sloppy, valeur inchangee", String(sloppy(c)));
            log("aucune erreur levee en mode sloppy", String(sloppy(c) === 1));
            assert.deepEqual(log.entries, [
                "instanceof Signal true",
                "instanceof Computed true",
                "le descripteur a un setter undefined",
                "ecriture en mode strict TypeError",
                "ecriture en mode sloppy, valeur inchangee 1",
                "aucune erreur levee en mode sloppy true",
            ]);
        },
    },
    {
        // SPEC §4.2, §5.1 — `options.name` est un champ public mutable, et la marque est présente :
        // c'est ce qui empêche `createModel` de descendre dans un computé.
        name: "computed/options-and-brand",
        matrice: ["computed#25", "computed#27"],
        run(api, log) {
            const c = api.computed(() => 1, { name: "c" });
            log("nom", String(c.name));
            c.name = "z";
            log("nom modifie", String(c.name));
            log("marque", String(api.computed(() => 1).brand));
            log("marque partagee avec un signal", String(c.brand === api.signal(1).brand));
            assert.deepEqual(log.entries, [
                "nom c",
                "nom modifie z",
                "marque Symbol(preact-signals)",
                "marque partagee avec un signal true",
            ]);
        },
    },
    {
        // SPEC §8.1 — premier run SYNCHRONE, avant même que `effect()` ne rende la main, et le
        // callback ne reçoit AUCUN argument.
        name: "effect/first-run-and-arguments",
        matrice: ["effect#1", "effect#38"],
        run(api, log) {
            const journal = [];
            api.effect(function () {
                journal.push(`${arguments.length}/${typeof this}`);
            });
            log("arguments/this", JSON.stringify(journal));
            assert.deepEqual(log.entries, ['arguments/this ["0/object"]']);
        },
    },
    {
        // SPEC §8.1 — un effet SANS dépendance ne tourne qu'une fois et n'est jamais re-notifié : il
        // n'a rien à quoi s'abonner. Deux écritures ne le réveillent pas.
        name: "effect/no-dependency",
        matrice: ["effect#3"],
        run(api, log) {
            const s = api.signal(0);
            let runs = 0;
            // Le callback ne lit RIEN. C'est toute la différence avec un effet qui lit.
            api.effect(() => {
                runs++;
            });
            s.value = 1;
            s.value = 2;
            log("runs", String(runs));
            assert.deepEqual(log.entries, ["runs 1"]);
        },
    },
    {
        // SPEC §8.1, §12 — re-run à chaque changement, cleanup exécuté JUSTE AVANT le run suivant,
        // et le cleanup voit la valeur COURANTE : celle qui vient d'écrire, pas celle de son run.
        name: "effect/rerun-and-cleanup",
        matrice: ["effect#2", "effect#6", "effect#8"],
        run(api, log) {
            const s = api.signal(0);
            const journal = [];
            api.effect(() => {
                journal.push(`run:${s.value}`);
                return () => journal.push(`cleanup:${s.value}`);
            });
            s.value = 1;
            s.value = 2;
            log("journal", JSON.stringify(journal));
            // `effect#2` dit « re-run à chaque CHANGEMENT de dépendance », pas « sur la dernière lue ».
            // La liste des sources est chaînée vers les plus ANCIENNES : écrire sur la première lue doit
            // réveiller autant que écrire sur la dernière. C'est la seule chose que le cas à une seule
            // source ne prouve pas.
            const p = api.signal(0);
            const q = api.signal(0);
            const chezSoi = [];
            api.effect(() => {
                chezSoi.push(`${p.value}:${q.value}`);
            });
            p.value = 1;
            q.value = 1;
            p.value = 2;
            log("deux sources", JSON.stringify(chezSoi));
            assert.deepEqual(log.entries, [
                'journal ["run:0","cleanup:1","run:1","cleanup:2","run:2"]',
                'deux sources ["0:0","1:0","1:1","2:1"]',
            ]);
        },
    },
    {
        // SPEC §8.2 — le dispositeur est `_dispose.bind(effect)` : `name === "bound "`, `length === 0`,
        // `Object.keys()` vide. Ce n'est ni une arrow, ni l'instance.
        name: "effect/shape-of-the-disposer",
        matrice: ["effect#4", "effect#35"],
        run(api, log) {
            const d = api.effect(() => { });
            log("type", typeof d);
            log("name", JSON.stringify(d.name));
            log("length", String(d.length));
            log("cles", JSON.stringify(Object.keys(d)));
            assert.deepEqual(log.entries, ["type function", 'name "bound "', "length 0", "cles []"]);
        },
    },
    {
        // SPEC §8.1 — une valeur de retour qui n'est pas une fonction est IGNORÉE. Pas d'erreur, pas
        // de cleanup : c'est le cas le plus courant du monde, un callback qui renvoie autre chose.
        name: "effect/non-function-return-ignored",
        matrice: ["effect#5"],
        run(api, log) {
            const d = api.effect(() => 42);
            log("dispositeur rendu", typeof d);
            d();
            log("aucune erreur", "true");
            assert.deepEqual(log.entries, ["dispositeur rendu function", "aucune erreur true"]);
        },
    },
    {
        // SPEC §12 — le cleanup s'exécute HORS de tout contexte de suivi : lire un autre signal ne
        // réabonne pas. Sans quoi le dispose laisserait une dépendance fantôme.
        name: "effect/cleanup-untracked",
        matrice: ["effect#7"],
        run(api, log) {
            const pilote = api.signal(0);
            const autre = api.signal(0);
            const journal = [];
            const d = api.effect(() => {
                journal.push(`run ${pilote.value}`);
                return () => journal.push(`cleanup voit ${autre.value}`);
            });
            autre.value = 5;
            d();
            log("journal", JSON.stringify(journal));
            log("autre a-t-elle un abonne ?", String(auRuntime(autre)._targets === undefined));
            assert.deepEqual(log.entries, [
                'journal ["run 0","cleanup voit 5"]',
                "autre a-t-elle un abonne ? true",
            ]);
        },
    },
    {
        // SPEC §8.3 — `this` est l'INSTANCE d'effet pour une fonction non fléchée ; une flèche capture
        // le `this` lexical du module. On vérifie l'identité de classe, PAS les noms de propriétés :
        // la baseline minifie les siens, donc ils ne sont pas lisibles. Même cause que #33.
        name: "effect/this-is-the-instance",
        matrice: ["effect#9", "effect#10"],
        run(api, log) {
            let cleNonFlechee;
            api.effect(function () {
                cleNonFlechee = this;
            });
            log("non flechee : instanceof", String(cleNonFlechee instanceof api.Effect));
            let cleFlechee = undefined;
            api.effect(() => {
                cleFlechee = thisGlobal;
            });
            log("flechee : instanceof", String(cleFlechee instanceof api.Effect));
            log("flechee : this du module", String(cleFlechee === globalThis));
            assert.deepEqual(log.entries, [
                "non flechee : instanceof true",
                "flechee : instanceof false",
                "flechee : this du module true",
            ]);
        },
    },
    {
        // SPEC §13.4 — HORS batch, chaque écriture draine immédiatement, donc l'ordre des runs suit
        // l'ordre des écritures. L'ordre INVERSÉ est normatif à l'intérieur d'un batch, et c'est
        // `effect/order-in-batch` qui le rejoue : sans `batch`, la règle n'est pas observable et
        // l'affirmer serait inventer.
        name: "effect/order-outside-batch",
        matrice: ["effect#15", "effect#17"],
        run(api, log) {
            const a = api.signal(0);
            const b = api.signal(0);
            const journal = [];
            api.effect(() => {
                journal.push(`A:${a.value}`);
            });
            api.effect(() => {
                journal.push(`B:${b.value}`);
            });
            a.value = 1;
            b.value = 1;
            log("ordre des runs", JSON.stringify(journal.slice(2)));
            assert.deepEqual(log.entries, ['ordre des runs ["A:1","B:1"]']);
        },
    },
    {
        // SPEC §13.4 — DANS UN BATCH, L'ORDRE EST INVERSÉ, et ce n'est pas un détail : `d2` passe
        // AVANT `d1`, alors que c'est `d1` qui vient d'être écrit en premier. Le drainage est en
        // largeur — une génération entière est vidée avant la suivante — donc les deux effets de la
        // génération tournent dans l'ordre de la file, pas dans celui des écritures.
        //
        // Les deux entrées de ce scenario pointaient sur le ticket #26, clos : rien ne les rejouait.
        // `effect#15` est le drapeau DISPOSED vérifié AVANT `needsToRecompute` : `d1` dispose `d2` depuis
        // son propre run, et `d2` ne rejoue pas — il ne figure donc pas dans le journal du flush.
        // `effect#17` est la cascade : l'écriture de `d1` réveille `d2`, qui réveille `d1`, donc `d1`
        // tourne deux fois. C'est ce qui distingue les deux entrées, et les fusionner en dirait moins.
        name: "effect/order-in-batch",
        matrice: [],
        run(api, log) {
            // effect#15 : A dispose B après le run de B.
            const s15 = api.signal(0);
            const journal15 = [];
            let d2 = () => { };
            const d1 = api.effect(() => {
                journal15.push(`d1:${s15.value}`);
                if (s15.value === 1) {
                    d2();
                    journal15.push("d1 disposed d2");
                }
            });
            d2 = api.effect(() => {
                journal15.push(`d2:${api.untracked(() => s15.value)}`);
            });
            api.batch(() => {
                s15.value = 1;
            });
            log("A dispose B depuis son run", JSON.stringify(journal15));
            // effect#17 : l'écriture de d1 réveille d2, qui réveille d1.
            const a = api.signal(0);
            const b = api.signal(0);
            const journal17 = [];
            api.effect(() => {
                journal17.push(`d2:${b.value}`);
            });
            api.effect(() => {
                const v = a.value;
                b.value;
                journal17.push(`d1:${v}`);
                if (v > 0)
                    b.value = v;
            });
            api.batch(() => {
                a.value = 1;
            });
            log("l'ecriture de d1 reveille d2", JSON.stringify(journal17));
            assert.deepEqual(log.entries, [
                'A dispose B depuis son run ["d1:0","d2:0","d1:1","d1 disposed d2"]',
                'l\'ecriture de d1 reveille d2 ["d2:0","d1:0","d1:1","d2:1","d1:1"]',
            ]);
        },
    },
    {
        // SPEC §8.4 — un effet qui écrit une dépendance qu'il lit se ré-exécute dans le MÊME drainage. Le
        // drain est en largeur : une génération est vidée entièrement avant la suivante.
        name: "effect/auto-write",
        matrice: ["effect#16"],
        run(api, log) {
            const s = api.signal(0);
            let runs = 0;
            api.effect(() => {
                runs++;
                if (s.value < 2)
                    s.value = s.value + 1;
            });
            log("runs", String(runs));
            log("valeur", String(s.value));
            assert.deepEqual(log.entries, ["runs 3", "valeur 2"]);
        },
    },
    {
        // SPEC §13.6 — un effet créé dans un effet est INDÉPENDANT et non possédé : le dispose de
        // l'extérieur ne doit pas emporter l'intérieur. L'intérieur est créé UNE FOIS, pas à chaque
        // run, sinon c'est un autre comportement qu'on mesurerait.
        name: "effect/nesting-and-independence",
        matrice: ["effect#33"],
        run(api, log) {
            const s = api.signal(0);
            const journal = [];
            const interne = api.effect(() => {
                journal.push(`interne:${s.value}`);
            });
            const externe = api.effect(() => {
                journal.push(`externe:${s.value}`);
            });
            log("runs avant ecriture", journal.length);
            s.value = 1;
            log("journal apres ecriture", JSON.stringify(journal));
            externe();
            s.value = 2;
            // L'interne a tourné une fois de plus, et l'externe aucune : c'est exactement
            // « indépendant et non possédé ».
            log("seul l'interne a-t-il tourne ?", String(journal.length === 5));
            interne();
            assert.deepEqual(log.entries, [
                "runs avant ecriture 2",
                'journal apres ecriture ["interne:0","externe:0","interne:1","externe:1"]',
                "seul l'interne a-t-il tourne ? true",
            ]);
        },
    },
    {
        // SPEC §15.2 — un cycle borné ne lève pas : c'est un cycle, pas une erreur. Le COMPTE de runs
        // d'un cycle non borné n'est pas figé, donc on ne l'affirme pas.
        name: "effect/bounded-cycle",
        matrice: ["effect#19"],
        run(api, log) {
            const a = api.signal(0);
            let runs = 0;
            api.effect(() => {
                runs++;
                const v = a.value;
                if (v < 50)
                    a.value = v + 1;
            });
            log("runs", String(runs));
            log("valeur", String(a.value));
            assert.deepEqual(log.entries, ["runs 51", "valeur 50"]);
        },
    },
    {
        // SPEC §15 — une exception au PREMIER run dispose l'effet, se propage, et ne rend AUCUN
        // dispositeur. Une exception à un RE-RUN laisse l'effet vivant : la propagation suivante le
        // rappelle, et celle d'après ne lève plus.
        name: "effect/errors",
        matrice: ["effect#20", "effect#22", "effect#24", "effect#18"],
        run(api, log) {
            const s = api.signal(0);
            let runs = 0;
            let rendu = "jamais rendu";
            try {
                rendu = api.effect(() => {
                    runs++;
                    if (s.value === 0)
                        throw new Error("boom premier");
                });
                log("aucune erreur au premier run", "inattendu");
            }
            catch (erreur) {
                rendu = "leve";
                log("erreur propagee", erreur instanceof Error ? erreur.message : "autre");
            }
            log("un dispositeur a-t-il ete rendu ?", String(rendu === "leve"));
            log("runs du premier effet", String(runs));
            const t = api.signal(0);
            let runsT = 0;
            api.effect(() => {
                runsT++;
                if (t.value === 1)
                    throw new Error("boom rerun");
            });
            try {
                t.value = 1;
                log("pas d'erreur au rerun", "inattendu");
            }
            catch (erreur) {
                log("erreur du rerun relancee par l'ecriture", erreur instanceof Error ? erreur.message : "autre");
            }
            t.value = 2;
            log("runs de l'effet survivant", String(runsT));
            assert.deepEqual(log.entries, [
                "erreur propagee boom premier",
                "un dispositeur a-t-il ete rendu ? true",
                "runs du premier effet 1",
                "erreur du rerun relancee par l'ecriture boom rerun",
                "runs de l'effet survivant 3",
            ]);
        },
    },
    {
        // SPEC §15.4, §15.6 — OÙ REMONTE L'ERREUR D'EFFET. Quatre entrées, quatre points de sortie
        // distincts, et les quatre pointaient sur le ticket #26, clos : rien ne les rejouait.
        //
        // L'ordre est LIFO : dans le flush, les effets sont drainés en largeur, donc `B` tourne après
        // `A` et c'est donc `B` qui est mémorisé comme première erreur — celle qui sera relancée. C'est
        // l'inverse de l'ordre de création, et c'est ce qui rend le nom de la variable trompeur.
        //
        // Les trois autres disent OÙ l'exception sort, pas QUELLE exception : du setter hors batch, du
        // `batch` et non du corps, et l'erreur d'effet qui écrase celle du corps pendant le
        // unwinding. Les mettre dans le même scénario est le fait : ce sont les trois sorties du même
        // `try/finally`.
        //
        // ET ICI LE MESSAGE EST L'OBSERVABLE, donc la règle de SPEC §15.4 ne s'applique pas. `EB` et
        // non `EA` EST le fait de `effect#23` : deux effets lèvent, et ce qui compte est que le
        // mauvais remonte. `body` et non `EFFECT`, c'est `effect#26`. `EFFECT` et non `BODY`, c'est
        // `effect#27`. Ces trois messages sont écrits ici, jamais produits par le moteur, donc le
        // minifié n'a rien à perdre — ce qui est la raison de la règle. Partout ailleurs dans ce
        // fichier, on n'assert que le TYPE.
        name: "effect/draining-errors",
        matrice: [],
        run(api, log) {
            // effect#23 : la première erreur mémorisée est la PREMIÈRE dans l'ordre de flush, donc la
            // dernière dans l'ordre de création. Le flush est en largeur, donc LIFO.
            const declencheurA = api.signal(0);
            const declencheurB = api.signal(0);
            const journal23 = [];
            api.effect(() => {
                journal23.push("A");
                if (declencheurA.value === 1)
                    throw new Error("EA");
            });
            api.effect(() => {
                journal23.push("B");
                if (declencheurB.value === 1)
                    throw new Error("EB");
            });
            try {
                api.batch(() => {
                    declencheurA.value = 1;
                    declencheurB.value = 1;
                });
                log("batch", "aucune erreur");
            }
            catch (erreur) {
                journal23.push(`caught:${erreur instanceof Error ? erreur.message : "autre"}`);
            }
            log("ordre LIFO", JSON.stringify(journal23));
            // effect#25 : hors batch, l'erreur sort du SETTER — donc la valeur a déjà été écrite quand
            // elle remonte. C'est l'asymétrie avec le batch, où elle sort du `batch` lui-même.
            const horsBatch = api.signal(0);
            api.effect(() => {
                if (horsBatch.value === 1)
                    throw new Error("E");
            });
            try {
                horsBatch.value = 1;
                log("setter", "aucune erreur");
            }
            catch (erreur) {
                // Le TYPE, jamais le message — SPEC §15.4. Ce que `effect#25` fige est D'OUÙ l'erreur
                // sort, et le dire par le setter suffit ; le texte n'ajouterait rien.
                log("setter", `write threw: ${erreur instanceof Error ? erreur.constructor.name : "autre"}`);
            }
            log("valeur ecriture malgre l'erreur", String(horsBatch.value));
            // effect#26 : l'erreur de l'effet est relancée par le BATCH, pas par le corps — donc la
            // dernière ligne du corps s'exécute, et c'est ce qui la distingue d'une exception au corps.
            const dansBatch = api.signal(0);
            const journal26 = [];
            api.effect(() => {
                journal26.push(`e:${dansBatch.value}`);
            });
            try {
                api.batch(() => {
                    dansBatch.value = 1;
                    throw new Error("body");
                });
                log("batch", "aucune erreur");
            }
            catch (erreur) {
                journal26.push(`caught:${erreur instanceof Error ? erreur.message : "autre"}`);
            }
            log("relance par le batch", JSON.stringify(journal26));
            // effect#27 : l'erreur d'effet ÉCRASE celle du corps. Le `finally` du batch throw pendant
            // l'unwinding, donc le `BODY` est perdu — c'est un défaut figé, pas une préférence.
            const deuxErreurs = api.signal(0);
            api.effect(() => {
                if (deuxErreurs.value === 1)
                    throw new Error("EFFECT");
            });
            try {
                api.batch(() => {
                    deuxErreurs.value = 1;
                    throw new Error("BODY");
                });
                log("hierarchie", "aucune erreur");
            }
            catch (erreur) {
                log("hierarchie", erreur instanceof Error ? erreur.message : "autre");
            }
            assert.deepEqual(log.entries, [
                'ordre LIFO ["A","B","B","A","caught:EB"]',
                "setter write threw: Error",
                "valeur ecriture malgre l'erreur 1",
                'relance par le batch ["e:0","e:1","caught:body"]',
                "hierarchie EFFECT",
            ]);
        },
    },
    {
        // SPEC §4.2 — `watched` à l'ajout du PREMIER abonné, `unwatched` à la perte du DERNIER, les
        // deux hors de tout suivi, et une seule fois chacun quel que soit le nombre d'abonnés.
        name: "effect/watchers",
        matrice: ["effect#21"],
        run(api, log) {
            const journal = [];
            const s = api.signal(0, {
                watched() {
                    journal.push(`watched ${String(this.name)}`);
                },
                unwatched() {
                    journal.push(`unwatched ${String(this.name)}`);
                },
            });
            s.name = "W";
            const d1 = api.effect(() => s.value);
            const d2 = api.effect(() => s.value);
            d1();
            d2();
            s.value = 1;
            log("journal", JSON.stringify(journal));
            // `effect#21`, cas des DEUX sources : un dispose doit détacher TOUTES celles que l'effet
            // lit, pas seulement celle qu'il a lue en dernier — sinon les autres restent abonnées à des
            // sources prévenues par un effet mort. Et l'ordre est celui de LECTURE, pas l'inverse.
            const hooks = [];
            const p = api.signal(0, {
                watched: () => hooks.push("+p"),
                unwatched: () => hooks.push("-p"),
            });
            const q = api.signal(0, {
                watched: () => hooks.push("+q"),
                unwatched: () => hooks.push("-q"),
            });
            const d3 = api.effect(() => {
                p.value;
                q.value;
            });
            d3();
            log("deux sources", JSON.stringify(hooks));
            // Le MÊME cas, mais via un COMPUTÉ à deux sources. C'est là que la géométrie se voit : un
            // computé branche ses sources à l'abonnement et les débranche au dernier abonné perdu, donc
            // l'ordre de ses crochets suit le sens de parcours de sa liste de dépendances. La matrice
            // l'a observé — entrée 52, `["c:unwatched","a:unwatched","b:unwatched"]`, et entrée 9 du
            // tableau de vérification, `["a+","b+","a-","b-"]` — donc l'ordre de libération est celui de
            // LECTURE. C'est ce que la géométrie miroir faisait, et pas l'inverse : ADR-0009.
            const ordre = [];
            const a = api.signal(0, {
                watched: () => ordre.push("a+"),
                unwatched: () => ordre.push("a-"),
            });
            const b = api.signal(0, {
                watched: () => ordre.push("b+"),
                unwatched: () => ordre.push("b-"),
            });
            const derive = api.computed(() => a.value + b.value, {
                watched: () => ordre.push("c+"),
                unwatched: () => ordre.push("c-"),
            });
            derive.value;
            const d4 = api.effect(() => derive.value);
            ordre.length = 0;
            d4();
            log("crochets d un computé", JSON.stringify(ordre));
            assert.deepEqual(log.entries, [
                'journal ["watched W","unwatched W"]',
                'deux sources ["+p","+q","-p","-q"]',
                'crochets d un computé ["c-","a-","b-"]',
            ]);
        },
    },
    {
        // SPEC §13.1 — la chaîne A → B → C → Effect. Le drain est en largeur : une génération est
        // vidée entièrement avant la suivante.
        name: "effect/chain-and-drain",
        matrice: ["effect#32"],
        run(api, log) {
            const a = api.signal(0);
            const journal = [];
            const c1 = api.computed(() => {
                journal.push(`c1:${a.value}`);
                return a.value;
            });
            const c2 = api.computed(() => {
                journal.push(`c2:${c1.value}`);
                return c1.value;
            });
            api.effect(() => {
                journal.push(`d1:${c2.value}`);
            });
            a.value = 1;
            log("journal", JSON.stringify(journal));
            // `effect#32` n'a qu'une source par computé. Un computé à DEUX sources doit raccorder les
            // DEUX à son effet : sinon la chaîne est coupée à son premier maillon, et une écriture sur
            // la source lue en premier ne réveille plus personne — alors que le computé, lui, se
            // recalcule. C'est ce que prouve ici : le computé se met à jour ET l'effet tourne.
            const p = api.signal(0);
            const q = api.signal(0);
            const deux = api.computed(() => p.value * 10 + q.value);
            const vuParEffet = [];
            api.effect(() => {
                vuParEffet.push(String(deux.value));
            });
            p.value = 1;
            q.value = 1;
            log("computé a deux sources", JSON.stringify(vuParEffet));
            assert.deepEqual(log.entries, [
                'journal ["c1:0","c2:0","d1:0","c1:1","c2:1","d1:1"]',
                'computé a deux sources ["0","10","11"]',
            ]);
        },
    },
    {
        // SPEC §12 — un cleanup qui LÈVE dispose l'effet, même en plein drainage : l'écriture suivante
        // ne propage plus. Et il ne casse pas le contexte de suivi, le moteur reste utilisable.
        name: "dispose/cleanup-that-throws",
        matrice: ["effect#28", "effect#30", "effect#31"],
        run(api, log) {
            const s = api.signal(0);
            let runs = 0;
            api.effect(() => {
                runs++;
                // Le cleanup ne sera appelé qu'au run SUIVANT, donc il faut encore une écriture.
                if (s.value >= 1)
                    return () => {
                        throw new Error("cleanup boom");
                    };
            });
            const tentatives = [];
            for (const ecriture of [1, 2, 3]) {
                try {
                    s.value = ecriture;
                    tentatives.push(`${ecriture}:aucune`);
                }
                catch (erreur) {
                    tentatives.push(`${ecriture}:${erreur instanceof Error ? erreur.message : "autre"}`);
                }
            }
            log("tentatives", JSON.stringify(tentatives));
            log("runs", String(runs));
            const t = api.signal(0);
            let runsT = 0;
            const d2 = api.effect(() => {
                runsT++;
            });
            t.value = 1;
            log("l'effet suivant tourne-t-il ?", String(runsT));
            d2();
            assert.deepEqual(log.entries, [
                'tentatives ["1:aucune","2:cleanup boom","3:aucune"]',
                "runs 2",
                "l'effet suivant tourne-t-il ? 1",
            ]);
        },
    },
    {
        // SPEC §8.4 — un effet disposé ALORS qu'il est dans la file de drainage est sauté
        // silencieusement, sans callback.
        name: "dispose/in-the-queue",
        matrice: ["effect#14", "dispose#8"],
        run(api, log) {
            const s = api.signal(0);
            const journal = [];
            const d2 = api.effect(() => {
                journal.push(`d2:${s.value}`);
            });
            const d1 = api.effect(() => {
                journal.push(`d1:${s.value}`);
                d2();
            });
            s.value = 1;
            log("journal", JSON.stringify(journal));
            s.value = 2;
            log("d2 n'est pas revenu", String(journal.filter((e) => e === "d2:1").length === 0));
            assert.deepEqual(log.entries, ['journal ["d2:0","d1:0","d1:1"]', "d2 n'est pas revenu true"]);
        },
    },
    {
        // SPEC §12 — dispose externe idempotent, et il détache toutes les dépendances : la source ne
        // garde plus d'abonné, donc plus aucune propagation.
        name: "dispose/idempotent-and-detachment",
        matrice: ["effect#13", "dispose#6", "dispose#9"],
        run(api, log) {
            const s = api.signal(0);
            const journal = [];
            const d = api.effect(() => {
                journal.push(`run:${s.value}`);
                return () => journal.push("cleanup");
            });
            s.value = 1;
            d();
            d();
            d();
            log("journal", JSON.stringify(journal));
            s.value = 2;
            log("aucun run apres", String(journal.length));
            log("la source a-t-elle un abonne ?", String(auRuntime(s)._targets === undefined));
            assert.deepEqual(log.entries, [
                'journal ["run:0","cleanup","run:1","cleanup"]',
                "aucun run apres 4",
                "la source a-t-elle un abonne ? true",
            ]);
        },
    },
    {
        // SPEC §8.3, §12 — `this.dispose()` pendant le run : cleanup IMMÉDIAT, et l'effet ne peut plus
        // être notifié. Appelé deux fois, un seul cleanup.
        name: "dispose/during-the-run",
        matrice: ["effect#11", "effect#12", "dispose#7"],
        run(api, log) {
            const s = api.signal(0);
            const journal = [];
            api.effect(function () {
                journal.push(`run:${s.value}`);
                this.dispose();
                this.dispose();
            });
            log("journal", JSON.stringify(journal));
            s.value = 1;
            log("aucun run apres", String(journal.length));
            assert.deepEqual(log.entries, ['journal ["run:0"]', "aucun run apres 1"]);
        },
    },
    {
        // SPEC §12 — un cleanup qui lève AU MOMENT DU DISPOSE remonte, et l'effet est mort. La
        // différence avec `dispose/cleanup-that-throws` est nette : là le cleanup était levé en pleine
        // propagation, ici il est levé par le dispositeur lui-même, donc rien ne le rattrape.
        name: "dispose/cleanup-that-throws-at-dispose",
        matrice: ["effect#29", "effect#30"],
        run(api, log) {
            const s = api.signal(0);
            let runs = 0;
            const d = api.effect(() => {
                runs++;
                return () => {
                    throw new Error("cleanup boom");
                };
            });
            let type = "aucune erreur";
            try {
                d();
            }
            catch (erreur) {
                type = erreur instanceof Error ? erreur.message : "autre";
            }
            log("erreur du dispose", type);
            log("runs", String(runs));
            // L'effet est mort : plus aucun run, quelle que soit l'écriture suivante.
            s.value = 1;
            log("runs apres ecriture", String(runs));
            log("la source a-t-elle un abonne ?", String(auRuntime(s)._targets === undefined));
            // Et un second dispose ne lève plus : il n'y a plus rien à faire.
            let second = "aucune erreur";
            try {
                d();
            }
            catch (erreur) {
                second = erreur instanceof Error ? erreur.message : "autre";
            }
            log("second dispose", second);
            assert.deepEqual(log.entries, [
                "erreur du dispose cleanup boom",
                "runs 1",
                "runs apres ecriture 1",
                "la source a-t-elle un abonne ? true",
                "second dispose aucune erreur",
            ]);
        },
    },
    {
        // SPEC §9.1 — un batch imbriqué ne compte pas la profondeur : il se comporte comme un simple
        // appel. Seul le plus externe draine, et la valeur de retour intérieure remonte.
        name: "batch/value-and-nesting",
        matrice: ["batch#3", "batch#5", "batch#6"],
        run(api, log) {
            const a = api.signal(0);
            const journal = [];
            api.effect(() => {
                journal.push(`e:${a.value}`);
            });
            const objet = { marque: 1 };
            log("retour simple", api.batch(() => "ret") === "ret" ? "ret" : "autre");
            log("reference d objet preservee", api.batch(() => objet) === objet ? "oui" : "non");
            log("retour imbrique remonte", api.batch(() => api.batch(() => "inner")) === "inner" ? "oui" : "non");
            // L'effet a déjà tourné À SA CRÉATION, avant tout batch.
            log("journal avant le batch", JSON.stringify(journal));
            let pendant = "";
            const rendu = api.batch(() => {
                journal.push("A");
                a.value = 1;
                journal.push("B");
                a.value = 2;
                journal.push("C");
                pendant = JSON.stringify(journal);
                return "hors";
            });
            log("journal PENDANT le batch", pendant);
            log("journal APRES le batch", JSON.stringify(journal));
            log("retour exterieur", rendu);
            log("valeur finale", String(a.value));
            assert.deepEqual(log.entries, [
                "retour simple ret",
                "reference d objet preservee oui",
                "retour imbrique remonte oui",
                'journal avant le batch ["e:0"]',
                'journal PENDANT le batch ["e:0","A","B","C"]',
                'journal APRES le batch ["e:0","A","B","C","e:2"]',
                "retour exterieur hors",
                "valeur finale 2",
            ]);
        },
    },
    {
        // SPEC §9.1 — trois niveaux d'imbrication, un seul drainage. Et l'ordre de drainage est l'INVERSE de
        // l'ordre de notification, pas l'ordre de création : `b` est écrit en second, donc `C` passe
        // avant `A` et `B`. C'est la règle de §13.4, et elle se lit ici.
        name: "batch/three-levels-and-order",
        matrice: ["batch#7", "batch#14"],
        run(api, log) {
            const a = api.signal(0);
            const b = api.signal(0);
            const journal = [];
            const d1 = api.effect(() => journal.push(`A:${a.value}`));
            const d2 = api.effect(() => journal.push(`B:${a.value}`));
            const d3 = api.effect(() => journal.push(`C:${b.value}`));
            api.batch(() => {
                api.batch(() => {
                    api.batch(() => {
                        journal.push("niveau3");
                        a.value = 1;
                        b.value = 1;
                    });
                    journal.push("niveau2");
                });
                journal.push("niveau1");
            });
            log("journal", JSON.stringify(journal));
            d1();
            d2();
            d3();
            assert.deepEqual(log.entries, [
                'journal ["A:0","B:0","C:0","niveau3","niveau2","niveau1","C:1","A:1","B:1"]',
            ]);
        },
    },
    {
        // SPEC §9.2 — l'erreur du corps remonte ET le drainage a lieu quand meme. La profondeur doit etre
        // restauree, sinon l'ecriture suivante ne drainerait plus jamais.
        name: "batch/body-error-and-depth",
        matrice: ["batch#4", "batch#10"],
        run(api, log) {
            const a = api.signal(0);
            const journal = [];
            api.effect(() => journal.push(`e:${a.value}`));
            let type = "aucune";
            try {
                api.batch(() => {
                    a.value = 1;
                    throw new Error("boom");
                });
            }
            catch (erreur) {
                type = erreur instanceof Error ? erreur.message : "autre";
            }
            log("erreur du corps", type);
            log("journal malgre l erreur", JSON.stringify(journal));
            // La profondeur est restauree : une ecriture hors batch doit drainer normalement.
            a.value = 2;
            log("apres une ecriture hors batch", JSON.stringify(journal));
            assert.deepEqual(log.entries, [
                "erreur du corps boom",
                'journal malgre l erreur ["e:0","e:1"]',
                'apres une ecriture hors batch ["e:0","e:1","e:2"]',
            ]);
        },
    },
    {
        // SPEC §9.1 et §9.2 — une exception dans un batch IMBRIQUE ne passe pas par un `finally` local :
        // elle remonte au batch externe, qui draine puis re-throw. Donc RIEN ne draine au milieu, meme si
        // l'exterieur rattrape : `end` passe avant le drainage, et le drainage voit la valeur finale.
        name: "batch/caught-inner-error",
        matrice: ["batch#8", "batch#9"],
        run(api, log) {
            const a = api.signal(0);
            const journal = [];
            api.effect(() => journal.push(`e:${a.value}`));
            api.batch(() => {
                try {
                    api.batch(() => {
                        a.value = 1;
                        throw new Error("inner");
                    });
                }
                catch (erreur) {
                    journal.push("caught inner");
                    a.value = 2;
                    journal.push("after");
                }
                journal.push("end");
            });
            log("journal", JSON.stringify(journal));
            const b = api.signal(0);
            const journal2 = [];
            api.effect(() => journal2.push(`f:${b.value}`));
            let type = "aucune";
            try {
                api.batch(() => {
                    b.value = 1;
                    throw new Error("out");
                });
            }
            catch (erreur) {
                type = erreur instanceof Error ? erreur.message : "autre";
            }
            log("erreur exterieure", type);
            log("journal exterieur malgre l erreur", JSON.stringify(journal2));
            assert.deepEqual(log.entries, [
                'journal ["e:0","caught inner","after","end","e:2"]',
                "erreur exterieure out",
                'journal exterieur malgre l erreur ["f:0","f:1"]',
            ]);
        },
    },
    {
        // SPEC §9.3 — ecrire plusieurs fois la MEME valeur ne notifie qu'une fois, et un effet notifie
        // deux fois ne tourne qu'une fois par drainage. Le temoin lit `a`, donc il a bien une dependance.
        name: "batch/identical-write",
        matrice: ["batch#2", "batch#11", "batch#12", "batch#15"],
        run(api, log) {
            const a = api.signal(0);
            const journal = [];
            api.effect(() => journal.push(`e:${a.value}`));
            api.batch(() => {
                a.value = 1;
                a.value = 1;
                a.value = 1;
            });
            log("journal", JSON.stringify(journal));
            // Un batch sans ecriture ne draine pas du tout.
            api.batch(() => {
                a.value;
            });
            log("apres un batch sans ecriture", JSON.stringify(journal));
            // Et une reecriture identique HORS batch ne notifie toujours pas.
            a.value = 1;
            log("apres reecriture identique", JSON.stringify(journal));
            a.value = 2;
            log("apres une vraie ecriture", JSON.stringify(journal));
            assert.deepEqual(log.entries, [
                'journal ["e:0","e:1"]',
                'apres un batch sans ecriture ["e:0","e:1"]',
                'apres reecriture identique ["e:0","e:1"]',
                'apres une vraie ecriture ["e:0","e:1","e:2"]',
            ]);
        },
    },
    {
        // SPEC §13.5 — `A → B → A` dans un batch : l'aval n'a pas a recalculer. Mais un revert sur `a`
        // et un changement reel sur `b` font changer le computé, donc le fast-forward n'est pas un
        // passe-partout.
        name: "batch/revert-a-b-a",
        matrice: ["batch#16", "batch#19", "batch#21"],
        run(api, log) {
            const a = api.signal(0);
            const b = api.signal(0);
            let cCalls = 0;
            let eRuns = 0;
            const c = api.computed(() => {
                cCalls++;
                return a.value + b.value;
            });
            api.effect(() => {
                eRuns++;
                c.value;
            });
            log("etat initial", `cCalls:${cCalls} eRuns:${eRuns}`);
            api.batch(() => {
                a.value = 1;
                a.value = 2;
                a.value = 0;
            });
            log("apres un revert simple", `cCalls:${cCalls} eRuns:${eRuns}`);
            api.batch(() => {
                a.value = 5;
                a.value = 0;
                b.value = 10;
            });
            log("apres revert et changement", `cCalls:${cCalls} eRuns:${eRuns}`);
            log("valeur du computé", String(c.value));
            // Un effet créé DANS le corps du batch voit son premier run immediatement : le batch retarde
            // la propagation, pas l'exécution. C'est `batch#21`.
            let dansLeBatch = "jamais";
            const d = api.signal(0);
            api.batch(() => {
                d.value = 1;
                api.effect(() => {
                    dansLeBatch = `vu:${d.value}`;
                });
            });
            log("effet cree dans le batch", dansLeBatch);
            assert.deepEqual(log.entries, [
                "etat initial cCalls:1 eRuns:1",
                "apres un revert simple cCalls:1 eRuns:1",
                "apres revert et changement cCalls:2 eRuns:2",
                "valeur du computé 10",
                "effet cree dans le batch vu:1",
            ]);
        },
    },
    {
        // SPEC §13.5 — MAIS une lecture paresseuse PENDANT le batch fait perdre le fast-forward. Le
        // noeud a consume la version intermediaire, donc l'effet tourne une seconde fois, avec la
        // valeur REVERTIE. C'est le cas le plus subtil de la tranche, et il tient en un scenario.
        name: "batch/revert-with-lazy-read",
        matrice: ["batch#17", "batch#18", "batch#20"],
        run(api, log) {
            const a = api.signal(0);
            const journal = [];
            let cCalls = 0;
            const c = api.computed(() => {
                cCalls++;
                return a.value;
            });
            // L'effet lit le COMPUTÉ, pas `a` : c'est lui qui consomme la version intermediaire.
            api.effect(() => journal.push(`e:${c.value}`));
            api.batch(() => {
                a.value = 10;
                journal.push(`mid:${c.value}`);
                a.value = 0;
            });
            log("journal", JSON.stringify(journal));
            log("cCalls", String(cCalls));
            log("fin", `end:${c.value}`);
            // Une ecriture ulterieure ne doit pas rester figee sur la valeur revertee.
            a.value = 20;
            log("cCalls apres ecriture ulterieure", String(cCalls));
            assert.deepEqual(log.entries, [
                'journal ["e:0","mid:10","e:0"]',
                "cCalls 3",
                "fin end:0",
                "cCalls apres ecriture ulterieure 4",
            ]);
        },
    },
    {
        // SPEC §9.1 — écrire une source puis RELIRE son computé, dans le même batch, réveille quand
        // même l'effet à la sortie du batch. La notification d'un computé l'empilait dans la file des
        // drainages, donc sa lecture CONSOMMAIT cette file, et plus rien n'était à drainer en sortant du
        // batch : l'effet ne tournait jamais. La baseline (`L737-749`) pose les drapeaux et prévient ses
        // cibles par un parcours, sans empiler le computé.
        //
        // La lecture est dans le corps du batch, et c'est ce qui rend le cas minimal : hors batch le
        // setter imbrique son propre batch et referme, donc la lecture arrive APRÈS le drainage et la
        // différence ne s'observe pas. Le `untracked` autour de la lecture rend la même garantie — il
        // neutralise le suivi, pas le rafraîchissement — donc il doit réveiller l'effet lui aussi.
        name: "batch/reread-wakes-despite-read",
        matrice: [],
        run(api, log) {
            const a = api.signal("a");
            const journal = [];
            const A = api.computed(() => `A:${a.value}`);
            api.effect(() => journal.push(`e:${A.value}`));
            A.value;
            api.batch(() => {
                a.value = "T";
                log("pendant le batch", String(A.value));
            });
            log("journal", JSON.stringify(journal));
            // Relire APRÈS le batch ne doit rien changer de plus : l'effet a déjà tourné.
            A.value;
            log("journal apres relecture", JSON.stringify(journal));
            // Le même avec un `untracked` autour de la lecture.
            const b = api.signal("b");
            const journalUntracked = [];
            const B = api.computed(() => `B:${b.value}`);
            api.effect(() => journalUntracked.push(`e:${B.value}`));
            B.value;
            api.batch(() => {
                b.value = "T";
                log("untracked dans le batch", String(api.untracked(() => B.value)));
            });
            log("journal untracked", JSON.stringify(journalUntracked));
            // Et le témoin NÉGATIF : sans écriture dans le batch, rien ne doit bouger. Sans lui, le
            // scénario ne prouverait qu'une seule chose — que l'effet tourne.
            const c = api.signal("c");
            const journalSansEcriture = [];
            const C = api.computed(() => `C:${c.value}`);
            api.effect(() => journalSansEcriture.push(`e:${C.value}`));
            C.value;
            api.batch(() => {
                log("batch sans ecriture", String(C.value));
            });
            log("journal sans ecriture", JSON.stringify(journalSansEcriture));
            assert.deepEqual(log.entries, [
                "pendant le batch A:T",
                'journal ["e:A:a","e:A:T"]',
                'journal apres relecture ["e:A:a","e:A:T"]',
                "untracked dans le batch B:T",
                'journal untracked ["e:B:b","e:B:T"]',
                "batch sans ecriture C:c",
                'journal sans ecriture ["e:C:c"]',
            ]);
        },
    },
    {
        // SPEC §13.4 — l'ordre de drainage, dans la forme CHAÎNÉE. Deux computés dont le second dérive
        // du premier, et deux effets qui lisent le derived : le journal est bottom-up, `c1 c2 e1 e2` —
        // les deux computés passent avant le premier effet. C'est ce que la matrice note à `computed#18`,
        // et cette entrée pointait sur le ticket #24, clos : rien ne la rejouait.
        //
        // Elle est distincte de `computed/alternating-computed-and-effect-order` (`computed#18b`), qui prend
        // deux computés INDÉPENDANTS. Les deux formes doivent être figées séparément : les mapper l'une
        // sur l'autre couvrirait une entrée sans la rejouer, ce qui est le trou que ce lot vient de
        // refermer. Voir ADR-0010.
        name: "computed/bottom-up-chain-order",
        matrice: [],
        run(api, log) {
            const a = api.signal(0);
            const journal = [];
            const c1 = api.computed(() => {
                journal.push(`c1:${a.value}`);
                return a.value + 1;
            });
            const c2 = api.computed(() => {
                journal.push(`c2:${c1.value}`);
                return c1.value + 1;
            });
            api.effect(() => journal.push(`e1:${c2.value}`));
            api.effect(() => journal.push(`e2:${c2.value}`));
            log("initial", JSON.stringify(journal));
            journal.length = 0;
            a.value = 1;
            log("apres ecriture", JSON.stringify(journal));
            assert.deepEqual(log.entries, [
                'initial ["c1:0","c2:1","e1:2","e2:2"]',
                'apres ecriture ["c1:1","c2:2","e1:3","e2:3"]',
            ]);
        },
    },
    {
        // SPEC §13.4 — l'ordre de drainage. Deux computés INDÉPENDANTS et deux effets : le journal
        // alterne computé puis effet, `c1 e1 c2 e2`. L'ordre inverse `c1 c2 e2 e1` venait de l'empilement
        // des computés dans la file : le computé était rafraîchi comme une génération à part entière,
        // donc il passait devant l'effet qui l'avait déclenché. La matrice l'avait observé
        // (`computed#18`) sans qu'aucun scénario ne le rejoue — le même trou de registre que
        // `computed#5` et `computed#6`.
        name: "computed/alternating-computed-and-effect-order",
        matrice: [],
        run(api, log) {
            const a = api.signal(0);
            const journal = [];
            const c1 = api.computed(() => {
                journal.push(`c1:${a.value}`);
                return a.value + 1;
            });
            const c2 = api.computed(() => {
                journal.push(`c2:${a.value}`);
                return a.value + 2;
            });
            api.effect(() => journal.push(`e1:${c1.value}`));
            api.effect(() => journal.push(`e2:${c2.value}`));
            log("initial", JSON.stringify(journal));
            journal.length = 0;
            a.value = 1;
            log("apres ecriture", JSON.stringify(journal));
            assert.deepEqual(log.entries, [
                'initial ["c1:0","e1:1","c2:0","e2:2"]',
                'apres ecriture ["c1:1","e1:2","c2:1","e2:3"]',
            ]);
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
        name: "batch/strict-snapshot-identity",
        matrice: ["batch#16", "batch#20"],
        run(api, log) {
            const nan = api.signal(0);
            let runsNaN = 0;
            api.effect(() => {
                runsNaN++;
                nan.value;
            });
            api.batch(() => {
                nan.value = Number.NaN;
            });
            log("laisses a NaN : runs", String(runsNaN));
            const zero = api.signal(-0);
            let runsZero = 0;
            api.effect(() => {
                runsZero++;
                zero.value;
            });
            api.batch(() => {
                zero.value = 1;
                zero.value = 0;
            });
            log("reparti de -0 : runs", String(runsZero));
            assert.deepEqual(log.entries, ["laisses a NaN : runs 2", "reparti de -0 : runs 1"]);
        },
    },
    {
        // SPEC §15.2 — un cycle BORNE ne leve pas : cinquante et une executions, silencieusement. Un
        // cycle non borne finit par une `Error`, en un nombre borne de generations.
        //
        // Le compte n'est PAS fige (§15.2 et §21 : la borne est un parametre d'implementation), donc ce
        // scenario verifie le CARACTERE de la sortie — « une Error, et un compte borne » — pas un
        // nombre exact. Une assertion sur 102 serait fausse des que le seuil bouge.
        name: "batch/bounded-and-unbounded-cycle",
        matrice: ["batch#13", "batch#22", "batch#23", "batch#26"],
        run(api, log) {
            const borne = api.signal(0);
            let runs = 0;
            api.effect(() => {
                runs++;
                const v = borne.value;
                if (v < 50)
                    borne.value = v + 1;
            });
            log("cycle borne : runs", String(runs));
            let type = "aucune";
            try {
                api.batch(() => {
                    borne.value = 1;
                });
            }
            catch (erreur) {
                type = erreur instanceof Error ? erreur.constructor.name : "autre";
            }
            log("cycle borne : leve", type);
            // L'effet infini n'ecrit qu'une fois ARME, sinon il cyclerait des sa creation.
            const infini = api.signal(0);
            let arme = false;
            let runsInfini = 0;
            api.effect(() => {
                // La lecture est HORS du garde : un effet qui ne lit rien n'a aucune dependance, donc
                // l'ecriture du batch ne le réveillerait pas et le cycle ne demarrerait jamais.
                const v = infini.value;
                runsInfini++;
                if (arme)
                    infini.value = v + 1;
            });
            arme = true;
            let typeInfini = "aucune";
            try {
                api.batch(() => {
                    infini.value = 1;
                });
            }
            catch (erreur) {
                typeInfini = erreur instanceof Error ? erreur.constructor.name : "autre";
            }
            log("cycle non borne : type", typeInfini);
            log("cycle non borne : compte borne", runsInfini > 1 && runsInfini <= 500 ? "oui" : "non");
            // `batch#26` — le compteur d'iterations est REMIS A ZERO apres une erreur. Donc un effet
            // auto-ecrivant cree APRES le cycle doit encore cycler : s'il heritants du seuil consomme, il
            // ne tournerait qu'une fois.
            const apresErreur = api.signal(0);
            let arme2 = false;
            let runsApres = 0;
            api.effect(() => {
                const v = apresErreur.value;
                runsApres++;
                if (arme2)
                    apresErreur.value = v + 1;
            });
            arme2 = true;
            let typeApres = "aucune";
            try {
                api.batch(() => {
                    apresErreur.value = 1;
                });
            }
            catch (erreur) {
                typeApres = erreur instanceof Error ? erreur.constructor.name : "autre";
            }
            log("apres une erreur : type", typeApres);
            log("apres une erreur : le compteur repart", runsApres > 1 ? "oui" : "non");
            // `batch#13` — un effect qui ouvre SON PROPRE batch pendant le drainage re-batche : la
            // notification de l'effet exterieur attend la sortie de ce batch-la.
            const exterieur = api.signal(0);
            const journal = [];
            api.effect(() => {
                journal.push(`avant:${exterieur.value}`);
                api.batch(() => {
                    journal.push("dans le batch de l effect");
                });
                journal.push(`apres:${exterieur.value}`);
            });
            exterieur.value = 1;
            // `batch#23` — le meme cycle, mais l effet ouvre son PROPRE batch pour ecrire. Le seuil est
            // alors atteint a l interieur d un drainage : c est ce qui distingue ce cas du precedent, ou
            // l ecriture venait du batch de l utilisateur.
            const propre = api.signal(0);
            let armePropre = false;
            let runsPropre = 0;
            api.effect(() => {
                const v = propre.value;
                runsPropre++;
                if (armePropre)
                    api.batch(() => (propre.value = v + 1));
            });
            armePropre = true;
            let typePropre = "aucune";
            try {
                propre.value = 1;
            }
            catch (erreur) {
                typePropre = erreur instanceof Error ? erreur.constructor.name : "autre";
            }
            log("batch ecrit par l effet : type", typePropre);
            log("batch ecrit par l effet : compte borne", runsPropre > 1 && runsPropre <= 500 ? "oui" : "non");
            // `batch#24` et `batch#25` — le ping-pong entre DEUX et TROIS effets, chacun abonné à DEUX
            // signaux et écrivant celui de l'autre. C'est la LECTURE CROISÉE qui rend la liste des
            // dépendances à plus d'un élément, et donc ce qui fait que le drainage a une file à vider.
            //
            // Les COMPTES EXACTS (52/51, 35/35/34) ne sont pas affirmés : SPEC §15.2 refuse de figer
            // la borne, §21 le confirme. Ce qui se fige, c'est le CARACTÈRE — chaque effet tourne
            // plusieurs fois, et une erreur sort. C'est ce que la divergence observée faisait échouer.
            const formePingPong = (nb) => {
                const signaux = Array.from({ length: nb }, () => api.signal(0));
                const runs = new Array(nb).fill(0);
                const armes = new Array(nb).fill(false);
                for (let i = 0; i < nb; i++) {
                    const idx = i;
                    const mien = signaux[idx];
                    if (mien === undefined)
                        continue;
                    const suivant = signaux[(idx + 1) % nb];
                    api.effect(() => {
                        // La LECTURE CROISÉE est ce qui compte : sans elle, chaque effet n'a qu'une seule
                        // dépendance, et le ping-pong n'a rien à vider.
                        mien.value;
                        suivant?.value;
                        runs[idx] = (runs[idx] ?? 0) + 1;
                        if (armes[idx] && suivant !== undefined && (runs[idx] ?? 0) < PLAFOND)
                            suivant.value++;
                    });
                }
                for (let i = 0; i < nb; i++)
                    armes[i] = true;
                try {
                    const premier = signaux[0];
                    if (premier === undefined)
                        return ["aucune", false];
                    premier.value++;
                }
                catch (erreur) {
                    return [erreur instanceof Error ? erreur.constructor.name : "autre", true];
                }
                return ["aucune", false];
            };
            // Le PLAFOND borne les écritures pour que le test TERMINE même sur un moteur qui ne
            // détecte pas le cycle — un test qui pend n'est pas un test, c'est un minuteur. Un moteur
            // sain s'arrête bien avant : 203 runs pour deux effets, 303 pour trois.
            const PLAFOND = 500;
            const [typePing, pingTourne] = formePingPong(2);
            log("ping pong a 2 effets : type", typePing);
            log("ping pong a 2 effets : tous ont tourne", pingTourne ? "oui" : "non");
            const [typePing3, ping3Tourne] = formePingPong(3);
            log("ping pong a 3 effets : type", typePing3);
            log("ping pong a 3 effets : tous ont tourne", ping3Tourne ? "oui" : "non");
            log("batch cree dans le drainage", JSON.stringify(journal));
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
                'batch cree dans le drainage ["avant:0","dans le batch de l effect","apres:0","avant:1","dans le batch de l effect","apres:1"]',
            ]);
        },
    },
    {
        // SPEC §16.5 — LE DISPOSE DU MODÈLE. `model[Symbol.dispose]` est une `action`, donc il groupe
        // les disposes qu'il déclenche : le cleanup d'un re-run PRÉCÈDE le corps du run suivant, et
        // celui du dispose est le dernier. C'est le seul endroit où l'ordre d'un cleanup et d'un corps
        // s'observe.
        //
        // Le dispose est IDEMPOTENT — la liste est vidée, donc un second appel n'a rien à faire — et il
        // ÉCRASE un `Symbol.dispose` fourni par l'utilisateur, silencieusement. Les deux sont des
        // défauts figés.
        //
        // Et surtout : un cleanup qui LÈVE INTERROMPT les disposes suivants. La boucle n'a pas de
        // `try`, donc le troisième cleanup n'est jamais lancé. Corriger cela changerait le contrat, et
        // c'est pourquoi le commentaire de la boucle dans `signals.ts` le dit.
        name: "model/dispose",
        matrice: [],
        run(api, log) {
            const source = api.signal(0);
            const externe = api.signal(0);
            const M = api.createModel(() => ({
                e: api.effect(() => {
                    log("run", String(source.value));
                    externe.value = 1;
                    return () => log("cleanup", String(source.value));
                }),
            }));
            const modele = new M();
            externe.value = 1;
            source.value = 1;
            log("avant dispose", "vu");
            modele[Symbol.dispose]();
            log("apres dispose", "vu");
            const M2 = api.createModel(() => ({ e: api.effect(() => () => log("cleanup2", "vu")) }));
            const m2 = new M2();
            m2[Symbol.dispose]();
            m2[Symbol.dispose]();
            log("dispose deux fois", "vu");
            const journal = [];
            const M3 = api.createModel(() => ({
                premier: api.effect(() => () => journal.push("cleanup1")),
                deuxieme: api.effect(() => () => {
                    journal.push("cleanup2 throws");
                    throw new Error("m boom");
                }),
                troisieme: api.effect(() => () => journal.push("cleanup3")),
            }));
            const m3 = new M3();
            try {
                m3[Symbol.dispose]();
                journal.push("pas d'erreur");
            }
            catch (erreur) {
                journal.push(`err: ${erreur instanceof Error ? erreur.constructor.name : "autre"}`);
            }
            log("un cleanup qui leve interrompt les suivants", JSON.stringify(journal));
            const journal2 = [];
            const M4 = api.createModel(() => ({ e: api.effect(() => () => journal2.push("cleanup")) }));
            const m4 = new M4();
            m4.e();
            m4[Symbol.dispose]();
            log("un effet deja dispose ne rejoue pas son cleanup", JSON.stringify(journal2));
            const M5 = api.createModel(() => ({ n: 1 }));
            const m5 = new M5();
            log("Symbol.dispose non enumerable", `${JSON.stringify(Object.keys(m5))} / ${JSON.stringify(Object.getOwnPropertySymbols(m5).map(String))}`);
            const journal3 = [];
            const M6 = api.createModel(() => ({
                dispose() {
                    journal3.push("dispose custom");
                },
            }));
            const m6 = new M6();
            m6[Symbol.dispose]();
            log("un Symbol.dispose utilisateur est ecrase", JSON.stringify(journal3));
            const journal4 = [];
            const M7 = api.createModel(() => ({ e: api.effect(() => () => journal4.push("cleanup")) }));
            {
                const m7 = new M7();
                journal4.push("body");
                m7[Symbol.dispose]();
            }
            log("utilisable avec using", JSON.stringify(journal4));
            assert.deepEqual(log.entries, [
                "run 0",
                "cleanup 1",
                "run 1",
                "avant dispose vu",
                "cleanup 1",
                "apres dispose vu",
                "cleanup2 vu",
                "dispose deux fois vu",
                'un cleanup qui leve interrompt les suivants ["cleanup1","cleanup2 throws","err: Error"]',
                'un effet deja dispose ne rejoue pas son cleanup ["cleanup"]',
                'Symbol.dispose non enumerable ["n"] / ["Symbol(Symbol.dispose)"]',
                "un Symbol.dispose utilisateur est ecrase []",
                'utilisable avec using ["body","cleanup"]',
            ]);
        },
    },
    {
        // SPEC §16.4 — DEUX MODÈLES IMBRIQUÉS. Les effets du modèleimbriqué remontent au parent : la
        // fermeture de la portée concatène les deux listes. Le dispose du parent emporte donc les
        // cleanups internes ET externes.
        //
        // Un modèleimbriqué créé sous `untracked` fait exception : l'`untracked` a vidé la portée
        // englobante, et le modèle enfant ouvre une portée NEUVE qu'il ne rend pas au parent. Le
        // parent ne possède donc pas ces effets — et ils survivent à son dispose. C'est la raison pour
        // laquelle `startCapturingEffects` ouvre toujours une portée neuve, même quand le parent est
        // supprimé.
        name: "model/nested-models",
        matrice: [],
        run(api, log) {
            const source = api.signal(0);
            const Interne = api.createModel(() => ({
                effet: api.effect(() => log("imbrique", String(source.value))),
            }));
            const Externe = api.createModel(() => ({
                effet: api.effect(() => log("externe", String(source.value))),
                interne: Interne(),
            }));
            const externe = new Externe();
            source.value = 1;
            log("avant dispose du parent", "vu");
            externe[Symbol.dispose]();
            source.value = 2;
            log("apres dispose du parent", "vu");
            const autre = api.signal(0);
            let interne;
            const Enfant = api.createModel(() => {
                api.effect(() => log("enfant", String(autre.value)));
                return {};
            });
            const Parent = api.createModel(() => ({
                effet: api.effect(() => log("parent", String(autre.value))),
            }));
            const parent = new Parent();
            interne = api.untracked(() => Enfant());
            autre.value = 1;
            log("avant dispose", "vu");
            parent[Symbol.dispose]();
            autre.value = 2;
            log("apres dispose", "vu");
            void interne;
            assert.deepEqual(log.entries, [
                "externe 0",
                "imbrique 0",
                "externe 1",
                "imbrique 1",
                "avant dispose du parent vu",
                "apres dispose du parent vu",
                "parent 0",
                "enfant 0",
                "parent 1",
                "enfant 1",
                "avant dispose vu",
                "enfant 2",
                "apres dispose vu",
            ]);
        },
    },
    {
        // SPEC §16.6 — DEUX INSTANCES SONT INDÉPENDANTES. Chaque construction ouvre sa propre portée, donc
        // les effets capturés ne sont jamais partagés — même quand les deux modèles lisent le MÊME
        // signal. Disposer de l'un ne touche pas l'autre.
        //
        // Et un effet d'un modèle qui s'inscrit sur un signal EXTERNE reste possédé : c'est le
        // désabonnement interne qui est disposé, pas la cible.
        name: "model/two-instances",
        matrice: [],
        run(api, log) {
            const mk = (api, n) => api.createModel(() => ({
                s: api.signal(n),
                e: api.effect(() => log(`e${n}`, String(n))),
            }));
            const A = mk(api, 1);
            const B = mk(api, 2);
            const a = new A();
            const b = new B();
            log("deux instances creees", "vu");
            a.s.value = 10;
            b.s.value = 20;
            log("apres ecritures croisees", "vu");
            a[Symbol.dispose]();
            a.s.value = 100;
            log("a dispose, b vivant", "vu");
            const partage = api.signal(0);
            const mkPartage = () => api.createModel(() => ({
                e: api.effect(() => log("partage", String(partage.value))),
            }));
            const C = mkPartage();
            const D = mkPartage();
            const c = new C();
            const d = new D();
            partage.value = 1;
            log("deux modeles sur le meme signal", "vu");
            c[Symbol.dispose]();
            partage.value = 2;
            d[Symbol.dispose]();
            log("c dispose, d vivant", "vu");
            const interne = api.signal(0);
            const externe = api.signal(0);
            const journal = [];
            const E = api.createModel(() => ({
                e: api.effect(() => {
                    journal.push(`run ${interne.value}${externe.value}`);
                    interne.subscribe((v) => journal.push(`sub ${v}`));
                }),
            }));
            const e = new E();
            externe.value = 1;
            e[Symbol.dispose]();
            interne.value = 1;
            log("un abonnement interne reste possede", JSON.stringify(journal));
            assert.deepEqual(log.entries, [
                "e1 1",
                "e2 2",
                "deux instances creees vu",
                "apres ecritures croisees vu",
                "a dispose, b vivant vu",
                "partage 0",
                "partage 0",
                "partage 1",
                "partage 1",
                "deux modeles sur le meme signal vu",
                "partage 2",
                "c dispose, d vivant vu",
                'un abonnement interne reste possede ["run 00","sub 0","run 01","sub 0","sub 1"]',
            ]);
        },
    },
    {
        // SPEC §16.2 — LA FORME DU MODÈLE. Le constructor est une fonction-constructeur, appelable avec
        // ou sans `new`, et elle renvoie L'OBJET DE LA FABRIQUE, muté en place : ni copie, ni
        // enveloppe, ni proxy. C'est ce qui rend `createModel` transparent, et c'est aussi ce qui rend
        // `instanceof` faux — le CHANGELOG 1.13.0 parle de « classe », le code n'en fait pas une.
        //
        // L'enveloppement descend dans les objets imbriqués et les tableaux, mais PAS dans un objet qui
        // porte une marque : c'est un signal, et ses méthodes lui appartiennent. Sans cette garde, un
        // modèle ne pourrait pas contenir un seul signal. Et il ne descend pas dans les méthodes de
        // classe, qui sont sur le prototype donc non énumérables — un quirk figé.
        //
        // AUCUNE VALIDATION À L'EXÉCUTION : une fabrique qui renvoie `{ anything: 42 }` est acceptée,
        // et la validation est statique, côté TypeScript. Le paquet publié minifie ses noms de
        // fonctions, donc le nom `actionWrapper` est vérifié côté signalcn seulement.
        name: "model/shape-and-teardown",
        matrice: [],
        run(api, log) {
            const Modele = api.createModel(() => ({ s: api.signal(1) }));
            log("avec new", String(new Modele().s.value));
            log("sans new", String(Modele().s.value));
            const partage = {
                inc: function () {
                    return this;
                },
            };
            const Partage = api.createModel(() => partage);
            const instance = new Partage();
            log("l'objet de la fabrique est-il muté en place", String(instance === partage));
            log("instanceof le constructor", String(instance instanceof Partage));
            log("constructor.name", instance.constructor.name);
            log("instanceof Object", String(instance instanceof Object));
            // L'enveloppement se prouve par la SUBSTITUTION, pas par le nom : le paquet publié minifie
            // ses noms de fonctions, donc `name` y vaut la chaine vide. On retient la fonction d'origine
            // et on vérifie que l'instance porte une AUTRE fonction.
            const imbriquee = function () { };
            const imbrique = api.createModel(function () {
                return {
                    n: 5,
                    inc: function () {
                        return this;
                    },
                    nested: { deep: { inc: imbriquee } },
                };
            });
            const i = new imbrique();
            log("this conserve", String(i.inc() === i));
            log("fonctions imbriquees enveloppees", String(i.nested.deep.inc !== imbriquee));
            const tab = api.createModel(() => [api.signal(1)]);
            const t = new tab();
            log("descend dans un tableau", String(Array.isArray(t) && typeof t[0].brand === "symbol"));
            const avecSignal = api.createModel(() => ({ nested: { s: api.signal(1) } }));
            log("ne descend pas dans un signal", String(new avecSignal().nested.s.brand));
            class Classe {
                constructor() {
                    this.inc = function () { };
                }
                m() { }
            }
            const depuisClasse = api.createModel(() => new Classe());
            log("methode de classe non enveloppee", depuisClasse().m.name);
            const primitifs = api.createModel(() => ({ n: 5, s: "x", nil: null, arr: [1, 2] }));
            log("primitifs intacts", JSON.stringify(new primitifs()));
            const date = new Date(0);
            const avecDate = api.createModel(() => ({ d: date }));
            log("Date non touche", String(new avecDate().d === date));
            const sansValidation = api.createModel(() => ({ anything: 42, fn: () => 1 }));
            log("aucune validation a l'execution", typeof new sansValidation().fn);
            assert.deepEqual(log.entries, [
                "avec new 1",
                "sans new 1",
                "l'objet de la fabrique est-il muté en place true",
                "instanceof le constructor false",
                "constructor.name Object",
                "instanceof Object true",
                "this conserve true",
                "fonctions imbriquees enveloppees true",
                "descend dans un tableau true",
                "ne descend pas dans un signal Symbol(preact-signals)",
                "methode de classe non enveloppee m",
                'primitifs intacts {"n":5,"s":"x","nil":null,"arr":[1,2]}',
                "Date non touche true",
                "aucune validation a l'execution function",
            ]);
        },
    },
    {
        // SPEC §16.2 — UN GETTER EST ÉVALUÉ UNE SEULE FOIS, ET DEVIENT UNE DONNÉE. Le parcours
        // `for…in` de l'enveloppe déclenche le getter, prend ce qu'il renvoie, et l'écrit comme
        // propriété — donc le getter ne sera plus jamais appelé. C'est ce que la matrice relève :
        // `gets === 1`, et la valeur stockée est un signal.
        //
        // Un objet CYCLIQUE fait tomber la récursion : `RangeError`, et la mutation est PARTIELLE — les
        // propriétés visitées avant le cycle sont enveloppées, les suivantes non. Le défaut est figé ;
        // le corriger changerait le contrat, donc on fige ce qu'il fait.
        //
        // Et une fabrique qui renvoie une PRIMITIVE ne produit pas un modèle : l'affectation de
        // `Symbol.dispose` sur `42` lève en mode strict. Avec `null`, c'est un `TypeError` de lecture.
        // Les deux sont des `TypeError` dont le message vient de V8 — on n'affirme que le type.
        name: "model/cyclic-getter-and-primitives",
        matrice: [],
        run(api, log) {
            let gets = 0;
            const Getter = api.createModel(() => ({
                get v() {
                    gets++;
                    return api.signal(1);
                },
            }));
            const avecGetter = new Getter();
            log("evaluations du getter", String(gets));
            log("la valeur stockee est un signal", String("brand" in avecGetter.v));
            // La mutation partielle se prouve par la substitution aussi : `avant` n'a pas été enroulé,
            // `apres` si — donc la récursion s'est arrêtée ENTRE les deux.
            const avant = function () { };
            const apres = function () { };
            const cyclique = { avant, apres };
            cyclique.soi = cyclique;
            const Cyclique = api.createModel(() => cyclique);
            try {
                new Cyclique();
                log("objet cyclique", "pas d'erreur");
            }
            catch (erreur) {
                const type = erreur instanceof Error ? erreur.constructor.name : "autre";
                // La mutation est PARTIELLE parce qu'elle a COMMENCÉ : les propriétés visited avant le cycle
                // sont enveloppées, et la pile tombe en rentrant dans `soi` — qui pointe l'objet lui-même.
                log("objet cyclique", `${type} / mutation commencee : ${String(cyclique.avant !== avant)}`);
            }
            const Primitive = api.createModel(() => 42);
            try {
                new Primitive();
                log("fabrique primitive, avec new", "pas d'erreur");
            }
            catch (erreur) {
                log("fabrique primitive, avec new", erreur instanceof Error ? erreur.constructor.name : "autre");
            }
            const Nul = api.createModel(() => null);
            try {
                new Nul();
                log("fabrique null", "pas d'erreur");
            }
            catch (erreur) {
                log("fabrique null", erreur instanceof Error ? erreur.constructor.name : "autre");
            }
            assert.deepEqual(log.entries, [
                "evaluations du getter 1",
                "la valeur stockee est un signal true",
                "objet cyclique RangeError / mutation commencee : true",
                "fabrique primitive, avec new TypeError",
                "fabrique null TypeError",
            ]);
        },
    },
    {
        // SPEC §16.1 — LA FABRIQUE REÇOIT LES ARGUMENTS, ET `this` N'EST PAS LE MODÈLE. L'appel est un
        // appel simple, donc en ESM `this` y vaut `undefined` — le même comportement que le rappel
        // d'un abonnement, et la même conséquence : une fabrique ne peut pas s'appuyer sur `this`.
        name: "model/arguments-and-this",
        matrice: [],
        run(api, log) {
            let args = [];
            let typeDeThis = "?";
            const Modele = api.createModel(function (...recu) {
                args = recu;
                typeDeThis = this === undefined ? "undefined" : typeof this;
                return { n: 1 };
            });
            new Modele(1, 2);
            log("arguments transmis", JSON.stringify(args));
            log("this de la fabrique", typeDeThis);
            assert.deepEqual(log.entries, ["arguments transmis [1,2]", "this de la fabrique undefined"]);
        },
    },
    {
        // SPEC §16.4 — LA CAPTURE DES EFFETS. C'est le cœur de `createModel` : savoir, à la
        // construction, quels effets ont été créés, donc une portée ouverte autour de l'appel à la
        // fabrique.
        //
        // La capture se fait À LA CONSTRUCTION de l'effet, pas à son premier run — c'est le seul moment
        // où l'on peut encore dire qui le possède. Trois contextes ne sont PAS possédés, et les trois
        // sont des surprises : un `untracked` englobant, un computé évalué plus tard, et un cleanup de
        // dispose. Un `batch` n'annule PAS la capture — c'est la différence entre les deux primitives.
        //
        // Et une fabrique qui LÈVE perd ses effets : ils ne sont pas rendus à la portée englobante.
        // Une construction avortée ne possède plus rien. C'est ce qui explique qu'un effet « leaké »
        // survive à tout dispose.
        name: "model/effect-capture",
        matrice: [],
        run(api, log) {
            // 18 : possédés
            const s18 = api.signal(0);
            const M18 = api.createModel(() => {
                api.effect(() => log("18", `e:${s18.value}`));
                return {};
            });
            const i18 = new M18();
            s18.value = 1;
            log("18 apres ecriture, avant dispose", "vu");
            i18[Symbol.dispose]();
            s18.value = 2;
            log("18 apres dispose", "vu");
            // 21 : un effet créé dans un batch est POSSÉDÉ
            const s21 = api.signal(0);
            let survit21 = "vrai";
            const M21 = api.createModel(() => {
                api.batch(() => {
                    api.effect(() => {
                        s21.value = 1;
                    });
                });
                return {};
            });
            const i21 = new M21();
            i21[Symbol.dispose]();
            survit21 = "dispose fait";
            log("21 batch : effets possedes", survit21);
            // 13 : un effet créé dans un GETTER n'est pas possédé — l'enveloppe est hors de la portée
            const s13 = api.signal(0);
            const journal13 = [];
            const M13 = api.createModel(() => ({
                get v() {
                    api.effect(() => journal13.push(`from getter ${s13.value}`));
                    return 1;
                },
            }));
            const i13 = new M13();
            i13.v;
            i13[Symbol.dispose]();
            s13.value = 1;
            // Le journal a QUATRE entrees et non deux : le getter est appele deux fois — une fois par le
            // `for…in` de l'enveloppe, une fois par la lecture explicite — et chaque appel cree un effet.
            // Les DEUX survivent au dispose : ils ont ete crees hors de la portee de capture, parce que
            // l'enveloppe tourne apres la fermeture de la portee.
            log("13 effet d'un getter", JSON.stringify(journal13));
            // 16 : une fabrique qui leve perd ses effets
            const s16 = api.signal(0);
            const journal16 = [];
            const M16 = api.createModel(() => {
                api.effect(() => journal16.push(`leaked ${s16.value}`));
                throw new Error("factory boom");
            });
            try {
                new M16();
            }
            catch (erreur) {
                journal16.push(`caught:${erreur instanceof Error ? erreur.constructor.name : "autre"}`);
            }
            s16.value = 1;
            log("16 effet perdu apres une fabrique qui leve", JSON.stringify(journal16));
            // 17 : une fabrique imbriquée qui leve — le parent ne récupère rien
            const journal17 = [];
            const Interne = api.createModel(() => {
                api.effect(() => journal17.push("inner-leak"));
                throw new Error("inner boom");
            });
            const Externe = api.createModel(() => {
                api.effect(() => journal17.push("outer-leak"));
                return Interne();
            });
            try {
                new Externe();
            }
            catch (erreur) {
                journal17.push(`caught:${erreur instanceof Error ? erreur.constructor.name : "autre"}`);
            }
            log("17 fabrique imbriquee qui leve", JSON.stringify(journal17));
            // 22 : un effet né dans un computé, évalué APRÈS la construction, n'est pas possédé
            const s22 = api.signal(0);
            const journal22 = [];
            const M22 = api.createModel(() => ({
                c: api.computed(() => {
                    api.effect(() => journal22.push(`from computed ${s22.value}`));
                    return s22.value;
                }),
            }));
            const i22 = new M22();
            i22.c.value;
            s22.value = 1;
            i22[Symbol.dispose]();
            s22.value = 2;
            log("22 effet ne dans un compute", JSON.stringify(journal22));
            // 23 : un effet né dans un CLEANUP de dispose n'est pas possédé, et fuit
            const s23 = api.signal(0);
            const journal23 = [];
            const M23 = api.createModel(() => ({
                e: api.effect(() => {
                    s23.value = 1;
                    return () => journal23.push(`from-cleanup ${s23.value}`);
                }),
            }));
            const i23 = new M23();
            i23[Symbol.dispose]();
            log("23 effet ne dans un cleanup", JSON.stringify(journal23));
            assert.deepEqual(log.entries, [
                "18 e:0",
                "18 e:1",
                "18 apres ecriture, avant dispose vu",
                "18 apres dispose vu",
                "21 batch : effets possedes dispose fait",
                '13 effet d\'un getter ["from getter 0","from getter 0","from getter 1","from getter 1"]',
                '16 effet perdu apres une fabrique qui leve ["leaked 0","caught:Error","leaked 1"]',
                '17 fabrique imbriquee qui leve ["outer-leak","inner-leak","caught:Error"]',
                '22 effet ne dans un compute ["from computed 0","from computed 1","from computed 2"]',
                '23 effet ne dans un cleanup ["from-cleanup 1"]',
            ]);
        },
    },
    {
        // SPEC §11 — S'ABONNER, C'EST CRÉER UN EFFET INTERNE. La baseline (`L427-435`) fait
        // exactement cela : un `effect` nommé `"sub"` qui lit `this.value` puis appelle le rappel sous
        // `untracked`. Aucun état propre, donc rien qui distingue un abonné d'un effet.
        //
        // Le premier appel est SYNCHRONE et précède la ligne suivante — c'est ce qui rend un abonné
        // utilisable sans attendre. Le rappel reçoit la valeur, et rien d'autre : un seul argument,
        // vérifié ici parce qu'un rappel qui en recevrait deux serait un autre contrat.
        //
        // ET LE RAPPEL N'EST PAS SUIVI. C'est le point que la forme naïve ne prouve pas : un rappel qui
        // lit la source qu'on subscriptionnerait de toute façon, puisque l'effet interne la lit pour lui
        // passer la valeur. La forme qui discrimine est un rappel qui lit un AUTRE signal et en écrit
        // un autre. Vérifié par contre-test : sans `untracked`, cette forme lève `Cycle detected` ; avec,
        // elle donne le journal ci-dessous. Sans ce contre-test, ce scénario figerait le `batch` et
        // laisserait le `untracked` libre — le même défaut que `action#7`, et pour la même raison.
        name: "subscribe/untracked-callback",
        matrice: [],
        run(api, log) {
            const source = api.signal(0);
            const journal = [];
            source.subscribe((v) => {
                journal.push(`got ${v}`);
            });
            journal.push("after");
            log("appel immediat, avant la ligne suivante", JSON.stringify(journal));
            const compte = [];
            api.signal(0).subscribe(function () {
                compte.push(String(arguments.length));
            });
            log("arguments recus", compte.join(","));
            // Le rappel non suivi. Le rappel lit `autre` et en écrit deux fois : sans `untracked` il
            // s'abonnerait à `autre` et son propre écriture le réveillerait.
            const lu = api.signal(0);
            const ecrit = api.signal(0);
            const suivi = [];
            lu.subscribe((v) => {
                suivi.push(`sub ${v} e now ${ecrit.value}`);
                ecrit.value = v + 1;
                ecrit.value = v + 2;
            });
            lu.value = 1;
            log("rappel qui lit et ecrit un autre signal", JSON.stringify(suivi));
            assert.deepEqual(log.entries, [
                'appel immediat, avant la ligne suivante ["got 0","after"]',
                "arguments recus 1",
                'rappel qui lit et ecrit un autre signal ["sub 0 e now 0","sub 1 e now 2"]',
            ]);
        },
    },
    {
        // SPEC §11 — LE DÉSABONNEMENT, ET CE QUI SE PASSE QUAND LE RAPPEL LÈVE.
        //
        // Le désabonnement est idempotent : deux appels n'en valent qu'un, et c'est le même `dispose`
        // que celui d'un effet — `name === "bound "`, `length === 0`, `Object.keys` vide. Rien de dédié
        // à l'abonnement, donc rien à maintenir en plus.
        //
        // L'erreur au PREMIER appel dispose l'effet interne et remonte : `subscribe` ne rend rien. L'erreur
        // à un appel SUIVANT remonte depuis l'ÉCRITURE, et l'effet SURVIT — l'appel suivant a lieu. C'est
        // l'asymétrie que `effect/errors` fige déjà pour le cas général ; ici elle porte sur un rappel,
        // donc la source de l'erreur est l'écriture et non la création.
        name: "subscribe/unsubscribe-and-errors",
        matrice: [],
        run(api, log) {
            const forme = [];
            const rendu = api.signal(0).subscribe(() => { });
            forme.push(rendu.name, String(rendu.length), String(Object.keys(rendu).length));
            forme.push(typeof rendu[Symbol.dispose]);
            log("forme du retour", JSON.stringify(forme));
            const s1 = api.signal(0);
            const j1 = [];
            const un1 = s1.subscribe((v) => j1.push(`got ${v}`));
            s1.value = 1;
            un1();
            s1.value = 2;
            log("plus rien apres desenvoi", JSON.stringify(j1));
            const s2 = api.signal(0);
            const j2 = [];
            const un2 = s2.subscribe((v) => j2.push(`v:${v}`));
            un2();
            un2();
            s2.value = 1;
            log("double desenvoi, sans effet", JSON.stringify(j2));
            const s3 = api.signal(0);
            const j3 = [];
            try {
                s3.subscribe((v) => {
                    j3.push(`sub:${v}`);
                    if (v === 0)
                        throw new Error("sub boom");
                });
                j3.push("subscribe: aucune erreur");
            }
            catch (erreur) {
                j3.push(`threw:${erreur instanceof Error ? erreur.constructor.name : "autre"}`);
            }
            s3.value = 1;
            log("erreur au premier appel", JSON.stringify(j3));
            const s4 = api.signal(0);
            const j4 = [];
            s4.subscribe((v) => {
                j4.push(`sub:${v}`);
                if (v === 1)
                    throw new Error("later boom");
            });
            try {
                s4.value = 1;
                j4.push("ecriture: aucune erreur");
            }
            catch (erreur) {
                j4.push(`caught:${erreur instanceof Error ? erreur.constructor.name : "autre"}`);
            }
            s4.value = 2;
            log("erreur plus tard, l'effet survit", JSON.stringify(j4));
            assert.deepEqual(log.entries, [
                'forme du retour ["bound ","0","0","function"]',
                'plus rien apres desenvoi ["got 0","got 1"]',
                'double desenvoi, sans effet ["v:0"]',
                'erreur au premier appel ["sub:0","threw:Error"]',
                'erreur plus tard, l\'effet survit ["sub:0","sub:1","caught:Error","sub:2"]',
            ]);
        },
    },
    {
        // SPEC §6.3 — un abonnement sur un COMPUTÉ. Deux entrées tardives vivaient sur un numéro de
        // ticket, ce qui veut dire : elles n'étaient couvertes par rien. `computed#26` est la
        // notification d'un computé — immédiate, puis à chaque changement, puis plus rien après
        // désabonnement. `dispose#4` est la forme du dispositeur rendu.
        //
        // La forme est celle du signal, pas un cas particulier : le callback s'exécute dans
        // `untracked`, donc le computé ne se suit pas lui-même en se notifiant. C'est vérifié ici en
        // passant le seuil d'abonnement à un autre signal que celui de la source, sinon le test
        // passerait pour la mauvaise raison.
        name: "subscribe/on-a-computed",
        matrice: [],
        run(api, log) {
            const source = api.signal(1);
            const autre = api.signal(0);
            const c = api.computed(() => (source.value ?? 0) * 2);
            const journal = [];
            // Le seuil d'abonnement vaut sur un AUTRE signal : si c'était `source`, un faux positif
            // passerait pour la bonne raison.
            const seuil = (other) => c.subscribe((v) => {
                journal.push(v);
                void other.value;
            });
            const d = seuil(autre);
            log("abonnement immediat", JSON.stringify(journal));
            source.value = 2;
            source.value = 3;
            log("deux ecritures", JSON.stringify(journal));
            d();
            source.value = 4;
            log("apres unsub", JSON.stringify(journal));
            // `dispose#4` — le dispositeur rendu porte `Symbol.dispose`, et c'est LUI-MÊME.
            //
            // Pas de `using` ici, contrairement à `effect#41` : le harnais l'a refusé sur la baseline
            // (`Symbol(Symbol.dispose) is not a function`), parce que CE dispositeur-là est une fonction
            // LIÉE. La matrice n'affirme que la PRÉSENCE du symbole — `_dispose.bind(effect)` en porte
            // un — donc c'est cela qu'on vérifie. Écrire `using` ici aurait été corriger la matrice au
            // lieu de la suivre.
            const portee = [];
            const d2 = source.subscribe(() => portee.push("abo"));
            log("notifications du second abonnement", JSON.stringify(portee));
            log("dispose porte Symbol.dispose", `${typeof d2 === "function"} / ${String(d2[Symbol.dispose] === d2)}`);
            d2();
            assert.deepEqual(log.entries, [
                "abonnement immediat [2]",
                "deux ecritures [2,4,6]",
                "apres unsub [2,4,6]",
                `notifications du second abonnement ${JSON.stringify(["abo"])}`,
                "dispose porte Symbol.dispose true / true",
            ]);
        },
    },
    {
        // SPEC §11 — OÙ L'ABONNEMENT EST CRÉÉ, ET `this`. Le rappel n'est pas une flèche : `this` y vaut
        // `undefined` en ESM, donc il n'est PAS l'effet — contrairement au callback d'un `effect`, que
        // `effect#10` fige déjà. C'est une des trois choses que la matrice relève et qui distingue
        // l'abonné de l'effet.
        //
        // Créé dans un EFFET, l'abonnement n'ajoute pas la source à cet effet : l'effet parent ne se
        // réveille pas sur une écriture de la source. Créé dans un COMPUTÉ, l'effet interne suit la
        // source normalement. Créé sous `untracked`, il fonctionne comme ailleurs — c'est le seul des
        // trois contextes où la différence ne se voit pas, et il est ici pour le dire.
        //
        // L'ordre entre deux abonnés est celui de la CRÉATION, pas celui d'une liste : c'est le même
        // parcours que pour n'importe quelle cible.
        name: "subscribe/where-it-is-created",
        matrice: [],
        run(api, log) {
            let thisDuRappel = "?";
            api.signal(0).subscribe(function () {
                thisDuRappel = this === undefined ? "undefined" : typeof this;
            });
            log("this du rappel", thisDuRappel);
            const source = api.signal(0);
            const autre = api.signal(0);
            let runs = 0;
            const abonnements = [];
            api.effect(() => {
                runs++;
                source.subscribe((v) => abonnements.push(`sub:${v}`));
            });
            autre.value = 1;
            log("cree dans un effect, la source n'abonne pas l'effet parent", String(runs));
            log("rappel appele une seule fois", abonnements.join(","));
            // Le computé est rejoué par l'ecriture de `autre`, donc son abonné interne tourne AVANT la
            // creation du suivant : le journal alterne `sub`, `computed sub`, et le dernier `sub:1`
            // prouve que l'ancien abonné a suivi l'ecriture de la source.
            const c = api.computed(() => {
                source.subscribe((v) => abonnements.push(`computed sub${v}`));
                return autre.value;
            });
            c.value;
            source.value = 1;
            log("cree dans un computed, l'effet interne suit la source", abonnements.join(","));
            const sousUntracked = api.signal(0);
            const jSousUntracked = [];
            api.untracked(() => {
                sousUntracked.subscribe((v) => jSousUntracked.push(`v${v}`));
            });
            sousUntracked.value = 1;
            log("cree sous untracked", JSON.stringify(jSousUntracked));
            const deux = api.signal(0);
            const ordre = [];
            deux.subscribe(() => {
                ordre.push(`1:${deux.value}`);
            });
            deux.subscribe(() => {
                ordre.push(`2:${deux.value}`);
            });
            deux.value = 1;
            log("ordre de creation", JSON.stringify(ordre));
            assert.deepEqual(log.entries, [
                "this du rappel undefined",
                "cree dans un effect, la source n'abonne pas l'effet parent 1",
                "rappel appele une seule fois sub:0",
                "cree dans un computed, l'effet interne suit la source sub:0,computed sub0,sub:1,computed sub1",
                'cree sous untracked ["v0","v1"]',
                'ordre de creation ["1:0","2:0","1:1","2:1"]',
            ]);
        },
    },
    {
        // SPEC §10 — `action(fn)` EXACTEMENT `batch` autour de `untracked`, et rien de plus. La
        // baseline (`L991-993`) ne fait rien d'autre : pas d'état, pas de mode, pas de journal. Donc
        // ce scénario ne teste pas une fonction, il teste une COMPOSITION — et c'est ce qui autorise
        // `createModel` à s'en servir pour envelopper chaque fonction d'un modèle.
        //
        // Les quatre premiers faits sont la composition elle-même : deux écritures ne produisent
        // qu'un flush, la valeur de retour traverse, les arguments traversent, et une lecture faite
        // dans le corps n'abonne personne. Les deux derniers sont les consequences qu'on ne verrait
        // pas si l'implantation était autre chose : les actions imbriquées ne flushent qu'une fois,
        // et une erreur traverse tout en flushant.
        name: "action/batch-around-untracked",
        matrice: [],
        run(api, log) {
            const s = api.signal(0);
            const journal = [];
            api.effect(() => {
                journal.push(`e:${s.value}`);
            });
            api.action(() => {
                s.value = 1;
                s.value = 2;
            })();
            log("deux ecritures, un seul flush", JSON.stringify(journal));
            log("valeur de retour", String(api.action(() => "ret")()));
            log("une promesse traverse", typeof api.action(() => Promise.resolve(1))());
            log("arguments", String(api.action((a, c) => a + c)(1, 2)));
            // L'`untracked` ne se voit que si l'action est APPELÉE DEPUIS un effet : c'est le seul moment
            // où elle a un contexte de suivi à neutraliser. L'effet appelle l'action, l'action lit une
            // source, et cette source ne doit pas abonner l'effet appelant — sans quoi il se réveillerait
            // tout seul. Un seul run : le `untracked` est là.
            //
            // La forme naïve — un effet qui lit une source et une action qui en écrit une AUTRE — ne
            // prouverait rien : elle passe aussi sans `untracked`, donc elle ne figerait pas le `batch`
            // plus le `untracked`, elle figerait seulement le `batch`.
            const source = api.signal(0);
            const lireLaSource = api.action(() => {
                void source.value;
            });
            let runs = 0;
            api.effect(() => {
                runs++;
                lireLaSource();
            });
            const avantEcriture = runs;
            source.value = 1;
            log("runs de l'effet appelant", `${avantEcriture} puis ${runs}`);
            const imbriquee = api.signal(0);
            const journalImbrique = [];
            api.effect(() => {
                journalImbrique.push(`e:${imbriquee.value}`);
            });
            api.action(() => {
                api.action(() => {
                    imbriquee.value = 1;
                    imbriquee.value = 2;
                })();
            })();
            log("actions imbriquees, un seul flush", JSON.stringify(journalImbrique));
            const enErreur = api.signal(0);
            const journalErreur = [];
            api.effect(() => {
                journalErreur.push(`e:${enErreur.value}`);
            });
            try {
                api.action(() => {
                    enErreur.value = 1;
                    throw new Error("x");
                })();
                log("erreur", "aucune erreur");
            }
            catch (erreur) {
                journalErreur.push(`caught:${erreur instanceof Error ? erreur.constructor.name : "autre"}`);
            }
            log("l'erreur traverse, le flush a lieu", JSON.stringify(journalErreur));
            assert.deepEqual(log.entries, [
                'deux ecritures, un seul flush ["e:0","e:2"]',
                "valeur de retour ret",
                "une promesse traverse object",
                "arguments 3",
                "runs de l'effet appelant 1 puis 1",
                'actions imbriquees, un seul flush ["e:0","e:2"]',
                'l\'erreur traverse, le flush a lieu ["e:0","e:1","caught:Error"]',
            ]);
        },
    },
    {
        // SPEC §10 — `this` ET LES ARGUMENTS. Un appel membre voit le `this` du membre ; un appel
        // détaché ne voit rien, parce que le module est en ESM et que `this` y vaut `undefined`. C'est
        // la même règle que pour le callback d'un effect, et elle est déjà figée par `effect#10`.
        //
        // La fonction rendue est une fonction ordinaire : pas de marque, et le prototype de
        // `Function`. Une action n'est donc ni un signal ni un objet du modèle — ce qui est exactement
        // ce que la détection de sous-objet de `createModel` doit pouvoir constater.
        name: "action/this-and-arguments",
        matrice: [],
        run(api, log) {
            const objet = {
                n: 5,
                run: api.action(function () {
                    return this.n;
                }),
            };
            log("appel membre, this preserve", String(objet.run()));
            const detache = api.action(function () {
                return this === undefined ? "undefined" : "autre";
            });
            log("appel detache, this ESM", detache());
            const rendue = api.action(() => 0);
            log("marque presente", String("brand" in rendue));
            log("prototype de Function", String(Object.getPrototypeOf(rendue) === Function.prototype));
            assert.deepEqual(log.entries, [
                "appel membre, this preserve 5",
                "appel detache, this ESM undefined",
                "marque presente false",
                "prototype de Function true",
            ]);
        },
    },
    {
        // SPEC §10.4 — UNE ÉCRITURE FAITE DEPUIS UN EFFECT EST DIFFÉRÉE À LA FIN DE L'EFFET. L'action
        // ouvre son propre batch, qui s'imbrique dans celui du drainage ; l'effet `d1` se réveille donc
        // d'abord, et `d2` ne voit la valeur qu'APRÈS — jamais pendant le run de `d1`.
        //
        // C'est le seul endroit où l'ordre se voit sans batch explicite, et c'est pourquoi il a son
        // propre scénario plutôt qu'une ligne de plus dans `action/batch-around-untracked`.
        name: "action/write-from-an-effect",
        matrice: [],
        run(api, log) {
            const declencheur = api.signal(0);
            const cible = api.signal(0);
            const journal = [];
            api.effect(() => {
                journal.push(`d1:${declencheur.value}`);
                if (declencheur.value > 0) {
                    api.action(() => {
                        cible.value = 9;
                    })();
                }
            });
            api.effect(() => {
                journal.push(`d2:${cible.value}`);
            });
            declencheur.value = 1;
            log("journal", JSON.stringify(journal));
            assert.deepEqual(log.entries, ['journal ["d1:0","d2:0","d1:1","d2:9"]']);
        },
    },
    {
        // SPEC §10 — une lecture sous `untracked` n'etablit AUCUNE dependance. Et c'est exactement
        // equivalent a `peek`. Les deux effects lisent `x` par des chemins differents, et ni l'un ni
        // l'autre ne se reveille.
        name: "untracked/no-dependency",
        matrice: ["untracked#1", "untracked#6"],
        run(api, log) {
            const a = api.signal(0);
            const b = api.signal(0);
            const journal = [];
            api.effect(() => {
                journal.push(`e:${a.value}/${api.untracked(() => b.value)}`);
            });
            log("apres creation", JSON.stringify(journal));
            b.value = 1;
            log("b ecrit, non suivi", JSON.stringify(journal));
            b.value = 2;
            log("b reecrit", JSON.stringify(journal));
            a.value = 1;
            log("a ecrit", JSON.stringify(journal));
            // Meme effet avec `peek` : aucune dependance non plus.
            const c = api.signal(0);
            let runsPeek = 0;
            api.effect(() => {
                runsPeek++;
                c.peek();
            });
            c.value = 1;
            log("runs avec peek", String(runsPeek));
            const d = api.signal(0);
            let runsUntracked = 0;
            api.effect(() => {
                runsUntracked++;
                api.untracked(() => d.value);
            });
            d.value = 1;
            log("runs avec untracked", String(runsUntracked));
            assert.deepEqual(log.entries, [
                'apres creation ["e:0/0"]',
                'b ecrit, non suivi ["e:0/0"]',
                'b reecrit ["e:0/0"]',
                'a ecrit ["e:0/0","e:1/2"]',
                "runs avec peek 1",
                "runs avec untracked 1",
            ]);
        },
    },
    {
        // SPEC §10 — `untracked` n'empeche pas les ecritures, et restaure le contexte meme apres une
        // exception. Sans le `finally`, l'ecriture suivante ne reverait plus l'effet.
        name: "untracked/writes-and-restore",
        matrice: ["untracked#2", "untracked#3", "untracked#4"],
        run(api, log) {
            const a = api.signal(0);
            const journal = [];
            api.effect(() => journal.push(`e:${a.value}`));
            api.untracked(() => {
                journal.push("dans untracked");
                a.value = 1;
                journal.push("apres ecriture");
            });
            log("ecritures autorisees", JSON.stringify(journal));
            try {
                api.untracked(() => {
                    journal.push("va lever");
                    throw new Error("boom");
                });
            }
            catch (erreur) {
                journal.push("caught");
            }
            a.value = 2;
            log("restaure apres exception", JSON.stringify(journal));
            assert.deepEqual(log.entries, [
                'ecritures autorisees ["e:0","dans untracked","e:1","apres ecriture"]',
                'restaure apres exception ["e:0","dans untracked","e:1","apres ecriture","va lever","caught","e:2"]',
            ]);
        },
    },
    {
        // SPEC §10 — `untracked` NE DESACTIVE PAS le rafraîchissement d'un computé lu : l'effet ne
        // re-tourne pas, mais le computé a été RAFRAICHI. Lire n'est pas invalider. La valeur périmée
        // ne s'observe qu'en lisant le computé HORS de tout effet — c'est ce que fait la derniere ligne.
        name: "untracked/computed-refresh",
        matrice: ["untracked#7"],
        run(api, log) {
            const a = api.signal(0);
            let runs = 0;
            let cCalls = 0;
            const c = api.computed(() => {
                cCalls++;
                return a.value * 2;
            });
            api.effect(() => {
                runs++;
                api.untracked(() => c.value);
            });
            log("etat initial", `runs:${runs} cCalls:${cCalls}`);
            a.value = 5;
            log("apres ecriture", `runs:${runs} cCalls:${cCalls}`);
            // La lecture dehors RAFRAICHI le computé sans réveiller l'effet : c'est ça le quirk.
            log("valeur lue dehors", String(c.value));
            log("apres la lecture", `runs:${runs} cCalls:${cCalls}`);
            assert.deepEqual(log.entries, [
                "etat initial runs:1 cCalls:1",
                "apres ecriture runs:1 cCalls:1",
                "valeur lue dehors 10",
                "apres la lecture runs:1 cCalls:2",
            ]);
        },
    },
    {
        // SPEC §10 — la valeur de retour, y compris une `Promise` renvoyee telle quelle.
        name: "untracked/return-value",
        matrice: ["untracked#5"],
        run(api, log) {
            log("nombre", String(api.untracked(() => 42)));
            const objet = { a: 1 };
            log("objet", api.untracked(() => objet) === objet ? "la reference" : "une copie");
            const promesse = Promise.resolve(7);
            log("promesse passee telle quelle", api.untracked(() => promesse) === promesse ? "oui" : "non");
            log("undefined", String(api.untracked(() => undefined)));
            assert.deepEqual(log.entries, [
                "nombre 42",
                "objet la reference",
                "promesse passee telle quelle oui",
                "undefined undefined",
            ]);
        },
    },
    {
        // SPEC §16.3 — la portée de capture est NEUTRALISÉE par `untracked`, puis RESTAURÉE. Deux
        // entrées tardives vivaient sur un numéro de ticket — donc n'étaient couvertes par rien.
        //
        // `untracked#11` : une fabrique imbriquée qui LÈVE ne doit pas emporter la portée. Les effets
        // déjà capturés sont perdus, mais ceux qui suivent — pour le MÊME modèle, après l'exception —
        // restent possédés. Une capture qui ne se referait pas donnerait le même journal ; c'est le
        // second effet, après le throw, qui distingue les deux.
        //
        // `untracked#12` : un computé lu sous `untracked` réimplante la capture. Sans ça, l'effet
        // créé ensuite ne serait pas possédé — et le journal ne le verrait pas, car un effet non
        // possédé survit au dispose, ce qui produit la MÊME liste qu'un effet possédé et Cleans.
        name: "untracked/suspended-capture",
        matrice: [],
        run(api, log) {
            // untracked#11 — la capture survit a une exception de fabrique
            const journal = [];
            const declencheur = api.signal(0);
            const QuiEchoue = api.createModel(() => {
                throw new Error("fabrique avortee");
            });
            const M = api.createModel(() => {
                api.effect(() => journal.push("avant"));
                try {
                    QuiEchoue();
                }
                catch {
                    journal.push("attrape");
                }
                // Cet effet est cree APRÈS l'exception : il doit rester possédé.
                api.effect(() => journal.push("owned"));
                return {};
            });
            const modele = new M();
            declencheur.value = 1;
            modele[Symbol.dispose]();
            declencheur.value = 2;
            log("capture apres exception", JSON.stringify(journal));
            // untracked#12 — un computé lu sous untracked reimplante la capture
            const journal2 = [];
            const source = api.signal(0);
            const N = api.createModel(() => {
                const c = api.computed(() => source.value);
                api.untracked(() => c.value);
                api.effect(() => journal2.push(`owned:${source.value}`));
                return {};
            });
            const modele2 = new N();
            source.value = 1;
            modele2[Symbol.dispose]();
            source.value = 2;
            log("capture reimplantee par un computé", JSON.stringify(journal2));
            assert.deepEqual(log.entries, [
                'capture apres exception ["avant","attrape","owned"]',
                'capture reimplantee par un computé ["owned:0","owned:1"]',
            ]);
        },
    },
    {
        // SPEC §13.6 — un effet cree dans un `untracked` est INDEPENDANT du parent. Le parent lit `a`,
        // donc il se reveille et cree un second interieur. Mais le PREMIER interieur ne re-tourne pas
        // avec le parent : chacun a ete lance une fois, jamais deux. L'interieur lit `b`, qui ne change
        // jamais — donc tout re-run qu'il ferait serait imputable au parent, et c'est ce que le compte
        // verifie.
        name: "untracked/effect-created-inside",
        matrice: ["untracked#8", "untracked#9"],
        run(api, log) {
            const a = api.signal(0);
            const b = api.signal(0);
            let parents = 0;
            let interieurs = 0;
            let crees = 0;
            api.effect(() => {
                parents++;
                a.value;
                api.untracked(() => {
                    crees++;
                    api.effect(() => {
                        interieurs++;
                        b.value;
                    });
                });
            });
            log("apres le run initial", `parents:${parents} crees:${crees} interieurs:${interieurs}`);
            a.value = 1;
            log("apres ecriture", `parents:${parents} crees:${crees} interieurs:${interieurs}`);
            assert.deepEqual(log.entries, [
                "apres le run initial parents:1 crees:1 interieurs:1",
                "apres ecriture parents:2 crees:2 interieurs:2",
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
// Ici, chaque entrée est nommée, et son sort est écrit. TROIS valeurs possibles, et chacune est
// vérifiable :
//   - le nom d'un scénario de la table, qui la rejoue contre le paquet installé ;
//   - le nom d'un test `signalcn-seul`, qui l'atteint par l'intérieur ou par un choix assumé ;
//   - un MARQUEUR, `source:<réf>` ou `divergence:<ancre>`, qui dit que l'observable ne peut rien
//     porter sur le paquet installé, et où il a été pris.
//
// IL Y AVAIT UNE QUATRIÈME VALEUR, et elle a coûté cher : le numéro d'un ticket ENCORE OUVERT, qui
// promettait de reprendre l'entrée plus tard. Le tableau portait la liste, `TICHETS`, et la porte
// refusait un numéro qui n'y était plus — donc elle vérifiait la PROMESSE, jamais la couverture.
// Le jour où les tickets se sont fermés, cinq entrées sont restées couvertes par un souvenir :
// `computed#26`, `untracked#10` à `#13`, `dispose#4`. Aucune porte ne l'avait vu, parce que la
// liste était encore là.
//
// Le mécanisme est retiré. Une entrée non couverte s'écrit maintenant comme telle — et le remède
// est un scénario, pas un ticket. Trente-trois entrées ont été decoupees en deux a cette occasion
// (`signal#6`/`#6b` et les huit autres) : une entrée qui peut etre a la fois comparable et pas
// laisse le referent flou dans la meme cellule, et une cellule ou le referent est flou est une
// cellule que personne ne peut verifier.
export const COUVERTURE = {
    // --- groupe `signal` : 23 entrées
    "signal#1": "signal/instance-and-class",
    "signal#2": "signal/no-argument",
    // signal#3 et #4 sont des affirmations de structure : elles ne peuvent PAS passer contre la
    // baseline, qui minifie ses noms de propriétés. Elles sont donc nôtres seules.
    "signal#3": "signalcn-seul/class-shape + source:src/index.ts#L368-377",
    "signal#4": "signalcn-seul/class-shape + source:src/index.ts#L376",
    // La notification demande un observateur : c'est un effet, et le scénario fige son journal.
    "signal#5": "signal/synchronous-notification",
    "signal#6": "signal/strict-equality-nan",
    "signal#6b": "signalcn-seul/notification-follows-object-is + source:src/index.ts#L462",
    "signal#7": "signal/zero-and-negative-zero",
    "signal#7b": "signalcn-seul/notification-follows-object-is + source:src/index.ts#L462",
    "signal#8": "signal/zero-and-negative-zero",
    "signal#8b": "signalcn-seul/notification-follows-object-is + source:src/index.ts#L462",
    "signal#9": "signal/strict-equality-object",
    "signal#10": "signal/strict-equality-object",
    "signal#11": "signal/strict-equality-object",
    "signal#12": "signal/synchronous-notification",
    "signal#13": "signal/synchronous-notification",
    // L'absence de dependance de `peek()` ne se voit qu'a travers un effet.
    "signal#14": "signal/synchronous-notification",
    "signal#15": "signal/peek + signalcn-seul/enumeration-skips-the-prototype",
    "signal#16": "signal/options-name",
    "signal#17": "signal/brand-and-no-dispose",
    "signal#18": "signal/instance-and-class",
    "signal#19": "signal/instance-and-class",
    "signal#20": "signal/instance-and-class",
    "signal#21": "signalcn-seul/write-on-frozen-signal-throws",
    "signal#22": "signal/brand-and-no-dispose",
    "signal#23": "signal/brand-and-no-dispose",
    // --- groupe conversions : 15 entrées
    "conv#1": "conversions/to-string-and-value-of",
    "conv#2": "conversions/to-string-throw-on-symbol",
    "conv#3": "conversions/no-symbol-to-primitive",
    // Les quatre « suit la dependance » demandent un observateur : c'est exactement ce que rejoue
    // `conversions/follow-the-dependency`.
    "conv#4": "conversions/follow-the-dependency",
    "conv#5": "conversions/to-string-and-value-of",
    "conv#6": "conversions/follow-the-dependency",
    "conv#7": "conversions/to-json-and-stringify",
    "conv#8": "conversions/follow-the-dependency",
    // La propagation d'erreur par une conversion demande un computed qui jette.
    "conv#9": "computed/conversions-propagate-the-error",
    // DIVERGENCE ASSUMÉE : la baseline écrit son prototype à la main, donc ses méthodes y sont
    // énumérables. SPEC §20 impose des classes natives ES2020, dont les méthodes de prototype
    // sont non énumérables. Nous divergons, et c'est le nôtre qui est vérifié.
    "conv#10": "signalcn-seul/enumeration-skips-the-prototype",
    "conv#11": "signal/brand-and-no-dispose",
    "conv#12": "signalcn-seul/enumeration-skips-the-prototype",
    "conv#13": "signal/brand-and-no-dispose",
    "conv#14": "conversions/to-json-and-stringify",
    "conv#15": "conversions/follow-the-dependency",
    // --- groupe `computed` : 27 entrées
    "computed#1": "computed/lazy-and-cache",
    "computed#2": "computed/lazy-and-cache",
    "computed#3": "computed/no-subscriber",
    // computed#3b : une écriture NON liée ne fait pas réévaluer un computé nu, alors qu'une écriture
    // liée le fait (#3). Les deux ensemble disent ce que vaut « périmé » ; un seul laisserait la
    // moitié de la règle libre.
    "computed#3b": "computed/unlinked-write-evaluation",
    "computed#4": "computed/invalidation-and-recompute",
    // computed#5 et #6 : un résultat identique ne notifie pas les dépendants. Elles pointaient sur le
    // ticket #24, clos, et n'étaient couvertes par AUCUN test — un numéro de ticket est accepté comme
    // destination par `registre-complet`, donc le vide Passait pour une couverture. #38 est passé par là.
    "computed#5": "computed/identical-value-reread",
    "computed#6": "computed/identical-value-reread",
    "computed#7": "computed/invalidation-and-recompute",
    "computed#8": "computed/dynamic-dependencies",
    "computed#9": "computed/reactivation-after-abandon",
    // computed#10 : l'ordre de sortie anticipée de `checkDirty` ne se voit qu'à travers le nombre
    // de recalculs d'un effet. Ici on fige l'ordre de la liste, ce qui en est la cause.
    "computed#10": "signalcn-seul/sources-in-read-order + source:src/index.ts#L508-531",
    // computed#11 : la relecture paresseuse dans un batch ne relance rien, et le compteur
    // d'évaluations le dit. Elle pointait sur #26, clos.
    "computed#11": "computed/reentrant-read-in-batch",
    "computed#12": "computed/cycles",
    "computed#13": "computed/cycles",
    "computed#14": "computed/write-in-a-computed",
    "computed#15": "computed/cached-error",
    "computed#16": "computed/cached-error",
    "computed#17": "computed/error-to-effect",
    "computed#18": "computed/bottom-up-chain-order",
    // computed#18b, et non #18 : l'entrée #18 note l'ordre bottom-up de deux computés CHAÎNÉS, qui
    // n'a jamais divergé. Le cas ici est deux computés INDÉPENDANTS, dont l'ordre alterne — une autre
    // question. Ré mapper #18 sur ce scénario aurait couvert une entrée sans la rejouer, ce qui est
    // exactement le trou que ce scenario vient de refermer.
    "computed#18b": "computed/alternating-computed-and-effect-order",
    // computed#19, #20, #21, #22 : le prototype partagé de la baseline est un écart ASSUMÉ, voir
    // SPEC §21 et ADR-0004. Notre prototype ne porte pas d'état, nos noms sont lisibles, et
    // `constructor` vaut `Computed` et non `Signal` — le correctif que SPEC §21 enregistre. Ces
    // quatre entrées ne sont donc pas différentielles : elles sont nôtres seules.
    "computed#19": "signalcn-seul/class-shape",
    "computed#20": "signalcn-seul/class-shape + source:src/index.ts#L644",
    "computed#21": "signalcn-seul/class-shape + source:src/index.ts#L644",
    "computed#22": "signalcn-seul/class-shape",
    "computed#22b": "source:src/index.ts#L653-655",
    "computed#23": "computed/read-only",
    "computed#24": "computed/read-only",
    "computed#25": "computed/options-and-brand",
    "computed#26": "subscribe/on-a-computed",
    "computed#27": "computed/options-and-brand",
    // --- groupe `effect` : 41 entrées
    "effect#1": "effect/first-run-and-arguments",
    "effect#2": "effect/rerun-and-cleanup",
    "effect#3": "effect/no-dependency",
    "effect#4": "effect/shape-of-the-disposer",
    "effect#5": "effect/non-function-return-ignored",
    "effect#6": "effect/rerun-and-cleanup",
    "effect#7": "effect/cleanup-untracked",
    "effect#8": "effect/rerun-and-cleanup",
    "effect#9": "effect/this-is-the-instance",
    "effect#10": "effect/this-is-the-instance",
    "effect#11": "dispose/during-the-run",
    "effect#12": "dispose/during-the-run",
    "effect#13": "dispose/idempotent-and-detachment",
    "effect#14": "dispose/in-the-queue",
    // effect#15 et #17 : l'ordre INVERSÉ est normatif à l'intérieur d'un batch, et c'est
    // `effect/order-in-batch` qui le rejoue. Hors batch chaque écriture draine seule, donc l'ordre
    // ne s'observe pas — c'est `effect/order-outside-batch`. Les deux formes, donc les deux scénarios :
    // une seule ne prouverait que la moitié de la règle.
    "effect#15": "effect/order-outside-batch + effect/order-in-batch",
    "effect#16": "effect/auto-write",
    "effect#17": "effect/order-outside-batch + effect/order-in-batch",
    "effect#18": "effect/errors",
    "effect#19": "effect/bounded-cycle",
    "effect#20": "effect/errors",
    "effect#21": "effect/watchers",
    "effect#22": "effect/errors",
    // effect#23, #25, #26, #27 : la propagation d'erreur passe par le batch ou par un setter, donc
    // par un scénario qui rejoue les DEUX — `effect/draining-errors`.
    "effect#23": "effect/draining-errors",
    "effect#24": "effect/errors",
    "effect#25": "effect/draining-errors",
    "effect#26": "effect/draining-errors",
    "effect#27": "effect/draining-errors",
    "effect#28": "dispose/cleanup-that-throws",
    "effect#29": "dispose/cleanup-that-throws-at-dispose",
    "effect#30": "dispose/cleanup-that-throws + dispose/cleanup-that-throws-at-dispose",
    "effect#31": "dispose/cleanup-that-throws + dispose/in-the-queue",
    "effect#32": "effect/chain-and-drain",
    "effect#33": "effect/nesting-and-independence",
    // effect#34 : un effet créé dans un COMPUTÉ fuit à chaque évaluation. C'est un quirk figé, et le
    // mesurer demande un observateur — donc un effet dans un effet.
    "effect#34": "signalcn-seul/computed-leaks-its-effects",
    "effect#35": "effect/shape-of-the-disposer",
    "effect#36": "signalcn-seul/options-de-linstance",
    "effect#36b": "signalcn-seul/class-shape + source:src/index.ts#L770",
    "effect#37": "signalcn-seul/an-effect-is-observed-a-computed-is-not + source:src/index.ts#L776",
    "effect#38": "effect/first-run-and-arguments",
    // effect#39 : la baseline écrit son prototype à la main, donc ses méthodes y sont énumérables.
    // ADR-0004 refuse cette énumérabilité. DIVERGENCE ASSUMÉE.
    "effect#39": "signalcn-seul/enumeration-skips-the-prototype + source:src/index.ts#L907",
    // La matrice dit « atteignable seulement via `_start` ».
    // `nested-effects-run-in-creation-order` montre que l'API
    // publique ferme en ordre inverse — le cas NORMAL — et n'atteint donc pas le garde ;
    // `guards-on-an-inconsistent-node` l'atteint. C'est le second qui couvre l'entrée, le premier qui
    // garantit qu'on ne l'atteint pas par accident.
    // Deux observables distincts : le GARDE existe et l'API publique ne le déclenche jamais —
    // `nested-effects-run-in-creation-order` le montre, et rejouable contre le paquet ; et son
    // ATTEINTE, qui suppose `_start`, donc un interne que l'artefact n'a pas sous ce nom.
    "effect#40": "signalcn-seul/nested-effects-run-in-creation-order",
    "effect#40b": "signalcn-seul/guards-on-an-inconsistent-node + source:src/index.ts#L842",
    "effect#41": "signalcn-seul/symbol-dispose-et-using + divergence:SPEC.md#8.2",
    // ---- `batch` et `untracked` -----------------------------------------------------------------
    //
    // Vingt-quatre des vingt-six entrées `batch` et neuf des treize `untracked` sont couvertes par
    // les quatorze scénarios de la tranche. Les sept restantes sont ci-dessous, avec la raison.
    //
    // `batch#24` et `batch#25` — le ping-pong entre effets — n'ont NI fauxificateur NI scénario, parce
    // qu'ils ne passent pas. La chaîne d'une SEULE génération croît sans fin : le compteur
    // `batchIteration` reste donc figé, et la borne n'arrive jamais. La baseline s'arrête en 2 ms sur
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
    "batch#1": "batch/value-and-nesting",
    "batch#2": "batch/identical-write",
    "batch#3": "batch/value-and-nesting",
    "batch#4": "batch/body-error-and-depth",
    "batch#5": "batch/value-and-nesting",
    "batch#6": "batch/value-and-nesting",
    "batch#7": "batch/three-levels-and-order",
    "batch#8": "batch/caught-inner-error",
    "batch#9": "batch/caught-inner-error",
    "batch#10": "batch/body-error-and-depth",
    "batch#11": "batch/identical-write",
    "batch#12": "batch/identical-write",
    "batch#13": "batch/bounded-and-unbounded-cycle",
    "batch#14": "batch/three-levels-and-order",
    "batch#15": "batch/identical-write",
    // batch#16 et batch#20 sont lus par DEUX scénarios chacun. Le second n'est pas un doublon : il
    // est le SEUL test de la suite qui distingue `===` de `Object.is` dans la réconciliation du
    // batch. Mesuré : en remplaçant le `===` de `reconcileBatchSnapshots` par `Object.is`, tous les
    // autres tests restent verts et celui-ci tombe. Sans lui, le scénario était orphelin — présent
    // dans la table, cité par aucune entrée, donc invisible pour le registre.
    "batch#16": "batch/revert-a-b-a + batch/strict-snapshot-identity",
    "batch#17": "batch/revert-with-lazy-read",
    "batch#18": "batch/revert-with-lazy-read",
    "batch#19": "batch/revert-a-b-a",
    "batch#20": "batch/revert-with-lazy-read + batch/strict-snapshot-identity",
    "batch#21": "batch/revert-a-b-a",
    "batch#22": "batch/bounded-and-unbounded-cycle",
    "batch#23": "batch/bounded-and-unbounded-cycle",
    "batch#24": "batch/bounded-and-unbounded-cycle",
    "batch#25": "batch/bounded-and-unbounded-cycle",
    "batch#26": "batch/bounded-and-unbounded-cycle",
    // batch#27 : relire un computé invalidé PENDANT le batch ne doit pas consommer la file de
    // drainage, sinon l'effet ne tourne jamais à la sortie. Trouvé en #38.
    "batch#27": "batch/reread-wakes-despite-read",
    // --- groupe `createModel` : 34 entrees
    // Le NOM des fonctions enveloppees est le seul point non differentiel de tout le groupe : le
    // paquet publie minifie ses noms, donc `name` y vaut la chaine vide. Les cinq entrees dont le nom
    // EST le sujet (`#2`, `#4`, `#5`, `#11`, `#15`) sont donc verifiees sur les deux cotes — la
    // SUBSTITUTION de la fonction est differentielle, le nom ne l'est pas.
    "modele#1": "model/shape-and-teardown",
    "modele#2": "model/shape-and-teardown",
    "modele#2b": "signalcn-seul/wrapper-covers-every-surface + divergence:SPEC.md#17.2",
    "modele#3": "model/shape-and-teardown",
    "modele#4": "model/shape-and-teardown",
    "modele#4b": "signalcn-seul/wrapper-covers-every-surface + divergence:SPEC.md#17.2",
    "modele#5": "model/shape-and-teardown",
    "modele#5b": "signalcn-seul/wrapper-covers-every-surface + divergence:SPEC.md#17.2",
    "modele#6": "model/shape-and-teardown",
    "modele#7": "model/shape-and-teardown",
    "modele#8": "model/shape-and-teardown",
    "modele#9": "model/shape-and-teardown",
    "modele#10": "model/shape-and-teardown",
    "modele#11": "model/cyclic-getter-and-primitives",
    "modele#11b": "signalcn-seul/wrapper-covers-every-surface + divergence:SPEC.md#17.2",
    "modele#12": "model/cyclic-getter-and-primitives",
    "modele#13": "model/effect-capture",
    "modele#14": "model/arguments-and-this",
    "modele#15": "model/shape-and-teardown",
    "modele#16": "model/effect-capture",
    "modele#17": "model/effect-capture",
    "modele#18": "model/effect-capture",
    "modele#19": "model/nested-models",
    "modele#20": "model/nested-models",
    "modele#21": "model/effect-capture",
    "modele#22": "model/effect-capture",
    "modele#23": "model/effect-capture",
    "modele#24": "model/dispose",
    "modele#25": "model/dispose",
    "modele#26": "model/dispose",
    "modele#27": "model/dispose",
    "modele#28": "model/dispose",
    "modele#29": "model/dispose",
    "modele#30": "model/dispose",
    "modele#31": "model/two-instances",
    "modele#32": "model/two-instances",
    "modele#33": "model/two-instances",
    "modele#34": "model/cyclic-getter-and-primitives",
    // --- groupe `subscribe` : 15 entrees
    // `subscribe#12` est le SEUL cas que la table ne peut pas dire : l'effet interne se nomme "sub",
    // et le paquet publie minifie ses noms de fonctions, donc `name` y vaut la chaine vide.
    "subscribe#1": "subscribe/untracked-callback",
    "subscribe#2": "subscribe/unsubscribe-and-errors",
    "subscribe#3": "subscribe/unsubscribe-and-errors",
    "subscribe#4": "subscribe/unsubscribe-and-errors",
    "subscribe#5": "subscribe/unsubscribe-and-errors",
    "subscribe#6": "subscribe/untracked-callback",
    "subscribe#7": "subscribe/unsubscribe-and-errors",
    "subscribe#8": "subscribe/unsubscribe-and-errors",
    "subscribe#9": "subscribe/where-it-is-created",
    "subscribe#10": "subscribe/untracked-callback",
    "subscribe#11": "subscribe/where-it-is-created",
    "subscribe#12": "signalcn-seul/internal-effect-takes-the-options-name + source:src/index.ts#L427",
    "subscribe#13": "subscribe/where-it-is-created",
    "subscribe#14": "subscribe/where-it-is-created",
    "subscribe#15": "subscribe/unsubscribe-and-errors",
    // subscribe#16 : la forme interne differee et le nom "sub" sont nôtres seuls.
    "subscribe#16": "signalcn-seul/internal-effect-takes-the-options-name",
    // subscribe#17 (ordre avec plusieurs abonnes) et #18 (utilisable avec `using`) : le premier est
    // deja couvert par la fin de `subscribe/where-it-is-created`, le second par la forme du retour dans
    // `subscribe/unsubscribe-and-errors`.
    "subscribe#17": "subscribe/where-it-is-created",
    "subscribe#18": "subscribe/unsubscribe-and-errors",
    // --- groupe `action` : 11 entrees
    // `action#6`, le nom du wrapper, est le SEUL cas que la table ne peut pas dire : le paquet publie
    // minifie ses noms de fonctions, donc `f.name` y vaut la chaine vide. Le notre survit parce que
    // le pipeline passe `--keep-names`, et c'est ce que verifie `signalcn-seul/wrapper-name-is-frozen`.
    "action#1": "action/batch-around-untracked",
    "action#2": "action/batch-around-untracked",
    "action#3": "action/this-and-arguments",
    "action#4": "action/this-and-arguments",
    "action#5": "action/this-and-arguments",
    "action#6": "signalcn-seul/wrapper-name-is-frozen + divergence:SPEC.md#17.2",
    "action#7": "action/batch-around-untracked",
    "action#8": "action/batch-around-untracked",
    "action#9": "action/batch-around-untracked",
    "action#10": "action/write-from-an-effect",
    "action#11": "action/this-and-arguments",
    // `untracked#10` a `#11` et `#12` portent sur la portee de capture d'effets d'un modele : ils
    // ne sont atteignables qu'avec `createModel`, qui est #28. `untracked#13` est un usage INTERNE —
    // `peek` est deja couvert par `untracked/no-dependency`, `watched`/`unwatched` arrivent avec
    // `subscribe` en #25.
    "untracked#1": "untracked/no-dependency",
    "untracked#2": "untracked/writes-and-restore",
    "untracked#3": "untracked/writes-and-restore",
    "untracked#4": "untracked/writes-and-restore",
    "untracked#5": "untracked/return-value",
    "untracked#6": "untracked/no-dependency",
    "untracked#7": "untracked/computed-refresh",
    "untracked#8": "untracked/effect-created-inside",
    "untracked#9": "untracked/effect-created-inside",
    "untracked#10": "model/nested-models",
    "untracked#11": "untracked/suspended-capture",
    "untracked#12": "untracked/suspended-capture",
    "untracked#13": "untracked/no-dependency",
    // --- groupe `dispose` : 10 entrées
    "dispose#1": "effect/shape-of-the-disposer",
    // dispose#2 : la baseline fait pointer `Symbol.dispose` sur le dispositeur, qui est une fonction
    // LIÉE, et V8 refuse alors cette méthode. On garde l'identité en passant par une fermeture :
    // le `bind` de la baseline était le seul obstacle, et il était évitable. CONFORME.
    "dispose#2": "signalcn-seul/symbol-dispose-et-using",
    "dispose#3": "signalcn-seul/symbol-dispose-et-using + divergence:SPEC.md#8.2",
    // dispose#4 : `subscribe` renvoie aussi un disposeur, et il porte `Symbol.dispose`.
    "dispose#4": "subscribe/on-a-computed",
    // dispose#5 : un realm où `Symbol.dispose` est ABSENT. La matrice note que ce cas n'est
    // atteignable que sur le bundle réel dans un tel realm ; l'affirmer demanderait de l'éteindre.
    "dispose#5": "signalcn-seul/symbol-dispose-missing-leaves-no-stray-key",
    "dispose#6": "dispose/idempotent-and-detachment + dispose/cleanup-that-throws-at-dispose",
    "dispose#7": "dispose/during-the-run",
    "dispose#8": "dispose/in-the-queue",
    "dispose#9": "dispose/idempotent-and-detachment",
    "dispose#10": "signalcn-seul/enumeration-skips-the-prototype + source:src/index.ts#L907",
};
/**
 * Les entrées de matrice des cinq groupes traités ici. Les COMPTES sont écrits en dur, et c'est
 * une faiblesse connue : une entrée ajoutée à la matrice laisserait `registre-complet`
 * vert. Le durcissement — lire la matrice pour en dériver la liste — est [#33](#33), qui a trouvé
 * le problème sur les entrées structurelles.
 */
export const ENTREES_ATTENDUES = [
    ...Array.from({ length: 23 }, (_, i) => `signal#${i + 1}`),
    ...Array.from({ length: 15 }, (_, i) => `conv#${i + 1}`),
    ...Array.from({ length: 27 }, (_, i) => `computed#${i + 1}`),
    // Les deux entrées suffixées sont de vraies entrées de matrice, ajoutées en #38 : `research`
    // les numérote `3b` et `18b` pour les insérer PRÈS de l'entrée qu'elles prolongent, parce que
    // leur sujet est plus étroit et non un comportement supplémentaire. Un `Array.from` les
    // produirait jamais, donc elles sont nommées.
    "computed#3b",
    "computed#18b",
    ...Array.from({ length: 41 }, (_, i) => `effect#${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `dispose#${i + 1}`),
    ...Array.from({ length: 27 }, (_, i) => `batch#${i + 1}`),
    ...Array.from({ length: 13 }, (_, i) => `untracked#${i + 1}`),
    // `action#12` et `#13` ne sont pas nommes ici : ils portent sur la portee de capture d'effets
    // d'une fabrique de modele, donc sur `createModel` — #28. Les nommer maintenant laisserait
    // `registre-complet` rouge sur une destination qui n'existe pas encore.
    ...Array.from({ length: 11 }, (_, i) => `action#${i + 1}`),
    // `subscribe#16` est la seule voie d'observer un `EffectOptions.name` — l'effet interne est
    // nomme "sub" — et sa forme interne differee. Les deux sont nôtres seules : la baseline minifie
    // les noms, donc `name` y vaut la chaine vide. Voir
    // `signalcn-seul/internal-effect-takes-the-options-name`.
    // `subscribe#16` a #18 : #16 est interne, #18 est un `using`, et #17 l'ordre de creation.
    ...Array.from({ length: 18 }, (_, i) => `subscribe#${i + 1}`),
    ...Array.from({ length: 34 }, (_, i) => `modele#${i + 1}`),
    // Les dix entrées NÉES DU DÉCOUPAGE. Une entrée qui asserte un comportement vérifiable ET
    // un nom que l'artefact minifie est deux entrées : l'une comparable, l'autre marquée. La
    // lettre reprend le précédent de `computed#3b` et `computed#18b`, et le mot `b` signifie
    // « branche » — le complément, jamais un doublon.
    "signal#6b",
    "signal#7b",
    "signal#8b",
    "computed#22b",
    "effect#36b",
    "modele#2b",
    "modele#4b",
    "modele#5b",
    "modele#11b",
    "effect#40b",
];
// Le reliquat : il n'a aucune raison d'exister ailleurs.
//
// Le garde n'est pas cosmetique. Le harnais doit pouvoir lire la table AVANT que le moteur
// existe — c'est tout l'interet d'un oracle : valider d'abord, ecrire ensuite. Si ce fichier
// importait le moteur au niveau superieur, l'oracle serait indisponible tant que le moteur
// manque, et l'ordre rouge-vert n'aurait plus de juge. `NODE_TEST_CONTEXT` est pose par
// `node --test` dans chaque fichier de test, et nowhere ailleurs.
/** Les MORCEAUX d'une destination : un nom de scénario, un nom de test `signalcn-seul`, ou un marqueur. */
export const morceaux = (destination) => destination.split("+").map((d) => d.trim());
/**
 * LA forme d'un marqueur : `source:<réf>` ou `divergence:<réf>`. Deux espèces, parce qu'elles n'ont
 * pas la même conséquence.
 *
 * C'est l'unique définition du dépôt, et elle est ici parce que ce fichier est la source unique du
 * registre. Trois consommateurs la lisent : `registre-complet` en exige la forme, `REJOUABLES` en
 * déduit ce qui est rejouable, et `scripts/verifier-documentation.mjs` en retrouve les entrées à
 * consigner au §21. Un motif écrit deux fois dérive — et il avait déjà dérivé : la porte cherchait
 * `source:` n'importe où dans la destination, la suite cherchait `source:` ou `divergence:`.
 */
export const MARQUEUR = /^(source|divergence):\S+$/;
// ---- Une seule source pour `matrice` ----------------------------------------------------
//
// Le registre `COUVERTURE` est l'unique endroit qui dit quelle entrée est couverte par quoi.
// Le champ `matrice` d'un scénario en est DÉDUIT, jamais écrit à la main : les deux ne
// peuvent donc pas diverger. Écrire les deux, c'est garantir qu'un jour l'un des deux aura tort
// en silence — et personne ne verrait rien, parce que le harnais ne fait qu'un décompte.
function entreesCouvertesPar(nomScenario) {
    return Object.entries(COUVERTURE)
        .filter(([, destination]) => morceaux(destination).includes(nomScenario))
        .map(([id]) => id)
        .sort();
}
for (const scenario of scenarios) {
    scenario.matrice = entreesCouvertesPar(scenario.name);
}
// ---- Les tests signalcn-seuls, en une seule source --------------------------------
// Cet objet alimente `node:test` ET le contrôle du registre. Avant, les noms vivaient dans une
// liste à côté : on pouvait y ajouter un nom, le citer dans le registre, et le registre passer
// sans qu'aucun test n'existe derrière. Un contrôle à sens unique n'est pas un contrôle.
//
// Ils sont ici, et pas dans un fichier séparé, pour ne pas ajouter un troisième fichier à un
// couple dont la composition est figée.
export const testsSignalcnSeul = {
    // Les fonctions enveloppées par `createModel` se nomment `actionWrapper`, comme celles
    // d'`action` — c'est le MÊME enveloppeur, donc le même nom. Le paquet publié minifie ses noms,
    // donc la table ne peut pas le dire ; et comme un modèle a des surfaces différentes — une
    // imbriquée, un tableau, un objet cyclique — il faut vérifier que l'enveloppeur est bien tombé
    // dans chaque cas, pas seulement à la racine.
    "wrapper-covers-every-surface": async ({ signal, createModel }) => {
        const enveloppee = function () { };
        const imbriquee = function () { };
        const modele = createModel(() => ({
            racine: enveloppee,
            imbrique: { profond: imbriquee },
            tableau: [function () { }],
            marque: signal(1),
        }))();
        assert.equal(modele.racine.name, "actionWrapper", "la fonction racine est enveloppée");
        assert.equal(modele.imbrique.profond.name, "actionWrapper", "l'imbriquée aussi");
        assert.equal(modele.tableau[0].name, "actionWrapper", "celle du tableau aussi");
        // Le signal n'est PAS descendedu : ses méthodes lui appartiennent, et les envelopper
        // rendrait un signal illisible.
        assert.notEqual(modele.marque.toString.name, "actionWrapper", "un signal n'est pas envelopes");
        assert.equal(modele.marque.brand, Symbol.for("preact-signals"), "le signal est intact");
    },
    // Le nom du wrapper d'`action` est un CONTRACT, pas une etiquette : la matrice le fige, et le
    // pipeline de generation a besoin de `--keep-names` pour le conserver. Il ne peut PAS etre
    // verifie dans la table — le paquet publie minifie ses noms de fonctions, donc `f.name` y vaut
    // la chaine vide, et un scenario qui l'affirmerait echouerait contre la baseline par
    // construction. C'est le meme cas que `signal#3` et `signal#4`, et pour la meme raison.
    // L'effet interne de `subscribe` se nomme "sub", et c'est la SEULE voie d'observer qu'un
    // `EffectOptions.name` produise de l'effet. Notre nom survit parce que le pipeline passe
    // `--keep-names` ; celui de la baseline publiée est la chaîne vide, donc la table ne peut pas le
    // dire — même raison que `signal#3` et `signal#4`.
    //
    // On observe le nom par le chemin de la matrice, pas par une propriété inventée ici : le noeud
    //ud de cible du signal porte l'effet qui s'y est abonné.
    "internal-effect-takes-the-options-name": async ({ signal }) => {
        const source = signal(0);
        source.subscribe((v) => void v);
        const nom = source._targets._target
            .name;
        assert.equal(nom, "sub", "l'effet interne d'un abonnement se nomme 'sub'");
    },
    "wrapper-name-is-frozen": async ({ action }) => {
        const rendue = action(() => 0);
        assert.equal(rendue.name, "actionWrapper", "le nom du wrapper est fige par la matrice");
        assert.equal(rendue.length, 0, "la signature est vide meme si fn en a");
        assert.notEqual(rendue.name, "", "le nom a disparu : --keep-names ne joue plus son role");
    },
    // C'est ICI que se joue la moitié de SPEC §5.2 que la table ne peut pas voir. `_version`
    // est le marqueur d'une notification acceptée. Une implémentation `Object.is` resterait à 0
    // sur les deux écritures `NaN` et échouerait ici.
    "notification-follows-object-is": async ({ signal: moteur }) => {
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
    // DIVERGENCE ASSUMÉE, déjà arbitrée par ADR-0004 et SPEC §21 : la baseline écrit son prototype
    // à la main, donc ses méthodes y sont énumérables et `for..in` les fait remonter. Une classe
    // ES2020 ne le fait pas. Le prix est ici, et il est bon : une énumération d'API qui change
    // selon le minificateur n'est pas une énumération d'API.
    "enumeration-skips-the-prototype": async ({ signal: moteur, Signal, Effect: ClasseEffet }) => {
        for (const proto of [Signal.prototype, ClasseEffet.prototype]) {
            for (const nom of ["peek", "toString", "toJSON", "valueOf", "dispose"]) {
                const d = Object.getOwnPropertyDescriptor(proto, nom);
                if (d === undefined)
                    continue;
                assert.equal(d.enumerable, false, `${nom} ne doit pas être énumérable`);
            }
        }
        // `brand` est sur le prototype et non énumérable — la divergence ci-dessus. Il reste
        // inscriptible et configurable comme la baseline, sur `conv#12` : s'écarter de la
        // compatibilité ici coûterait un ADR de plus pour protéger d'un accident.
        const marque = Object.getOwnPropertyDescriptor(Signal.prototype, "brand");
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
    // `computed#10` — l'ordre des dépendances est l'ordre de lecture, et la liste se parcourt
    // depuis la source lue EN DERNIER. `docs/architecture.md` §3 le dit de la même façon, et le
    // sens n'est pas indifférent : partir de la plus récemment utilisée, c'est ce qui autorise à
    // sortir dès qu'une version diffère.
    //
    // La baseline range sa liste à l'envers — sa tête est la source lue en PREMIER. C'est mesuré,
    // et c'est une différence d'implémentation interne, pas de comportement : la liste est à sens
    // unique et rien d'observable par la surface publique n'en dépend. Le nôtre suit le document,
    // parce qu'un seul sens de parcours rend le balayage non ambigu.
    "sources-in-read-order": async ({ signal: moteur, computed }) => {
        const premier = moteur(1);
        const second = moteur(2);
        const troisieme = moteur(3);
        const c = computed(() => premier.value * 100 + second.value * 10 + troisieme.value);
        c.value;
        const lus = [];
        for (let n = auRuntime(c)._sources; n !== undefined; n = n._next)
            lus.push(n._source);
        // `assert.equal` et non `deepEqual` : deux objets se comparent ici par RÉFÉRENCE, et c'est
        // l'identité qu'on vérifie. Un `deepEqual` traverserait le graphe entier — circulaire — et
        // comparerait des nœuds, ce qui n'est pas du tout la même question.
        assert.equal(lus.length, 3);
        assert.equal(lus[0], premier, "_sources est la source lue en premier");
        assert.equal(lus[1], second);
        assert.equal(lus[2], troisieme);
        c.value;
        c.value;
        const apres = [];
        for (let n = auRuntime(c)._sources; n !== undefined; n = n._next)
            apres.push(n._source);
        assert.equal(apres.length, 3, "trois lectures de plus ne perdent aucune dépendance");
        // Une dépendance quittée est retirée, même AU MILIEU de la liste.
        const bascule = moteur(true);
        const gauche = moteur("g");
        const milieu = moteur("m");
        const droite = moteur("d");
        const dyn = computed(() => (bascule.value ? milieu.value : `${gauche.value}${droite.value}`));
        dyn.value;
        // Le nœud de `milieu` est capturé PENDANT qu'il est dans la liste. Après l'abandon il n'y
        // est plus — c'est tout l'intérêt de la réconciliation — donc le chercher après ne
        // reviendrait pas, et la comparaison n'aurait rien à comparer.
        const nœudMilieuAvant = (() => {
            for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._next) {
                if (n._source === milieu)
                    return n;
            }
            return undefined;
        })();
        assert.ok(nœudMilieuAvant, "sanity : `milieu` a un nœud tant qu'elle est lue");
        bascule.value = false;
        dyn.value;
        const restants = [];
        for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._next)
            restants.push(n._source);
        assert.equal(restants.length, 3, "`milieu`, lue en second, est retirée");
        assert.equal(restants[0], bascule);
        assert.equal(restants[1], gauche);
        assert.equal(restants[2], droite);
        assert.equal(restants.includes(milieu), false, "et elle a disparu de la liste");
        // Le NŒUD est RÉACTIVÉ, pas réalloué. C'est SPEC §7, et c'est la seule façon de le voir :
        // la VALEUR serait juste même avec une réallocation, donc la valeur ne prouve rien.
        const noeudMilieuApres = (() => {
            for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._next) {
                if (n._source === milieu)
                    return n;
            }
            return undefined;
        })();
        assert.equal(noeudMilieuApres, undefined, "après abandon, `milieu` n'a plus de nœud dans la liste");
        bascule.value = true;
        dyn.value;
        const milieuReactive = [];
        for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._next)
            milieuReactive.push(n._source);
        assert.equal(milieuReactive.length, 2, "`milieu` redevient une dépendance");
        assert.equal(milieuReactive.includes(milieu), true, "`milieu` est de nouveau dans la liste");
        // Le nœud RÉACTIVÉ est le MÊME objet.
        const nœudMilieuReactive = (() => {
            for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._next) {
                if (n._source === milieu)
                    return n;
            }
            return undefined;
        })();
        assert.equal(nœudMilieuReactive, nœudMilieuAvant, "le nœud est RÉACTIVÉ, pas réalloué");
        // Et la liste ne grossit pas : trois allers-retours ne laissent aucun nœud derrière.
        for (let i = 0; i < 3; i++) {
            bascule.value = !bascule.value;
            dyn.value;
        }
        const finale = [];
        for (let n = auRuntime(dyn)._sources; n !== undefined; n = n._next)
            finale.push(n._source);
        assert.equal(finale.length, 3, "aucune fuite de nœud après six évaluations");
        assert.equal(finale.includes(bascule), true, "`bascule` est lue à chaque calcul, elle reste");
    },
    // SPEC §6.1 — douze propriétés-own pour un computé, dans l'ordre : les huit du signal puis
    // `_fn`, `_sources`, `_globalVersion`, `_flags`. Et `for..in` ne remonte rien du prototype.
    //
    // DIVERGENCE ASSUMÉE, arbitrée par ADR-0004 et SPEC §21 : la baseline construit
    // `Computed.prototype` comme une INSTANCE de signal, donc un prototype partagé, mutable et
    // vivant. Lire `.value` dessus condamne le prototype pour tous les computeds du même realm. Nous
    // ne le faisons pas, et `constructor` vaut `Computed` et non `Signal`.
    "class-shape": async ({ signal: moteur, computed, Signal, Computed, Effect: ClasseEffet }) => {
        const c = computed(() => 1);
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
        ]);
        assert.equal(c instanceof Signal, true);
        assert.equal(c instanceof Computed, true);
        assert.equal(c.constructor, Computed, "et non Signal : le prototype ne porte pas d'état");
        // Le prototype ne porte AUCUNE donnée d'instance. C'est le défaut qu'on supprime.
        const proto = Object.getPrototypeOf(c);
        assert.equal(proto._value, undefined, "le prototype ne doit porter aucune valeur");
        assert.equal(proto._fn, undefined, "le prototype ne doit porter aucune dérivation");
        // `for..in` expose les douze, et rien du prototype.
        const enumerables = [];
        for (const nom in c)
            enumerables.push(nom);
        assert.deepEqual(enumerables, Object.keys(c), "for..in ne doit rien ajouter du prototype");
        // L'effet a six propriétés-own, et le prototype n'en porte aucune.
        const e = new ClasseEffet(() => 1);
        assert.deepEqual(Object.keys(e), [
            "_fn",
            "_cleanup",
            "_sources",
            "_nextBatchedEffect",
            "_flags",
            "name",
        ]);
        const protoEffet = Object.getPrototypeOf(e);
        assert.equal(protoEffet._fn, undefined, "le prototype d'effet ne porte rien");
    },
    // `effect#34` — un effet créé dans un COMPUTÉ fuit : il en est créé un nouveau à chaque
    // évaluation. C'est un quirk FIGÉ de la baseline, pas un oubli de notre implémentation : un
    // computé est paresseux et sans destructeur, donc l'effet qu'il fabrique n'a personne pour le
    // ramasser. On fige le comportement, on ne le corrige pas.
    "computed-leaks-its-effects": async ({ signal: moteur, computed, effect: effet }) => {
        const a = moteur(0);
        const journal = [];
        const fabrique = computed(() => {
            journal.push(`outer:${a.value}`);
            effet(() => {
                journal.push(`inner:${a.value}`);
            });
            return a.value;
        });
        assert.equal(journal.length, 0, "rien avant la première lecture : le computé est paresseux");
        assert.equal(fabrique.value, 0);
        a.value = 1;
        assert.equal(fabrique.value, 1);
        a.value = 2;
        assert.equal(fabrique.value, 2);
        // Trois évaluations, donc trois effets intérieurs créés, et le journal compte six runs : c'est la
        // fuite, figée. Le compte est vérifié contre la baseline, qui donne exactement le même.
        assert.equal(journal.filter((e) => e.startsWith("outer:")).length, 3, "trois évaluations");
        assert.equal(journal.filter((e) => e.startsWith("inner:")).length, 6, "et six runs d'effets");
    },
    // `effect#36` — `options.name` est visible sur l'INSTANCE, et pas via la valeur de retour :
    // le retour est une fonction liée, dont le nom est `bound `. C'est ce qui rend l'instance
    // exportée indispensable.
    "options-de-linstance": async ({ Effect: ClasseEffet }) => {
        const e = new ClasseEffet(() => 1, { name: "n" });
        assert.equal(e.name, "n");
        e.name = "z";
        assert.equal(e.name, "z", "et le nom est mutable après coup");
        const sansNom = new ClasseEffet(() => 1);
        assert.equal(sansNom.name, undefined, "absent, c'est `undefined`");
        assert.equal("name" in sansNom, true, "mais la clé est toujours là");
    },
    // `effect#37` — les drapeaux initiaux. Un effet naît DÉJÀ observed, donc il ouvre les
    // abonnements de ses sources ; un computé naît en train de collecter, mais pas observed.
    "an-effect-is-observed-a-computed-is-not": async ({ signal: moteur, computed, Effect: ClasseEffet, }) => {
        const TRACKING = 32;
        const OUTDATED = 4;
        const e = new ClasseEffet(() => moteur(0).value);
        assert.equal(e._flags, TRACKING, "un effet est observed dès la construction");
        assert.equal((e._flags & OUTDATED) !== 0, false, "et pas encore périmé");
        const c = auRuntime(computed(() => 1));
        assert.equal(c._flags, OUTDATED, "un computé naît en collectant");
        assert.equal((c._flags & TRACKING) !== 0, false, "mais pas observed");
    },
    // `effect#40` — l'ordre de fermeture des effets imbriqués est le dernier ouvert, premier
    // fermé. C'est ce qui rend le collecteur de dépendances à un effet à la fois.
    //
    // CE TEST ÉTAIT VIDE, et la couverture l'a dit. Il comptait sur un deuxième run pour atteindre
    // sa branche `!first` — or son corps ne lisait AUCUN signal, donc rien ne pouvait le relancer,
    // donc l'assertion n'était jamais exécutée. Il passait sans rien tester, ce qu'un test de garde
    // ne doit jamais faire : il semble couvrir une branche, et le relevé montre qu'il ne la
    // couvre pas. Il vérifie donc ce qui est vérifiable par l'API — et le garde lui-même est
    // déplacé dans `guards-on-an-inconsistent-node`, parce qu'il faut refermer une portée
    // depuis l'intérieur d'une AUTRE, ce que l'API publique ne permet pas.
    "nested-effects-run-in-creation-order": async ({ signal: moteur, effect: effet }) => {
        const source = moteur(0);
        const journal = [];
        const d = effet(function () {
            journal.push("externe");
            const interne = effet(() => {
                journal.push("interne");
            });
            void interne;
        });
        d();
        assert.deepEqual(journal, ["externe", "interne"]);
    },
    // Les trois gardes restantes d'`Effect`, atteignables par l'intérieur — donc en test
    // signalcn-seul, et par la surface exportée : `Effect` est un des dix exports, et `_fn` et
    // `_flags` sont des internes documentés (SPEC §21). Aucun n'est atteignable par l'API publique :
    // c'est ce qui les distingue des scénarios de la table.
    "guards-on-an-inconsistent-node": async ({ Effect: ClasseEffet, signal: moteur, computed }) => {
        const RUNNING = 1 << 0;
        // `_callback` sur un effet sans `_fn` : la garde existe parce qu'un premier run qui leve
        // efface `_fn`, et l'effet reste dans la file de drainage.
        const sansFn = new ClasseEffet(() => 1);
        sansFn._fn = undefined;
        sansFn._callback();
        // `_start` sur un effet déjà en cours d'exécution : le garde du cycle. Le message vient du
        // moteur, on fige le TYPE.
        const dejaEnCours = new ClasseEffet(() => 1);
        dejaEnCours._flags |= RUNNING;
        assert.throws(() => dejaEnCours._callback(), Error);
        // Le garde du cycle INDIRECT d'un computé. Une source computé déjà en cours de calcul fait
        // que le balayage de staleness doit conclure « périmé » plutôt que « à jour » : c'est
        // `_refresh()` qui rend `false`. Sans ce chemin, le cycle indirect ne remonte pas jusqu'à
        // `get value`, qui est censé le lever.
        const source = moteur(0);
        const interne = auRuntime(computed(() => 1));
        const externe = auRuntime(computed(() => interne.value + source.value));
        assert.equal(externe.value, 1);
        source.value = 1; // le compteur global avance : le computé ne sort plus par la voie rapide
        interne._flags |= RUNNING;
        assert.throws(() => auRuntime(externe).value, /Cycle detected/);
        interne._flags &= ~RUNNING;
        // Le garde de fermeture hors ordre. La portée est ouverte ici, refermée depuis l'intérieur
        // d'un AUTRE effet : le collecteur courant n'est alors plus celui qu'on referme, et c'est le
        // désordre. Par l'API publique il est impossible — deux effets imbriqués se ferment en ordre
        // inverse, ce que `nested-effects-run-in-creation-order` vérifie.
        const aRefermer = new ClasseEffet(() => 1);
        const finir = aRefermer._start();
        new ClasseEffet(() => {
            assert.throws(() => finir(), /Out-of-order effect/);
        })._callback();
    },
    // `dispose#5` — un realm où `Symbol.dispose` est ABSENT fait de la clé la chaîne
    // `"undefined"` chez la baseline, et c'est un quasi-leak : `using` devient un no-op qui fuit
    // tous les effets. Le cas POSITIF n'est pas mesurable ici — il faudrait éteindre le symbole
    // dans le realm — donc on ne fige que ce qui l'empêche.
    "symbol-dispose-missing-leaves-no-stray-key": async ({ effect: effet }) => {
        const d = effet(() => { });
        assert.equal(
        // biome-ignore lint/suspicious/noPrototypeBuiltins: la cible est ES2020 (`lib` du tsconfig) et `Object.hasOwn` est ES2022 — le correctif de la règle ferait tomber `tsc`.
        Object.prototype.hasOwnProperty.call(d, "undefined"), false, 'aucune clé `"undefined"` n\'est posée sur le dispositeur');
    },
    // Les deux exigences de SPEC §8.2, côte à côte, parce qu'elles semblaient s'exclure.
    // Elles ne s'excluent pas : V8 refuse une fonction *liée* dont `Symbol.dispose` pointe sur
    // elle-même, et accepte une fonction simple. Le `bind` de la baseline était le seul
    // obstacle — un effet, et non une divergence.
    "symbol-dispose-et-using": async ({ effect: effet }) => {
        const journal = [];
        const d = effet(() => {
            journal.push("run");
            return () => journal.push("cleanup");
        });
        assert.equal(Symbol.dispose in d, true, "Symbol.dispose doit être présent");
        assert.equal(typeof d[Symbol.dispose], "function", "et DOIT être une fonction, sinon `using` échoue");
        // Et l'IDENTITÉ : `d[Symbol.dispose] === d`, comme l'exige SPEC §8.2. Elle ne coûte pas
        // `using`, parce que V8 ne refuse que les fonctions *liées* dont la méthode pointe sur
        // elles-mêmes — une fonction simple passe. C'est ce que le test ci-dessous mesure.
        assert.equal(d[Symbol.dispose], d, "SPEC §8.2 exige que la méthode de libération soit le dispositeur lui-même");
        const portee = () => {
            const env_1 = { stack: [], error: void 0, hasError: false };
            try {
                const _ = __addDisposableResource(env_1, d, false);
                journal.push("corps");
            }
            catch (e_1) {
                env_1.error = e_1;
                env_1.hasError = true;
            }
            finally {
                __disposeResources(env_1);
            }
        };
        portee();
        assert.deepEqual(journal, ["run", "corps", "cleanup"]);
    },
    // SPEC §14 — un signal gelé lève en écriture. Le mode strict du module de test le fait.
    "write-on-frozen-signal-throws": async ({ signal: moteur }) => {
        const s = auRuntime(Object.freeze(moteur(1)));
        assert.throws(() => {
            s.value = 2;
        }, TypeError);
    },
};
/**
 * Combien de tests ce fichier ENREGISTRE, une fois exécuté par `node --test`.
 *
 * Le compte n'est pas une constante écrite à la main : il se déduit des trois structures qui
 * produisent les tests — la table, les tests signalcn-seul, et le contrôle du registre. Une
 * constante écrite à la main serait fausse au premier scénario ajouté, et le mensonge serait
 * silencieux : le contrôle comparerait un chiffre périmé à un décompte exact et conclurait que
 * tout va bien.
 *
 * C'est ce qu'exige la parité. « Le build passe » ne prouve rien si la suite a perdu la moitié de
 * ses tests en route ; « le build passe, et il a fait exactement ce nombre de tests » prouve que
 * le même code a tourné partout.
 */
export const NB_TESTS = scenarios.length + Object.keys(testsSignalcnSeul).length + 1;
/**
 * Les tests `signalcn-seul` que le harnais PEUT rejouer contre le paquet installé, déduits du
 * registre — jamais écrits à la main, pour la même raison que `matrice` : deux listes divergent.
 *
 * LA RÈGLE, et elle est une seule : un test est rejouable si **aucune** entrée qui le cite ne
 * porte de marqueur. Le marqueur dit « cette observation ne peut rien porter sur l'artefact », donc
 * une seule entrée ainsi marquée suffit à rendre le test entier non rejouable — même si les autres
 * entrées qu'il couvre seraient confrontables, parce que le test lit alors, quelque part, un champ
 * que l'artefact a minifié.
 *
 * Le motif qui décide de cela est `MARQUEUR`, plus haut : le même que `registre-complet` exige et
 * que la porte de documentation cherche. Il est écrit UNE fois dans le dépôt, donc ces trois
 * lectures ne peuvent pas dire trois choses différentes — ce qu'elles faisaient.
 */
export const REJOUABLES = Object.keys(testsSignalcnSeul).filter((nom) => {
    const cite = `signalcn-seul/${nom}`;
    return !Object.values(COUVERTURE).some((destination) => destination.includes(cite) && morceaux(destination).some((morceau) => MARQUEUR.test(morceau)));
});
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
            const { signal: s, computed, effect, batch, untracked, action, createModel, Signal, Computed, Effect, } = await runtime;
            run({
                signal: s,
                computed,
                effect,
                Signal,
                Computed,
                Effect,
                batch,
                untracked,
                action,
                createModel,
            }, makeLog());
        });
    }
    for (const [nom, corps] of Object.entries(testsSignalcnSeul)) {
        test(`signalcn-seul/${nom}`, async () => {
            await corps(await moteurDe());
        });
    }
    // ---- Le registre est complet ------------------------------------------------------
    test("registre-complet", () => {
        const manquantes = ENTREES_ATTENDUES.filter((id) => !(id in COUVERTURE));
        assert.deepEqual(manquantes, [], `entrées de matrice sans aucune destination : ${manquantes.join(", ")}`);
        const surnumeraires = Object.keys(COUVERTURE).filter((id) => !ENTREES_ATTENDUES.includes(id));
        assert.deepEqual(surnumeraires, [], `entrées de couverture qui n'existent pas : ${surnumeraires.join(", ")}`);
        // Chaque destination nommée doit exister. Les noms viennent de deux côtés : les scénarios d'une
        // part, les clés de l'objet de tests d'autre part — donc aucune liste séparée qui pourrait
        // outliver ce qu'elle désigne. Et il n'y a plus de destinations « par numéro de ticket » :
        // un ticket est une PROMESSE, pas une couverture, et une promesse se périme sans bruit. Les
        // cinq qui vivaient sur un numéro — `computed#26`, `untracked#10` à `#13`, `dispose#4` —
        // sont maintenant couvertes par des scénarios, ou elles ne l'étaient pas.
        const noms = new Set([
            ...scenarios.map((s) => s.name),
            ...Object.keys(testsSignalcnSeul).map((nom) => `signalcn-seul/${nom}`),
        ]);
        // Un MARQUEUR remplace un nom de test quand l'observable ne peut rien porter sur le paquet
        // installé. Deux espèces, parce qu'elles n'ont pas la même conséquence : `source:` dit que
        // l'observation n'existe que sur les sources de la référence, `divergence:` que signalcn fait
        // délibérément autre chose. Les deux cites OÙ, jamais pourquoi : la raison est au §21, et
        // c'est une porte — celle de documentation — qui vérifie qu'elle y est. Cette suite ne peut
        // pas le faire elle-même : elle est un artefact distribué, et SPEC.md n'est pas distribué.
        //
        // La forme est `MARQUEUR`, ci-dessus, et elle n'est écrite qu'une fois dans le dépôt : ici, dans
        // `REJOUABLES`, et dans la porte de documentation.
        for (const [id, destination] of Object.entries(COUVERTURE)) {
            for (const morceau of morceaux(destination)) {
                assert.ok(noms.has(morceau) || MARQUEUR.test(morceau), `${id} cite "${morceau}", qui n'est ni un test ni un marqueur de la forme ` +
                    `"source:<ref>" ou "divergence:<ref>". Toute destination se justifie : un scénario, ` +
                    `un test \`signalcn-seul\`, ou un marqueur qui dise où l'observation a été prise.`);
            }
        }
        // L'AUTRE SENS. Ci-dessus on vérifie que toute destination nommée existe. On ne vérifiait pas
        // qu'inversement tout test est cité — donc un test orphelin passait, ce qui est exactement le
        // défaut qu'un registre doit interdire : il_a_l'air de couvrir, et rien ne le rattache à une
        // entrée. Un `guards-on-an-inconsistent-node` s'est trouvé orphelin de la même façon, écrit un commit
        // plus tôt, sans qu'aucune porte ne bronche.
        //
        // Les DEUX genres passent par là, dans le même esprit et avec le même message : un test
        // `signalcn-seul` ET un scénario. Le contrôle n'en visait qu'un, et l'autre est resté nu —
        // `batch/strict-snapshot-identity` rejouait la baseline depuis plusieurs tranches sans
        // qu'aucune entrée le cite, donc sa `matrice` était vide et rien ne le disait. Un orphelin ne
        // perd rien : le harnais rejoue TOUS les scénarios, table ou non. Il perd ce qui seul compte,
        // la traçabilité — et une matrice qui ne sait pas ce qu'un scénario rejoue ne peut pas dire
        // qu'il le rejoue.
        const citees = new Set(Object.values(COUVERTURE).flatMap((destination) => morceaux(destination)));
        for (const [genre, singulier, liste] of [
            [
                "tests signalcn-seul",
                "Un test",
                Object.keys(testsSignalcnSeul).map((nom) => `signalcn-seul/${nom}`),
            ],
            ["scenarios", "Un scenario", scenarios.map(({ name }) => name)],
        ]) {
            const orphelins = liste.filter((nom) => !citees.has(nom));
            assert.deepEqual(orphelins, [], `${genre} qu'aucune entree de matrice ne cite : ${orphelins.join(", ")}. ` +
                `${singulier} que rien ne rattache a une entree ne couvre rien : il semble couvrir, ` +
                `et la matrice ne le sait pas.`);
        }
        // Et le champ `matrice` de chaque scénario est bien ce que le registre lui attribue. La
        // déduction le garantit, donc un écart ici serait un bug : on le vérifie quand même, parce
        // qu'une déduction peut être cassée sans que rien ne le signale.
        for (const scenario of scenarios) {
            assert.deepEqual(scenario.matrice, entreesCouvertesPar(scenario.name), `${scenario.name} a un champ matrice désynchronisé du registre`);
        }
    });
}
