/* =====================================================
   ADCAM — js/cotisations.js
   Rôle : cotisations mensuelles, calcul des arriérés,
          historique des opérations, paramètres de l'association.
   ===================================================== */

// Valeurs par défaut ; remplacées par chargerParametres() au démarrage
// avec les vraies valeurs stockées dans la table "parametres".
let COTISATION_MENSUELLE = 1000;
let NUMERO_WAVE = "0757555667";
let NOM_ASSOCIATION = "ADCAM";
let NOM_ASSOCIATION_LONG = "ASSOCIATION ADCAM";

async function chargerParametres() {
  const { data, error } = await supabase.from("parametres").select("cle, valeur");
  if (error) {
    console.error(error);
    return;
  }

  (data || []).forEach(p => {
    if (p.cle === "cotisation_mensuelle") COTISATION_MENSUELLE = Number(p.valeur);
    if (p.cle === "numero_wave") NUMERO_WAVE = p.valeur;
    if (p.cle === "nom_association") NOM_ASSOCIATION = p.valeur;
    if (p.cle === "nom_association_long") NOM_ASSOCIATION_LONG = p.valeur;
  });
}

let historique = [];

// Charge les 500 dernières opérations (largement suffisant à l'écran ;
// évite de recharger des années d'historique à chaque ouverture).
async function chargerHistorique() {
  const { data, error } = await supabase
    .from("historique")
    .select("*")
    .order("date_operation", { ascending: false })
    .limit(500);

  if (error) {
    console.error(error);
    return;
  }

  historique = (data || []).map(convertirLigneHistorique);
}

function convertirLigneHistorique(h) {
  return {
    id: h.id,
    date: new Date(h.date_operation).toLocaleString("fr-FR"),
    dateISO: h.date_operation,
    membreId: h.membre_id,
    membreNom: h.membre_nom,
    nature: h.nature,
    montant: Number(h.montant),
    categorie: h.categorie
  };
}

async function ajouterHistorique(membreId, membreNom, nature, montant, categorie = "autre") {
  const { data, error } = await supabase
    .from("historique")
    .insert({
      membre_id: membreId,
      membre_nom: membreNom,
      nature,
      montant: Number(montant),
      categorie
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur lors de l'enregistrement de l'historique :", error);
    return;
  }

  historique.unshift(convertirLigneHistorique(data));
  if (typeof afficherHistorique === "function") afficherHistorique();
}

function moisCourantKey(annee, mois) {
  return `${annee}-${String(mois).padStart(2, "0")}`;
}

// Liste des mois (clés "YYYY-MM") dus depuis le mois d'adhésion du membre
// jusqu'au mois en cours, inclus. Gère correctement le changement d'année.
function moisDepuisAdhesion(membre) {
  const debut = new Date(membre.dateAdhesion);
  const maintenant = new Date();
  const cles = [];

  let annee = debut.getFullYear();
  let mois = debut.getMonth() + 1;

  while (
    annee < maintenant.getFullYear() ||
    (annee === maintenant.getFullYear() && mois <= maintenant.getMonth() + 1)
  ) {
    cles.push(moisCourantKey(annee, mois));
    mois++;
    if (mois > 12) {
      mois = 1;
      annee++;
    }
  }

  return cles;
}

// Arriéré mensuel TOTAL d'un membre : ce qu'il doit encore pour les mois
// suivis par l'application, PLUS l'arriéré antérieur éventuel (dette de
// cotisations qui existait déjà avant l'utilisation de l'application,
// pour un membre déjà ancien dans l'association). C'est ce montant
// complet qui doit apparaître dans les relances, le tableau de bord et
// les rapports — pas seulement la cotisation du mois en cours.
function calculerArriereMensuel(membreId) {
  const membre = obtenirMembre(membreId);
  if (!membre) return 0;

  const moisDus = moisDepuisAdhesion(membre);
  const moisPayes = moisDus.filter(
    cle => membre.cotisationsMensuelles && membre.cotisationsMensuelles[cle]
  ).length;

  const moisImpayes = moisDus.length - moisPayes;
  const arriereSuivi = Math.max(0, moisImpayes * COTISATION_MENSUELLE);
  const arriereAnterieur = Math.max(0, Number(membre.arriereInitial || 0));

  return arriereSuivi + arriereAnterieur;
}

function calculerArriereExceptionnel(membreId) {
  if (typeof exceptionnelles === "undefined") return 0;

  return exceptionnelles.reduce((total, ex) => {
    const statut = ex.paiements[membreId];
    if (!statut || !statut.paye) return total + Number(ex.montant);
    return total;
  }, 0);
}

function calculerArriereTotal(membreId) {
  return calculerArriereMensuel(membreId) + calculerArriereExceptionnel(membreId);
}

// Enregistre un paiement mensuel. L'ordre d'affectation du montant versé
// est : 1) l'arriéré antérieur (la dette la plus ancienne), 2) les mois
// impayés suivis par l'application, du plus ancien au plus récent, dans
// la limite du montant versé.
async function enregistrerPaiementMensuel(membreId, montantSaisi) {
  const montant = Number(montantSaisi);
  if (!montant || montant <= 0) {
    alert("Montant invalide.");
    return false;
  }

  const membre = obtenirMembre(membreId);
  if (!membre) return false;

  if (!membre.cotisationsMensuelles) membre.cotisationsMensuelles = {};

  let reste = montant;
  let nouvelArriereInitial = Number(membre.arriereInitial || 0);

  // 1) Éponge d'abord l'arriéré antérieur (la dette la plus ancienne).
  if (nouvelArriereInitial > 0) {
    const epuration = Math.min(reste, nouvelArriereInitial);
    nouvelArriereInitial = Math.round((nouvelArriereInitial - epuration) * 100) / 100;
    reste -= epuration;
  }

  // 2) Puis les mois suivis, du plus ancien au plus récent.
  const moisDus = moisDepuisAdhesion(membre);
  const nouveauxMoisPayes = [];
  for (const cle of moisDus) {
    if (reste < COTISATION_MENSUELLE) break;
    if (!membre.cotisationsMensuelles[cle]) {
      nouveauxMoisPayes.push(cle);
      reste -= COTISATION_MENSUELLE;
    }
  }

  const nouveauTotalPaye = (membre.totalPaye || 0) + montant;

  const { error: erreurMembre } = await supabase
    .from("membres")
    .update({ arriere_initial: nouvelArriereInitial, total_paye: nouveauTotalPaye })
    .eq("id", membreId);

  if (erreurMembre) {
    alert("Erreur lors de l'enregistrement du paiement : " + erreurMembre.message);
    return false;
  }

  if (nouveauxMoisPayes.length > 0) {
    const lignes = nouveauxMoisPayes.map(mois => ({ membre_id: membreId, mois }));
    const { error: erreurMois } = await supabase.from("cotisations_mensuelles").insert(lignes);

    if (erreurMois) {
      console.error(erreurMois);
    } else {
      nouveauxMoisPayes.forEach(mois => { membre.cotisationsMensuelles[mois] = true; });
    }
  }

  membre.arriereInitial = nouvelArriereInitial;
  membre.totalPaye = nouveauTotalPaye;

  await ajouterHistorique(membre.id, membre.nom, "Cotisation mensuelle", montant, "cotisation_mensuelle");

  afficherMembres();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();

  return true;
}

async function ouvrirPaiement(id) {
  const membre = obtenirMembre(id);
  if (!membre) return;

  const montant = prompt(`Montant versé par ${membre.nom} (FCFA) :`);
  if (montant === null) return;

  const ok = await enregistrerPaiementMensuel(id, montant);
  if (ok) alert("Paiement enregistré avec succès.");
}

// Annule le dernier mois payé pour un membre (paiement erroné).
// Limite connue : si le paiement annulé avait en partie épuré l'arriéré
// antérieur, cette fonction ne restitue PAS cette partie automatiquement
// (elle ne touche que les mois suivis). En cas d'erreur sur la part
// "arriéré antérieur", corrigez directement via le bouton "Modifier"
// dans la colonne Arriéré antérieur.
async function annulerDernierPaiementMensuel(membreId) {
  const membre = obtenirMembre(membreId);
  if (!membre || !membre.cotisationsMensuelles) {
    alert("Aucun paiement mensuel à annuler pour ce membre.");
    return;
  }

  const moisPayes = Object.keys(membre.cotisationsMensuelles).filter(
    cle => membre.cotisationsMensuelles[cle]
  );

  if (moisPayes.length === 0) {
    alert("Aucun paiement mensuel à annuler pour ce membre.");
    return;
  }

  const dernierMois = moisPayes.sort().pop();
  if (!confirm(`Annuler le paiement du mois ${dernierMois} pour ${membre.nom} ?`)) return;

  const { error: erreurSuppression } = await supabase
    .from("cotisations_mensuelles")
    .delete()
    .eq("membre_id", membreId)
    .eq("mois", dernierMois);

  if (erreurSuppression) {
    alert("Erreur lors de l'annulation : " + erreurSuppression.message);
    return;
  }

  const nouveauTotalPaye = Math.max(0, (membre.totalPaye || 0) - COTISATION_MENSUELLE);

  const { error: erreurMembre } = await supabase
    .from("membres")
    .update({ total_paye: nouveauTotalPaye })
    .eq("id", membreId);

  if (erreurMembre) {
    alert("Erreur lors de la mise à jour du total payé : " + erreurMembre.message);
    return;
  }

  membre.cotisationsMensuelles[dernierMois] = false;
  membre.totalPaye = nouveauTotalPaye;

  await ajouterHistorique(
    membre.id, membre.nom, `Annulation paiement ${dernierMois}`, -COTISATION_MENSUELLE, "annulation_mensuelle"
  );

  afficherMembres();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
}

function afficherHistorique() {
  const tbody = document.getElementById("historique");
  if (!tbody) return;

  tbody.innerHTML = "";

  historique.forEach(item => {
    const montant = Number(item.montant) || 0;
    const signe = montant < 0 ? "-" : "";

    tbody.innerHTML += `
      <tr>
        <td>${item.date}</td>
        <td>${item.membreNom || "-"}</td>
        <td>${item.nature}</td>
        <td>${signe}${Math.abs(montant).toLocaleString()} FCFA</td>
      </tr>`;
  });
}
