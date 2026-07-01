/* =====================================================
   ADCAM — js/rapports.js
   Rôle : rapports "État des cotisations par mois" et
   "État des cotisations par membre", avec export CSV et PDF.
   ===================================================== */

const NOMS_MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

function formatMoisLisible(cle) {
  const [annee, mois] = cle.split("-").map(Number);
  return `${NOMS_MOIS[mois - 1]} ${annee}`;
}

// Liste tous les mois concernés par au moins un membre, du plus récent
// au plus ancien.
function listerMoisDisponibles() {
  const cles = new Set();
  membres.forEach(m => {
    moisDepuisAdhesion(m).forEach(cle => cles.add(cle));
  });
  return Array.from(cles).sort().reverse();
}

function telechargerCSV(contenu, nomFichier) {
  const blob = new Blob([contenu], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

// Remplit les deux menus déroulants (mois, membre) en conservant la
// sélection actuelle si elle existe encore.
function populerSelectsRapports() {
  const selectMois = document.getElementById("selectRapportMois");
  if (selectMois) {
    const valeurActuelle = selectMois.value;
    selectMois.innerHTML = "";
    listerMoisDisponibles().forEach(cle => {
      const option = document.createElement("option");
      option.value = cle;
      option.textContent = formatMoisLisible(cle);
      selectMois.appendChild(option);
    });
    if (Array.from(selectMois.options).some(o => o.value === valeurActuelle)) {
      selectMois.value = valeurActuelle;
    }
  }

  const selectMembre = document.getElementById("selectRapportMembre");
  if (selectMembre) {
    const valeurActuelle = selectMembre.value;
    selectMembre.innerHTML = "";
    membres.forEach(m => {
      const option = document.createElement("option");
      option.value = m.id;
      option.textContent = `${m.matricule} — ${m.nom}`;
      selectMembre.appendChild(option);
    });
    if (Array.from(selectMembre.options).some(o => o.value === valeurActuelle)) {
      selectMembre.value = valeurActuelle;
    }
  }
}

/* ---------- RAPPORT PAR MOIS ---------- */

function genererDonneesRapportMensuel(moisCle) {
  return membres
    .filter(m => moisDepuisAdhesion(m).includes(moisCle))
    .map(m => ({
      matricule: m.matricule,
      nom: m.nom,
      paye: !!(m.cotisationsMensuelles && m.cotisationsMensuelles[moisCle]),
      montant: COTISATION_MENSUELLE
    }));
}

function afficherRapportMensuel(moisCle) {
  const zone = document.getElementById("zoneRapportMensuel");
  if (!zone) return;
  if (!moisCle) { zone.innerHTML = ""; return; }

  const donnees = genererDonneesRapportMensuel(moisCle);
  const nbPaye = donnees.filter(d => d.paye).length;
  const totalAttendu = donnees.length * COTISATION_MENSUELLE;
  const totalEncaisse = nbPaye * COTISATION_MENSUELLE;

  const lignes = donnees.map(d => `
    <tr>
      <td>${d.matricule}</td>
      <td class="${d.paye ? "membre-paye" : "membre-debiteur"}">${d.nom}</td>
      <td>${d.paye ? "Payé" : "Non payé"}</td>
      <td>${d.montant.toLocaleString()} FCFA</td>
    </tr>`).join("");

  zone.innerHTML = `
    <table>
      <thead><tr><th>Matricule</th><th>Nom</th><th>Statut</th><th>Montant</th></tr></thead>
      <tbody>${lignes || "<tr><td colspan='4'>Aucun membre concerné pour ce mois.</td></tr>"}</tbody>
    </table>
    <p class="rapport-totaux">
      ${nbPaye} / ${donnees.length} membres à jour —
      Total attendu : ${totalAttendu.toLocaleString()} FCFA —
      Total encaissé : ${totalEncaisse.toLocaleString()} FCFA
    </p>`;
}

function exporterRapportMensuelCSV(moisCle) {
  if (!moisCle) { alert("Choisissez un mois."); return; }

  const donnees = genererDonneesRapportMensuel(moisCle);
  let csv = "\uFEFF";
  csv += `État des cotisations - ${formatMoisLisible(moisCle)}\n`;
  csv += "Matricule;Nom;Statut;Montant (FCFA)\n";
  donnees.forEach(d => {
    csv += `${d.matricule};${d.nom};${d.paye ? "Paye" : "Non paye"};${d.montant}\n`;
  });

  telechargerCSV(csv, `rapport_mensuel_${moisCle}.csv`);
}

function exporterRapportMensuelPDF(moisCle) {
  if (!moisCle) { alert("Choisissez un mois."); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("La bibliothèque jsPDF n'est pas chargée (vérifiez votre connexion internet).");
    return;
  }

  const donnees = genererDonneesRapportMensuel(moisCle);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text(NOM_ASSOCIATION_LONG, 14, 15);
  doc.setFontSize(11);
  doc.text(`État des cotisations — ${formatMoisLisible(moisCle)}`, 14, 23);

  const corps = donnees.map(d => [
    d.matricule, d.nom, d.paye ? "Payé" : "Non payé", `${d.montant.toLocaleString()} FCFA`
  ]);

  if (typeof doc.autoTable === "function") {
    doc.autoTable({ startY: 30, head: [["Matricule", "Nom", "Statut", "Montant"]], body: corps });
  } else {
    // Repli simple si le plugin autoTable n'a pas pu se charger
    let y = 35;
    corps.forEach(ligne => { doc.text(ligne.join("   —   "), 14, y); y += 7; });
  }

  doc.save(`rapport_mensuel_${moisCle}.pdf`);
}

/* ---------- RAPPORT PAR MEMBRE ---------- */

function genererDonneesRapportMembre(membreId) {
  const membre = obtenirMembre(membreId);
  if (!membre) return null;

  const detailMois = moisDepuisAdhesion(membre).map(cle => ({
    mois: cle,
    libelle: formatMoisLisible(cle),
    paye: !!(membre.cotisationsMensuelles && membre.cotisationsMensuelles[cle])
  }));

  const detailExceptionnelles = (typeof exceptionnelles !== "undefined" ? exceptionnelles : []).map(ex => {
    const statut = ex.paiements[membre.id];
    return {
      libelle: ex.libelle,
      montant: ex.montant,
      paye: !!(statut && statut.paye),
      datePaiement: statut ? statut.datePaiement : null
    };
  });

  return {
    membre,
    detailMois,
    detailExceptionnelles,
    arriereInitial: Number(membre.arriereInitial || 0),
    totalPaye: membre.totalPaye || 0,
    arriereMensuel: calculerArriereMensuel(membreId),
    arriereExceptionnel: calculerArriereExceptionnel(membreId),
    arriereTotal: calculerArriereTotal(membreId)
  };
}

function afficherRapportMembre(membreId) {
  const zone = document.getElementById("zoneRapportMembre");
  if (!zone) return;
  if (!membreId) { zone.innerHTML = ""; return; }

  const donnees = genererDonneesRapportMembre(membreId);
  if (!donnees) { zone.innerHTML = ""; return; }

  const lignesMois = donnees.detailMois.map(d => `
    <tr>
      <td>${d.libelle}</td>
      <td class="${d.paye ? "membre-paye" : "membre-debiteur"}">${d.paye ? "Payé" : "Non payé"}</td>
    </tr>`).join("");

  const lignesExceptionnelles = donnees.detailExceptionnelles.map(d => `
    <tr>
      <td>${d.libelle}</td>
      <td>${Number(d.montant).toLocaleString()} FCFA</td>
      <td class="${d.paye ? "membre-paye" : "membre-debiteur"}">${d.paye ? "Payé" : "Non payé"}</td>
    </tr>`).join("");

  zone.innerHTML = `
    <h4>${donnees.membre.matricule} — ${donnees.membre.nom}</h4>

    <h5>Cotisations mensuelles</h5>
    <table>
      <thead><tr><th>Mois</th><th>Statut</th></tr></thead>
      <tbody>${lignesMois || "<tr><td colspan='2'>Aucun mois dû.</td></tr>"}</tbody>
    </table>

    <h5>Cotisations exceptionnelles</h5>
    <table>
      <thead><tr><th>Libellé</th><th>Montant</th><th>Statut</th></tr></thead>
      <tbody>${lignesExceptionnelles || "<tr><td colspan='3'>Aucune cotisation exceptionnelle.</td></tr>"}</tbody>
    </table>

    <p class="rapport-totaux">
      Arriéré antérieur (avant l'application) : ${Number(donnees.arriereInitial).toLocaleString()} FCFA —
      Total payé (mensuel) : ${Number(donnees.totalPaye).toLocaleString()} FCFA<br>
      Arriéré mensuel total (antérieur + mois impayés) : ${Number(donnees.arriereMensuel).toLocaleString()} FCFA —
      Arriéré exceptionnel : ${Number(donnees.arriereExceptionnel).toLocaleString()} FCFA —
      Arriéré total : ${Number(donnees.arriereTotal).toLocaleString()} FCFA
    </p>`;
}

function exporterRapportMembreCSV(membreId) {
  const donnees = genererDonneesRapportMembre(membreId);
  if (!donnees) { alert("Choisissez un membre."); return; }

  let csv = "\uFEFF";
  csv += `Rapport - ${donnees.membre.matricule} - ${donnees.membre.nom}\n\n`;

  csv += "Cotisations mensuelles\nMois;Statut\n";
  donnees.detailMois.forEach(d => {
    csv += `${d.libelle};${d.paye ? "Paye" : "Non paye"}\n`;
  });

  csv += "\nCotisations exceptionnelles\nLibelle;Montant;Statut\n";
  donnees.detailExceptionnelles.forEach(d => {
    csv += `${d.libelle};${d.montant};${d.paye ? "Paye" : "Non paye"}\n`;
  });

  csv += `\nArriere anterieur (avant application);${donnees.arriereInitial}\n`;
  csv += `Total paye (mensuel);${donnees.totalPaye}\n`;
  csv += `Arriere total;${donnees.arriereTotal}\n`;

  telechargerCSV(csv, `rapport_${donnees.membre.matricule}.csv`);
}

function exporterRapportMembrePDF(membreId) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("La bibliothèque jsPDF n'est pas chargée (vérifiez votre connexion internet).");
    return;
  }

  const donnees = genererDonneesRapportMembre(membreId);
  if (!donnees) { alert("Choisissez un membre."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text(NOM_ASSOCIATION_LONG, 14, 15);
  doc.setFontSize(11);
  doc.text(`Rapport — ${donnees.membre.matricule} — ${donnees.membre.nom}`, 14, 23);

  let y = 30;

  if (typeof doc.autoTable === "function") {
    doc.autoTable({
      startY: y,
      head: [["Mois", "Statut"]],
      body: donnees.detailMois.map(d => [d.libelle, d.paye ? "Payé" : "Non payé"])
    });
    y = doc.lastAutoTable.finalY + 10;

    doc.autoTable({
      startY: y,
      head: [["Cotisation exceptionnelle", "Montant", "Statut"]],
      body: donnees.detailExceptionnelles.map(d => [
        d.libelle, `${Number(d.montant).toLocaleString()} FCFA`, d.paye ? "Payé" : "Non payé"
      ])
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    // Repli simple si le plugin autoTable n'a pas pu se charger
    donnees.detailMois.forEach(d => {
      doc.text(`${d.libelle} — ${d.paye ? "Payé" : "Non payé"}`, 14, y);
      y += 7;
    });
    y += 5;
    donnees.detailExceptionnelles.forEach(d => {
      doc.text(`${d.libelle} (${Number(d.montant).toLocaleString()} FCFA) — ${d.paye ? "Payé" : "Non payé"}`, 14, y);
      y += 7;
    });
    y += 10;
  }

  doc.setFontSize(11);
  doc.text(`Arriéré antérieur (avant l'application) : ${Number(donnees.arriereInitial).toLocaleString()} FCFA`, 14, y);
  y += 7;
  doc.text(`Total payé (mensuel) : ${Number(donnees.totalPaye).toLocaleString()} FCFA`, 14, y);
  y += 7;
  doc.text(`Arriéré total : ${Number(donnees.arriereTotal).toLocaleString()} FCFA`, 14, y);

  doc.save(`rapport_${donnees.membre.matricule}.pdf`);
}
