# Tests réalisés et vérifications à faire sur la borne

## Testé dans l'environnement cloud (Chromium headless, rendu WebGL logiciel)

| Élément | Comment | Résultat |
| --- | --- | --- |
| Build fichier unique (`npm run build`) | Vite + vite-plugin-singlefile | OK : `dist/index.html` (~670 Ko) + `dist/data/*.js` + lanceurs `.bat` |
| Cohérence des données (`npm run check`) | quais existants, lieux connus, horaires croissants, correspondances après l'arrivée | OK |
| Accueil → récapitulatif → parcours | captures 1080 × 1920 (`tools/screenshots.mjs`) | OK, aucune erreur console |
| Scénario 1 : Béthune → Lille-Flandres → bus 18 → Espace Horizon | 4 étapes capturées (hall, souterrain, quai, carte, arrivée, bus, trajet, arrivée) | OK |
| Variante voiture (Lille), variante à pied (Maison des Beffrois, rue Faidherbe) | captures | OK |
| Scénario 2 : Béthune → Lens → voiture → Pavillon des Rencontres | captures | OK |
| Scénario 3 : Béthune (quai 1, plain-pied) → Arras → à pied → place des Héros | captures | OK |
| Parcours sans escalier | Béthune : ascenseurs + souterrain ; Lille : sortie latérale + rampe | OK, chemins différents |
| Cohérence récapitulatif / panneaux / animation | tableau des départs, numéros de quai et de voiture, girouette du bus, horloge simulée, cartes d'information générées depuis les mêmes données | OK |
| Commandes | Lecture/Pause, Précédent, Suivant, Rejouer, Vue d'ensemble, Accueil (testées via l'API de test et clics) | OK |
| Lisibilité portrait | mise en page en unités relatives à la largeur 1080 ; contrôlée en 540 × 960 (×2) | OK |

Limites du test cloud : le rendu y est logiciel (SwiftShader). La fluidité, les ombres et
l'anticrénelage réels n'ont **pas** pu être mesurés.

## À vérifier sur la borne

1. **Performances** : afficher le panneau de réglages (touche R) qui indique les images/s.
   Viser ≥ 50 i/s. Sinon : qualité « Standard » (ombres 2048, lissage réduit), puis réduire
   « Douceur des ombres ».
2. **Rendu sur la vitre / l'écran holographique** : ajuster contraste, opacité des vitrages,
   intensité des ombres, arêtes et brume ; copier les valeurs validées dans `data/reglages.js`.
3. **Tactile** : taille et réactivité des boutons debout devant la borne, absence de zoom
   par pincement (désactivé dans Edge kiosque par `--disable-pinch`), appui long sur l'horloge.
4. **Résolution / orientation** : écran réellement en 1080 × 1920 portrait (sinon
   l'interface se centre au format 9:16).
5. **Démarrage automatique** et retour à l'accueil après inactivité (120 s par défaut).
6. **Edge kiosque** : version d'Edge installée, mises à jour, accès à `file://`.
7. **Polices** : l'interface utilise Segoe UI (présente sur Windows) ; vérifier le rendu.

## Données géographiques

OpenStreetMap n'était pas accessible depuis la session de développement. Les monuments
sont donc placés d'après leur situation réelle approximative (direction et distance
depuis la gare) et le bâti courant est généré. Le script `npm run osm` (dossier `tools/`)
récupère les vrais contours de bâtiments et de rues dès qu'un accès à Overpass est
disponible.
