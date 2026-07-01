/* =====================================================
   ADCAM — js/sauvegarde.js
   Rôle : exporter une archive JSON de consultation de toutes
   les données actuelles (membres, historique, cotisations
   exceptionnelles, entrées, dépenses).

   Important : les données réelles vivent maintenant dans Supabase,
   une base PARTAGÉE entre Président, Trésorier et Secrétaire. Il
   n'y a donc plus de fonction "Restaurer" qui écraserait tout —
   ce serait trop risqué pour les autres utilisateurs. Cet export
   sert uniquement d'archive de consultation/impression.
   ===================================================== */

function exporterSauvegardeComplete() {
  const sauvegarde = {
    application: "ADCAM",
    dateExport: new Date().toISOString(),
    donnees: {
      membres,
      historique,
      cotisationsExceptionnelles: exceptionnelles,
      entreesFinancieres,
      depenses
    }
  };

  const contenu = JSON.stringify(sauvegarde, null, 2);
  const blob = new Blob([contenu], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const dateFichier = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adcam_archive_${dateFichier}.json`;
  a.click();

  URL.revokeObjectURL(url);
}
