# Revue finale — liste noire et critères d'acceptation

Revue du 20 octobre 2026 sur le build de production (`npm run build && npx next start`), écran par écran, en
1440 × 900 et en 390 × 844 (téléphone), avec la carte en relief (navigateur avec accélération graphique) et en 2D.

## 1. Liste noire et interface (revue après la refonte « Relevé »)

Recherche dans le code (`app/`, `components/`, `lib/`) : aucun dégradé décoratif (les seuls dégradés sont les
vignettes du choix de fond de carte, qui imitent chaque fond), aucun flou ni verre dépoli, aucun halo, aucun curseur
personnalisé, aucun emoji, aucune couleur hors des jetons de `app/globals.css`. Chargements en phrases, sans
pourcentage.

| Écran | Constat |
|---|---|
| **Carte — répartition** | Barre de titre en haut ; barre du temps en bas sur toute la largeur (frise des années — la donnée sert de sélecteur —, mois cliquables, lecture) ; colonne de gauche étroite : chiffre de la période, clé de carte avec interrupteurs, six plus grandes surfaces. Pas de cartes empilées : des sections séparées par l'espace et un filet. |
| **Carte — relief** | France seule en relief clair sur fond « mer », pays voisins à plat en gris pâle avec leur nom, sol brûlé rouge brûlis légèrement translucide, années précédentes en hachures (le sens ne repose pas sur la couleur seule), points chauds en anneaux ambre. |
| **Carte — commandes** | Touches blanches en bas à droite (zoom, vue d'ensemble, fond de carte), échelle et sources en bas à gauche ; zoom par pincement sur écran tactile. |
| **Panneau d'un feu** | Dans la colonne, avec retour à l'année ; surface en grand, végétation, activité satellite, BDIFF à part, faits officiels cités pour les feux documentés. |
| **Carte 2D** | Mêmes couleurs et mêmes filtres, motif de repli en une ligne. |
| **Liste, Méthode** | En-tête « Carte des feux », tableau et texte sur la même palette. |
| **Téléphone** | Carte en haut, colonne en dessous, pas de défilement horizontal. |

## 2. Critères d'acceptation (brief, section 9)

| Critère | État | Preuve |
|---|---|---|
| Aucun chiffre sans source, date de donnée et lien | ✅ | `SourceTag` sous chaque chiffre (source · donnée du · récupérée le · lien et citation). Ajoutés lors de cette revue : compte FIRMS de la frise, chapitres EFFIS du récit, comparaison d'échelle. |
| Totaux du pipeline comparés aux chiffres officiels, écarts expliqués | ✅ | `docs/VALIDATION_REPORT.md` (06-validate) : identiques chaque année sauf 2011 (La Réunion). |
| Lighthouse ≥ 90 accessibilité et bonnes pratiques ; performance ≥ 80 (mobile) | ✅ | Carte : performance 86–88, accessibilité, bonnes pratiques et SEO 100 ; liste 96 et Méthode 97 en performance. Mesuré en Chrome sans tête, donc sans accélération graphique : la carte y est en 2D. |
| Fonctionne sans WebGL et avec `prefers-reduced-motion` | ✅ | Tests Playwright `repli-2d` (WebGL 2 absent, rendu logiciel, `rendu=2d`) ; mouvement réduit : coupes de caméra et lecture jour par jour. |
| Interface utilisable au clavier | ✅ | Test `clavier` : chaque arrêt de tabulation affiche un anneau de 2 px ; frise des années et lecture au clavier (`carte`) ; carte aux flèches ; liste des feux en alternative à la 3D. |
| Aucune clé d'API dans le bundle client | ✅ | La valeur de `FIRMS_MAP_KEY` est absente de `.next/static`, de `public/` et des réponses de `/api/firms/recent` (vérifié à chaque build de la phase). |
| Tests Playwright : carte, feu via l'URL, repli 2D | ✅ | 29 tests (`npm run test:e2e`), bureau et téléphone (le récit a été supprimé à la demande). |
| Rendu conforme à la liste noire | ✅ | Section 1 ci-dessus. |
| README : lancement, scripts, variables, sources et licences | ✅ | `README.md`. |

## 3. Points ouverts

- Le cache de build de Turbopack peut servir une ancienne version de `globals.css` ; supprimer
  `.next/cache/turbopack` suffit.
