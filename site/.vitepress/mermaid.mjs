/**
 * Le bloc Mermaid : un plugin markdown-it, et une validation au build.
 *
 *   import { mermaid, validerMermaid } from "./mermaid.mjs"
 *
 * Le rendu est **côté client**, et ce n'est pas un goût : `mermaid.render` a besoin d'un DOM, et
 * le laisser au build produirait du SVG dans la sortie publiée — or `verifier-liens-publies.mjs`
 * lit cette sortie et traite chaque `href="#…"` comme une ancre devant avoir son `id`. Chaque
 * `xlink:href="#flowchart-…"` deviendrait une ancre orpheline, et la porte tomberait. Rendu côté
 * client, `dist` ne contient que le composant, et rien ne se voit.
 *
 * La validation est **au build**, dans un plugin Vite, et non dans ce plugin : les règles `core`
 * de markdown-it sont synchrones, et `mermaid.parse` est asynchrone. Un diagramme cassé fait donc
 * tomber la construction — sinon la page afficherait une boîte d'erreur en production, ce qui est
 * pire qu'une page qui ne se construit pas.
 *
 * **Aucun fichier n'est écrit**, donc l'arbre de travail reste propre et la porte de propreté
 * reste verte — un artefact généré sous `site/` y serait toléré, et c'est l'arbre sale que #68 a
 * démontré.
 */

// L'identifiant du composant, et son compteur : deux diagrammes d'une même page ne peuvent pas
// partager un id, sinon `mermaid.render` renvoie le premier des deux.
let compteur = 0

// Le graphe est mis dans un ATTRIBUT, et un attribut n'accepte que du texte échappé. Les quatre
// caractères qui ferment un attribut sont les seuls à échapper : `&` d'abord, sinon `&quot;`
// deviendrait `&amp;quot;` et l'attribut vaudrait `&quot;`.
const echapper = (texte) =>
  texte.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/**
 * Le plugin markdown-it. Il remplace le bloc par un composant, et il ne touche à rien d'autre :
 * une page sans bloc `mermaid` est une page sans diagramme.
 */
export const mermaid = (md) => {
  md.core.ruler.after("block", "mermaid", (etat) => {
    for (const jeton of etat.tokens) {
      if (jeton.type !== "fence" || jeton.info.trim() !== "mermaid") continue

      const id = `mermaid-${++compteur}`
      const graphe = echapper(jeton.content.replace(/\n$/, ""))
      // Un bloc VIDE est une erreur, pas un diagramme vide : sans cette garde, une régression de
      // lecture ferait rendre un composant sans graphe, et le build resterait vert.
      if (graphe === "") {
        throw new Error("un bloc `mermaid` est vide — il n'y a rien à dessiner")
      }

      jeton.type = "html_block"
      jeton.content = `<Mermaid id="${id}" graph="${graphe}" />`
    }
  })
}

const BLOC = /```mermaid\n([\s\S]*?)```/g

// Un seul DOM pour tout le build : le module `mermaid` lit `window` à son import
// et le garde en mémoire, donc un deuxième `jsdom` ne servirait à rien.
let mermaidValide = null

async function chargerMermaid() {
  if (mermaidValide) return mermaidValide

  // Le DOM d'abord, mermaid ensuite : un `window` posé après l'import ne le rattrape
  // pas — c'est exactement le `DOMPurify.addHook` mesuré.
  const { JSDOM } = await import("jsdom")
  const { window } = new JSDOM("<!doctype html><html><body></body></html>")
  globalThis.window = window
  globalThis.document = window.document

  const { default: mermaid } = await import("mermaid")

  // Et on les retire aussitôt : ils ne servent plus à `mermaid.parse`, et les laisser
  // en place fait dévier tout le rendu SSR de VitePress — mesuré en `history is not
  // defined`, parce que Vue Router croit trouver un navigateur.
  delete globalThis.window
  delete globalThis.document

  mermaidValide = mermaid
  return mermaidValide
}

/**
 * Le plugin Vite. Il valide chaque bloc avant la construction, et il ne lit que le Markdown.
 *
 * `mermaid.parse` a besoin d'un DOM — sans lui, il échoue sur `DOMPurify.addHook`, et **tout**
 * diagramme est rejeté, ce qui est le pire mode de défaillance d'une porte. Le DOM est donc
 * `jsdom`, importé **à la demande** : une page sans bloc `mermaid` ne le paie pas.
 *
 * L'erreur porte le numéro de ligne du bloc dans la page : un diagramme cassé sur une page de
 * dix blocs ne dit rien d'autre que « parse error », et le lecteur du message n'a pas la page.
 */
export const validerMermaid = {
  name: "signalcn-mermaid",
  enforce: "pre",
  async transform(code, id) {
    if (!id.endsWith(".md")) return null

    const blocs = [...code.matchAll(BLOC)]
    if (blocs.length === 0) return null

    const mermaid = await chargerMermaid()

    for (const match of blocs) {
      // L'indice vit sur le TABLEAU de correspondance, pas sur la chaîne : une déstructuration
      // `[corps, graphe]` perd `match.index`, et une ligne calculée sur `undefined` — donc sur le
      // fichier ENTIER — annonçait la dernière ligne de la page comme celle du bloc. Mesuré sur la
      // démonstration forcée : une fence à la ligne 5, une ligne annoncée 9.
      const graphe = match[1]
      const ligne = code.slice(0, match.index).split("\n").length
      try {
        await mermaid.parse(graphe)
      } catch (cause) {
        const raison =
          cause instanceof Error ? cause.message.split("\n").slice(0, 3).join(" ") : String(cause)
        throw new Error(`${id.replace(/\\/g, "/")}:${ligne} — diagramme invalide :\n${raison}`)
      }
    }

    return null
  },
}

export default mermaid
