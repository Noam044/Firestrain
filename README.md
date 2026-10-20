# FireStrain

Visualisation 3D des feux de forêt en France métropolitaine en 2026, comparés aux années précédentes,
avec la source de chaque chiffre. Brief : [`docs/BRIEF.md`](docs/BRIEF.md) · audit des données :
[`docs/DATA_AUDIT.md`](docs/DATA_AUDIT.md) · plan et décisions : [`docs/PLAN.md`](docs/PLAN.md).

## Lancer le projet

Node ≥ 22.18 (TypeScript exécuté nativement par Node pour les scripts et les tests).

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests unitaires (node:test)
npm run typecheck
npm run lint
npm run build
```

`/explorer?rendu=2d` force la carte 2D de repli.

## Données

Les fichiers servis au navigateur sont versionnés dans `public/data/`. Chacun est décrit dans
`public/data/manifest.json` : source, licence, URL de la requête, date de récupération, traitements et sha256.
Les téléchargements bruts sont mis en cache dans `data/raw/` (non versionné).

```bash
npm run data:dem     # 01 — relief IGN BD ALTI (WMS-Raster, Lambert-93), mailles 500 m et 1 000 m
npm run data:admin   # 05 — départements IGN ADMIN EXPRESS COG CARTO (WFS)
npm run data         # les deux
node scripts/01-dem.ts --refresh   # ignore le cache et retélécharge
```

Aucun outil SIG externe n'est nécessaire : l'IGN reprojette le relief côté serveur, et mapshaper
(dépendance de développement) simplifie les limites.

## Variables d'environnement

| Variable | Usage | Où |
|---|---|---|
| `FIRMS_MAP_KEY` | NASA FIRMS : année 2026 (script 03) et route serveur `/api/firms/recent` (72 dernières heures) | `.env.local`, scripts et serveur uniquement, jamais dans le bundle client |

## Sources et licences

- **Relief** : IGN, BD ALTI® — Licence Ouverte Etalab 2.0.
- **Limites administratives** : IGN, ADMIN EXPRESS COG CARTO — Licence Ouverte Etalab 2.0.
- À venir : EFFIS (Copernicus, JRC) — CC BY 4.0 ; NASA FIRMS — données ouvertes de la NASA ; BDIFF — Licence Ouverte 2.0.
