import { defineConfig } from "vitepress"

import { journalHarnais } from "./journal-harnais.mjs"

// Trois publics, trois sections, et les documents du dépôt rendus sans qu'aucun bouge.
//
// Deux options ci-dessous sont les choix par défaut de VitePress, écrits parce qu'un lecteur doit
// les voir assumés plutôt que les croire oubliés : la bascule de mode sombre (`appearance`) et la
// recherche locale (`search`), qui ne dépend d'aucun service externe.
export default defineConfig({
  lang: "fr-FR",
  title: "signalcn",
  appearance: true,
  search: { provider: "local" },

  // `srcDir` est la RACINE DU DÉPÔT, pas `site/`. C'est le seul levier qui atteint le résultat :
  // `SPEC.md`, `docs/adr/*` et `CONTRIBUTING.md` sont hors de la portée de `site/` comme répertoire
  // source, donc inatteignables. La racine comme `srcDir` les rend au site sans qu'un seul fichier
  // ne quitte sa place sur le disque — et c'est ce qu'exige la carte : `CONTEXT.md` et `docs/adr/`
  // sont épinglés par `docs/agents/domain.md` et cités par quatre portes. Le site les LIE, il ne
  // les déplace pas.
  //
  // AUCUNE réécriture. Le dépôt est la source et le site en est un rendu : les liens sont donc
  // relatifs, et une URL publiée porte son chemin source. `rewrites` retirait `site/` des URL, et
  // toute absolue `/contributeurs/ci.md` devenait alors un lien mort côté GitHub, parce que
  // GitHub normalise le `/` initial d'un lien Markdown en relatif à la racine du DÉPÔT : elle est
  // rendue `blob/master/contributeurs/ci.md`, donc 404, le fichier étant sous `site/`. La
  // réécriture rendait le site correct et le dépôt faux ; la retirer rend le dépôt correct et le
  // site `/site/…`, ce qui est vrai.
  //
  // Le prix, mesuré : la forme relative SANS extension (`site/x`) est la seule qui marche dans les
  // deux espaces. Le build en résout la cible dans l'espace SOURCE, donc il la vérifie — un
  // `site/x` vers un fichier absent le fait tomber, mesuré par injection. Il ne vérifie en
  // revanche pas un lien dont la cible porte une extension d'asset (`.yml`, `.mjs` : mesuré), ni
  // une entrée de `themeConfig.nav`, ni `logoLink` — les deux derniers ne sont pas des liens
  // Markdown. Et il valide un espace qui n'est pas celui de la publication. C'est ce reste-là que
  // `npm run verifier-liens-publies` prend : il résout chaque lien interne dans la SORTIE publiée,
  // sur disque, sans appel réseau. Voir #65.
  srcDir: "..",

  // UNE ANCRE, et l'interdiction qui va avec — #86. Les deux slugifiers divergent
  // systématiquement, mesuré sur le même fichier des deux côtés (GitHub rend le Markdown, VitePress
  // rend le HTML) :
  //
  //   ## 2. Le nœud et ses champs   GitHub `2-le-nœud-et-ses-champs`   site `_2-le-nœud-et-ses-champs`
  //   ## 3. Les deux listes chaînées GitHub `3-les-deux-listes-chaînées` site `_3-les-deux-listes-chainees`
  //
  // Trois écarts, tous systématiques : VitePress préfixe d'un `_` un slug qui commence par un chiffre,
  // GitHub non ; VitePress décompose les diacritiques latins (`é` → `e`) et GitHub les garde ; le
  // tiret cadratin disparaît chez GitHub et reste chez VitePress. Le `œ` n'est PAS un diacritique,
  // donc les deux le gardent — « VitePress mange les accents » serait faux, et c'est mesuré.
  //
  // Une ancre ne peut donc être ni VALIDÉE — il faudrait réimplémenter les deux slugifiers, et ils
  // sont une dépendance versionnée de l'un et de l'autre — ni REFUSÉE : mesuré, 421 des 422 ancres de
  // ce site sont la barre latérale et la table des matières que VitePress émet lui-même, et rien dans
  // le HTML publié ne les distingue d'une ancre écrite à la main.
  //
  // Ce qui reste se vérifie sans slugifier, et c'est ce que la porte fait : une ancre est une
  // promesse faite PAR LA PAGE, donc un `href="#x"` doit avoir un `id="x"` sur la même page. La page
  // garantit alors qu'elle mène quelque part — pas que c'était la section voulue. Une ancre de cette
  // forme ne marche que dans UN espace, et le site est l'espace publié : c'est le même arbitrage que
  // ci-dessus, et pour la même raison.
  //

  // Le site est publié sur `warol52.github.io/signalcn`, donc TOUTES ses URL commencent par
  // `/signalcn/`. Sans ce préfixe, chaque page sortirait en 404 — et le build resterait VERT :
  // VitePress ne fait tomber que le lien de FICHIER mort, jamais une entrée de navigation vers
  // une page inexistante. C'est le seul réglage du site qu'aucun build ne peut attraper, donc il
  // est gardé par `npm run documentation`, qui le compare au nom du dépôt.
  base: "/signalcn/",

  // Deux exclusions, deux raisons distinctes. `.github/` contient le gabarit de pull request, que
  // GitHub rend et que personne ne lit comme une page ; `prototype/` est le REGISTRE des prototypes,
  // dont le code vit sur une branche et jamais ici — donc il n'a rien d'une page, même réduit à son
  // README. Ni l'un ni l'autre n'est un document de la narration, et un `srcExclude` est ici le seul
  // moyen de ne pas les publier — `ignoreDeadLinks` resterait la seule façon de les tolérer, et ce
  // serait affaiblir le contrôle des liens.
  srcExclude: [".github/**", "prototype/**"],

  // Le journal du harnais différentiel entre dans `scenarios.md` au moment du rendu, par un plugin
  // markdown-it qui remplace un marqueur — et **aucun fichier n'est écrit**, donc l'arbre de travail
  // reste propre et la porte de propreté reste verte. Si un scénario diverge, le build ÉCHOUE : une
  // page qui afficherait un harnais rouge mentirait, et `SPEC.md` §19 exige que les trois cibles
  // soient indiscernables. Le bloc montre le résumé puis le groupe `batch/*`, qui montre l'ordre
  // d'exécution — le même fait que les deux règles de drainage de `SPEC.md` §13.4, que la figure
  // d'`architecture.md` doit dessiner. Voir #50, et `npm run documentation` qui garde la présence
  // du marqueur sur la page.
  markdown: {
    config: journalHarnais,
  },

  themeConfig: {
    // Le TITRE de la barre vise la page d'accueil du site, qui s'appelle `site/index.md` et se
    // publie donc sous `/site/`. Sans cette ligne, VitePress vise la racine du site — qui ne
    // contient plus d'`index.html` maintenant que la réécriture a disparu — et le lien serait mort
    // sur chacune des trente-huit pages. Même famille de trou que la navigation ci-dessous : un fait
    // que le build ne valide pas, et que `npm run verifier-liens-publies` vérifie.
    logoLink: "/site/index",

    // La navigation EST la structure du site : trois entrées, une par public, et rien d'autre.
    //
    // Ces trois liens ne sont pas des liens Markdown : ni la conversion ni le build ne les
    // touchaient, et ils pointaient dans le vide dès que la réécriture disparaissait. Ils sont donc
    // réécrits à la main, et ils sont les SEULS chemins publiés du dépôt — car le `/` initial
    // n'a rien à normaliser ici : la navigation n'est rendue que par le site, jamais par GitHub.
    //
    // ABSOLUS et SANS extension, jusqu'au `index` inclus. Absolus parce qu'un lien relatif d'une
    // barre de navigation se résout depuis la page courante : depuis
    // `/signalcn/site/contributeurs/ci.html`, `site/utilisateurs/index` viserait
    // `/signalcn/site/contributeurs/site/utilisateurs/index`. Sans extension parce que
    // `/signalcn/site/utilisateurs/index.html` écrit en dur est un `.html` que le dépôt n'a pas,
    // et que VitePress refuse de valider. Avec `index` parce qu'alors la cible est un FICHIER :
    // son existence est un fait sur le disque, vérifiable par la porte, là où une barre finale
    // exigerait de croire une convention de serveur que rien ne prouve.
    //
    // Le build ne les valide pas davantage que les liens Markdown sans extension — c'est
    // `npm run verifier-liens-publies`, qui lit la sortie publiée, qui les couvre.
    nav: [
      { text: "Utilisateurs", link: "/site/utilisateurs/index" },
      { text: "Contributeurs", link: "/site/contributeurs/index" },
      { text: "Technique", link: "/site/technique/index" },
    ],
  },
})
