# Passation — reprise du projet en local

État au 12/11, fin de la session cloud.

## Fait
- Prototype complet et testé (voir README.md et TESTS.md) : accueil, récapitulatif, 4 étapes animées,
  3 scénarios + 1 variante, option sans escalier, réglages d'affichage, lanceurs Windows, build fichier unique.
- Aperçu publié : https://claude.ai/artifact/2c6V3KSHW79vZ1p6j6AkBr (privé, à partager depuis claude.ai).
- Intégration OpenStreetMap **prête mais inactive** : elle s'active dès que les fichiers
  `src/data/osm-<ville>.json` existent (src/scenes/osm.js, appelé dans src/journey/worlds.js).

## Fait en local (12/11)
- Données OSM des 4 gares dans `src/data/osm-*.json` (`npm run osm` ; fetch() de Node, 4 miroirs Overpass).
- Orientation réelle mesurée sur les voies OSM : écart avec `facadeBearing` de +14° (Béthune), +55° (Lens),
  +32° (Arras), −5° (Lille). Monuments, lieux d'arrivée et itinéraires placés à la main sont reportés
  dans ce repère (`remapToOsmFrame`, src/scenes/osm.js) ; le parvis modélisé ne bouge pas.
- Recalage par nom limité à 200 m (`osmMax` pour l'élargir), repli sur les rues piétonnes nommées.
  Non trouvés dans OSM (restent à leur position estimée) : beffroi de Béthune, stade Bollaert (hors zone),
  Opéra, Chambre de commerce, Vieille Bourse et Hôtel de Ville de Lille, cathédrale d'Arras (hors zone).
- Itinéraires recalculés sur le plus grand réseau connexe : aucun trajet ne traverse un bâtiment.
- Vue d'ensemble de la destination orientée départ → arrivée (écran portrait).
- Mention « plan © contributeurs OpenStreetMap » affichée en pied de page.

## Reste à faire
1. Contrôle visuel complet avec `npm run shots` (Playwright requis).
2. Lille : peu de bâtiments (≈ 2 700) car beaucoup d'îlots du centre sont des multipolygones OSM,
   non importés par le script (seulement les `way`).
3. Essais sur la borne (TESTS.md, section « À vérifier sur la borne »).
