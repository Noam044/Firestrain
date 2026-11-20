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

## Décisions validées (20/10/2026)

- **Chiffre d'ouverture** : année civile (98 459 ha, EFFIS ≥ 30 ha) en grand, saison 1/06→30/09 en sous-titre ; le récit parle de « l'année 2026 ».
- **Relief** : France seule (MNT IGN), sans les pays voisins.
- **BDIFF par feu** : rapprochement avec un polygone EFFIS seulement s'il n'y a qu'un candidat, signalé « rapprochement automatique » ; sinon agrégats commune/département.
- **FIRMS** : clé `MAP_KEY` en cours de création ; elle ira dans `.env.local` (`FIRMS_MAP_KEY`), jamais côté client.

## Écarts au plan, décidés en phase 1

- **Format de la heightmap** : binaire maison `fs-dem-1` (codes Uint16 au 0,1 m, prédiction planaire, plans d'octets, gzip) plutôt qu'un PNG 8 bits RGB. Le décodage est exact, sans risque de gestion des couleurs par le navigateur, et pèse 2,66 Mo à 500 m (0,72 Mo à 1 000 m pour le mobile).
- **Masque terre/mer** : rastérisation du contour ADMIN EXPRESS dans le navigateur, et non le *nodata* du MNT. Les dalles BD ALTI côtières codent la mer à exactement 0,0 m, et les dalles frontalières contiennent du terrain étranger.
- **Mipmaps de la heightmap** calculés dans un Web Worker : le GPU ne sait pas générer les niveaux d'une texture demi-flottante en WebGL 2, et sans eux l'ombrage scintille en vue d'ensemble.
- **Indicateur du nord** : nord géographique, et non le nord du quadrillage Lambert-93 (convergence des méridiens jusqu'à ±4°).

## Écarts au plan, décidés en phase 2

- **Rapprochement EFFIS ↔ BDIFF durci** : la fenêtre d'un jour après la détection excluait Landiras 2022 (le polygone EFFIS, daté du 7 juillet, fusionne un petit feu antérieur) et liait un polygone de 13 116 ha à une fiche de 5,74 ha. Règle appliquée : commune touchée, alerte à ±10 jours, fiche ≥ 1 ha, surface déclarée entre 25 % et 400 % de la surface EFFIS, candidat unique (822 liens, vérifiés à la main sur les plus grands feux).
- **BDIFF « type F »** : filtre appliqué par la BDIFF elle-même à la recherche par période ; non documenté publiquement, signalé dans la page Méthode.
- **Lisibilité des surfaces brûlées** : `--char` assombri (#1C100A), relief plat remonté à `--ash-700`, liseré clair calculé dans le shader (contraste 8,75:1 avec le brûlé).
- **Année d'un feu** : année de la date locale publiée par EFFIS (et non UTC), ce qui rend les totaux identiques aux statistiques officielles.

## Phase 0 — Audit des données ✅

`docs/BRIEF.md`, `docs/DATA_AUDIT.md`, `docs/PLAN.md`.

## Phase 1 — Socle ✅

1. **Scaffold** Next 16 (App Router, TS strict, Tailwind 4, ESLint), arborescence du brief (`app/`, `components/{scene,story,ui}`, `lib/{geo,data}`, `scripts/`, `fixtures/`).
2. **Direction artistique** : tokens CSS sur `:root` (`--ash-950/800/600/400`, `--bone-100`, `--char`, `--ember`, `--sea`), contrastes AA vérifiés ; polices via `next/font` (Source Serif 4 avec axe optique, IBM Plex Mono, IBM Plex Sans) ; layout éditorial vide (en-tête, grille, pied de crédits).
3. **`lib/geo`** : définition EPSG:2154 (proj4), `lonLatToScene` / `sceneToLonLat`, distance et échelle en km, tests `node:test`.
4. **Script 01-dem** : WMS-R IGN BD ALTI → Float32 2048 × ~1924 px (≈ 566 m/px) + version 1024 px pour le mobile → heightmap 16 bits. Format retenu : PNG 8 bits RGB, altitude répartie sur R et G (sans perte, compressé, décodé nativement par le navigateur). Encodeur PNG minimal en `node:zlib`, sans dépendance. Le nodata devient le masque terre/mer.
5. **Script 05-admin** : WFS Admin Express → métropole uniquement → mapshaper (simplification + projection 2154) → lignes de départements en km.
6. **Scène** : `Canvas` en import dynamique (`ssr:false`), `Terrain` (PlaneGeometry subdivisée, déplacement en vertex shader, exagération ×4 réglable et affichée, hillshade NO en fragment shader, mer « à peine plus froide »), `Borders` drapées, `CameraControls` contraint (pas sous le terrain, inclinaison ≤ 65°, zoom borné), `PerformanceMonitor` + `AdaptiveDpr`, `dpr ≤ 2`.
7. **Habillage cartographique** : barre d'échelle dynamique, indicateur du nord, coordonnées du curseur (WGS84 + Lambert-93), crédits en pied de carte, légende.
8. **Repli 2D minimal** : détection WebGL → carte SVG des départements.

## Phase 2 — Surfaces brûlées ✅

1. **Script 02-effis** : API REST (pagination, cache brut daté) → filtre métropole → reprojection → simplification → un fichier par année (2006→2026) + index léger des propriétés ; **Script stats** : API `api2` (annuel + hebdomadaire min/moy/max).
2. **Script 04-bdiff** : export CSV 2006→2025 (session, intermédiaire TLS ajouté) → agrégats par commune, département et année. 2026 : état vide explicite.
3. **Script 06-validate** (première version) : schémas Zod sur toutes les sorties ; totaux pipeline (≥ 30 ha) comparés à l'API statistiques EFFIS (doivent être identiques) et aux chiffres de presse (écarts expliqués) → `docs/VALIDATION_REPORT.md`.
4. **`BurnMask`** : rastérisation des polygones dans une texture alignée sur la heightmap (canvas 2D, ~4096 px). Un canal porte le **jour de première détection** pour que la phase 3 filtre par date dans le shader, sans re-rastériser. Drapage dans le shader du terrain : `--char` mat pour l'année affichée, hachures pour les années antérieures, liseré `--ember` fin pour le seul feu sélectionné.
5. **Sélection** : clic → raycast → point-dans-polygone (index par bbox) → `FirePanel` (Sheet sur mobile) : commune EFFIS (libellée comme telle), première détection, surface EFFIS, couverts, Natura 2000, surface BDIFF si rapprochement univoque (voir question 4), « non renseigné » sinon.
6. **Sélecteur d'année** (Radix Select), **`SourceTag`** (source · date de la donnée · date de récupération · lien) sur chaque chiffre.

## Phase 3 — Le temps ✅

1. **Script 03-firms** : API (clé côté script uniquement) VIIRS NOAA-20/NOAA-21/S-NPP, SP si disponible sinon NRT, 1/06→30/09/2026, emprise France → dédoublonnage, filtre des sources fixes → binaire compact (x, y en km Float32 ; jour Uint16 ; FRP ; confiance Uint8). Historique 2012→2025 depuis les archives annuelles S-NPP (sans clé, `type = 0`).
2. **`FirePoints`** : `Points` avec attributs `day`, `frp` ; filtre `uCurrentDay` dans le shader ; taille ∝ FRP ; fondu sur quelques jours ; bloom très léger réservé à ces points (optionnel).
3. **Timeline** : 1/06→30/09, lecture/pause, vitesse, pas-à-pas au clavier, `aria-live` sur la date ; le masque brûlé suit la même date via son canal « jour ».
4. **État URL** (nuqs) : `?year=&date=&fire=&cam=`.
5. (Optionnel) Route Handler serveur `/api/firms/recent` avec `revalidate` pour les dernières 72 h ; la clé n'est jamais exposée au client.

## Phase 3.1 — L'année entière ✅

Demande de validation de la phase 3 : le sujet est le feu **toute l'année**, pas seulement l'été.

1. **Frise** du 1er janvier au 31 décembre (365/366 jours), 12 mois, vitesses 2/7/15 j/s ; jour de frise = jour de l'année (heure de Paris).
2. **Masque brûlé** : jour de première détection sur deux octets (B haut, A bas) ; l'année affichée est rastérisée sans mélange, du feu le plus tardif au plus précoce (le plus précoce l'emporte), puis l'historique en MAX dans G.
3. **03-firms** : années civiles complètes ; 2026 du 1er janvier à la veille de l'exécution (SP jusqu'au 30 juin, NRT ensuite), `lastDate` par année dans l'index ; mailles de sources fixes publiées (`firms/sources-fixes.json`). Les écobuages de février–avril (Pays basque, Pyrénées) apparaissent : ~7 500 détections en 2026.
4. **Route serveur** `/api/firms/recent` : NRT des 72 dernières heures (3 satellites), filtre France + sources fixes, `'use cache'` + `cacheLife('hours')`, réponse en colonnes, 503 générique en cas d'échec ; bouton « 72 h » dans la frise (année en cours), SourceTag avec l'heure d'interrogation. Clé absente de `.next/static`, de `public` et des réponses.
5. **Profil FIRMS d'un feu** : détections de 2 jours avant à 60 jours après la date EFFIS, à moins de 400 m du contour.

## Phase 4 — Le récit ✅

Adaptation à l'année entière : la séquence suit le calendrier (écobuages de fin d'hiver → feux d'été → automne), et le graphique cumulatif couvre janvier → décembre.

1. **`data/events.json`** curé : chaque fait = valeur, unité, date, URL, citation courte, date de récupération ; chaque événement = liste d'IDs EFFIS + justification sourcée du regroupement. Sources primaires en priorité (préfectures, France Assureurs).
2. **Séquence** (ScrollTrigger + SplitText + Lenis), canvas fixe et caméra pilotée : Ouverture → Trévillach (4 juil.) → Gironde (22 juil.) → Var (Pontevès 21 juil. → Correns 1er août) → Vue d'ensemble → Sortie. Les dates suivent l'audit, pas le brief.
3. **Graphique cumulatif** (d3-scale/d3-shape, SVG) : 2026 vs moyenne 2006–2025 vs enveloppe min/max (EFFIS, ≥ 30 ha).
4. **Mise à l'échelle Gironde** : contour d'une commune connue (Admin Express, même projection) superposé à l'échelle exacte, uniquement si le résultat est géométriquement juste.
5. `prefers-reduced-motion` : coupes au lieu des vols, compteurs figés.

Réalisé (écarts compris) :

- **Séquence** : Ouverture (98 459 ha, précédent maximum 2022, 27 241 ha hors de l'été) → **fin février, Pyrénées-Atlantiques** (436 polygones, 22 181 ha, 82 % « autres espaces naturels ») → Trévillach → Gironde → **à la même échelle** (3,6 fois Paris) → Var (Gros Bessillon) → Toute l'année (graphique + dommages assurés) → Sortie. Chaque étape cadre la caméra sur l'emprise des polygones de l'événement ; le défilement fait avancer la date (FIRMS des 3 derniers jours, surfaces dès leur première détection).
- **Faits** : 14 citations vérifiées dans leurs pages (préfectures 66, 33, 83 ; France Assureurs le 28 août, et sa mise à jour du 16 octobre via l'AFP). Aucune source officielle trouvée pour les feux de février en Pyrénées-Atlantiques : l'étape ne montre que les données EFFIS et FIRMS, sans cause.
- **Regroupements** recalculés par `07-story` : contiguïté < 1 km dans la période (Trévillach 5 polygones, 4 307 ha ; Gironde 7, 37 500 ha ; Var 17, 5 976 ha) ou département + période (février).
- **Graphique** : série hebdomadaire officielle EFFIS (2026, moyenne et enveloppe 2006–2025), pas un recalcul ; 2026 dépasse le maximum dès la semaine du 8 juillet.
- **Échelle** : Paris (ADMIN EXPRESS, 10 543 ha) seulement translaté dans le même repère Lambert-93 ; écart de facteur d'échelle 0,04 %.
- Points FIRMS plus petits et plus discrets dans le récit (densité des grands feux) ; état de la carte emprunté puis rendu à l'Explorer.
- Lighthouse (mobile) sur le récit : 100 en accessibilité, bonnes pratiques et SEO.

## Phase 5 — Finition ✅

- **Liste des feux** (`/liste`, TanStack Table 9) : tri, filtre texte, mois de première détection, seuil 30 ha, pagination ; surface BDIFF quand le rapprochement est univoque (jamais additionnée) ; la commune mène au feu sur la carte. Liens depuis la navigation, le panneau Année et un lien d'évitement de l'Explorer.
- **Accessibilité** : anneau de focus 2 px ; test Playwright de chaque arrêt de tabulation (récit, Explorer, liste, Méthode) ; carte aux flèches ; annonces `aria-live` de la date et du feu ; section « Rendu et accessibilité » dans Méthode.
- **Performance** : sans accélération graphique (rendu WebGL logiciel), la carte passe en 2D — chaque image du relief y coûtait plusieurs secondes (TBT Lighthouse 10 s → 140 ms) ; `rendu=3d` force le relief. Police serif sans italique (−122 Ko préchargés), favicon. React Scan : la frise, la légende et la carte 2D ne se re-rendent plus à chaque image de lecture (≈ 250 → ≈ 32 rendus en 4 s). Lighthouse mobile : récit 86–89, Explorer 88, liste 91, Méthode 96 en performance ; 100 en accessibilité, bonnes pratiques et SEO.
- **Tests Playwright** (23, bureau et téléphone) : récit et sa source, défilement jusqu'à la Gironde, mouvement réduit, changement d'année, frise au clavier, feu via l'URL, identifiant inconnu, repli 2D (demandé, sans WebGL 2, rendu logiciel), liste, clavier.
- **Revue** écran par écran de la liste noire et des critères d'acceptation : [`docs/REVIEW.md`](REVIEW.md). Sources ajoutées là où elles manquaient (compte FIRMS de la frise, chiffres EFFIS des chapitres du récit, comparaison d'échelle).

## Refonte — carte interactive (demande du 20/10/2026)

Demande : supprimer le récit et ne garder qu'un site interactif pour voir les feux de chaque année ; l'interface
précédente (noir et braise, panneaux flottants partout, petites capitales) était jugée peu ergonomique et
« générée ».

- **Récit supprimé** (page, composants, GSAP, Lenis, d3). Les faits sourcés restent, rattachés aux feux concernés dans leur panneau (`07-events`, `events/events.json`).
- **Une seule page, `/`** : une colonne de commandes et la carte. `/explorer` redirige.
- **Identité « Relevé »** : papier froid, encre vert forêt, sol brûlé rouge brûlis (`#b83a1b`), années précédentes en hachures cendre, points chauds ambre ; une seule famille, Archivo, sur son axe de largeur (étroite pour les étiquettes, large pour les chiffres) ; carte en relief clair sur fond « mer ».
- **Frise des années** : 21 barres à la surface réelle (feux ≥ 30 ha), qui sont le sélecteur d'année (clic, flèches du clavier).
- **Mois de l'année** : chaque barre filtre la carte (seuls les feux détectés ce mois-là), lecture jour par jour avec un cumul qui monte, curseur au clavier.
- **Panneau d'un feu** dans la colonne (retour à l'année), infobulle au survol, plus grandes surfaces de la période, clé de carte avec ses interrupteurs, commandes de carte (zoom, vue d'ensemble, fond de carte façon Google Maps).
- Lighthouse mobile (première version) : carte 86–88 en performance (index EFFIS livré avec la page), 100 en accessibilité, bonnes pratiques et SEO ; liste 96, Méthode 97.

### Répartition et pays voisins (demande du 22/10/2026)

Demande : tout était empilé dans la colonne de gauche et la droite restait vide ; répartition plus simple pour
un public non spécialiste, et pays frontaliers affichés « sans relief ni couleur, afin que la France domine, mais
ne soit pas seule ».

- **Quatre zones** : barre de titre (navigation Liste / Méthode) ; carte au centre ; **barre du temps** en bas,
  sur toute la largeur, comme sous un lecteur (années à gauche, mois et lecture à droite) ; colonne de gauche
  étroite (340 px) pour l'année affichée — chiffre, clé de carte, six plus grandes surfaces — ou le feu choisi.
  Sur téléphone : titre, carte, barre du temps, puis la colonne ; le feu s'ouvre en feuille depuis le bas, et les
  mois sont réduits à leur initiale.
- **Pays voisins** (`08-neighbours`, `admin/voisins.json`, 256 Ko) : Natural Earth 1:10m (domaine public),
  projeté en Lambert-93 puis découpé au cadre de la carte élargi de 500 km (bord parallèle à la carte, hors de
  vue ; pays lointains écartés), simplifié à 400 m. Dessinés à plat sous le niveau du
  relief, gris pâle (`--neighbour`), filet clair, noms en petites capitales grises ; noms des mers en italique.
  Aussi dans la carte 2D. La décision « France seule en relief » reste vraie : seuls les contours sont ajoutés.
- Lighthouse mobile : carte 80–86 en performance — identique à la version précédente mesurée en alternance sur la
  même machine (82–86) ; les pays voisins n'y changent rien (mesure sans eux : 80–81) —, 100 en accessibilité
  (barres des mois élargies à 24 px : vitesses de lecture passées dans l'en-tête), bonnes pratiques et SEO ;
  liste 96, Méthode 96. Tests : 29 Playwright, 25 unitaires.

## Suivi des feux récents (demande du 20/11/2026)

Demande : changer la direction artistique — garder la 3D, retirer l'aspect narratif, faire un site « wildfire
tracker » (référence : *Build a Wildfire Tracker With React & NASA API*, Traversy Media : une carte, un marqueur par
feu, un clic pour le détail) pour voir les feux récents en France, mois par mois, sans « AI slop ». Choix validés :
douze derniers mois glissants avec les archives en second plan ; interface claire type outil ; marqueur
proportionnel à la surface et contour réel au zoom ; données rafraîchies par une route serveur chaque heure.

- **Données en direct** : `/api/effis/recent` interroge l'API EFFIS (`firedate__gte` = 1er du mois, onze mois plus
  tôt), garde la métropole, reprojette et simplifie (Douglas–Peucker 40 m, `lib/geo/simplify.ts`), encode comme les
  fichiers d'archive (`lib/data/effis-records.ts`, partagé avec `02-effis`, dont la sortie est inchangée) ;
  `'use cache'` + `cacheLife('hours')`, réponse compressée (≈ 150 ko). Échec → fichiers du site jusqu'à leur date,
  avec un avertissement.
- **Temps** : `lib/span.ts` — fenêtre de douze mois (glissante ou année civile), jours comptés depuis son premier
  jour (heure de Paris) ; le masque de brûlure encode ce jour, le filtre de mois passe par le shader.
- **Marqueurs** (`FireMarkers.tsx`, `markers.ts`) : un point par feu au centroïde de sa plus grande partie, rayon
  4 + 0,22 √ha px (≤ 30), couleur par âge ; il s'efface quand le contour à l'écran dépasse le disque. Sélection au
  disque puis au contour ; un clic sur un disque vole vers le feu.
- **Interface** (`components/tracker/`) : barre du haut (période, archives, points chauds 72 h), liste des feux
  (tri, recherche), fiche du feu sans faits cités, douze mois sous la carte, légende et calques sur la carte.
  `components/atlas/`, la frise des années, la lecture jour par jour et `lib/timeline.ts` sont supprimés.
- **Identité** : blanc, gris, filets, rouge feu par âge, ambre pour les points chauds ; Atkinson Hyperlegible Next
  et Mono (nombres seuls). Adresse : `?annee=&mois=AAAA-MM&fire=&fond=` (`year` reste accepté).
- Tests : 32 Playwright (routes serveur simulées depuis les fichiers du site, repli testé), 27 unitaires.
  Lighthouse mobile : suivi 93–95, liste 97, Méthode 99 en performance ; 100 ailleurs.
- Limite : la première requête après un démarrage à froid attend EFFIS (≈ 12 s) ; ensuite la réponse en cache
  part en quelques millisecondes.

## Marque, sécurité et fonds rapides (demande du 20/11/2026)

- **Sécurité** : Next.js 16.4.2 → 16.4.6 (sept avis, dont fuites de cache `use cache` et injection de réponse en
  auto-hébergement), `eslint-config-next` 16.4.6, `npm audit fix` (minimatch via typescript-eslint) : 0 vulnérabilité.
- **FireStrain** : symbole (flamme en trois courbes de niveau, `components/brand/Logo.tsx`, favicon), barre du site
  sur toutes les pages, pied de page (sources et licences, code MIT, mention d'indépendance, numéros d'urgence).
  Accueil `/` à part (demande : « un hero classique et un bouton explorer la carte qui redirige vers la page 3D ») :
  hero, bouton « Explorer la carte », aperçu en direct des feux (même symbolique que la carte), chiffres du moment,
  trois entrées (douze mois, 72 h, archives). La carte passe à `/carte`, plein écran sous la barre ; les adresses
  `/?fire=…`, `/?annee=…` et `/explorer` y redirigent avec leurs paramètres.
- **Fonds de carte** : mesuré, le WMS mettait 5–6 s pour l'image France et 2,5–4 s par vue rapprochée. L'image France
  est désormais publiée par le site (`09-basemaps`, ≈ 720 ko, ≈ 90 ms) ; la vue rapprochée assemble les tuiles WMTS
  Lambert-93 de la Géoplateforme (`…PLANIGNV2.L93`, `HR.ORTHOIMAGERY.ORTHOPHOTOS.L93`, grille `2154_10cm_6_20`,
  donc sans reprojection) : centre d'abord, affichage au fil de l'eau (alpha prémultiplié, l'image France reste
  dessous), cache mémoire de 600 tuiles, cache navigateur de 21 jours, une seconde tentative par tuile. Première tuile
  ≈ 120 ms, vue complète ≈ 2,5 s à froid. Satellite SPOT supprimé (WMS seulement).
- **Route EFFIS** : renvoyée comme fichier gzip (`application/gzip`) et décompressée par la page : un
  `Content-Encoding` posé à la main était recompressé par le serveur de dev.
- Lighthouse mobile : accueil 99, carte 95, liste 98, Méthode 99 en performance ; 100 ailleurs. Tests : 38
  Playwright, 27 unitaires.

## Questions ouvertes (elles changent l'architecture)

1. **Clé FIRMS** : as-tu une `MAP_KEY` ? (Elle est gratuite, et je ne peux pas créer de compte à ta place.) Sans clé, il n'y aura pas de points 2026 : la timeline n'animera que les contours EFFIS, avec un état vide honnête pour FIRMS.
2. **Chiffre d'ouverture** : « 98 459 ha en 2026 (année civile) » ou « 71 218 ha du 1er juin au 30 septembre » ? Ma recommandation : l'année civile en grand, parce que c'est le chiffre officiel EFFIS cité par la presse, avec la saison en sous-titre. Le titre parlerait alors de « l'année 2026 » et non de « l'été ».
3. **Pays voisins** : France seule en relief, sur fond `--ash-950` (MNT IGN, sans GDAL — ma recommandation, effet « planche d'atlas »), ou voisins en relief (Copernicus GLO-90, ajoute GDAL au pipeline) ?
4. **BDIFF par feu** : rapprocher un polygone EFFIS d'une fiche BDIFF (commune intersectée + date proche) seulement quand il n'y a **qu'un candidat**, avec la mention « rapprochement automatique » ? Ou rester sur les agrégats commune/département ?
