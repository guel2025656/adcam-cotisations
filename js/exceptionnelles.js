/* =====================================================
   ADCAM — js/exceptionnelles.js
   Rôle : cotisations exceptionnelles. Quand une cotisation
   exceptionnelle est créée, elle s'applique à TOUS les membres
   actuels. Pour chacun, on suit individuellement s'il a payé,
   avec son nom affiché en couleur (vert = payé) et les actions
   Payer / Relancer / Reçu / Annuler.

   Dans la page principale (index.html), on ne voit qu'un résumé
   de chaque cotisation exceptionnelle, avec un bouton "Ouvrir" qui
   lance une fenêtre dédiée (exceptionnelle.html) : c'est dans cette
   fenêtre que se font les encaissements, les relances, les reçus et
   un petit rapport propre à cette cotisation.
   ===================================================== */

let exceptionnelles = [];

// Charge toutes les cotisations exceptionnelles et reconstitue, pour
// chacune, la carte des paiements par membre — comme avant, pour que
// le reste du code n'ait presque rien à changer.
async function chargerExceptionnelles() {
  const { data: lignesExceptionnelles, error: erreurEx } = await supabase
    .from("cotisations_exceptionnelles")
    .select("*")
    .order("date_creation", { ascending: false });

  if (erreurEx) {
    console.error(erreurEx);
    return;
  }

  const { data: lignesPaiements, error: erreurPaiements } = await supabase
    .from("paiements_exceptionnels")
    .select("*");

  if (erreurPaiements) {
    console.error(erreurPaiements);
  }

  exceptionnelles = (lignesExceptionnelles || []).map(ex => ({
    id: ex.id,
    libelle: ex.libelle,
    montant: Number(ex.montant),
    dateCreation: ex.date_creation,
    paiements: {}
  }));

  (lignesPaiements || []).forEach(p => {
    const ex = exceptionnelles.find(e => e.id === p.exceptionnelle_id);
    if (ex) {
      ex.paiements[p.membre_id] = { paye: p.paye, datePaiement: p.date_paiement };
    }
  });
}

function obtenirExceptionnelle(id) {
  return exceptionnelles.find(e => e.id === id);
}

async function ajouterCotisationExceptionnelle(libelleSaisi, montantSaisi) {
  const libelle = String(libelleSaisi || "").trim();
  const montant = Number(montantSaisi);

  if (!libelle || !montant || montant <= 0) {
    alert("Veuillez saisir un libellé et un montant valides.");
    return null;
  }

  const { data, error } = await supabase
    .from("cotisations_exceptionnelles")
    .insert({ libelle, montant })
    .select()
    .single();

  if (error) {
    alert("Erreur lors de la création de la cotisation : " + error.message);
    return null;
  }

  const exceptionnelle = {
    id: data.id,
    libelle: data.libelle,
    montant: Number(data.montant),
    dateCreation: data.date_creation,
    paiements: {}
  };

  if (membres.length > 0) {
    const lignes = membres.map(m => ({
      exceptionnelle_id: exceptionnelle.id,
      membre_id: m.id,
      paye: false
    }));

    const { error: erreurPaiements } = await supabase.from("paiements_exceptionnels").insert(lignes);

    if (erreurPaiements) {
      console.error(erreurPaiements);
    } else {
      membres.forEach(m => {
        exceptionnelle.paiements[m.id] = { paye: false, datePaiement: null };
      });
    }
  }

  exceptionnelles.unshift(exceptionnelle);

  afficherListeExceptionnelles();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();

  return exceptionnelle;
}

// Affiche dans la page principale le tableau RÉSUMÉ de toutes les
// cotisations exceptionnelles créées (sans le détail membre par membre,
// qui se gère désormais dans la fenêtre dédiée).
function afficherListeExceptionnelles() {
  const tbody = document.getElementById("listeExceptionnelles");
  if (!tbody) return;

  tbody.innerHTML = "";

  exceptionnelles.forEach(ex => {
    const total = Object.keys(ex.paiements).length;
    const payes = Object.values(ex.paiements).filter(p => p.paye).length;
    const resteAPercevoir = (total - payes) * Number(ex.montant);
    const dateCreation = new Date(ex.dateCreation).toLocaleDateString("fr-FR");

    tbody.innerHTML += `
      <tr>
        <td>${ex.libelle}</td>
        <td>${Number(ex.montant).toLocaleString()} FCFA</td>
        <td>${dateCreation}</td>
        <td>${payes} / ${total}</td>
        <td>${resteAPercevoir.toLocaleString()} FCFA</td>
        <td>
          <div class="action-buttons">
            <button class="btn-payer" onclick="ouvrirFenetreExceptionnelle(${ex.id})">Ouvrir</button>
            <button class="btn-supprimer" onclick="supprimerExceptionnelle(${ex.id})">Supprimer</button>
          </div>
        </td>
      </tr>`;
  });
}

// Ouvre la fenêtre dédiée à une cotisation exceptionnelle précise.
// Cette fenêtre (exceptionnelle.html) se connecte à la même base
// Supabase ; elle doit simplement rester dans le même dossier que
// index.html pour que les chemins relatifs (css/js) fonctionnent.
function ouvrirFenetreExceptionnelle(id) {
  const fenetre = window.open(
    `exceptionnelle.html?id=${id}`,
    `exceptionnelle_${id}`,
    "width=950,height=750"
  );

  if (!fenetre) {
    alert("Veuillez autoriser les fenêtres popup pour ce site afin d'ouvrir la cotisation exceptionnelle.");
  }
}

async function supprimerExceptionnelle(id) {
  const ex = obtenirExceptionnelle(id);
  if (!ex) return;

  if (!confirm(`Supprimer définitivement la cotisation exceptionnelle "${ex.libelle}" ? Cette action est irréversible.`)) {
    return;
  }

  const { error } = await supabase.from("cotisations_exceptionnelles").delete().eq("id", id);
  if (error) {
    alert("Erreur lors de la suppression : " + error.message);
    return;
  }

  exceptionnelles = exceptionnelles.filter(e => e.id !== id);

  afficherListeExceptionnelles();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
}

// Affiche, à l'intérieur de la fenêtre dédiée, la liste de TOUS les
// membres pour une cotisation exceptionnelle donnée : nom en couleur
// selon le statut, et boutons d'action.
function afficherMembresExceptionnelle(exceptionnelleId) {
  const zone = document.getElementById("tableauExceptionnelle");
  if (!zone) return;

  const exceptionnelle = obtenirExceptionnelle(exceptionnelleId);
  if (!exceptionnelle) {
    zone.innerHTML = "";
    return;
  }

  // Solution de secours pour l'affichage si un membre n'a pas encore de
  // ligne de paiement enregistrée (cas rare) ; la prochaine action
  // Payer/Annuler sur ce membre l'enregistrera réellement (upsert).
  membres.forEach(m => {
    if (!exceptionnelle.paiements[m.id]) {
      exceptionnelle.paiements[m.id] = { paye: false, datePaiement: null };
    }
  });

  let lignes = "";
  membres.forEach(membre => {
    const statut = exceptionnelle.paiements[membre.id] || { paye: false, datePaiement: null };
    const classeNom = statut.paye ? "membre-paye" : "";
    const statutTexte = statut.paye
      ? `Payé le ${new Date(statut.datePaiement).toLocaleDateString("fr-FR")}`
      : "Non payé";

    const boutonsAction = statut.paye
      ? `<button class="btn-annuler" onclick="annulerPaiementExceptionnel(${exceptionnelle.id}, ${membre.id})">Annuler</button>`
      : `<button class="btn-payer" onclick="payerCotisationExceptionnelle(${exceptionnelle.id}, ${membre.id})">Payer</button>
         <button class="btn-relance" onclick="relancerCotisationExceptionnelle(${exceptionnelle.id}, ${membre.id})">Relancer</button>`;

    lignes += `
      <tr>
        <td class="${classeNom}">${membre.nom}</td>
        <td>${statutTexte}</td>
        <td>
          <div class="action-buttons">
            ${boutonsAction}
            <button class="btn-recu" onclick="genererRecuExceptionnelPDF(${exceptionnelle.id}, ${membre.id})">Reçu</button>
          </div>
        </td>
      </tr>`;
  });

  zone.innerHTML = `
    <h3>${exceptionnelle.libelle} — ${Number(exceptionnelle.montant).toLocaleString()} FCFA / membre</h3>
    <table>
      <thead><tr><th>Membre</th><th>Statut</th><th>Actions</th></tr></thead>
      <tbody>${lignes || "<tr><td colspan='3'>Aucun membre enregistré.</td></tr>"}</tbody>
    </table>`;
}

async function payerCotisationExceptionnelle(exceptionnelleId, membreId) {
  const exceptionnelle = obtenirExceptionnelle(exceptionnelleId);
  const membre = obtenirMembre(membreId);
  if (!exceptionnelle || !membre) return;

  const maintenant = new Date().toISOString();

  const { error } = await supabase
    .from("paiements_exceptionnels")
    .upsert(
      { exceptionnelle_id: exceptionnelleId, membre_id: membreId, paye: true, date_paiement: maintenant },
      { onConflict: "exceptionnelle_id,membre_id" }
    );

  if (error) {
    alert("Erreur lors de l'enregistrement du paiement : " + error.message);
    return;
  }

  exceptionnelle.paiements[membreId] = { paye: true, datePaiement: maintenant };

  await ajouterHistorique(
    membre.id,
    membre.nom,
    `Cotisation exceptionnelle : ${exceptionnelle.libelle}`,
    exceptionnelle.montant,
    "cotisation_exceptionnelle"
  );

  afficherMembresExceptionnelle(exceptionnelleId);
  if (typeof afficherRapportExceptionnelle === "function") afficherRapportExceptionnelle(exceptionnelleId);
  if (typeof afficherMembres === "function") afficherMembres();
  if (typeof afficherListeExceptionnelles === "function") afficherListeExceptionnelles();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();

  if (confirm("Paiement enregistré. Générer le reçu PDF maintenant ?")) {
    genererRecuExceptionnelPDF(exceptionnelleId, membreId);
  }
}

// Annule un paiement exceptionnel enregistré par erreur.
async function annulerPaiementExceptionnel(exceptionnelleId, membreId) {
  const exceptionnelle = obtenirExceptionnelle(exceptionnelleId);
  const membre = obtenirMembre(membreId);
  if (!exceptionnelle || !membre) return;

  if (!confirm(`Annuler le paiement de ${membre.nom} pour "${exceptionnelle.libelle}" ?`)) return;

  const { error } = await supabase
    .from("paiements_exceptionnels")
    .upsert(
      { exceptionnelle_id: exceptionnelleId, membre_id: membreId, paye: false, date_paiement: null },
      { onConflict: "exceptionnelle_id,membre_id" }
    );

  if (error) {
    alert("Erreur lors de l'annulation : " + error.message);
    return;
  }

  exceptionnelle.paiements[membreId] = { paye: false, datePaiement: null };

  await ajouterHistorique(
    membre.id,
    membre.nom,
    `Annulation cotisation exceptionnelle : ${exceptionnelle.libelle}`,
    -exceptionnelle.montant,
    "annulation_exceptionnelle"
  );

  afficherMembresExceptionnelle(exceptionnelleId);
  if (typeof afficherRapportExceptionnelle === "function") afficherRapportExceptionnelle(exceptionnelleId);
  if (typeof afficherMembres === "function") afficherMembres();
  if (typeof afficherListeExceptionnelles === "function") afficherListeExceptionnelles();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
}

// Filtre utilitaire : renvoie les membres ayant déjà payé une cotisation
// exceptionnelle donnée.
function membresAyantPayeExceptionnelle(exceptionnelleId) {
  const exceptionnelle = obtenirExceptionnelle(exceptionnelleId);
  if (!exceptionnelle) return [];

  return membres.filter(m => {
    const statut = exceptionnelle.paiements[m.id];
    return statut && statut.paye;
  });
}

// Total encaissé sur l'ensemble des cotisations exceptionnelles (tous
// membres, toutes cotisations confondues).
function calculerTotalExceptionnellesEncaisse() {
  let total = 0;
  exceptionnelles.forEach(ex => {
    Object.values(ex.paiements).forEach(p => {
      if (p.paye) total += Number(ex.montant);
    });
  });
  return total;
}

/* ---------- MINI-RAPPORT PAR COTISATION EXCEPTIONNELLE ---------- */
/* Affiché dans la fenêtre dédiée (exceptionnelle.html).            */

function genererDonneesRapportExceptionnelle(exceptionnelleId) {
  const ex = obtenirExceptionnelle(exceptionnelleId);
  if (!ex) return null;

  const totalMembres = Object.keys(ex.paiements).length;
  const nbPayes = Object.values(ex.paiements).filter(p => p.paye).length;
  const totalAttendu = totalMembres * Number(ex.montant);
  const totalEncaisse = nbPayes * Number(ex.montant);

  return {
    exceptionnelle: ex,
    totalMembres,
    nbPayes,
    nbNonPayes: totalMembres - nbPayes,
    totalAttendu,
    totalEncaisse,
    resteAPercevoir: totalAttendu - totalEncaisse
  };
}

function afficherRapportExceptionnelle(exceptionnelleId) {
  const zone = document.getElementById("rapportExceptionnelle");
  if (!zone) return;

  const d = genererDonneesRapportExceptionnelle(exceptionnelleId);
  if (!d) { zone.innerHTML = ""; return; }

  zone.innerHTML = `
    <p class="rapport-totaux">
      ${d.nbPayes} / ${d.totalMembres} membres ont payé —
      Total attendu : ${d.totalAttendu.toLocaleString()} FCFA —
      Total encaissé : ${d.totalEncaisse.toLocaleString()} FCFA —
      Reste à percevoir : ${d.resteAPercevoir.toLocaleString()} FCFA
    </p>`;
}

function exporterRapportExceptionnelleCSV(exceptionnelleId) {
  const ex = obtenirExceptionnelle(exceptionnelleId);
  if (!ex) return;

  let csv = "\uFEFF";
  csv += `Cotisation exceptionnelle - ${ex.libelle} (${ex.montant} FCFA par membre)\n\n`;
  csv += "Matricule;Nom;Statut;Date paiement\n";

  membres.forEach(m => {
    const statut = ex.paiements[m.id];
    const datePaiement = statut && statut.datePaiement
      ? new Date(statut.datePaiement).toLocaleDateString("fr-FR")
      : "";
    csv += `${m.matricule};${m.nom};${statut && statut.paye ? "Paye" : "Non paye"};${datePaiement}\n`;
  });

  if (typeof telechargerCSV === "function") {
    telechargerCSV(csv, `cotisation_${ex.id}.csv`);
  }
}

function exporterRapportExceptionnellePDF(exceptionnelleId) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("La bibliothèque jsPDF n'est pas chargée (vérifiez votre connexion internet).");
    return;
  }

  const ex = obtenirExceptionnelle(exceptionnelleId);
  const d = genererDonneesRapportExceptionnelle(exceptionnelleId);
  if (!ex || !d) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text(NOM_ASSOCIATION_LONG, 14, 15);
  doc.setFontSize(11);
  doc.text(`Cotisation exceptionnelle — ${ex.libelle}`, 14, 23);

  const corps = membres.map(m => {
    const statut = ex.paiements[m.id];
    return [m.matricule, m.nom, statut && statut.paye ? "Payé" : "Non payé"];
  });

  let y = 30;

  if (typeof doc.autoTable === "function") {
    doc.autoTable({ startY: y, head: [["Matricule", "Nom", "Statut"]], body: corps });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    corps.forEach(ligne => { doc.text(ligne.join("   —   "), 14, y); y += 7; });
    y += 10;
  }

  doc.setFontSize(11);
  doc.text(`Total attendu : ${d.totalAttendu.toLocaleString()} FCFA`, 14, y); y += 7;
  doc.text(`Total encaissé : ${d.totalEncaisse.toLocaleString()} FCFA`, 14, y); y += 7;
  doc.text(`Reste à percevoir : ${d.resteAPercevoir.toLocaleString()} FCFA`, 14, y);

  doc.save(`rapport_cotisation_${ex.id}.pdf`);
}

function initExceptionnelles() {
  afficherListeExceptionnelles();
}
