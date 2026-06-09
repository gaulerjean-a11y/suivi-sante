/* =============================================
   VITALIS — Health & Fitness App
   JavaScript — Full Application Logic
   ============================================= */

'use strict';

// ============================================================
// SUPABASE CONFIG & AUTH
// ============================================================

const SUPABASE_URL = 'https://lliyxsrklbzvlpgnjcoi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_v3xQi958Oj4g2gHWXRBmgg_9Tk822ky';
const _supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let _currentUser = null;

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'signup'));
  });
  document.getElementById('auth-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('auth-signup').classList.toggle('hidden', tab !== 'signup');
}

function showAuthError(formId, msg) {
  const el = document.getElementById(formId + '-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setAuthLoading(loading) {
  document.getElementById('auth-loading').classList.toggle('hidden', !loading);
  document.querySelectorAll('#auth-screen button').forEach(b => b.disabled = loading);
}

async function authLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  document.getElementById('login-error').classList.add('hidden');
  if (!email || !password) return showAuthError('login', 'Remplis tous les champs');
  setAuthLoading(true);
  const { error } = await _supa.auth.signInWithPassword({ email, password });
  setAuthLoading(false);
  if (error) showAuthError('login', error.message);
}

async function authSignup() {
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  document.getElementById('signup-error').classList.add('hidden');
  if (!email || !password) return showAuthError('signup', 'Remplis tous les champs');
  if (password.length < 6) return showAuthError('signup', 'Mot de passe trop court (6 caractères min)');
  setAuthLoading(true);
  const { error } = await _supa.auth.signUp({ email, password });
  setAuthLoading(false);
  if (error) showAuthError('signup', error.message);
  else { switchAuthTab('login'); showAuthError('login', '✅ Compte créé ! Connecte-toi maintenant.'); }
}

async function authLogout() {
  await _supa.auth.signOut();
  _currentUser = null;
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('onboarding').classList.add('hidden');
}

async function saveDataCloud(data) {
  if (!_currentUser) return;
  try {
    await _supa.from('user_data').upsert({
      user_id: _currentUser.id,
      data: data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } catch(e) { console.warn('Cloud save failed:', e); }
}

async function loadDataCloud() {
  if (!_currentUser) return null;
  try {
    const { data, error } = await _supa.from('user_data')
      .select('data')
      .eq('user_id', _currentUser.id)
      .single();
    if (error || !data) return null;
    return data.data;
  } catch(e) { return null; }
}

function bootAuth() {
  // Vérifie d'abord si une session existe déjà (évite l'écran de login à chaque ouverture)
  _supa.auth.getSession().then(async ({ data: { session } }) => {
    if (session && session.user) {
      _currentUser = session.user;
      document.getElementById('auth-screen').classList.add('hidden');
      const cloudData = await loadDataCloud();
      if (cloudData) {
        const localRaw = localStorage.getItem('vitalis_v3');
        let localData = null;
        try { localData = localRaw ? JSON.parse(localRaw) : null; } catch(e) {}
        const cloudTs = cloudData._savedAt || 0;
        const localTs = localData?._savedAt || 0;
        if (!localData || cloudTs >= localTs) {
          localStorage.setItem('vitalis_v3', JSON.stringify(cloudData));
          // Restaurer la clé API depuis le cloud
          if (cloudData._apiKey) localStorage.setItem('vitalis_ai_key', cloudData._apiKey);
        } else {
          saveDataCloud(localData);
        }
      }
      initApp();
    }
  });

  _supa.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      _currentUser = session.user;
      document.getElementById('auth-screen').classList.add('hidden');

      // Toujours charger depuis le cloud en priorité
      const cloudData = await loadDataCloud();
      if (cloudData) {
        // Fusionner : garder la version la plus récente
        const localRaw = localStorage.getItem('vitalis_v3');
        let localData = null;
        try { localData = localRaw ? JSON.parse(localRaw) : null; } catch(e) {}

        const cloudTs = cloudData._savedAt || 0;
        const localTs = localData?._savedAt || 0;

        // Si cloud plus récent ou pas de données locales → utilise cloud
        if (!localData || cloudTs >= localTs) {
          localStorage.setItem('vitalis_v3', JSON.stringify(cloudData));
          // Restaurer la clé API depuis le cloud
          if (cloudData._apiKey) localStorage.setItem('vitalis_ai_key', cloudData._apiKey);
        } else {
          // Local plus récent → upload local vers cloud
          saveDataCloud(localData);
        }
      }

      initApp();
    } else {
      _currentUser = null;
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('app').classList.add('hidden');
      document.getElementById('onboarding').classList.add('hidden');
    }
  });

  // Resync depuis cloud quand l'app reprend le focus
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && _currentUser) {
      const cloudData = await loadDataCloud();
      if (cloudData) {
        const localRaw = localStorage.getItem('vitalis_v3');
        let localData = null;
        try { localData = localRaw ? JSON.parse(localRaw) : null; } catch(e) {}
        const cloudTs = cloudData._savedAt || 0;
        const localTs = localData?._savedAt || 0;
        if (!localData || cloudTs > localTs) {
          localStorage.setItem('vitalis_v3', JSON.stringify(cloudData));
          // Rafraîchir l'affichage silencieusement
          try { renderDashboard(); renderFoodSection(); renderActivitySection(); } catch(e) {}
        }
      }
    }
  });
}

// ============================================================
// CONSTANTS & CONFIG
// ============================================================

const STORAGE_KEY = 'vitalis_v3';
const TODAY = () => new Date().toISOString().split('T')[0];

const MOTIVATIONAL_QUOTES = [
  "Chaque pas compte. Continuez ! 💪",
  "Votre corps peut tout. C'est votre esprit qu'il faut convaincre.",
  "La santé est la vraie richesse.",
  "Petit à petit, l'oiseau fait son nid.",
  "Vous êtes plus fort que vous ne le croyez.",
  "Le meilleur moment pour commencer, c'est maintenant.",
  "La discipline, c'est choisir entre ce que vous voulez maintenant et ce que vous voulez le plus.",
  "Prenez soin de votre corps, c'est le seul endroit où vous devez vivre.",
  "Un objectif sans plan n'est qu'un souhait.",
  "Vous n'avez pas à être parfait, juste consistant.",
];

const ACTIVITY_META = {
  marche:      { icon: '🚶', label: 'Marche',      calPerMin: { faible: 3, modere: 4.5, eleve: 6, tres_eleve: 7 } },
  course:      { icon: '🏃', label: 'Course',      calPerMin: { faible: 7, modere: 10, eleve: 13, tres_eleve: 16 } },
  velo:        { icon: '🚴', label: 'Vélo',        calPerMin: { faible: 5, modere: 8, eleve: 11, tres_eleve: 14 } },
  musculation: { icon: '💪', label: 'Musculation', calPerMin: { faible: 4, modere: 6, eleve: 8, tres_eleve: 10 } },
  natation:    { icon: '🏊', label: 'Natation',    calPerMin: { faible: 6, modere: 9, eleve: 12, tres_eleve: 15 } },
  yoga:        { icon: '🧘', label: 'Yoga',        calPerMin: { faible: 2.5, modere: 3.5, eleve: 5, tres_eleve: 6 } },
  autre:       { icon: '🏅', label: 'Activité',    calPerMin: { faible: 4, modere: 6, eleve: 8, tres_eleve: 10 } },
};

// ============================================================
// FOOD DATABASE — 500 aliments (pour 100g sauf mention)
// { name, cal, prot, carb, fat, unit?, cat }
// ============================================================
const FOOD_DB = [
  // ── VIANDES & VOLAILLES ──
  { name:'Blanc de poulet',        cal:110, prot:23,  carb:0,   fat:1.2,  cat:'🍗 Viandes' },
  { name:'Cuisse de poulet',       cal:153, prot:18,  carb:0,   fat:8.5,  cat:'🍗 Viandes' },
  { name:'Dinde hachée 5%',        cal:120, prot:22,  carb:0,   fat:3.5,  cat:'🍗 Viandes' },
  { name:'Escalope de dinde',      cal:104, prot:22,  carb:0,   fat:1.5,  cat:'🍗 Viandes' },
  { name:'Blanc de dinde fumé',    cal:109, prot:20,  carb:1,   fat:2.5,  cat:'🍗 Viandes' },
  { name:'Steak haché 5%',         cal:121, prot:21,  carb:0,   fat:5,    cat:'🥩 Bœuf' },
  { name:'Steak haché 15%',        cal:195, prot:17,  carb:0,   fat:14,   cat:'🥩 Bœuf' },
  { name:'Rumsteck',               cal:140, prot:22,  carb:0,   fat:6,    cat:'🥩 Bœuf' },
  { name:'Entrecôte de bœuf',      cal:200, prot:19,  carb:0,   fat:14,   cat:'🥩 Bœuf' },
  { name:'Filet de bœuf',          cal:135, prot:22,  carb:0,   fat:5,    cat:'🥩 Bœuf' },
  { name:'Bavette de bœuf',        cal:155, prot:21,  carb:0,   fat:8,    cat:'🥩 Bœuf' },
  { name:'Côte de bœuf',           cal:220, prot:20,  carb:0,   fat:15,   cat:'🥩 Bœuf' },
  { name:'Bœuf bourguignon',       cal:155, prot:16,  carb:4,   fat:8,    cat:'🥩 Bœuf' },
  { name:'Côtelette de porc',       cal:215, prot:19,  carb:0,   fat:15,   cat:'🐷 Porc' },
  { name:'Filet de porc',          cal:143, prot:22,  carb:0,   fat:6,    cat:'🐷 Porc' },
  { name:'Jambon blanc dégraissé', cal:105, prot:17,  carb:1.5, fat:3.5,  cat:'🐷 Porc' },
  { name:'Jambon cru',             cal:145, prot:25,  carb:0.5, fat:5,    cat:'🐷 Porc' },
  { name:'Lardons fumés',          cal:330, prot:14,  carb:0.5, fat:30,   cat:'🐷 Porc' },
  { name:'Saucisse de Francfort',  cal:260, prot:12,  carb:2,   fat:23,   cat:'🐷 Porc' },
  { name:'Merguez',                cal:280, prot:13,  carb:2,   fat:25,   cat:'🐷 Porc' },
  { name:'Chorizo',                cal:450, prot:25,  carb:2,   fat:38,   cat:'🐷 Porc' },
  { name:'Côtelette d\'agneau',    cal:250, prot:20,  carb:0,   fat:18,   cat:'🐑 Agneau' },
  { name:'Gigot d\'agneau',        cal:191, prot:22,  carb:0,   fat:11,   cat:'🐑 Agneau' },
  { name:'Foie de veau',           cal:140, prot:20,  carb:4,   fat:4.5,  cat:'🥩 Abats' },
  { name:'Foie de poulet',         cal:130, prot:19,  carb:0.7, fat:5,    cat:'🥩 Abats' },
  { name:'Boudin noir',            cal:250, prot:12,  carb:7,   fat:20,   cat:'🥩 Abats' },
  { name:'Rillettes de porc',      cal:430, prot:15,  carb:1,   fat:42,   cat:'🐷 Porc' },
  { name:'Pâté de campagne',       cal:340, prot:14,  carb:5,   fat:29,   cat:'🥩 Charcuterie' },
  // ── POISSONS & FRUITS DE MER ──
  { name:'Saumon atlantique',      cal:208, prot:20,  carb:0,   fat:13,   cat:'🐟 Poissons' },
  { name:'Saumon fumé',            cal:170, prot:25,  carb:0,   fat:8,    cat:'🐟 Poissons' },
  { name:'Thon au naturel',        cal:116, prot:25,  carb:0,   fat:1,    cat:'🐟 Poissons' },
  { name:'Thon à l\'huile',        cal:190, prot:26,  carb:0,   fat:10,   cat:'🐟 Poissons' },
  { name:'Cabillaud',              cal:82,  prot:18,  carb:0,   fat:0.7,  cat:'🐟 Poissons' },
  { name:'Lieu noir',              cal:78,  prot:17,  carb:0,   fat:0.5,  cat:'🐟 Poissons' },
  { name:'Merlan',                 cal:75,  prot:17,  carb:0,   fat:0.5,  cat:'🐟 Poissons' },
  { name:'Dorade',                 cal:100, prot:20,  carb:0,   fat:2,    cat:'🐟 Poissons' },
  { name:'Bar (loup)',             cal:97,  prot:19,  carb:0,   fat:2,    cat:'🐟 Poissons' },
  { name:'Truite',                 cal:141, prot:20,  carb:0,   fat:6.5,  cat:'🐟 Poissons' },
  { name:'Maquereau',              cal:205, prot:19,  carb:0,   fat:14,   cat:'🐟 Poissons' },
  { name:'Hareng mariné',          cal:158, prot:18,  carb:0,   fat:9,    cat:'🐟 Poissons' },
  { name:'Sardines à l\'huile',    cal:208, prot:25,  carb:0,   fat:12,   cat:'🐟 Poissons' },
  { name:'Anchois',                cal:131, prot:20,  carb:0,   fat:5,    cat:'🐟 Poissons' },
  { name:'Sole',                   cal:85,  prot:17,  carb:0,   fat:1.5,  cat:'🐟 Poissons' },
  { name:'Flétan',                 cal:110, prot:21,  carb:0,   fat:2.5,  cat:'🐟 Poissons' },
  { name:'Crevettes décortiquées', cal:90,  prot:18,  carb:1.5, fat:1,    cat:'🦐 Fruits de mer' },
  { name:'Moules',                 cal:86,  prot:12,  carb:4,   fat:2,    cat:'🦐 Fruits de mer' },
  { name:'Coquilles Saint-Jacques', cal:88, prot:17,  carb:3,   fat:1,    cat:'🦐 Fruits de mer' },
  { name:'Calamars',               cal:92,  prot:16,  carb:3,   fat:1.5,  cat:'🦐 Fruits de mer' },
  { name:'Huîtres',                cal:70,  prot:9,   carb:4,   fat:2,    cat:'🦐 Fruits de mer' },
  { name:'Crabe',                  cal:87,  prot:19,  carb:0,   fat:1,    cat:'🦐 Fruits de mer' },
  { name:'Homard',                 cal:89,  prot:19,  carb:0.5, fat:1,    cat:'🦐 Fruits de mer' },
  { name:'Surimi',                 cal:100, prot:8,   carb:12,  fat:1,    cat:'🦐 Fruits de mer' },
  // ── ŒUFS & LAITIERS ──
  { name:'Œuf entier',             cal:78,  prot:6,   carb:0.6, fat:5,    cat:'🥚 Œufs', unit:'pièce' },
  { name:'Blanc d\'œuf',           cal:17,  prot:3.6, carb:0.2, fat:0,    cat:'🥚 Œufs', unit:'pièce' },
  { name:'Jaune d\'œuf',           cal:55,  prot:2.7, carb:0.3, fat:4.5,  cat:'🥚 Œufs', unit:'pièce' },
  { name:'Omelette nature',        cal:154, prot:10,  carb:0.5, fat:12,   cat:'🥚 Œufs' },
  { name:'Lait entier',            cal:62,  prot:3.2, carb:4.8, fat:3.5,  cat:'🥛 Laitiers' },
  { name:'Lait demi-écrémé',       cal:46,  prot:3.2, carb:4.8, fat:1.5,  cat:'🥛 Laitiers' },
  { name:'Lait écrémé',            cal:35,  prot:3.4, carb:4.9, fat:0.1,  cat:'🥛 Laitiers' },
  { name:'Lait végétal soja',      cal:40,  prot:3.3, carb:2.5, fat:2,    cat:'🥛 Laitiers' },
  { name:'Lait d\'amande',         cal:24,  prot:0.5, carb:3,   fat:1,    cat:'🥛 Laitiers' },
  { name:'Lait d\'avoine',         cal:45,  prot:1,   carb:7,   fat:1.5,  cat:'🥛 Laitiers' },
  { name:'Yaourt nature',          cal:58,  prot:4,   carb:5,   fat:2.5,  cat:'🥛 Laitiers' },
  { name:'Yaourt grec 0%',         cal:53,  prot:9,   carb:4,   fat:0.2,  cat:'🥛 Laitiers' },
  { name:'Yaourt grec entier',     cal:100, prot:9,   carb:3.9, fat:5,    cat:'🥛 Laitiers' },
  { name:'Skyr nature',            cal:63,  prot:11,  carb:4,   fat:0.2,  cat:'🥛 Laitiers' },
  { name:'Fromage blanc 0%',       cal:45,  prot:7.5, carb:4.1, fat:0.1,  cat:'🥛 Laitiers' },
  { name:'Fromage blanc 3%',       cal:60,  prot:7,   carb:4.5, fat:3,    cat:'🥛 Laitiers' },
  { name:'Faisselle',              cal:45,  prot:6,   carb:3.5, fat:1,    cat:'🥛 Laitiers' },
  { name:'Cottage cheese',         cal:85,  prot:11,  carb:3,   fat:3,    cat:'🥛 Laitiers' },
  { name:'Ricotta',                cal:174, prot:11,  carb:3,   fat:13,   cat:'🧀 Fromages' },
  { name:'Mozzarella',             cal:260, prot:18,  carb:2,   fat:21,   cat:'🧀 Fromages' },
  { name:'Emmental',               cal:380, prot:29,  carb:0.5, fat:29,   cat:'🧀 Fromages' },
  { name:'Gruyère',                cal:413, prot:30,  carb:0,   fat:33,   cat:'🧀 Fromages' },
  { name:'Comté',                  cal:407, prot:28,  carb:0,   fat:33,   cat:'🧀 Fromages' },
  { name:'Camembert',              cal:300, prot:21,  carb:0.5, fat:24,   cat:'🧀 Fromages' },
  { name:'Brie',                   cal:334, prot:21,  carb:0,   fat:28,   cat:'🧀 Fromages' },
  { name:'Chèvre frais',           cal:230, prot:13,  carb:1,   fat:20,   cat:'🧀 Fromages' },
  { name:'Feta',                   cal:264, prot:14,  carb:4,   fat:21,   cat:'🧀 Fromages' },
  { name:'Parmesan',               cal:431, prot:38,  carb:3,   fat:29,   cat:'🧀 Fromages' },
  { name:'Gouda',                  cal:356, prot:25,  carb:2,   fat:28,   cat:'🧀 Fromages' },
  { name:'Roquefort',              cal:370, prot:21,  carb:2,   fat:31,   cat:'🧀 Fromages' },
  { name:'Reblochon',              cal:334, prot:21,  carb:0,   fat:28,   cat:'🧀 Fromages' },
  { name:'Crème fraîche entière',  cal:292, prot:2.5, carb:3,   fat:30,   cat:'🥛 Laitiers' },
  { name:'Crème fraîche légère',   cal:130, prot:3,   carb:4,   fat:12,   cat:'🥛 Laitiers' },
  { name:'Beurre',                 cal:745, prot:0.6, carb:0.6, fat:82,   cat:'🥛 Laitiers' },
  // ── CÉRÉALES & FÉCULENTS ──
  { name:'Riz blanc cuit',         cal:130, prot:2.7, carb:28,  fat:0.3,  cat:'🌾 Céréales' },
  { name:'Riz complet cuit',       cal:111, prot:2.6, carb:23,  fat:0.9,  cat:'🌾 Céréales' },
  { name:'Riz basmati cuit',       cal:129, prot:2.7, carb:27,  fat:0.3,  cat:'🌾 Céréales' },
  { name:'Riz sauvage cuit',       cal:101, prot:4,   carb:21,  fat:0.3,  cat:'🌾 Céréales' },
  { name:'Pâtes blanches cuites',  cal:157, prot:5.8, carb:31,  fat:0.9,  cat:'🍝 Pâtes' },
  { name:'Pâtes complètes cuites', cal:149, prot:5.3, carb:29,  fat:1.1,  cat:'🍝 Pâtes' },
  { name:'Tagliatelles cuites',    cal:155, prot:5.5, carb:31,  fat:0.8,  cat:'🍝 Pâtes' },
  { name:'Gnocchi',                cal:173, prot:4,   carb:35,  fat:1.5,  cat:'🍝 Pâtes' },
  { name:'Quinoa cuit',            cal:120, prot:4.4, carb:21,  fat:1.9,  cat:'🌾 Céréales' },
  { name:'Boulgour cuit',          cal:83,  prot:3.1, carb:18,  fat:0.2,  cat:'🌾 Céréales' },
  { name:'Semoule cuite',          cal:120, prot:4,   carb:25,  fat:0.2,  cat:'🌾 Céréales' },
  { name:'Couscous cuit',          cal:112, prot:3.8, carb:23,  fat:0.2,  cat:'🌾 Céréales' },
  { name:'Avoine (flocons)',       cal:389, prot:17,  carb:66,  fat:7,    cat:'🌾 Céréales' },
  { name:'Muesli',                 cal:370, prot:10,  carb:63,  fat:7,    cat:'🌾 Céréales' },
  { name:'Granola',                cal:450, prot:8,   carb:65,  fat:18,   cat:'🌾 Céréales' },
  { name:'Corn Flakes',            cal:370, prot:8,   carb:84,  fat:0.5,  cat:'🌾 Céréales' },
  { name:'Pain blanc (tranche)',   cal:70,  prot:2.5, carb:14,  fat:0.7,  cat:'🍞 Pain' },
  { name:'Pain complet (tranche)', cal:69,  prot:3.6, carb:12,  fat:1,    cat:'🍞 Pain' },
  { name:'Pain de seigle',         cal:259, prot:8.5, carb:48,  fat:1.7,  cat:'🍞 Pain' },
  { name:'Baguette',               cal:263, prot:9,   carb:52,  fat:1.5,  cat:'🍞 Pain' },
  { name:'Pain de mie nature',     cal:268, prot:8,   carb:49,  fat:4,    cat:'🍞 Pain' },
  { name:'Pain aux céréales',      cal:255, prot:9,   carb:44,  fat:3.5,  cat:'🍞 Pain' },
  { name:'Brioche',                cal:390, prot:9,   carb:52,  fat:17,   cat:'🍞 Pain' },
  { name:'Crêpe nature',           cal:186, prot:5,   carb:28,  fat:6,    cat:'🍞 Pain' },
  { name:'Galette de blé noir',    cal:190, prot:6,   carb:32,  fat:4,    cat:'🍞 Pain' },
  { name:'Wrap (tortilla blé)',    cal:305, prot:8,   carb:56,  fat:5,    cat:'🍞 Pain' },
  { name:'Pomme de terre cuite',   cal:87,  prot:1.8, carb:20,  fat:0.1,  cat:'🥔 Féculents' },
  { name:'Pomme de terre vapeur',  cal:80,  prot:2,   carb:18,  fat:0.1,  cat:'🥔 Féculents' },
  { name:'Frites',                 cal:310, prot:3.4, carb:38,  fat:16,   cat:'🥔 Féculents' },
  { name:'Purée de pommes de terre', cal:83,prot:2,   carb:16,  fat:2,    cat:'🥔 Féculents' },
  { name:'Patate douce cuite',     cal:90,  prot:1.7, carb:21,  fat:0.1,  cat:'🥔 Féculents' },
  { name:'Manioc cuit',            cal:155, prot:1,   carb:38,  fat:0.3,  cat:'🥔 Féculents' },
  { name:'Polenta cuite',          cal:70,  prot:1.5, carb:15,  fat:0.5,  cat:'🥔 Féculents' },
  // ── LÉGUMINEUSES ──
  { name:'Lentilles cuites',       cal:116, prot:9,   carb:20,  fat:0.4,  cat:'🫘 Légumineuses' },
  { name:'Lentilles corail cuites',cal:100, prot:7.5, carb:17,  fat:0.3,  cat:'🫘 Légumineuses' },
  { name:'Pois chiches cuits',     cal:164, prot:9,   carb:27,  fat:2.6,  cat:'🫘 Légumineuses' },
  { name:'Haricots rouges cuits',  cal:128, prot:8.7, carb:22,  fat:0.5,  cat:'🫘 Légumineuses' },
  { name:'Haricots blancs cuits',  cal:139, prot:9.7, carb:25,  fat:0.5,  cat:'🫘 Légumineuses' },
  { name:'Haricots noirs cuits',   cal:132, prot:8.9, carb:24,  fat:0.5,  cat:'🫘 Légumineuses' },
  { name:'Edamame',                cal:121, prot:11,  carb:9,   fat:5,    cat:'🫘 Légumineuses' },
  { name:'Pois cassés cuits',      cal:118, prot:8,   carb:21,  fat:0.4,  cat:'🫘 Légumineuses' },
  { name:'Fèves cuites',           cal:110, prot:8,   carb:19,  fat:0.4,  cat:'🫘 Légumineuses' },
  { name:'Tofu ferme',             cal:76,  prot:8,   carb:1.9, fat:4.2,  cat:'🫘 Légumineuses' },
  { name:'Tofu soyeux',            cal:55,  prot:5,   carb:2.5, fat:3,    cat:'🫘 Légumineuses' },
  { name:'Tempeh',                 cal:193, prot:19,  carb:9,   fat:11,   cat:'🫘 Légumineuses' },
  { name:'Seitan',                 cal:370, prot:75,  carb:14,  fat:1.9,  cat:'🫘 Légumineuses' },
  { name:'Hummus',                 cal:166, prot:8,   carb:14,  fat:9.6,  cat:'🫘 Légumineuses' },
  // ── LÉGUMES ──
  { name:'Épinards crus',          cal:23,  prot:2.9, carb:3.6, fat:0.4,  cat:'🥦 Légumes' },
  { name:'Épinards cuits',         cal:35,  prot:3.6, carb:3.8, fat:0.5,  cat:'🥦 Légumes' },
  { name:'Brocoli cru',            cal:34,  prot:2.8, carb:7,   fat:0.4,  cat:'🥦 Légumes' },
  { name:'Brocoli cuit vapeur',    cal:28,  prot:2.4, carb:5,   fat:0.3,  cat:'🥦 Légumes' },
  { name:'Chou-fleur',             cal:25,  prot:1.9, carb:5,   fat:0.3,  cat:'🥦 Légumes' },
  { name:'Chou blanc',             cal:25,  prot:1.3, carb:5.8, fat:0.1,  cat:'🥦 Légumes' },
  { name:'Chou rouge',             cal:31,  prot:1.4, carb:7.4, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Chou de Bruxelles',      cal:43,  prot:3.4, carb:8.9, fat:0.3,  cat:'🥦 Légumes' },
  { name:'Courgette',              cal:17,  prot:1.2, carb:3.1, fat:0.3,  cat:'🥦 Légumes' },
  { name:'Concombre',              cal:16,  prot:0.7, carb:3.6, fat:0.1,  cat:'🥦 Légumes' },
  { name:'Tomate',                 cal:18,  prot:0.9, carb:3.9, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Tomates cerises',        cal:18,  prot:0.9, carb:3.9, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Poivron rouge',          cal:31,  prot:1,   carb:7,   fat:0.3,  cat:'🥦 Légumes' },
  { name:'Poivron vert',           cal:20,  prot:0.9, carb:4.6, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Poivron jaune',          cal:27,  prot:1,   carb:6.3, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Carotte',                cal:41,  prot:0.9, carb:10,  fat:0.2,  cat:'🥦 Légumes' },
  { name:'Céleri',                 cal:16,  prot:0.7, carb:3,   fat:0.2,  cat:'🥦 Légumes' },
  { name:'Céleri-rave',            cal:43,  prot:1.5, carb:10,  fat:0.3,  cat:'🥦 Légumes' },
  { name:'Fenouil',                cal:31,  prot:1.2, carb:7,   fat:0.2,  cat:'🥦 Légumes' },
  { name:'Asperges',               cal:20,  prot:2.2, carb:3.9, fat:0.1,  cat:'🥦 Légumes' },
  { name:'Artichaut cuit',         cal:53,  prot:3.3, carb:10,  fat:0.2,  cat:'🥦 Légumes' },
  { name:'Betterave cuite',        cal:44,  prot:1.7, carb:10,  fat:0.1,  cat:'🥦 Légumes' },
  { name:'Haricots verts cuits',   cal:35,  prot:1.9, carb:7,   fat:0.2,  cat:'🥦 Légumes' },
  { name:'Petits pois cuits',      cal:84,  prot:5.4, carb:14,  fat:0.4,  cat:'🥦 Légumes' },
  { name:'Maïs en grains',         cal:96,  prot:3.4, carb:21,  fat:1.5,  cat:'🥦 Légumes' },
  { name:'Oignon',                 cal:40,  prot:1.1, carb:9.3, fat:0.1,  cat:'🥦 Légumes' },
  { name:'Échalote',               cal:72,  prot:2.5, carb:17,  fat:0.1,  cat:'🥦 Légumes' },
  { name:'Poireau',                cal:61,  prot:1.5, carb:14,  fat:0.3,  cat:'🥦 Légumes' },
  { name:'Ail',                    cal:149, prot:6.4, carb:33,  fat:0.5,  cat:'🥦 Légumes' },
  { name:'Champignons de Paris',   cal:22,  prot:3.1, carb:3.3, fat:0.3,  cat:'🥦 Légumes' },
  { name:'Champignons shiitake',   cal:34,  prot:2.2, carb:7,   fat:0.5,  cat:'🥦 Légumes' },
  { name:'Aubergine',              cal:25,  prot:1,   carb:5.7, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Endive',                 cal:17,  prot:1.8, carb:3.1, fat:0.1,  cat:'🥦 Légumes' },
  { name:'Laitue',                 cal:15,  prot:1.4, carb:2.2, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Roquette',               cal:25,  prot:2.6, carb:3.6, fat:0.7,  cat:'🥦 Légumes' },
  { name:'Mâche',                  cal:13,  prot:2,   carb:1.2, fat:0.4,  cat:'🥦 Légumes' },
  { name:'Chou kale',              cal:49,  prot:4.3, carb:8.8, fat:0.9,  cat:'🥦 Légumes' },
  { name:'Bette à carde',          cal:19,  prot:1.8, carb:3.7, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Navet',                  cal:28,  prot:0.9, carb:6.4, fat:0.1,  cat:'🥦 Légumes' },
  { name:'Radis',                  cal:16,  prot:0.7, carb:3.4, fat:0.1,  cat:'🥦 Légumes' },
  { name:'Potiron',                cal:32,  prot:1,   carb:7.1, fat:0.1,  cat:'🥦 Légumes' },
  { name:'Butternut (courge)',     cal:45,  prot:1,   carb:11,  fat:0.1,  cat:'🥦 Légumes' },
  { name:'Avocat',                 cal:160, prot:2,   carb:9,   fat:15,   cat:'🥑 Légumes gras' },
  { name:'Olive noire',            cal:145, prot:1,   carb:3.8, fat:15,   cat:'🥑 Légumes gras' },
  { name:'Olive verte',            cal:145, prot:1,   carb:3.8, fat:15,   cat:'🥑 Légumes gras' },
  // ── FRUITS ──
  { name:'Pomme',                  cal:52,  prot:0.3, carb:14,  fat:0.2,  cat:'🍎 Fruits' },
  { name:'Poire',                  cal:57,  prot:0.4, carb:15,  fat:0.1,  cat:'🍎 Fruits' },
  { name:'Banane',                 cal:89,  prot:1.1, carb:23,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Orange',                 cal:47,  prot:0.9, carb:12,  fat:0.1,  cat:'🍎 Fruits' },
  { name:'Mandarine',              cal:53,  prot:0.8, carb:13,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Clémentine',             cal:47,  prot:0.9, carb:12,  fat:0.1,  cat:'🍎 Fruits' },
  { name:'Citron',                 cal:29,  prot:1.1, carb:9,   fat:0.3,  cat:'🍎 Fruits' },
  { name:'Pamplemousse',           cal:42,  prot:0.8, carb:11,  fat:0.1,  cat:'🍎 Fruits' },
  { name:'Kiwi',                   cal:61,  prot:1.1, carb:15,  fat:0.5,  cat:'🍎 Fruits' },
  { name:'Fraises',                cal:32,  prot:0.7, carb:7.7, fat:0.3,  cat:'🍎 Fruits' },
  { name:'Framboises',             cal:52,  prot:1.2, carb:12,  fat:0.7,  cat:'🍎 Fruits' },
  { name:'Mûres',                  cal:43,  prot:1.4, carb:10,  fat:0.5,  cat:'🍎 Fruits' },
  { name:'Myrtilles',              cal:57,  prot:0.7, carb:14,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Cerises',                cal:63,  prot:1.1, carb:16,  fat:0.2,  cat:'🍎 Fruits' },
  { name:'Pêche',                  cal:39,  prot:0.9, carb:10,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Abricot',                cal:48,  prot:1.4, carb:11,  fat:0.4,  cat:'🍎 Fruits' },
  { name:'Prune',                  cal:46,  prot:0.7, carb:11,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Raisin blanc',           cal:69,  prot:0.7, carb:18,  fat:0.2,  cat:'🍎 Fruits' },
  { name:'Raisin noir',            cal:72,  prot:0.7, carb:18,  fat:0.2,  cat:'🍎 Fruits' },
  { name:'Melon',                  cal:34,  prot:0.8, carb:8,   fat:0.2,  cat:'🍎 Fruits' },
  { name:'Pastèque',               cal:30,  prot:0.6, carb:7.6, fat:0.2,  cat:'🍎 Fruits' },
  { name:'Ananas',                 cal:50,  prot:0.5, carb:13,  fat:0.1,  cat:'🍎 Fruits' },
  { name:'Mangue',                 cal:60,  prot:0.8, carb:15,  fat:0.4,  cat:'🍎 Fruits' },
  { name:'Papaye',                 cal:43,  prot:0.5, carb:11,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Goyave',                 cal:68,  prot:2.6, carb:14,  fat:1,    cat:'🍎 Fruits' },
  { name:'Figue fraîche',          cal:74,  prot:0.8, carb:19,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Grenade',                cal:83,  prot:1.7, carb:19,  fat:1.2,  cat:'🍎 Fruits' },
  { name:'Litchi',                 cal:66,  prot:0.8, carb:17,  fat:0.4,  cat:'🍎 Fruits' },
  { name:'Noix de coco fraîche',   cal:354, prot:3.3, carb:15,  fat:33,   cat:'🍎 Fruits' },
  { name:'Banane plantain cuite',  cal:122, prot:1.3, carb:32,  fat:0.2,  cat:'🍎 Fruits' },
  // ── FRUITS SECS & OLÉAGINEUX ──
  { name:'Amandes',                cal:579, prot:21,  carb:22,  fat:50,   cat:'🥜 Oléagineux' },
  { name:'Noix de cajou',          cal:553, prot:18,  carb:30,  fat:44,   cat:'🥜 Oléagineux' },
  { name:'Noix',                   cal:654, prot:15,  carb:14,  fat:65,   cat:'🥜 Oléagineux' },
  { name:'Noisettes',              cal:628, prot:15,  carb:17,  fat:61,   cat:'🥜 Oléagineux' },
  { name:'Pistaches',              cal:562, prot:20,  carb:28,  fat:45,   cat:'🥜 Oléagineux' },
  { name:'Noix de macadamia',      cal:718, prot:8,   carb:14,  fat:76,   cat:'🥜 Oléagineux' },
  { name:'Noix du Brésil',         cal:659, prot:14,  carb:12,  fat:67,   cat:'🥜 Oléagineux' },
  { name:'Cacahuètes',             cal:567, prot:26,  carb:16,  fat:49,   cat:'🥜 Oléagineux' },
  { name:'Graines de chia',        cal:486, prot:17,  carb:42,  fat:31,   cat:'🥜 Oléagineux' },
  { name:'Graines de lin',         cal:534, prot:18,  carb:29,  fat:42,   cat:'🥜 Oléagineux' },
  { name:'Graines de tournesol',   cal:584, prot:21,  carb:20,  fat:51,   cat:'🥜 Oléagineux' },
  { name:'Graines de citrouille',  cal:559, prot:30,  carb:11,  fat:49,   cat:'🥜 Oléagineux' },
  { name:'Graines de sésame',      cal:573, prot:18,  carb:23,  fat:50,   cat:'🥜 Oléagineux' },
  { name:'Beurre de cacahuète',    cal:588, prot:25,  carb:20,  fat:50,   cat:'🥜 Oléagineux' },
  { name:'Beurre d\'amande',       cal:614, prot:21,  carb:19,  fat:56,   cat:'🥜 Oléagineux' },
  { name:'Raisins secs',           cal:299, prot:3.1, carb:79,  fat:0.5,  cat:'🍇 Fruits secs' },
  { name:'Abricots secs',          cal:241, prot:3.4, carb:63,  fat:0.5,  cat:'🍇 Fruits secs' },
  { name:'Pruneaux',               cal:240, prot:2.2, carb:64,  fat:0.4,  cat:'🍇 Fruits secs' },
  { name:'Dattes',                 cal:277, prot:1.8, carb:75,  fat:0.2,  cat:'🍇 Fruits secs' },
  { name:'Figues sèches',          cal:249, prot:3.3, carb:64,  fat:0.9,  cat:'🍇 Fruits secs' },
  { name:'Cranberries séchées',    cal:308, prot:0.1, carb:82,  fat:1,    cat:'🍇 Fruits secs' },
  // ── HUILES & MATIÈRES GRASSES ──
  { name:'Huile d\'olive',         cal:884, prot:0,   carb:0,   fat:100,  cat:'🫒 Huiles' },
  { name:'Huile de colza',         cal:884, prot:0,   carb:0,   fat:100,  cat:'🫒 Huiles' },
  { name:'Huile de tournesol',     cal:884, prot:0,   carb:0,   fat:100,  cat:'🫒 Huiles' },
  { name:'Huile de coco',          cal:862, prot:0,   carb:0,   fat:100,  cat:'🫒 Huiles' },
  { name:'Huile de lin',           cal:884, prot:0,   carb:0,   fat:100,  cat:'🫒 Huiles' },
  { name:'Margarine',              cal:717, prot:0.2, carb:0.7, fat:80,   cat:'🫒 Huiles' },
  { name:'Mayonnaise',             cal:680, prot:1.3, carb:0.6, fat:75,   cat:'🫒 Sauces' },
  { name:'Mayonnaise allégée',     cal:290, prot:1,   carb:7,   fat:28,   cat:'🫒 Sauces' },
  // ── PRODUITS SUCRÉS ──
  { name:'Chocolat noir 70%',      cal:600, prot:8,   carb:46,  fat:43,   cat:'🍫 Sucreries' },
  { name:'Chocolat au lait',       cal:535, prot:7.7, carb:60,  fat:30,   cat:'🍫 Sucreries' },
  { name:'Chocolat blanc',         cal:539, prot:5.9, carb:59,  fat:32,   cat:'🍫 Sucreries' },
  { name:'Miel',                   cal:304, prot:0.3, carb:82,  fat:0,    cat:'🍯 Sucrants' },
  { name:'Sucre blanc',            cal:387, prot:0,   carb:100, fat:0,    cat:'🍯 Sucrants' },
  { name:'Sucre roux',             cal:377, prot:0,   carb:97,  fat:0,    cat:'🍯 Sucrants' },
  { name:'Confiture',              cal:250, prot:0.5, carb:65,  fat:0.1,  cat:'🍯 Sucrants' },
  { name:'Nutella',                cal:539, prot:6,   carb:57,  fat:31,   cat:'🍫 Sucreries' },
  { name:'Bonbons',                cal:350, prot:0,   carb:88,  fat:0,    cat:'🍫 Sucreries' },
  { name:'Glace vanille',          cal:207, prot:3.5, carb:24,  fat:11,   cat:'🍦 Glaces' },
  { name:'Sorbet fraise',          cal:103, prot:0.3, carb:27,  fat:0.1,  cat:'🍦 Glaces' },
  { name:'Yaourt glacé',           cal:127, prot:3.2, carb:23,  fat:2.5,  cat:'🍦 Glaces' },
  { name:'Biscuit sec (type Lu)',  cal:430, prot:7,   carb:73,  fat:13,   cat:'🍪 Biscuits' },
  { name:'Cookie aux pépites',     cal:480, prot:5,   carb:65,  fat:22,   cat:'🍪 Biscuits' },
  { name:'Madeleine',              cal:415, prot:6,   carb:60,  fat:17,   cat:'🍪 Biscuits' },
  { name:'Croissant',              cal:406, prot:8.2, carb:45,  fat:21,   cat:'🥐 Viennoiseries' },
  { name:'Pain au chocolat',       cal:420, prot:7,   carb:50,  fat:22,   cat:'🥐 Viennoiseries' },
  { name:'Tarte aux pommes',       cal:237, prot:2.3, carb:34,  fat:10,   cat:'🥐 Viennoiseries' },
  { name:'Gâteau au chocolat',     cal:380, prot:5,   carb:47,  fat:20,   cat:'🍰 Gâteaux' },
  { name:'Cheesecake',             cal:321, prot:5,   carb:32,  fat:19,   cat:'🍰 Gâteaux' },
  { name:'Tiramisu',               cal:283, prot:5,   carb:27,  fat:17,   cat:'🍰 Gâteaux' },
  // ── BOISSONS ──
  { name:'Eau (plate ou gazeuse)', cal:0,   prot:0,   carb:0,   fat:0,    cat:'🥤 Boissons' },
  { name:'Café noir',              cal:2,   prot:0.3, carb:0,   fat:0,    cat:'🥤 Boissons' },
  { name:'Café au lait',           cal:50,  prot:2.5, carb:5,   fat:2,    cat:'🥤 Boissons' },
  { name:'Thé nature',             cal:1,   prot:0,   carb:0.2, fat:0,    cat:'🥤 Boissons' },
  { name:'Jus d\'orange',          cal:45,  prot:0.7, carb:10,  fat:0.2,  cat:'🥤 Boissons' },
  { name:'Jus de pomme',           cal:46,  prot:0.1, carb:11,  fat:0.1,  cat:'🥤 Boissons' },
  { name:'Jus de carotte',         cal:40,  prot:0.9, carb:9,   fat:0.2,  cat:'🥤 Boissons' },
  { name:'Smoothie banane',        cal:85,  prot:1,   carb:20,  fat:0.3,  cat:'🥤 Boissons' },
  { name:'Lait chocolaté',         cal:83,  prot:3.5, carb:12,  fat:2.5,  cat:'🥤 Boissons' },
  { name:'Soda cola',              cal:42,  prot:0,   carb:11,  fat:0,    cat:'🥤 Boissons' },
  { name:'Soda light/zero',        cal:1,   prot:0,   carb:0,   fat:0,    cat:'🥤 Boissons' },
  { name:'Limonade',               cal:40,  prot:0,   carb:10,  fat:0,    cat:'🥤 Boissons' },
  { name:'Bière (25cl)',           cal:110, prot:0.9, carb:8,   fat:0,    cat:'🍺 Alcool', unit:'verre' },
  { name:'Vin rouge (12.5cl)',     cal:85,  prot:0.1, carb:2.5, fat:0,    cat:'🍷 Alcool', unit:'verre' },
  { name:'Vin blanc (12.5cl)',     cal:83,  prot:0.1, carb:2.6, fat:0,    cat:'🍷 Alcool', unit:'verre' },
  { name:'Champagne (12.5cl)',     cal:93,  prot:0.3, carb:4,   fat:0,    cat:'🍷 Alcool', unit:'verre' },
  { name:'Whey protéine (vanille)',cal:385, prot:75,  carb:8,   fat:6,    cat:'💪 Sport' },
  { name:'Whey protéine (choco)',  cal:390, prot:74,  carb:9,   fat:7,    cat:'💪 Sport' },
  { name:'Boisson isotonique',     cal:27,  prot:0,   carb:6,   fat:0,    cat:'💪 Sport' },
  // ── PLATS PRÉPARÉS & FAST-FOOD ──
  { name:'Pizza margherita',       cal:270, prot:11,  carb:33,  fat:10,   cat:'🍕 Fast-food' },
  { name:'Pizza 4 fromages',       cal:310, prot:14,  carb:30,  fat:15,   cat:'🍕 Fast-food' },
  { name:'Hamburger simple',       cal:295, prot:17,  carb:24,  fat:14,   cat:'🍔 Fast-food' },
  { name:'Cheeseburger',           cal:350, prot:18,  carb:26,  fat:18,   cat:'🍔 Fast-food' },
  { name:'Nuggets de poulet (x6)', cal:280, prot:16,  carb:18,  fat:15,   cat:'🍔 Fast-food' },
  { name:'Hot-dog',                cal:290, prot:11,  carb:26,  fat:16,   cat:'🍔 Fast-food' },
  { name:'Sandwich jambon-beurre', cal:290, prot:14,  carb:30,  fat:12,   cat:'🥪 Sandwichs' },
  { name:'Sandwich poulet-crudités', cal:280,prot:18, carb:31,  fat:9,    cat:'🥪 Sandwichs' },
  { name:'Wrap thon-avocat',       cal:310, prot:20,  carb:28,  fat:13,   cat:'🥪 Sandwichs' },
  { name:'Croque-monsieur',        cal:320, prot:16,  carb:28,  fat:15,   cat:'🥪 Sandwichs' },
  { name:'Quiche lorraine',        cal:290, prot:9,   carb:20,  fat:20,   cat:'🥧 Plats' },
  { name:'Lasagnes bolognaise',    cal:165, prot:9,   carb:18,  fat:6,    cat:'🍝 Plats' },
  { name:'Hachis parmentier',      cal:130, prot:8,   carb:15,  fat:4,    cat:'🥘 Plats' },
  { name:'Poulet rôti',            cal:215, prot:25,  carb:0,   fat:13,   cat:'🍗 Plats' },
  { name:'Gratin dauphinois',      cal:190, prot:4,   carb:18,  fat:12,   cat:'🥘 Plats' },
  { name:'Ratatouille',            cal:55,  prot:1.5, carb:9,   fat:2,    cat:'🥘 Plats' },
  { name:'Soupe de légumes',       cal:42,  prot:1.5, carb:8,   fat:1,    cat:'🥣 Soupes' },
  { name:'Soupe de tomates',       cal:57,  prot:1.6, carb:10,  fat:1.5,  cat:'🥣 Soupes' },
  { name:'Velouté potiron',        cal:68,  prot:1.4, carb:12,  fat:2,    cat:'🥣 Soupes' },
  { name:'Gaspacho',               cal:48,  prot:1.2, carb:9,   fat:1.5,  cat:'🥣 Soupes' },
  { name:'Taboulé',                cal:165, prot:3,   carb:25,  fat:6,    cat:'🥗 Salades' },
  { name:'Salade niçoise',         cal:135, prot:10,  carb:8,   fat:7,    cat:'🥗 Salades' },
  { name:'Salade César',           cal:180, prot:12,  carb:9,   fat:12,   cat:'🥗 Salades' },
  { name:'Salade grecque',         cal:120, prot:4.5, carb:7,   fat:9,    cat:'🥗 Salades' },
  // ── CONDIMENTS & SAUCES ──
  { name:'Ketchup',                cal:112, prot:1.5, carb:27,  fat:0.1,  cat:'🫙 Condiments' },
  { name:'Moutarde',               cal:66,  prot:4.4, carb:5.9, fat:4,    cat:'🫙 Condiments' },
  { name:'Sauce soja',             cal:60,  prot:10,  carb:5,   fat:0.1,  cat:'🫙 Condiments' },
  { name:'Vinaigrette',            cal:460, prot:0.1, carb:2,   fat:50,   cat:'🫙 Condiments' },
  { name:'Crème de balsamique',    cal:177, prot:0.6, carb:44,  fat:0.1,  cat:'🫙 Condiments' },
  { name:'Pesto',                  cal:490, prot:6,   carb:8,   fat:49,   cat:'🫙 Condiments' },
  { name:'Sauce tomate',           cal:35,  prot:1.7, carb:7,   fat:0.4,  cat:'🫙 Condiments' },
  { name:'Houmous',                cal:166, prot:8,   carb:14,  fat:10,   cat:'🫙 Condiments' },
  // ── PRODUITS SPORT & SANTÉ ──
  { name:'Barre protéinée',        cal:210, prot:20,  carb:22,  fat:6,    cat:'💪 Sport', unit:'barre' },
  { name:'Flocons de quinoa',      cal:368, prot:14,  carb:62,  fat:6,    cat:'💪 Sport' },
  { name:'Spiruline',              cal:290, prot:57,  carb:24,  fat:8,    cat:'💪 Sport' },
  { name:'Gainer protéiné',        cal:380, prot:30,  carb:55,  fat:4,    cat:'💪 Sport' },
  { name:'Caséine (prot. lente)',  cal:370, prot:80,  carb:4,   fat:2,    cat:'💪 Sport' },
  // ── DIVERS ──
  { name:'Falafel',                cal:333, prot:13,  carb:32,  fat:18,   cat:'🧆 Divers' },
  { name:'Sushi (nigiri saumon)',  cal:58,  prot:3.5, carb:9,   fat:1,    cat:'🍣 Divers', unit:'pièce' },
  { name:'Maki (1 pièce)',         cal:30,  prot:1.5, carb:5,   fat:0.5,  cat:'🍣 Divers', unit:'pièce' },
  { name:'Nems (1 pièce)',         cal:70,  prot:3,   carb:7,   fat:3.5,  cat:'🥟 Divers', unit:'pièce' },
  { name:'Raviolis (100g)',        cal:155, prot:7,   carb:23,  fat:4,    cat:'🍝 Divers' },
  { name:'Crème caramel',          cal:130, prot:4,   carb:22,  fat:3.5,  cat:'🍮 Desserts' },
  { name:'Panna cotta',            cal:170, prot:3,   carb:19,  fat:9,    cat:'🍮 Desserts' },
  { name:'Mousse au chocolat',     cal:210, prot:5,   carb:22,  fat:12,   cat:'🍮 Desserts' },
  { name:'Crème brûlée',           cal:215, prot:4,   carb:20,  fat:13,   cat:'🍮 Desserts' },
  { name:'Profiteroles',           cal:320, prot:5,   carb:32,  fat:19,   cat:'🍮 Desserts' },
  { name:'Pancakes nature',        cal:227, prot:6,   carb:32,  fat:9,    cat:'🥞 Petit-déjeuner' },
  { name:'Porridge (lait)',        cal:130, prot:5.5, carb:22,  fat:3,    cat:'🥞 Petit-déjeuner' },
  { name:'Granola maison',         cal:450, prot:10,  carb:56,  fat:20,   cat:'🥞 Petit-déjeuner' },
  { name:'Pain perdu',             cal:290, prot:8,   carb:38,  fat:12,   cat:'🥞 Petit-déjeuner' },
  { name:'Acai bowl (base)',       cal:180, prot:3,   carb:25,  fat:8,    cat:'🥞 Petit-déjeuner' },

  // ── VIANDES SUPPLÉMENTAIRES ──
  { name:'Poulet tikka masala',    cal:155, prot:15,  carb:8,   fat:7,    cat:'🍗 Viandes' },
  { name:'Blanquette de veau',     cal:160, prot:14,  carb:9,   fat:8,    cat:'🥩 Veau' },
  { name:'Escalope de veau',       cal:130, prot:22,  carb:0,   fat:4.5,  cat:'🥩 Veau' },
  { name:'Côte de veau',           cal:175, prot:20,  carb:0,   fat:10,   cat:'🥩 Veau' },
  { name:'Rôti de veau',           cal:147, prot:24,  carb:0,   fat:5.5,  cat:'🥩 Veau' },
  { name:'Andouillette',           cal:300, prot:14,  carb:2,   fat:27,   cat:'🐷 Porc' },
  { name:'Saucisson sec',          cal:430, prot:27,  carb:1,   fat:36,   cat:'🐷 Porc' },
  { name:'Knack',                  cal:290, prot:12,  carb:2,   fat:26,   cat:'🐷 Porc' },
  { name:'Filet mignon de porc',   cal:143, prot:22,  carb:0,   fat:5.5,  cat:'🐷 Porc' },
  { name:'Travers de porc',        cal:282, prot:17,  carb:0,   fat:24,   cat:'🐷 Porc' },
  { name:'Magret de canard',       cal:200, prot:19,  carb:0,   fat:13,   cat:'🍗 Viandes' },
  { name:'Confit de canard',       cal:310, prot:20,  carb:0,   fat:25,   cat:'🍗 Viandes' },
  { name:'Lapin rôti',             cal:162, prot:24,  carb:0,   fat:7,    cat:'🥩 Viandes' },
  { name:'Caille rôtie',           cal:192, prot:22,  carb:0,   fat:11,   cat:'🍗 Viandes' },
  { name:'Pintade rôtie',          cal:158, prot:23,  carb:0,   fat:7,    cat:'🍗 Viandes' },
  { name:'Faisan rôti',            cal:144, prot:24,  carb:0,   fat:5,    cat:'🍗 Viandes' },
  { name:'Cervelle de veau',       cal:140, prot:11,  carb:0.9, fat:10,   cat:'🥩 Abats' },
  { name:'Rognons de bœuf',        cal:128, prot:23,  carb:0.9, fat:3.5,  cat:'🥩 Abats' },
  { name:'Langue de bœuf',         cal:240, prot:18,  carb:0,   fat:18,   cat:'🥩 Abats' },
  { name:'Tripes',                 cal:100, prot:15,  carb:0,   fat:5,    cat:'🥩 Abats' },

  // ── POISSONS SUPPLÉMENTAIRES ──
  { name:'Baudroie (lotte)',        cal:76,  prot:16,  carb:0,   fat:1,    cat:'🐟 Poissons' },
  { name:'Rouget',                 cal:109, prot:20,  carb:0,   fat:3.5,  cat:'🐟 Poissons' },
  { name:'Turbot',                 cal:95,  prot:18,  carb:0,   fat:2.5,  cat:'🐟 Poissons' },
  { name:'Saint-Pierre',           cal:87,  prot:19,  carb:0,   fat:1.5,  cat:'🐟 Poissons' },
  { name:'Raie',                   cal:90,  prot:19,  carb:0,   fat:1.5,  cat:'🐟 Poissons' },
  { name:'Anguille',               cal:232, prot:18,  carb:0,   fat:18,   cat:'🐟 Poissons' },
  { name:'Carpe',                  cal:127, prot:18,  carb:0,   fat:5.6,  cat:'🐟 Poissons' },
  { name:'Brochet',                cal:88,  prot:19,  carb:0,   fat:1.2,  cat:'🐟 Poissons' },
  { name:'Perche',                 cal:91,  prot:19,  carb:0,   fat:1.5,  cat:'🐟 Poissons' },
  { name:'Sandre',                 cal:84,  prot:19,  carb:0,   fat:0.7,  cat:'🐟 Poissons' },
  { name:'Espadon',                cal:121, prot:20,  carb:0,   fat:4,    cat:'🐟 Poissons' },
  { name:'Thon rouge frais',       cal:144, prot:23,  carb:0,   fat:5,    cat:'🐟 Poissons' },
  { name:'Daurade royale',         cal:96,  prot:20,  carb:0,   fat:1.5,  cat:'🐟 Poissons' },
  { name:'Sprats fumés',           cal:220, prot:19,  carb:0,   fat:16,   cat:'🐟 Poissons' },
  { name:'Crevettes tigrées',      cal:99,  prot:21,  carb:0.9, fat:1,    cat:'🦐 Fruits de mer' },
  { name:'Langoustines',           cal:80,  prot:17,  carb:0,   fat:1,    cat:'🦐 Fruits de mer' },
  { name:'Poulpe cuit',            cal:82,  prot:15,  carb:2.2, fat:1,    cat:'🦐 Fruits de mer' },
  { name:'Seiche',                 cal:79,  prot:16,  carb:0.8, fat:1,    cat:'🦐 Fruits de mer' },
  { name:'Palourdes',              cal:74,  prot:13,  carb:2.6, fat:1,    cat:'🦐 Fruits de mer' },
  { name:'Coquilles de pétoncles', cal:80,  prot:15,  carb:2,   fat:0.8,  cat:'🦐 Fruits de mer' },

  // ── CÉRÉALES & FÉCULENTS SUPPLÉMENTAIRES ──
  { name:'Épeautre cuit',          cal:127, prot:5,   carb:26,  fat:1,    cat:'🌾 Céréales' },
  { name:'Millet cuit',            cal:119, prot:3.5, carb:23,  fat:1,    cat:'🌾 Céréales' },
  { name:'Sarrasin cuit',          cal:92,  prot:3.4, carb:20,  fat:0.6,  cat:'🌾 Céréales' },
  { name:'Amarante cuite',         cal:102, prot:3.8, carb:19,  fat:1.6,  cat:'🌾 Céréales' },
  { name:'Teff cuit',              cal:101, prot:3.9, carb:20,  fat:0.7,  cat:'🌾 Céréales' },
  { name:'Orge perlé cuit',        cal:123, prot:2.3, carb:28,  fat:0.4,  cat:'🌾 Céréales' },
  { name:'Seigle (grain)',         cal:338, prot:10,  carb:76,  fat:1.6,  cat:'🌾 Céréales' },
  { name:'Avoine complète',        cal:379, prot:13,  carb:68,  fat:7,    cat:'🌾 Céréales' },
  { name:'Blé soufflé',            cal:357, prot:11,  carb:77,  fat:1.5,  cat:'🌾 Céréales' },
  { name:'Son de blé',             cal:216, prot:16,  carb:65,  fat:4.3,  cat:'🌾 Céréales' },
  { name:'Son d\'avoine',          cal:246, prot:17,  carb:66,  fat:7,    cat:'🌾 Céréales' },
  { name:'Germe de blé',           cal:360, prot:23,  carb:52,  fat:10,   cat:'🌾 Céréales' },
  { name:'Penne cuites',           cal:158, prot:5.8, carb:31,  fat:0.9,  cat:'🍝 Pâtes' },
  { name:'Fusilli cuits',          cal:157, prot:5.7, carb:31,  fat:0.9,  cat:'🍝 Pâtes' },
  { name:'Spaghetti cuits',        cal:157, prot:5.8, carb:31,  fat:0.9,  cat:'🍝 Pâtes' },
  { name:'Rigatoni cuits',         cal:155, prot:5.5, carb:31,  fat:0.8,  cat:'🍝 Pâtes' },
  { name:'Nouilles de riz cuites', cal:108, prot:1.8, carb:25,  fat:0.2,  cat:'🍝 Pâtes' },
  { name:'Nouilles de soba',       cal:99,  prot:5,   carb:21,  fat:0.1,  cat:'🍝 Pâtes' },
  { name:'Vermicelles cuits',      cal:149, prot:5,   carb:30,  fat:0.6,  cat:'🍝 Pâtes' },
  { name:'Tapioca cuit',           cal:100, prot:0.2, carb:25,  fat:0,    cat:'🥔 Féculents' },
  { name:'Igname cuite',           cal:118, prot:1.5, carb:28,  fat:0.2,  cat:'🥔 Féculents' },
  { name:'Taro cuit',              cal:142, prot:0.5, carb:35,  fat:0.1,  cat:'🥔 Féculents' },

  // ── PAIN SUPPLÉMENTAIRE ──
  { name:'Pain pita',              cal:275, prot:9,   carb:56,  fat:1.2,  cat:'🍞 Pain' },
  { name:'Naan',                   cal:310, prot:9,   carb:55,  fat:6,    cat:'🍞 Pain' },
  { name:'Chapati',                cal:330, prot:10,  carb:62,  fat:5,    cat:'🍞 Pain' },
  { name:'Pain azyme (matza)',     cal:395, prot:11,  carb:84,  fat:1.3,  cat:'🍞 Pain' },
  { name:'Biscotte',               cal:393, prot:11,  carb:74,  fat:6,    cat:'🍞 Pain' },
  { name:'Cracker céréales',       cal:430, prot:9,   carb:72,  fat:12,   cat:'🍞 Pain' },
  { name:'Galette de riz',         cal:387, prot:7.5, carb:85,  fat:2.8,  cat:'🍞 Pain' },
  { name:'Pain d\'épices',         cal:352, prot:6,   carb:77,  fat:3.5,  cat:'🍞 Pain' },

  // ── LÉGUMES SUPPLÉMENTAIRES ──
  { name:'Pak choï',               cal:13,  prot:1.5, carb:2.2, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Chou romanesco',         cal:25,  prot:1.8, carb:5,   fat:0.3,  cat:'🥦 Légumes' },
  { name:'Bette à carde rouge',    cal:19,  prot:1.8, carb:3.7, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Panais',                 cal:75,  prot:1.3, carb:18,  fat:0.3,  cat:'🥦 Légumes' },
  { name:'Topinambour',            cal:73,  prot:2,   carb:17,  fat:0.1,  cat:'🥦 Légumes' },
  { name:'Salsifis',               cal:82,  prot:3.3, carb:19,  fat:0.2,  cat:'🥦 Légumes' },
  { name:'Crosnes',                cal:81,  prot:2,   carb:18,  fat:0.3,  cat:'🥦 Légumes' },
  { name:'Scorsonère',             cal:82,  prot:3.3, carb:19,  fat:0.2,  cat:'🥦 Légumes' },
  { name:'Pousses de soja',        cal:30,  prot:3,   carb:5.9, fat:0.2,  cat:'🥦 Légumes' },
  { name:'Pousses de bambou',      cal:27,  prot:2.6, carb:5.2, fat:0.3,  cat:'🥦 Légumes' },
  { name:'Haricots beurre',        cal:35,  prot:2,   carb:7,   fat:0.2,  cat:'🥦 Légumes' },
  { name:'Cardons',                cal:20,  prot:0.7, carb:4.5, fat:0.1,  cat:'🥦 Légumes' },
  { name:'Rutabaga',               cal:38,  prot:1.1, carb:9,   fat:0.2,  cat:'🥦 Légumes' },
  { name:'Racine de persil',       cal:55,  prot:1.5, carb:12,  fat:0.3,  cat:'🥦 Légumes' },
  { name:'Blette',                 cal:19,  prot:1.8, carb:4,   fat:0.2,  cat:'🥦 Légumes' },
  { name:'Poirée',                 cal:17,  prot:1.6, carb:3.3, fat:0.1,  cat:'🥦 Légumes' },
  { name:'Mizuna',                 cal:18,  prot:2.1, carb:2.9, fat:0.3,  cat:'🥦 Légumes' },
  { name:'Cresson',                cal:11,  prot:2.3, carb:1.3, fat:0.3,  cat:'🥦 Légumes' },
  { name:'Pissenlit',              cal:45,  prot:2.7, carb:9.2, fat:0.7,  cat:'🥦 Légumes' },
  { name:'Ortie',                  cal:57,  prot:5.5, carb:7,   fat:0.7,  cat:'🥦 Légumes' },
  { name:'Champignons Portobello', cal:22,  prot:2.1, carb:4,   fat:0.3,  cat:'🥦 Légumes' },
  { name:'Champignons girolles',   cal:38,  prot:1.5, carb:6.5, fat:0.5,  cat:'🥦 Légumes' },
  { name:'Champignons porcini',    cal:29,  prot:2,   carb:5,   fat:0.5,  cat:'🥦 Légumes' },
  { name:'Truffe noire',           cal:92,  prot:6,   carb:17,  fat:0.5,  cat:'🥦 Légumes' },
  { name:'Algues nori',            cal:35,  prot:6,   carb:5,   fat:0.3,  cat:'🥦 Légumes' },
  { name:'Algues wakame',          cal:45,  prot:3,   carb:9,   fat:0.6,  cat:'🥦 Légumes' },
  { name:'Poivron orange',         cal:26,  prot:1,   carb:6,   fat:0.3,  cat:'🥦 Légumes' },
  { name:'Piment rouge',           cal:40,  prot:1.9, carb:8.8, fat:0.4,  cat:'🥦 Légumes' },
  { name:'Gombo',                  cal:33,  prot:1.9, carb:7.5, fat:0.2,  cat:'🥦 Légumes' },

  // ── FRUITS SUPPLÉMENTAIRES ──
  { name:'Fruit de la passion',    cal:97,  prot:2.2, carb:23,  fat:0.7,  cat:'🍎 Fruits' },
  { name:'Carambole',              cal:31,  prot:1,   carb:7,   fat:0.3,  cat:'🍎 Fruits' },
  { name:'Ramboutan',              cal:68,  prot:0.9, carb:16,  fat:0.2,  cat:'🍎 Fruits' },
  { name:'Durian',                 cal:147, prot:1.5, carb:27,  fat:5,    cat:'🍎 Fruits' },
  { name:'Pitaya (fruit du dragon)', cal:60,prot:1.2, carb:13,  fat:0.4,  cat:'🍎 Fruits' },
  { name:'Jackfruit',              cal:95,  prot:1.7, carb:23,  fat:0.6,  cat:'🍎 Fruits' },
  { name:'Feijoa',                 cal:55,  prot:1.2, carb:13,  fat:0.6,  cat:'🍎 Fruits' },
  { name:'Groseilles',             cal:56,  prot:1.4, carb:13,  fat:0.2,  cat:'🍎 Fruits' },
  { name:'Cassis',                 cal:63,  prot:1.4, carb:15,  fat:0.4,  cat:'🍎 Fruits' },
  { name:'Sureau (baies)',         cal:73,  prot:0.7, carb:18,  fat:0.5,  cat:'🍎 Fruits' },
  { name:'Coing',                  cal:57,  prot:0.4, carb:15,  fat:0.1,  cat:'🍎 Fruits' },
  { name:'Nèfle',                  cal:47,  prot:0.4, carb:12,  fat:0.2,  cat:'🍎 Fruits' },
  { name:'Mirabelle',              cal:51,  prot:0.7, carb:12,  fat:0.2,  cat:'🍎 Fruits' },
  { name:'Quetsche',               cal:46,  prot:0.7, carb:11,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Reine-claude',           cal:47,  prot:0.7, carb:11,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Bigarreau',              cal:70,  prot:1.1, carb:17,  fat:0.2,  cat:'🍎 Fruits' },
  { name:'Nectarine',              cal:44,  prot:1.1, carb:11,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Brugnon',                cal:49,  prot:1.2, carb:12,  fat:0.3,  cat:'🍎 Fruits' },
  { name:'Physalis',               cal:53,  prot:1.9, carb:11,  fat:0.7,  cat:'🍎 Fruits' },
  { name:'Kumquat',                cal:71,  prot:1.9, carb:16,  fat:0.9,  cat:'🍎 Fruits' },
  { name:'Bergamote',              cal:36,  prot:0.8, carb:9,   fat:0.2,  cat:'🍎 Fruits' },

  // ── LÉGUMINEUSES SUPPLÉMENTAIRES ──
  { name:'Azukis cuits',           cal:128, prot:7.5, carb:25,  fat:0.1,  cat:'🫘 Légumineuses' },
  { name:'Haricots mungo germés',  cal:30,  prot:3,   carb:6,   fat:0.2,  cat:'🫘 Légumineuses' },
  { name:'Lupins cuits',           cal:119, prot:16,  carb:10,  fat:3,    cat:'🫘 Légumineuses' },
  { name:'Haricots de Lima cuits', cal:115, prot:7.8, carb:21,  fat:0.4,  cat:'🫘 Légumineuses' },
  { name:'Miso',                   cal:200, prot:12,  carb:27,  fat:6,    cat:'🫘 Légumineuses' },
  { name:'Natto',                  cal:211, prot:18,  carb:14,  fat:11,   cat:'🫘 Légumineuses' },

  // ── FROMAGES SUPPLÉMENTAIRES ──
  { name:'Beaufort',               cal:401, prot:27,  carb:0,   fat:33,   cat:'🧀 Fromages' },
  { name:'Abondance',              cal:390, prot:26,  carb:0,   fat:32,   cat:'🧀 Fromages' },
  { name:'Raclette',               cal:330, prot:23,  carb:0.5, fat:27,   cat:'🧀 Fromages' },
  { name:'Munster',                cal:302, prot:20,  carb:0.5, fat:24,   cat:'🧀 Fromages' },
  { name:'Époisses',               cal:280, prot:16,  carb:1,   fat:23,   cat:'🧀 Fromages' },
  { name:'Livarot',                cal:290, prot:21,  carb:0.5, fat:23,   cat:'🧀 Fromages' },
  { name:'Pont-l\'Évêque',        cal:299, prot:20,  carb:0.5, fat:24,   cat:'🧀 Fromages' },
  { name:'Cantal',                 cal:380, prot:26,  carb:0,   fat:31,   cat:'🧀 Fromages' },
  { name:'Tomme de Savoie',        cal:310, prot:23,  carb:0.5, fat:24,   cat:'🧀 Fromages' },
  { name:'Saint-Nectaire',         cal:326, prot:22,  carb:0,   fat:26,   cat:'🧀 Fromages' },
  { name:'Ossau-Iraty',            cal:401, prot:26,  carb:0,   fat:33,   cat:'🧀 Fromages' },
  { name:'Mimolette',              cal:365, prot:24,  carb:0,   fat:30,   cat:'🧀 Fromages' },
  { name:'Edam',                   cal:335, prot:24,  carb:1.4, fat:26,   cat:'🧀 Fromages' },
  { name:'Maroilles',              cal:280, prot:19,  carb:0,   fat:23,   cat:'🧀 Fromages' },
  { name:'Langres',                cal:278, prot:18,  carb:0.5, fat:23,   cat:'🧀 Fromages' },

  // ── SAUCES & CONDIMENTS SUPPLÉMENTAIRES ──
  { name:'Sauce béchamel',         cal:136, prot:4,   carb:11,  fat:9,    cat:'🫙 Condiments' },
  { name:'Sauce hollandaise',      cal:415, prot:2.3, carb:2,   fat:45,   cat:'🫙 Condiments' },
  { name:'Sauce barbecue',         cal:172, prot:1.2, carb:41,  fat:0.5,  cat:'🫙 Condiments' },
  { name:'Sauce chili',            cal:90,  prot:2,   carb:18,  fat:1.5,  cat:'🫙 Condiments' },
  { name:'Sauce teriyaki',         cal:89,  prot:3.8, carb:18,  fat:0.6,  cat:'🫙 Condiments' },
  { name:'Sauce worcestershire',   cal:78,  prot:1.2, carb:19,  fat:0.1,  cat:'🫙 Condiments' },
  { name:'Tabasco',                cal:12,  prot:0.5, carb:2.5, fat:0.2,  cat:'🫙 Condiments' },
  { name:'Harissa',                cal:90,  prot:2.5, carb:8,   fat:5,    cat:'🫙 Condiments' },
  { name:'Tapenade',               cal:320, prot:2,   carb:4,   fat:34,   cat:'🫙 Condiments' },
  { name:'Tzatziki',               cal:90,  prot:4,   carb:4.5, fat:6,    cat:'🫙 Condiments' },
  { name:'Guacamole',              cal:155, prot:2,   carb:9,   fat:13,   cat:'🫙 Condiments' },
  { name:'Sauce vierge',           cal:180, prot:0.7, carb:3.5, fat:18,   cat:'🫙 Condiments' },
  { name:'Coulis de tomate',       cal:32,  prot:1.4, carb:6.5, fat:0.3,  cat:'🫙 Condiments' },

  // ── BOISSONS SUPPLÉMENTAIRES ──
  { name:'Kombucha',               cal:25,  prot:0,   carb:7,   fat:0,    cat:'🥤 Boissons' },
  { name:'Kéfir de lait',          cal:65,  prot:3.5, carb:4.5, fat:3.5,  cat:'🥤 Boissons' },
  { name:'Jus de grenade',         cal:54,  prot:0.2, carb:13,  fat:0.3,  cat:'🥤 Boissons' },
  { name:'Jus de betterave',       cal:45,  prot:1.7, carb:10,  fat:0.1,  cat:'🥤 Boissons' },
  { name:'Jus de gingembre',       cal:50,  prot:0.5, carb:12,  fat:0.2,  cat:'🥤 Boissons' },
  { name:'Jus de céleri',          cal:17,  prot:0.9, carb:3.6, fat:0.2,  cat:'🥤 Boissons' },
  { name:'Eau de coco',            cal:19,  prot:0.7, carb:3.7, fat:0.2,  cat:'🥤 Boissons' },
  { name:'Lait de coco (boisson)', cal:230, prot:2.3, carb:5.5, fat:23,   cat:'🥤 Boissons' },
  { name:'Thé vert matcha',        cal:5,   prot:0.6, carb:0.6, fat:0.2,  cat:'🥤 Boissons' },
  { name:'Tisane nature',          cal:1,   prot:0,   carb:0.1, fat:0,    cat:'🥤 Boissons' },
  { name:'Sirop d\'agave',         cal:310, prot:0.1, carb:76,  fat:0,    cat:'🍯 Sucrants' },
  { name:'Sirop d\'érable',        cal:260, prot:0,   carb:67,  fat:0.1,  cat:'🍯 Sucrants' },
  { name:'Cidre brut (25cl)',      cal:100, prot:0,   carb:7,   fat:0,    cat:'🍺 Alcool', unit:'verre' },
  { name:'Rosé (12.5cl)',          cal:83,  prot:0.1, carb:2.5, fat:0,    cat:'🍷 Alcool', unit:'verre' },
  { name:'Pastis (4cl)',           cal:97,  prot:0,   carb:2,   fat:0,    cat:'🍺 Alcool', unit:'verre' },

  // ── PLATS DU MONDE ──
  { name:'Pad thaï',               cal:185, prot:9,   carb:28,  fat:5,    cat:'🌏 Cuisine du monde' },
  { name:'Curry de légumes',       cal:120, prot:3.5, carb:16,  fat:5,    cat:'🌏 Cuisine du monde' },
  { name:'Dal de lentilles',       cal:105, prot:6,   carb:17,  fat:2.5,  cat:'🌏 Cuisine du monde' },
  { name:'Bœuf bourguignon',       cal:185, prot:17,  carb:10,  fat:9,    cat:'🌏 Cuisine du monde' },
  { name:'Couscous au mouton',     cal:175, prot:11,  carb:22,  fat:5,    cat:'🌏 Cuisine du monde' },
  { name:'Paella au poulet',       cal:165, prot:12,  carb:20,  fat:4.5,  cat:'🌏 Cuisine du monde' },
  { name:'Moussaka',               cal:175, prot:9,   carb:12,  fat:10,   cat:'🌏 Cuisine du monde' },
  { name:'Gyros poulet',           cal:200, prot:16,  carb:22,  fat:6,    cat:'🌏 Cuisine du monde' },
  { name:'Shawarma',               cal:220, prot:16,  carb:24,  fat:7,    cat:'🌏 Cuisine du monde' },
  { name:'Banh mi poulet',         cal:310, prot:18,  carb:38,  fat:8,    cat:'🌏 Cuisine du monde' },
  { name:'Bibimbap',               cal:490, prot:24,  carb:70,  fat:12,   cat:'🌏 Cuisine du monde' },
  { name:'Ramen au porc',          cal:380, prot:20,  carb:50,  fat:10,   cat:'🌏 Cuisine du monde' },
  { name:'Nasi goreng',            cal:260, prot:9,   carb:38,  fat:8,    cat:'🌏 Cuisine du monde' },
  { name:'Börek au fromage',       cal:325, prot:10,  carb:30,  fat:19,   cat:'🌏 Cuisine du monde' },
  { name:'Souvlaki',               cal:215, prot:20,  carb:12,  fat:9,    cat:'🌏 Cuisine du monde' },
];



// ============================================================
// DATA MANAGEMENT
// ============================================================

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { return {}; }
}

function saveData(data) {
  data._savedAt = Date.now(); // timestamp pour merge cloud/local
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // Fire-and-forget cloud sync (non-blocking)
  if (_currentUser) {
    saveDataCloud(data).catch(e => console.warn('Cloud sync failed:', e));
  }
}

function getTodayLog() {
  const data = loadData();
  const today = TODAY();
  if (!data.logs) data.logs = {};
  if (!data.logs[today]) {
    data.logs[today] = {
      foods: { breakfast: [], lunch: [], dinner: [], snack: [] },
      activities: [],
      water: 0,
      steps: 0,
      weight: null,
    };
  }
  return { data, today };
}

function saveTodayLog(log) {
  const { data, today } = getTodayLog();
  data.logs[today] = log;
  saveData(data);
}

// ============================================================
// CALCULATIONS
// ============================================================

function calcBMR(profile) {
  const { weight, height, age, sex } = profile;
  if (sex === 'homme') return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
  return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
}

const ACTIVITY_MULTIPLIERS = {
  sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725, extreme: 1.9
};

function calcTDEE(profile) {
  return Math.round(calcBMR(profile) * (ACTIVITY_MULTIPLIERS[profile.activity] || 1.375));
}

function calcGoalCalories(profile) {
  const tdee = calcTDEE(profile);
  const adj = { perte_poids: -500, prise_masse: +400, maintien: 0, sante: 0, performance: +200 };
  return Math.max(1200, tdee + (adj[profile.goal] || 0));
}

function calcIMC(profile) {
  const h = profile.height / 100;
  return (profile.weight / (h * h)).toFixed(1);
}

function calcIMCStatus(imc) {
  if (imc < 18.5) return 'Insuffisance pondérale';
  if (imc < 25) return 'Poids normal';
  if (imc < 30) return 'Surpoids';
  return 'Obésité';
}

function calcMacros(profile) {
  const cals = calcGoalCalories(profile);
  let pctProt, pctCarb, pctFat;
  switch (profile.goal) {
    case 'perte_poids':  pctProt = 0.35; pctCarb = 0.35; pctFat = 0.30; break;
    case 'prise_masse':  pctProt = 0.30; pctCarb = 0.45; pctFat = 0.25; break;
    case 'performance':  pctProt = 0.25; pctCarb = 0.55; pctFat = 0.20; break;
    default:             pctProt = 0.25; pctCarb = 0.45; pctFat = 0.30;
  }
  return {
    protein: Math.round((cals * pctProt) / 4),
    carbs:   Math.round((cals * pctCarb) / 4),
    fat:     Math.round((cals * pctFat) / 9),
  };
}

function calcWater(profile) {
  let base = profile.weight * 0.033;
  if (profile.activity !== 'sedentaire') base += 0.5;
  return Math.round(base * 10) / 10;
}

function calcSteps(profile) {
  const base = { sedentaire: 6000, leger: 8000, modere: 10000, actif: 12000, extreme: 15000 };
  return base[profile.activity] || 8000;
}

function calcActivityMinutes(profile) {
  const base = { sedentaire: 20, leger: 30, modere: 45, actif: 60, extreme: 90 };
  return base[profile.activity] || 30;
}

// Aggregate today's food totals
function getTodayTotals(log) {
  let cal = 0, prot = 0, carb = 0, fat = 0;
  Object.values(log.foods).forEach(items => {
    items.forEach(item => {
      cal += item.cal || 0;
      prot += item.prot || 0;
      carb += item.carb || 0;
      fat += item.fat || 0;
    });
  });
  return { cal: Math.round(cal), prot: Math.round(prot), carb: Math.round(carb), fat: Math.round(fat) };
}

function getActivityTotals(log) {
  let burnedCal = 0, minutes = 0;
  (log.activities || []).forEach(a => {
    burnedCal += a.calories || 0;
    minutes += a.duration || 0;
  });
  return { burnedCal: Math.round(burnedCal), minutes };
}

// ============================================================
// HEALTH SCORE
// ============================================================

function calcHealthScore(profile, log) {
  const targets = {
    calories: calcGoalCalories(profile),
    water: calcWater(profile),
    steps: calcSteps(profile),
  };
  const macros = calcMacros(profile);
  const totals = getTodayTotals(log);
  const actTotals = getActivityTotals(log);

  let score = 0;
  // Calories (25pts)
  const calRatio = totals.cal / targets.calories;
  if (calRatio >= 0.8 && calRatio <= 1.1) score += 25;
  else if (calRatio >= 0.6) score += 15;
  else if (calRatio > 0) score += 5;
  // Protein (20pts)
  if (totals.prot >= macros.protein * 0.8) score += 20;
  else if (totals.prot >= macros.protein * 0.5) score += 10;
  // Water (25pts)
  const waterRatio = log.water / targets.water;
  if (waterRatio >= 0.9) score += 25;
  else if (waterRatio >= 0.6) score += 15;
  else if (waterRatio > 0) score += 5;
  // Steps (20pts)
  if (log.steps >= targets.steps) score += 20;
  else if (log.steps >= targets.steps * 0.7) score += 12;
  else if (log.steps > 0) score += 5;
  // Activity (10pts)
  if (actTotals.minutes >= calcActivityMinutes(profile)) score += 10;
  else if (actTotals.minutes >= 15) score += 5;

  return score;
}

// ============================================================
// ONBOARDING LOGIC
// ============================================================

let obCurrentStep = 1;
const OB_TOTAL_STEPS = 5;

function startOnboarding() {
  document.getElementById('onboarding').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  updateObStep(1);
}

function updateObStep(step) {
  obCurrentStep = step;
  document.querySelectorAll('.ob-step').forEach(el => el.classList.remove('active'));
  const stepEl = document.querySelector(`[data-step="${step}"]`);
  if (stepEl) stepEl.classList.add('active');

  const pct = (step / OB_TOTAL_STEPS) * 100;
  document.getElementById('ob-progress-fill').style.width = pct + '%';
  document.getElementById('ob-step-label').textContent = `${step} / ${OB_TOTAL_STEPS}`;

  document.getElementById('ob-back-btn').style.display = step > 1 ? 'block' : 'none';
  const nextBtn = document.getElementById('ob-next-btn');
  nextBtn.textContent = step === OB_TOTAL_STEPS ? 'Commencer 🚀' : 'Continuer →';

  if (step === OB_TOTAL_STEPS) buildObSummary();
}

function obNext() {
  if (!validateObStep(obCurrentStep)) return;
  if (obCurrentStep < OB_TOTAL_STEPS) {
    updateObStep(obCurrentStep + 1);
  } else {
    finishOnboarding();
  }
}

function obBack() {
  if (obCurrentStep > 1) updateObStep(obCurrentStep - 1);
}

function validateObStep(step) {
  if (step === 1) {
    if (!document.getElementById('ob-name').value.trim()) return showToast('Veuillez entrer votre prénom');
    if (!document.querySelector('[name="ob-sex"]:checked')) return showToast('Veuillez sélectionner votre sexe');
    const age = parseInt(document.getElementById('ob-age').value);
    if (!age || age < 10 || age > 120) return showToast('Veuillez entrer un âge valide');
  }
  if (step === 2) {
    const h = parseFloat(document.getElementById('ob-height').value);
    const w = parseFloat(document.getElementById('ob-weight').value);
    const tw = parseFloat(document.getElementById('ob-target-weight').value);
    if (!h || h < 100 || h > 250) return showToast('Veuillez entrer une taille valide');
    if (!w || w < 30 || w > 300) return showToast('Veuillez entrer un poids valide');
    if (!tw || tw < 30 || tw > 300) return showToast('Veuillez entrer un poids cible valide');
  }
  if (step === 3) {
    if (!document.querySelector('[name="ob-goal"]:checked')) return showToast('Veuillez sélectionner un objectif');
  }
  return true;
}

function buildObSummary() {
  const profile = getObProfile();
  const cals = calcGoalCalories(profile);
  const macros = calcMacros(profile);
  const imc = calcIMC(profile);
  const water = calcWater(profile);

  const summaryEl = document.getElementById('ob-summary');
  summaryEl.innerHTML = `
    <div class="summary-card"><span class="s-val">${cals}</span><span class="s-lbl">kcal / jour</span></div>
    <div class="summary-card"><span class="s-val">${imc}</span><span class="s-lbl">IMC</span></div>
    <div class="summary-card"><span class="s-val">${macros.protein}g</span><span class="s-lbl">Protéines</span></div>
    <div class="summary-card"><span class="s-val">${water}L</span><span class="s-lbl">Eau / jour</span></div>
    <div class="summary-card"><span class="s-val">${macros.carbs}g</span><span class="s-lbl">Glucides</span></div>
    <div class="summary-card"><span class="s-val">${macros.fat}g</span><span class="s-lbl">Lipides</span></div>
  `;
}

function getObProfile() {
  const allergies = [...document.querySelectorAll('[name="allergy"]:checked')].map(el => el.value);
  return {
    name:         document.getElementById('ob-name').value.trim(),
    sex:          document.querySelector('[name="ob-sex"]:checked')?.value || 'homme',
    age:          parseInt(document.getElementById('ob-age').value) || 25,
    height:       parseFloat(document.getElementById('ob-height').value) || 170,
    weight:       parseFloat(document.getElementById('ob-weight').value) || 70,
    targetWeight: parseFloat(document.getElementById('ob-target-weight').value) || 65,
    activity:     document.getElementById('ob-activity').value,
    goal:         document.querySelector('[name="ob-goal"]:checked')?.value || 'maintien',
    diet:         document.getElementById('ob-diet').value,
    meals:        parseInt(document.getElementById('ob-meals').value) || 3,
    allergies,
    createdAt: new Date().toISOString(),
    weightHistory: [{ date: TODAY(), weight: parseFloat(document.getElementById('ob-weight').value) || 70 }],
  };
}

function finishOnboarding() {
  const profile = getObProfile();
  const data = loadData();
  data.profile = profile;
  data.theme = 'dark';
  saveData(data);
  document.getElementById('onboarding').classList.add('hidden');
  initApp();
}

// ============================================================
// APP INITIALIZATION
// ============================================================

function initApp() {
  const data = loadData();
  if (!data.profile) { startOnboarding(); return; }

  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  applyTheme(data.theme || 'dark');
  renderHeader(data.profile);
  renderDashboard();
  renderFoodSection();
  renderActivitySection();
  renderGoals();
  renderProfile();
  scheduleWaterReminder();
}

function renderHeader(profile) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  document.getElementById('score-greeting').textContent = `${greeting}, ${profile.name} !`;
  document.getElementById('motivation-quote').textContent =
    MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  document.getElementById('avatar-initials').textContent =
    profile.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

// ============================================================
// DASHBOARD RENDERING
// ============================================================

function renderDashboard() {
  const data = loadData();
  const profile = data.profile;
  const { data: allData, today } = getTodayLog();
  const log = allData.logs[today];

  const targets = {
    calories: calcGoalCalories(profile),
    water: calcWater(profile),
    steps: calcSteps(profile),
  };
  const macros = calcMacros(profile);
  const totals = getTodayTotals(log);
  const actTotals = getActivityTotals(log);

  // Calories ring
  const calPct = Math.min(totals.cal / targets.calories, 1);
  const circumference = 314;
  document.getElementById('cal-ring-arc').style.strokeDashoffset = circumference - (circumference * calPct);
  document.getElementById('cal-consumed').textContent = totals.cal;
  document.getElementById('cal-goal').textContent = targets.calories + ' kcal';
  const remaining = Math.max(0, targets.calories - totals.cal + actTotals.burnedCal);
  document.getElementById('cal-remaining').textContent = remaining + ' kcal';
  document.getElementById('cal-burned').textContent = actTotals.burnedCal + ' kcal';

  // Macros
  setMacroBar('protein', totals.prot, macros.protein);
  setMacroBar('carbs', totals.carb, macros.carbs);
  setMacroBar('fat', totals.fat, macros.fat);

  // Water
  const waterPct = Math.min(log.water / targets.water, 1);
  document.getElementById('water-fill').style.height = (waterPct * 100) + '%';
  document.getElementById('water-consumed').textContent = log.water.toFixed(2).replace(/\.?0+$/, '') || '0';
  document.getElementById('water-goal-label').textContent = `/ ${targets.water}L`;

  // Steps
  document.getElementById('steps-today').textContent = (log.steps || 0).toLocaleString();
  document.getElementById('steps-goal-label').textContent = `/ ${targets.steps.toLocaleString()}`;
  const stepsPct = Math.min((log.steps || 0) / targets.steps, 1) * 100;
  document.getElementById('bar-steps').style.width = stepsPct + '%';

  // Health Score (enhanced breakdown)
  renderHealthScore(profile, log);

  // Recommendations
  renderRecommendations(profile, log, totals, targets, macros);
}

function setMacroBar(type, current, target) {
  const bar = document.getElementById(`bar-${type}`);
  const val = document.getElementById(`val-${type}`);
  const goal = document.getElementById(`goal-${type}`);
  const pct = target > 0 ? Math.min(current / target, 1) * 100 : 0;
  bar.style.width = pct + '%';
  val.textContent = Math.round(current) + 'g';
  goal.textContent = `/ ${target}g`;
}

function renderRecommendations(profile, log, totals, targets, macros) {
  const recs = [];
  const remaining_water = Math.max(0, targets.water - log.water);
  const remaining_prot = Math.max(0, macros.protein - totals.prot);
  const remaining_cal = Math.max(0, calcGoalCalories(profile) - totals.cal);
  const actTotals = getActivityTotals(log);
  const targetMin = calcActivityMinutes(profile);

  if (remaining_water > 0.1) recs.push({ text: `💧 Buvez encore ${remaining_water.toFixed(1)}L d'eau aujourd'hui.`, type: 'info' });
  if (remaining_prot > 5) recs.push({ text: `🥩 Il vous manque ${Math.round(remaining_prot)}g de protéines aujourd'hui.`, type: 'warning' });
  if (remaining_cal > 200) recs.push({ text: `🍽️ Vous pouvez encore consommer ${Math.round(remaining_cal)} kcal.`, type: '' });
  if (totals.cal > calcGoalCalories(profile) * 1.1) recs.push({ text: `⚠️ Vous avez dépassé votre objectif calorique de ${Math.round(totals.cal - calcGoalCalories(profile))} kcal.`, type: 'danger' });
  if ((log.steps || 0) < targets.steps) recs.push({ text: `👟 Encore ${(targets.steps - log.steps).toLocaleString()} pas pour atteindre votre objectif.`, type: '' });
  if (actTotals.minutes < targetMin) recs.push({ text: `🏃 Visez ${targetMin - actTotals.minutes} minutes d'activité supplémentaires.`, type: '' });

  // Weight progress
  const { weightHistory } = profile;
  if (weightHistory && weightHistory.length > 0) {
    const current = weightHistory[weightHistory.length - 1].weight;
    const diff = Math.abs(current - profile.targetWeight).toFixed(1);
    const direction = current > profile.targetWeight ? 'perdre' : 'prendre';
    if (parseFloat(diff) > 0.5) recs.push({ text: `⚖️ Il vous reste ${diff} kg à ${direction} pour atteindre votre objectif.`, type: 'info' });
    else recs.push({ text: `🎉 Félicitations ! Vous avez atteint votre poids cible !`, type: '' });
  }

  if (recs.length === 0) recs.push({ text: '✅ Excellent travail aujourd\'hui ! Tous vos objectifs sont en bonne voie.', type: '' });

  const recEl = document.getElementById('recommendations');
  recEl.innerHTML = recs.map(r => `<div class="rec-item ${r.type}">${r.text}</div>`).join('');
}

// ============================================================
// FOOD SECTION
// ============================================================

let currentMealTarget = 'breakfast';

function renderFoodSection() {
  const { data, today } = getTodayLog();
  const log = data.logs[today];
  const meals = { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner', snack: 'Collation' };

  Object.entries(meals).forEach(([mealKey, mealLabel]) => {
    const items = log.foods[mealKey] || [];
    const container = document.getElementById(`items-${mealKey}`);
    let mealCal = 0;
    container.innerHTML = items.map((item, idx) => {
      mealCal += item.cal;
      return `
        <div class="food-item">
          <div class="food-item-name">${escHtml(item.name)}</div>
          <div class="food-item-info">${item.qty}g · P:${item.prot}g G:${item.carb}g L:${item.fat}g</div>
          <div class="food-item-cal">${Math.round(item.cal)} kcal</div>
          <button class="food-item-del" onclick="removeFood('${mealKey}',${idx})">🗑️</button>
        </div>`;
    }).join('');
    document.getElementById(`cal-${mealKey}`).textContent = Math.round(mealCal) + ' kcal';
  });
}

function openAddFoodModal(meal = 'breakfast') {
  currentMealTarget = meal;
  document.getElementById('food-meal-select').value = meal;
  document.getElementById('food-name').value = '';
  document.getElementById('food-qty').value = '';
  document.getElementById('food-cal').value = '';
  document.getElementById('food-prot').value = '';
  document.getElementById('food-carb').value = '';
  document.getElementById('food-fat-input').value = '';
  renderFrequentFoods();
  openModal('modal-food');
  resetAIState();
}

function addFood() {
  const name = document.getElementById('food-name').value.trim();
  const qty = parseFloat(document.getElementById('food-qty').value) || 100;
  const cal = parseFloat(document.getElementById('food-cal').value) || 0;
  const prot = parseFloat(document.getElementById('food-prot').value) || 0;
  const carb = parseFloat(document.getElementById('food-carb').value) || 0;
  const fat = parseFloat(document.getElementById('food-fat-input').value) || 0;
  const meal = document.getElementById('food-meal-select').value;

  if (!name) return showToast('Veuillez entrer le nom de l\'aliment');
  if (cal <= 0) return showToast('Veuillez entrer les calories');

  const item = { name, qty, cal: Math.round(cal), prot: Math.round(prot * 10) / 10, carb: Math.round(carb * 10) / 10, fat: Math.round(fat * 10) / 10, ts: Date.now() };

  const { data, today } = getTodayLog();
  const log = data.logs[today];
  log.foods[meal].push(item);
  data.logs[today] = log;
  saveData(data);
  saveFrequentFood(item);

  closeModal('modal-food');
  renderFoodSection();
  renderDashboard();
  showToast(`${name} ajouté ✅`);
}

function removeFood(meal, idx) {
  const { data, today } = getTodayLog();
  const log = data.logs[today];
  log.foods[meal].splice(idx, 1);
  data.logs[today] = log;
  saveData(data);
  renderFoodSection();
  renderDashboard();
}

function searchFood(query) {
  const suggestions = document.getElementById('food-suggestions');
  if (!query || query.length < 2) { suggestions.classList.add('hidden'); return; }
  const q = query.toLowerCase();
  const results = FOOD_DB.filter(f => f.name.toLowerCase().includes(q)).slice(0, 6);
  if (results.length === 0) { suggestions.classList.add('hidden'); return; }
  suggestions.innerHTML = results.map(f => `
    <div class="food-suggestion-item" onclick="selectFoodSuggestion('${escHtml(JSON.stringify(f))}')">
      <span>${f.name}</span>
      <span class="food-suggestion-cal">${f.cal} kcal</span>
    </div>`).join('');
  suggestions.classList.remove('hidden');
}

function selectFoodSuggestion(jsonStr) {
  try {
    const f = JSON.parse(jsonStr);
    openAddFoodModal(currentMealTarget || 'breakfast');
    setTimeout(() => {
      document.getElementById('food-name').value = f.name;
      document.getElementById('food-qty').value = 100;
      document.getElementById('food-cal').value = f.cal;
      document.getElementById('food-prot').value = f.prot;
      document.getElementById('food-carb').value = f.carb;
      document.getElementById('food-fat-input').value = f.fat;
      document.getElementById('food-suggestions').classList.add('hidden');
      document.getElementById('food-search').value = '';
    }, 100);
  } catch(e) {}
}

function saveFrequentFood(item) {
  const data = loadData();
  if (!data.frequentFoods) data.frequentFoods = [];
  const existing = data.frequentFoods.findIndex(f => f.name.toLowerCase() === item.name.toLowerCase());
  if (existing >= 0) {
    data.frequentFoods[existing].count = (data.frequentFoods[existing].count || 0) + 1;
  } else {
    data.frequentFoods.push({ ...item, count: 1 });
  }
  data.frequentFoods.sort((a, b) => (b.count || 0) - (a.count || 0));
  data.frequentFoods = data.frequentFoods.slice(0, 20);
  saveData(data);
}

function renderFrequentFoods() {
  const data = loadData();
  const foods = (data.frequentFoods || []).slice(0, 8);
  const container = document.getElementById('frequent-foods-list');
  container.innerHTML = foods.map(f => `
    <div class="freq-item" onclick="fillFoodFromFrequent('${escHtml(JSON.stringify(f))}')">${f.name}</div>
  `).join('');
}

function fillFoodFromFrequent(jsonStr) {
  try {
    const f = JSON.parse(jsonStr);
    document.getElementById('food-name').value = f.name;
    document.getElementById('food-qty').value = f.qty || 100;
    document.getElementById('food-cal').value = f.cal;
    document.getElementById('food-prot').value = f.prot;
    document.getElementById('food-carb').value = f.carb;
    document.getElementById('food-fat-input').value = f.fat;
  } catch(e) {}
}

// ============================================================
// ACTIVITY SECTION
// ============================================================

let currentActivity = 'marche';

function renderActivitySection() {
  const { data, today } = getTodayLog();
  const log = data.logs[today];
  const actTotals = getActivityTotals(log);

  document.getElementById('act-total-cal').textContent = actTotals.burnedCal;
  document.getElementById('act-total-min').textContent = actTotals.minutes;

  const list = document.getElementById('activity-list');
  const activities = log.activities || [];
  if (activities.length === 0) {
    list.innerHTML = '<div class="rec-item info">Aucune activité enregistrée aujourd\'hui.</div>';
    return;
  }
  list.innerHTML = activities.map((a, idx) => {
    const meta = ACTIVITY_META[a.type] || ACTIVITY_META.autre;
    return `
      <div class="activity-item">
        <div class="act-item-icon">${meta.icon}</div>
        <div class="act-item-info">
          <div class="act-item-name">${a.label || meta.label}</div>
          <div class="act-item-detail">${a.duration} min · Intensité : ${a.intensity}</div>
        </div>
        <div class="act-item-cal">-${a.calories} kcal</div>
        <button class="act-item-del" onclick="removeActivity(${idx})">🗑️</button>
      </div>`;
  }).join('');
}

function openActivityModal(type) {
  currentActivity = type;
  const meta = ACTIVITY_META[type] || ACTIVITY_META.autre;
  document.getElementById('activity-modal-title').textContent = `${meta.icon} ${meta.label}`;
  document.getElementById('act-duration').value = '';
  document.getElementById('act-intensity').value = 'modere';
  document.getElementById('cal-preview').textContent = '—';
  document.getElementById('act-custom-name-group').style.display = type === 'autre' ? 'block' : 'none';

  // Live cal estimate
  const durationEl = document.getElementById('act-duration');
  const intensityEl = document.getElementById('act-intensity');
  const updatePreview = () => {
    const dur = parseInt(durationEl.value) || 0;
    const intensity = intensityEl.value;
    const cpm = meta.calPerMin[intensity] || 6;
    document.getElementById('cal-preview').textContent = Math.round(cpm * dur) + ' kcal';
  };
  durationEl.oninput = updatePreview;
  intensityEl.onchange = updatePreview;

  openModal('modal-activity');
}

function addActivity() {
  const duration = parseInt(document.getElementById('act-duration').value);
  const intensity = document.getElementById('act-intensity').value;
  if (!duration || duration < 1) return showToast('Veuillez entrer une durée valide');

  const meta = ACTIVITY_META[currentActivity] || ACTIVITY_META.autre;
  const cpm = meta.calPerMin[intensity] || 6;
  const calories = Math.round(cpm * duration);
  const customName = document.getElementById('act-custom-name').value.trim();

  const activity = {
    type: currentActivity,
    label: customName || meta.label,
    duration,
    intensity,
    calories,
    ts: Date.now(),
  };

  const { data, today } = getTodayLog();
  const log = data.logs[today];
  if (!log.activities) log.activities = [];
  log.activities.push(activity);
  data.logs[today] = log;
  saveData(data);

  closeModal('modal-activity');
  renderActivitySection();
  renderDashboard();
  showToast(`Activité enregistrée : -${calories} kcal 🔥`);
}

function removeActivity(idx) {
  const { data, today } = getTodayLog();
  const log = data.logs[today];
  log.activities.splice(idx, 1);
  data.logs[today] = log;
  saveData(data);
  renderActivitySection();
  renderDashboard();
}

// ============================================================
// WATER
// ============================================================

function addWater(amount) {
  const { data, today } = getTodayLog();
  const log = data.logs[today];
  log.water = Math.round((log.water + amount) * 100) / 100;
  data.logs[today] = log;
  saveData(data);
  renderDashboard();
  showToast(`+${amount * 1000}ml d'eau 💧`);
}

// ============================================================
// STEPS
// ============================================================

function promptSteps() {
  const { data, today } = getTodayLog();
  const log = data.logs[today];
  document.getElementById('steps-input').value = log.steps || '';
  openModal('modal-steps');
}

function saveSteps() {
  const steps = parseInt(document.getElementById('steps-input').value);
  if (isNaN(steps) || steps < 0) return showToast('Veuillez entrer un nombre valide');

  const { data, today } = getTodayLog();
  const log = data.logs[today];
  log.steps = steps;
  data.logs[today] = log;
  saveData(data);

  closeModal('modal-steps');
  renderDashboard();
  showToast(`Pas mis à jour : ${steps.toLocaleString()} 👟`);
}

// ============================================================
// WEIGHT LOG
// ============================================================

function logWeight() {
  const weight = parseFloat(document.getElementById('weight-input').value);
  if (!weight || weight < 20 || weight > 300) return showToast('Veuillez entrer un poids valide');

  const data = loadData();
  if (!data.profile.weightHistory) data.profile.weightHistory = [];

  const today = TODAY();
  const existing = data.profile.weightHistory.findIndex(w => w.date === today);
  if (existing >= 0) data.profile.weightHistory[existing].weight = weight;
  else data.profile.weightHistory.push({ date: today, weight });

  // Keep last 90 days
  data.profile.weightHistory = data.profile.weightHistory.slice(-90);
  saveData(data);
  renderStats('weight');
  renderGoals();
  showToast(`Poids enregistré : ${weight} kg ⚖️`);
}

// ============================================================
// STATISTICS CHARTS
// ============================================================

let statChart = null;
let currentStatTab = 'weight';

function switchStatTab(tab, btn) {
  currentStatTab = tab;
  document.querySelectorAll('.stats-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderStats(tab);
}

function renderStats(tab = currentStatTab) {
  const data = loadData();
  const logs = data.logs || {};
  const profile = data.profile || {};

  const sortedDates = Object.keys(logs).sort().slice(-30);
  if (sortedDates.length === 0) {
    document.getElementById('chart-empty').style.display = 'flex';
    return;
  }
  document.getElementById('chart-empty').style.display = 'none';

  let labels = [], values = [], label = '', color = '';

  if (tab === 'weight') {
    const wh = (profile.weightHistory || []).slice(-30);
    labels = wh.map(w => formatDateShort(w.date));
    values = wh.map(w => w.weight);
    label = 'Poids (kg)';
    color = '#4ade80';
  } else if (tab === 'calories') {
    labels = sortedDates.map(d => formatDateShort(d));
    values = sortedDates.map(d => getTodayTotals(logs[d]).cal);
    label = 'Calories (kcal)';
    color = '#f97316';
  } else if (tab === 'water') {
    labels = sortedDates.map(d => formatDateShort(d));
    values = sortedDates.map(d => logs[d].water || 0);
    label = 'Eau (L)';
    color = '#38bdf8';
  } else if (tab === 'steps') {
    labels = sortedDates.map(d => formatDateShort(d));
    values = sortedDates.map(d => logs[d].steps || 0);
    label = 'Pas';
    color = '#22d3ee';
  }

  if (labels.length < 2) {
    document.getElementById('chart-empty').style.display = 'flex';
    return;
  }

  drawChart(labels, values, label, color);
}

function drawChart(labels, values, label, color) {
  const canvas = document.getElementById('stat-chart');
  const ctx = canvas.getContext('2d');
  const W = canvas.parentElement.clientWidth - 32;
  const H = 180;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  if (values.length < 2) return;

  const pad = { top: 16, right: 16, bottom: 24, left: 40 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const minV = Math.min(...values) * 0.97;
  const maxV = Math.max(...values) * 1.03;
  const range = maxV - minV || 1;

  const xStep = chartW / (values.length - 1);
  const toX = i => pad.left + i * xStep;
  const toY = v => pad.top + chartH - ((v - minV) / range) * chartH;

  // Grid lines
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
  grad.addColorStop(0, color + '50');
  grad.addColorStop(1, color + '00');
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(values[0]));
  values.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
  ctx.lineTo(toX(values.length - 1), H - pad.bottom);
  ctx.lineTo(toX(0), H - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(values[0]));
  values.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Points
  values.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(toX(i), toY(v), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  // Labels (every ~5 entries)
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  ctx.font = '10px DM Sans, sans-serif';
  ctx.textAlign = 'center';
  const step = Math.ceil(labels.length / 6);
  labels.forEach((lbl, i) => {
    if (i % step === 0 || i === labels.length - 1)
      ctx.fillText(lbl, toX(i), H - 4);
  });
}

// ============================================================
// GOALS SECTION
// ============================================================

function renderGoals() {
  const data = loadData();
  const profile = data.profile;
  const { data: allData, today } = getTodayLog();
  const log = allData.logs[today];
  const targets = {
    calories: calcGoalCalories(profile),
    water: calcWater(profile),
    steps: calcSteps(profile),
    activity: calcActivityMinutes(profile),
  };
  const macros = calcMacros(profile);
  const totals = getTodayTotals(log);
  const actTotals = getActivityTotals(log);

  // Weight goal
  const wh = profile.weightHistory || [];
  const currentWeight = wh.length > 0 ? wh[wh.length - 1].weight : profile.weight;
  const startWeight = wh.length > 0 ? wh[0].weight : profile.weight;
  const totalNeeded = Math.abs(startWeight - profile.targetWeight);
  const done = Math.abs(startWeight - currentWeight);
  const weightPct = totalNeeded > 0 ? Math.min(done / totalNeeded * 100, 100) : 100;

  const goals = [
    {
      icon: '⚖️', title: 'Poids cible',
      current: `${currentWeight} kg`, target: `${profile.targetWeight} kg`,
      pct: Math.round(weightPct),
    },
    {
      icon: '🔥', title: 'Calories',
      current: `${totals.cal} kcal`, target: `${targets.calories} kcal`,
      pct: Math.min(Math.round(totals.cal / targets.calories * 100), 100),
    },
    {
      icon: '💧', title: 'Hydratation',
      current: `${log.water.toFixed(1)} L`, target: `${targets.water} L`,
      pct: Math.min(Math.round(log.water / targets.water * 100), 100),
    },
    {
      icon: '👟', title: 'Pas quotidiens',
      current: `${(log.steps || 0).toLocaleString()}`, target: `${targets.steps.toLocaleString()}`,
      pct: Math.min(Math.round((log.steps || 0) / targets.steps * 100), 100),
    },
    {
      icon: '🥩', title: 'Protéines',
      current: `${totals.prot}g`, target: `${macros.protein}g`,
      pct: Math.min(Math.round(totals.prot / macros.protein * 100), 100),
    },
    {
      icon: '🏃', title: 'Activité physique',
      current: `${actTotals.minutes} min`, target: `${targets.activity} min`,
      pct: Math.min(Math.round(actTotals.minutes / targets.activity * 100), 100),
    },
  ];

  const container = document.getElementById('goals-list');
  container.innerHTML = goals.map(g => `
    <div class="goal-progress-card">
      <div class="goal-p-header">
        <div class="goal-p-title">${g.icon} ${g.title}</div>
        <div class="goal-p-pct">${g.pct}%</div>
      </div>
      <div class="goal-p-bar-wrap"><div class="goal-p-bar" style="width:${g.pct}%"></div></div>
      <div class="goal-p-detail"><span>${g.current}</span><span>${g.target}</span></div>
    </div>
  `).join('');
}

// ============================================================
// PROFILE SECTION
// ============================================================

function renderProfile() {
  const data = loadData();
  const profile = data.profile;
  const imc = calcIMC(profile);
  const cals = calcGoalCalories(profile);
  const water = calcWater(profile);

  document.getElementById('profile-name-display').textContent = profile.name;
  document.getElementById('ps-imc').textContent = imc;
  document.getElementById('ps-cal').textContent = cals;
  document.getElementById('ps-water').textContent = water + 'L';

  // Avatar
  if (profile.avatarData) {
    const img = document.createElement('img');
    img.src = profile.avatarData;
    img.alt = 'Avatar';
    const av = document.getElementById('profile-avatar');
    av.querySelector('#avatar-initials').style.display = 'none';
    av.appendChild(img);
  }

  const goalLabels = {
    perte_poids: 'Perte de poids', prise_masse: 'Prise de masse',
    maintien: 'Maintien', sante: 'Santé générale', performance: 'Performance sportive',
  };
  const actLabels = {
    sedentaire: 'Sédentaire', leger: 'Légèrement actif',
    modere: 'Modérément actif', actif: 'Très actif', extreme: 'Extrêmement actif',
  };

  const wh = profile.weightHistory || [];
  const currentW = wh.length > 0 ? wh[wh.length - 1].weight : profile.weight;
  const totalKgToGo = Math.abs(currentW - profile.targetWeight).toFixed(1);

  const infos = [
    ['Sexe', profile.sex === 'homme' ? '♂ Homme' : '♀ Femme'],
    ['Âge', profile.age + ' ans'],
    ['Taille', profile.height + ' cm'],
    ['Poids actuel', currentW + ' kg'],
    ['Poids cible', profile.targetWeight + ' kg'],
    ['Écart restant', totalKgToGo + ' kg'],
    ['IMC', imc + ' — ' + calcIMCStatus(parseFloat(imc))],
    ['Objectif', goalLabels[profile.goal] || profile.goal],
    ['Activité', actLabels[profile.activity] || profile.activity],
    ['Régime', profile.diet],
    ['Allergies', (profile.allergies || []).join(', ') || 'Aucune'],
    ['Kcal / jour', cals + ' kcal'],
    ['Eau / jour', water + ' L'],
    ['Pas / jour', calcSteps(profile).toLocaleString()],
  ];

  document.getElementById('profile-info-list').innerHTML = infos.map(([lbl, val]) => `
    <div class="info-row">
      <span class="info-label">${lbl}</span>
      <span class="info-value">${val}</span>
    </div>`).join('');

  // Show API key status
  showApiKeyStatus();
}

function changeAvatar() {
  document.getElementById('avatar-input').click();
}

function handleAvatarChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = loadData();
    data.profile.avatarData = e.target.result;
    saveData(data);
    renderProfile();
    showToast('Photo de profil mise à jour 📷');
  };
  reader.readAsDataURL(file);
}

// ============================================================
// EXPORT
// ============================================================

function exportCSV() {
  const data = loadData();
  const logs = data.logs || {};
  const profile = data.profile;
  const macros = calcMacros(profile);

  let csv = 'Date,Calories,Protéines(g),Glucides(g),Lipides(g),Eau(L),Pas,Calories brûlées\n';
  Object.entries(logs).sort().forEach(([date, log]) => {
    const t = getTodayTotals(log);
    const a = getActivityTotals(log);
    csv += `${date},${t.cal},${t.prot},${t.carb},${t.fat},${log.water || 0},${log.steps || 0},${a.burnedCal}\n`;
  });

  if (data.profile.weightHistory) {
    csv += '\nDate,Poids(kg)\n';
    data.profile.weightHistory.forEach(w => {
      csv += `${w.date},${w.weight}\n`;
    });
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vitalis_export_${TODAY()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export CSV téléchargé 📊');
}

function exportPDF() {
  const data = loadData();
  const profile = data.profile;
  if (!profile) return;
  const { data: allData, today } = getTodayLog();
  const log = allData.logs[today];
  const totals = getTodayTotals(log);
  const macros = calcMacros(profile);
  const imc = calcIMC(profile);
  const score = calcHealthScore(profile, log);
  const actTotals = getActivityTotals(log);

  const content = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Vitalis - Rapport ${today}</title>
<style>
  body { font-family: 'DM Sans', Helvetica, sans-serif; color: #111; padding: 40px; max-width: 700px; margin: 0 auto; }
  h1 { color: #16a34a; font-size: 28px; margin-bottom: 4px; }
  h2 { font-size: 16px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 24px; }
  .badge { display: inline-block; background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 99px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  td:first-child { color: #666; }
  td:last-child { font-weight: 600; text-align: right; }
  .score { font-size: 48px; font-weight: 800; color: #16a34a; }
</style></head><body>
<h1>🌿 Vitalis</h1>
<p>Rapport du ${formatDate(today)} · <strong>${profile.name}</strong> <span class="badge">Score ${score}/100</span></p>
<h2>Profil</h2>
<table>
  <tr><td>IMC</td><td>${imc} (${calcIMCStatus(parseFloat(imc))})</td></tr>
  <tr><td>Objectif</td><td>${profile.goal}</td></tr>
  <tr><td>Poids</td><td>${profile.weight} kg → ${profile.targetWeight} kg</td></tr>
</table>
<h2>Bilan du jour</h2>
<table>
  <tr><td>Calories</td><td>${totals.cal} / ${calcGoalCalories(profile)} kcal</td></tr>
  <tr><td>Protéines</td><td>${totals.prot}g / ${macros.protein}g</td></tr>
  <tr><td>Glucides</td><td>${totals.carb}g / ${macros.carbs}g</td></tr>
  <tr><td>Lipides</td><td>${totals.fat}g / ${macros.fat}g</td></tr>
  <tr><td>Eau</td><td>${log.water}L / ${calcWater(profile)}L</td></tr>
  <tr><td>Pas</td><td>${(log.steps || 0).toLocaleString()} / ${calcSteps(profile).toLocaleString()}</td></tr>
  <tr><td>Activité</td><td>${actTotals.minutes} min · ${actTotals.burnedCal} kcal brûlées</td></tr>
</table>
<p style="margin-top:40px;font-size:12px;color:#aaa">Généré par Vitalis — ${new Date().toLocaleString('fr-FR')}</p>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(content);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
  showToast('Rapport PDF ouvert 📄');
}

// ============================================================
// SECTIONS & NAVIGATION
// ============================================================

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`section-${name}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.section === name);
  });

  // Refresh on switch
  if (name === 'dashboard') renderDashboard();
  if (name === 'food') renderFoodSection();
  if (name === 'activity') renderActivitySection();
  if (name === 'stats') renderStats(currentStatTab);
  if (name === 'goals') renderGoals();
  if (name === 'profile') renderProfile();

  window.scrollTo(0, 0);
}

// ============================================================
// MODALS
// ============================================================

function openModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ============================================================
// THEME
// ============================================================

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  const data = loadData();
  data.theme = next;
  saveData(data);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0f0f13' : '#f4f4f8';
}

// ============================================================
// STEPPER
// ============================================================

function stepperChange(id, delta) {
  const el = document.getElementById(id);
  const min = parseInt(el.min) || 1;
  const max = parseInt(el.max) || 99;
  el.value = Math.max(min, Math.min(max, (parseInt(el.value) || 0) + delta));
}

// ============================================================
// WATER REMINDER
// ============================================================

function scheduleWaterReminder() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') setupReminders();
    });
  } else if (Notification.permission === 'granted') {
    setupReminders();
  }
}

function setupReminders() {
  const check = () => {
    const { data, today } = getTodayLog();
    const log = data.logs[today];
    const profile = data.profile;
    if (!profile) return;
    const target = calcWater(profile);
    if (log.water < target * 0.5) {
      new Notification('💧 Vitalis — Hydratation', {
        body: `N'oubliez pas de boire ! Vous avez bu ${log.water}L sur ${target}L recommandés.`,
        icon: '🌿',
      });
    }
  };
  // Check every 2 hours
  setInterval(check, 2 * 60 * 60 * 1000);
}

// ============================================================
// TOAST
// ============================================================

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2800);
  return false; // prevent form submission
}

// ============================================================
// RESET
// ============================================================

function resetApp() {
  if (!confirm('Êtes-vous sûr de vouloir réinitialiser toutes les données ? Cette action est irréversible.')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

// ============================================================
// UTILITIES
// ============================================================

function escHtml(str) {
  if (typeof str !== 'string') str = JSON.stringify(str);
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

// ============================================================
// BOOT
// ============================================================

document.addEventListener('DOMContentLoaded', bootAuth);

// ============================================================
// HEALTH SCORE — ENHANCED RENDER
// ============================================================

const SCORE_LEVELS = [
  { min: 90, label: '🏆 Excellent', color: '#4ade80' },
  { min: 75, label: '⭐ Très bien', color: '#22d3ee' },
  { min: 55, label: '👍 Bien',     color: '#a78bfa' },
  { min: 35, label: '📈 En progrès', color: '#f97316' },
  { min: 0,  label: '🌱 Débutant',  color: '#f43f5e' },
];

function getScoreLevel(score) {
  return SCORE_LEVELS.find(l => score >= l.min) || SCORE_LEVELS[SCORE_LEVELS.length - 1];
}

// Detailed score breakdown: returns object with sub-scores
function calcHealthScoreDetailed(profile, log) {
  const targets = {
    calories: calcGoalCalories(profile),
    water:    calcWater(profile),
    steps:    calcSteps(profile),
  };
  const macros   = calcMacros(profile);
  const totals   = getTodayTotals(log);
  const actTot   = getActivityTotals(log);

  // Calories (25)
  const calRatio = totals.cal / targets.calories;
  const sCal = calRatio >= 0.8 && calRatio <= 1.1 ? 25
             : calRatio >= 0.6 ? 15
             : totals.cal > 0 ? 5 : 0;
  // Protein (20)
  const sProt = totals.prot >= macros.protein * 0.8 ? 20
              : totals.prot >= macros.protein * 0.5 ? 10 : 0;
  // Water (25)
  const wRatio = log.water / targets.water;
  const sWater = wRatio >= 0.9 ? 25
               : wRatio >= 0.6 ? 15
               : log.water > 0 ? 5 : 0;
  // Steps (20)
  const sSteps = log.steps >= targets.steps ? 20
               : log.steps >= targets.steps * 0.7 ? 12
               : log.steps > 0 ? 5 : 0;
  // Activity (10)
  const sAct = actTot.minutes >= calcActivityMinutes(profile) ? 10
             : actTot.minutes >= 15 ? 5 : 0;

  return {
    total: sCal + sProt + sWater + sSteps + sAct,
    cal:   { pts: sCal,   max: 25, pct: Math.round((sCal/25)*100) },
    prot:  { pts: sProt,  max: 20, pct: Math.round((sProt/20)*100) },
    water: { pts: sWater, max: 25, pct: Math.round((sWater/25)*100) },
    steps: { pts: sSteps, max: 20, pct: Math.round((sSteps/20)*100) },
    act:   { pts: sAct,   max: 10, pct: Math.round((sAct/10)*100) },
  };
}

function renderHealthScore(profile, log) {
  const detail = calcHealthScoreDetailed(profile, log);
  const score  = detail.total;
  const level  = getScoreLevel(score);

  // r=34 → circumference = 2π×34 ≈ 213.6 → use 214
  const CIRC = 214;
  const targetOffset = CIRC - (CIRC * score / 100);
  const arc = document.getElementById('score-arc');
  if (arc) {
    // Force reflow then animate
    arc.style.transition = 'none';
    arc.style.strokeDashoffset = CIRC;
    arc.getBoundingClientRect(); // trigger reflow
    arc.style.transition = 'stroke-dashoffset 1s ease';
    arc.style.strokeDashoffset = targetOffset;
  }

  // Count-up animation for number
  const valEl = document.getElementById('score-value');
  if (valEl) {
    const start = parseInt(valEl.dataset.score || '0');
    valEl.dataset.score = score;
    const duration = 900;
    const startTime = performance.now();
    const animate = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      valEl.textContent = Math.round(start + (score - start) * ease);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // Level badge
  const badge = document.getElementById('score-level-badge');
  if (badge) {
    badge.textContent = level.label;
    badge.style.background   = level.color + '22';
    badge.style.color        = level.color;
    badge.style.borderColor  = level.color + '55';
  }

  // Breakdown pills
  const pills = { cal: detail.cal, prot: detail.prot, water: detail.water, steps: detail.steps, act: detail.act };
  Object.entries(pills).forEach(([key, d]) => {
    const bar  = document.getElementById(`pbar-${key}`);
    const pts  = document.getElementById(`ppts-${key}`);
    if (!bar || !pts) return;
    const col = d.pct >= 80 ? '#4ade80' : d.pct >= 50 ? '#22d3ee' : d.pct > 0 ? '#f97316' : 'rgba(244,63,94,0.3)';
    bar.style.background = col;
    // Animate bar width
    bar.style.transition = 'none';
    bar.style.width = '0%';
    bar.getBoundingClientRect();
    bar.style.transition = 'width 0.9s ease';
    bar.style.width = d.pct + '%';
    pts.textContent = `${d.pts}/${d.max}`;
  });
}

// ============================================================
// PWA INSTALL
// ============================================================

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  // Show banner after 3s if not dismissed
  setTimeout(() => {
    const data = loadData();
    if (!data.pwaDismissed) showPWABanner();
  }, 3000);
});

window.addEventListener('appinstalled', () => {
  hidePWABanner();
  showToast('✅ Vitalis installé sur votre écran d\'accueil !');
  deferredPrompt = null;
});

function showPWABanner() {
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.classList.remove('hidden');
}

function hidePWABanner() {
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.classList.add('hidden');
}

function installPWA() {
  if (!deferredPrompt) {
    showToast('Pour installer : Menu du navigateur → "Ajouter à l\'écran d\'accueil"');
    return;
  }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(choice => {
    if (choice.outcome === 'accepted') {
      showToast('Installation en cours… 🚀');
    }
    deferredPrompt = null;
    hidePWABanner();
  });
}

function dismissPWA() {
  hidePWABanner();
  const data = loadData();
  data.pwaDismissed = true;
  saveData(data);
}

// ============================================================
// API KEY MANAGEMENT (universel — Gemini / OpenRouter / Groq)
// ============================================================

function detectProvider(key) {
  if (!key) return null;
  if (key.startsWith('AQ') || key.startsWith('AI')) return 'gemini';
  if (key.startsWith('sk-or')) return 'openrouter';
  if (key.startsWith('gsk_')) return 'groq';
  return 'openrouter'; // fallback
}

function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return showToast('Entre ta clé API');
  // Sauvegarder localement
  localStorage.setItem('vitalis_ai_key', key);
  // Sauvegarder dans le cloud aussi
  const data = loadData();
  data._apiKey = key;
  saveData(data);
  document.getElementById('api-key-input').value = '';
  showApiKeyStatus(true);
  showToast('✅ Clé API sauvegardée !');
}

function getApiKey() {
  // D'abord essayer le localStorage, sinon chercher dans les données cloud
  const local = localStorage.getItem('vitalis_ai_key')
      || localStorage.getItem('vitalis_openrouter_key')
      || localStorage.getItem('vitalis_gemini_key');
  if (local) return local;
  // Fallback : dans les données sauvegardées
  try {
    const data = loadData();
    if (data._apiKey) {
      localStorage.setItem('vitalis_ai_key', data._apiKey); // recache localement
      return data._apiKey;
    }
  } catch(e) {}
  return '';
}

function showApiKeyStatus(saved) {
  const el = document.getElementById('api-key-status');
  if (!el) return;
  const key = getApiKey();
  const provider = detectProvider(key);
  const providerName = provider === 'gemini' ? 'Gemini' : provider === 'groq' ? 'Groq' : 'OpenRouter';
  if (saved || key) {
    const masked = key ? key.substring(0, 8) + '••••••••••••' : '••••••••••••';
    el.innerHTML = `<span class="api-key-ok">✅ Clé ${providerName} configurée (${masked}) — IA activée</span>`;
  } else {
    el.innerHTML = '<span class="api-key-missing">⚠️ Aucune clé configurée — colle ta clé Gemini, OpenRouter ou Groq</span>';
  }
}

// Call on profile render
const _origRenderProfile = typeof renderProfile === 'function' ? renderProfile : null;

// ============================================================
// AI FOOD ANALYSIS — UNIVERSEL (Gemini / OpenRouter / Groq)
// ============================================================

async function analyzeWithAI() {
  const name = document.getElementById('food-name').value.trim();
  const qty  = parseFloat(document.getElementById('food-qty').value) || 100;

  if (!name) {
    showToast('Entre d\'abord le nom de l\'aliment 👆');
    document.getElementById('food-name').focus();
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    showToast('⚠️ Configure ta clé API dans Profil');
    return;
  }

  const provider = detectProvider(apiKey);

  // UI — loading state
  const btn    = document.getElementById('btn-ai-analyze');
  const status = document.getElementById('ai-status');
  btn.classList.add('ai-loading');
  btn.disabled = true;
  status.innerHTML = '<span class="ai-thinking">✨ Analyse en cours…</span>';

  const prompt = `Tu es un expert en nutrition. Donne les valeurs nutritionnelles POUR ${qty}g (ou ml) de "${name}".
Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après, sans backticks :
{"cal": <nombre entier>, "prot": <décimal 1 chiffre>, "carb": <décimal 1 chiffre>, "fat": <décimal 1 chiffre>, "fiber": <décimal 1 chiffre>, "sugar": <décimal 1 chiffre>, "name": "<nom propre de l'aliment>"}
Si l'aliment n'existe pas ou est inconnu, retourne {"error": "inconnu"}.`;

  try {
    let raw = '';

    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
          })
        }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    } else if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1, max_tokens: 256
        })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      raw = data.choices?.[0]?.message?.content || '';

    } else {
      // OpenRouter (défaut)
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'Vitalis'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1, max_tokens: 256
        })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      raw = data.choices?.[0]?.message?.content || '';
    }

    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (parsed.error) {
      status.innerHTML = '<span class="ai-error">❌ Aliment non reconnu, remplis manuellement</span>';
      btn.classList.remove('ai-loading');
      btn.disabled = false;
      return;
    }

    // Fill form fields
    if (parsed.name) document.getElementById('food-name').value = parsed.name;
    document.getElementById('food-cal').value  = parsed.cal  ?? '';
    document.getElementById('food-prot').value = parsed.prot ?? '';
    document.getElementById('food-carb').value = parsed.carb ?? '';
    document.getElementById('food-fat-input').value = parsed.fat ?? '';

    // Show result summary
    status.innerHTML = `
      <div class="ai-result">
        <div class="ai-result-title">✨ Macros pour ${qty}g de ${parsed.name || name}</div>
        <div class="ai-result-grid">
          <div class="ai-macro"><span class="ai-macro-val">${parsed.cal}</span><span class="ai-macro-lbl">kcal</span></div>
          <div class="ai-macro"><span class="ai-macro-val">${parsed.prot}g</span><span class="ai-macro-lbl">Protéines</span></div>
          <div class="ai-macro"><span class="ai-macro-val">${parsed.carb}g</span><span class="ai-macro-lbl">Glucides</span></div>
          <div class="ai-macro"><span class="ai-macro-val">${parsed.fat}g</span><span class="ai-macro-lbl">Lipides</span></div>
          ${parsed.fiber ? `<div class="ai-macro"><span class="ai-macro-val">${parsed.fiber}g</span><span class="ai-macro-lbl">Fibres</span></div>` : ''}
          ${parsed.sugar ? `<div class="ai-macro"><span class="ai-macro-val">${parsed.sugar}g</span><span class="ai-macro-lbl">Sucres</span></div>` : ''}
        </div>
      </div>`;

    btn.innerHTML = `<span class="ai-btn-icon">✅</span><div class="ai-btn-labels"><span class="ai-btn-text">Macros remplis !</span><span class="ai-btn-sub">Clique "Ajouter" pour confirmer</span></div>`;

  } catch (e) {
    console.error('AI error:', e);
    if (e.message.includes('401') || e.message.includes('API_KEY') || e.message.includes('auth')) {
      status.innerHTML = '<span class="ai-error">❌ Clé API invalide — vérifie dans Profil</span>';
    } else {
      status.innerHTML = `<span class="ai-error">❌ Erreur : ${e.message}</span>`;
    }
  } finally {
    btn.classList.remove('ai-loading');
    btn.disabled = false;
  }
}

// Reset AI button when modal closes or food-name changes
document.addEventListener('DOMContentLoaded', () => {
  // Show key status on profile tab
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(showApiKeyStatus, 100);
    });
  });

  // Reset AI state when food name is manually changed
  const nameInput = document.getElementById('food-name');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const btn = document.getElementById('btn-ai-analyze');
      const status = document.getElementById('ai-status');
      if (btn) btn.innerHTML = `<span class="ai-btn-icon">✨</span><div class="ai-btn-labels"><span class="ai-btn-text">Analyser avec l'IA</span><span class="ai-btn-sub">Remplissage automatique des macros</span></div>`;
      if (status) status.innerHTML = '';
    });
  }
});

// Reset AI state when food modal opens — called from original openAddFoodModal
function resetAIState() {
  setTimeout(() => {
    const btn = document.getElementById('btn-ai-analyze');
    const status = document.getElementById('ai-status');
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('ai-loading');
      btn.innerHTML = `<span class="ai-btn-icon">✨</span><div class="ai-btn-labels"><span class="ai-btn-text">Analyser avec l'IA</span><span class="ai-btn-sub">Remplissage automatique des macros</span></div>`;
    }
    if (status) status.innerHTML = '';
  }, 50);
}
