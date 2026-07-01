/* =====================================================
   ADCAM — js/exceptionnelle-fenetre.js
   Rôle : initialisation de la fenêtre dédiée à UNE cotisation
   exceptionnelle (identifiée par ?id=... dans l'URL). Se connecte
   à la même base Supabase que la page principale et se synchronise
   en temps réel avec elle.
   ===================================================== */

document.addEventListener("DOMContentLoaded", async function () {
  // Garde de connexion (même mécanisme que la page principale)
  const profil = await exigerConnexion();
  if (!profil) return;

  const parametres = new URLSearchParams(window.location.search);
  const id = Number(parametres.get("id"));
  const titre = document.getElementById("titreExceptionnelle");

  await Promise.all([chargerParametres(), chargerMembres(), chargerExceptionnelles()]);

  const exceptionnelle = id ? obtenirExceptionnelle(id) : null;

  if (!exceptionnelle) {
    if (titre) titre.textContent = "Cotisation exceptionnelle introuvable.";
    return;
  }

  document.title = `ADCAM — ${exceptionnelle.libelle}`;
  if (titre) {
    titre.textContent = `${exceptionnelle.libelle} — ${Number(exceptionnelle.montant).toLocaleString()} FCFA / membre`;
  }

  afficherMembresExceptionnelle(id);
  if (typeof afficherRapportExceptionnelle === "function") afficherRapportExceptionnelle(id);

  const btnCSV = document.getElementById("btnExportCSV");
  if (btnCSV) btnCSV.addEventListener("click", () => exporterRapportExceptionnelleCSV(id));

  const btnPDF = document.getElementById("btnExportPDF");
  if (btnPDF) btnPDF.addEventListener("click", () => exporterRapportExceptionnellePDF(id));

  // Si quelqu'un d'autre (la page principale, ou une autre fenêtre) modifie
  // les membres ou cette cotisation exceptionnelle, on se resynchronise.
  supabase
    .channel(`exceptionnelle-${id}-membres`)
    .on("postgres_changes", { event: "*", schema: "public", table: "membres" }, async () => {
      await chargerMembres();
      afficherMembresExceptionnelle(id);
      if (typeof afficherRapportExceptionnelle === "function") afficherRapportExceptionnelle(id);
    })
    .subscribe();

  supabase
    .channel(`exceptionnelle-${id}-paiements`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "paiements_exceptionnels", filter: `exceptionnelle_id=eq.${id}` },
      async () => {
        await chargerExceptionnelles();
        afficherMembresExceptionnelle(id);
        if (typeof afficherRapportExceptionnelle === "function") afficherRapportExceptionnelle(id);
      }
    )
    .subscribe();
});
