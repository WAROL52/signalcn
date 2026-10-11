<script setup>
/**
 * Un diagramme Mermaid, rendu côté client.
 *
 * Le rendu se fait au MONTAGE, jamais au build : `mermaid.render` a besoin d'un DOM, et le
 * laisser au build produirait du SVG dans la sortie publiée — or `verifier-liens-publies.mjs`
 * lit cette sortie et traite chaque `href="#…"` comme une ancre devant avoir son `id`. Chaque
 * `xlink:href="#flowchart-…"` deviendrait une ancre orpheline, et la porte tomberait. Rendu côté
 * client, `dist` ne contient que ce composant, et rien ne se voit.
 *
 * Un échec de rendu est affiché, jamais avalé : un diagramme qui ne se dessine pas est une
 * page qui ment en silence, et le même argument vaut pour le journal rouge de `journal-harnais.mjs`.
 *
 * `securityLevel: "strict"` est un choix, pas un réglage par défaut : `loose` autorise le HTML
 * brut dans les étiquettes, donc un diagramme pourrait injecter du HTML dans la page. Le plugin
 * de la communauté s'y remet par défaut ; celui-ci ne s'y remet pas.
 */

import { onMounted, ref } from "vue"

const props = defineProps({
  id: { type: String, required: true },
  graph: { type: String, required: true },
})

const svg = ref("")
const erreur = ref("")

onMounted(async () => {
  try {
    // Import paresseux : mermaid pèse ~2 Mo, et une page sans diagramme ne doit
    // pas le télécharger. Vite le coupe en un chunk à part, chargé au montage.
    const { default: mermaid } = await import("mermaid")
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" })
    const { svg: rendu } = await mermaid.render(props.id, props.graph)
    svg.value = rendu
  } catch (cause) {
    erreur.value = cause instanceof Error ? cause.message.split("\n")[0] : String(cause)
  }
})
</script>

<template>
  <figure class="mermaid-bloc">
    <div v-if="erreur" class="mermaid-erreur">
      <p>Le diagramme n'a pas pu être dessiné.</p>
      <pre>{{ erreur }}</pre>
    </div>
    <div v-else ref="contenu" class="mermaid-contenu" :class="{ charge: !svg }" />
    <figcaption v-if="$slots.default"><slot /></figcaption>
  </figure>
</template>

<style scoped>
.mermaid-bloc {
  margin: 1.25rem 0;
}

.mermaid-contenu {
  display: flex;
  justify-content: center;
}

.mermaid-contenu.charge {
  min-height: 2.5rem;
}

.mermaid-erreur {
  border: 1px solid var(--vp-c-danger-soft);
  border-radius: 6px;
  padding: 0.75rem 1rem;
}

.mermaid-erreur pre {
  white-space: pre-wrap;
}
</style>
