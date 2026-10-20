# Rapport de validation des données

Généré par `scripts/06-validate.ts` le 20 oct. 2026 à partir de `public/data` (manifest mis à jour le 20 oct. 2026).

**Résultat : aucun problème.**

## 1. Fichiers publiés

33 fichiers sur 33 conformes (taille, sha256 et schéma Zod) ; 33 fichiers présents dans `public/data`.

## 2. EFFIS : totaux du pipeline et statistiques officielles

Pipeline : polygones de France métropolitaine de 30 ha ou plus, année de la date publiée par EFFIS (heure locale).
Officiel : API du portail EFFIS Statistics, pays FRA (inclut l’outre-mer).

| Année | Pipeline (métropole) | EFFIS officiel (FRA) | Écart | Hors métropole | Résiduel | Explication |
|---|---:|---:|---:|---:|---:|---|
| 2006 | 1 751 ha | 1 751 ha | 0 | — | 0 | identique |
| 2007 | 2 631 ha | 2 631 ha | 0 | — | 0 | identique |
| 2008 | 1 694 ha | 1 694 ha | 0 | — | 0 | identique |
| 2009 | 7 974 ha | 7 974 ha | 0 | — | 0 | identique |
| 2010 | 4 653 ha | 4 653 ha | 0 | — | 0 | identique |
| 2011 | 2 205 ha | 4 831 ha | +2 626 | 2 626 ha | 0 | polygone(s) hors métropole : La Réunion |
| 2012 | 3 298 ha | 3 298 ha | 0 | — | 0 | identique |
| 2013 | 891 ha | 891 ha | 0 | — | 0 | identique |
| 2014 | 4 667 ha | 4 667 ha | 0 | — | 0 | identique |
| 2015 | 2 046 ha | 2 046 ha | 0 | — | 0 | identique |
| 2016 | 10 767 ha | 10 767 ha | 0 | — | 0 | identique |
| 2017 | 20 626 ha | 20 626 ha | 0 | — | 0 | identique |
| 2018 | 2 581 ha | 2 581 ha | 0 | — | 0 | identique |
| 2019 | 43 602 ha | 43 602 ha | 0 | — | 0 | identique |
| 2020 | 14 547 ha | 14 547 ha | 0 | — | 0 | identique |
| 2021 | 30 652 ha | 30 652 ha | 0 | — | 0 | identique |
| 2022 | 66 337 ha | 66 337 ha | 0 | — | 0 | identique |
| 2023 | 22 350 ha | 22 350 ha | 0 | — | 0 | identique |
| 2024 | 12 268 ha | 12 268 ha | 0 | — | 0 | identique |
| 2025 | 36 951 ha | 36 951 ha | 0 | — | 0 | identique |
| 2026 | 98 459 ha | 98 459 ha | 0 | — | 0 | identique |

## 3. EFFIS et BDIFF par année (informatif)

EFFIS cartographie par satellite les surfaces brûlées (toute végétation) ; la BDIFF recense les feux déclarés par les services d’incendie (type F), avec des surfaces souvent estimées. Les deux ne s’additionnent pas et ne coïncident pas.

| Année | EFFIS ≥ 30 ha | EFFIS tous polygones | BDIFF (feux déclarés) | BDIFF / EFFIS ≥ 30 ha |
|---|---:|---:|---:|---:|
| 2006 | 1 751 ha | 1 751 ha | 7 027 ha (3 231 feux) | 401 % |
| 2007 | 2 631 ha | 2 631 ha | 7 057 ha (2 690 feux) | 268 % |
| 2008 | 1 694 ha | 1 694 ha | 4 710 ha (1 801 feux) | 278 % |
| 2009 | 7 974 ha | 7 974 ha | 14 613 ha (3 012 feux) | 183 % |
| 2010 | 4 653 ha | 4 677 ha | 8 525 ha (2 443 feux) | 183 % |
| 2011 | 2 205 ha | 2 205 ha | 6 800 ha (2 774 feux) | 308 % |
| 2012 | 3 298 ha | 3 355 ha | 7 585 ha (2 763 feux) | 230 % |
| 2013 | 891 ha | 914 ha | 2 736 ha (1 510 feux) | 307 % |
| 2014 | 4 667 ha | 4 667 ha | 4 736 ha (1 730 feux) | 101 % |
| 2015 | 2 046 ha | 2 098 ha | 8 169 ha (2 898 feux) | 399 % |
| 2016 | 10 767 ha | 10 793 ha | 14 102 ha (2 775 feux) | 131 % |
| 2017 | 20 626 ha | 20 654 ha | 23 092 ha (3 216 feux) | 112 % |
| 2018 | 2 581 ha | 2 636 ha | 3 940 ha (1 634 feux) | 153 % |
| 2019 | 43 602 ha | 45 230 ha | 13 395 ha (2 949 feux) | 31 % |
| 2020 | 14 547 ha | 16 589 ha | 10 723 ha (2 760 feux) | 74 % |
| 2021 | 30 652 ha | 34 999 ha | 12 780 ha (2 332 feux) | 42 % |
| 2022 | 66 337 ha | 74 598 ha | 58 981 ha (4 378 feux) | 89 % |
| 2023 | 22 350 ha | 27 872 ha | 5 389 ha (2 673 feux) | 24 % |
| 2024 | 12 268 ha | 17 137 ha | 2 733 ha (1 350 feux) | 22 % |
| 2025 | 36 951 ha | 45 172 ha | 21 737 ha (2 514 feux) | 59 % |
| 2026 | 98 459 ha | 108 609 ha | non diffusé | — |

## 4. Rapprochements EFFIS ↔ BDIFF

Règle : Fiches BDIFF de la même année dont la commune touche le polygone EFFIS (ADMIN EXPRESS, dernière édition), dont l’alerte est à 10 jours au plus de la première détection satellite, de 1 ha ou plus, et dont la surface déclarée vaut entre 25 % et 400 % de la surface EFFIS. Lien conservé seulement s’il n’existe qu’un candidat.

| Année | Polygones EFFIS | Univoques | Ambigus (non liés) | Sans candidat |
|---|---:|---:|---:|---:|
| 2006 | 12 | 7 | 3 | 2 |
| 2007 | 12 | 8 | 2 | 2 |
| 2008 | 8 | 7 | 0 | 1 |
| 2009 | 16 | 14 | 0 | 2 |
| 2010 | 10 | 9 | 0 | 1 |
| 2011 | 22 | 17 | 1 | 4 |
| 2012 | 21 | 10 | 0 | 11 |
| 2013 | 10 | 4 | 0 | 6 |
| 2014 | 26 | 8 | 0 | 18 |
| 2015 | 17 | 9 | 1 | 7 |
| 2016 | 28 | 20 | 0 | 8 |
| 2017 | 92 | 44 | 2 | 46 |
| 2018 | 23 | 3 | 0 | 20 |
| 2019 | 370 | 55 | 2 | 313 |
| 2020 | 260 | 64 | 3 | 193 |
| 2021 | 588 | 74 | 5 | 509 |
| 2022 | 1088 | 234 | 12 | 842 |
| 2023 | 675 | 80 | 6 | 589 |
| 2024 | 604 | 48 | 4 | 552 |
| 2025 | 1312 | 107 | 9 | 1196 |

Les polygones sans candidat sont surtout de petites surfaces (dont les brûlages hivernaux des Pyrénées) sans fiche BDIFF de 1 ha ou plus à proximité, ou des fiches dont la commune a changé de code INSEE (communes nouvelles).

## 5. Chiffres de presse

### Surface brûlée en France en 2026

> « près de 100.000 hectares de forêt » — Belga, citant France Assureurs (dépêche reprise par DH), 16 oct. 2026 ([lien](https://www.dhnet.be/dernieres-depeches/2026/10/16/le-cout-des-incendies-en-france-cet-ete-evalue-a-563-millions-deuros-X2XSWO6Z2NG6RM4IUSPWNZFVKQ/))

- EFFIS, année civile 2026, feux ≥ 30 ha : **98 459 ha** (−1 541 ha par rapport à la presse) ; tous polygones : 108 609 ha.
- EFFIS, saison du 1er juin au 30 septembre, feux ≥ 30 ha : 71 218 ha.
- Explication : le chiffre de presse (arrondi) correspond au total de l’année civile, pas à l’été ; EFFIS compte toutes les surfaces brûlées, pas seulement la forêt.

### Feu de Gironde, juillet 2026

> « 42.000 hectares » — Belga, citant France Assureurs (dépêche reprise par DH), 16 oct. 2026 ([lien](https://www.dhnet.be/dernieres-depeches/2026/10/16/le-cout-des-incendies-en-france-cet-ete-evalue-a-563-millions-deuros-X2XSWO6Z2NG6RM4IUSPWNZFVKQ/))

- EFFIS, polygone 562583 (Porge, Gironde) : **37 191 ha**, mis à jour le 23 juil. 2026 (−4 809 ha, soit -11 %).
- Explication partielle : le chiffre de presse est arrondi et ne précise pas s’il s’agit de surface parcourue ou brûlée ; EFFIS cartographie la surface brûlée détectée par satellite. À confronter en phase 4 aux communiqués de la préfecture de la Gironde.

