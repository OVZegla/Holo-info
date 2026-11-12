/*
 * ============================================================================
 *  ÉCRAN DE VEILLE — CARROUSEL DE SECOURS
 *  (la veille normale est la vidéo motion design dist/videos/veille.mp4, générée
 *  par le sous-projet motion/ ; ce carrousel ne s'affiche que si elle manque)
 * ============================================================================
 *  Affiché quand personne n'utilise la borne. Il suffit de s'approcher (caméra)
 *  ou de toucher l'écran pour choisir sa destination.
 *  Modifiable avec un simple éditeur de texte, puis recharger la borne (F5).
 *
 *  Informations municipales relevées le 12/11/2026 sur bethune.fr et dans le
 *  programme de la biennale de la Communauté d'agglomération Béthune-Bruay,
 *  Artois Lys Romane : à vérifier et mettre à jour régulièrement.
 *  Uniquement des informations liées à Béthune (pas de publicité commerciale).
 *
 *  Champs d'une diapositive :
 *    type    : 'info' (municipal) | 'pub' (publicité) | 'evenement'
 *    source  : petit libellé en haut (ex. « Ville de Béthune »)
 *    titre, texte, quand, ou : textes affichés (rester court)
 *    couleur : teinte pastel du fond : 'bleu' | 'menthe' | 'peche' | 'lavande' | 'citron' | 'rose'
 *    icone   : 'noel' | 'expo' | 'sante' | 'coeur' | 'jeunes' | 'appli' | 'agenda' | 'bus'
 *              | 'travaux' | 'cafe' | 'velo' | 'frites' | 'retro'
 * ============================================================================
 */
window.HOLO_INFOS = {
  dureeDiapo: 8, // secondes par diapositive

  diapos: [
    {
      type: 'evenement', source: 'Ville de Béthune', couleur: 'bleu', icone: 'noel',
      titre: 'La Cité de Noël revient', texte: 'Chalets, illuminations et animations pour toute la famille au pied du beffroi.',
      quand: 'Du 27 novembre au 27 décembre', ou: 'Grand’Place · entrée libre',
    },
    {
      type: 'evenement', source: 'Agglo Béthune-Bruay', couleur: 'lavande', icone: 'expo',
      titre: 'Les mondes invisibles', texte: 'Biennale d’art autour d’Augustin Lesage : derniers jours pour la découvrir !',
      quand: 'Jusqu’au 15 novembre', ou: 'Labanque · Chapelle Saint-Pry · Cité des Électriciens',
    },
    {
      type: 'info', source: 'Ville de Béthune', couleur: 'menthe', icone: 'coeur',
      titre: 'Novembre, mois du vivre-ensemble', texte: 'Rencontres et animations dans les quartiers tout au long du mois.',
      quand: 'Tout le mois de novembre', ou: 'Programme sur bethune.fr',
    },
    {
      type: 'evenement', source: 'Ville de Béthune', couleur: 'citron', icone: 'retro',
      titre: 'Béthune Rétro', texte: 'Rockabilly, voitures anciennes et concerts gratuits : le centre-ville remonte le temps.',
      quand: 'Fin août', ou: 'Centre-ville · entrée libre',
    },
    {
      type: 'info', source: 'Ville de Béthune', couleur: 'bleu', icone: 'sante',
      titre: 'Novembre Bleu', texte: 'Un mois pour parler de la santé des hommes : dépistage, prévention, information.',
      quand: 'En novembre', ou: 'Infos sur bethune.fr',
    },
    {
      type: 'info', source: 'Ville de Béthune', couleur: 'rose', icone: 'jeunes',
      titre: 'Pass’Jeunes 2026', texte: 'Le pass bons plans des 0-25 ans est de retour : culture, sport et loisirs à prix doux.',
      quand: 'Disponible maintenant', ou: 'Mairie et bethune.fr',
    },
    {
      type: 'info', source: 'Ville de Béthune', couleur: 'lavande', icone: 'appli',
      titre: 'B-Clic, vos démarches en ligne', texte: 'État civil, inscriptions, demandes : la mairie dans votre poche, 7 jours sur 7.',
      quand: 'Sur smartphone et ordinateur', ou: 'Espace citoyen bethune.fr',
    },
    {
      type: 'info', source: 'Ville de Béthune', couleur: 'citron', icone: 'agenda',
      titre: 'Béthune, ça bouge !', texte: 'Concerts, expositions, marchés, sport : tout l’agenda de la ville au même endroit.',
      quand: 'Mis à jour chaque jour', ou: 'agenda-bethune.fr',
    },
  ],

  // bandeau défilant en bas de l'écran
  bandeau: [
    'Réseau Tadao : vos bus et Bulles au départ de la gare',
    'Travaux : campagne d’élagage et d’entretien des voiries en cours',
    'La Ville demande le rétablissement des TGV directs Béthune – Paris',
    'Cité de Noël : du 27 novembre au 27 décembre sur la Grand’Place',
    'Point info voyageurs : visualisez votre trajet en 3D',
  ],
};
