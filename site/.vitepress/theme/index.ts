import type { Theme } from "vitepress"

import DefaultTheme from "vitepress/theme"
import Mermaid from "./mermaid.vue"

/**
 * Le thème. Il n'a qu'une chose à faire : enregistrer le composant Mermaid.
 *
 * Un seul composant, deux endroits. `app.component` le rend disponible partout, et le plugin
 * markdown-it émet exactement ce nom — les deux se rencontrent sans configuration.
 */
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Mermaid", Mermaid)
  },
} satisfies Theme
