import { defineConfig } from "vitepress"

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
  // `rewrites` réécrit à l'intérieur de `srcDir`, donc `SPEC.md`, `docs/adr/*` et `CONTRIBUTING.md`
  // sont hors de sa portée tant que `srcDir` vaut `site/`. La racine comme `srcDir` les rend au
  // site sans qu'un seul fichier ne quitte sa place sur le disque — et c'est ce qu'exige la carte :
  // `CONTEXT.md` et `docs/adr/` sont épinglés par `docs/agents/domain.md` et cités par quatre
  // portes. Le site les LIE, il ne les déplace pas.
  srcDir: "..",

  // Deux exclusions, deux raisons distinctes. `.github/` contient le gabarit de pull request, que
  // GitHub rend et que personne ne lit comme une page ; `prototype/` est un dossier de travail
  // d'une session passée, cité par le registre et dont le sort n'est pas tranché (#40). Ni
  // l'un ni l'autre n'est un document de la narration, et un `srcExclude` est ici le seul moyen de
  // ne pas les publier — `ignoreDeadLinks` resterait la seule façon de les tolérer, et ce serait
  // affaiblir le contrôle des liens.
  srcExclude: [".github/**", "prototype/**"],

  // Une règle, déduite du chemin, et non une liste de fichiers recopiée : ce qui est sous `site/`
  // est publié sous sa section, et ce qui est ailleurs garde son chemin. `site/utilisateurs/x.md`
  // devient `/utilisateurs/x.html` ; `docs/adr/0009-….md` reste `/docs/adr/0009-….html`, parce que
  // son fichier ne bouge pas et que son URL doit continuer de répondre à ce que dit le dépôt.
  //
  // La valeur ne porte pas de `/` initial : VitePress compile `/${valeur}`, et un second
  // slash produirait une clé d'inversion `/utilisateurs/index.md` que le contrôle des liens
  // chercherait jamais — tous les liens absolus du site deviendraient morts sans un mot.
  rewrites: {
    "^site/(?<reste>.*)$": ":reste",
  },

  themeConfig: {
    // La navigation EST la structure du site : trois entrées, une par public, et rien d'autre.
    nav: [
      { text: "Utilisateurs", link: "/utilisateurs/" },
      { text: "Contributeurs", link: "/contributeurs/" },
      { text: "Technique", link: "/technique/" },
    ],
  },
})
