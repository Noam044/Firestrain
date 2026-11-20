# FireStrain

Suivi des feux de forêt et de végétation en France métropolitaine sur une carte en relief : les feux des douze
derniers mois, mois par mois, mis à jour chaque heure depuis EFFIS (Copernicus), les points chauds NASA FIRMS des
72 dernières heures, et les archives de 2006 à 2026, avec la source de chaque chiffre. Brief : [`docs/BRIEF.md`](docs/BRIEF.md) ·
audit des données : [`docs/DATA_AUDIT.md`](docs/DATA_AUDIT.md) · plan et décisions : [`docs/PLAN.md`](docs/PLAN.md) ·
contrôles des données : [`docs/VALIDATION_REPORT.md`](docs/VALIDATION_REPORT.md) · revue finale :
[`docs/REVIEW.md`](docs/REVIEW.md).

| Page | Contenu |
|---|---|
| `/` | Accueil FireStrain : présentation, bouton « Explorer la carte », état du moment (feux des 7 derniers jours, dernier feu, surface sur 12 mois, points chauds 72 h) et aperçu en direct des feux. |
| `/carte` | Le suivi : un marqueur par feu (taille : surface ; couleur : âge ; contour réel au zoom), liste des feux de la période (récents ou plus grands, recherche par commune), douze mois sous la carte (filtre), fiche de chaque feu, points chauds des 72 dernières heures, archives par année civile, fonds et calques. État partageable dans l'adresse : `?annee=2022&mois=2022-07&fire=562583&fond=ortho` (sans `annee` : les douze derniers mois). `/explorer` et les anciennes adresses `/?fire=…` y redirigent. |
| `/liste` | Les mêmes surfaces en tableau triable et filtrable : l'alternative accessible à la carte. |
| `/methode` | Sources, licences, limites, règles de rapprochement et de regroupement, contrôles. |
| `/api/effis/recent` | Route serveur : surfaces brûlées EFFIS des douze derniers mois, interrogées à l'API EFFIS et gardées en cache environ une heure ; en cas d'échec, la carte reprend les fichiers du site et le signale. |
| `/api/firms/recent` | Route serveur : détections VIIRS des 72 dernières heures (clé FIRMS côté serveur, cache d'une heure). |

## Lancer le projet

Node ≥ 22.18 (TypeScript exécuté nativement par Node pour les scripts et les tests).

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests unitaires (node:test)
npm run typecheck
npm run lint
npm run build
npm run test:e2e   # Playwright, sur le build de production (lancer npm run build avant)
```

`?rendu=2d` force la carte 2D de repli, `?rendu=3d` force le relief même sans accélération graphique (la 2D est
choisie automatiquement sans WebGL 2 ou avec un rendu logiciel).

Les tests de bout en bout utilisent le Chrome installé sur la machine (`channel: "chrome"`) ; pour le Chromium de
Playwright : `npx playwright install chromium` puis `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`.

Qualité : `npx lighthouse http://localhost:3000/ --form-factor=mobile` (Lighthouse est une dépendance de
développement) ; `npx next analyze` pour le poids des bundles (analyseur intégré à Turbopack).

## Données

Les fichiers servis au navigateur sont versionnés dans `public/data/`. Chacun est décrit dans
`public/data/manifest.json` : source, licence, URL de la requête, date de récupération, traitements et sha256.
Les téléchargements bruts sont mis en cache dans `data/raw/` (non versionné).

```bash
npm run data:dem       # 01 — relief IGN BD ALTI (WMS-Raster, Lambert-93), mailles 500 m et 1 000 m
npm run data:admin     # 05 — départements IGN ADMIN EXPRESS COG CARTO (WFS)
npm run data:neighbours # 08 — pays voisins Natural Earth 1:10m, à plat (contexte de carte)
npm run data:effis     # 02 — surfaces brûlées EFFIS 2006–2026 et statistiques officielles
npm run data:bdiff     # 04 — BDIFF (feux déclarés) et rapprochements avec EFFIS
npm run data:firms     # 03 — détections NASA FIRMS par année civile (clé requise pour 2026)
npm run data:events    # 07 — faits sourcés : vérifie les citations de data/events.json, regroupe les polygones
npm run data:basemaps  # 09 — images France entière des fonds Plan IGN et photos aériennes (WMS, une fois)
npm run data:validate  # 06 — contrôles croisés, écrit docs/VALIDATION_REPORT.md
npm run data           # toute la chaîne, dans l'ordre
node scripts/01-dem.ts --refresh   # ignore le cache et retélécharge
```

`07-events` (faits de terrain sourcés de quelques feux, `data/events.json`) reste dans la chaîne et ses citations
restent vérifiées, mais l'interface ne les affiche plus depuis le passage au suivi (aspect narratif retiré).

Aucun outil SIG externe n'est nécessaire : l'IGN reprojette le relief côté serveur, et mapshaper
(dépendance de développement) simplifie les limites.

## Variables d'environnement

| Variable | Usage | Où |
|---|---|---|
| `FIRMS_MAP_KEY` | NASA FIRMS : année 2026 (script 03) et route serveur `/api/firms/recent` (72 dernières heures) | `.env.local`, scripts et serveur uniquement, jamais dans le bundle client |

## Sources et licences

- **Relief** : IGN, BD ALTI® — Licence Ouverte Etalab 2.0.
- **Limites administratives** : IGN, ADMIN EXPRESS COG CARTO — Licence Ouverte Etalab 2.0.
- **Pays voisins** (fond neutre, sans relief) : Natural Earth, Admin 0 – Countries 1:10m — domaine public.
- **Fonds de carte** (`?fond=plan|ortho`) : Plan IGN et BD ORTHO — IGN, Licence Ouverte 2.0. L'image de la
  France entière est demandée une fois au WMS (`09-basemaps`) et servie par le site ; les vues rapprochées
  assemblent les tuiles WMTS Lambert-93 de la Géoplateforme (sans clé), chargées du centre vers les bords.
- **Surfaces brûlées** : EFFIS (Copernicus, Commission européenne / JRC) — CC BY 4.0.
- **Feux déclarés** : BDIFF (IGN, ministère de l'Agriculture) — Licence Ouverte 2.0.
- **Anomalies thermiques** : NASA FIRMS (VIIRS) — données ouvertes de la NASA.
- **Faits sourcés** : communiqués des préfectures (Pyrénées-Orientales, Gironde, Var) et de France Assureurs,
  cités avec leur lien dans `data/events.json`.

Attributions affichées dans l'interface (pied de carte, étiquette de source sous chaque chiffre, page Méthode) :
« EFFIS — European Forest Fire Information System, Copernicus, Commission européenne / JRC (CC BY 4.0) », « IGN —
BD ALTI®, ADMIN EXPRESS (Licence Ouverte Etalab 2.0) », « NASA FIRMS — Fire Information for Resource Management
System (LANCE / ESDIS), détections VIIRS 375 m », « BDIFF — IGN, ministère de l'Agriculture (Licence Ouverte 2.0) ».
