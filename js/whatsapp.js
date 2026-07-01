/* =====================================================
   ADCAM — js/whatsapp.js
   Rôle : relances via WhatsApp (lien wa.me préformaté).
   ===================================================== */

function nettoyerNumero(numero) {
  const phone = String(numero || "").replace(/\D/g, "");
  if (!phone) return "";
  return phone.startsWith("225") ? phone : `225${phone}`;
}

function ouvrirWhatsApp(numero, message) {
  const telephone = nettoyerNumero(numero);
  if (!telephone) {
    alert("Numéro de téléphone invalide.");
    return;
  }

  const url = `https://wa.me/${telephone}?text=${encodeURIComponent(message || "")}`;
  window.open(url, "_blank");
}

// Relance pour arriéré de cotisation MENSUELLE.
async function relancerMembre(id) {
  const membre = obtenirMembre(id);
  if (!membre) return;

  const arriere = calculerArriereMensuel(id);
  if (arriere <= 0) {
    alert(`${membre.nom} est à jour de ses cotisations mensuelles.`);
    return;
  }

  const maintenant = new Date().toISOString();

  const { error } = await supabase
    .from("membres")
    .update({ date_relance: maintenant })
    .eq("id", id);

  if (error) {
    console.error("Erreur lors de l'enregistrement de la date de relance :", error);
  } else {
    membre.dateRelance = maintenant;
  }

  const message =
    `Bonjour ${membre.nom},\n` +
    `Vous avez un arriéré de cotisation ${NOM_ASSOCIATION} de ${arriere.toLocaleString()} FCFA.\n` +
    `Merci d'effectuer votre dépôt Wave au numéro : ${NUMERO_WAVE}\n` +
    `Merci de régulariser votre situation.`;

  ouvrirWhatsApp(membre.telephone, message);

  await ajouterHistorique(membre.id, membre.nom, "Relance WhatsApp (mensuelle)", 0, "relance");
  afficherMembres();
}

// Relance pour une cotisation EXCEPTIONNELLE précise.
async function relancerCotisationExceptionnelle(exceptionnelleId, membreId) {
  const exceptionnelle = obtenirExceptionnelle(exceptionnelleId);
  const membre = obtenirMembre(membreId);
  if (!exceptionnelle || !membre) return;

  const message =
    `Bonjour ${membre.nom},\n` +
    `Vous êtes invité(e) à régler la cotisation exceptionnelle "${exceptionnelle.libelle}".\n` +
    `Montant : ${Number(exceptionnelle.montant).toLocaleString()} FCFA\n` +
    `Wave : ${NUMERO_WAVE}\n` +
    `Merci, ${NOM_ASSOCIATION}.`;

  ouvrirWhatsApp(membre.telephone, message);

  await ajouterHistorique(membre.id, membre.nom, `Relance WhatsApp : ${exceptionnelle.libelle}`, 0, "relance");
}
