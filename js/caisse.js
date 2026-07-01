/* =====================================================
   ADCAM — js/caisse.js
   Rôle : module financier complet de l'association.

   - Entrées financières diverses (dons, legs, subventions...)
   - Dépenses (avec pièce jointe optionnelle, stockée dans le coffre
     Supabase Storage "recus-depenses" — bien plus robuste que
     l'ancien stockage en base64 dans le LocalStorage)
   - Bilan pour une période choisie : liste de toutes les entrées
     (cotisations mensuelles + cotisations exceptionnelles +
     entrées diverses) et de toutes les dépenses, avec le solde net
     en caisse.
   ===================================================== */

let entreesFinancieres = [];
let depenses = [];

async function chargerEntreesFinancieres() {
  const { data, error } = await supabase
    .from("entrees_financieres")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  entreesFinancieres = (data || []).map(e => ({
    id: e.id,
    libelle: e.libelle,
    categorie: e.categorie,
    montant: Number(e.montant),
    date: e.date
  }));
}

async function chargerDepenses() {
  const { data, error } = await supabase
    .from("depenses")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  depenses = (data || []).map(d => ({
    id: d.id,
    objet: d.objet,
    montant: Number(d.montant),
    date: d.date,
    recuNomFichier: d.recu_nom_fichier,
    recuUrl: d.recu_url // chemin dans le coffre de stockage (pas une URL publique)
  }));
}

/* ---------- ENTRÉES FINANCIÈRES DIVERSES (dons, legs, etc.) ---------- */

async function ajouterEntreeFinanciere(libelleSaisi, categorie, montantSaisi, date) {
  const libelle = String(libelleSaisi || "").trim();
  const montant = Number(montantSaisi);

  if (!libelle || !montant || montant <= 0 || !date) {
    alert("Veuillez renseigner le libellé, le montant et la date de l'entrée.");
    return null;
  }

  const { data, error } = await supabase
    .from("entrees_financieres")
    .insert({ libelle, categorie: categorie || "Don", montant, date })
    .select()
    .single();

  if (error) {
    alert("Erreur lors de l'enregistrement de l'entrée : " + error.message);
    return null;
  }

  const entree = {
    id: data.id,
    libelle: data.libelle,
    categorie: data.categorie,
    montant: Number(data.montant),
    date: data.date
  };

  entreesFinancieres.push(entree);

  afficherListeEntrees();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();

  return entree;
}

async function supprimerEntreeFinanciere(id) {
  if (!confirm("Supprimer cette entrée financière ?")) return;

  const { error } = await supabase.from("entrees_financieres").delete().eq("id", id);
  if (error) {
    alert("Erreur lors de la suppression : " + error.message);
    return;
  }

  entreesFinancieres = entreesFinancieres.filter(e => e.id !== id);

  afficherListeEntrees();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
}

function afficherListeEntrees() {
  const tbody = document.getElementById("listeEntrees");
  if (!tbody) return;

  tbody.innerHTML = "";

  const tri = [...entreesFinancieres].sort((a, b) => b.date.localeCompare(a.date));

  tri.forEach(e => {
    tbody.innerHTML += `
      <tr>
        <td>${new Date(e.date).toLocaleDateString("fr-FR")}</td>
        <td>${e.libelle}</td>
        <td>${e.categorie}</td>
        <td>${Number(e.montant).toLocaleString()} FCFA</td>
        <td><button class="btn-supprimer" onclick="supprimerEntreeFinanciere(${e.id})">Supprimer</button></td>
      </tr>`;
  });
}

/* ---------- DÉPENSES (avec pièce jointe optionnelle) ---------- */

const TAILLE_MAX_PIECE_JOINTE = 5 * 1024 * 1024; // 5 Mo

async function ajouterDepense(objetSaisi, montantSaisi, date, fichierInput) {
  const objet = String(objetSaisi || "").trim();
  const montant = Number(montantSaisi);

  if (!objet || !montant || montant <= 0 || !date) {
    alert("Veuillez renseigner l'objet, le montant et la date de la dépense.");
    return;
  }

  const fichier = fichierInput && fichierInput.files && fichierInput.files[0];

  let recuNomFichier = null;
  let recuChemin = null;

  if (fichier) {
    if (fichier.size > TAILLE_MAX_PIECE_JOINTE) {
      alert("Le fichier joint dépasse 5 Mo : la dépense sera enregistrée sans pièce jointe.");
    } else {
      const chemin = `${Date.now()}_${fichier.name}`;
      const { error: erreurUpload } = await supabase.storage
        .from("recus-depenses")
        .upload(chemin, fichier);

      if (erreurUpload) {
        alert(
          "Erreur lors de l'envoi du reçu : " + erreurUpload.message +
          " (la dépense sera enregistrée sans pièce jointe)."
        );
      } else {
        recuNomFichier = fichier.name;
        recuChemin = chemin;
      }
    }
  }

  const { data, error } = await supabase
    .from("depenses")
    .insert({
      objet,
      montant,
      date,
      recu_nom_fichier: recuNomFichier,
      recu_url: recuChemin
    })
    .select()
    .single();

  if (error) {
    alert("Erreur lors de l'enregistrement de la dépense : " + error.message);
    return;
  }

  depenses.push({
    id: data.id,
    objet: data.objet,
    montant: Number(data.montant),
    date: data.date,
    recuNomFichier: data.recu_nom_fichier,
    recuUrl: data.recu_url
  });

  afficherListeDepenses();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
}

async function supprimerDepense(id) {
  if (!confirm("Supprimer cette dépense ?")) return;

  const depense = depenses.find(d => d.id === id);

  const { error } = await supabase.from("depenses").delete().eq("id", id);
  if (error) {
    alert("Erreur lors de la suppression : " + error.message);
    return;
  }

  if (depense && depense.recuUrl) {
    await supabase.storage.from("recus-depenses").remove([depense.recuUrl]);
  }

  depenses = depenses.filter(d => d.id !== id);

  afficherListeDepenses();
  if (typeof mettreAJourDashboard === "function") mettreAJourDashboard();
}

// Le coffre "recus-depenses" est privé : on génère un lien temporaire
// (valide 60 secondes) seulement au moment où on veut consulter le reçu,
// plutôt que de générer un lien pour chaque ligne du tableau.
async function voirRecuDepense(chemin) {
  const { data, error } = await supabase.storage
    .from("recus-depenses")
    .createSignedUrl(chemin, 60);

  if (error) {
    alert("Impossible d'ouvrir le reçu : " + error.message);
    return;
  }

  window.open(data.signedUrl, "_blank");
}

function afficherListeDepenses() {
  const tbody = document.getElementById("listeDepenses");
  if (!tbody) return;

  tbody.innerHTML = "";

  const tri = [...depenses].sort((a, b) => b.date.localeCompare(a.date));

  tri.forEach(d => {
    const boutonRecu = d.recuUrl
      ? `<button class="btn-recu btn-mini" onclick="voirRecuDepense('${d.recuUrl}')">Voir</button>`
      : "—";

    tbody.innerHTML += `
      <tr>
        <td>${new Date(d.date).toLocaleDateString("fr-FR")}</td>
        <td>${d.objet}</td>
        <td>${Number(d.montant).toLocaleString()} FCFA</td>
        <td>${boutonRecu}</td>
        <td><button class="btn-supprimer" onclick="supprimerDepense(${d.id})">Supprimer</button></td>
      </tr>`;
  });
}

/* ---------- BILAN FINANCIER (CAISSE) PAR PÉRIODE ---------- */

// Comparaison sur une date ISO complète (historique), bornes au format "YYYY-MM-DD".
function dansLaPeriode(dateISOStr, dateDebut, dateFin) {
  if (!dateISOStr) return false;
  const d = new Date(dateISOStr);
  if (dateDebut && d < new Date(`${dateDebut}T00:00:00`)) return false;
  if (dateFin && d > new Date(`${dateFin}T23:59:59`)) return false;
  return true;
}

// Comparaison sur une simple date "YYYY-MM-DD" (entrées diverses, dépenses).
function dansLaPeriodeSimple(dateStr, dateDebut, dateFin) {
  if (!dateStr) return false;
  if (dateDebut && dateStr < dateDebut) return false;
  if (dateFin && dateStr > dateFin) return false;
  return true;
}

const CATEGORIES_COTISATIONS_HISTORIQUE = [
  "cotisation_mensuelle",
  "annulation_mensuelle",
  "cotisation_exceptionnelle",
  "annulation_exceptionnelle"
];

function genererDonneesBilan(dateDebut, dateFin) {
  // Entrées issues des cotisations (mensuelles + exceptionnelles), avec
  // leurs éventuelles annulations qui viennent réduire le total.
  const mouvementsCotisations = (typeof historique !== "undefined" ? historique : [])
    .filter(h => CATEGORIES_COTISATIONS_HISTORIQUE.includes(h.categorie))
    .filter(h => dansLaPeriode(h.dateISO, dateDebut, dateFin))
    .map(h => ({
      date: h.dateISO ? h.dateISO.slice(0, 10) : "",
      libelle: h.nature + (h.membreNom ? ` — ${h.membreNom}` : ""),
      montant: Number(h.montant)
    }));

  // Entrées diverses (dons, legs, subventions...)
  const mouvementsEntreesDiverses = entreesFinancieres
    .filter(e => dansLaPeriodeSimple(e.date, dateDebut, dateFin))
    .map(e => ({
      date: e.date,
      libelle: `${e.categorie} — ${e.libelle}`,
      montant: Number(e.montant)
    }));

  const entrees = [...mouvementsCotisations, ...mouvementsEntreesDiverses]
    .sort((a, b) => a.date.localeCompare(b.date));

  // Dépenses
  const sorties = depenses
    .filter(d => dansLaPeriodeSimple(d.date, dateDebut, dateFin))
    .map(d => ({
      date: d.date,
      libelle: d.objet,
      montant: Number(d.montant)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalEntrees = entrees.reduce((s, e) => s + e.montant, 0);
  const totalSorties = sorties.reduce((s, d) => s + d.montant, 0);

  return {
    entrees,
    sorties,
    totalEntrees,
    totalSorties,
    soldeNet: totalEntrees - totalSorties
  };
}

function afficherBilan(dateDebut, dateFin) {
  const zone = document.getElementById("zoneBilan");
  if (!zone) return;

  const d = genererDonneesBilan(dateDebut, dateFin);

  const formaterLigne = item => `
    <tr>
      <td>${new Date(item.date).toLocaleDateString("fr-FR")}</td>
      <td>${item.libelle}</td>
      <td>${item.montant.toLocaleString()} FCFA</td>
    </tr>`;

  const lignesEntrees = d.entrees.map(formaterLigne).join("");
  const lignesSorties = d.sorties.map(formaterLigne).join("");

  zone.innerHTML = `
    <h4>Entrées (cotisations + dons/legs/autres)</h4>
    <table>
      <thead><tr><th>Date</th><th>Libellé</th><th>Montant</th></tr></thead>
      <tbody>${lignesEntrees || "<tr><td colspan='3'>Aucune entrée sur cette période.</td></tr>"}</tbody>
    </table>

    <h4>Dépenses</h4>
    <table>
      <thead><tr><th>Date</th><th>Objet</th><th>Montant</th></tr></thead>
      <tbody>${lignesSorties || "<tr><td colspan='3'>Aucune dépense sur cette période.</td></tr>"}</tbody>
    </table>

    <p class="rapport-totaux">
      Total entrées : ${d.totalEntrees.toLocaleString()} FCFA —
      Total dépenses : ${d.totalSorties.toLocaleString()} FCFA —
      Solde net (caisse) : ${d.soldeNet.toLocaleString()} FCFA
    </p>`;
}

function exporterBilanCSV(dateDebut, dateFin) {
  const d = genererDonneesBilan(dateDebut, dateFin);

  let csv = "\uFEFF";
  csv += `Bilan financier ADCAM du ${dateDebut || "..."} au ${dateFin || "..."}\n\n`;

  csv += "ENTREES\nDate;Libelle;Montant\n";
  d.entrees.forEach(e => { csv += `${e.date};${e.libelle};${e.montant}\n`; });

  csv += "\nDEPENSES\nDate;Objet;Montant\n";
  d.sorties.forEach(s => { csv += `${s.date};${s.libelle};${s.montant}\n`; });

  csv += `\nTotal entrees;${d.totalEntrees}\n`;
  csv += `Total depenses;${d.totalSorties}\n`;
  csv += `Solde net;${d.soldeNet}\n`;

  if (typeof telechargerCSV === "function") {
    telechargerCSV(csv, `bilan_${dateDebut || "debut"}_${dateFin || "fin"}.csv`);
  }
}

function exporterBilanPDF(dateDebut, dateFin) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("La bibliothèque jsPDF n'est pas chargée (vérifiez votre connexion internet).");
    return;
  }

  const d = genererDonneesBilan(dateDebut, dateFin);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text(NOM_ASSOCIATION_LONG, 14, 15);
  doc.setFontSize(11);
  doc.text(`Bilan financier du ${dateDebut || "début"} au ${dateFin || "aujourd'hui"}`, 14, 23);

  let y = 30;

  if (typeof doc.autoTable === "function") {
    doc.autoTable({
      startY: y,
      head: [["Date", "Libellé", "Montant"]],
      body: d.entrees.map(e => [new Date(e.date).toLocaleDateString("fr-FR"), e.libelle, `${e.montant.toLocaleString()} FCFA`]),
      headStyles: { fillColor: [40, 167, 69] }
    });
    y = doc.lastAutoTable.finalY + 10;

    doc.autoTable({
      startY: y,
      head: [["Date", "Objet", "Montant"]],
      body: d.sorties.map(s => [new Date(s.date).toLocaleDateString("fr-FR"), s.libelle, `${s.montant.toLocaleString()} FCFA`]),
      headStyles: { fillColor: [220, 53, 69] }
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    d.entrees.forEach(e => { doc.text(`${e.date} — ${e.libelle} — ${e.montant.toLocaleString()} FCFA`, 14, y); y += 7; });
    y += 5;
    d.sorties.forEach(s => { doc.text(`${s.date} — ${s.libelle} — ${s.montant.toLocaleString()} FCFA`, 14, y); y += 7; });
    y += 10;
  }

  doc.setFontSize(11);
  doc.text(`Total entrées : ${d.totalEntrees.toLocaleString()} FCFA`, 14, y); y += 7;
  doc.text(`Total dépenses : ${d.totalSorties.toLocaleString()} FCFA`, 14, y); y += 7;
  doc.text(`Solde net (caisse) : ${d.soldeNet.toLocaleString()} FCFA`, 14, y);

  doc.save(`bilan_${dateDebut || "debut"}_${dateFin || "fin"}.pdf`);
}
