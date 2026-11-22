<div align="center">

# FireStrain

**Every forest fire in France, on a 3D relief map.**

Forest and vegetation fires of metropolitan France and Corsica, mapped from **public satellite data**: the burnt areas of the last twelve months from **EFFIS (Copernicus)**, refreshed every hour, the **NASA FIRMS** hotspots of the last 72 hours, and twenty years of archives since 2006, with the source of every figure.

### [→ Try it now](https://firestrain.vercel.app)


https://github.com/user-attachments/assets/b728f704-4399-40a2-903c-8b467c8d5808

<br>

[![CI](https://github.com/Noam044/Firestrain/actions/workflows/ci.yml/badge.svg)](https://github.com/Noam044/Firestrain/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js_16-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?logo=tailwindcss&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js_·_R3F-000?logo=threedotjs&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000?logo=vercel&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

</div>

---

## Why

Every summer the same questions come back: where is it burning, how big is it, is this year worse than usual? The answers exist, in open data published by the European Commission, NASA and the French state, but they are spread across portals, formats and projections. FireStrain gathers them on one map of France in relief, keeps each figure next to its source, and says plainly what satellites can and cannot see.

## Features

- **3D relief map** of France (IGN BD ALTI), rendered with React Three Fiber: one marker per fire (size: burnt area, colour: age), the real EFFIS outline draped on the relief as you zoom in, and a 2D map when the device has no GPU.
- **Last twelve months, month by month**: a live query of the EFFIS API, cached on the server and on Vercel's CDN, with the site's own files as a fallback when EFFIS does not answer.
- **NASA FIRMS hotspots** (VIIRS) of the last 72 hours, fetched by the server so the API key never reaches the browser.
- **A card for every fire**: burnt area, dates, burnt vegetation by land cover, Natura 2000 share, satellite hotspots day by day, and the matching BDIFF record (fires declared by the fire services) when one matches without ambiguity.
- **Filter by département**: in this mode the fire markers step back, the hovered département rises above the relief with an orange outline, and a click frames it and filters the list. Back buttons zoom out one level at a time.
- **Archives since 2006**: any calendar year on the map, a table of every burnt area (`/liste`), and one page per département (`/departement/gironde`…) with its year-by-year chart and largest fires.
- **This year against the past**: burnt area since 1 January, day by day, compared with the 2006-2025 average and the most burnt year of that period.
- **Shareable**: the map state lives in the address (`?annee=2022&mois=2022-07&fire=…&dep=gironde`), and a shared fire gets its own link preview: an image of its outline, commune, area and date, generated on the server. A "Partager" button shows that preview and copies the link.
- **Search everything** with ⌘K / Ctrl+K: a fire, a département, a month, a year, a base map.
- **Base maps**: shaded relief, IGN Plan or aerial photographs, sharp tiles loaded around the camera as you zoom in.
- **Dark and light themes**, an animated forest-fire backdrop on the home page, and every animation disabled under reduced motion.
- **Method page** that explains every source, licence, limit and matching rule, with figures built from the published data.

> FireStrain is an independent project. Burnt areas are satellite estimates and may differ from official reports. In case of fire, follow the instructions of the fire services: 18 or 112.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, Route Handlers) · React 19 |
| Language & styling | TypeScript · Tailwind CSS 4 |
| 3D map | three.js · React Three Fiber · custom GLSL shaders (relief shading, burn mask, draped lines) |
| State & data | TanStack Query · Zustand · nuqs (state in the URL) |
| Data | EFFIS API · NASA FIRMS API · IGN Géoplateforme (WMS / WMTS / WFS) · BDIFF |
| Tests | node:test (unit) · Playwright (end-to-end, desktop and mobile) |
| Hosting | Vercel (shared cache across instances, CDN, Speed Insights) |

## Getting started

Requirements: Node.js ≥ 22.18 (scripts and tests are TypeScript run natively by Node). A [NASA FIRMS map key](https://firms.modaps.eosdis.nasa.gov/api/map_key/) is optional: without it, the map works without the hotspots of the last 72 hours.

```bash
npm install
cp .env.example .env.local     # then add your FIRMS_MAP_KEY
npm run dev                    # http://localhost:3000
```

Production build: `npm run build && npm start`.

`?rendu=2d` forces the 2D map, `?rendu=3d` forces the relief even without hardware acceleration (the 2D map is chosen automatically without WebGL 2 or with a software renderer).

### Tests

```bash
npm test             # unit tests (node:test): projections, polygons, relief and hotspot codecs, time windows
npm run typecheck
npm run lint
npm run build
npm run test:e2e     # Playwright against the production build: map, months, archives, départements, link previews
```

The end-to-end tests answer the live routes themselves (fixtures built from the published files), so they need no FIRMS key. They use the Chrome installed on the machine; for Playwright's own Chromium: `npx playwright install chromium`, then `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `FIRMS_MAP_KEY` | no | NASA FIRMS key, read by the server route `/api/firms/recent` and by the data script `03-firms`. Never sent to the browser. |

## How it works

### Data pipeline

The files served to the browser are versioned in `public/data/`, each one described in `public/data/manifest.json` (source, licence, query URL, retrieval date, processing, sha256). Raw downloads are cached in `data/raw/` (not versioned). No external GIS tool is needed: IGN reprojects the relief server-side and mapshaper simplifies the boundaries.

```bash
npm run data:dem         # 01: IGN BD ALTI relief (WMS-Raster, Lambert-93), 500 m and 1,000 m grids
npm run data:admin       # 05: IGN ADMIN EXPRESS départements (WFS)
npm run data:neighbours  # 08: neighbouring countries, Natural Earth 1:10m
npm run data:effis       # 02: EFFIS burnt areas 2006-2026 and official statistics
npm run data:bdiff       # 04: BDIFF declared fires and their matches with EFFIS
npm run data:firms       # 03: NASA FIRMS detections per calendar year (key required for the current year)
npm run data:events      # 07: sourced facts, checks the citations of data/events.json
npm run data:basemaps    # 09: whole-France images of the IGN Plan and aerial photographs
npm run data:validate    # 06: cross-checks, writes docs/VALIDATION_REPORT.md
npm run data             # the whole pipeline, in order
```

### Live data

- `/api/effis/recent` queries the EFFIS API for the burnt areas of the last twelve months, simplifies the outlines in Lambert-93 and sends them as a gzip file (≈ 150 kB instead of ≈ 650 kB of JSON). The answer is kept in a cache shared by every server instance (`"use cache: remote"`) and on the CDN, which serves the last copy while it fetches a fresh one: a visitor only waits on EFFIS when nothing at all is cached.
- `/api/firms/recent` returns the VIIRS hotspots of the last 72 hours over metropolitan France, with the key kept on the server.
- `/api/apercu/feu/<id>` draws a fire's link preview (1200 × 630) with `ImageResponse`; `/carte?fire=<id>` gets its own title, description and Open Graph tags.

### The map

- The relief is a single mesh displaced by the elevation texture; the shading, the base maps and the burnt areas are computed in the fragment shader.
- Burnt areas are not extruded: they are rasterised once on the GPU into a mask aligned with the elevation grid, then draped by the relief shader, with a one-pixel outline at every zoom.
- Département mode reads a second mask holding each département's index, rendered without antialiasing; the pointer finds the département with a point-in-polygon test on the same outlines.
- Frames are rendered on demand only: the camera, a hover or a selection asks for the frames it needs.

### Architecture

```
app/
├── page.tsx                     Home: hero, live readings, latest fires, sources, this year vs the past, archives
├── carte/                       The map (AppShell), with per-fire metadata
├── liste/                       Every burnt area in a sortable table
├── departements/, departement/  The département list and one page per département
├── methode/                     Sources, licences, limits, figures built from the data
└── api/                         effis/recent, firms/recent, apercu/feu/[id]
components/
├── scene/                       3D map: terrain, burn mask, markers, départements, camera, 2D fallback
├── tracker/                     Map shell: top bar, fire list, month chips, fire card, search, share
└── home/, methode/, departements/, brand/, ui/
lib/
├── data/                        Schemas, codecs, queries, live summaries, département shapes
├── geo/                         Lambert-93 projection, polygons, heightfield, presets
└── server/                      EFFIS and FIRMS clients, département and year aggregates, fire lookup
scripts/                         The data pipeline (01 to 09)
```

## Data sources and licences

- **Burnt areas**: EFFIS, European Forest Fire Information System (Copernicus, European Commission / JRC), CC BY 4.0.
- **Thermal anomalies**: NASA FIRMS, Fire Information for Resource Management System (LANCE / ESDIS), VIIRS 375 m detections.
- **Relief, boundaries and base maps**: IGN, BD ALTI®, ADMIN EXPRESS, Plan IGN, BD ORTHO®, Licence Ouverte Etalab 2.0.
- **Declared fires**: BDIFF (IGN, French Ministry of Agriculture), Licence Ouverte 2.0.
- **Neighbouring countries**: Natural Earth, public domain.

FireStrain is not affiliated with any of these organisations.

## License

[MIT](LICENSE) © 2026 Noam Bouriche
