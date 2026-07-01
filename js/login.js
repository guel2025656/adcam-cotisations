/* =====================================================
   ADCAM — js/login.js
   Rôle : gère les formulaires de connexion et d'inscription
   de la page login.html.
   ===================================================== */

document.addEventListener("DOMContentLoaded", async function () {
  // Si déjà connecté, on va directement à l'application
  const session = await obtenirSessionActuelle();
  if (session) {
    window.location.href = "index.html";
    return;
  }

  const zoneMessage = document.getElementById("zoneMessage");

  function afficherMessage(texte, type) {
    zoneMessage.textContent = texte;
    zoneMessage.className = `message-connexion ${type}`;
  }

  document.getElementById("formConnexion").addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("emailConnexion").value.trim();
    const motDePasse = document.getElementById("motDePasseConnexion").value;

    const erreur = await connecter(email, motDePasse);
    if (erreur) {
      afficherMessage("Connexion impossible : " + traduireErreurAuth(erreur), "erreur");
      return;
    }

    window.location.href = "index.html";
  });

  document.getElementById("formInscription").addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("emailInscription").value.trim();
    const motDePasse = document.getElementById("motDePasseInscription").value;
    const confirmation = document.getElementById("confirmationInscription").value;

    if (motDePasse !== confirmation) {
      afficherMessage("Les mots de passe ne correspondent pas.", "erreur");
      return;
    }

    const erreur = await inscrire(email, motDePasse);
    if (erreur) {
      afficherMessage("Inscription impossible : " + traduireErreurAuth(erreur), "erreur");
      return;
    }

    afficherMessage(
      "Compte créé avec succès ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous ci-dessus.",
      "succes"
    );
    document.getElementById("formInscription").reset();
  });
});
