/* =====================================================
   ADCAM — js/dashboard.js
   Rôle : calculs et affichage du tableau de bord global
   (mensuel + exceptionnel réunis).
   ===================================================== */

function calculerTotalAttendu() {
  let total = 0;

  membres.forEach(m => {
    total += moisDepuisAdhesion(m).length * COTISATION_MENSUELLE;
  });

  if (typeof exceptionnelles !== "undefined") {
    exceptionnelles.forEach(ex => {
      total += Object.keys(ex.paiements).length * Number(ex.montant);
    });
  }

  return total;
}

function calculerTotalEncaisse() {
  const totalMensuel = membres.reduce((s, m) => s + Number(m.totalPaye || 0), 0);
  const totalExceptionnel = typeof calculerTotalExceptionnellesEncaisse === "function"
    ? calculerTotalExceptionnellesEncaisse()
    : 0;
  return totalMensuel + totalExceptionnel;
}

function calculerTotalArriere() {
  return membres.reduce((s, m) => s + calculerArriereTotal(m.id), 0);
}

function calculerNombreDebiteurs() {
  return membres.filter(m => calculerArriereTotal(m.id) > 0).length;
}

function mettreAJourDashboard() {
  const elNbMembres = document.getElementById("nbMembres");
  const elTotalAttendu = document.getElementById("totalAttendu");
  const elTotalEncaisse = document.getElementById("totalEncaisse");
  const elTotalArriere = document.getElementById("totalArriere");
  const elNbDebiteurs = document.getElementById("nbDebiteurs");

  if (elNbMembres) elNbMembres.innerText = membres.length;
  if (elTotalAttendu) elTotalAttendu.innerText = `${calculerTotalAttendu().toLocaleString()} FCFA`;
  if (elTotalEncaisse) elTotalEncaisse.innerText = `${calculerTotalEncaisse().toLocaleString()} FCFA`;
  if (elTotalArriere) elTotalArriere.innerText = `${calculerTotalArriere().toLocaleString()} FCFA`;
  if (elNbDebiteurs) elNbDebiteurs.innerText = calculerNombreDebiteurs();
}
