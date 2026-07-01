/* =====================================================
   ADCAM — js/recus.js
   Rôle : génération des reçus PDF (jsPDF), pour les
   cotisations mensuelles et les cotisations exceptionnelles.
   ===================================================== */

// Fonction interne partagée : construit et télécharge le PDF.
function genererPDFRecu({ numeroPrefixe, nomMembre, matricule, objet, montant }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const date = new Date();
  const noRecu = `${numeroPrefixe}-${date.getFullYear()}-${String(Date.now()).slice(-6)}`;

  doc.setFontSize(16);
  doc.text(NOM_ASSOCIATION_LONG, 20, 20);

  doc.setFontSize(12);
  doc.text(`REÇU N° ${noRecu}`, 20, 35);
  doc.text(`Reçu de : ${nomMembre}`, 20, 50);
  doc.text(`Matricule : ${matricule}`, 20, 60);
  doc.text(`Objet : ${objet}`, 20, 70);
  doc.text(`Montant : ${Number(montant).toLocaleString()} FCFA`, 20, 80);
  doc.text(`Date : ${date.toLocaleDateString("fr-FR")}`, 20, 90);
  doc.text("Signature : ____________________", 20, 110);

  doc.save(`${noRecu}_${matricule}.pdf`);
}

// Reçu pour une cotisation MENSUELLE. Si aucun montant n'est précisé,
// le total cumulé payé par le membre est utilisé.
function genererRecuPDF(membreId, montant = null, objet = "Cotisation mensuelle") {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("La bibliothèque jsPDF n'est pas chargée (vérifiez votre connexion internet).");
    return;
  }

  const membre = obtenirMembre(membreId);
  if (!membre) {
    alert("Membre introuvable.");
    return;
  }

  const montantRecu = montant !== null ? Number(montant) : Number(membre.totalPaye || 0);

  genererPDFRecu({
    numeroPrefixe: "REC",
    nomMembre: membre.nom,
    matricule: membre.matricule,
    objet,
    montant: montantRecu
  });
}

// Reçu pour une cotisation EXCEPTIONNELLE précise.
function genererRecuExceptionnelPDF(exceptionnelleId, membreId) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("La bibliothèque jsPDF n'est pas chargée (vérifiez votre connexion internet).");
    return;
  }

  const exceptionnelle = obtenirExceptionnelle(exceptionnelleId);
  const membre = obtenirMembre(membreId);
  if (!exceptionnelle || !membre) {
    alert("Membre ou cotisation introuvable.");
    return;
  }

  genererPDFRecu({
    numeroPrefixe: "REC-EX",
    nomMembre: membre.nom,
    matricule: membre.matricule,
    objet: exceptionnelle.libelle,
    montant: exceptionnelle.montant
  });
}
