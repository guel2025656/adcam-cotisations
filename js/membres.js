/* =====================================================
   ADCAM — js/membres.js
   Rôle : gestion des membres (CRUD), matricule, export.
   Les données vivent maintenant dans Supabase (base partagée
   entre Président, Trésorier et Secrétaire), plus seulement
   dans le navigateur.
   ===================================================== */

let membres = [];

// Charge tous les membres depuis Supabase, en reconstituant la même
// structure qu'avant (cotisationsMensuelles sous forme d'objet
// { "2026-01": true, ... }) pour que le reste du code n'ait presque
// rien à changer.
async function chargerMembres() {
  const { data: lignesMembres, error: erreurMembres } = await supabase
    .from("membres")
    .select("*")
    .order("matricule");

  if (erreurMembres) {
    console.error(erreurMembres);
    alert("Erreur lors du chargement des membres : " + erreurMembres.message);
    return;
  }

  const { data: lignesCotisations, error: erreurCotisations } = await supabase
    .from("cotisations_mensuelles")
    .select("membre_id, mois");

  if (erreurCotisations) {
    console.error(erreurCotisations);
  }

  membres = (lignesMembres || []).map(m => ({
    id: m.id,
    matricule: m.matricule,
    nom: m.nom,
    telephone: m.telephone,
    dateAdhesion: m.date_adhesion,
    totalPaye: Number(m.total_paye || 0),
    arriereInitial: Number(m.arriere_initial || 0),
    dateRelance: m.date_relance,
    cotisationsMensuelles: {}
  }));

  (lignesCotisations || []).forEach(c => {
    const membre = membres.find(m => m.id === c.membre_id);
    if (membre) membre.cotisationsMensuelles[c.mois] = true;
  });
}

function obtenirMembre(id) {
  return membres.find(m => m.id === id);
}

// Génère le prochain matricule en se basant sur le numéro le plus élevé
// déjà attribué (et non sur la longueur du tableau), pour éviter les
// doublons après une suppression.
function genererMatricule() {
  const numeros = membres
    .map(m => Number(String(m.matricule || "").split("-")[1]) || 0)
    .filter(n => n > 0);

  const prochain = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
  return `ADCAM-${String(prochain).padStart(3, "0")}`;
}

async function ajouterMembre() {
  const nomInput = document.getElementById("nom");
  const telInput = document.getElementById("telephone");
  const arriereInput = document.getElementById("arriereInitialMembre");

  const nom = nomInput.value.trim();
  const telephone = telInput.value.trim();
  const arriereInitial = arriereInput ? Math.max(0, Number(arriereInput.value) || 0) : 0;

  if (!nom) {
    alert("Veuillez saisir le nom du membre.");
    return;
  }
  if (!telephone) {
    alert("Veuillez saisir le numéro de téléphone.");
    return;
  }

  const matricule = genererMatricule();

  const { data, error } = await supabase
    .from("membres")
    .insert({ matricule, nom, telephone, arriere_initial: arriereInitial })
    .select()
    .single();

  if (error) {
    alert("Erreur lors de l'ajout du membre : " + error.message);
    return;
  }

  const nouveauMembre = {
    id: data.id,
    matricule: data.matricule,
    nom: data.nom,
    telephone: data.telephone,
    dateAdhesion: data.date_adhesion,
    totalPaye: Number(data.total_paye || 0),
    arriereInitial: Number(data.arriere_initial || 0),
    dateRelance: data.date_relance,
    cotisationsMensuelles: {}
  };

  membres.push(nouveauMembre);

  // Inscrit automatiquement ce membre dans les cotisations exceptionnelles
  // déjà créées, afin qu'il apparaisse dans leurs tableaux.
  if (typeof exceptionnelles !== "undefined" && exceptionnelles.length > 0) {
    const lignes = exceptionnelles.map(ex => ({
      exceptionnelle_id: ex.id,
      membre_id: nouveauMembre.id,
      paye: false
    }));

    const { error: erreurPaiements } = await supabase
      .from("paiements_exceptionnels")
      .insert(lignes);

    if (!erreurPaiements) {
      exceptionnelles.forEach(ex => {
        ex.paiements[nouveauMembre.id] = { paye: false, datePaiement: null };
      });
    }
  }

  afficherMembres();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
  rafraichirTableauExceptionnelleActive();

  nomInput.value = "";
  telInput.value = "";
  if (arriereInput) arriereInput.value = "";
}

// Permet de saisir ou corriger l'arriéré antérieur d'un membre (dette de
// cotisations mensuelles qui existait déjà avant l'utilisation de
// l'application). Utile pour les membres anciens de l'association, ou
// pour corriger une erreur de saisie initiale.
async function modifierArriereInitial(membreId) {
  const membre = obtenirMembre(membreId);
  if (!membre) return;

  const valeurActuelle = Number(membre.arriereInitial || 0);
  const saisie = prompt(
    `Arriéré antérieur (cotisations dues avant l'utilisation de l'application)\npour ${membre.nom} (FCFA) :`,
    valeurActuelle
  );
  if (saisie === null) return;

  const nouvelleValeur = Number(saisie);
  if (isNaN(nouvelleValeur) || nouvelleValeur < 0) {
    alert("Veuillez saisir un montant valide (0 ou plus).");
    return;
  }

  const { error } = await supabase
    .from("membres")
    .update({ arriere_initial: nouvelleValeur })
    .eq("id", membreId);

  if (error) {
    alert("Erreur lors de la mise à jour : " + error.message);
    return;
  }

  membre.arriereInitial = nouvelleValeur;

  if (typeof ajouterHistorique === "function") {
    await ajouterHistorique(
      membre.id,
      membre.nom,
      "Mise à jour de l'arriéré antérieur",
      0,
      "ajustement_arriere_initial"
    );
  }

  afficherMembres();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
}

async function supprimerMembre(id) {
  const membre = obtenirMembre(id);
  if (!membre) return;

  if (!confirm(`Supprimer définitivement ${membre.nom} ?`)) return;

  const { error } = await supabase.from("membres").delete().eq("id", id);
  if (error) {
    alert("Erreur lors de la suppression : " + error.message);
    return;
  }

  membres = membres.filter(m => m.id !== id);

  if (typeof exceptionnelles !== "undefined") {
    exceptionnelles.forEach(ex => { delete ex.paiements[id]; });
  }

  afficherMembres();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
  rafraichirTableauExceptionnelleActive();
}

function afficherMembres() {
  const tbody = document.getElementById("listeMembres");
  if (!tbody) return;

  tbody.innerHTML = "";

  membres.forEach(membre => {
    const arriereInitial = Number(membre.arriereInitial || 0);
    const arriere = typeof calculerArriereTotal === "function" ? calculerArriereTotal(membre.id) : 0;
    const classeNom = arriere > 0 ? "membre-debiteur" : "";

    tbody.innerHTML += `
      <tr>
        <td>${membre.matricule}</td>
        <td class="${classeNom}">${membre.nom}</td>
        <td>${membre.telephone}</td>
        <td>${Number(membre.totalPaye || 0).toLocaleString()} FCFA</td>
        <td>
          ${arriereInitial.toLocaleString()} FCFA
          <button class="btn-annuler btn-mini" onclick="modifierArriereInitial(${membre.id})">Modifier</button>
        </td>
        <td>${Number(arriere).toLocaleString()} FCFA</td>
        <td>
          <div class="action-buttons">
            <button class="btn-payer" onclick="ouvrirPaiement(${membre.id})">Payer</button>
            <button class="btn-relance" onclick="relancerMembre(${membre.id})">Relancer</button>
            <button class="btn-recu" onclick="genererRecuPDF(${membre.id})">Reçu</button>
            <button class="btn-annuler" onclick="annulerDernierPaiementMensuel(${membre.id})">Annuler</button>
            <button class="btn-supprimer" onclick="supprimerMembre(${membre.id})">Supprimer</button>
          </div>
        </td>
      </tr>`;
  });
}

// Export JSON de secours (lecture seule) : utile pour archiver un état
// des membres à un instant donné. Les données réelles vivent dans
// Supabase ; ceci n'est qu'une copie de consultation.
function exporterMembres() {
  const donnees = JSON.stringify(membres, null, 2);
  const blob = new Blob([donnees], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "membres_adcam.json";
  a.click();

  URL.revokeObjectURL(url);
}

// Petit utilitaire partagé : rafraîchit la liste résumée des cotisations
// exceptionnelles et les listes des rapports, pour rester à jour après
// ajout/suppression d'un membre.
function rafraichirTableauExceptionnelleActive() {
  if (typeof afficherListeExceptionnelles === "function") {
    afficherListeExceptionnelles();
  }

  if (typeof populerSelectsRapports === "function") {
    populerSelectsRapports();
  }
}
