# Revue finale — liste noire et critères d'acceptation

Revue du 20 octobre 2026, reprise le 20 novembre 2026 après le passage au suivi, sur le build de production (`npm run build && npx next start`), écran par écran, en
1440 × 900 et en 390 × 844 (téléphone), avec la carte en relief (navigateur avec accélération graphique) et en 2D.

## 1. Liste noire et interface (revue après le passage au suivi, 20 novembre 2026)

Recherche dans le code (`app/`, `components/`, `lib/`) : aucun dégradé décoratif (les seuls dégradés sont les
vignettes du choix de fond de carte, qui imitent chaque fond), aucun flou ni verre dépoli, aucun halo, aucun curseur
personnalisé, aucun emoji, aucune couleur hors des jetons de `app/globals.css`. Chargements en phrases, sans
pourcentage.

| Écran | Constat |
|---|---|
| **Suivi — répartition** | Barre du haut : titre, « 12 derniers mois » / Archives, points chauds 72 h (compte et interrupteur), Liste, Méthode. Colonne de gauche : titre de la période, trois chiffres (feux, surface, depuis 7 jours), heure d'interrogation d'EFFIS, recherche, tri, liste des feux. Douze mois sous la carte (nombre de feux, barre de surface, filtre). Aucune prose de synthèse ni classement. |
| **Carte — relief** | France seule en relief clair, pays voisins à plat ; un disque par feu, aire ∝ surface, couleur par âge (moins de 7 jours, moins d'un mois, plus ancien), liseré blanc ; au zoom le disque s'efface devant le contour brûlé ; points chauds en anneaux ambre ; hachures des années précédentes en calque facultatif. |
| **Carte — commandes** | Légende en haut à gauche ; zoom, vue d'ensemble, « Fond et calques » en bas à droite ; échelle et sources en bas à gauche ; zoom par pincement sur écran tactile. |
| **Fiche d'un feu** | Dans la colonne (feuille par le bas sur téléphone), retour à la liste ; commune, département, surface, âge, dates de détection et de mise à jour, végétation, points chauds, BDIFF à part, lien vers la fiche EFFIS. Faits cités retirés (aspect narratif). |
| **Carte 2D** | Mêmes couleurs et mêmes filtres, motif de repli en une ligne. |
| **Liste, Méthode** | En-tête « Carte des feux récents », tableau et texte sur la même palette. |
| **Typographie** | Atkinson Hyperlegible Next pour le texte, Mono pour les nombres seuls (surfaces, comptes), pour que les colonnes s'alignent. |
| **Téléphone** | Barre du haut, carte, mois (initiales), liste ; fiche en feuille ; pas de défilement horizontal. |

## 2. Critères d'acceptation (brief, section 9)

| Critère | État | Preuve |
|---|---|---|
| Aucun chiffre sans source, date de donnée et lien | ✅ | `SourceTag` sous chaque chiffre (source · donnée du · récupérée le · lien et citation). Ajoutés lors de cette revue : compte FIRMS de la frise, chapitres EFFIS du récit, comparaison d'échelle. |
| Totaux du pipeline comparés aux chiffres officiels, écarts expliqués | ✅ | `docs/VALIDATION_REPORT.md` (06-validate) : identiques chaque année sauf 2011 (La Réunion). |
| Lighthouse ≥ 90 accessibilité et bonnes pratiques ; performance ≥ 80 (mobile) | ✅ | Suivi (20/11/2026) : performance 93–95 (LCP 2,6 s ; réponse EFFIS compressée, 149 ko), accessibilité, bonnes pratiques et SEO 100 ; liste 97 et Méthode 99 en performance. Mesuré en Chrome sans tête, donc sans accélération graphique : la carte y est en 2D. |
| Fonctionne sans WebGL et avec `prefers-reduced-motion` | ✅ | Tests Playwright `repli-2d` (WebGL 2 absent, rendu logiciel, `rendu=2d`) ; mouvement réduit : coupes de caméra et lecture jour par jour. |
| Interface utilisable au clavier | ✅ | Test `clavier` : chaque arrêt de tabulation affiche un anneau de 2 px ; frise des années et lecture au clavier (`carte`) ; carte aux flèches ; liste des feux en alternative à la 3D. |
| Aucune clé d'API dans le bundle client | ✅ | La valeur de `FIRMS_MAP_KEY` est absente de `.next/static`, de `public/` et des réponses de `/api/firms/recent` (vérifié à chaque build de la phase). |
| Tests Playwright : carte, feu via l'URL, repli 2D | ✅ | 29 tests (`npm run test:e2e`), bureau et téléphone (le récit a été supprimé à la demande). |
| Rendu conforme à la liste noire | ✅ | Section 1 ci-dessus. |
| README : lancement, scripts, variables, sources et licences | ✅ | `README.md`. |

## 3. Points ouverts

- Le cache de build de Turbopack peut servir une ancienne version de `globals.css` ; supprimer
  `.next/cache/turbopack` suffit.
