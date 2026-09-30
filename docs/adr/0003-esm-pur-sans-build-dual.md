# ESM pur, sans build dual

Les artefacts sont des modules ES, et rien d'autre. Pas de sortie CommonJS, pas de variante globale exposant `globalThis.signalcn`, pas de fichier de bundle « pour le navigateur ».

## Considered Options

- **ESM + CJS + IIFE, comme la baseline** — refusé. La baseline distribue effectivement les trois, mais cela triple le nombre d'artefacts, contredit les six items de `PRD.md` §7, et triple la surface de test de parité (`SPEC.md` §19).
- **ESM + IIFE global** — refusé. L'IIFE est le seul moyen de couvrir `<script src>` sans bundler, mais le chemin ESM couvre déjà `<script type="module">`, Vite, Node et tous les bundlers. Le gain ne justifie pas un artefact de plus.

## Consequences

- Les anciens navigateurs sans support des modules ne sont pas ciblés. La cible est ES2020, navigateurs modernes et Node 18+.
- `signals.min.js` reste un module ES minifié, pas un script global. Le README doit le dire explicitement pour éviter la mauvaise surprise.
- Le fichier de test distribué est lui aussi un module ES : il importe son implémentation en chemin relatif, ce qui contraint le chemin d'installation des deux artefacts.
