# Mon trajet — POC de borne holographique 3D (format portrait)

Prototype de visualisation de trajet pour une borne en gare : le visiteur choisit sa
destination et voit son déplacement complet prendre forme dans une maquette 3D claire :

**hall de la gare → quai → train → gare d'arrivée → correspondance → destination finale.**

> Démonstration — **données et plans fictifs**. Horaires, trains, lignes de bus, quais,
> plans intérieurs des gares et lieux d'arrivée sont inventés. Les monuments repères
> (beffrois, façades de gares, Opéra de Lille, tours d'Euralille, stade Bollaert, places
> d'Arras…) sont stylisés et placés d'après leur situation réelle approximative ; le bâti
> courant est généré.

## Choix techniques

| Besoin | Choix |
| --- | --- |
| Rendu 3D temps réel, sans éditeur graphique | **Three.js** (WebGL), modèles 3D générés par le code |
| Développement et prévisualisation dans le cloud | **Vite** (serveur de développement, build) |
| Fonctionnement autonome sur la borne Windows | Build **fichier unique** `dist/index.html` (tout le code intégré), ouvert par **Microsoft Edge en mode kiosque** — aucun serveur, aucune connexion |
| Données modifiables sur site | `data/scenarios.js` et `data/reglages.js`, fichiers texte chargés à côté de `index.html`, **sans recompilation** |

Aucune ressource distante n'est requise à l'exécution (pas de CDN, pas de police web).

## Lancer sur Windows (borne)

1. Copier le dossier **`dist/`** sur la borne (par exemple `C:\Borne\`).
2. Double-cliquer **`Lancer-borne.bat`** : Edge s'ouvre en plein écran, mode kiosque.
   Quitter : `Alt + F4`.
   - `Apercu-fenetre.bat` ouvre la démonstration dans une fenêtre portrait pour un test sur PC.
3. Démarrage automatique (optionnel) : placer un raccourci vers `Lancer-borne.bat` dans
   `shell:startup` (Win + R → `shell:startup`), ou utiliser l'« accès affecté » de Windows.

Prérequis : Windows 10/11 avec Microsoft Edge (installé par défaut). Une carte graphique
avec accélération WebGL est recommandée (voir « À vérifier sur la borne »).

## Développer / prévisualiser

```bash
npm install
npm run dev       # http://localhost:5173 (rechargement automatique)
npm run build     # produit dist/ (index.html autonome + data/ + lanceurs .bat)
npm run preview   # sert dist/ sur http://localhost:4173
npm run shots     # captures de contrôle (Playwright), voir tools/screenshots.mjs
```

Dans un navigateur de bureau, réduire la fenêtre au format portrait (ou utiliser le
mode « appareil » des outils de développement en 1080 × 1920).

## Utilisation

- **Accueil** : « Où souhaitez-vous aller ? » → ville, lieu, mode après le train
  (bus, voiture ou à pied selon la destination), option **Parcours sans escalier**.
- **Récapitulatif** : départ, horaires, train et quai, temps de marche en gare (calculés
  sur les chemins 3D), correspondance, durée totale → **Visualiser mon trajet**.
- **Guidage** : 4 étapes, frise **Gare → Train → Correspondance → Destination**.
  Commandes : Accueil, Précédent, Rejouer l'étape, Lecture/Pause, Suivant, Vue d'ensemble.
  Clavier : Espace (lecture/pause), ← / → (étapes).
- **Fin** : récapitulatif, **Revoir le parcours** ou **Autre destination**.
- Retour automatique à l'accueil après inactivité (réglable).

### Scénarios fournis

| # | Trajet | Correspondance |
| --- | --- | --- |
| 1 | Béthune → Lille-Flandres → **Espace Horizon** | bus ligne 18 (ou voiture) |
| 2 | Béthune → Lens → **Pavillon des Rencontres** | prise en charge en voiture (ou bus B2) |
| 3 | Béthune → Arras → **Atelier des Arcades** (place des Héros) | à pied |
| + | Béthune → Lille-Flandres → **Maison des Beffrois** (place du Théâtre) | à pied par la rue Faidherbe |

L'option « sans escalier » emprunte réellement un autre chemin : ascenseurs du passage
souterrain à Béthune, Lens et Arras ; rampe latérale au lieu des marches à Lille-Flandres.

## Modifier les scénarios

Éditer **`data/scenarios.js`** (dans `dist/` sur la borne, dans `public/` pour le projet),
puis recharger (F5 ou relancer). Le fichier est commenté. Pour chaque destination :

- `train` : numéro, direction, départ, **quai** de départ, **voiture**, arrivée,
  **quaiArrivee**, arrêts intermédiaires (`gare`, `heure`).
- `correspondances` : une ou plusieurs options (`mode` = `bus`, `voiture` ou `marche`)
  avec ligne, direction, horaires, nom du point de rendez-vous, minutes de marche finale.
- `lieu` : emplacement de la maquette (voir ci-dessous).

Les panneaux 3D (tableau des départs, numéros de quai et de voiture, girouette du bus,
étiquettes) et le récapitulatif sont générés à partir de ces mêmes données : ils restent
cohérents. En cas d'incohérence d'horaires (marche plus longue que le délai avant le
train ou la correspondance), un avertissement est écrit dans la console (F12).

### Quais disponibles
- Béthune, Lens, Arras : quais **1** (latéral, de plain-pied), **2** et **3** (quai central,
  par passage souterrain).
- Lille-Flandres : quais **1 à 8** (gare en cul-de-sac, accès de plain-pied depuis le hall).

### Emplacements disponibles (`lieu`, `point`)
- Lille : `horizon`, `theatre` ; points `arret-bus`, `depose-minute`.
- Lens : `bollaert` ; points `arret-bus`, `depose-minute`.
- Arras : `heros`.

Ajouter un nouvel emplacement ou un nouvel itinéraire de bus se fait dans
`src/scenes/cityPlans.js` (coordonnées en mètres, commentées) puis `npm run build`.
Les arrêts de train inconnus de la carte régionale sont placés automatiquement ; pour les
positionner précisément, compléter `STATIONS` dans `src/scenes/region.js`.

## Réglages d'affichage (sur la borne)

Touche **R**, ou **appui long de 3 s sur l'horloge** en haut à droite : contraste des
volumes, luminosité, intensité et douceur des ombres, opacité des vitrages et des murs
effacés, arêtes « maquette », profondeur (brume), vitesse, délai de retour à l'accueil,
qualité. Réglages appliqués en direct et mémorisés sur la borne. « Copier les réglages »
donne le texte à coller dans `data/reglages.js` pour les figer.

## Organisation du code

```
index.html               page et interface (écrans, commandes)
public/data/             scenarios.js, reglages.js (copiés dans dist/data/)
public/*.bat             lanceurs Windows
src/main.js              écrans, lecteur du parcours, inactivité
src/journey/stages.js    les 4 étapes animées (déterministes : pause/retour/rejouer)
src/journey/trip.js      récapitulatif, temps de marche, contrôles de cohérence
src/core/                moteur (rendu, caméra, étiquettes, matériaux, chemins, effets)
src/scenes/station*.js   gares paramétriques, itinéraires intérieurs
src/scenes/city*.js      quartiers de gare (rues, places, bâti généré, monuments)
src/scenes/landmarks.js  monuments et façades reconnaissables
src/scenes/region.js     carte régionale schématique
```

## Ce qui a été testé / ce qui reste à vérifier sur la borne

Voir la section en fin de livraison (`TESTS.md`).
