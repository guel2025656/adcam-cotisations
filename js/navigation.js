/* =====================================================
   ADCAM — js/navigation.js
   Rôle : faire fonctionner le menu latéral. Une seule "vue"
   (section de contenu) est visible à la fois ; cliquer sur
   un lien du menu affiche la vue correspondante et la
   surligne, sans recharger la page.
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {
  const liens = document.querySelectorAll(".sidebar-nav .lien-menu");
  const vues = document.querySelectorAll(".vue");
  const contenu = document.querySelector(".contenu-principal");

  function afficherVue(idVue) {
    vues.forEach(vue => {
      vue.classList.toggle("visible", vue.id === idVue);
    });

    liens.forEach(lien => {
      lien.classList.toggle("actif", lien.dataset.vue === idVue);
    });

    if (contenu) contenu.scrollTop = 0;
  }

  liens.forEach(lien => {
    lien.addEventListener("click", function (e) {
      e.preventDefault();
      afficherVue(this.dataset.vue);
    });
  });

  // Vue affichée par défaut à l'ouverture de l'application
  afficherVue("vue-tableau-de-bord");
});
