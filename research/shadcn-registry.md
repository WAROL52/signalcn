# Schéma shadcn : les 6 items, registryDependencies et alias

Ticket #10. Recherche documentée, sources vérifiées, aucune modification du dépôt.

Chaque affirmation porte sa source : soit une page de documentation officielle avec son URL,
soit la version du schéma JSON, soit une commande réellement exécutée dont la sortie est citée.

## 0. Versions visées

| Élément | Valeur | Source |
| --- | --- | --- |
| CLI `shadcn` testée | **4.21.0** (publiée le 2026-09-04, dernière à date) | `npm view shadcn version` → `4.21.0` ; `npm view shadcn time --json` |
| Schéma registry racine | `https://ui.shadcn.com/schema/registry.json` (JSON Schema draft-07, 1862 octets) | `curl -sL https://ui.shadcn.com/schema/registry.json` → HTTP 200 |
| Schéma item | `https://ui.shadcn.com/schema/registry-item.json` (draft-07, 318 lignes) | `curl -sL https://ui.shadcn.com/schema/registry-item.json` → HTTP 200 |
| Code CLI inspecté | `shadcn@4.21.0`, `dist/chunk-4WBGNKSZ.js` (schémas zod) et `dist/chunk-B2MD6U5O.js` (résolveurs) | `npm pack shadcn@4.21.0` puis `tar xzf` |

**Version minimale pour les registres GitHub.** Les adresses `owner/repo/item` sont apparues en
**4.10.0**. Bisecté par exécution réelle :

```console
$ npx shadcn@4.8.0  view shadcn-ui/registry-template-v3/hello-world   # KO
$ npx shadcn@4.9.0  view shadcn-ui/registry-template-v3/hello-world   # KO
$ npx shadcn@4.10.0 view shadcn-ui/registry-template-v3/hello-world   # OK
$ npx shadcn@4.21.0 view shadcn-ui/registry-template-v3/hello-world   # OK
```

Cible retenue : **`shadcn@4.21.0`**, et `>= 4.10.0` en plancher. En dessous, aucune adresse
GitHub — donc aucune distribution.

Les placeholders d'alias dans `files[].target` (`@lib/`, `@ui/`, `@components/`, `@hooks/`)
sont bien plus récents : ils sont annoncés comme livrés en **4.7.0** par un mainteneur dans
[shadcn-ui/ui#8092](https://github.com/shadcn-ui/ui/issues/8092) (« This is now shipped in
4.7.0 »), sur la demande d'origine « Allow Subdirectories in `registry:lib` File Paths ».
Vérifié en 4.21.0 (section 3).

---

## 1. Structure du `registry.json` racine

Champs de premier niveau, d'après `https://ui.shadcn.com/schema/registry.json` :

| Champ | Type | Obligatoire | Note |
| --- | --- | --- | --- |
| `$schema` | `string` | non | URL du schéma, pour l'autocomplétion éditeur |
| `name` | `string` | **oui, sur le fichier racine** | « Required when this file is used as the root registry, optional for included registry chunks » |
| `homepage` | `string` | **oui, sur le fichier racine** | idem |
| `include` | `string[]` | oui **à la place** de `items` | chemins relatifs vers des `registry.json` ; pas de raccourci dossier, pas d'URL distante |
| `items` | `registry-item[]` | oui **à la place** de `include` | `default: []` |
| `pagination` | `{total, offset, limit, hasMore}` | non | uniquement pour les catalogues paginés côté serveur |

Contrainte structurelle du schéma : `anyOf: [{required:["items"]},{required:["include"]}]`.

`name` et `homepage` ne sont pas marqués `required` par le JSON Schema, mais **ils le sont à
l'exécution**, et c'est une erreur dure. Vérifié :

```console
$ cd /tmp/opencode/probe6 && npx shadcn@4.21.0 build
Message:
Invalid root registry file at /tmp/opencode/probe6/registry.json: root registry.json must
define "name" and "homepage". Included registry.json files may omit these fields.
```

Le même message existe dans le code du résolveur (`function Gi`, `chunk-B2MD6U5O.js`) et il
précise que seuls les `registry.json` **inclus** peuvent s'en passer.

> Note : le schéma zod du CLI (`chunk-4WBGNKSZ.js`, objet `R`) impose `name` et `homepage` au
> niveau racine par construction ; le schéma zod non-racine (`b`) ne les impose pas. Les deux
> Couchées sont d'accord.

**`shadcn build` est-il obligatoire ? Non, pour un registre GitHub.** Le CLI lit le
`registry.json` racine, résout `include`, puis va chercher **chaque fichier source directement
dans le dépôt** et l'inline lui-même. Preuve : `shadcn-ui/registry-template-v3` n'a **pas** de
sortie de build committée, et pourtant :

```console
$ curl -sL -o /dev/null -w "HTTP %{http_code}\n" https://raw.githubusercontent.com/shadcn-ui/registry-template-v3/HEAD/public/r/registry.json
HTTP 404

$ cd /tmp/opencode/probe2/app && npx shadcn@4.21.0 registry validate shadcn-ui/registry-template-v3
- Validating registry.
✔ Registry is valid.
✔ Checked 1 registry file and 3 items.
  - registry.json
```

`shadcn build` reste utile pour **publier** un registre HTTP (`public/r/*.json` avec `content`
inliné), et il est obligatoire dans ce cas : le résolveur de fichiers locaux/URL
(`function Ii` dans `chunk-B2MD6U5O.js`) ne lit que le JSON et n'ouvre aucun fichier voisin.
Pour `signalcn` en registre GitHub : `build` est optionnel, c'est un bonus de distribution.

---

## 2. Schéma d'un item : liste exhaustive

D'après `https://ui.shadcn.com/schema/registry-item.json` **et** le schéma zod du CLI 4.21.0
(`chunk-4WBGNKSZ.js`). Les deux sont listés parce qu'ils divergent sur deux points.

### Champs lus par le CLI

| Champ | Type | Obligatoire | Effet à l'installation |
| --- | --- | --- | --- |
| `name` | `string` | **oui** | identifiant de l'item ; unique dans tout le registre résolu, `include` compris |
| `type` | énumération | **oui** | détermine le dossier cible par défaut et l'affichage de `shadcn list` |
| `$schema` | `string` | non | ignoré |
| `title` | `string` | non | libellé humain |
| `author` | `string` (min 2 car.) | non | métadonnée |
| `description` | `string` | non | métadonnée |
| `registryDependencies` | `string[]` | non | voir section 4 |
| `dependencies` | `string[]` | non | **npm**, installé par le package manager détecté |
| `devDependencies` | `string[]` | non | **npm**, idem |
| `files` | `files[]` | non | charge utile ; peut être absent (item-alias, section 5) |
| `tailwind` | `{config:{content,theme,plugins}}` | non | **déprécié** côté docs, à remplacer par `cssVars.theme` en Tailwind v4 |
| `cssVars` | `{theme, light, dark}` | non | fusionné dans la feuille CSS du projet (via PostCSS) |
| `css` | objet récursif (at-rules, sélecteurs, `@utility`, `@keyframes`, `@plugin`) | non | ajouté à la feuille CSS du projet |
| `envVars` | `{[k]: string}` | non | ajouté à `.env.local`/`.env`, **sans écraser** l'existant |
| `docs` | `string` (markdown) | non | message affiché par la CLI pendant l'installation |
| `categories` | `string[]` | non | métadonnée |
| `meta` | `{[k]: any}` | non | métadonnée libre |
| `extends` | `string` | non | **réservé à `registry:style`** (interdit par le JSON Schema sur tout autre type) |
| `style`, `iconLibrary`, `baseColor`, `theme` | `string` | non | **réservés à `registry:base`** ; le JSON Schema les **interdit** explicitement sur les autres types |
| `font` | `{family, provider, import, variable, weight?, subsets?, selector?, dependency?}` | oui si `registry:font` | police ; `font` est **interdit** par le JSON Schema sur tout autre type |
| `config` | objet | non (zod seul) | `registry:base` uniquement ; absent du JSON Schema |

### Types d'items (`type`)

JSON Schema — 12 valeurs :
`registry:lib`, `registry:block`, `registry:component`, `registry:ui`, `registry:hook`,
`registry:theme`, `registry:page`, `registry:file`, `registry:style`, `registry:base`,
`registry:font`, `registry:item`.

Énumération zod du CLI — **14 valeurs**, deux de plus : `registry:example` et
`registry:internal`. Elles sont acceptées par la CLI mais **absentes du JSON Schema** : un
éditeur validera `registry-item.json` et signalera une erreur. À éviter.

### Ce qui est toléré puis ignoré — et ce qui est supprimé

Deux comportements distincts, tous deux vérifiés :

1. **Champs inconnus tolérés au chargement.** Le schéma zod d'item est étendu avec
   `.passthrough()` (`chunk-4WBGNKSZ.js` : `m.extend({...}).passthrough()`). Tout champ non
   déclaré est **accepté silencieusement** et n'est jamais lu.
2. **Champs inconnus supprimés au build.** `shadcn build` utilise le schéma zod **sans**
   `passthrough()` : les clés inconnues sont retirées de la sortie.

Vérification des deux, avec un item portant `targets` et `aliases` au niveau item :

```console
$ npx shadcn@4.21.0 build            # dans /tmp/opencode/probe2/reg
- Building signals...
✔ Building registry.

$ cat public/r/signals-alias.json     # `targets` et `aliases` ont disparu
{
  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "name": "signals-alias",
  "registryDependencies": [ "button" ],
  "files": [ { "path": "registry/default/signals.ts", "content": "...", "type": "registry:lib" } ],
  "type": "registry:block"
}

$ npx shadcn@4.21.0 add ../reg2/unknown.json --yes --overwrite --dry-run
┌ shadcn add ../reg2/unknown.json (dry run)
├ Files (1) +1 new
│ + src/lib/signals.ts  create
```

Conclusion nette : **`targets` et `aliases` au niveau item n'existent pas.** Ni dans le JSON
Schema, ni dans la documentation, ni dans le code. Ils sont tolérés au chargement, ignorés,
et supprimés au build. Le seul mécanisme de destination est `files[].target` (section 3 et 8).

---

## 3. `files[]`

Schéma (`registry-item.json`, `properties.files.items`) : `path` (obligatoire), `type`
(obligatoire), `content` (optionnel, renseigné par le build ou par le CLI), `target`
(**obligatoire si et seulement si `type` vaut `registry:file` ou `registry:page`**).

### `path`

- Format : chemin **relatif au répertoire du `registry.json` qui déclare l'item**. Le code fait
  `join(registryDir, path)` (`function Bu` / `function Ui` dans `chunk-B2MD6U5O.js`).
  Avec `include`, chaque item lit ses fichiers depuis le dossier de son propre
  `registry.json` (documenté : « item file paths are read relative to the `registry.json` file
  that declares the item »).
- **Oui, un dossier source est autorisé** : `registry/default/signals.ts` est le format
  utilisé par le registre shadcn lui-même et par le template officiel
  `shadcn-ui/registry-template-v3`.
- Sans `target`, le préfixe de dossier est **écarté** et seul le nom de base est conservé.
  La fonction `bl(path, base)` cherche le nom du dossier cible (`lib`, `ui`, `components`,
  `hooks`) dans les segments du `path` ; s'il ne s'y trouve pas, elle retourne
  `basename(path)`. Le dossier d'installation par défaut est `xl(type)` :
  `registry:ui` → `aliases.ui`, `registry:lib` → `aliases.lib`,
  `registry:block`/`registry:component` → `aliases.components`, `registry:hook` → `aliases.hooks`,
  **tout le reste** → `aliases.components`.

  Mesuré sur un projet `aliases: {lib:"@/lib", hooks:"@/hooks", ui:"@/components/ui"}` avec
  `src/` :

  ```console
  $ npx shadcn@4.21.0 add ../reg2/notargets.json --yes --overwrite --dry-run
  │ + src/lib/notarget-lib.ts               create      # type registry:lib,        path notarget-lib.ts
  │ + src/components/notarget-component.ts  create      # type registry:component,  path notarget-component.ts
  │ + src/hooks/notarget-hook.ts            create      # type registry:hook,       path notarget-hook.ts
  │ + src/components/ui/notarget-ui.ts      create      # type registry:ui,         path notarget-ui.ts
  │ + src/lib/nested.ts                     create      # path registry/default/deep/nested.ts
  │ + src/lib/inner.ts                      create      # path registry/default/lib/inner.ts
  ```

  Conséquence importante : **sans `target`, un `registry:file` atterrit dans `components/`.**
  C'est ce qui casse le chemin relatif d'un fichier de test (section 9).

### `target`

- **Oui, on peut renommer un fichier à l'installation.** `target` remplace intégralement le
  chemin de destination ; le nom du fichier source n'a plus de rapport. Vérifié :

  ```console
  # items[].files[0] = { "path": "signals.test.min.js", "type": "registry:file", "target": "@lib/signals.test.js" }
  $ npx shadcn@4.21.0 add ../reg2/rename.json --yes --overwrite
  ℹ Updated 1 file:
    - src/lib/signals.test.js
  ```

- Formes acceptées (documentation officielle + code) :
  - `~/chemin/vers/fichier` → racine du projet, **sans** injection de `src/`
    (`ar()` : `if(e.target.startsWith("~/")) return join(cwd, e.target.replace("~/",""))`).
  - `@components/…`, `@ui/…`, `@lib/…`, `@hooks/…` → placeholders résolus depuis
    `aliases.*` de `components.json`. La liste blanche est figée dans le code :
    `var Bc=["components","ui","lib","hooks"]` (`function Nr`). Ils ne sont reconnus **qu'en
    début** de `target` (`/^@([^/]+)\/(.+)$/`). Le reste est préservé :
    `@ui/ai/prompt-input.tsx` → `<ui>/ai/prompt-input.tsx`.
  - Un placeholder inconnu (`@foo/bar.ts`) est traité comme un chemin ordinaire → `foo/bar.ts`.
  - Un chemin nu (`lib/x.ts`) est relatif à la racine, **ou** à `src/` si le projet a un
    dossier `src/` (`ar()` : `isSrcDir ? join(cwd,"src",i.replace("src/","")) : join(cwd, i…)`).
  - Un `target` qui s'échappe de la racine de son placeholder lève une erreur explicite :
    `Invalid target path "…". Target paths using @<x>/ must stay within the <x> alias root.`
  - Un chemin contenant `..` est rejeté avant écriture (`function ka`).

- `target` accepte les **sous-répertoires** : c'est exactement ce que la demande d'origine
  [shadcn-ui/ui#8092](https://github.com/shadcn-ui/ui/issues/8092) cherchait à obtenir, et la
  réponse maintenue pointe vers
  [`/docs/registry/examples#target-placeholders`](https://ui.shadcn.com/docs/registry/examples#target-placeholders).

### `content`

Optionnel dans les deux couches. Pour un **registre GitHub**, il est inutile : le CLI lit le
fichier source sur `raw.githubusercontent.com` et l'inline lui-même (`function Wu` +
`function Uu`, avec le message d'erreur
`Failed to read file "…" for registry item "…". Expected file at <chemin>.` /
`Make sure the file path is relative to the registry.json file that declares the item.`).
Pour un registre HTTP ou un fichier `.json` local, `content` est obligatoire en pratique.

---

## 4. `registryDependencies` — le point critique

### Ce que c'est

Un tableau de **strings**, où chaque string est une **adresse d'item** — jamais un nom de type,
jamais un type d'item. La description du JSON Schema le dit explicitement :

> « An array of registry items that this item depends on. Use the name of the item to reference
> shadcn/ui components and urls to reference other registries. »

La documentation ajoute les formes d'adresses supportées
([`/docs/registry/registry-item-json`](https://ui.shadcn.com/docs/registry/registry-item-json#registrydependencies)) :

| Forme | Signification |
| --- | --- |
| `button` | item du registre shadcn/ui intégré |
| `@acme/input-form` | registre namespacé déclaré dans `components.json.registries` |
| `acme/ui/button` | adresse GitHub : `owner/repo/item` |
| `acme/ui/button#v1.2.0` | adresse GitHub épinglée (branche, tag ou SHA 40 caractères) |
| `https://example.com/r/foo.json` | item servi par URL |
| `./foo.json` | fichier item local |

### Fonctionne-t-il pour un item défini dans le même `registry.json` ?

**Oui, mais uniquement via l'adresse GitHub complète. Un nom nu ne désigne JAMAIS le même
registre.** C'est le point le plus important du dossier, et il est doublement sourcé.

Documentation, `/docs/registry/registry-item-json` :

> Note: Bare names keep their existing behavior. `button` means the built-in shadcn `button`
> item, not an item from the same GitHub repository. For same-repository GitHub dependencies,
> use the full GitHub item address.

FAQ, `/docs/registry/faq` (« Why does `button` in `registryDependencies` not resolve to my
GitHub repository? ») :

> Bare registry dependency names keep the existing shadcn behavior. `button` means the
> built-in shadcn `button` item.

`/docs/registry/github` (« Same repository dependencies ») montre la forme attendue :

```json
"registryDependencies": [
  "acme/toolkit/agent-rules",
  "acme/toolkit/prettier-config",
  "acme/toolkit/tsconfig"
]
```

Le code confirme : `function Ee` (résolveur d'items) retombe sur
`styles/${config.style ?? "new-york-v4"}/${name}.json` pour tout nom nu — c'est-à-dire
`https://ui.shadcn.com/r/styles/…/`. La fonction `Ll` reconnaît `owner/repo/…` comme
`{scheme:"github"}` et `function Ur` va chercher l'item **par son nom dans le `registry.json`
racine du dépôt cible**. Le nom de l'item est donc résolu dans le registre distant, ce qui est
exactement ce qu'il faut pour `WAROL52/signalcn/signals`.

### Les deux pièges, mesurés

**Piège A — collision silencieuse avec le registre shadcn.** Un nom nu qui existe chez
shadcn installe le mauvais code, sans avertissement. Item de test
(`registryDependencies: ["button"]`, dans un registre local) :

```console
$ npx shadcn@4.21.0 add ../reg/public/r/signals-alias.json --yes --overwrite --dry-run
┌ shadcn add ../reg/public/r/signals-alias.json (dry run)
├ Files (2) +1 new, =1 skip
│ + src/components/ui/button.tsx  create      ← le button de shadcn/ui, pas le nôtre
│ = src/lib/signals.ts            skip (identical)
├ Dependencies (2)
│ + cn
│ + radix-ui
```

**Piège B — échec dur et message trompeur.** Un nom nu qui n'existe pas chez shadcn produit une
erreur qui accuse `ui.shadcn.com` :

```console
# items[0].registryDependencies = ["signals"]
$ npx shadcn@4.21.0 add /tmp/opencode/probe2/reg2/silentfail.json --yes --overwrite
Message:
The item at https://ui.shadcn.com/r/styles/new-york-v4/signals.json was not found. It may not
exist at the registry.
```

Pour `signalcn`, dont les noms d'items sont précisément des mots que shadcn connaît
(`button`, `card`, `input` sont courants ; `signals` ne l'est pas aujourd'hui mais
`signals` est un mot à risque), la seule règle défendable est : **toute**
`registryDependencies` d'un registre GitHub utilise la forme `owner/repo/item`, jamais un nom nu.

### Collision avec le schéma npm `dependencies` ?

Aucun conflit de champ, mais un piège de lecture. Les deux sont des tableaux de strings et
n'ont aucun recouvrement de type :

| | `dependencies` | `registryDependencies` |
| --- | --- | --- |
| Nature | paquet npm | item de registre |
| Exemple | `["zod", "is-even@3.0.0"]` | `["acme/ui/button"]` |
| Effé | `npm install` / `pnpm add` via le package manager détecté | résolution + installation de fichiers |
| Schéma zod | `z.array(z.string()).optional()` | `z.array(z.string()).optional()` |

Le seul recouvrement est sémantique : un nom nu dans `registryDependencies` **ressemble** à un
nom de paquet. Le README de `signalcn` ne déclare aucune dépendance npm runtime, donc
`dependencies` et `devDependencies` restent vides — c'est le bon choix, et il n'y a rien à
déclarer pour les six items.

### Refs non hérités

> Refs are not inherited across dependencies. If a GitHub dependency should be reproducible,
> pin that dependency to its own tag or full commit SHA.
> — `/docs/registry/registry-item-json`

Confirmé par le code : `tt()` appelle `Qe(item.registryDependencies, config)` sans jamais
transmettre le ref du parent à `qr()`. Conséquence directe : si l'utilisateur lance
`shadcn add WAROL52/signalcn/signals-test#v1.0.0`, la dépendance déclarée
`WAROL52/signalcn/signals` sera résolue sur la **branche par défaut**, pas sur `v1.0.0`. Pour
une bibliothèque qui promet un contrat de comportement figé, c'est un défaut de reproductibilité
réel. Deux réponses : épingler la dépendance dans l'item
(`"WAROL52/signalcn/signals-js#v1.0.0"`), ou le dire explicitement dans le README.

### Exemple concret et vérifié de `registry.json` minimal

Déclaré puis installé, avec un `registryDependencies` réel résolu de bout en bout :

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "signalcn",
  "homepage": "https://github.com/WAROL52/signalcn",
  "items": [
    {
      "name": "signals",
      "type": "registry:lib",
      "title": "Signals (TypeScript)",
      "description": "Cœur de signalcn en TypeScript.",
      "files": [{ "path": "registry/default/signals.ts", "type": "registry:lib" }]
    },
    {
      "name": "signals-test",
      "type": "registry:file",
      "title": "Scénarios (TypeScript)",
      "description": "Scénarios de conformité.",
      "registryDependencies": ["WAROL52/signalcn/signals"],
      "files": [
        {
          "path": "registry/default/signals.test.ts",
          "type": "registry:file",
          "target": "@lib/signals.test.ts"
        }
      ]
    }
  ]
}
```

Installation réelle (adresse GitHub résolue, via une sonde locale équivalente pour ne pas
dépendre d'un réseau de test) :

```console
$ npx shadcn@4.21.0 add built/signals-test.json --yes --overwrite
- Checking registry.
✔ Checking registry.
- Updating files.
✔ Created 2 files:
  - src/lib/signals.ts
  - src/lib/signals.test.ts

$ cat src/lib/signals.test.ts
import { signal } from "./signals.js"
console.log(signal(1).value)
```

Et la résolution d'une adresse GitHub `owner/repo/item` dans `registryDependencies`, testée
contre un dépôt public réel, avec résolution transitive :

```console
# items[0].registryDependencies = ["shadcn-ui/registry-template-v3/hello-world"]
$ npx shadcn@4.21.0 add ../reg2/crossrepo.json --yes --overwrite --dry-run
├ Files (3) +3 new
│ + src/components/ui/button.tsx    create    ← registryDependencies de l'item distant
│ + src/components/hello-world.tsx  create    ← l'item distant lui-même
│ + signals-probe.ts                create    ← l'item local
```

---

## 5. Items `registry:block` et item-alias

`registry:block` est documenté comme « Use for complex components with multiple files »
([table des types](https://ui.shadcn.com/docs/registry/registry-item-json#type)). Il n'a
**aucune sémantique spéciale** : c'est un type d'item comme un autre, dont le seul effet
spécifique est le dossier cible par défaut quand un fichier n'a pas de `target`
(`xl()` : `registry:block` → `aliases.components`).

**Existe-t-il un item qui n'est qu'un alias d'un autre ? Oui.** Le schéma n'exige pas `files`,
et le CLI accepte et installe un item sans aucun fichier, dont la seule charge utile est une
`registryDependencies`. Vérifié :

```console
# signals-test-js.json : { "name":"signals-test-js", "type":"registry:block",
#   "registryDependencies":["<adresse de signals-js>"] }  — aucun champ "files"
$ npx shadcn@4.21.0 add ../reg2/aliasonly.json --yes --overwrite --dry-run
┌ shadcn add ../reg2/aliasonly.json (dry run)
├ Files (1) +1 new
│ + src/lib/signals.js  create
│ 1 file
```

C'est la réponse directe à la question du ticket : `signals-test-js` n'a pas besoin d'être un
simple alias de `signals-test`. Il lui faut **son propre fichier** `signals.test.js`, qui est un
artefact distinct avec sa propre cible, plus une dépendance à `signals-js`. Le §9 montre que
c'est ce montage qui fait survivre le chemin relatif.

Il n'existe en revanche **aucun** champ `alias`, `extends` hors `registry:style`, ni mécanisme
de renommage d'item. La demande historique « Registry alias »
([shadcn-ui/ui#7288](https://github.com/shadcn-ui/ui/issues/7288), closed) portait sur
l'alias de *registre* dans `components.json`, pas d'item, et a été fermée pour inactivité.

---

## 6. Aliases

Il y a **deux** notions à ne pas confondre, et la question du ticket les mêle.

### 6.1 `aliases` côté projet — c'est le seul qui existe

`components.json` (schéma zod `o`, `.strict()`), documenté dans
[`/docs/components-json`](https://ui.shadcn.com/docs/components-json#aliases) :

```json
"aliases": {
  "components": "@/components",
  "ui": "@/components/ui",
  "lib": "@/lib",
  "hooks": "@/hooks",
  "utils": "@/lib/utils"
}
```

`components` et `utils` sont obligatoires ; `ui`, `lib`, `hooks` sont optionnelles et
retombent sur le dossier voisin. Ces valeurs sont **la seule chose qui décide** où un fichier
sans `target` atterrit, et les seuls noms de placeholders `@x/` acceptés sont
`components`, `ui`, `lib`, `hooks` (`var Bc=["components","ui","lib","hooks"]`).

Le `README.md` de `signalcn` montre `import … from "@/lib/signals"`. C'est la convention
shadcn et cela suppose que le consommateur ait `aliases.lib = "@/lib"` **et** un `tsconfig.json`
avec `paths: {"@/*": ["./src/*"]}`. C'est documenté, mais cela fait porter à l'utilisateur une
dépendance à la configuration TypeScript. Pour une bibliothèque « vanilla, sans framework »,
un import relatif dans l'artefact installé est plus robuste — voir §9.

### 6.2 Aliases par item ou par fichier — inexistants, et demandés

- Champ `aliases` au niveau item : absent du JSON Schema, toléré puis **ignoré** (section 2).
- Champ `alias` au niveau fichier : absent, et demandé explicitement dans
  [shadcn-ui/ui#9474](https://github.com/shadcn-ui/ui/issues/9474) — « [feat]: registry item can
  use custom aliases », **ouvert au 2026-01-28, sans réponse**. La discussion y explique
  exactement la tension : une liste de quatre placeholders figés entre en conflit dès qu'un
  projet utilise plusieurs registres.
- La seule échappatoire actuelle est un chemin nu en `target`, qui contourne complètement les
  alias : `"target": "lib/signals.ts"` (ou `"target": "~/lib/signals.ts"` pour ignorer `src/`).

### Compatibilité alias / chemin relatif entre deux artefacts installés

Le CLI **ne réécrit aucune importation** dans les fichiers qu'il installe. Mesuré sur un fichier
contenant cinq formes d'import :

```console
# source : import {a} from "./a.js" / "./b" / "./c.ts" / "@/lib/d" / "@lib/e"
$ npx shadcn@4.21.0 add ../reg2/imports.json --yes --overwrite
$ cat probe/imports.ts
import { a } from "./a.js"
import { b } from "./b"
import { c } from "./c.ts"
import { d } from "@/lib/d"
import { e } from "@lib/e"
```

Octet pour octet. Cela vaut aussi pour un composant JSX avec `cn` :

```console
$ cat probe/c.tsx     # installées avec target "~/probe/c.tsx", type registry:ui
import { cn } from "@/lib/utils"
import { s } from "./signals"
export function C({ className }: { className?: string }) {
  return <div className={cn("x", className)}>{s}</div>
}
```

Conclusion : un chemin relatif entre deux artefacts installés **survit** à l'installation, sans
rien demander à l'utilisateur, à condition que les deux fichiers atterrissent dans le même
répertoire. C'est exactement ce que fait le placeholder `@lib/`.

---

## 7. Exigences du dépôt

Côté **dépôt `signalcn`** ([`/docs/registry/github`](https://ui.shadcn.com/docs/registry/github),
section « Requirements ») :

- être un dépôt **`github.com`** ; les hôtes GitHub Enterprise ne sont **pas** supportés par
  les adresses GitHub ;
- avoir un **`registry.json` à la racine** ;
- respecter les schémas `registry.json` et `registry-item.json` ;
- **référencer des fichiers qui existent dans le dépôt** ;
- **dépôt public = zéro configuration**. Aucune authentification, aucun `gh`, aucun serveur.
  Dépôt privé : `gh auth login` ou `GH_TOKEN`/`GITHUB_TOKEN` avec `Contents: Read-only`.
  ⚠️ Le FAQ dit encore « Can GitHub registry addresses use private repositories? **Not
  currently** » alors que la page GitHub documente le contraire. **Divergence documentaire ;
  ne pas s'appuyer sur les dépôts privés.** (`/docs/registry/faq` vs `/docs/registry/github`)

Nom du registre dans l'URL : il n'y a **pas** de segment « registre ». L'adresse est
`owner/repo/item` et le nom du registre (`name` du `registry.json`) sert de métadonnée
(data-attributes). Vérifié :

```console
$ npx shadcn@4.21.0 list shadcn-ui/registry-template-v3
Found 3 items in shadcn-ui/registry-template-v3
Showing 1-3 of 3
- shadcn-ui/registry-template-v3/hello-world (component) — A simple hello world component
- shadcn-ui/registry-template-v3/example-form (component) — A contact form with Zod validation.
- shadcn-ui/registry-template-v3/complex-component (component) — A complex component showing hooks, libs and components.
```

Autres limites documentées, à connaître :

- **5 MiB maximum par fichier source** (`dr=5*1024*1024` et erreur `oversize` dans le code).
  Un `signals.ts` très documenté reste très largement sous ce plafond, mais c'est une contrainte
  réelle sur la taille des artefacts.
- **Éviter les liens symboliques** : en lecture anonyme, `raw.githubusercontent` renvoie le
  chemin de la cible comme texte ; en lecture authentifiée, l'API Contents renvoie le contenu.
  Les deux comportements sont incohérents.
- Les items sont dédupliqués **par chemin cible**, le dernier gagne
  ([`/docs/registry/namespace`](https://ui.shadcn.com/docs/registry/namespace) : « Deduplicates
  files based on target paths (last one wins) »).

Côté **projet consommateur**, exigences réelles, mesurées :

| Exigence | Test |
| --- | --- |
| `components.json` présent | sans lui, la CLI propose de le créer et **refuse d'installer** si on refuse : `You need to create a components.json file to add components. Proceed? › (Y/n) … no` — aucun fichier écrit |
| `tsconfig.json` (ou `jsconfig.json`) lisible | sans lui : `Failed to load tsconfig.json. Couldn't find tsconfig.json` |
| un alias d'import déclaratif | `init` valide « Import alias » et échoue sans ; `add` en a besoin pour résoudre `aliases.*` |
| le fichier `tailwind.css` désigné | **n'a pas besoin d'exister** tant que l'item ne porte ni `cssVars` ni `css` (vérifié : `src/globals.css` absent, installation réussie) |
| Tailwind / React installés | **non requis**. Installé avec succès dans un projet sans aucune dépendance : `{"name":"vanilla","version":"1.0.0","private":true,"type":"module"}` et un `components.json` minimal |

C'est la friction la plus sous-estimée pour `signalcn` : la bibliothèque est « vanilla, sans
framework », mais `shadcn add` exige un `components.json` formaté pour Tailwind + shadcn. Le
README doit fournir un `components.json` minimal prêt à copier.

---

## 8. `targets`

**Il n'existe pas de champ `targets`.** Ni au niveau item, ni au niveau fichier. Le ticket le
suppose ; il n'existe dans aucune des trois sources :

- absent de `https://ui.shadcn.com/schema/registry-item.json` ;
- absent des docs `/docs/registry/registry-item-json` et `/docs/registry/examples` ;
- absent du code : `.passthrough()` le tolère au chargement, `shadcn build` le supprime.

Ce qui existe, c'est **`files[].target`, au singulier, par fichier**. C'est le seul mécanisme de
destination, et il est **optionnel** — sauf pour `type: registry:file` et `type: registry:page`,
où il est obligatoire au niveau zod, pas seulement dans le JSON Schema :

```console
# files[1] = { "path":"notarget-file.ts", "type":"registry:file" }  — pas de target
$ npx shadcn@4.21.0 add ../reg2/imports.json --yes --overwrite --dry-run
Error:
Failed to parse registry item: ../reg2/imports.json
  - files.1.target: Required
```

Comportement par type de fichier **sans** `target` (table `xl()` + mesure, section 3) :

| `type` du fichier | Dossier par défaut |
| --- | --- |
| `registry:ui` | `aliases.ui` |
| `registry:lib` | `aliases.lib` |
| `registry:component`, `registry:block` | `aliases.components` |
| `registry:hook` | `aliases.hooks` |
| `registry:file`, `registry:page`, `registry:theme`, `registry:style`, `registry:item`, `registry:base`, `registry:font` | `aliases.components` |

Le `type` de l'**item** (celui du nom, pas celui des fichiers) n'a aucun effet sur
l'emplacement : dans la mesure ci-dessus, l'item `signals-alias` est de type `registry:block`
et son unique fichier `registry:lib` a atterri dans `src/lib/`. Le `type` de l'item sert à
l'affichage de `shadcn list` et, pour `registry:base`/`registry:font`/`registry:style`, à
activer des champs spécifiques.

Recommandation pour `signalcn` : **toujours expliciter `target` sur les six items**, avec
`@lib/`. Ne jamais compter sur le dossier par défaut, qui envoie un `registry:file` dans
`components/`.

---

## 9. Le fichier de test comme artefact distribué

### Ce qui a été vérifié, de bout en bout

Registre de test à six items, construit avec `shadcn build`, dépendances résolues :

```console
$ npx shadcn@4.21.0 add built/signals-test.json --yes --overwrite
✔ Created 2 files:
  - src/lib/signals.ts
  - src/lib/signals.test.ts

$ npx shadcn@4.21.0 add built/signals-test-js.json --yes --overwrite
✔ Created 2 files:
  - src/lib/signals.js
  - src/lib/signals.test.js

$ npx shadcn@4.21.0 add built/signals-test-min.json --yes --overwrite
✔ Created 2 files:
  - src/lib/signals.min.js
  - src/lib/signals.test.min.js

$ cat src/lib/signals.test.js
import { signal } from "./signals.js"
console.log(signal(1).value)

$ cat src/lib/signals.test.min.js
import { signal } from "./signals.min.js"
console.log(signal(1).value)
```

### Réponses

**La relation de chemin survit-elle ?** **Oui**, à trois conditions vérifiées :

1. l'item de test porte `target: "@lib/<fichier>.test.<ext>"` — donc le même dossier que
   l'implémentation, elle aussi en `@lib/`. Sans `target`, un `registry:file` atterrit dans
   `components/` et `./signals.js` pointe dans le vide ;
2. le CLI ne réécrit pas les imports (section 6.2) ;
3. `registryDependencies` est déclarée, et résolue **avant** l'écriture, dans le même run —
   l'utilisateur n'a pas à installer l'implémentation d'abord.

**Faut-il déclarer des chemins via `registryDependencies` ?** Il n'existe pas d'autre moyen.
`registryDependencies` est le seul mécanisme qui expresses « cet item a besoin de cet autre ».
Et il faut utiliser l'adresse GitHub complète, pas un nom nu (section 4).

**Faut-il documenter l'ordre d'installation ?** Non pour l'utilisateur : `add` résout
transitivement et installe tout d'un coup. En revanche il faut documenter que **la dépendance
n'hérite pas du ref** (section 4), donc que `add WAROL52/signalcn/signals-test#v1.0.0` n'épingle
pas `signals`.

### Le vrai risque n'est pas le chemin, c'est `tsx: false`

Le chemin relatif est en sécurité. Ce qui ne l'est pas : le contenu. Extrait du code
(`chunk-B2MD6U5O.js`, dans `Lr`) :

```js
if (t.tsx || (w = w.replace(/\.tsx?$/, T => T === ".tsx" ? ".jsx" : ".js")), …)
…
let I = y.type === "registry:file" || y.type === "registry:item",
    k = Me(w) || I ? y.content : await ei({ …, transformJsx: !t.tsx, … }, [tr, sr, a, …])
```

Deux conséquences, mesurées sur un même contenu source :

| `type` du **fichier** | `tsx: true` | `tsx: false` |
| --- | --- | --- |
| `registry:lib` | écrit `.ts`, **passe par la transformation ts-morph** (transpile) | renommé `.js`, transpilé → **JS valide**, mais **commentaires flottants perdus** |
| `registry:file` | écrit `.ts`, **copie verbatim** | renommé `.js`, **copie verbatim** → **JS invalide** |

```console
# components.json : "tsx": false
$ npx shadcn@4.21.0 add /tmp/opencode/probe2/reg2/tsxprobe.json --yes --overwrite
✔ Created 2 files:
  - src/lib/signals.js
  - src/lib/signals.test.js

$ cat src/lib/signals.js          # type registry:lib  → transpilé
export function signal(value) {
  return { value }
}

$ cat src/lib/signals.test.js     # type registry:file → verbatim
import { signal } from "./signals.js"
const s: number = signal<number>(1).value
console.log(s)

$ node -e "new (require('vm').Script)(require('fs').readFileSync('src/lib/signals.js','utf8'))"
PARSE ERROR: Unexpected token 'export'
```

Autrement dit : un `signals.test.ts` déclaré en `registry:file` devient, chez un consommateur
en `tsx: false`, un `signals.test.js` contenant de la syntaxe TypeScript. Fichier cassé.

Et dans l'autre sens, la transformation `registry:lib` détruit la documentation :

```console
# source : en-tête JSDoc flottant + commentaire de ligne flottant + JSDoc attaché
$ cat src/lib/as-lib.ts            # type registry:lib
import type { Cleanup } from "./types.js"

/**
 * Attached JSDoc.
 */
export function signal<T>(value: T) {
  return { value }
}

$ cat src/lib/as-file.ts           # type registry:file
/**
 * Floating header JSDoc.
 */

// floating line comment

import type { Cleanup } from "./types.js"

/**
 * Attached JSDoc.
 */
export function signal<T>(value: T) {
  return { value }
}
```

Bug connu et **ouvert** : [shadcn-ui/ui#9206](https://github.com/shadcn-ui/ui/issues/9206) —
« Registry install strips leading comments and JSDoc blocks not attached to declarations »,
ouvert au 2026-02-27, reproduit par nous en 4.21.0.

### Recommandation qui en découle

Le mapping qui minimise les dégâts, compte tenu de la matrice :

| Item | `type` item | `type` fichier | `target` | Raison |
| --- | --- | --- | --- | --- |
| `signals` | `registry:lib` | `registry:lib` | `@lib/signals.ts` | TS : la transpilation sauve le cas `tsx: false` |
| `signals-test` | `registry:file` | `registry:lib` | `@lib/signals.test.ts` | idem — **ne pas** `registry:file` sur un `.ts` |
| `signals-js` | `registry:lib` | `registry:file` | `@lib/signals.js` | déjà du JS : verbatim, zéro perte, `tsx` sans effet |
| `signals-test-js` | `registry:file` | `registry:file` | `@lib/signals.test.js` | idem |
| `signals-min` | `registry:lib` | `registry:file` | `@lib/signals.min.js` | idem |
| `signals-test-min` | `registry:file` | `registry:file` | `@lib/signals.test.min.js` | idem |

Règle mnémotechnique : **`.ts` → `registry:lib` (le CLI transpile), `.js` → `registry:file`
(copie exacte).** Le `type` de l'item peut rester `registry:lib` partout, il ne sert qu'à
l'affichage.

Ce mapping a un coût : pour les quatre items en `.ts`, les commentaires flottants de `signals.ts`
et `signals.test.ts` seront perdus à l'installation. Pour un projet dont la `Source de vérité`
est manuellement maintenue et dont le README promet de la documentation, c'est un point à
arbitrer explicitement — soit on l'accepte et on le documente, soit on passe les items TS en
`registry:file` et on assume des `.js` cassés chez les consommateurs `tsx: false`, soit on
attend une résolution de #9206.

---

## 10. Limites et pièges connus

Classés par risque pour `signalcn`. Chacun est sourcé.

### Bloquants

**P1 — Un nom nu dans `registryDependencies` ne désigne jamais le même registre.**
Le FAQ `/docs/registry/faq` le formule noir sur blanc ; mesuré en 4.21.0 : soit le mauvais
paquet s'installe sans bruit (§4, piège A), soit l'installation échoue en accusing
`https://ui.shadcn.com/r/styles/new-york-v4/<nom>.json` (§4, piège B). Correctif : toujours
`WAROL52/signalcn/<item>`.

**P2 — `tsx: false` casse les artefacts TypeScript.** Dépend entièrement du `components.json`
du consommateur, donc hors contrôle du dépôt. Un `signals.test.ts` en `registry:file` devient
un `.js` contenant du TypeScript (§9). Correctif : `.ts` en `registry:lib`.

**P3 — La transformation supprime la documentation flottante.**
[shadcn-ui/ui#9206](https://github.com/shadcn-ui/ui/issues/9206), ouvert, reproduit en 4.21.0.
Le fichier installé n'est pas la `Source de vérité`. Seuls les JSDoc attachés à une déclaration
survivent ; les blocs d'en-tête, les commentaires de ligne flottants disparaissent. La
philosophie « open code / copy-paste » de shadcn n'est pas tenue ici. Aucune option de
configuration ne désactive la transformation (testé avec un `tsconfig.json` sans `paths` :
commentaires toujours perdus).

**P4 — Le consommateur doit avoir un `components.json` et un `tsconfig.json`.** Sans eux,
`shadcn add` n'écrit rien. Pour une bibliothèque « vanilla sans framework », c'est un obstacle
d'entrée. Correctif : publier un `components.json` minimal dans le README.

### Importants

**P5 — Les refs ne sont pas hérités.** `/docs/registry/registry-item-json`. `add
WAROL52/signalcn/signals-test#v1.0.0` tire `signals` depuis la branche par défaut. Pour une
baseline de comportement figée, c'est un défaut de reproductibilité. Correctif : épingler la
dépendance dans l'item.

**P6 — `shadcn build` perd `type` et `target` en inlinant les `registryDependencies`.**
[shadcn-ui/ui#9481](https://github.com/shadcn-ui/ui/issues/9481), **ouvert** (2026-01-28) :
les fichiers d'une dépendance inlinée se retrouvent en `type: registry:component`,
`target: ""`, et s'installent au mauvais endroit. Le rapport pointe un
`// TODO (shadcn): fix this.` dans `packages/shadcn/src/registry/utils.ts`. **Non reproduit sur le
chemin registre GitHub** — dans notre test, `registryDependencies` n'est pas inliné par
`build`, il est résolu à l'installation. Le bug concerne le chemin « build vers un registre
HTTP ». À re-tester si `signalcn` publie un jour un `public/r/`.

**P7 — Collision de chemins cibles.** Les fichiers sont dédupliqués par chemin cible, dernier
gagnant (`/docs/registry/namespace`). Deux items de `signalcn` qui visent `@lib/signals.js`
s'écrasent silencieusement, et l'item suivant propose « skip (identical) » ou
`Updated 1 file` si `--overwrite` est passé. Les six cibles de `signalcn` sont distinctes, donc
le risque est nul en l'état — mais il le devient dès qu'un item expose un nom réutilisable.

**P8 — Pas d'alias personnalisé.** [shadcn-ui/ui#9474](https://github.com/shadcn-ui/ui/issues/9474),
ouvert depuis janvier 2026 : quatre placeholders figés (`components`, `ui`, `lib`, `hooks`),
aucun mécanisme d'extension. Les collisions entre registres multiples ne sont pas résolubles.

**P9 — Les imports ne sont jamais réécrits.** Vérifié sur cinq formes d'import (§6.2). C'est
une bonne nouvelle pour les chemins relatifs, une mauvaise si l'on compte sur le CLI pour
adapter `@/lib/...` au préfixe du consommateur. Si un jour un artefact `signalcn` veut être
importable sous n'importe quel préfixe, il faut générer l'alias au build et non le compter sur
la CLI.

**P10 — 5 MiB par fichier, pas de liens symboliques.** `/docs/registry/github`, section
« Limits ». Sans objet aujourd'hui, contraignant à terme.

### Mineurs, mais à ne pas confondre avec des bugs

- **`targets` et `aliases` au niveau item n'existent pas** (§2, §8). Les écrire ne provoque
  aucune erreur, ne fait rien, et disparaît au build. C'est le piège de conception le plus
  probable vu la formulation du ticket.
- **Registres privés : la documentation se contredit.** `/docs/registry/faq` dit « Not
  currently », `/docs/registry/github` documente `gh` et `GH_TOKEN`. Ne pas s'y fier.
- **`shadcn-ui/ui` n'a pas de `registry.json` racine** (HTTP 404 sur
  `raw.githubusercontent.com/shadcn-ui/ui/HEAD/registry.json`). Les registres publics à copier
  comme modèle sont ailleurs : `shadcn-ui/registry-template-v3` (3 items, validé par
  `registry validate`).
- **Noms d'items avec `/`** : fonctionnels côté CLI (`add owner/repo/rules/agent`), mais
  [shadcn-ui/ui#11321](https://github.com/shadcn-ui/ui/issues/11321) (closed) signalait un ENOENT
  au build sur les sous-dossiers de sortie. Sans objet : les six noms `signalcn` sont plats.
- **Noms de fichiers à points multiples.** [shadcn-ui/ui#7548](https://github.com/shadcn-ui/ui/issues/7548)
  (closed, fermé pour inactivité) : `shadcn build` échouait sur `message-demo.const.tsx`. **Non
  reproduit en 4.21.0** : `shadcn build` sur un registre contenant `signals.min.js` et
  `signals.test.min.js` réussit (`✔ Building registry.`). Le bug est corrigé ou le chemin de
  code a changé ; à re-tester avant chaque release.
- **`registry:example` et `registry:internal`** sont acceptés par la CLI mais absents du JSON
  Schema : un éditeur les signalera comme invalides. À éviter.
- **`tailwind`** est marqué déprécié par la docs au profit de `cssVars.theme`. Sans objet pour
  `signalcn`, qui n'a pas de Tailwind.

---

## 11. `registry.json` proposé pour `signalcn`

> ⚠️ **PROPOSITION INFIRMÉE — ne pas appliquer telle quelle.** La section 11 ci-dessous
> recommande `registry:lib` pour les items TypeScript. C'est **l'inverse** de ce qu'il faut
> faire : mesuré sur les seize combinaisons, `components.json`'s `tsx` — et non le type de
> fichier — décide de l'extension installée. Avec `registry:lib`, les items `signals` et
> `signals-js` convergent vers le même nom de fichier. Voir
> [`docs/adr/0008-registry-file-partout-et-tsx-true-exige.md`](../docs/adr/0008-registry-file-partout-et-tsx-true-exige.md)
> et [`docs/distribution.md`](/utilisateurs/distribution.md). Le reste de cette recherche reste
> valable ; cette section-là ne vaut plus.


Conforme à ce qui est vérifié ci-dessus. Non écrit dans le dépôt : c'est une proposition, à
valider avant d'être appliquée.

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "signalcn",
  "homepage": "https://github.com/WAROL52/signalcn",
  "items": [
    {
      "name": "signals",
      "type": "registry:lib",
      "title": "Signals (TypeScript)",
      "description": "Moteur de signaux réactifs, TypeScript.",
      "files": [{ "path": "registry/default/signals.ts", "type": "registry:lib", "target": "@lib/signals.ts" }]
    },
    {
      "name": "signals-test",
      "type": "registry:file",
      "title": "Scénarios (TypeScript)",
      "description": "Scénarios de conformité.",
      "registryDependencies": ["WAROL52/signalcn/signals"],
      "files": [
        { "path": "registry/default/signals.test.ts", "type": "registry:lib", "target": "@lib/signals.test.ts" }
      ]
    },
    {
      "name": "signals-js",
      "type": "registry:lib",
      "title": "Signals (JavaScript)",
      "description": "Moteur de signaux réactifs, JavaScript généré.",
      "files": [{ "path": "registry/default/signals.js", "type": "registry:file", "target": "@lib/signals.js" }]
    },
    {
      "name": "signals-test-js",
      "type": "registry:file",
      "title": "Scénarios (JavaScript)",
      "description": "Scénarios de conformité générés.",
      "registryDependencies": ["WAROL52/signalcn/signals-js"],
      "files": [
        { "path": "registry/default/signals.test.js", "type": "registry:file", "target": "@lib/signals.test.js" }
      ]
    },
    {
      "name": "signals-min",
      "type": "registry:lib",
      "title": "Signals (JavaScript minifié)",
      "files": [{ "path": "registry/default/signals.min.js", "type": "registry:file", "target": "@lib/signals.min.js" }]
    },
    {
      "name": "signals-test-min",
      "type": "registry:file",
      "title": "Scénarios (JavaScript minifiés)",
      "registryDependencies": ["WAROL52/signalcn/signals-min"],
      "files": [
        { "path": "registry/default/signals.test.min.js", "type": "registry:file", "target": "@lib/signals.test.min.js" }
      ]
    }
  ]
}
```

Contrôles à passer avant publication :

```bash
npx shadcn@4.21.0 registry validate WAROL52/signalcn
npx shadcn@4.21.0 list WAROL52/signalcn
npx shadcn@4.21.0 view WAROL52/signalcn/signals-test        # vérifier le contenu inliné
npx shadcn@4.21.0 add WAROL52/signalcn/signals-test --dry-run
```

Les six items restent individuellement installables ; les trois items de test entraînent
exactement une implémentation, jamais les cinq autres.

---

## 12. Points non vérifiables

**`NON VÉRIFIABLE` — résolution d'un `registryDependencies` en adresse GitHub *depuis le
propre* dépôt `WAROL52/signalcn`.** Je n'ai pas écrit dans le dépôt et je n'ai pas poussé de
branche de test. Ce qui est vérifié : (a) la forme `owner/repo/item` est reconnue par le
parseur (`function Ll` → `{scheme:"github"}`) ; (b) la résolution vers un dépôt public réel
fonctionne de bout en bout, y compris transitivement (§4) ; (c) la documentation officielle
prescrit cette forme pour les dépendances intra-dépôt. Ce qui ne l'est pas : le cas exact
`WAROL52/signalcn` → `signals`. *Pour vérifier :* pousser une branche de test sur le dépôt et
lancer `npx shadcn@4.21.0 add WAROL52/signalcn/signals-test --dry-run`, en vérifiant que
`src/lib/signals.ts` **et** `src/lib/signals.test.ts` sont listés.

**`NON VÉRIFIABLE` — héritage de ref sur une dépendance GitHub, mesuré de bout en bout.** Le
comportement est établi par le code (`tt()` n-propague pas le ref à `qr()`) et par la doc
(« Refs are not inherited across dependencies »). L'observation directe
`add WAROL52/signalcn/signals-test#v1.0.0` qui démontrerait la dérive vers `HEAD` n'a pas été
faite. *Pour vérifier :* publier un tag `v1.0.0` avec un `signals.ts` identifiable, pousser un
`signals.ts` différent sur `main`, puis installer le tag et observer la version obtenue.

**`NON VÉRIFIABLE` — résolution de `#tag` quand `git ls-remote` est indisponible.**
[shadcn-ui/ui#11986](https://github.com/shadcn-ui/ui/issues/11986) rapporte un HTTP 422 dans ce
cas, mais le rapport date du 2026-09-22 et je n'ai pas mesuré le comportement en 4.21.0 dans un
environnement réseau restreint. *Pour vérifier :* réessayer derrière un proxy bloquant `git`.

**`NON VÉRIFIABLE` — comportement exact du `#9206` (commentaires) sur un futur correctif.** Le
bug est ouvert ; aucune date de correction n'est annoncée. *Pour vérifier :* rejouer la sonde
`comments2.json` (§9) à chaque montée de version.

**`NON VÉRIFIABLE` — résolution d'alias dans un monorepo / projet en `package.json#imports`.**
Documenté dans `/docs/components-json`, mais la nouvelle forme
`"imports": { "#lib/*": "./src/lib/*.ts" }` avec `moduleResolution: "bundler"` n'a pas été
testée ici. *Pour vérifier :* monter un projet de ce type et confirmer que `@lib/` résout bien
vers `src/lib/`.

**Ambiguïté non tranchée — `aliases.lib` absent de `components.json`.** Le schéma zod rend
`lib`, `ui` et `hooks` optionnels, et le code retombe alors sur `resolve(components, "lib")` —
soit `components/lib`, pas `lib`. Un consommateur qui n'a configuré que
`"aliases": {"components": "@/components", "utils": "@/lib/utils"}` verrait donc
`@lib/signals.ts` atterrir dans `src/components/lib/`. *Pour vérifier :* installer avec un
`components.json` sans `lib` et observer la destination. C'est un argument de plus pour
l'alias par chemin nu (`"target": "lib/signals.ts"`) si `signalcn` veut un comportement
déterministe chez n'importe qui.
