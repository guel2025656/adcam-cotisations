/* =====================================================
   ADCAM — js/supabase-client.js
   Rôle : point de connexion unique à Supabase (base de données
   partagée + authentification). Chargé en premier, avant tous
   les autres scripts.
   ===================================================== */

const SUPABASE_URL = "https://hdhhxmckirnlyxhhreub.supabase.co";

// Clé publique anonyme (JWT) — compatible avec @supabase/supabase-js@2 via CDN.
// Cette clé est publique par nature ; la sécurité réelle est assurée par les
// politiques RLS côté Supabase, pas par la confidentialité de cette clé.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkaGh4bWNraXJubHl4aGhyZXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTA4NDIsImV4cCI6MjA5ODIyNjg0Mn0.DstJduqqvI9cKnyoWpBj4lVJ-qvl_FfdWTx7kgWmkb4";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
