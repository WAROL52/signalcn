/**
 * Outillage partagé des portes.
 *
 * `porte()` et le `RACINE` existaient en double dans deux verifieurs, et deux copies d'un
 * helper de test divergent : l'une gagne une option, l'autre non, et rien ne le dit. Le dépôt
 * a déjà tranché cette question — « une option qui vit à un seul endroit ne peut pas être
 * oubliée ailleurs » (`site/contributeurs/ci.md`) — alors autant l'appliquer ici.
 */

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Les chemins d'une sortie `git status --porcelain -z`.
 *
 * `-z` sort un renommage sur DEUX enregistrements NUL — `R  <nouveau>\0<ancien>\0` — parce
 * qu'un renommage nomme deux chemins. Le second ne porte pas de préfixe d'état : c'est l'ancien
 * chemin, et le compter comme un chemin le ferait passer pour un fichier que le build aurait
 * écrit. Un enregistrement commence donc toujours par deux caractères d'état et une espace, et le
 * chemin commence à la troisième place.
 *
 * La liste des caractères d'état est celle de `git status --porcelain`, et elle est complète :
 * espace, `M` `A` `D` `R` `C` `U` `T`, `?` et `!`. `T` — le changement de type — en fait partie,
 * mesuré : un fichier régulier remplacé par un lien donne ` T fichier`, et un lecteur qui l'ignore
 * perd ce chemin **en silence**. Ce qui manque à la liste est donc absent du statut, jamais
 * l'inverse.
 *
 * Sous `-z`, git n'écrit aucun guillemet autour d'un nom : il n'y a donc rien à déchiffrer, et un
 * déchiffrement corromprait un fichier dont le nom commence et finit par un guillemet.
 *
 * ponytail: un fichier nommé `R  notes.md`, s'il était l'ancien côté d'un renommage, serait compté
 * comme un troisième chemin — il porte les trois caractères attendus en tête. Aucun dépôt n'a de
 * fichier ainsi nommé, et le build de VitePress n'écrit aucun nom de fichier.
 */
export const cheminsGit = (sortie) =>
  sortie
    .split("\0")
    .filter(Boolean)
    .filter((ligne) => /^[ MADRUCT?!]{2} /.test(ligne))
    .map((ligne) => ligne.slice(3))

/**
 * Les chemins que le build du site a écrits, d'après deux lectures d'un `git status -z`.
 *
 * L'instantané d'avant est pris par `documentation-statique` avant de construire, l'état courant
 * est relu après : un arbre de travail sale n'est donc plus un échec, il est l'ensemble « avant ».
 * Ce que la porte accuse est ce qui est devenu sale ENTRE LES DEUX, ce qui est la seule chose que
 * deux instants peuvent attribuer à quelqu'un.
 *
 * La différence n'est pas symétrique et c'est le sens qui compte : `apres \ avant` accuse, l'autre
 * n'accuserait jamais. `site/` est retiré parce qu'il est le droit du build — et sa sortie étant
 * ignorée par git, elle n'apparaît dans aucune des deux lectures.
 *
 * ponytail: la comparaison porte sur les CHEMINS, pas sur le contenu. Un chemin déjà sale avant le
 * build et modifié par lui passe, puisqu'il est dans les deux ensembles. Il faudrait que le build
 * vise précisément un fichier que le contributeur édite — ce que VitePress ne fait pas. Si un jour
 * `site/` cessait d'être le seul exclu, la comparaison devrait porter sur le contenu de l'instantané
 * aussi.
 */
export const ecritsParBuild = (avant, apres) =>
  apres.filter((chemin) => !chemin.startsWith("site/") && !avant.includes(chemin))

/**
 * Une assertion de porte. `condition` fausse fait tomber le code de sortie, et le détail dit
 * pourquoi — un « ECHEC » nu oblige à rejouer le test à la main.
 */
export function reporter(etat) {
  let echecs = 0

  const porte = (nom, condition, detail) => {
    if (condition) {
      console.log(`  ok   ${nom}`)
    } else {
      echecs++
      console.log(`  ECHEC ${nom}${detail ? ` — ${detail}` : ""}`)
    }
  }

  return {
    porte,
    /** Affiche le compte et rend la sortie. À appeler une fois, à la fin. */
    cloture: () => {
      console.log("")
      console.log(`  ${echecs} echec(s)`)
      if (echecs > 0) process.exit(1)
    },
    get echecs() {
      return echecs
    },
  }
}
