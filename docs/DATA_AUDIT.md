# Audit des données — FireStrain (Phase 0)

> Audit réalisé le **20 octobre 2026** par requêtes directes sur chaque source.
> Chaque affirmation ci-dessous est issue d'une réponse réelle d'API ou d'un fichier téléchargé ;
> les commandes de reproduction sont en fin de document.

---

## 1. Synthèse

| Source | Accès testé | Données 2026 | Historique | Licence | Verdict |
|---|---|---|---|---|---|
| **EFFIS – polygones** | API REST ✅ (le WFS documenté renvoie 500/503) | ✅ 1 709 polygones FR, jusqu'au 16/10/2026 | ✅ depuis 2000 | CC BY 4.0 | **Source principale, utilisable dès maintenant** |
| **EFFIS – statistiques** | API `api2` ✅ | ✅ 98 459 ha / 381 feux ≥ 30 ha | ✅ 2006→2025, + min/moy/max hebdo | CC BY 4.0 | **Parfait pour le graphique cumulatif** |
| **NASA FIRMS** | CSV publics 7 j ✅ · archives annuelles ✅ · API ❌ sans clé | ⚠️ **uniquement via l'API, clé `MAP_KEY` requise** | ✅ VIIRS S-NPP 2012→2025, MODIS depuis 2006, sans clé | Données NASA ouvertes, citation demandée | **Bloquant pour la phase 3 tant que je n'ai pas de clé** |
| **BDIFF** | Export CSV ✅ (chaîne TLS du serveur incomplète, contournable proprement) | ❌ **non publiée** (« jusqu'à l'année antérieure ») | ✅ 2006→2025 | Licence Ouverte v2 | Historique seulement ; 2026 = état vide honnête |
| **IGN – MNT** | WMS-Raster ✅, Float32 en Lambert-93 | n/a | n/a | Licence Ouverte Etalab 2.0 | **Pas besoin de GDAL** |
| **IGN – Admin Express** | WFS ✅, GeoJSON | n/a | n/a | Licence Ouverte Etalab 2.0 | OK, à simplifier (20 Mo bruts) |
| **Presse / préfectures** | 3 articles du brief lus ✅ + communiqués préfectoraux trouvés | ✅ | — | Citation courte | Plusieurs chiffres du brief **à corriger** (voir §6) |

### Les trois réponses demandées

1. **Contours EFFIS 2026 complets ?** — **Oui, à date.** 1 709 polygones France datés de 2026, dernier feu le 16/10/2026, dernière mise à jour de la couche le 19/10/2026. La couche continue d'évoluer : il faudra figer une date de récupération.
2. **Archive FIRMS été 2026 ?** — **Accessible uniquement par l'API avec une clé.** Les archives annuelles par pays (sans clé) s'arrêtent à 2025. La disponibilité des produits « SP » (standard) pour l'été 2026 n'est vérifiable qu'avec la clé (`/api/data_availability/`). À défaut, l'API sert les produits NRT.
3. **BDIFF 2026 validée ?** — **Non, et elle n'est même pas publique.** Le site ne diffuse que « jusqu'à l'année antérieure à l'année en cours ». Une requête sur 2026 renvoie « Aucun incendie trouvé ».

---

## 2. EFFIS (Copernicus / JRC)

### 2.1 Polygones de surfaces brûlées

- **Point d'accès qui fonctionne** : `https://api.effis.emergency.copernicus.eu/rest/2/burntareas/current/?country=FR`
  (pagination `limit`/`offset`, tri `ordering=-area_ha|firedate|lastupdate`, filtres spatiaux `intersects`/`covered`).
- Malgré son nom (`current`), cette couche contient **tout l'historique** : 7 166 polygones France, du **05/07/2000** au **16/10/2026**.
- Le WFS documenté (`maps.effis…/effis?service=WFS…typename=ms:modis.ba.poly`) a renvoyé **500/503** à chaque essai pendant l'audit. Il n'est pas fiable comme source de pipeline.
- Volume : 13,8 Mo de JSON pour toute la France, toutes années. 2026 seul : environ 323 000 sommets avant simplification.

**Champs réels d'un enregistrement** (exemple : le plus grand polygone 2026) :

| Champ | Exemple | Notes |
|---|---|---|
| `id` | `562583` | Identifiant EFFIS stable → clé `fire=<id>` dans l'URL |
| `centroid` | Point WGS84 | |
| `bbox` | `[lonMin, latMin, lonMax, latMax]` | |
| `shape` | MultiPolygon WGS84 | Précision à 15 décimales, à quantifier |
| `country` / `countryful` | `FR` / `France` | Contient aussi les DROM (1 polygone à La Réunion, 2011) → filtrer sur l'emprise métropole |
| `province` | `Gironde` | Nom du département |
| `commune` | `Porge` | ⚠️ **Ce n'est pas la commune d'éclosion** (le feu est parti de Saumos). Article parfois tronqué (« Porge », « Arcs ») |
| `firedate` | `2026-07-22T11:55:00+02:00` | **Date de première détection satellite**, pas l'heure d'alerte SDIS |
| `area_ha` | `37191` | Entier, en ha |
| `broadlea`, `conifer`, `mixed`, `scleroph`, `transit`, `othernatlc`, `agriareas`, `artifsurf`, `otherlc` | `69.248…` (conifères) | % par type de couvert (somme = 100). **`null` pour 177 polygones** (petits feux récents) |
| `percna2k` | `0.4169` | % en zone Natura 2000 |
| `lastupdate` | `2026-07-23T07:45` | Dernière mise à jour du polygone |
| `lastfiredate` | `null` | **Toujours `null`** (7 166 / 7 166) → **aucune date de fin dans EFFIS** |
| `noneu` | `false` | |

**Limites qui comptent pour l'UI**

- **Pas de date de fin.** Le panneau affichera « Première détection (EFFIS) ». La date de fin viendra seulement d'une source officielle curée (préfecture : « feu éteint le… »), sinon « non renseigné ». La dernière détection FIRMS pourra être montrée comme telle, jamais comme une date de fin.
- **Un « feu » de presse = plusieurs polygones.** Exemple : le feu de Trévillach apparaît comme 4 polygones EFFIS (Montalba-le-Château 3 141 ha, Rodès 1 091, Ille-sur-Têt 42, Vinça 30). Le regroupement en « événement » devra être **curé à la main et justifié** dans `data/events.json` (liste d'IDs EFFIS + source qui atteste l'appartenance).
- **Rupture méthodologique en 2019.** Le nombre de polygones passe de 23 (2018) à 370 (2019), et ceux de moins de 30 ha apparaissent massivement. **Les comparaisons historiques doivent se faire sur les feux ≥ 30 ha uniquement**, et ne jamais comparer des *nombres* de feux avant/après 2019. La cause exacte (changement de capteur ou de seuil) est à confirmer dans la documentation EFFIS avant de la mentionner dans la page Méthode.

### 2.2 Statistiques (API du portail EFFIS Statistics)

- Totaux annuels : `https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/estimatesbycountry?country=FRA`
- Série hebdomadaire et cumul, avec **min / moyenne / max depuis 2006** : `…/statistics/v2/effis/weekly?country=FRA&year=2026`
- Le code pays est l'ISO3 (`FRA`) ; `FR` et `France` renvoient des tableaux vides.

**Contrôle de cohérence** : pour **chacune** des années 2006 à 2026, la somme des polygones ≥ 30 ha de l'API REST est **identique** au total de l'API statistiques. Les deux points d'accès décrivent donc le même jeu, avec un seuil de 30 ha.

| Année | ha (≥ 30 ha) | feux ≥ 30 ha | ha (tous polygones) |
|---|---:|---:|---:|
| 2006 | 1 751 | 12 | 1 751 |
| 2007 | 2 631 | 12 | 2 631 |
| 2008 | 1 694 | 8 | 1 694 |
| 2009 | 7 974 | 16 | 7 974 |
| 2010 | 4 653 | 9 | 4 677 |
| 2011 | 4 831 | 23 | 4 831 |
| 2012 | 3 298 | 19 | 3 355 |
| 2013 | 891 | 9 | 914 |
| 2014 | 4 667 | 26 | 4 667 |
| 2015 | 2 046 | 15 | 2 098 |
| 2016 | 10 767 | 27 | 10 793 |
| 2017 | 20 626 | 91 | 20 654 |
| 2018 | 2 581 | 21 | 2 636 |
| 2019 | 43 602 | 304 | 45 230 |
| 2020 | 14 547 | 133 | 16 589 |
| 2021 | 30 652 | 214 | 34 999 |
| 2022 | 66 337 | 290 | 74 598 |
| 2023 | 22 350 | 219 | 27 872 |
| 2024 | 12 268 | 156 | 17 137 |
| 2025 | 36 951 | 257 | 45 172 |
| **2026** | **98 459** | **381** | **108 609** |

- Moyenne 2006–2025 (≥ 30 ha) : **14 756 ha/an**. Maximum précédent : 2022 (66 337 ha).
- 2026 est la plus forte année de la série EFFIS France (2006→2026), ce qui est cohérent avec le « record en vingt ans de mesures satellitaires » de la presse.

### 2.3 ⚠️ « L'été 2026 » ≠ « l'année 2026 »

C'est la découverte principale de l'audit. **Une part importante de 2026 a brûlé en hiver** :

| Période 2026 | ha (tous polygones) | Remarque |
|---|---:|---|
| Janvier | 221 | |
| **Février** | **24 278** | 520 polygones, surtout dans les Pyrénées-Atlantiques (833 polygones sur l'année dans ce département) |
| **Mars** | **9 002** | |
| Avril–mai | 2 193 | |
| Juin | 762 | |
| **Juillet** | **65 786** | Gironde, Pyrénées-Orientales, Var, Drôme, Landes… |
| Août | 4 213 | |
| Septembre | 1 892 | |
| Octobre (au 16) | 262 | |

- **Saison 1er juin → 30 septembre** : **71 218 ha (≥ 30 ha, 121 feux)**, soit 72 653 ha tous polygones confondus (325 polygones).
- **Année civile** : 98 459 ha (≥ 30 ha).
- Les « près de 100 000 ha de forêt cet été » de la presse (France Assureurs / AFP) correspondent donc au **total annuel EFFIS**, pas à l'été. Ce total ne compte pas non plus que de la forêt : EFFIS mesure toutes les surfaces brûlées (landes, cultures, etc.).
  → **L'UI ne peut pas afficher « 100 000 ha cet été ».** Voir la question n° 2 du plan.

### 2.4 Autres produits EFFIS

- Sévérité (GeoTIFF annuels 2018→2025) : `…/data-and-services/severity_<année>.tiff`. **Pas de 2026 à ce jour.** Pour la V2.
- Licence : **CC BY 4.0** (« reuse is allowed, provided appropriate credit is given and changes are indicated »). Il faut donc **indiquer les modifications** (reprojection, simplification) dans les crédits et la page Méthode.

---

## 3. NASA FIRMS

| Accès | Clé ? | Couverture | Testé |
|---|---|---|---|
| CSV publics « 7 derniers jours », zone Europe (`/data/active_fire/<capteur>/csv/*_Europe_7d.csv`) | Non | 7 j glissants | ✅ NOAA-20, NOAA-21, S-NPP |
| **Archives annuelles par pays** (`/data/country/<capteur>/<année>/<capteur>_<année>_France.csv`) | **Non** | VIIRS S-NPP **2012→2025** ✅, MODIS **2006→2025** ✅, NOAA-20 ❌ (404), **2026 ❌ (404)** | ✅ |
| **API zone** (`/api/area/csv/{MAP_KEY}/{SOURCE}/{bbox}/{1..5}/{date}`) | **Oui** | NRT + SP, toutes dates | ❌ (`Invalid MAP_KEY`) |

**Champs** (archive annuelle) : `latitude, longitude, bright_ti4, scan, track, acq_date, acq_time, satellite, instrument, confidence, version, bright_ti5, frp, daynight, type`
- `confidence` : `n`/`l`/`h` (archives) ou `nominal`/`low`/`high` (NRT) → à normaliser.
- `type` (archives uniquement) : `0` = feu de végétation présumé, `2` = source fixe terrestre (industrie : il y en a à Dunkerque dans l'extrait 2025) → **garder `type = 0`**. Le NRT n'a pas ce champ : il faudra un masque des sources fixes, ou au minimum l'exclusion des points hors des polygones EFFIS et de leurs abords.
- Le fichier « France » des archives inclut potentiellement les DROM → filtrer sur l'emprise métropole.

**Coût de l'archive de l'été 2026 via l'API** : 122 jours ÷ 5 jours par requête = 25 requêtes par capteur. Pour les 3 VIIRS + MODIS, ~100 requêtes, très en dessous de la limite (5 000 transactions / 10 min).

**Rappel du brief** : les points FIRMS sont des **anomalies thermiques**. Ils ne seront jamais convertis en hectares.

---

## 4. BDIFF (IGN pour le ministère de l'Agriculture)

- **Diffusion publique** : « données nationales sur les feux de forêt **jusqu'à l'année antérieure à l'année en cours**, agrégées à la commune ». Une requête du 01/01/2026 au 20/10/2026 renvoie **« Aucun incendie trouvé »**.
- **Historique** : 2006→2025 pour toute la France (depuis 1973 pour certains départements méditerranéens).
- **Accès** : le formulaire GET `/incendies?if[…]` stocke les critères en session, puis `/incendies/zip` renvoie un ZIP contenant `Incendies.csv` (UTF-8, séparateur `;`, 3 lignes d'en-tête de métadonnées avant les colonnes), `Définitions.pdf` et `Mention légales.pdf`. Le script devra gérer le cookie de session.
- **TLS** : le serveur envoie un certificat intermédiaire erroné (`GEANT OV RSA CA 4` au lieu de `GEANT TLS RSA 1`). Solution propre : ajouter l'intermédiaire officiel publié par HARICA (`http://crt.harica.gr/HARICA-GEANT-TLS-R1.cer`, l'URL indiquée dans le certificat lui-même). **Je ne désactiverai pas la vérification TLS.**
- **Licence** : **Licence Ouverte v2** (fiche data.gouv.fr publiée par l'IGN).

**Colonnes réelles du CSV** : `Année ; Numéro ; Département ; Code INSEE ; Nom de la commune ; Date de première alerte ; Surface parcourue (m2) ; Surface forêt (m2) ; Surface maquis garrigues (m2) ; Autres surfaces naturelles hors forêt (m2) ; Surfaces agricoles (m2) ; Autres surfaces (m2) ; Surface autres terres boisées (m2) ; Surfaces non boisées naturelles (m2) ; Surfaces non boisées artificialisées (m2) ; Surfaces non boisées (m2) ; Précision des surfaces ; Type de peuplement ; Nature ; Décès ou bâtiments touchés ; Nombre de décès ; Nombre de bâtiments totalement détruits ; Nombre de bâtiments partiellement détruits ; Précision de la donnée`

- Surfaces en **m²** (à convertir en ha).
- **Les catégories de surface ont changé à partir de la campagne 2023**, et elles diffèrent pour les 15 départements méditerranéens (maquis et garrigues séparés). Les séries par type de couvert ne sont donc pas homogènes dans le temps.
- `Nature` = cause (vide pour 1 136 feux sur 2 541 en 2025).
- `Précision de la donnée` : « Données partielles ou non valides » pour 70 feux en 2025 → à afficher.
- Bonus : décès et bâtiments détruits par feu (2006→2025). C'est utile pour l'historique, mais rien pour 2026.

**Divergence EFFIS / BDIFF, exemple réel (Aude, août 2025)**

| | EFFIS | BDIFF |
|---|---|---|
| Commune | Coustouge | Ribaute |
| Heure | 05/08/2025 19 h 47 (détection) | 05/08/2025 16 h 16 (alerte CODIS) |
| Surface | 11 391 ha | 11 133 ha |

Totaux 2025 : BDIFF (2 541 feux de type F) = **21 945 ha** ; EFFIS ≥ 30 ha = **36 951 ha**. L'écart dépasse 15 000 ha : il ne faut **jamais additionner** les deux sources (règle du brief confirmée).

---

## 5. IGN Géoplateforme

### 5.1 Relief (MNT)

- **WMS-Raster** `https://data.geopf.fr/wms-r/wms`, couche **`ELEVATION.ELEVATIONGRIDCOVERAGE`** (BD ALTI), également `…HIGHRES` (RGE ALTI).
- Format **`image/x-bil;bits=32`** : Float32 brut, little-endian. **`CRS=EPSG:2154` accepté** (reprojection côté serveur). Taille max **5 010 × 5 010 px**.
- Test : emprise `90000,6030000,1250000,7130000`, 232 × 220 px → 51 040 valeurs, max 3 230 m à cette résolution, **nodata = −99999** hors de France (mer **et** pays voisins).
  → On obtient le **masque terre/mer gratuitement**, mais **sans les pays voisins** (voir question n° 3 du plan).
- **Aucun besoin de GDAL** : une seule requête à ~2 048 px fournit la heightmap déjà projetée. Ce n'est pas un appel point par point, ce qui respecte la consigne du brief.
- Alternative si l'on veut les reliefs voisins : Copernicus DEM GLO-90 (non testé ici ; il demanderait GDAL ou un assemblage de tuiles).

### 5.2 Limites administratives

- WFS `https://data.geopf.fr/wfs/ows`, couche `ADMINEXPRESS-COG-CARTO.LATEST:departement`, sortie `application/json`.
- 101 départements (96 métropolitains + 5 DROM). Champs : `cleabs, nom_officiel, nom_officiel_en_majuscules, code_insee, code_insee_de_la_region, code_siren`. Géométrie MultiPolygon.
- **20,3 Mo** bruts → simplification avec mapshaper, puis filtrage de la métropole.

---

## 6. Presse et sources officielles — vérification des points de départ du brief

| Point du brief | Ce que disent les sources | Statut |
|---|---|---|
| « Près de 100 000 ha brûlés, record depuis ~20 ans de mesures satellitaires » | Belga/AFP 16/10/2026 : « près de 100.000 hectares de forêt » ; EFFIS : **98 459 ha en 2026 (année civile)**, dont **71 218 ha du 1/06 au 30/09** | ⚠️ **À reformuler** : année civile, pas été (§2.3) |
| Gironde « ~42 000 ha **mi-juillet** » | Le feu (dit de Saumos) **démarre le 22 juillet** (EFFIS `firedate` 22/07 11 h 55 ; notre-planete.info, mis à jour le 07/10/2026). ~42 000 ha « parcourus », **37 296 ha « détruits »** (préfecture, cité par notre-planete) ; **EFFIS : 37 191 ha** | ⚠️ **Date à corriger** ; le chiffre préfectoral est à vérifier sur la source primaire (gironde.gouv.fr) |
| ~180 habitations détruites au Porge | Belga 16/10 et Sud Radio 28/08 (France Assureurs) : « 180 habitations ont été détruites au village du Porge » | ✅ sourcé (presse citant France Assureurs) |
| Trévillach, ~4 900 ha, 26 communes évacuées | Alerte le **samedi 4 juillet** vers 19 h 30 (préfecture 66) ; 4 900 ha (préfecture, point de situation n° 10, 06/07 23 h) ; 26 communes et « jusqu'à 10 000 personnes » (Selectra, 09/07) ; EFFIS : 4 polygones ≈ 4 304 ha | ✅ préfecture trouvée ; nombre d'évacués à recouper (10 000 ou 12 000 selon les sources) |
| « Août : feux dans le Var (Correns) » | Feu de **Pontevès démarré le 21 juillet** (EFFIS 2 878 + 486 ha), **reprise le 1er août** vers Correns et Montfort-sur-Argens (EFFIS 967 + 498 + 56 + 582 ha, détection 31/07) ; ~6 300 ha parcourus / 5 700 brûlés selon la presse | ⚠️ **Fin juillet – début août**, pas « août » ; chiffres finaux à vérifier sur une source primaire |
| ~22 500 sinistres, ~563 M€ | Belga 16/10/2026 (France Assureurs) ✅. **Fin août**, l'estimation était de 25 000 sinistres / ~500 M€ (Sud Radio, 28/08) : chiffre **révisé** | ✅ afficher le dernier chiffre avec sa date |
| Victimes (sapeurs-pompiers) | Un sapeur-pompier volontaire de 22 ans est décédé le 08/07/2026 au Planay (Savoie), sur un feu de végétation (Gendarmerie, franceinfo) ; une autre source mentionne 2 pompiers décédés le 21/07 dans un autre feu | ❌ **à vérifier sur source primaire avant toute publication** |

**Feux 2026 importants dans EFFIS, absents du brief** : Solaure-en-Diois (Drôme), 4 192 ha, 3 juillet · Biscarrosse (Landes), 3 513 ha, 23 juillet · Luglon (Landes), 1 803 ha, 13 août · Noisy-sur-École et Fontainebleau (Seine-et-Marne), 1 306 + 650 ha, 12–13 juillet · Corte (Haute-Corse), 1 081 ha, 14 juillet · la série de février–mars dans les Pyrénées-Atlantiques (> 1 000 polygones, ~33 000 ha).

**Sources primaires repérées pour `events.json`** (phase 4) : communiqués de la préfecture de la Gironde (gironde.gouv.fr, « Communiqués de presse 2026 › Juillet 2026 ») et de la préfecture des Pyrénées-Orientales (pyrenees-orientales.gouv.fr, « Incendie de Trévillach, points de situation n° 6 à 12 »).

---

## 7. Conséquences pour l'architecture

1. **EFFIS via l'API REST**, pas le WFS. Le script 02 met en cache la réponse brute dans `data/raw/` (non versionné) avec sa date de récupération.
2. **Unité de donnée = polygone EFFIS** (`id`). L'**événement** narratif (« feu de Trévillach ») est un regroupement curé dans `events.json` : IDs EFFIS + source justifiant le regroupement.
3. **Comparaisons historiques sur les feux ≥ 30 ha**, comme les statistiques officielles EFFIS. Les polygones < 30 ha sont affichés sur la carte mais exclus des totaux comparatifs. Aucune comparaison de *nombre* de feux à travers 2019.
4. **Le graphique cumulatif** repose directement sur l'API `weekly` (cumul 2026 + min/moy/max depuis 2006), recalculé et vérifié par le script 06 à partir des polygones.
5. **Dates** : « première détection (EFFIS) » ; fin = source curée ou « non renseigné ».
6. **BDIFF** : agrégats 2006→2025 uniquement. Pour 2026, état vide explicite : « BDIFF 2026 non diffusée (diffusion publique limitée à l'année N-1) ».
7. **FIRMS 2026** : dépend de la clé. Historique 2012→2025 via les archives annuelles S-NPP, sans clé.
8. **Relief** : IGN WMS-R en Lambert-93, sans GDAL. Encodage en heightmap 16 bits, format exact décidé en phase 1.

---

## 8. Reproduire l'audit

```bash
# EFFIS – polygones (le plus grand feu FR)
curl "https://api.effis.emergency.copernicus.eu/rest/2/burntareas/current/?country=FR&limit=1&ordering=-area_ha"
# EFFIS – totaux annuels et série hebdomadaire
curl "https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/estimatesbycountry?country=FRA"
curl "https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/weekly?country=FRA&year=2026"
# FIRMS – archive annuelle sans clé / API avec clé
curl -r 0-500 "https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2025/viirs-snpp_2025_France.csv"
curl "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/$FIRMS_MAP_KEY/all"
# IGN – MNT Float32 en Lambert-93
curl -o dem.bil "https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ELEVATION.ELEVATIONGRIDCOVERAGE&STYLES=&CRS=EPSG:2154&BBOX=90000,6030000,1250000,7130000&WIDTH=232&HEIGHT=220&FORMAT=image/x-bil;bits=32"
# IGN – départements
curl "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ADMINEXPRESS-COG-CARTO.LATEST:departement&OUTPUTFORMAT=application/json&COUNT=1"
# BDIFF – intermédiaire TLS manquant, puis export
curl -o harica.cer http://crt.harica.gr/HARICA-GEANT-TLS-R1.cer
```
