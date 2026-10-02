import { defineConfig } from "vitepress"

// Le squelette, et rien de plus : trois publics, trois sections, et AUCUN document déplacé.
// La narration est restructurée dans un autre lot, et ce squelette doit rester fusionnable et
// vérifiable seul.
//
// Deux options ci-dessous sont les choix par défaut de VitePress, écrits parce qu'un lecteur doit
// les voir assumés plutôt que les croire oubliés : la bascule de mode sombre (`appearance`) et la
// recherche locale (`search`), qui ne dépend d'aucun service externe.
export default defineConfig({
  lang: "fr-FR",
  title: "signalcn",
  appearance: true,
  search: { provider: "local" },
  themeConfig: {
    // La navigation EST la structure du site : trois entrées, une par public, et rien d'autre.
    // Les pages qu'elles listent arrivent avec le déplacement des documents ; ce squelette ne
    // déclare aucune entrée pointant vers un fichier qui n'existe pas.
    nav: [
      { text: "Utilisateurs", link: "/utilisateurs/" },
      { text: "Contributeurs", link: "/contributeurs/" },
      { text: "Technique", link: "/technique/" },
    ],
  },
})
