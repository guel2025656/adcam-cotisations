/* =====================================================
   ADCAM — js/auth.js
   Rôle : connexion, inscription, déconnexion, et garde d'accès
   (vérifie qu'un utilisateur est bien connecté et a un rôle
   reconnu avant de le laisser utiliser l'application).
   ===================================================== */

async function obtenirSessionActuelle() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Renvoie {id, nom_complet, role} de la personne connectée, ou null.
async function obtenirProfilActuel() {
  const session = await obtenirSessionActuelle();
  if (!session) return null;

  const { data, error } = await supabase
    .from("profils")
    .select("id, nom_complet, role")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error("Erreur de récupération du profil :", error);
    return null;
  }

  return data;
}

async function connecter(email, motDePasse) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: motDePasse
  });
  return error;
}

async function inscrire(email, motDePasse) {
  const { error } = await supabase.auth.signUp({
    email,
    password: motDePasse
  });
  return error;
}

async function seDeconnecter() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}

// Garde d'accès à appeler au chargement de toute page protégée
// (index.html, exceptionnelle.html). Redirige vers la connexion si
// nécessaire et renvoie le profil de l'utilisateur sinon.
async function exigerConnexion() {
  const session = await obtenirSessionActuelle();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  const profil = await obtenirProfilActuel();
  if (!profil) {
    alert("Votre compte n'a pas encore de rôle assigné. Contactez le président.");
    await supabase.auth.signOut();
    window.location.href = "login.html";
    return null;
  }

  return profil;
}

// Traduit les messages d'erreur techniques de Supabase Auth en français.
function traduireErreurAuth(erreur) {
  const message = (erreur && erreur.message) || "";

  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("not allowed") || message.includes("autorisé")) {
    return "Cet email n'est pas autorisé à créer un compte ADCAM. Contactez le président.";
  }
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "Un compte existe déjà avec cet email. Utilisez plutôt le formulaire de connexion.";
  }
  if (message.includes("Password should be at least")) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }

  return message || "Une erreur inconnue est survenue.";
}
