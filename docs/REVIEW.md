# Revue finale — liste noire et critères d'acceptation

Revue du 20 octobre 2026 sur le build de production (`npm run build && npx next start`), écran par écran, en
1440 × 900 et en 390 × 844 (téléphone), avec la carte en relief (navigateur avec accélération graphique) et en 2D.

## 1. Liste noire de la direction artistique (brief, section 4)

Recherche dans le code (`app/`, `components/`, `lib/`, `data/events.json`) : aucune occurrence de dégradé
(`gradient`, `bg-clip-text`), de flou (`backdrop`, `blur`), d'ombre ou de halo (`shadow`, `glow`), de coins arrondis
(`rounded-*`), de curseur personnalisé, d'emoji, ni de couleur hors des jetons `--ash-*`, `--bone-*`, `--char`,
`--ember`, `--sea`. Les messages de chargement sont des phrases (« Chargement du relief… »), sans pourcentage.

| Écran | Constat |
|---|---|
| **Récit — ouverture** | Titre serif, une phrase factuelle sourcée, compteur réel (98 459 ha, EFFIS) ; relief ombré gris cendre, sans effet. Pas de slogan. |
| **Récit — février, Trévillach, Gironde, Var** | Cartes de texte à fond plein et filet fin (pas de verre dépoli, pas d'ombre). Surfaces brûlées en `--char` mat, contour du feu raconté en `--ember` fin, détections FIRMS en anneaux ouverts, réduits et atténués dans le récit pour ne pas former de masse orange. Aucune flamme, fumée ou particule. |
| **Récit — à la même échelle** | Deux contours au trait, même projection, barre d'échelle ; aucun pictogramme. |
| **Récit — toute l'année** | Graphique au trait (année en blanc os, moyenne en tirets, enveloppe en aplat cendre), tableau de données en alternative. |
| **Récit — sortie** | Deux liens, crédits de carte en pied, comme une planche imprimée. |
| **Explorer 3D** | Légende fixe, barre d'échelle, indicateur du nord, coordonnées du curseur, crédits en pied. Braise réservée aux détections actives et au feu sélectionné. |
| **Explorer 2D (repli)** | Même palette, hachures pour l'historique (le sens ne repose pas sur la couleur seule). |
| **Panneau d'un feu** | Chiffres en serif, données en mono tabulaire, source sous chaque chiffre ; « non renseigné » plutôt qu'une valeur inventée. |
| **Frise et 72 h** | Boutons rectangulaires à filet, pas de bascule animée ; le mode 72 h affiche l'heure d'interrogation et sa source. |
| **Liste des feux** | Tableau éditorial (filets horizontaux, chiffres alignés à droite en mono). |
| **Méthode** | Texte long à colonne étroite, tableaux simples. |
| **Téléphone** | Panneaux compacts, carte d'abord dans le récit, aucune interaction qui exige le survol. |

Copie : pas de formule générique ; chaque phrase du récit porte un fait chiffré, sourcé, ou une limite des données.

## 2. Critères d'acceptation (brief, section 9)

| Critère | État | Preuve |
|---|---|---|
| Aucun chiffre sans source, date de donnée et lien | ✅ | `SourceTag` sous chaque chiffre (source · donnée du · récupérée le · lien et citation). Ajoutés lors de cette revue : compte FIRMS de la frise, chapitres EFFIS du récit, comparaison d'échelle. |
| Totaux du pipeline comparés aux chiffres officiels, écarts expliqués | ✅ | `docs/VALIDATION_REPORT.md` (06-validate) : identiques chaque année sauf 2011 (La Réunion). |
| Lighthouse ≥ 90 accessibilité et bonnes pratiques ; performance ≥ 80 sur le récit (mobile) | ✅ | Récit mobile : performance 86–89, accessibilité 100, bonnes pratiques 100, SEO 100. Explorer 82–88, liste 90–91, Méthode 96 (performance), 100 ailleurs. Mesuré en Chrome sans tête, donc sans accélération graphique : la carte y est en 2D (voir Méthode). |
| Fonctionne sans WebGL et avec `prefers-reduced-motion` | ✅ | Tests Playwright `repli-2d` (WebGL 2 absent, rendu logiciel, `rendu=2d`) et `recit` (mouvement réduit : pas de défilement doux, compteur figé). |
| Interface utilisable au clavier | ✅ | Test `clavier` : chaque arrêt de tabulation affiche un anneau de 2 px ; frise au clavier (`explorer`) ; carte aux flèches ; liste des feux en alternative à la 3D. |
| Aucune clé d'API dans le bundle client | ✅ | La valeur de `FIRMS_MAP_KEY` est absente de `.next/static`, de `public/` et des réponses de `/api/firms/recent` (vérifié à chaque build de la phase). |
| Tests Playwright : récit, Explorer, feu via l'URL, repli 2D | ✅ | 23 tests (`npm run test:e2e`), bureau et téléphone. |
| Rendu conforme à la liste noire | ✅ | Section 1 ci-dessus. |
| README : lancement, scripts, variables, sources et licences | ✅ | `README.md`. |

## 3. Points ouverts

- La carte 2D du récit ne cadre pas chaque feu (vue de France fixe) : c'est un mode dégradé, les dates et les
  détections défilent comme en 3D.
- Le cache de build de Turbopack a servi une ancienne version de `globals.css` pendant cette phase ; supprimer
  `.next/cache/turbopack` a suffi. À surveiller si un changement de style n'apparaît pas.
