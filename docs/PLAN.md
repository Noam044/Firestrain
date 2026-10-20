# FireStrain — Plan de livraison

> Établi le 20/10/2026 après l'audit des données (`docs/DATA_AUDIT.md`).
> Chaque phase se termine par un résumé (ce qui marche / ce qui reste / limites) et attend ta validation.

## Décisions techniques transverses

| Sujet | Choix | Raison |
|---|---|---|
| Gestionnaire de paquets | **npm** | pnpm absent de la machine ; bun disponible mais moins sûr avec Next 16 |
| Versions (vérifiées le 20/10/2026 via `npm view`) | Next 16.4 · React 19.3 · Three 0.186 · R3F 9.8 · Drei 10.7 · @react-three/postprocessing 3.2 · GSAP 3.15 · Lenis 1.3 · Motion 14.4 · Zustand 5 · TanStack Query 5 · **TanStack Table 9** · nuqs 2.10 · Zod 4 · Tailwind 4.3 · Playwright 1.64 | R3F 9.8 exige `react >=19 <19.4` → compatible avec React 19.3 |
| Scripts de données | TypeScript exécuté par **Node 22 en direct** (*type stripping* natif) | Pas de `tsx` ni de `ts-node` à ajouter |
| Tests unitaires (géo, encodages) | **`node:test`** intégré | Pas de Vitest (hors liste) ; Playwright pour l'E2E |
| Pré-traitement raster | **Aucun GDAL** : l'IGN reprojette côté serveur (WMS-R en EPSG:2154) | Voir audit §5.1 |
| Coordonnées de scène | Lambert-93, **1 unité = 1 km**, origine au centre de l'emprise France `[90 000 ; 1 250 000] × [6 030 000 ; 7 120 000]` m | `lonLatToScene()` / `sceneToLonLat()` via proj4, testées |
| Git | Une branche par phase (`phase-N/…`), commits conventionnels, fusion dans `main` après ta validation | |
| Données brutes | `data/raw/` (non versionné) ; sorties dans `public/data/` + `manifest.json` (source, licence, date de récupération, sha256) | |

## Phase 0 — Audit des données ✅ (cette livraison)

`docs/BRIEF.md`, `docs/DATA_AUDIT.md`, `docs/PLAN.md`.

## Phase 1 — Socle

1. **Scaffold** Next 16 (App Router, TS strict, Tailwind 4, ESLint), arborescence du brief (`app/`, `components/{scene,story,ui}`, `lib/{geo,data}`, `scripts/`, `fixtures/`).
2. **Direction artistique** : tokens CSS sur `:root` (`--ash-950/800/600/400`, `--bone-100`, `--char`, `--ember`, `--sea`), contrastes AA vérifiés ; polices via `next/font` (Source Serif 4 avec axe optique, IBM Plex Mono, IBM Plex Sans) ; layout éditorial vide (en-tête, grille, pied de crédits).
3. **`lib/geo`** : définition EPSG:2154 (proj4), `lonLatToScene` / `sceneToLonLat`, distance et échelle en km, tests `node:test`.
4. **Script 01-dem** : WMS-R IGN BD ALTI → Float32 2048 × ~1924 px (≈ 566 m/px) + version 1024 px pour le mobile → heightmap 16 bits. Format retenu : PNG 8 bits RGB, altitude répartie sur R et G (sans perte, compressé, décodé nativement par le navigateur). Encodeur PNG minimal en `node:zlib`, sans dépendance. Le nodata devient le masque terre/mer.
5. **Script 05-admin** : WFS Admin Express → métropole uniquement → mapshaper (simplification + projection 2154) → lignes de départements en km.
6. **Scène** : `Canvas` en import dynamique (`ssr:false`), `Terrain` (PlaneGeometry subdivisée, déplacement en vertex shader, exagération ×4 réglable et affichée, hillshade NO en fragment shader, mer « à peine plus froide »), `Borders` drapées, `CameraControls` contraint (pas sous le terrain, inclinaison ≤ 65°, zoom borné), `PerformanceMonitor` + `AdaptiveDpr`, `dpr ≤ 2`.
7. **Habillage cartographique** : barre d'échelle dynamique, indicateur du nord, coordonnées du curseur (WGS84 + Lambert-93), crédits en pied de carte, légende.
8. **Repli 2D minimal** : détection WebGL → carte SVG des départements.

## Phase 2 — Surfaces brûlées

1. **Script 02-effis** : API REST (pagination, cache brut daté) → filtre métropole → reprojection → simplification → un fichier par année (2006→2026) + index léger des propriétés ; **Script stats** : API `api2` (annuel + hebdomadaire min/moy/max).
2. **Script 04-bdiff** : export CSV 2006→2025 (session, intermédiaire TLS ajouté) → agrégats par commune, département et année. 2026 : état vide explicite.
3. **Script 06-validate** (première version) : schémas Zod sur toutes les sorties ; totaux pipeline (≥ 30 ha) comparés à l'API statistiques EFFIS (doivent être identiques) et aux chiffres de presse (écarts expliqués) → `docs/VALIDATION_REPORT.md`.
4. **`BurnMask`** : rastérisation des polygones dans une texture alignée sur la heightmap (canvas 2D, ~4096 px). Un canal porte le **jour de première détection** pour que la phase 3 filtre par date dans le shader, sans re-rastériser. Drapage dans le shader du terrain : `--char` mat pour l'année affichée, hachures pour les années antérieures, liseré `--ember` fin pour le seul feu sélectionné.
5. **Sélection** : clic → raycast → point-dans-polygone (index par bbox) → `FirePanel` (Sheet sur mobile) : commune EFFIS (libellée comme telle), première détection, surface EFFIS, couverts, Natura 2000, surface BDIFF si rapprochement univoque (voir question 4), « non renseigné » sinon.
6. **Sélecteur d'année** (Radix Select), **`SourceTag`** (source · date de la donnée · date de récupération · lien) sur chaque chiffre.

## Phase 3 — Le temps

1. **Script 03-firms** : API (clé côté script uniquement) VIIRS NOAA-20/NOAA-21/S-NPP, SP si disponible sinon NRT, 1/06→30/09/2026, emprise France → dédoublonnage, filtre des sources fixes → binaire compact (x, y en km Float32 ; jour Uint16 ; FRP ; confiance Uint8). Historique 2012→2025 depuis les archives annuelles S-NPP (sans clé, `type = 0`).
2. **`FirePoints`** : `Points` avec attributs `day`, `frp` ; filtre `uCurrentDay` dans le shader ; taille ∝ FRP ; fondu sur quelques jours ; bloom très léger réservé à ces points (optionnel).
3. **Timeline** : 1/06→30/09, lecture/pause, vitesse, pas-à-pas au clavier, `aria-live` sur la date ; le masque brûlé suit la même date via son canal « jour ».
4. **État URL** (nuqs) : `?year=&date=&fire=&cam=`.
5. (Optionnel) Route Handler serveur `/api/firms/recent` avec `revalidate` pour les dernières 72 h ; la clé n'est jamais exposée au client.

## Phase 4 — Le récit

1. **`data/events.json`** curé : chaque fait = valeur, unité, date, URL, citation courte, date de récupération ; chaque événement = liste d'IDs EFFIS + justification sourcée du regroupement. Sources primaires en priorité (préfectures, France Assureurs).
2. **Séquence** (ScrollTrigger + SplitText + Lenis), canvas fixe et caméra pilotée : Ouverture → Trévillach (4 juil.) → Gironde (22 juil.) → Var (Pontevès 21 juil. → Correns 1er août) → Vue d'ensemble → Sortie. Les dates suivent l'audit, pas le brief.
3. **Graphique cumulatif** (d3-scale/d3-shape, SVG) : 2026 vs moyenne 2006–2025 vs enveloppe min/max (EFFIS, ≥ 30 ha).
4. **Mise à l'échelle Gironde** : contour d'une commune connue (Admin Express, même projection) superposé à l'échelle exacte, uniquement si le résultat est géométriquement juste.
5. `prefers-reduced-motion` : coupes au lieu des vols, compteurs figés.

## Phase 5 — Finition

Liste des feux (TanStack Table 9) comme alternative accessible · page Méthode · navigation clavier complète, focus stylé · audit reduced-motion · perf (React Scan, bundle analyzer, Lighthouse mobile) · Playwright (Récit, Explorer, `?fire=` via URL, repli 2D) · vérification « aucune clé dans `.next/static` » · revue écran par écran de la liste noire · README (lancement, scripts, variables d'environnement, licences et attributions).

## Questions ouvertes (elles changent l'architecture)

1. **Clé FIRMS** : as-tu une `MAP_KEY` ? (Elle est gratuite, et je ne peux pas créer de compte à ta place.) Sans clé, il n'y aura pas de points 2026 : la timeline n'animera que les contours EFFIS, avec un état vide honnête pour FIRMS.
2. **Chiffre d'ouverture** : « 98 459 ha en 2026 (année civile) » ou « 71 218 ha du 1er juin au 30 septembre » ? Ma recommandation : l'année civile en grand, parce que c'est le chiffre officiel EFFIS cité par la presse, avec la saison en sous-titre. Le titre parlerait alors de « l'année 2026 » et non de « l'été ».
3. **Pays voisins** : France seule en relief, sur fond `--ash-950` (MNT IGN, sans GDAL — ma recommandation, effet « planche d'atlas »), ou voisins en relief (Copernicus GLO-90, ajoute GDAL au pipeline) ?
4. **BDIFF par feu** : rapprocher un polygone EFFIS d'une fiche BDIFF (commune intersectée + date proche) seulement quand il n'y a **qu'un candidat**, avec la mention « rapprochement automatique » ? Ou rester sur les agrégats commune/département ?
