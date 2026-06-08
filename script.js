/* =============================================
   VITALIS — Health & Fitness App
   JavaScript — Full Application Logic
   ============================================= */

'use strict';

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

const FOOD_DB = [
  { name: 'Blanc de poulet (100g)', cal: 165, prot: 31, carb: 0, fat: 3.6 },
  { name: 'Riz cuit (100g)', cal: 130, prot: 2.7, carb: 28, fat: 0.3 },
  { name: 'Œuf entier', cal: 78, prot: 6, carb: 0.6, fat: 5 },
  { name: 'Saumon (100g)', cal: 208, prot: 20, carb: 0, fat: 13 },
  { name: 'Avocat (100g)', cal: 160, prot: 2, carb: 9, fat: 15 },
  { name: 'Banane', cal: 89, prot: 1.1, carb: 23, fat: 0.3 },
  { name: 'Yaourt grec (100g)', cal: 59, prot: 10, carb: 3.6, fat: 0.4 },
  { name: 'Flocons d\'avoine (100g)', cal: 389, prot: 17, carb: 66, fat: 7 },
  { name: 'Lait écrémé (250ml)', cal: 86, prot: 8.7, carb: 12, fat: 0.4 },
  { name: 'Amandes (30g)', cal: 174, prot: 6, carb: 6, fat: 15 },
  { name: 'Épinards (100g)', cal: 23, prot: 2.9, carb: 3.6, fat: 0.4 },
  { name: 'Brocoli (100g)', cal: 34, prot: 2.8, carb: 7, fat: 0.4 },
  { name: 'Pomme de terre (100g)', cal: 77, prot: 2, carb: 17, fat: 0.1 },
  { name: 'Thon en boîte (100g)', cal: 116, prot: 25, carb: 0, fat: 1 },
  { name: 'Pain complet (tranche)', cal: 69, prot: 3.6, carb: 12, fat: 1 },
  { name: 'Fromage blanc 0% (100g)', cal: 45, prot: 7.5, carb: 4.1, fat: 0.1 },
  { name: 'Quinoa cuit (100g)', cal: 120, prot: 4.4, carb: 21, fat: 1.9 },
  { name: 'Lentilles cuites (100g)', cal: 116, prot: 9, carb: 20, fat: 0.4 },
  { name: 'Steak haché 5% (100g)', cal: 121, prot: 21, carb: 0, fat: 5 },
  { name: 'Fraises (100g)', cal: 32, prot: 0.7, carb: 7.7, fat: 0.3 },
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

document.addEventListener('DOMContentLoaded', initApp);

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

  // Big circle arc
  const circ   = 214;
  const offset = circ - (circ * score / 100);
  const arc    = document.getElementById('score-arc');
  if (arc) {
    // Animate from current to new value
    const currentOffset = parseFloat(arc.style.strokeDashoffset) || circ;
    arc.style.strokeDashoffset = currentOffset; // reset first
    requestAnimationFrame(() => { arc.style.strokeDashoffset = offset; });
  }

  // Number (count-up animation)
  const valEl = document.getElementById('score-value');
  if (valEl) {
    const start = parseInt(valEl.textContent) || 0;
    const duration = 800;
    const startTime = performance.now();
    const animate = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      valEl.textContent = Math.round(start + (score - start) * t);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // Level badge
  const badge = document.getElementById('score-level-badge');
  if (badge) {
    badge.textContent = level.label;
    badge.style.background = level.color + '22';
    badge.style.color       = level.color;
    badge.style.borderColor = level.color + '55';
  }

  // Breakdown pills
  const pills = {
    cal:   detail.cal,
    prot:  detail.prot,
    water: detail.water,
    steps: detail.steps,
    act:   detail.act,
  };
  Object.entries(pills).forEach(([key, d]) => {
    const bar  = document.getElementById(`pbar-${key}`);
    const pts  = document.getElementById(`ppts-${key}`);
    const pill = document.getElementById(`pill-${key}`);
    if (bar)  bar.style.width = d.pct + '%';
    if (pts)  pts.textContent = `${d.pts}/${d.max}`;
    if (pill) {
      // Color bar based on progress
      const col = d.pct >= 80 ? '#4ade80' : d.pct >= 50 ? '#22d3ee' : d.pct > 0 ? '#f97316' : '#f43f5e22';
      bar.style.background = col;
    }
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
