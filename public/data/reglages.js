/*
 * ============================================================================
 *  RÉGLAGES D'AFFICHAGE PAR DÉFAUT
 * ============================================================================
 *  Ces valeurs servent de point de départ. Sur la borne, un panneau de réglage
 *  permet de les ajuster en direct (touche « R » au clavier, ou appui long de
 *  3 secondes sur l'horloge en haut à droite). Les valeurs ajustées sont
 *  mémorisées localement sur la borne ; le bouton « Valeurs par défaut » du
 *  panneau revient aux valeurs ci-dessous.
 *
 *  Pour figer des réglages validés sur le matériel, recopier ici les valeurs
 *  affichées par le bouton « Copier les réglages » du panneau.
 * ============================================================================
 */
window.HOLO_REGLAGES = {
  contraste: 1.0,        // 0.5 (très pâle) … 1.6 (gris plus marqués)
  exposition: 1.0,       // 0.6 … 1.4 luminosité générale
  ombres: 0.55,          // 0 (aucune ombre portée) … 1 (ombres franches)
  douceurOmbres: 5,      // 1 (nettes) … 10 (très diffuses)
  opaciteVitrages: 0.28, // 0.05 … 0.7 vitrages, verrières, gaines d'ascenseur
  opaciteMasques: 0.12,  // 0 … 0.6 opacité des murs effacés devant le voyageur
  contours: 0.55,        // 0 … 1 intensité des arêtes façon maquette
  brume: 0.6,            // 0 … 1 profondeur atmosphérique (fondu vers le blanc)
  vitesse: 1.0,          // 0.5 … 2 vitesse globale des animations
  qualite: 'haute',      // 'haute' | 'standard' (ombres et lissage allégés)
  vue: 'isometrique',    // 'isometrique' (maquette, vitrine holographique) | 'perspective'
  inactiviteSecondes: 30, // retour à l'écran de veille (infos, publicités) après N s sans interaction,
                          // ou N s après la fin de la visualisation ; 0 = jamais
  camera: true            // webcam : s'approcher de la borne ouvre le choix de destination
                          // (détection de mouvement locale, aucune image enregistrée)
};
