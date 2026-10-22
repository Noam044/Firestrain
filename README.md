# FireStrain

Carte interactive des feux de forêt et de végétation en France métropolitaine, année par année de 2006 à 2026 :
surfaces brûlées vues par satellite, mois par mois, jour par jour, avec la source de chaque chiffre. Brief : [`docs/BRIEF.md`](docs/BRIEF.md) ·
audit des données : [`docs/DATA_AUDIT.md`](docs/DATA_AUDIT.md) · plan et décisions : [`docs/PLAN.md`](docs/PLAN.md) ·
contrôles des données : [`docs/VALIDATION_REPORT.md`](docs/VALIDATION_REPORT.md) · revue finale :
[`docs/REVIEW.md`](docs/REVIEW.md).

| Page | Contenu |
|---|---|
| `/` | La carte : frise des années (surface brûlée de chaque année, cliquable), total et rang de l'année, mois de l'année (filtre), lecture jour par jour avec les points chauds FIRMS, plus grandes surfaces, détail de chaque feu, fonds de carte. État partageable dans l'adresse : `?year=2026&mois=7&date=2026-07-22&fire=562583&fond=satellite`. `/explorer` y redirige. |
| `/liste` | Les mêmes surfaces en tableau triable et filtrable : l'alternative accessible à la carte. |
| `/methode` | Sources, licences, limites, règles de rapprochement et de regroupement, contrôles. |
| `/api/firms/recent` | Route serveur facultative : détections VIIRS des 72 dernières heures (clé FIRMS côté serveur). |

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
npm run data:validate  # 06 — contrôles croisés, écrit docs/VALIDATION_REPORT.md
npm run data           # toute la chaîne, dans l'ordre
node scripts/01-dem.ts --refresh   # ignore le cache et retélécharge
```

Les faits de terrain (préfectures, assureurs) affichés dans le panneau de quelques feux sont saisis à la main
dans `data/events.json`, chacun avec sa page source et une citation courte que `07-events` retrouve dans la page.

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
- **Fonds de carte** (`?fond=plan|satellite|ortho`) : Plan IGN, ORTHO-SAT SPOT 2025,
  BD ORTHO — IGN / CNES, Licence Ouverte 2.0, demandés par le navigateur au WMS de la Géoplateforme (sans clé).
- **Surfaces brûlées** : EFFIS (Copernicus, Commission européenne / JRC) — CC BY 4.0.
- **Feux déclarés** : BDIFF (IGN, ministère de l'Agriculture) — Licence Ouverte 2.0.
- **Anomalies thermiques** : NASA FIRMS (VIIRS) — données ouvertes de la NASA.
- **Faits sourcés** : communiqués des préfectures (Pyrénées-Orientales, Gironde, Var) et de France Assureurs,
  cités avec leur lien dans `data/events.json`.

Attributions affichées dans l'interface (pied de carte, étiquette de source sous chaque chiffre, page Méthode) :
« EFFIS — European Forest Fire Information System, Copernicus, Commission européenne / JRC (CC BY 4.0) », « IGN —
BD ALTI®, ADMIN EXPRESS (Licence Ouverte Etalab 2.0) », « NASA FIRMS — Fire Information for Resource Management
System (LANCE / ESDIS), détections VIIRS 375 m », « BDIFF — IGN, ministère de l'Agriculture (Licence Ouverte 2.0) ».
