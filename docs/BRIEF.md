# FireStrain — Brief pour Claude Code

> Colle ce fichier à la racine du repo (ex. `docs/BRIEF.md`) et démarre Claude Code avec :
> « Lis `docs/BRIEF.md` en entier, puis propose-moi un plan par phases avant d'écrire du code. »

---

## 0. Ton rôle et ta façon de travailler

Tu es un·e développeur·se front-end senior spécialisé·e en visualisation de données géographiques et en WebGL, avec une sensibilité de designer éditorial (data-journalisme de presse quotidienne, atlas imprimés). Tu construis **FireStrain**, un side project personnel.

Règles de travail :

1. **Commence par un plan** découpé selon les phases de la section 8. Attends ma validation avant la phase 1.
2. **Vérifie les versions avant d'installer** : React 19 ⇄ React Three Fiber 9 (R3F 8 = React 18). Utilise les dernières versions stables de Next.js, Tailwind, Drei, GSAP. Lis la doc officielle si un doute existe, ne te fie pas à ta mémoire.
3. **N'ajoute aucune dépendance hors de la liste de la section 5** sans me demander et sans justifier (poids, maintenance, licence).
4. **Ne fabrique jamais de données.** Pas de mock présenté comme réel, pas de chiffre « plausible ». Si une source est inaccessible, dis-le-moi et affiche un état vide honnête dans l'UI. Les fixtures de dev vivent dans `fixtures/` et sont visiblement marquées « DONNÉES FICTIVES » si elles s'affichent.
5. **Un commit propre par étape** significative, messages conventionnels.
6. À la fin de chaque phase : résumé court de ce qui marche, de ce qui reste, et des limites rencontrées.

---

## 1. Le projet

**FireStrain** est une visualisation 3D interactive des feux de forêt en France métropolitaine (Hexagone + Corse) et de leurs dégâts, centrée sur la saison exceptionnelle de **l'été 2026**, avec la possibilité de la comparer aux années précédentes.

L'utilisateur doit pouvoir :
- **comprendre** l'ampleur de la saison 2026 en 90 secondes (mode Récit) ;
- **explorer** librement le relief français, les surfaces brûlées et la progression des feux dans le temps (mode Explorer) ;
- **vérifier** chaque chiffre : source, date de la donnée, méthode.

### Contexte factuel (points de départ — à vérifier et sourcer, ne pas recopier tels quels)

Ces éléments viennent de dépêches de presse d'octobre 2026. Utilise-les pour la structure du récit, mais **chaque chiffre affiché doit être revérifié et lié à sa source** dans `data/events.json` :

- Saison 2026 : près de 100 000 ha brûlés, record depuis une vingtaine d'années de mesures satellitaires (AFP / France Assureurs, oct. 2026).
- Feu le plus vaste : Gironde, ~42 000 ha mi-juillet, du jamais vu depuis 1949 ; ~180 habitations détruites au Porge.
- Début juillet : feu de Trévillach (Pyrénées-Orientales), ~4 900 ha, 26 communes évacuées.
- Août : feux dans le Var (Correns notamment).
- Bilan assurantiel : ~22 500 sinistres, coût estimé ~563 M€ (France Assureurs, 16 oct. 2026).

Sources de départ :
- https://www.dhnet.be/dernieres-depeches/2026/10/16/le-cout-des-incendies-en-france-cet-ete-evalue-a-563-millions-deuros-X2XSWO6Z2NG6RM4IUSPWNZFVKQ/
- https://selectra.info/energie/actualites/marche/incendies-france-juillet-2026-point-feux-en-cours-bilan
- https://www.sudradio.fr/societe/feux-de-forets-dans-le-sud-pres-de-500-millions-deuros-de-dommages-assures

**Ton** : c'est une catastrophe réelle avec des victimes (sinistrés, sapeurs-pompiers décédés). L'interface est sobre, précise, respectueuse. **Aucune esthétisation spectaculaire du feu**, aucune gamification, aucun emoji 🔥, aucun vocabulaire de film catastrophe.

---

## 2. Les données — sources et règles

### Sources

| Source | Contenu | Usage dans FireStrain | Notes |
|---|---|---|---|
| **EFFIS** (Copernicus / JRC) — https://forest-fire.emergency.copernicus.eu/applications/data-and-services | Polygones de surfaces brûlées (≈ ≥ 30 ha), dates, répartition par occupation du sol, sévérité (certaines années) | **Source principale des contours** 2026 et historique 2006→2025 | Licence CC-BY 4.0, attribution obligatoire. Vérifie les champs réels du fichier (dates, surface, % par type de couvert) avant de concevoir le schéma. |
| **NASA FIRMS** — https://firms.modaps.eosdis.nasa.gov/api/area/ | Détections de points chauds VIIRS (NOAA-20/21, S-NPP) et MODIS, CSV | **Progression temporelle** des feux (animation jour par jour) | Clé `MAP_KEY` gratuite, CSV uniquement. Limite ~5 000 transactions / 10 min. Pour l'archive de la saison : produits SP si disponibles, sinon NRT. |
| **BDIFF** (IGN pour le ministère de l'Agriculture) — https://bdiff.agriculture.gouv.fr | Tous les feux déclarés par les SDIS : commune d'éclosion, date, surface, cause | Statistiques par commune/département, petits feux absents d'EFFIS, causes | **Pas de contours**, localisation à la commune. Les données de l'année en cours peuvent ne pas être validées : afficher le statut. |
| **IGN Géoplateforme** — https://geoservices.ign.fr/documentation | MNT (BD ALTI®, RGE ALTI®), limites administratives (Admin Express), Plan IGN | Relief 3D, contours départements/communes | Pour le relief national, télécharger un MNT et le pré-traiter ; ne pas appeler l'API d'altimétrie point par point. Alternative : Copernicus DEM GLO-90. |
| **Presse / communiqués officiels** | Habitations détruites, évacuations, victimes, coûts assurés | `data/events.json`, saisi à la main | Chaque entrée : valeur, unité, date, URL source, citation courte. |

### Règles de vérité

- **EFFIS et BDIFF divergent** (télédétection vs déclarations SDIS ; écarts de plusieurs milliers d'ha/an). Ne les additionne jamais. Affiche toujours la source à côté du chiffre, et explique la différence dans une page « Méthode ».
- Chaque nombre affiché porte : **source · date de la donnée · date de récupération**.
- FIRMS détecte des **anomalies thermiques**, pas des surfaces brûlées : ne jamais convertir des points en hectares.
- Pas de « dégâts » inventés ou extrapolés. Si une donnée de dommages n'existe pas pour un feu, le champ reste vide (« non renseigné »).

---

## 3. L'expérience

### Mode Récit (page d'accueil, scrollytelling)

Séquence pilotée au scroll, la scène 3D reste fixe en arrière-plan et la caméra se déplace :

1. **Ouverture** — France entière en relief, vue oblique, lumière rasante. Titre « FireStrain » + une phrase factuelle (pas de slogan). Le compteur d'hectares 2026 apparaît, sourcé.
2. **Début juillet** — vol vers les Pyrénées-Orientales (Trévillach). Les points FIRMS s'allument jour par jour, puis le contour EFFIS se « carbonise » sur le relief.
3. **Mi-juillet, Gironde** — la séquence centrale. Progression du feu sur plusieurs jours, contour final, mise à l'échelle (ex. superposition comparative avec une ville connue — si et seulement si c'est géométriquement exact). Encadré dégâts : habitations détruites, communes évacuées, avec sources.
4. **Août, Var** — idem, plus court.
5. **Vue d'ensemble** — dézoom, toutes les surfaces 2026 visibles ; petit graphique cumulatif 2026 vs moyenne 2006–2025 vs min/max (données EFFIS).
6. **Sortie** — bouton vers le mode Explorer, lien vers la page Méthode.

### Mode Explorer

- Carte 3D libre (orbit contraint : pas de vue sous le terrain, inclinaison max ~65°, zoom borné à la France).
- **Barre temporelle** en bas : 1er juin → 30 septembre 2026, lecture/pause, vitesse ; les points FIRMS et les contours apparaissent selon la date.
- **Sélecteur d'année** (2006→2026) pour comparer.
- **Clic sur un feu** → panneau latéral : nom/commune, dates de début et fin, surface (EFFIS et BDIFF si disponibles, séparées), répartition par type de couvert, dégâts sourcés, mini-profil temporel des détections FIRMS.
- **Liste des feux** triable (TanStack Table) — c'est aussi l'**alternative accessible** à la 3D.
- **État dans l'URL** (nuqs) : `?year=2026&date=2026-07-18&fire=<id>&cam=<preset>` → tout est partageable.

### Page Méthode

Sources, licences, limites, différences EFFIS/BDIFF, date de dernière mise à jour des données. Ton sobre, texte court.

---

## 4. Direction artistique — « Atlas de cendre »

L'objectif : que ça ressemble à une **planche d'atlas scientifique** ou à une infographie de grand quotidien, **pas** à un template SaaS ni à une démo WebGL.

### Références d'esprit
Cartographie en relief ombré (hillshade) des atlas imprimés, cartes topographiques IGN, data-journalisme (Le Monde, NYT Upshot, Reuters Graphics). Beaucoup de noir chaud, du blanc os, **une seule** couleur d'accent.

### Palette (tokens CSS sur `:root`, utilisés aussi dans les shaders)
- `--ash-950` fond : noir chaud, légèrement brun (≈ `#11100E`)
- `--ash-800 / 600 / 400` : gris cendre chauds pour le relief et les traits
- `--bone-100` texte principal : blanc cassé papier (≈ `#E9E4D8`)
- `--char` : surfaces brûlées — un brun-noir carbonisé, mat, **pas** un rouge vif
- `--ember` : **seul accent**, orange braise (≈ `#FF5A1F`), réservé aux détections actives et à l'élément interactif sélectionné
- Mer : à peine plus froide que le fond, sans bleu saturé

Contraste texte ≥ 4.5:1 (WCAG AA). Ne pas reposer sur la couleur seule pour porter du sens (motifs/hachures pour les surfaces brûlées historiques vs 2026).

### Typographie
- **Titres / chiffres clés** : une serif variable avec axe optique (proposition : *Source Serif 4*), utilisée grand et serré.
- **Données, coordonnées, dates, légendes** : une mono à chiffres tabulaires (proposition : *IBM Plex Mono*).
- **UI** : une sans sobre (proposition : *IBM Plex Sans*).
- Évite Inter, Geist, Space Grotesk, Poppins. Si tu proposes une autre paire, justifie-la en une ligne.
- Hiérarchie stricte, petites capitales/letter-spacing pour les étiquettes de carte, alignements sur une grille éditoriale.

### Langage cartographique (c'est ce qui fera la différence)
- Barre d'échelle en km qui se met à jour avec le zoom, rose/indicateur du nord, coordonnées du curseur (Lambert-93 ou WGS84).
- Crédits de sources en pied de carte, comme sur une carte imprimée.
- Étiquettes de lieux rares et choisies (préfectures, communes concernées), pas de surcharge.
- Légende fixe et lisible.

### Liste noire (interdit)
Dégradés violet/indigo, glassmorphism généralisé, bordures néon/glow, effets « spotlight » qui suivent la souris, texte en dégradé, grilles bento, cartes `rounded-2xl` + grosse ombre partout, particules décoratives, lens flare, flammes 3D cartoon, fumée volumétrique gratuite, curseurs personnalisés, loaders avec faux pourcentage, copy générique (« Visualisez l'avenir », « Découvrez la puissance de… »), emojis.

### Mouvement
- Lent, intentionnel, au service de la lecture. Courbes d'easing douces (pas de rebonds sur la donnée).
- Le bloom (postprocessing) ne touche **que** les points de braise, très léger. Grain subtil optionnel.
- `prefers-reduced-motion` : vols caméra remplacés par des coupes, pas d'animation de compteur, timeline en pas-à-pas.

---

## 5. Stack (issue du toolkit fourni — ne pas en sortir sans demander)

| Rôle | Choix | Pourquoi |
|---|---|---|
| Structure | **Next.js** (App Router) · **TypeScript** strict | Base |
| Style | **Tailwind CSS** (tokens CSS custom, pas de palette par défaut) | |
| Composants fonctionnels | **shadcn/ui / Radix** — uniquement pour slider, dialog, popover, select, tooltip, sheet | Accessibilité ; restyler entièrement selon la DA |
| 3D | **Three.js · React Three Fiber · Drei** | Terrain, caméra, `Html`, `PerformanceMonitor`, `AdaptiveDpr` |
| Finition 3D | **React Postprocessing** (bloom sélectif léger) | Optionnel, à la demande |
| Scroll / récit | **GSAP + ScrollTrigger · SplitText · Lenis** | Orchestration caméra et révélation des titres |
| Micro-interactions UI | **Motion** | Panneaux, listes. **Jamais** sur un élément déjà animé par GSAP |
| État client | **Zustand** | date courante, feu sélectionné, mode |
| Données | **TanStack Query** | chargement des fichiers statiques et de l'API FIRMS |
| URL | **nuqs** | état partageable |
| Validation | **Zod** | schémas des fichiers de données, à la lecture |
| Tableau | **TanStack Table** | liste des feux / alternative accessible |
| Qualité | **Playwright · Lighthouse · React Scan · Next Bundle Analyzer · Sentry** (Sentry optionnel) | |

Exceptions autorisées (hors toolkit, justifiées) : **proj4** (projection Lambert-93 / EPSG:2154), **mapshaper** ou **@turf/** (simplification/calculs géo, scripts uniquement), **d3-scale / d3-shape** (petits graphiques). Pour le pré-traitement raster, tu peux utiliser GDAL en CLI ou Python dans `scripts/` — explique-moi l'installation.

**À ne pas utiliser** : Aceternity UI, Magic UI, React Bits, Vanta.js, tsParticles (risque de rendu « template » contraire à la DA). Theatre.js seulement si GSAP ne suffit pas pour la chorégraphie caméra — demande-moi avant.

---

## 6. Architecture technique

### Pipeline de données (build-time, hors du bundle client)

```
scripts/
  01-dem.(ts|py)        MNT France → heightmap 16 bits (PNG ou .bin Float32), ~2048 px de large, projeté en Lambert-93
  02-effis.ts           Polygones EFFIS → filtre France → reprojection → simplification → FlatGeobuf ou GeoJSON compressé, un fichier par année
  03-firms.ts           Archive FIRMS été 2026 (bbox France) → binaire compact (x, y, jour, FRP, confiance) 
  04-bdiff.ts           Export BDIFF → agrégats par commune/département et par année (JSON)
  05-admin.ts           Limites départements (Admin Express) → lignes simplifiées
  06-validate.ts        Validation Zod de tous les fichiers produits + rapport (nb d'entités, totaux en ha comparés aux chiffres publiés)
public/data/            Sorties versionnées, avec un manifest.json (source, licence, date de récupération, hash)
data/events.json        Faits curés à la main (dégâts, évacuations), chacun avec URL source
```

- Le site est **statique** pour l'historique. La clé FIRMS ne sert qu'en script et éventuellement dans une **Route Handler** serveur avec cache (`revalidate`) pour les dernières 24–72 h ; elle n'est **jamais** exposée côté client (`.env.local`, `FIRMS_MAP_KEY`).
- Un seul système de coordonnées de scène : Lambert-93 normalisé (1 unité = 1 km par ex.), centré sur la France. Fonctions utilitaires testées `lonLatToScene()` / `sceneToLonLat()`.

### Rendu 3D

- **Terrain** : `PlaneGeometry` subdivisée, déplacement dans le vertex shader depuis la heightmap, exagération verticale réglable (≈ ×3 à ×6, valeur affichée dans la légende). Hillshade calculé dans le fragment shader (lumière rasante nord-ouest, convention cartographique). Masque terre/mer.
- **Surfaces brûlées** : ne pas extruder des polygones au-dessus du terrain (z-fighting, rendu « jeu vidéo »). Les **rastériser dans une texture-masque** (canvas 2D ou render target) alignée sur la heightmap, puis la **draper dans le shader du terrain** : teinte `--char`, liseré `--ember` fin animé uniquement pour le feu sélectionné ou en cours dans la timeline. Les années antérieures en hachures/ton plus clair.
- **Détections FIRMS** : `InstancedMesh` ou `Points` avec attribut `day` ; le filtrage par date se fait **dans le shader** via un uniform `uCurrentDay` (pas de re-création de géométrie). Taille ∝ FRP, fondu sur quelques jours après détection.
- **Contours départementaux** : lignes fines drapées, très discrètes.
- **Caméra** : presets nommés (France, Pyrénées-Orientales, Gironde, Var…) ; transitions GSAP en mode Récit, `CameraControls` (Drei) en mode Explorer.
- **Étiquettes** : `Html` de Drei ou `Text`, peu nombreuses, occlusion gérée.

### Organisation

```
app/
  page.tsx                 Récit
  explorer/page.tsx
  methode/page.tsx
components/
  scene/                   Canvas (dynamic import, ssr:false), Terrain, BurnMask, FirePoints, Borders, CameraRig
  story/                   sections du récit + ScrollTrigger
  ui/                      Timeline, FirePanel, Legend, ScaleBar, SourceTag, FiresTable
lib/
  geo/                     projections, conversions (testées)
  data/                    loaders TanStack Query + schémas Zod
  store.ts                 Zustand
```

---

## 7. Performance, accessibilité, robustesse

- Canvas chargé à la demande, `dpr` plafonné à 2, `PerformanceMonitor` + `AdaptiveDpr` pour dégrader proprement.
- Budget indicatif : JS initial < 250 kB gz hors scène 3D ; LCP < 2,5 s sur 4G ; 60 fps desktop milieu de gamme, ≥ 30 fps sur mobile récent.
- **Repli sans WebGL** (ou appareil trop faible) : carte 2D SVG des départements + surfaces brûlées, même timeline, même panneau.
- Navigation clavier complète (timeline, liste des feux, sélection), focus visible stylé selon la DA, annonces `aria-live` pour la date courante et le feu sélectionné.
- `prefers-reduced-motion` respecté partout (voir section 4).
- Mobile : mode Récit d'abord, Explorer simplifié (panneau en `Sheet`), pas d'interaction qui exige le survol.
- Langue : français, formats de date et de nombres `fr-FR` (`42 000 ha`, `18 juil. 2026`).

---

## 8. Phases de livraison

**Phase 0 — Audit des données (avant tout code d'UI)**
Récupère un échantillon de chaque source, documente les champs réels, la licence, la fraîcheur des données 2026. Livre `docs/DATA_AUDIT.md` et dis-moi ce qui est disponible ou non (notamment : contours EFFIS 2026 complets ? archive FIRMS été 2026 ? BDIFF 2026 validée ?).

**Phase 1 — Socle**
Projet Next.js + tokens de DA + typographies + layout éditorial vide. Scripts 01 et 05. Terrain France en hillshade avec contours départementaux, caméra libre. Repli 2D minimal.

**Phase 2 — Surfaces brûlées**
Script 02 + masque drapé + sélection d'un feu + panneau latéral + sélecteur d'année + `SourceTag` sur chaque chiffre.

**Phase 3 — Le temps**
Script 03 + points FIRMS filtrés en shader + timeline lecture/pause + état URL (nuqs).

**Phase 4 — Le récit**
Mode Récit complet (ScrollTrigger, SplitText, Lenis), `events.json` curé et sourcé, graphique cumulatif.

**Phase 5 — Finition**
Liste des feux (TanStack Table), page Méthode, accessibilité, reduced-motion, perf (React Scan, bundle analyzer, Lighthouse), tests Playwright, README.

**V2 (plus tard)** : cartes de sévérité EFFIS, comparaison côte à côte de deux années, données de risque météo (indice feu), export d'image d'une vue.

---

## 9. Critères d'acceptation

- [ ] Aucun chiffre affiché sans source, date de donnée et lien.
- [ ] Les totaux d'hectares calculés par le pipeline sont comparés aux chiffres officiels publiés dans le rapport `06-validate`, écarts expliqués.
- [ ] Lighthouse ≥ 90 en Accessibilité et Bonnes pratiques ; Performance ≥ 80 sur la page Récit (mobile).
- [ ] Fonctionne sans WebGL (repli 2D) et avec `prefers-reduced-motion`.
- [ ] Toute l'interface utilisable au clavier.
- [ ] Aucune clé d'API dans le bundle client (vérifier).
- [ ] Tests Playwright : chargement Récit, navigation Explorer, sélection d'un feu via URL, repli 2D.
- [ ] Rendu conforme à la liste noire de la section 4 — fais une revue explicite écran par écran à la fin.
- [ ] README : lancement, scripts de données, variables d'environnement, sources et licences (attribution EFFIS CC-BY 4.0, IGN, NASA FIRMS).

---

Commence par la **Phase 0** et ton plan détaillé. Pose-moi tes questions s'il y a une ambiguïté qui changerait l'architecture.
