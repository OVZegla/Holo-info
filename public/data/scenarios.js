/*
 * ============================================================================
 *  DONNÉES DE DÉMONSTRATION — TOUTES FICTIVES
 * ============================================================================
 *  Ce fichier est chargé tel quel par l'application (pas besoin de recompiler).
 *  Il peut être modifié avec un simple éditeur de texte (Bloc-notes, VS Code…),
 *  puis il suffit de relancer / recharger la borne (touche F5).
 *
 *  Règles :
 *   - Les horaires sont au format "HH:MM".
 *   - "quai" : numéro de quai existant dans la gare 3D (voir README, section
 *     « Quais disponibles »). Béthune, Lens, Arras : 1, 2 ou 3. Lille-Flandres : 1 à 8.
 *   - Les textes s'affichent tels quels sur la borne : rester court.
 *   - Les temps de marche dans les gares sont calculés automatiquement à partir
 *     des chemins 3D (ils ne sont pas à saisir ici).
 *   - Un champ "lieu" (destination finale) ou "point" (arrêt de bus, prise en
 *     charge) fait référence à un emplacement de la maquette de la ville
 *     (voir README, section « Emplacements disponibles »).
 * ============================================================================
 */
window.HOLO_DONNEES = {
  borne: {
    gare: 'bethune',
    nomLieu: 'Hall principal',
    // Heure simulée affichée sur la borne au lancement de la démonstration.
    heure: '08:41',
  },

  gares: {
    bethune: { nom: 'Béthune', nomComplet: 'Gare de Béthune' },
    lille: { nom: 'Lille', nomComplet: 'Gare Lille-Flandres' },
    lens: { nom: 'Lens', nomComplet: 'Gare de Lens' },
    arras: { nom: 'Arras', nomComplet: "Gare d'Arras" },
  },

  // Autres trains affichés sur le tableau des départs de Béthune (décor).
  autresDeparts: [
    { heure: '08:47', destination: 'Hazebrouck', train: 'TER 847130', quai: 1 },
    { heure: '09:12', destination: 'Saint-Pol-sur-Ternoise', train: 'TER 847714', quai: 1 },
    { heure: '09:20', destination: 'Douai', train: 'TER 847288', quai: 3 },
  ],

  villes: [
    {
      id: 'lille',
      nom: 'Lille',
      accroche: 'Gare Lille-Flandres',
      destinations: [
        {
          id: 'lille-horizon',
          nom: 'Espace Horizon',
          type: "Centre d'expositions",
          lieu: 'horizon',
          train: {
            numero: 'TER 847512',
            direction: 'Lille-Flandres',
            depart: '08:52',
            quai: 2,
            voiture: 2,
            arrivee: '09:31',
            quaiArrivee: 6,
            arrets: [
              { gare: 'La Bassée', heure: '09:07' },
              { gare: 'Don-Sainghin', heure: '09:15' },
            ],
          },
          correspondances: [
            {
              mode: 'bus',
              ligne: '18',
              direction: 'Parc Horizon',
              point: 'arret-bus',
              nomPoint: 'Arrêt Lille-Flandres — Quai B',
              depart: '09:42',
              arrivee: '09:53',
              arretDescente: 'Horizon',
              marcheFinale: 2,
            },
            {
              mode: 'voiture',
              point: 'depose-minute',
              nomPoint: 'Dépose-minute — Parvis de la gare',
              vehicule: 'Berline blanche — AB-123-CD',
              depart: '09:38',
              arrivee: '09:47',
              marcheFinale: 1,
            },
          ],
        },
        {
          id: 'lille-theatre',
          nom: 'Maison des Beffrois',
          type: 'Accueil des visiteurs',
          lieu: 'theatre',
          train: {
            numero: 'TER 847512',
            direction: 'Lille-Flandres',
            depart: '08:52',
            quai: 2,
            voiture: 2,
            arrivee: '09:31',
            quaiArrivee: 6,
            arrets: [
              { gare: 'La Bassée', heure: '09:07' },
              { gare: 'Don-Sainghin', heure: '09:15' },
            ],
          },
          correspondances: [
            {
              mode: 'marche',
              nomPoint: 'Sortie Place de la Gare',
              depart: '09:36',
              arrivee: '09:43',
              marcheFinale: 0,
            },
          ],
        },
      ],
    },
    {
      id: 'lens',
      nom: 'Lens',
      accroche: 'Gare de Lens',
      destinations: [
        {
          id: 'lens-bollaert',
          nom: 'Pavillon des Rencontres',
          type: 'Point de rendez-vous',
          lieu: 'bollaert',
          train: {
            numero: 'TER 847920',
            direction: 'Lens',
            depart: '08:58',
            quai: 3,
            voiture: 1,
            arrivee: '09:21',
            quaiArrivee: 2,
            arrets: [
              { gare: 'Nœux-les-Mines', heure: '09:06' },
              { gare: 'Mazingarbe', heure: '09:11' },
            ],
          },
          correspondances: [
            {
              mode: 'voiture',
              point: 'depose-minute',
              nomPoint: 'Dépose-minute — Parvis de la gare',
              vehicule: 'Monospace blanc — EF-456-GH',
              depart: '09:28',
              arrivee: '09:34',
              marcheFinale: 1,
            },
            {
              mode: 'bus',
              ligne: 'B2',
              direction: 'Stade Bollaert',
              point: 'arret-bus',
              nomPoint: 'Arrêt Gare de Lens — Quai A',
              depart: '09:31',
              arrivee: '09:38',
              arretDescente: 'Bollaert',
              marcheFinale: 2,
            },
          ],
        },
      ],
    },
    {
      id: 'arras',
      nom: 'Arras',
      accroche: "Gare d'Arras",
      destinations: [
        {
          id: 'arras-arcades',
          nom: 'Atelier des Arcades',
          type: 'Lieu culturel',
          lieu: 'heros',
          train: {
            numero: 'TER 847650',
            direction: 'Arras',
            depart: '09:05',
            quai: 1,
            voiture: 3,
            arrivee: '09:44',
            quaiArrivee: 3,
            arrets: [
              { gare: 'Nœux-les-Mines', heure: '09:13' },
              { gare: 'Lens', heure: '09:25' },
            ],
          },
          correspondances: [
            {
              mode: 'marche',
              nomPoint: 'Sortie Place Foch',
              depart: '09:48',
              arrivee: '09:57',
              marcheFinale: 0,
            },
          ],
        },
      ],
    },
  ],
};
