/* =====================================================
   ADCAM — js/app.js
   Rôle : point d'entrée de la page principale.
   1) Vérifie la connexion (sinon redirige vers login.html)
   2) Charge toutes les données depuis Supabase
   3) Affiche tout, relie les formulaires
   4) Se synchronise en temps réel avec les autres utilisateurs
   ===================================================== */

let profilActuel = null;

document.addEventListener("DOMContentLoaded", async function () {
  // 1) Garde de connexion
  profilActuel = await exigerConnexion();
  if (!profilActuel) return; // déjà redirigé vers login.html

  afficherInfosUtilisateur(profilActuel);
  appliquerRestrictionsRole(profilActuel.role);

  // 2) Chargement des données (en parallèle, ce sont des lectures indépendantes)
  await Promise.all([
    chargerParametres(),
    chargerMembres(),
    chargerHistorique(),
    chargerExceptionnelles(),
    chargerEntreesFinancieres(),
    chargerDepenses()
  ]);

  // 3) Affichage initial
  afficherMembres();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
  if (typeof initExceptionnelles === "function") initExceptionnelles();
  if (typeof afficherHistorique === "function") afficherHistorique();
  if (typeof afficherListeEntrees === "function") afficherListeEntrees();
  if (typeof afficherListeDepenses === "function") afficherListeDepenses();

  if (typeof populerSelectsRapports === "function") {
    populerSelectsRapports();

    const selectMois = document.getElementById("selectRapportMois");
    if (selectMois && selectMois.value) afficherRapportMensuel(selectMois.value);

    const selectMembre = document.getElementById("selectRapportMembre");
    if (selectMembre && selectMembre.value) afficherRapportMembre(Number(selectMembre.value));
  }

  // Formulaire d'ajout de membre
  const formMembre = document.getElementById("formMembre");
  if (formMembre) {
    formMembre.addEventListener("submit", function (e) {
      e.preventDefault();
      ajouterMembre();
    });
  }

  // Formulaire de création de cotisation exceptionnelle
  const formExceptionnelle = document.getElementById("formExceptionnelle");
  if (formExceptionnelle) {
    formExceptionnelle.addEventListener("submit", async function (e) {
      e.preventDefault();

      const libelleInput = document.getElementById("libelleException");
      const montantInput = document.getElementById("montantException");

      const nouvelle = await ajouterCotisationExceptionnelle(libelleInput.value, montantInput.value);

      if (nouvelle) {
        libelleInput.value = "";
        montantInput.value = "";
      }
    });
  }

  // Formulaire d'ajout d'une entrée financière diverse (don, legs...)
  const formEntree = document.getElementById("formEntree");
  if (formEntree) {
    formEntree.addEventListener("submit", async function (e) {
      e.preventDefault();

      const libelleInput = document.getElementById("libelleEntree");
      const categorieInput = document.getElementById("categorieEntree");
      const montantInput = document.getElementById("montantEntree");
      const dateInput = document.getElementById("dateEntree");

      const nouvelle = await ajouterEntreeFinanciere(
        libelleInput.value, categorieInput.value, montantInput.value, dateInput.value
      );

      if (nouvelle) {
        libelleInput.value = "";
        montantInput.value = "";
        dateInput.value = "";
      }
    });
  }

  // Formulaire d'ajout d'une dépense (avec pièce jointe optionnelle)
  const formDepense = document.getElementById("formDepense");
  if (formDepense) {
    formDepense.addEventListener("submit", async function (e) {
      e.preventDefault();

      const objetInput = document.getElementById("objetDepense");
      const montantInput = document.getElementById("montantDepense");
      const dateInput = document.getElementById("dateDepense");
      const fichierInput = document.getElementById("recuDepense");

      await ajouterDepense(objetInput.value, montantInput.value, dateInput.value, fichierInput);

      objetInput.value = "";
      montantInput.value = "";
      dateInput.value = "";
      fichierInput.value = "";
    });
  }

  // Mise à jour automatique des rapports quand on change la sélection
  const selectRapportMois = document.getElementById("selectRapportMois");
  if (selectRapportMois) {
    selectRapportMois.addEventListener("change", function () {
      afficherRapportMensuel(this.value);
    });
  }

  const selectRapportMembre = document.getElementById("selectRapportMembre");
  if (selectRapportMembre) {
    selectRapportMembre.addEventListener("change", function () {
      afficherRapportMembre(Number(this.value));
    });
  }

  // 4) Synchronisation en temps réel avec les autres utilisateurs/fenêtres
  configurerSynchronisationTempsReel();
});

function afficherInfosUtilisateur(profil) {
  const nomsRoles = { president: "Président", tresorier: "Trésorier", secretaire: "Secrétaire" };

  const elNom = document.getElementById("nomUtilisateurConnecte");
  const elRole = document.getElementById("roleUtilisateurConnecte");

  if (elNom) elNom.textContent = profil.nom_complet;
  if (elRole) elRole.textContent = nomsRoles[profil.role] || profil.role;
}

// Cache les sections marquées data-roles="..." qui ne concernent pas le
// rôle de la personne connectée. Les LISTES restent visibles à tous
// (tout le monde peut consulter) ; seuls les FORMULAIRES de création
// sont concernés ici, pour rester simple. La sécurité réelle est de
// toute façon assurée par Supabase (RLS), pas par ce masquage visuel.
function appliquerRestrictionsRole(role) {
  document.querySelectorAll("[data-roles]").forEach(el => {
    const rolesAutorises = el.dataset.roles.split(",").map(r => r.trim());
    if (!rolesAutorises.includes(role)) {
      el.style.display = "none";
    }
  });
}

// Quand un autre utilisateur (ou une autre fenêtre, ex. exceptionnelle.html)
// modifie une donnée, on recharge juste la ressource concernée et on
// rafraîchit l'affichage — au lieu de chacun devoir rafraîchir sa page.
function configurerSynchronisationTempsReel() {
  supabase
    .channel("adcam-membres")
    .on("postgres_changes", { event: "*", schema: "public", table: "membres" }, async () => {
      await chargerMembres();
      afficherMembres();
      if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
      if (typeof populerSelectsRapports === "function") populerSelectsRapports();
    })
    .subscribe();

  supabase
    .channel("adcam-cotisations-mensuelles")
    .on("postgres_changes", { event: "*", schema: "public", table: "cotisations_mensuelles" }, async () => {
      await chargerMembres();
      afficherMembres();
      if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
    })
    .subscribe();

  supabase
    .channel("adcam-exceptionnelles")
    .on("postgres_changes", { event: "*", schema: "public", table: "cotisations_exceptionnelles" }, async () => {
      await chargerExceptionnelles();
      if (typeof afficherListeExceptionnelles === "function") afficherListeExceptionnelles();
      if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
    })
    .subscribe();

  supabase
    .channel("adcam-paiements-exceptionnels")
    .on("postgres_changes", { event: "*", schema: "public", table: "paiements_exceptionnels" }, async () => {
      await chargerExceptionnelles();
      if (typeof afficherListeExceptionnelles === "function") afficherListeExceptionnelles();
      if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
    })
    .subscribe();

  supabase
    .channel("adcam-historique")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "historique" }, async () => {
      await chargerHistorique();
      if (typeof afficherHistorique === "function") afficherHistorique();
    })
    .subscribe();

  supabase
    .channel("adcam-entrees")
    .on("postgres_changes", { event: "*", schema: "public", table: "entrees_financieres" }, async () => {
      await chargerEntreesFinancieres();
      if (typeof afficherListeEntrees === "function") afficherListeEntrees();
      if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
    })
    .subscribe();

  supabase
    .channel("adcam-depenses")
    .on("postgres_changes", { event: "*", schema: "public", table: "depenses" }, async () => {
      await chargerDepenses();
      if (typeof afficherListeDepenses === "function") afficherListeDepenses();
      if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
    })
    .subscribe();
}
