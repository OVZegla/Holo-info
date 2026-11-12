# Passation — reprise du projet en local

État au 12/11, fin de la session cloud.

## Fait
- Prototype complet et testé (voir README.md et TESTS.md) : accueil, récapitulatif, 4 étapes animées,
  3 scénarios + 1 variante, option sans escalier, réglages d'affichage, lanceurs Windows, build fichier unique.
- Aperçu publié : https://claude.ai/artifact/2c6V3KSHW79vZ1p6j6AkBr (privé, à partager depuis claude.ai).
- Intégration OpenStreetMap **prête mais inactive** : elle s'active dès que les fichiers
  `src/data/osm-<ville>.json` existent (src/scenes/osm.js, appelé dans src/journey/worlds.js).

## Reste à faire
1. Télécharger les données OSM depuis le poste local : `npm run osm`
   (le réseau cloud bloquait tous les serveurs OSM). Le script essaie overpass.kumi.systems
   puis overpass-api.de ; une ville seule : `npm run osm -- lille`.
2. `npm run dev`, vérifier chaque ville avec les vraies données :
   - alignement des voies OSM sur la gare modélisée (osmFrame dans src/scenes/osm.js),
   - recalage des monuments par nom (champ `osm` des landmarks dans src/scenes/cityPlans.js),
   - itinéraires bus / voiture / piéton calculés sur les rues réelles (rerouteOnOsm dans worlds.js),
   - absence de bâtiments OSM qui recouvrent la gare, les places ou les monuments modélisés.
3. Ajouter la mention « © contributeurs OpenStreetMap » dans `#osm-credit` (index.html) quand les données sont utilisées.
4. `npm run build`, contrôler `npm run shots`, puis commiter les JSON (moins de 20 Mo chacun).
5. Essais sur la borne (TESTS.md, section « À vérifier sur la borne »).
