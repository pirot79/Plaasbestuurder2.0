import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         onAuthStateChanged, signOut, browserLocalPersistence, setPersistence } from "firebase/auth";

// ── Firebase ───────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_ID,
  appId: import.meta.env.VITE_APP_ID
};
const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, { localCache: persistentLocalCache() });
const auth = getAuth(firebaseApp);

// ── Storage ───────────────────────────────────────────────────────────────────
const KEYS = { p:"fm4_p", e:"fm4_e", t:"fm4_t", i:"fm4_i", tr:"fm4_tr", pin:"fm4_pin", epin:"fm4_epin", s:"fm4_settings" };

// localStorage helpers — keyed per farm so multi-tenant is safe
const lsGet = (farmId, key) => {
  try { const v = localStorage.getItem(`pb2_${farmId}_${key}`); return v ? JSON.parse(v) : null; } catch { return null; }
};
const lsSet = (farmId, key, val) => {
  try { localStorage.setItem(`pb2_${farmId}_${key}`, JSON.stringify(val)); } catch {}
};

async function load(key, fb, farmId) {
  // Race Firestore against a 10s timeout so offline never hangs forever
  // (4s was too short for slow mobile connections)
  const firestoreRead = getDoc(doc(db, "farms", farmId, "data", key));
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 10000)
  );
  try {
    const snap = await Promise.race([firestoreRead, timeout]);
    const val = snap.exists() ? JSON.parse(snap.data().value) : fb;
    lsSet(farmId, key, val); // keep local cache fresh on every successful read
    return val;
  } catch(e) {
    console.error("Load error (using cache):", key, e.message);
    const cached = lsGet(farmId, key);
    return cached !== null ? cached : fb; // fall back to local cache, then fb
  }
}
async function save(key, val, farmId) {
  lsSet(farmId, key, val); // write locally immediately so offline reads stay fresh
  // Safety guard: never overwrite Firestore with empty data if existing data is present
  // This prevents a failed/timed-out load from wiping real data on next save
  const isEmpty = Array.isArray(val) ? val.length === 0 : (typeof val === 'object' && val !== null && Object.keys(val).length === 0);
  if (isEmpty) {
    // Check if Firestore already has data before overwriting with empty
    try {
      const existing = await getDoc(doc(db, "farms", farmId, "data", key));
      if (existing.exists()) {
        const existingVal = JSON.parse(existing.data().value);
        const existingIsEmpty = Array.isArray(existingVal) ? existingVal.length === 0 : false;
        if (!existingIsEmpty) {
          console.warn("Save guard: refusing to overwrite non-empty Firestore data with empty value for key:", key);
          return;
        }
      }
    } catch(e) {
      console.warn("Save guard check failed, skipping save for key:", key, e);
      return;
    }
  }
  try {
    await setDoc(doc(db, "farms", farmId, "data", key), { value: JSON.stringify(val) });
  } catch(e) { console.error("Save error:", key, e); }
}
async function loadClient(farmId) {
  const firestoreRead = getDoc(doc(db, "clients", farmId));
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 10000)
  );
  try {
    const snap = await Promise.race([firestoreRead, timeout]);
    const data = snap.exists() ? snap.data() : null;
    if (data) lsSet(farmId, "__client__", data); // cache client doc
    return data;
  } catch {
    const cached = lsGet(farmId, "__client__");
    if (cached) return { ...cached, status: "active" };
    return null;
  }
}
async function saveClient(farmId, data) {
  try {
    await setDoc(doc(db, "clients", farmId), data, { merge: true });
    // Update local cache with merged data
    const current = lsGet(farmId, "__client__") || {};
    lsSet(farmId, "__client__", { ...current, ...data });
  } catch {
    // Offline save — update local cache only, Firestore will sync when back online
    const current = lsGet(farmId, "__client__") || {};
    lsSet(farmId, "__client__", { ...current, ...data });
  }
}

// ── Translations ──────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  af: {
    app:"Plaasbestuurder", overview:"Oorsig", paddocks:"Kampe", movements:"Bewegings",
    losses:"Verliese", treatments:"Behandelings", tasks:"Take", issues:"Probleme",
    history:"Geskiedenis", export:"Uitvoer", transactions:"Transaksies", stats:"Analitiek",
    admin:"Bestuurder", worker:"Plaaswerker",
    adminDesc:"Volle toegang — wys take toe, bestuur kampe, sien alle rekords",
    workerDesc:"Rekordeer bewegings, verliese, behandelings en voltooi take",
    selectRole:"Kies jou rol om voort te gaan",
    sheep:"Skape", goats:"Bokke", cattle:"Beeste",
    ewes:"Ooie", lambs:"Lammers", rams:"Ramme", wethers:"Hamels", total:"Totaal",
    bulls:"Bulle", cows:"Koeie", heifers:"Verse", calves:"Kalwers",
    cattleScore:"Bees Kondisiesyfer",
    add:"Voeg by", save:"Stoor", cancel:"Kanselleer", delete:"Verwyder", record:"Rekordeer",
    from:"Van", to:"Na", notes:"Notas", cause:"Oorsaak", name:"Naam", paddock:"Kamp",
    select:"Kies...", noSpecific:"Nie spesifiek", all:"Almal", other:"Ander",
    fromPaddock:"Van Kamp", toPaddock:"Na Kamp", currentStock:"Huidige diere in",
    recordMovement:"Rekordeer Beweging →", movementSaved:"✅ Beweging Rekordeer!",
    death:"Sterfte", lost:"Vermis", lossType:"Tipe Verlies",
    found:"Gevind", markFound:"Merk as Gevind", totalMissing:"Totaal Vermis",
    foundSaved:"✅ Gevind Rekordeer!", noMissing:"Geen diere vermis nie", returnTo:"Terug na Kamp",
    illness:"Siekte", injury:"Besering", predator:"Roofdier", oldAge:"Ouderdom",
    birthComp:"Geboorte Komplikasies", unknown:"Onbekend",
    treatmentName:"Behandeling / Middel", dosage:"Dosis", method:"Metode",
    administeredBy:"Toegedien deur", countTreated:"Aantal Behandel",
    animalGroup:"Diere Groep", category:"Kategorie",
    oral:"Mondeling", injection:"Inspuiting", pourOn:"Giet-op", spray:"Spuit", dip:"Dompel",
    conditionScore:"Kondisiesyfer (1-5)", paddockCondition:"Kampkondisie (%)",
    observations:"Waarnemings",
    lostDuring:"Vermis tydens hierdie gebeurtenis", deadDuring:"Dood gevind tydens hierdie gebeurtenis",
    animalScores:"Dier Kondisiesyfers", showAdditional:"▼ Voeg Bykomende Rekords By",
    hideAdditional:"▲ Verberg",
    taskDesc:"Taak Beskrywing", assignTo:"Wys toe aan", dueDate:"Sperdatum",
    assignTask:"Wys Taak Toe", markDone:"Merk as Klaar ✓",
    pending:"Hangende", overdue:"Agterstallig", done:"Klaar", open:"Oop", resolved:"Opgelos",
    overdueWarning:"Agterstallige Take", viewTasks:"Bekyk →",
    reportIssue:"Rapporteer Probleem", report:"Rapporteer", issueType:"Tipe Probleem",
    markResolved:"Merk as Opgelos ✓",
    fenceGate:"Heining/Hek", waterSupply:"Watertoevoer", animalHealth:"Diere Gesondheid",
    equipment:"Toerusting", feedPasture:"Voer/Weiveld",
    daysInPaddock:"dae in kamp", considerMoving:"— oorweeg om te skuif",
    monitor:"— monitor", okStatus:"— goed",
    arrivedOn:"Gekom op", noPaddocks:"Geen kampe nog nie",
    newPaddock:"Nuwe Kamp", paddockName:"Kamp Naam",
    recentActivity:"Onlangse Aktiwiteit", noEvents:"Geen gebeure nog nie",
    farmSummary:"Plaasopsomming", downloadCSV:"Aflaai CSV", printPage:"🖨️ Druk Bladsy",
    pendingTasks:"Hangende Take", openIssues:"Oop Probleme",
    addPhoto:"📷 Tik om foto by te voeg", noTasks:"Geen take hier nie",
    noIssues:"Geen probleme nie", noLosses:"Geen verliese nie", noTreatments:"Geen behandelings nie",
    both:"Beide", paddockConditionPct:"Kampkondisie",
    recordTreatment:"Rekordeer Behandeling →", treatmentSaved:"✅ Behandeling Rekordeer!",
    lossSaved:"✅ Verlies Rekordeer!", lossRecord:"Rekordeer Verlies",
    bought:"Gekoop", sold:"Verkoop", newLambs:"Nuwe Lammers",
    stockTake:"Voorraadopname", setNumbers:"Stel Nommers",
    transactionSaved:"✅ Transaksie Rekordeer!", recordTransaction:"Rekordeer →",
    sheepLambs:"Skaaplammers", goatLambs:"Boklammers",
    signIn:"Teken In", signUp:"Registreer", email:"E-pos", password:"Wagwoord",
    confirmPassword:"Bevestig Wagwoord", noAccount:"Geen rekening? Registreer →",
    hasAccount:"Het reeds 'n rekening? Teken In →",
    signOut:"Teken Uit", signOutConfirm:"Is jy seker jy wil uitteken?",
    subscriptionExpired:"Jou proeftydperk het verval. Kontak ons om voort te gaan.",
    subscriptionSuspended:"Jou rekening is tydelik opgeskort. Kontak ons vir hulp.",
    trialDaysLeft:"proefdae oor",
    settings:"Instellings", farmName:"Plaas Naam", settingsSaved:"✅ Instellings Gestoor!",
    farmNamePlaceholder:"bv. Groenplaas", setupWelcome:"Welkom by Plaasbestuurder",
    setupDesc:"Stel jou plaas op om te begin. Jy kan dit later verander onder Instellings.",
    setupFarmName:"Wat is jou plaas se naam?", setupContinue:"Begin →",
    enterPin:"Voer PIN in", setPin:"Stel Admin PIN", confirmPin:"Bevestig PIN",
    pinMismatch:"PIN stem nie ooreen nie", pinWrong:"Verkeerde PIN", pinSet:"PIN gestel ✅",
    pinPrompt:"4-syfer PIN vir Bestuurder toegang",
    enterEntryPin:"Voer toegangskode in", setEntryPin:"Stel Toegangskode",
    entryPinPrompt:"Voer die plaas toegangskode in om voort te gaan",
    entryPinSet:"Toegangskode gestel ✅", wrongEntryPin:"Verkeerde toegangskode",
    inspection:"Inspeksie", recordInspection:"Rekordeer Inspeksie →",
    inspectionSaved:"✅ Inspeksie Gestoor!", conditionHistory:"Kondisie Geskiedenis",
    sheepScore:"Skaap Kondisiesyfer", goatScore:"Bok Kondisiesyfer",
    noHistory:"Geen kondisie geskiedenis nie", latestCondition:"Laaste Kondisie",
    linkedToMove:"Tydens Beweging Gedoen", destPaddock:"Bestemming Kamp",
    paddockDetail:"Kamp Detail", close:"Sluit",
    addInspToggle:"▼ Voeg Inspeksie By", hideInspToggle:"▲ Verberg Inspeksie",
    language:"Taal", switchLang:"English",
    srcInspection:"Inspeksie", srcMovement:"Beweging", srcTreatment:"Behandeling",
    noAnimals:"Geen diere tans",
    totalSheep:"Totale Skape", totalGoats:"Totale Bokke", totalCattle:"Totale Beeste",
    totalAnimals:"Totale Diere", animalsBought:"Diere Gekoop", animalsSold:"Diere Verkoop",
    newLambsRec:"Nuwe Lammers", deathsRec:"Sterftes Rekordeer", lostRec:"Vermis Rekordeer",
    treatments:"Behandelings", inspections:"Inspeksies", pendingTasksLbl:"Hangende Take",
    openIssuesLbl:"Oop Probleme", totalEvents:"Totale Gebeure",
    paddockReport:"Kamp Verslag", treatmentReport:"Behandelings Verslag",
    taskReport:"Take Verslag", fullHistory:"Volle Geskiedenis",
    moved:"Geskuif", bought2:"Gekoop", sold2:"Verkoop", dead:"Dood", missing:"Vermis",
    sheep2:"skape", goats2:"bokke", cattle2:"beeste", lambs2:"lammers",
    sheepLambsShort:"skaapl", goatLambsShort:"bokl",
    stockTakeEvent:"Voorraadopname", inspectionEvent:"Inspeksie",
    taskCompleted:"voltooi", taskAssigned:"toegewys",
    issueResolved:"opgelos", issueReported:"gerapporteer",
    treatment2:"Behandeling",
    fieldPaddockCond:"Kampkondisie", fieldDays:"Dae",
    errTooManySheep:"Te veel skape", errTooManyGoats:"Te veel bokke", errTooManyCattle:"Te veel beeste",
    errOnly:"slegs", errAvail:"beskikbaar",
    confirmDelete:"verwyder?", confirmDeleteTask:"Taak verwyder?", confirmDeleteIssue:"Verwyder?",
    generalIssue:"Algemeen",
    taskCreated:"toegewys", noPhoto:"📷 Tik om foto by te voeg",
    loading:"Laai…", loadingData:"Laai data van bediener…",
    trialExpiredTitle:"Proeftydperk Verval", suspendedTitle:"Rekening Opgeskort",
    contactUs:"support@plaasbestuurder.co.za",
    // LSU / Carrying capacity
    haPerLSU:"Hektaar per LSU", sheepFrame:"Skaapras Grootte", goatFrame:"Bokras Grootte",
    cattleFrame:"Beesras Grootte", frameKlein:"Klein raam", frameMedium:"Medium raam",
    frameGroot:"Groot raam", hectares:"Hektaar", lsuLoad:"LSU Gelaai",
    lsuCapacity:"LSU Kapasiteit", lsuLoadPct:"Lading %", lsuBreakdown:"LSU Uiteensetting",
    lsuOverloaded:"Oorlaai", lsuWarning:"Naby kapasiteit", lsuOk:"Binne kapasiteit",
    lsuNotSet:"Stel hektaar in om LSU te bereken", farmLSU:"Plaas LSU Totaal",
    lsuDaysBudget:"LSU-dag Begroting", lsuDaysConsumed:"LSU-dae Gebruik",
    lsuDaysLeft:"Dae oor by huidige lading", lsuYearResets:"Graasjaar herlaai",
    sheepFrameHint:"Klein: Merino, Angora  |  Medium: Dohne  |  Groot: Dorper",
    goatFrameHint:"Klein: Angora  |  Medium: Kalahari  |  Groot: Boerbok",
    cattleFrameHint:"Klein: Nguni, Tuli  |  Medium: Bonsmara  |  Groot: Simmentaler",
    // Stats / Analitiek
    stockPopulation:"Veestapel & Bevolking", healthCondition:"Gesondheid & Kondisie",
    paddockMgmt:"Kamp Bestuur", operational:"Operasioneel",
    netHerdChange:"Netto Kudde Verandering", lambCropRate:"Lam Oes Koers",
    mortalityRate:"Sterftesyfer", lossRate:"Verlies Koers",
    avgCondScore:"Gem. Kondisiesyfer", condTrend:"Kondisie Neiging",
    topTreatments:"Top Behandelings", deathByCause:"Sterftes per Oorsaak",
    lsuByPaddock:"LSU Lading per Kamp", taskCompletion:"Taak Voltooiing",
    issuesByType:"Probleme per Tipe", avgTaskDays:"Gem. Dae om Taak te Voltooi",
    avgIssueDays:"Gem. Dae om Probleem op te Los", noData:"Geen data beskikbaar",
    monthlyHerd:"Maandelikse Kudde Grootte",
    // Rest Pool / Multi-year rest rotation
    restPlan:"Rusplan", landType:"Grondtipe", veldType:"Natuurlike Veld",
    irrigatedType:"Besproeiing/Aangeplant", otherType:"Ander",
    restPoolEnabled:"Aktiveer Rus-rotasie", simultaneousRestSlots:"Kampe Wat Gelyktydig Rus",
    defaultRestMonths:"Verstek Rusperiode (maande)", inRestPool:"Deel van Rus-rotasie",
    restDurationOverride:"Rusduur vir hierdie kamp (maande)", useFarmDefault:"Gebruik plaas verstek",
    resting:"Rus", monthsLeft:"maande oor", inRotation:"In rotasie",
    restPoolHint:"Slegs kampe gemerk as deel van die rus-poel neem deel aan die rotasie",
    mustBeEmpty:"Kamp moet leeg wees voordat dit kan rus",
    restStarted:"het begin rus", restEnded:"het rus voltooi",
    restSaved:"✅ Rus-instellings gestoor!",
  },
  en: {
    app:"Farm Manager", overview:"Overview", paddocks:"Paddocks", movements:"Movements",
    losses:"Losses", treatments:"Treatments", tasks:"Tasks", issues:"Issues",
    history:"History", export:"Export", transactions:"Transactions", stats:"Analytics",
    admin:"Manager", worker:"Farm Worker",
    adminDesc:"Full access — assign tasks, manage paddocks, view all records",
    workerDesc:"Record movements, losses, treatments and complete tasks",
    selectRole:"Choose your role to continue",
    sheep:"Sheep", goats:"Goats", cattle:"Cattle",
    ewes:"Ewes", lambs:"Lambs", rams:"Rams", wethers:"Wethers", total:"Total",
    bulls:"Bulls", cows:"Cows", heifers:"Heifers", calves:"Calves",
    cattleScore:"Cattle Condition Score",
    add:"Add", save:"Save", cancel:"Cancel", delete:"Delete", record:"Record",
    from:"From", to:"To", notes:"Notes", cause:"Cause", name:"Name", paddock:"Paddock",
    select:"Select...", noSpecific:"Not specific", all:"All", other:"Other",
    fromPaddock:"From Paddock", toPaddock:"To Paddock", currentStock:"Current animals in",
    recordMovement:"Record Movement →", movementSaved:"✅ Movement Recorded!",
    death:"Death", lost:"Missing", lossType:"Loss Type",
    found:"Found", markFound:"Mark as Found", totalMissing:"Total Missing",
    foundSaved:"✅ Found Recorded!", noMissing:"No animals missing", returnTo:"Return to Paddock",
    illness:"Illness", injury:"Injury", predator:"Predator", oldAge:"Old Age",
    birthComp:"Birth Complications", unknown:"Unknown",
    treatmentName:"Treatment / Product", dosage:"Dosage", method:"Method",
    administeredBy:"Administered by", countTreated:"Number Treated",
    animalGroup:"Animal Group", category:"Category",
    oral:"Oral", injection:"Injection", pourOn:"Pour-on", spray:"Spray", dip:"Dip",
    conditionScore:"Condition Score (1-5)", paddockCondition:"Paddock Condition (%)",
    observations:"Observations",
    lostDuring:"Missing during this event", deadDuring:"Deaths found during this event",
    animalScores:"Animal Condition Scores", showAdditional:"▼ Add Additional Records",
    hideAdditional:"▲ Hide",
    taskDesc:"Task Description", assignTo:"Assign to", dueDate:"Due Date",
    assignTask:"Assign Task", markDone:"Mark as Done ✓",
    pending:"Pending", overdue:"Overdue", done:"Done", open:"Open", resolved:"Resolved",
    overdueWarning:"Overdue Tasks", viewTasks:"View →",
    reportIssue:"Report Issue", report:"Report", issueType:"Issue Type",
    markResolved:"Mark as Resolved ✓",
    fenceGate:"Fence/Gate", waterSupply:"Water Supply", animalHealth:"Animal Health",
    equipment:"Equipment", feedPasture:"Feed/Pasture",
    daysInPaddock:"days in paddock", considerMoving:"— consider moving",
    monitor:"— monitor", okStatus:"— good",
    arrivedOn:"Arrived on", noPaddocks:"No paddocks yet",
    newPaddock:"New Paddock", paddockName:"Paddock Name",
    recentActivity:"Recent Activity", noEvents:"No events yet",
    farmSummary:"Farm Summary", downloadCSV:"Download CSV", printPage:"🖨️ Print Page",
    pendingTasks:"Pending Tasks", openIssues:"Open Issues",
    addPhoto:"📷 Tap to add photo", noTasks:"No tasks here",
    noIssues:"No issues", noLosses:"No losses", noTreatments:"No treatments",
    both:"Both", paddockConditionPct:"Paddock Condition",
    recordTreatment:"Record Treatment →", treatmentSaved:"✅ Treatment Recorded!",
    lossSaved:"✅ Loss Recorded!", lossRecord:"Record Loss",
    bought:"Bought", sold:"Sold", newLambs:"New Lambs",
    stockTake:"Stock Take", setNumbers:"Set Numbers",
    transactionSaved:"✅ Transaction Recorded!", recordTransaction:"Record →",
    sheepLambs:"Sheep Lambs", goatLambs:"Goat Lambs",
    signIn:"Sign In", signUp:"Register", email:"Email", password:"Password",
    confirmPassword:"Confirm Password", noAccount:"No account? Register →",
    hasAccount:"Already have an account? Sign In →",
    signOut:"Sign Out", signOutConfirm:"Are you sure you want to sign out?",
    subscriptionExpired:"Your trial has expired. Contact us to continue.",
    subscriptionSuspended:"Your account is temporarily suspended. Contact us for help.",
    trialDaysLeft:"trial days left",
    settings:"Settings", farmName:"Farm Name", settingsSaved:"✅ Settings Saved!",
    farmNamePlaceholder:"e.g. Green Farm", setupWelcome:"Welcome to Farm Manager",
    setupDesc:"Set up your farm to get started. You can change this later under Settings.",
    setupFarmName:"What is your farm's name?", setupContinue:"Get Started →",
    enterPin:"Enter PIN", setPin:"Set Admin PIN", confirmPin:"Confirm PIN",
    pinMismatch:"PINs do not match", pinWrong:"Wrong PIN", pinSet:"PIN set ✅",
    pinPrompt:"4-digit PIN for Manager access",
    enterEntryPin:"Enter access code", setEntryPin:"Set Access Code",
    entryPinPrompt:"Enter the farm access code to continue",
    entryPinSet:"Access code set ✅", wrongEntryPin:"Wrong access code",
    inspection:"Inspection", recordInspection:"Record Inspection →",
    inspectionSaved:"✅ Inspection Saved!", conditionHistory:"Condition History",
    sheepScore:"Sheep Condition Score", goatScore:"Goat Condition Score",
    noHistory:"No condition history", latestCondition:"Latest Condition",
    linkedToMove:"Linked to Movement", destPaddock:"Destination Paddock",
    paddockDetail:"Paddock Detail", close:"Close",
    addInspToggle:"▼ Add Inspection", hideInspToggle:"▲ Hide Inspection",
    language:"Language", switchLang:"Afrikaans",
    srcInspection:"Inspection", srcMovement:"Movement", srcTreatment:"Treatment",
    noAnimals:"No animals currently",
    totalSheep:"Total Sheep", totalGoats:"Total Goats", totalCattle:"Total Cattle",
    totalAnimals:"Total Animals", animalsBought:"Animals Bought", animalsSold:"Animals Sold",
    newLambsRec:"New Lambs", deathsRec:"Deaths Recorded", lostRec:"Missing Recorded",
    treatments:"Treatments", inspections:"Inspections", pendingTasksLbl:"Pending Tasks",
    openIssuesLbl:"Open Issues", totalEvents:"Total Events",
    paddockReport:"Paddock Report", treatmentReport:"Treatment Report",
    taskReport:"Task Report", fullHistory:"Full History",
    moved:"Moved", bought2:"Bought", sold2:"Sold", dead:"Dead", missing:"Missing",
    sheep2:"sheep", goats2:"goats", cattle2:"cattle", lambs2:"lambs",
    sheepLambsShort:"sheep l", goatLambsShort:"goat l",
    stockTakeEvent:"Stock Take", inspectionEvent:"Inspection",
    taskCompleted:"completed", taskAssigned:"assigned",
    issueResolved:"resolved", issueReported:"reported",
    treatment2:"Treatment",
    fieldPaddockCond:"Paddock Condition", fieldDays:"Days",
    errTooManySheep:"Too many sheep", errTooManyGoats:"Too many goats", errTooManyCattle:"Too many cattle",
    errOnly:"only", errAvail:"available",
    confirmDelete:"remove?", confirmDeleteTask:"Delete task?", confirmDeleteIssue:"Delete?",
    generalIssue:"General",
    taskCreated:"assigned", noPhoto:"📷 Tap to add photo",
    loading:"Loading…", loadingData:"Loading data from server…",
    trialExpiredTitle:"Trial Expired", suspendedTitle:"Account Suspended",
    contactUs:"support@plaasbestuurder.co.za",
    // LSU / Carrying capacity
    haPerLSU:"Hectares per LSU", sheepFrame:"Sheep Breed Frame", goatFrame:"Goat Breed Frame",
    cattleFrame:"Cattle Breed Frame", frameKlein:"Small frame", frameMedium:"Medium frame",
    frameGroot:"Large frame", hectares:"Hectares", lsuLoad:"LSU Load",
    lsuCapacity:"LSU Capacity", lsuLoadPct:"Load %", lsuBreakdown:"LSU Breakdown",
    lsuOverloaded:"Overloaded", lsuWarning:"Near capacity", lsuOk:"Within capacity",
    lsuNotSet:"Set hectares to calculate LSU", farmLSU:"Farm LSU Total",
    lsuDaysBudget:"LSU-day Budget", lsuDaysConsumed:"LSU-days Used",
    lsuDaysLeft:"Days left at current load", lsuYearResets:"Grazing year resets",
    sheepFrameHint:"Small: Merino, Angora  |  Medium: Dohne  |  Large: Dorper",
    goatFrameHint:"Small: Angora  |  Medium: Kalahari  |  Large: Boer goat",
    cattleFrameHint:"Small: Nguni, Tuli  |  Medium: Bonsmara  |  Large: Simmentaler",
    // Stats / Analytics
    stockPopulation:"Stock & Population", healthCondition:"Health & Condition",
    paddockMgmt:"Paddock Management", operational:"Operational",
    netHerdChange:"Net Herd Change", lambCropRate:"Lamb Crop Rate",
    mortalityRate:"Mortality Rate", lossRate:"Loss Rate",
    avgCondScore:"Avg Condition Score", condTrend:"Condition Trend",
    topTreatments:"Top Treatments", deathByCause:"Deaths by Cause",
    lsuByPaddock:"LSU Load by Paddock", taskCompletion:"Task Completion",
    issuesByType:"Issues by Type", avgTaskDays:"Avg Days to Complete Task",
    avgIssueDays:"Avg Days to Resolve Issue", noData:"No data available",
    monthlyHerd:"Monthly Herd Size",
    // Rest Pool / Multi-year rest rotation
    restPlan:"Rest Plan", landType:"Land Type", veldType:"Natural Veld",
    irrigatedType:"Irrigated/Planted", otherType:"Other",
    restPoolEnabled:"Enable Rest Rotation", simultaneousRestSlots:"Paddocks Resting at Once",
    defaultRestMonths:"Default Rest Length (months)", inRestPool:"Part of Rest Rotation",
    restDurationOverride:"Rest length for this paddock (months)", useFarmDefault:"Use farm default",
    resting:"Resting", monthsLeft:"months left", inRotation:"In rotation",
    restPoolHint:"Only paddocks marked as part of the rest pool take part in the rotation",
    mustBeEmpty:"Paddock must be empty before it can rest",
    restStarted:"started resting", restEnded:"finished resting",
    restSaved:"✅ Rest settings saved!",
  }
};

let _lang = (typeof localStorage !== "undefined" && localStorage.getItem("pb_lang")) || "af";
const getLang = () => _lang;
const setLang = (l) => { _lang = l; if(typeof localStorage !== "undefined") localStorage.setItem("pb_lang", l); };
const T = new Proxy({}, { get: (_, key) => TRANSLATIONS[getLang()][key] ?? TRANSLATIONS["af"][key] });

// ── LSU Frame Factors ─────────────────────────────────────────────────────────
const LSU_FACTORS = {
  sheep:  { klein: 0.14, medium: 0.167, groot: 0.20 },
  goats:  { klein: 0.13, medium: 0.167, groot: 0.22 },
  cattle: { klein: 0.7,  medium: 1.0,   groot: 1.3  },
};

// Calculate current LSU from animal counts only (no period logic)
function calcCurrentLSU(paddock, settings) {
  const sf = LSU_FACTORS.sheep[settings.sheepFrame   || "medium"];
  const gf = LSU_FACTORS.goats[settings.goatFrame    || "medium"];
  const cf = LSU_FACTORS.cattle[settings.cattleFrame || "medium"];
  const sh = paddock.sheep   || emptyCat();
  const go = paddock.goats   || emptyCat();
  const ca = paddock.cattle  || emptyCattle();
  const sheepLSU  = (sh.ewes+sh.rams+sh.wethers)*sf + sh.lambs*(sf*0.5);
  const goatLSU   = (go.ewes+go.rams+go.wethers)*gf + go.lambs*(gf*0.5);
  const cattleLSU = (ca.bulls+ca.cows+ca.heifers)*cf + ca.calves*(cf*0.5);
  return { sheepLSU, goatLSU, cattleLSU, totalLSU: sheepLSU+goatLSU+cattleLSU };
}

// Full LSU-day carrying capacity calculation.
// Budget = (ha / haPerLSU) x 365 LSU-days per grazing year.
// Grazing year resets 365 days after grazingYearStart.
function calcLSU(paddock, settings) {
  const { sheepLSU, goatLSU, cattleLSU, totalLSU } = calcCurrentLSU(paddock, settings);
  if (!paddock.hectares || !settings.haPerLSU) {
    return { sheepLSU, goatLSU, cattleLSU, totalLSU,
             budget:null, consumed:null, loadPct:null, daysLeft:null, capacity:null };
  }
  const budget = (paddock.hectares / Number(settings.haPerLSU)) * 365;
  const now = Date.now();
  const yearStart = paddock.grazingYearStart ? new Date(paddock.grazingYearStart).getTime() : null;
  const yearExpired = yearStart && (now - yearStart) > 365 * 86400000;
  const banked = yearExpired ? 0 : (paddock.consumedLSUDays || 0);
  const periodStart = paddock.periodStartDate ? new Date(paddock.periodStartDate).getTime() : null;
  const periodLSU   = paddock.periodStartLSU  || 0;
  const liveDays    = periodStart ? Math.max(0, (now - periodStart) / 86400000) : 0;
  const consumed    = banked + periodLSU * liveDays;
  const loadPct     = budget > 0 ? (consumed / budget) * 100 : null;
  const daysLeft    = totalLSU > 0 && budget > consumed
    ? Math.floor((budget - consumed) / totalLSU)
    : totalLSU === 0 ? null : 0;
  const capacity    = paddock.hectares / Number(settings.haPerLSU);
  return { sheepLSU, goatLSU, cattleLSU, totalLSU, budget, consumed, loadPct, daysLeft, capacity };
}

// Bank LSU-days for the period just ended and start a new period with newLSU.
// Call this every time animal composition changes in a paddock.
function closePeriod(paddock, newLSU) {
  const now = Date.now();
  const nowStr = new Date(now).toISOString();
  const yearStart = paddock.grazingYearStart ? new Date(paddock.grazingYearStart).getTime() : null;
  const yearExpired = yearStart && (now - yearStart) > 365 * 86400000;
  const periodStart = paddock.periodStartDate ? new Date(paddock.periodStartDate).getTime() : null;
  const periodLSU   = paddock.periodStartLSU  || 0;
  const liveDays    = periodStart ? Math.max(0, (now - periodStart) / 86400000) : 0;
  const prevBanked  = yearExpired ? 0 : (paddock.consumedLSUDays || 0);
  const newBanked   = prevBanked + periodLSU * liveDays;
  return {
    ...paddock,
    grazingYearStart: (yearExpired || !yearStart) ? nowStr : paddock.grazingYearStart,
    consumedLSUDays:  newBanked,
    periodStartDate:  nowStr,
    periodStartLSU:   newLSU,
  };
}

// ── Rest Pool / Multi-Year Rest Rotation ───────────────────────────────────────
// A paddock can be flagged as part of the farm's long-term rest pool. While
// resting it is excluded from active grazing; once its rest period ends it
// rejoins the pool and the next eligible (empty) paddock takes its slot.
const monthsSince = (s) => s ? (Date.now()-new Date(s).getTime())/(86400000*30.44) : null;

function restMonthsLeft(p, settings) {
  if (!p.resting || !p.restStartDate) return null;
  const dur = Number(p.restDurationMonths) || Number(settings?.defaultRestDurationMonths) || 12;
  const elapsed = monthsSince(p.restStartDate) || 0;
  return Math.max(0, dur - elapsed);
}

// Advances the rest queue: ends rest for paddocks whose duration has elapsed,
// then fills any open slots from eligible (empty, pool-member, not-resting)
// paddocks, prioritizing whichever has gone longest since its last rest.
function processRestQueue(paddocks, settings) {
  if (!settings?.restPoolEnabled) return paddocks;
  const slots = Number(settings.simultaneousRestSlots) || 1;
  let next = paddocks.map(p => {
    if (!p.inRestPool || !p.resting) return p;
    const left = restMonthsLeft(p, settings);
    if (left !== null && left <= 0) {
      return { ...p, resting:false, restStartDate:null, lastRestEndDate: nowISO() };
    }
    return p;
  });
  const restingNow = next.filter(p => p.inRestPool && p.resting).length;
  const openSlots = slots - restingNow;
  if (openSlots <= 0) return next;
  const isEmpty = (p) => totalCat(p.sheep)+totalCat(p.goats)+totalCattle(p.cattle||emptyCattle())===0;
  const eligibleIds = next
    .filter(p => p.inRestPool && !p.resting && isEmpty(p))
    .sort((a,b) => {
      const at = a.lastRestEndDate ? new Date(a.lastRestEndDate).getTime() : -Infinity;
      const bt = b.lastRestEndDate ? new Date(b.lastRestEndDate).getTime() : -Infinity;
      return at - bt; // longest-since-last-rest (or never rested) goes first
    })
    .slice(0, openSlots)
    .map(p => p.id);
  return next.map(p => eligibleIds.includes(p.id) ? { ...p, resting:true, restStartDate: nowISO() } : p);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATS = ["ewes","lambs","rams","wethers"];
const CATLABEL = () => ({ ewes:T.ewes, lambs:T.lambs, rams:T.rams, wethers:T.wethers });
const emptyCat    = () => ({ ewes:0, lambs:0, rams:0, wethers:0 });
const emptyScores = () => ({ ewes:null, lambs:null, rams:null, wethers:null });
const totalCat    = (o) => CATS.reduce((s,c) => s+(Number(o?.[c])||0), 0);
const addCat      = (a,b) => Object.fromEntries(CATS.map(c=>[c,(Number(a?.[c])||0)+(Number(b?.[c])||0)]));
const subCat      = (a,b) => Object.fromEntries(CATS.map(c=>[c,Math.max(0,(Number(a?.[c])||0)-(Number(b?.[c])||0))]));

const CATTLE_CATS  = ["bulls","cows","heifers","calves"];
const CATTLE_LABEL = () => ({ bulls:T.bulls, cows:T.cows, heifers:T.heifers, calves:T.calves });
const emptyCattle    = () => ({ bulls:0, cows:0, heifers:0, calves:0 });
const totalCattle    = (o) => CATTLE_CATS.reduce((s,c) => s+(Number(o?.[c])||0), 0);
const addCattle      = (a,b) => Object.fromEntries(CATTLE_CATS.map(c=>[c,(Number(a?.[c])||0)+(Number(b?.[c])||0)]));
const subCattle      = (a,b) => Object.fromEntries(CATTLE_CATS.map(c=>[c,Math.max(0,(Number(a?.[c])||0)-(Number(b?.[c])||0))]));

// Pools every "lost" event minus every "found" event into one running
// missing total per species/category. Missing animals are treated as one
// shared farm-wide group rather than tracked against the specific event
// they went missing in — a found animal just reduces the pool.
function computeMissingTotals(events) {
  let sheep = emptyCat(), goats = emptyCat(), cattle = emptyCattle();
  events.forEach(ev => {
    if (ev.type === "lost") {
      sheep  = addCat(sheep, ev.sheep || emptyCat());
      goats  = addCat(goats, ev.goats || emptyCat());
      cattle = addCattle(cattle, ev.cattle || emptyCattle());
    } else if (ev.type === "found") {
      sheep  = subCat(sheep, ev.sheep || emptyCat());
      goats  = subCat(goats, ev.goats || emptyCat());
      cattle = subCattle(cattle, ev.cattle || emptyCattle());
    }
  });
  return { sheep, goats, cattle };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid      = () => Math.random().toString(36).slice(2,9);
const nowISO   = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().split("T")[0];
const dateToISO= (dateStr, useNow=false) => {
  // Convert a date string (YYYY-MM-DD) to ISO, using noon local time to avoid timezone issues
  if (!dateStr || useNow) return nowISO();
  return new Date(dateStr + "T12:00:00").toISOString();
};
const isBackdated = (ts) => {
  if (!ts) return false;
  const evDate = new Date(ts).toDateString();
  const today  = new Date().toDateString();
  return evDate !== today;
};
const daysSince= (s) => s ? Math.floor((Date.now()-new Date(s))/86400000) : null;
const isOverdue= (d) => d && new Date(d)<new Date() && new Date(d).toDateString()!==new Date().toDateString();
const srcLabel = (s) => s==="inspection"?T.srcInspection:s==="movement"?T.srcMovement:T.srcTreatment;
const scoreColor = (s) => s<=2?"var(--rust)":s<=3?"var(--amber)":"var(--green)";
const fmtDate  = (s) => s ? new Date(s).toLocaleDateString(getLang()==="en"?"en-ZA":"af-ZA",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fmtTime  = (s) => s ? new Date(s).toLocaleString(getLang()==="en"?"en-ZA":"af-ZA",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";

async function compressImage(file, maxW=600) {
  return new Promise(res => {
    const r=new FileReader(); r.onload=e=>{const img=new Image();img.onload=()=>{
      const sc=Math.min(1,maxW/img.width),cv=document.createElement("canvas");
      cv.width=img.width*sc;cv.height=img.height*sc;cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
      res(cv.toDataURL("image/jpeg",0.7));};img.src=e.target.result;};r.readAsDataURL(file);
  });
}

function useLang() {
  const [lang, setLangState] = useState(getLang());
  const toggle = () => {
    const next = getLang() === "af" ? "en" : "af";
    setLang(next); setLangState(next);
  };
  return [lang, toggle];
}

const SEED_PADDOCKS = [];

// ══════════════════════════════════════════════════════════════════════════════
//  CSS
// ══════════════════════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@300;400;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f5f0e8;--surface:#fffdf8;--border:#d6cbb8;
  --olive:#4a5c3a;--olive2:#6b7f57;--amber:#c17f2a;
  --rust:#a83c2a;--sky:#2a6c8a;--teal:#2a7a6a;
  --text:#2c2416;--muted:#7a6e5f;--green:#2a6a2a;
  --radius:12px;--shadow:0 2px 12px rgba(44,36,22,.10);
}
body{background:var(--bg);font-family:'Source Sans 3',sans-serif;color:var(--text);min-height:100vh}
h1,h2,h3{font-family:'Playfair Display',serif}
button,input,select,textarea{cursor:pointer;font-family:inherit}
input,select,textarea{cursor:text}

.nav{background:var(--olive);color:#fff;display:flex;align-items:center;justify-content:space-between;
     padding:13px 18px;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.nav h1{font-size:1.15rem;letter-spacing:.02em}
.nav-role{background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:20px;
          padding:5px 13px;font-size:.78rem;font-weight:600}

.tabs{display:flex;gap:2px;background:var(--olive);padding:0 10px 10px;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{background:transparent;border:none;color:rgba(255,255,255,.6);padding:7px 12px;
     border-radius:8px;font-size:.78rem;font-weight:600;white-space:nowrap;transition:all .2s}
.tab.active{background:var(--bg);color:var(--olive)}
.tab:hover:not(.active){background:rgba(255,255,255,.12);color:#fff}

.page{padding:18px 14px;max-width:680px;margin:0 auto}

.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
      padding:15px;box-shadow:var(--shadow)}
.card+.card{margin-top:10px}
.card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.card-title{font-size:1rem;font-weight:700}

.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.stat{background:var(--bg);border-radius:7px;padding:7px 6px;text-align:center}
.stat-val{font-size:1.2rem;font-weight:700;font-family:'Playfair Display',serif;line-height:1}
.stat-lbl{font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.sheep-c{color:var(--olive)}.goats-c{color:var(--amber)}.total-c{color:var(--text)}

.graze-badge{display:inline-flex;align-items:center;gap:4px;border-radius:6px;
             padding:3px 8px;font-size:.73rem;font-weight:600;margin-top:6px}
.graze-ok{background:#e8f4e8;color:#2a6a2a}.graze-warn{background:#fff3cd;color:#856404}
.graze-high{background:#fce8e8;color:var(--rust)}

.lsu-bar-wrap{margin-top:8px}
.lsu-bar-label{display:flex;justify-content:space-between;font-size:.73rem;margin-bottom:3px}
.lsu-bar{height:8px;border-radius:4px;background:var(--border);overflow:hidden}
.lsu-fill{height:100%;border-radius:4px;transition:width .4s}

.cond-bar{height:6px;border-radius:3px;background:var(--border);margin-top:6px;overflow:hidden}
.cond-fill{height:100%;border-radius:3px;transition:width .3s}

.btn{border:none;border-radius:8px;padding:10px 16px;font-size:.88rem;font-weight:600;
     transition:opacity .15s,transform .1s;display:inline-flex;align-items:center;gap:6px}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-primary{background:var(--olive);color:#fff}
.btn-amber  {background:var(--amber);color:#fff}
.btn-sky    {background:var(--sky);color:#fff}
.btn-rust   {background:var(--rust);color:#fff}
.btn-teal   {background:var(--teal);color:#fff}
.btn-ghost  {background:transparent;border:1.5px solid var(--border);color:var(--text)}
.btn-done   {background:#e8f4e8;color:#2a6a2a;border:1.5px solid #a8d4a8}
.btn-toggle {background:rgba(255,255,255,.08);border:1px dashed var(--border);color:var(--muted);width:100%;justify-content:center;margin-top:8px}
.btn-sm{padding:6px 11px;font-size:.78rem}
.btn-full{width:100%;justify-content:center;margin-top:10px}

.form-group{margin-bottom:12px}
.form-label{display:block;font-size:.77rem;font-weight:600;color:var(--muted);margin-bottom:4px;
            text-transform:uppercase;letter-spacing:.05em}
.form-hint{font-size:.7rem;color:var(--muted);margin-top:3px;font-style:italic}
.form-input,.form-select,.form-textarea{
  width:100%;border:1.5px solid var(--border);border-radius:8px;padding:9px 11px;
  font-size:.92rem;background:var(--surface);color:var(--text);transition:border-color .2s}
.form-input:focus,.form-select:focus,.form-textarea:focus{outline:none;border-color:var(--olive)}
.form-row{display:flex;gap:8px}
.form-row .form-group{flex:1}

.cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.species-block{background:var(--bg);border-radius:10px;padding:12px;margin-bottom:10px}
.species-block h4{font-size:.82rem;font-weight:700;margin-bottom:8px;color:var(--olive)}

.score-row{display:flex;gap:6px;align-items:center}
.score-btn{width:33px;height:33px;border-radius:7px;border:1.5px solid var(--border);
           background:transparent;color:var(--text);font-weight:700;font-size:.9rem;transition:all .15s}
.score-btn.active{background:var(--olive);color:#fff;border-color:var(--olive)}

.sec-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.sec-head h2{font-size:1.25rem}

.event-item{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)}
.event-item:last-child{border-bottom:none}
.event-icon{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;
            justify-content:center;font-size:1rem;flex-shrink:0}
.ev-move{background:#e8f0ff}.ev-death{background:#fce8e8}.ev-lost{background:#fff0e0}
.ev-task{background:#fff8e8}.ev-issue{background:#f0e8ff}.ev-treat{background:#e8f8f0}
.ev-buy{background:#e8f4e8}.ev-sell{background:#fce8e8}.ev-insp{background:#f0f4ff}
.event-body{flex:1}
.event-title{font-weight:600;font-size:.88rem}
.event-meta{font-size:.76rem;color:var(--muted);margin-top:2px}

.pill{display:inline-flex;align-items:center;gap:4px;border-radius:20px;
      padding:2px 9px;font-size:.73rem;font-weight:600}
.pill-pending{background:#fff3cd;color:#856404}
.pill-done{background:#d4edda;color:#155724}
.pill-overdue{background:#fce8e8;color:var(--rust)}
.pill-open{background:#fce8e8;color:var(--rust)}
.pill-resolved{background:#d4edda;color:#155724}

.role-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;
             justify-content:center;padding:32px 20px;background:var(--olive)}
.role-screen h1{color:#fff;font-size:2rem;margin-bottom:6px}
.role-screen p{color:rgba(255,255,255,.7);margin-bottom:32px}
.role-cards{display:flex;flex-direction:column;gap:12px;width:100%;max-width:310px}
.role-card{background:var(--surface);border-radius:var(--radius);padding:20px;border:none;text-align:left;transition:transform .15s}
.role-card:hover{transform:scale(1.02)}
.role-card-icon{font-size:2rem;margin-bottom:6px}
.role-card h3{font-size:1.05rem}
.role-card p{font-size:.82rem;color:var(--muted);margin-top:3px}

.summary-strip{display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px}
.chip{background:var(--surface);border:1px solid var(--border);border-radius:10px;
      padding:9px 13px;white-space:nowrap;flex-shrink:0}
.chip-val{font-size:1.35rem;font-weight:700;font-family:'Playfair Display',serif}
.chip-lbl{font-size:.68rem;color:var(--muted)}

.overlay{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:200;display:flex;align-items:flex-end}
.modal{background:var(--surface);border-radius:18px 18px 0 0;width:100%;
       max-height:92vh;overflow-y:auto;padding:22px 18px}
.modal-handle{width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 18px}
.modal h2{font-size:1.2rem;margin-bottom:18px}

.photo-upload{border:2px dashed var(--border);border-radius:8px;padding:14px;text-align:center;
              color:var(--muted);font-size:.82rem;cursor:pointer}
.photo-upload:hover{border-color:var(--olive)}
.photo-preview{width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-top:6px}

.extra-section{background:var(--bg);border-radius:10px;padding:12px;margin-top:4px}
.extra-section h4{font-size:.8rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}

.empty{text-align:center;padding:36px 20px;color:var(--muted)}
.empty-icon{font-size:2.2rem;margin-bottom:8px}
.overdue-text{color:var(--rust);font-weight:700}

.data-table{width:100%;border-collapse:collapse;font-size:.82rem}
.data-table th{background:var(--bg);padding:7px 9px;text-align:left;border-bottom:2px solid var(--border);font-weight:600}
.data-table td{padding:7px 9px;border-bottom:1px solid var(--border)}
.data-table tr:last-child td{border-bottom:none}

.admin-actions{display:flex;gap:6px;flex-shrink:0}
.sync-bar{background:var(--olive);color:rgba(255,255,255,.8);text-align:center;
          font-size:.72rem;padding:3px;letter-spacing:.03em}

.hist-entry{padding:10px 0;border-bottom:1px solid var(--border)}
.hist-entry:last-child{border-bottom:none}
.hist-meta{font-size:.74rem;font-weight:700;color:var(--muted);margin-bottom:5px;display:flex;justify-content:space-between;align-items:center}
.hist-scores{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:3px}
.hist-score-pill{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:6px;background:var(--bg);font-size:.82rem;font-weight:700}
.hist-obs{font-size:.78rem;color:var(--muted);font-style:italic;margin-top:3px}
.latest-cond{background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:14px}
.latest-cond-title{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.card-tappable{cursor:pointer;transition:box-shadow .15s}
.card-tappable:hover{box-shadow:0 4px 18px rgba(44,36,22,.15)}
.linked-check{display:flex;align-items:center;gap:8px;padding:8px 0;font-size:.88rem;margin-bottom:4px;cursor:pointer}
.linked-check input[type=checkbox]{width:17px;height:17px;cursor:pointer;accent-color:var(--olive)}

/* Stats / Analitiek */
.stats-tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.stat-panel-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
                 padding:14px;margin-bottom:12px;box-shadow:var(--shadow)}
.stat-panel-title{font-size:.82rem;font-weight:700;color:var(--muted);text-transform:uppercase;
                  letter-spacing:.05em;margin-bottom:12px}
.kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px}
.kpi-card{background:var(--bg);border-radius:10px;padding:12px;text-align:center}
.kpi-val{font-size:1.6rem;font-weight:700;font-family:'Playfair Display',serif;line-height:1}
.kpi-lbl{font-size:.68rem;color:var(--muted);margin-top:3px}
.chart-wrap{width:100%;margin-top:8px}

@media print{.nav,.tabs,.btn,.btn-full,.overlay{display:none!important}.page{padding:0}.card{box-shadow:none;break-inside:avoid}}

.undo-fab{position:fixed;bottom:20px;right:16px;z-index:150;background:var(--text);color:#fff;
          border:none;border-radius:24px;padding:10px 16px;font-size:.82rem;font-weight:700;
          box-shadow:0 4px 16px rgba(0,0,0,.3);display:flex;align-items:center;gap:7px;
          cursor:pointer;transition:transform .15s,opacity .2s;max-width:220px}
.undo-fab:active{transform:scale(.96)}
.undo-fab:hover{opacity:.9}
.backdated-badge{display:inline-flex;align-items:center;gap:3px;background:#fff3cd;color:#856404;
                 border-radius:5px;padding:1px 6px;font-size:.68rem;font-weight:700;margin-left:5px}
.danger-zone{border-top:1px solid var(--border);margin-top:20px;padding-top:16px}
.reset-confirm-input{border:2px solid var(--rust);border-radius:8px;padding:9px 11px;
                     width:100%;font-size:.92rem;margin-top:8px;background:#fff8f8}
`;

// ══════════════════════════════════════════════════════════════════════════════
//  Reusable Components
// ══════════════════════════════════════════════════════════════════════════════

function CategoryGrid({ label, values, onChange, max }) {
  const [,] = useLang();
  return (
    <div className="species-block">
      <h4>{label}</h4>
      <div className="cat-grid">
        {CATS.map(c => (
          <div key={c} className="form-group" style={{marginBottom:0}}>
            <label className="form-label">{CATLABEL()[c]}</label>
            <input className="form-input" type="number" min="0"
              max={max?.[c] ?? undefined}
              value={values[c] || ""}
              onChange={e => onChange(c, e.target.value)}
              placeholder="0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CattleCategoryGrid({ label, values, onChange, max }) {
  const [,] = useLang();
  return (
    <div className="species-block">
      <h4>{label}</h4>
      <div className="cat-grid">
        {CATTLE_CATS.map(c => (
          <div key={c} className="form-group" style={{marginBottom:0}}>
            <label className="form-label">{CATTLE_LABEL()[c]}</label>
            <input className="form-input" type="number" min="0"
              max={max?.[c] ?? undefined}
              value={values[c] || ""}
              onChange={e => onChange(c, e.target.value)}
              placeholder="0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreSelector({ value, onChange }) {
  const [,] = useLang();
  return (
    <div className="score-row">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" className={`score-btn ${value===n?"active":""}`}
          onClick={() => onChange(value===n ? null : n)}>{n}</button>
      ))}
    </div>
  );
}

function ConditionBar({ pct }) {
  if (pct === null || pct === undefined) return null;
  const color = pct>=70?"var(--green)":pct>=40?"var(--amber)":"var(--rust)";
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:".75rem",color:"var(--muted)",marginBottom:2}}>
        <span>{T.paddockConditionPct}</span><span style={{fontWeight:700,color}}>{pct}%</span>
      </div>
      <div className="cond-bar"><div className="cond-fill" style={{width:`${pct}%`,background:color}}/></div>
    </div>
  );
}

function LSUBar({ paddock, settings }) {
  const { totalLSU, budget, consumed, loadPct, daysLeft, capacity } = calcLSU(paddock, settings);
  if (!capacity || capacity === 0) {
    if (!paddock.hectares) return null;
    return <div style={{fontSize:".7rem",color:"var(--muted)",marginTop:4}}>⚖️ {T.lsuNotSet}</div>;
  }
  const color    = loadPct > 100 ? "var(--rust)" : loadPct > 80 ? "var(--amber)" : "var(--green)";
  const label    = loadPct > 100 ? T.lsuOverloaded : loadPct > 80 ? T.lsuWarning : T.lsuOk;
  const fillPct  = Math.min(loadPct, 100);
  const hasAnimals = totalLSU > 0;
  return (
    <div className="lsu-bar-wrap">
      <div className="lsu-bar-label">
        <span style={{fontWeight:600,fontSize:".73rem"}}>
          ⚖️ {consumed.toFixed(0)} / {budget.toFixed(0)} {getLang()==="en"?"LSU-days":"LSU-dae"}
        </span>
        <span style={{color,fontWeight:700,fontSize:".73rem"}}>{loadPct.toFixed(1)}% — {label}</span>
      </div>
      <div className="lsu-bar">
        <div className="lsu-fill" style={{width:`${fillPct}%`,background:color}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:"var(--muted)",marginTop:3}}>
        <span>📊 {totalLSU.toFixed(2)} {getLang()==="en"?"LSU now":"LSU nou"}</span>
        {hasAnimals && daysLeft > 0 && <span style={{color:"var(--olive)",fontWeight:600}}>⏳ {daysLeft} {getLang()==="en"?"days left":"dae oor"}</span>}
        {hasAnimals && daysLeft !== null && daysLeft <= 0 && <span style={{color:"var(--rust)",fontWeight:600}}>{getLang()==="en"?"Budget exhausted":"Begroting uitgeput"}</span>}
      </div>
    </div>
  );
}

function AdditionalRecords({ extra, setExtra }) {
  const [,] = useLang();
  const [open, setOpen] = useState(false);
  const upd = (path, val) => setExtra(prev => {
    const next = JSON.parse(JSON.stringify(prev));
    const keys = path.split(".");
    let obj = next; keys.slice(0,-1).forEach(k=>obj=obj[k]);
    obj[keys[keys.length-1]] = val; return next;
  });

  return (
    <>
      <button type="button" className="btn btn-toggle btn-sm" onClick={() => setOpen(o=>!o)}>
        {open ? T.hideAdditional : T.showAdditional}
      </button>
      {open && (
        <div className="extra-section" style={{marginTop:8}}>
          <h4>🔍 {T.lostDuring}</h4>
          <CategoryGrid label={`🐑 ${T.sheep}`} values={extra.lost.sheep} onChange={(c,v)=>upd(`lost.sheep.${c}`,Number(v)||0)} />
          <CategoryGrid label={`🐐 ${T.goats}`} values={extra.lost.goats} onChange={(c,v)=>upd(`lost.goats.${c}`,Number(v)||0)} />
          <CattleCategoryGrid label={`🐄 ${T.cattle}`} values={extra.lost.cattle||emptyCattle()} onChange={(c,v)=>upd(`lost.cattle.${c}`,Number(v)||0)} />
          <h4 style={{marginTop:10}}>☠️ {T.deadDuring}</h4>
          <CategoryGrid label={`🐑 ${T.sheep}`} values={extra.dead.sheep} onChange={(c,v)=>upd(`dead.sheep.${c}`,Number(v)||0)} />
          <CategoryGrid label={`🐐 ${T.goats}`} values={extra.dead.goats} onChange={(c,v)=>upd(`dead.goats.${c}`,Number(v)||0)} />
          <CattleCategoryGrid label={`🐄 ${T.cattle}`} values={extra.dead.cattle||emptyCattle()} onChange={(c,v)=>upd(`dead.cattle.${c}`,Number(v)||0)} />
          <div className="form-group" style={{marginTop:8}}>
            <label className="form-label">{T.cause}</label>
            <select className="form-select" value={extra.deadCause} onChange={e=>upd("deadCause",e.target.value)}>
              <option value="">{T.unknown}</option>
              <option value={T.illness}>{T.illness}</option>
              <option value={T.injury}>{T.injury}</option>
              <option value={T.predator}>{T.predator}</option>
              <option value={T.oldAge}>{T.oldAge}</option>
              <option value={T.birthComp}>{T.birthComp}</option>
              <option value={T.other}>{T.other}</option>
            </select>
          </div>
          <h4 style={{marginTop:10}}>📊 {T.animalScores}</h4>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:".8rem",fontWeight:700,color:"var(--olive)",marginBottom:6}}>🐑 {T.sheepScore}</div>
            <ScoreSelector value={extra.sheepScore} onChange={v=>upd("sheepScore",v)} />
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:".8rem",fontWeight:700,color:"var(--amber)",marginBottom:6}}>🐐 {T.goatScore}</div>
            <ScoreSelector value={extra.goatScore} onChange={v=>upd("goatScore",v)} />
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:".8rem",fontWeight:700,color:"var(--teal)",marginBottom:6}}>🐄 {T.cattleScore}</div>
            <ScoreSelector value={extra.cattleScore} onChange={v=>upd("cattleScore",v)} />
          </div>
          <div className="form-group" style={{marginTop:8}}>
            <label className="form-label">{T.paddockCondition}</label>
            <input className="form-input" type="number" min="0" max="100"
              value={extra.paddockCond ?? ""}
              onChange={e=>upd("paddockCond",e.target.value===""?null:Number(e.target.value))}
              placeholder="0–100" />
          </div>
          <div className="form-group">
            <label className="form-label">{T.observations}</label>
            <textarea className="form-textarea" rows={2} value={extra.observations}
              onChange={e=>upd("observations",e.target.value)} placeholder="Enige waarnemings…"/>
          </div>
        </div>
      )}
    </>
  );
}

const emptyExtra = () => ({
  lost:{ sheep:emptyCat(), goats:emptyCat(), cattle:emptyCattle() },
  dead:{ sheep:emptyCat(), goats:emptyCat(), cattle:emptyCattle() },
  deadCause:"", sheepScore:null, goatScore:null, cattleScore:null,
  paddockCond:null, observations:""
});

// ══════════════════════════════════════════════════════════════════════════════
//  Paddock Detail Modal
// ══════════════════════════════════════════════════════════════════════════════
function PaddockDetailModal({ p, settings, onClose, addInspection }) {
  const [,] = useLang();
  const [showInsp,setShowInsp]   = useState(false);
  const [iSheep,setISheep]   = useState(null);
  const [iGoat,setIGoat]     = useState(null);
  const [iCattle,setICattle] = useState(null);
  const [iCond,setICond]     = useState("");
  const [iObs,setIObs]       = useState("");
  const [saved,setSaved]     = useState(false);

  const history  = (p.conditionHistory || []).slice(0, 5);
  const latest   = history[0] || null;
  const hasSheep = totalCat(p.sheep) > 0;
  const hasGoats = totalCat(p.goats) > 0;
  const lsu      = calcLSU(p, settings);

  const submitInsp = () => {
    const condVal = iCond !== "" ? Number(iCond) : null;
    addInspection(p.id, iSheep, iGoat, iCattle, condVal, iObs);
    setISheep(null); setIGoat(null); setICattle(null); setICond(""); setIObs("");
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const srcBadge = (src) => ({
    background: src==="inspection"?"#f0f4ff":src==="movement"?"#e8f0ff":"#e8f8f0",
    padding:"1px 7px", borderRadius:10, fontSize:".7rem"
  });

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <h2>📍 {p.name}{p.hectares ? ` — ${p.hectares} ha` : ""}</h2>

        {hasSheep && (
          <div style={{marginBottom:10}}>
            <div style={{fontSize:".78rem",fontWeight:700,color:"var(--olive)",marginBottom:4}}>🐑 {T.sheep}</div>
            <div className="stats">
              {CATS.map(c=>(<div key={c} className="stat"><div className="stat-val sheep-c">{p.sheep[c]}</div><div className="stat-lbl">{CATLABEL()[c]}</div></div>))}
              <div className="stat" style={{gridColumn:"span 2"}}><div className="stat-val">{totalCat(p.sheep)}</div><div className="stat-lbl">{T.total}</div></div>
            </div>
          </div>
        )}
        {hasGoats && (
          <div style={{marginBottom:10}}>
            <div style={{fontSize:".78rem",fontWeight:700,color:"var(--amber)",marginBottom:4}}>🐐 {T.goats}</div>
            <div className="stats">
              {CATS.map(c=>(<div key={c} className="stat"><div className="stat-val goats-c">{p.goats[c]}</div><div className="stat-lbl">{CATLABEL()[c]}</div></div>))}
              <div className="stat" style={{gridColumn:"span 2"}}><div className="stat-val">{totalCat(p.goats)}</div><div className="stat-lbl">{T.total}</div></div>
            </div>
          </div>
        )}
        {totalCattle(p.cattle||emptyCattle()) > 0 && (
          <div style={{marginBottom:10}}>
            <div style={{fontSize:".78rem",fontWeight:700,color:"var(--teal)",marginBottom:4}}>🐄 {T.cattle}</div>
            <div className="stats">
              {CATTLE_CATS.map(c=>(<div key={c} className="stat"><div className="stat-val" style={{color:"var(--teal)"}}>{(p.cattle||emptyCattle())[c]}</div><div className="stat-lbl">{CATTLE_LABEL()[c]}</div></div>))}
              <div className="stat" style={{gridColumn:"span 2"}}><div className="stat-val">{totalCattle(p.cattle||emptyCattle())}</div><div className="stat-lbl">{T.total}</div></div>
            </div>
          </div>
        )}
        {!hasSheep && !hasGoats && totalCattle(p.cattle||emptyCattle())===0 && (
          <div style={{color:"var(--muted)",fontSize:".85rem",marginBottom:10}}>{T.noAnimals}</div>
        )}

        {/* LSU Breakdown */}
        {lsu.capacity !== null && (
          <div style={{background:"var(--bg)",borderRadius:10,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:".72rem",fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>⚖️ {T.lsuBreakdown}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
              {lsu.sheepLSU > 0  && <span className="hist-score-pill" style={{color:"var(--olive)"}}>🐑 {lsu.sheepLSU.toFixed(2)} LSU</span>}
              {lsu.goatLSU > 0   && <span className="hist-score-pill" style={{color:"var(--amber)"}}>🐐 {lsu.goatLSU.toFixed(2)} LSU</span>}
              {lsu.cattleLSU > 0 && <span className="hist-score-pill" style={{color:"var(--teal)"}}>🐄 {lsu.cattleLSU.toFixed(2)} LSU</span>}
            </div>
            {lsu.budget !== null && (
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8,fontSize:".75rem"}}>
                <span style={{color:"var(--muted)"}}>{T.lsuDaysBudget}: <strong>{lsu.budget.toFixed(0)}</strong></span>
                <span style={{color:"var(--muted)"}}>{T.lsuDaysConsumed}: <strong>{lsu.consumed.toFixed(1)}</strong></span>
                {p.grazingYearStart && <span style={{color:"var(--muted)"}}>{T.lsuYearResets}: <strong>{fmtDate(new Date(new Date(p.grazingYearStart).getTime()+365*86400000).toISOString())}</strong></span>}
              </div>
            )}
            <LSUBar paddock={p} settings={settings} />
          </div>
        )}

        {settings?.restPoolEnabled && p.inRestPool && (
          <div className={`graze-badge ${p.resting?"graze-warn":"graze-ok"}`} style={{marginBottom:12}}>
            {p.resting ? `🌱 ${T.resting} — ${Math.ceil(restMonthsLeft(p,settings)??0)} ${T.monthsLeft}` : `🔁 ${T.inRotation}`}
          </div>
        )}

        {latest && (
          <div className="latest-cond">
            <div className="latest-cond-title">📊 {T.latestCondition} — {fmtDate(latest.ts)} ({srcLabel(latest.source)})</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {latest.sheepScore!==null && <span className="hist-score-pill" style={{color:scoreColor(latest.sheepScore)}}>🐑 {latest.sheepScore}/5</span>}
              {latest.goatScore!==null  && <span className="hist-score-pill" style={{color:scoreColor(latest.goatScore)}}>🐐 {latest.goatScore}/5</span>}
              {latest.cattleScore!==null && <span className="hist-score-pill" style={{color:scoreColor(latest.cattleScore)}}>🐄 {latest.cattleScore}/5</span>}
              {latest.paddockCond!==null && <span className="hist-score-pill" style={{color:latest.paddockCond>=70?"var(--green)":latest.paddockCond>=40?"var(--amber)":"var(--rust)"}}>🌿 {latest.paddockCond}%</span>}
            </div>
            {latest.observations && <div className="hist-obs" style={{marginTop:5}}>{latest.observations}</div>}
          </div>
        )}

        <div style={{marginBottom:14}}>
          <div style={{fontSize:".85rem",fontWeight:700,marginBottom:10}}>{T.conditionHistory}</div>
          {history.length===0 && <div style={{color:"var(--muted)",fontSize:".82rem"}}>{T.noHistory}</div>}
          {history.map((h,i) => (
            <div key={h.id||i} className="hist-entry">
              <div className="hist-meta"><span>{fmtDate(h.ts)}</span><span style={srcBadge(h.source)}>{srcLabel(h.source)}</span></div>
              <div className="hist-scores">
                {h.sheepScore!==null && <span className="hist-score-pill" style={{color:scoreColor(h.sheepScore)}}>🐑 {h.sheepScore}/5</span>}
                {h.goatScore!==null  && <span className="hist-score-pill" style={{color:scoreColor(h.goatScore)}}>🐐 {h.goatScore}/5</span>}
                {h.cattleScore!==null && <span className="hist-score-pill" style={{color:scoreColor(h.cattleScore)}}>🐄 {h.cattleScore}/5</span>}
                {h.paddockCond!==null && <span className="hist-score-pill" style={{color:h.paddockCond>=70?"var(--green)":h.paddockCond>=40?"var(--amber)":"var(--rust)"}}>🌿 {h.paddockCond}%</span>}
                {h.sheepScore===null && h.goatScore===null && h.cattleScore===null && h.paddockCond===null && (
                  <span style={{fontSize:".78rem",color:"var(--muted)"}}>{getLang()==="en"?"No scores":"Geen syfers"}</span>
                )}
              </div>
              {h.observations && <div className="hist-obs">{h.observations}</div>}
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-toggle btn-sm" onClick={()=>setShowInsp(o=>!o)}>
          {showInsp ? T.hideInspToggle : T.addInspToggle}
        </button>
        {showInsp && (
          <div className="extra-section" style={{marginTop:8}}>
            <h4>📋 {T.inspection}</h4>
            <div className="form-group"><label className="form-label">🐑 {T.sheepScore}</label><ScoreSelector value={iSheep} onChange={setISheep} /></div>
            <div className="form-group"><label className="form-label">🐐 {T.goatScore}</label><ScoreSelector value={iGoat} onChange={setIGoat} /></div>
            <div className="form-group"><label className="form-label">🐄 {T.cattleScore}</label><ScoreSelector value={iCattle} onChange={setICattle} /></div>
            <div className="form-group">
              <label className="form-label">{T.paddockCondition}</label>
              <input className="form-input" type="number" min="0" max="100" value={iCond} onChange={e=>setICond(e.target.value)} placeholder="0–100"/>
            </div>
            <div className="form-group">
              <label className="form-label">{T.observations}</label>
              <textarea className="form-textarea" rows={2} value={iObs} onChange={e=>setIObs(e.target.value)} placeholder="Waarnemings…"/>
            </div>
            <button className="btn btn-primary btn-full" onClick={submitInsp}
              disabled={iSheep===null && iGoat===null && iCattle===null && iCond===""}>
              {saved ? T.inspectionSaved : T.recordInspection}
            </button>
          </div>
        )}
        <button className="btn btn-ghost btn-full" style={{marginTop:12}} onClick={onClose}>{T.close}</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Entry Gate
// ══════════════════════════════════════════════════════════════════════════════
function EntryGate({ onPass, farmName, farmId }) {
  const [,] = useLang();
  const [pin,    setPin]    = useState("");
  const [pin2,   setPin2]   = useState("");
  const [err,    setErr]    = useState("");
  const [hasPin, setHasPin] = useState(null);

  useEffect(() => { load(KEYS.epin, null, farmId).then(v => setHasPin(!!v)); }, []);

  const submit = async () => {
    const stored = await load(KEYS.epin, null, farmId);
    if (!stored) {
      if (pin.length < 4) return setErr(getLang()==="en"?"Min 4 digits":"Min 4 syfers");
      if (pin !== pin2) return setErr(T.pinMismatch);
      await save(KEYS.epin, pin, farmId);
      onPass();
    } else {
      if (pin !== stored) return setErr(T.wrongEntryPin);
      onPass();
    }
  };

  if (hasPin === null) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"100vh",background:"var(--olive)",color:"#fff",gap:12}}>
      <div style={{fontSize:"3rem"}}>🐑</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.4rem"}}>{farmName||T.app}</div>
      <div style={{fontSize:".85rem",opacity:.7}}>{T.loading}</div>
    </div>
  );

  return (
    <div className="role-screen">
      <h1>{farmName||T.app}</h1>
      <p>{T.entryPinPrompt}</p>
      <div className="role-cards">
        <div className="role-card" style={{cursor:"default"}}>
          <div className="role-card-icon">🔒</div>
          <h3>{hasPin ? T.enterEntryPin : T.setEntryPin}</h3>
          <input className="form-input" type="password" inputMode="numeric"
            maxLength={8} placeholder="••••" value={pin}
            onChange={e=>{setPin(e.target.value);setErr("");}}
            style={{marginBottom:8,marginTop:10}} autoFocus/>
          {!hasPin && (
            <input className="form-input" type="password" inputMode="numeric"
              maxLength={8} placeholder="Bevestig kode" value={pin2}
              onChange={e=>{setPin2(e.target.value);setErr("");}}
              style={{marginBottom:8}}/>
          )}
          {err && <div style={{color:"var(--rust)",fontSize:".82rem",marginBottom:6}}>{err}</div>}
          <button className="btn btn-primary btn-full" onClick={submit}>
            {hasPin ? T.enterEntryPin : T.setEntryPin}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Role Screen
// ══════════════════════════════════════════════════════════════════════════════
function RoleScreen({ onPick, farmName, farmId }) {
  const [,] = useLang();
  const [pickingAdmin, setPickingAdmin] = useState(false);
  const [pin,   setPin]   = useState("");
  const [pin2,  setPin2]  = useState("");
  const [err,   setErr]   = useState("");
  const [hasPin,setHasPin]= useState(null);

  useEffect(()=>{ load(KEYS.pin, null, farmId).then(v => setHasPin(!!v)); },[]);

  const handleAdmin = async () => {
    const stored = await load(KEYS.pin, null, farmId);
    setHasPin(!!stored); setPickingAdmin(true); setPin(""); setPin2(""); setErr("");
  };

  const submitPin = async () => {
    const stored = await load(KEYS.pin, null, farmId);
    if (!stored) {
      if (pin.length < 4) return setErr(getLang()==="en"?"Min 4 digits":"Min 4 syfers");
      await save(KEYS.pin, pin, farmId);
      onPick("admin");
    } else {
      if (pin !== stored) return setErr(T.pinWrong);
      onPick("admin");
    }
  };

  return (
    <div className="role-screen">
      <h1>{farmName||T.app}</h1>
      <p>{T.selectRole}</p>
      {!pickingAdmin ? (
        <div className="role-cards">
          <button className="role-card" onClick={handleAdmin}>
            <div className="role-card-icon">👤</div><h3>{T.admin}</h3><p>{T.adminDesc}</p>
          </button>
          <button className="role-card" onClick={()=>onPick("worker")}>
            <div className="role-card-icon">👷</div><h3>{T.worker}</h3><p>{T.workerDesc}</p>
          </button>
        </div>
      ) : (
        <div className="role-cards">
          <div className="role-card" style={{cursor:"default"}}>
            <div className="role-card-icon">🔐</div>
            <h3>{hasPin ? T.enterPin : T.setPin}</h3>
            <p style={{marginBottom:10}}>{T.pinPrompt}</p>
            <input className="form-input" type="password" inputMode="numeric" maxLength={8}
              placeholder="••••" value={pin} onChange={e=>{setPin(e.target.value);setErr("");}}
              style={{marginBottom:8}} autoFocus/>
            {!hasPin && (
              <input className="form-input" type="password" inputMode="numeric" maxLength={8}
                placeholder="Bevestig PIN" value={pin2} onChange={e=>{setPin2(e.target.value);setErr("");}}
                style={{marginBottom:8}}/>
            )}
            {err && <div style={{color:"var(--rust)",fontSize:".82rem",marginBottom:6}}>{err}</div>}
            <button className="btn btn-primary btn-full" onClick={submitPin}>
              {hasPin ? T.enterPin : T.setPin}
            </button>
            <button className="btn btn-ghost btn-full" style={{marginTop:6}}
              onClick={()=>setPickingAdmin(false)}>{T.cancel}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Main App
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [, toggleLang] = useLang();
  const [authReady,  setAuthReady]  = useState(false);
  const [farmId,     setFarmId]     = useState(null);
  const [clientDoc,  setClientDoc]  = useState(null);
  const [entryPassed, setEntryPassed] = useState(false);
  const [role,        setRole]        = useState(null);
  const [tab,         setTab]         = useState("dashboard");
  const [paddocks,    setPaddocks]    = useState([]);
  const [events,      setEvents]      = useState([]);
  const [tasks,       setTasks]       = useState([]);
  const [issues,      setIssues]      = useState([]);
  const [treatments,  setTreatments]  = useState([]);
  const [settings,    setSettings]    = useState({
    farmName:"", haPerLSU:"", sheepFrame:"medium", goatFrame:"medium", cattleFrame:"medium",
    restPoolEnabled:false, simultaneousRestSlots:1, defaultRestDurationMonths:12
  });
  const [loaded,      setLoaded]      = useState(false);
  const [syncing,     setSyncing]     = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [pinVal,   setPinVal]   = useState("");
  const [pinErr,   setPinErr]   = useState("");

  // ── Undo stack (manager only, in-memory, max 5) ──
  const undoStack = useRef([]); // [{label, paddocks, events, tasks, issues, treatments}]
  const [undoAvailable, setUndoAvailable] = useState(false);

  const pushUndo = (label, snap) => {
    undoStack.current = [{ label, ...snap }, ...undoStack.current].slice(0, 5);
    setUndoAvailable(true);
  };

  const snapNow = () => ({
    paddocks: JSON.parse(JSON.stringify(paddocks)),
    events:   JSON.parse(JSON.stringify(events)),
    tasks:    JSON.parse(JSON.stringify(tasks)),
    issues:   JSON.parse(JSON.stringify(issues)),
    treatments: JSON.parse(JSON.stringify(treatments)),
  });

  const doUndo = async () => {
    if (!undoStack.current.length) return;
    const [top, ...rest] = undoStack.current;
    undoStack.current = rest;
    setUndoAvailable(rest.length > 0);
    setPaddocks(top.paddocks);
    setEvents(top.events);
    setTasks(top.tasks);
    setIssues(top.issues);
    setTreatments(top.treatments);
    // Save restored state to Firestore
    if (farmId) {
      await Promise.all([
        save(KEYS.p,  top.paddocks,   farmId),
        save(KEYS.e,  top.events,     farmId),
        save(KEYS.t,  top.tasks,      farmId),
        save(KEYS.i,  top.issues,     farmId),
        save(KEYS.tr, top.treatments, farmId),
      ]);
    }
  };

  useEffect(() => {
    // If offline, skip Firebase Auth entirely and use cached credentials
    if (!navigator.onLine) {
      const cachedFarmId = localStorage.getItem("pb2_cached_farmId");
      if (cachedFarmId) {
        const cachedClient = lsGet(cachedFarmId, "__client__") || { status: "active" };
        setFarmId(cachedFarmId);
        setClientDoc({ ...cachedClient, status: "active" });
      }
      setAuthReady(true);
      return;
    }

    // Online — normal Firebase Auth flow
    setPersistence(auth, browserLocalPersistence)
      .catch(e => console.error("Auth persistence:", e))
      .finally(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
          if (user) {
            localStorage.setItem("pb2_cached_farmId", user.uid);
            setFarmId(user.uid);
            let client = await loadClient(user.uid);
            if (!client) {
              client = {
                email: user.email, farmName: "", status: "trial",
                trialEndsAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
                createdAt: new Date().toISOString(), lastActive: new Date().toISOString(), payfastSubId: null
              };
              await saveClient(user.uid, client);
            } else {
              await saveClient(user.uid, { lastActive: new Date().toISOString() });
            }
            setClientDoc(client);
          } else {
            localStorage.removeItem("pb2_cached_farmId");
            setFarmId(null); setClientDoc(null);
          }
          setAuthReady(true);
        });
        return () => unsub();
      });
  }, []);

  useEffect(() => {
    if (!farmId) return;
    (async () => {
      const [p,e,t,i,tr,s] = await Promise.all([
        load(KEYS.p, SEED_PADDOCKS, farmId), load(KEYS.e, [], farmId),
        load(KEYS.t, [], farmId),            load(KEYS.i, [], farmId),
        load(KEYS.tr, [], farmId),
        load(KEYS.s, { farmName:"", haPerLSU:"", sheepFrame:"medium", goatFrame:"medium", cattleFrame:"medium", restPoolEnabled:false, simultaneousRestSlots:1, defaultRestDurationMonths:12 }, farmId),
      ]);
      const processedP = processRestQueue(p, s);
      const restEvents = [];
      processedP.forEach(np => {
        const op = p.find(x=>x.id===np.id);
        if (!op) return;
        if (!op.resting && np.resting) restEvents.push({ id:uid(), ts:nowISO(), type:"restStart", paddock:np.id, paddockName:np.name });
        if (op.resting && !np.resting) restEvents.push({ id:uid(), ts:nowISO(), type:"restEnd",   paddock:np.id, paddockName:np.name });
      });
      setPaddocks(processedP); setEvents(restEvents.length ? [...restEvents, ...e] : e);
      setTasks(t); setIssues(i); setTreatments(tr); setSettings(s);
      setLoaded(true);
    })();
  }, [farmId]);

  useEffect(() => { if(loaded&&farmId){ setSyncing(true); save(KEYS.p,paddocks,farmId).then(()=>setSyncing(false)); }}, [paddocks,loaded]);
  useEffect(() => { if(loaded&&farmId) save(KEYS.e, events,     farmId); }, [events,     loaded]);
  useEffect(() => { if(loaded&&farmId) save(KEYS.t, tasks,      farmId); }, [tasks,      loaded]);
  useEffect(() => { if(loaded&&farmId) save(KEYS.i, issues,     farmId); }, [issues,     loaded]);
  useEffect(() => { if(loaded&&farmId) save(KEYS.tr,treatments, farmId); }, [treatments, loaded]);
  useEffect(() => { if(loaded&&farmId) save(KEYS.s, settings,   farmId); }, [settings,   loaded]);
  useEffect(() => {
    if(loaded&&farmId&&settings.farmName) saveClient(farmId, { farmName:settings.farmName });
  }, [settings.farmName, loaded]);

  const addEvent = (ev, label) => {
    setEvents(prev => [{ id:uid(), ts: ev.ts || nowISO(), ...ev }, ...prev]);
  };

  // Wrap state setters to push undo before each action
  const recordAction = (label, fn) => {
    pushUndo(label, snapNow());
    fn();
  };

  const addInspection = (paddockId, sheepScore, goatScore, cattleScore, paddockCond, observations, dateStr) => {
    const ts = dateStr ? dateToISO(dateStr) : nowISO();
    pushUndo(getLang()==="en"?"Inspection recorded":"Inspeksie rekordeer", snapNow());
    const entry = { id:uid(), ts, source:"inspection", sheepScore, goatScore, cattleScore, paddockCond, observations };
    setPaddocks(prev => prev.map(p => p.id===paddockId
      ? { ...p, paddockCondition:paddockCond!==null?paddockCond:p.paddockCondition,
               conditionHistory:[entry,...(p.conditionHistory||[])].sort((a,b)=>new Date(b.ts)-new Date(a.ts)) } : p));
    addEvent({ type:"inspection", ts, paddock:paddockId,
      paddockName:paddocks.find(p=>p.id===paddockId)?.name,
      sheepScore, goatScore, paddockCond, observations });
  };

  const handleFarmReset = async (confirmedName) => {
    if (confirmedName !== settings.farmName) return false;
    pushUndo(getLang()==="en"?"Before farm reset":"Voor plaas herstel", snapNow());
    const empty = { paddocks:[], events:[], tasks:[], issues:[], treatments:[] };
    setPaddocks([]); setEvents([]); setTasks([]); setIssues([]); setTreatments([]);
    if (farmId) {
      await Promise.all([
        save(KEYS.p,  [], farmId),
        save(KEYS.e,  [], farmId),
        save(KEYS.t,  [], farmId),
        save(KEYS.i,  [], farmId),
        save(KEYS.tr, [], farmId),
      ]);
    }
    return true;
  };

  const applyExtra = (extra, sourcePaddockId, destPaddockId = null, ts = null) => {
    const isSame = !destPaddockId || destPaddockId === sourcePaddockId;
    const evTs = ts || nowISO();
    const evtSrc = isSame ? "treatment" : "movement";
    const lostSh = totalCat(extra.lost.sheep), lostGo = totalCat(extra.lost.goats), lostCa = totalCattle(extra.lost.cattle||emptyCattle());
    if (lostSh+lostGo+lostCa > 0) {
      setPaddocks(prev => prev.map(p => {
        if(p.id!==sourcePaddockId) return p;
        const newSh=subCat(p.sheep,extra.lost.sheep), newGo=subCat(p.goats,extra.lost.goats), newCa=subCattle(p.cattle||emptyCattle(),extra.lost.cattle||emptyCattle());
        const newLSU=calcCurrentLSU({...p,sheep:newSh,goats:newGo,cattle:newCa},settings).totalLSU;
        const isEmpty=totalCat(newSh)+totalCat(newGo)+totalCattle(newCa)===0;
        const updated=closePeriod(p, isEmpty?0:newLSU);
        return {...updated,sheep:newSh,goats:newGo,cattle:newCa,arrivedAt:isEmpty?null:updated.arrivedAt,periodStartLSU:isEmpty?0:newLSU};
      }));
      addEvent({type:"lost", ts:evTs, paddock:sourcePaddockId, paddockName:paddocks.find(p=>p.id===sourcePaddockId)?.name, sheep:extra.lost.sheep, goats:extra.lost.goats, cattle:extra.lost.cattle});
    }
    const deadSh = totalCat(extra.dead.sheep), deadGo = totalCat(extra.dead.goats), deadCa = totalCattle(extra.dead.cattle||emptyCattle());
    if (deadSh+deadGo+deadCa > 0) {
      setPaddocks(prev => prev.map(p => {
        if(p.id!==sourcePaddockId) return p;
        const newSh=subCat(p.sheep,extra.dead.sheep), newGo=subCat(p.goats,extra.dead.goats), newCa=subCattle(p.cattle||emptyCattle(),extra.dead.cattle||emptyCattle());
        const newLSU=calcCurrentLSU({...p,sheep:newSh,goats:newGo,cattle:newCa},settings).totalLSU;
        const isEmpty=totalCat(newSh)+totalCat(newGo)+totalCattle(newCa)===0;
        const updated=closePeriod(p, isEmpty?0:newLSU);
        return {...updated,sheep:newSh,goats:newGo,cattle:newCa,arrivedAt:isEmpty?null:updated.arrivedAt,periodStartLSU:isEmpty?0:newLSU};
      }));
      addEvent({type:"death", ts:evTs, paddock:sourcePaddockId, paddockName:paddocks.find(p=>p.id===sourcePaddockId)?.name, sheep:extra.dead.sheep, goats:extra.dead.goats, cattle:extra.dead.cattle, cause:extra.deadCause});
    }
    const hasScores  = extra.sheepScore!==null || extra.goatScore!==null || extra.cattleScore!==null;
    const hasPaddock = extra.paddockCond!==null;
    const hasObs     = !!extra.observations;
    if (isSame) {
      if (hasScores || hasPaddock || hasObs) {
        const entry = { id:uid(), ts:evTs, source:evtSrc, sheepScore:extra.sheepScore, goatScore:extra.goatScore, cattleScore:extra.cattleScore, paddockCond:extra.paddockCond, observations:extra.observations };
        setPaddocks(prev => prev.map(p => p.id===sourcePaddockId
          ? { ...p, paddockCondition:hasPaddock?extra.paddockCond:p.paddockCondition, conditionHistory:[entry,...(p.conditionHistory||[])] } : p));
      }
    } else {
      if (hasScores) {
        const destEntry = { id:uid(), ts:evTs, source:evtSrc, sheepScore:extra.sheepScore, goatScore:extra.goatScore, cattleScore:extra.cattleScore, paddockCond:null, observations:extra.observations };
        setPaddocks(prev => prev.map(p => p.id===destPaddockId ? { ...p, conditionHistory:[destEntry,...(p.conditionHistory||[])] } : p));
      }
      if (hasPaddock || hasObs) {
        const srcEntry = { id:uid(), ts:evTs, source:evtSrc, sheepScore:null, goatScore:null, paddockCond:extra.paddockCond, observations:extra.observations };
        setPaddocks(prev => prev.map(p => p.id===sourcePaddockId
          ? { ...p, paddockCondition:hasPaddock?extra.paddockCond:p.paddockCondition, conditionHistory:[srcEntry,...(p.conditionHistory||[])] } : p));
      }
    }
  };

  const handleNavSwitch = async () => {
    if (role === "admin") { setRole("worker"); }
    else { setPinVal(""); setPinErr(""); setPinModal(true); }
  };

  const submitNavPin = async () => {
    const stored = await load(KEYS.pin, null, farmId);
    if (pinVal !== stored) return setPinErr(T.pinWrong);
    setRole("admin"); setPinModal(false);
  };

  const handleSignOut = async () => {
    if (!confirm(T.signOutConfirm)) return;
    // Clear state but preserve localStorage cache so data survives sign-out/sign-in
    setLoaded(false); setPaddocks([]); setEvents([]); setTasks([]);
    setIssues([]); setTreatments([]); setSettings({ farmName:"", haPerLSU:"", sheepFrame:"medium", goatFrame:"medium", cattleFrame:"medium", restPoolEnabled:false, simultaneousRestSlots:1, defaultRestDurationMonths:12 });
    setEntryPassed(false); setRole(null);
    setClientDoc(null);
    // Sign out last — after state is cleared — so onAuthStateChanged doesn't race
    await signOut(auth);
    setFarmId(null);
  };

  if (!authReady) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"100vh",background:"var(--olive)",color:"#fff",gap:12}}>
      <div style={{fontSize:"3rem"}}>🐑</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.4rem"}}>{T.app}</div>
      <div style={{fontSize:".85rem",opacity:.7}}>{T.loading}</div>
    </div>
  );

  if (!farmId) return (<><style>{CSS}</style><AuthScreen/></>);

  const trialExpired = clientDoc?.status === "trial" && clientDoc?.trialEndsAt && new Date(clientDoc.trialEndsAt) < new Date();
  const isBlocked = clientDoc?.status === "suspended" || clientDoc?.status === "cancelled" || trialExpired;
  if (isBlocked) return (<><style>{CSS}</style><PaywallScreen clientDoc={clientDoc} onSignOut={handleSignOut}/></>);

  const displayName = settings.farmName || clientDoc?.farmName || T.app;
  if (!entryPassed) return (<><style>{CSS}</style><EntryGate onPass={()=>setEntryPassed(true)} farmName={displayName} farmId={farmId}/></>);

  if (!loaded) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"100vh",background:"var(--olive)",color:"#fff",gap:12}}>
      <div style={{fontSize:"3rem"}}>🐑</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.4rem"}}>{displayName}</div>
      <div style={{fontSize:".85rem",opacity:.7}}>{T.loadingData}</div>
    </div>
  );

  if (!settings.farmName) return (<><style>{CSS}</style><FarmSetup onDone={name=>setSettings(s=>({...s,farmName:name}))}/></>);
  if (!role) return (<><style>{CSS}</style><RoleScreen onPick={r=>setRole(r)} farmName={settings.farmName} farmId={farmId}/></>);

  const trialDaysLeft = clientDoc?.status === "trial" && clientDoc?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(clientDoc.trialEndsAt) - new Date()) / 86400000)) : null;

  const pendingCount = tasks.filter(t=>t.status==="pending").length;
  const overdueCount = tasks.filter(t=>t.status==="pending"&&isOverdue(t.dueDate)).length;
  const openIssues   = issues.filter(i=>i.status==="open").length;

  // Farm-wide LSU-day totals for dashboard chip
  const farmTotalBudget   = paddocks.reduce((s,p)=>{ const c=calcLSU(p,settings); return s+(c.budget||0); },0);
  const farmTotalConsumed = paddocks.reduce((s,p)=>{ const c=calcLSU(p,settings); return s+(c.consumed||0); },0);
  const farmLoadPct       = farmTotalBudget>0 ? (farmTotalConsumed/farmTotalBudget)*100 : null;
  const farmTotalLSU      = paddocks.reduce((s,p)=>s+calcLSU(p,settings).totalLSU,0);
  const farmTotalCapacity = paddocks.reduce((s,p)=>{ const c=calcLSU(p,settings); return s+(c.capacity||0); },0);

  const TABS = [
    {id:"dashboard",    label:"🏠 "+T.overview},
    {id:"paddocks",     label:"📍 "+T.paddocks},
    {id:"movements",    label:"🔀 "+T.movements},
    ...(role==="admin" ? [{id:"transactions", label:"💸 "+T.transactions}] : []),
    {id:"losses",       label:"☠️ "+T.losses},
    {id:"treatments",   label:"💊 "+T.treatments},
    {id:"tasks",        label:`✅ ${T.tasks}${overdueCount?` ⚠️${overdueCount}`:pendingCount?` (${pendingCount})`:""}`},
    {id:"issues",       label:`⚠️ ${T.issues}${openIssues?` (${openIssues})`:""}`},
    {id:"history",      label:"📋 "+T.history},
    {id:"stats",        label:"📈 "+T.stats},
    ...(role==="admin" ? [{id:"export", label:"📊 "+T.export}] : []),
  ];

  const ctx = { paddocks, setPaddocks, events, setEvents, tasks, setTasks,
                issues, setIssues, treatments, setTreatments, role, addEvent, applyExtra, addInspection,
                settings, pushUndo, snapNow };

  return (
    <>
      <style>{CSS}</style>
      {trialDaysLeft !== null && trialDaysLeft <= 14 && (
        <div className="sync-bar" style={{background:"var(--amber)"}}>⏳ {trialDaysLeft} {T.trialDaysLeft}</div>
      )}
      {syncing && <div className="sync-bar">☁️ {getLang()==="en"?"Saving to server…":"Stoor na bediener…"}</div>}
      <nav className="nav">
        <h1>🐑 {settings.farmName}</h1>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button className="nav-role" onClick={toggleLang} title={T.language}>{T.switchLang}</button>
          {role==="admin" && (<button className="nav-role" onClick={()=>setSettingsModal(true)} title={T.settings}>⚙️</button>)}
          <button className="nav-role" onClick={handleNavSwitch}>
            {role==="admin"?"👤 "+T.admin:"👷 "+T.worker}
          </button>
        </div>
      </nav>
      <div className="tabs">
        {TABS.map(tb => <button key={tb.id} className={`tab ${tab===tb.id?"active":""}`} onClick={()=>setTab(tb.id)}>{tb.label}</button>)}
      </div>
      <div className="page">
        {tab==="dashboard"    && <Dashboard    {...ctx} setTab={setTab} farmTotalLSU={farmTotalLSU} farmTotalCapacity={farmTotalCapacity} farmLoadPct={farmLoadPct}/>}
        {tab==="paddocks"     && <Paddocks     {...ctx} />}
        {tab==="movements"    && <Bewegings    {...ctx} />}
        {tab==="transactions" && <Transaksies  {...ctx} />}
        {tab==="losses"       && <Verliese     {...ctx} />}
        {tab==="treatments"   && <Behandelings {...ctx} />}
        {tab==="tasks"        && <Take         {...ctx} />}
        {tab==="issues"       && <Probleme     {...ctx} />}
        {tab==="history"      && <Geskiedenis  events={events} paddocks={paddocks} />}
        {tab==="stats"        && <Analitiek    {...ctx} />}
        {tab==="export"       && <Uitvoer      {...ctx} />}
      </div>

      {/* ── Undo FAB (manager only) ── */}
      {role==="admin" && undoAvailable && undoStack.current.length > 0 && (
        <button className="undo-fab" onClick={doUndo}>
          ↩️ {getLang()==="en"?"Undo":"Ontdoen"}: {undoStack.current[0]?.label}
        </button>
      )}

      {pinModal && (
        <div className="overlay" onClick={()=>setPinModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360}}>
            <div className="modal-handle"/>
            <h2>🔐 {T.enterPin}</h2>
            <input className="form-input" type="password" inputMode="numeric" maxLength={8}
              placeholder="••••" value={pinVal}
              onChange={e=>{setPinVal(e.target.value);setPinErr("");}}
              autoFocus style={{marginBottom:8}}/>
            {pinErr && <div style={{color:"var(--rust)",fontSize:".82rem",marginBottom:6}}>{pinErr}</div>}
            <button className="btn btn-primary btn-full" onClick={submitNavPin}>{T.enterPin}</button>
          </div>
        </div>
      )}

      {settingsModal && (
        <SettingsModal
          settings={settings}
          onSave={s=>{ setSettings(s); setSettingsModal(false); }}
          onClose={()=>setSettingsModal(false)}
          onSignOut={handleSignOut}
          onFarmReset={handleFarmReset}
        />
      )}
    </>
  );
}

// ── AuthScreen ────────────────────────────────────────────────────────────────
function AuthScreen() {
  const [,] = useLang();
  const [mode, setMode] = useState("signin");
  const [farmName, setFarmName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const errMsg = (code) => {
    if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential"].includes(code)) return "Verkeerde e-pos of wagwoord";
    if (code === "auth/email-already-in-use") return "E-pos reeds geregistreer";
    if (code === "auth/weak-password") return "Wagwoord te kort (min 6 karakters)";
    if (code === "auth/invalid-email") return "Ongeldige e-pos adres";
    return `Fout: ${code}`;
  };

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (!farmName.trim()) { setErr(getLang()==="en"?"Enter your farm name":"Voer jou plaas naam in"); setBusy(false); return; }
        if (password !== password2) { setErr(T.pinMismatch); setBusy(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const uid2 = cred.user.uid;
        await saveClient(uid2, {
          email: email.trim(), farmName: farmName.trim(), status: "trial",
          trialEndsAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
          createdAt: new Date().toISOString(), lastActive: new Date().toISOString(), payfastSubId: null
        });
        await save(KEYS.s, { farmName: farmName.trim(), haPerLSU:"", sheepFrame:"medium", goatFrame:"medium", cattleFrame:"medium", restPoolEnabled:false, simultaneousRestSlots:1, defaultRestDurationMonths:12 }, uid2);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch(e) { setErr(errMsg(e.code)); }
    setBusy(false);
  };

  return (
    <div className="role-screen">
      <div style={{fontSize:"3rem",marginBottom:8}}>🐑</div>
      <h1 style={{marginBottom:6}}>{T.app}</h1>
      <p>{mode==="signup" ? (getLang()==="en"?"Create your farm account":"Skep jou plaas rekening") : (getLang()==="en"?"Sign in to your farm":"Teken in by jou plaas")}</p>
      <div className="role-cards">
        <div className="role-card" style={{cursor:"default"}}>
          {mode==="signup" && (
            <div className="form-group">
              <label className="form-label">{T.farmName}</label>
              <input className="form-input" value={farmName} onChange={e=>{setFarmName(e.target.value);setErr("");}} placeholder={T.farmNamePlaceholder} autoFocus/>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{T.email}</label>
            <input className="form-input" type="email" value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} placeholder="jan@plaas.co.za" autoFocus={mode==="signin"}/>
          </div>
          <div className="form-group">
            <label className="form-label">{T.password}</label>
            <input className="form-input" type="password" value={password} onChange={e=>{setPassword(e.target.value);setErr("");}} placeholder="••••••" onKeyDown={e=>e.key==="Enter"&&mode==="signin"&&submit()}/>
          </div>
          {mode==="signup" && (
            <div className="form-group">
              <label className="form-label">{T.confirmPassword}</label>
              <input className="form-input" type="password" value={password2} onChange={e=>{setPassword2(e.target.value);setErr("");}} placeholder="••••••"/>
            </div>
          )}
          {err && <div style={{color:"var(--rust)",fontSize:".82rem",marginBottom:8}}>{err}</div>}
          <button className="btn btn-primary btn-full" onClick={submit} disabled={busy}>
            {busy ? (getLang()==="en"?"Busy…":"Besig…") : mode==="signup" ? T.signUp : T.signIn}
          </button>
          <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={()=>{setMode(m=>m==="signin"?"signup":"signin");setErr("");}}>
            {mode==="signup" ? T.hasAccount : T.noAccount}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PaywallScreen ─────────────────────────────────────────────────────────────
function PaywallScreen({ clientDoc, onSignOut }) {
  const [,] = useLang();
  const suspended = clientDoc?.status === "suspended";
  return (
    <div className="role-screen">
      <div style={{fontSize:"3rem",marginBottom:8}}>🔒</div>
      <h1 style={{marginBottom:6}}>{suspended ? T.suspendedTitle : T.trialExpiredTitle}</h1>
      <div className="role-cards">
        <div className="role-card" style={{cursor:"default",textAlign:"center"}}>
          <p style={{color:"var(--muted)",marginBottom:16}}>{suspended ? T.subscriptionSuspended : T.subscriptionExpired}</p>
          <div style={{fontWeight:700,fontSize:"1rem",marginBottom:16}}>support@plaasbestuurder.co.za</div>
          <button className="btn btn-ghost btn-full" onClick={onSignOut}>{T.signOut}</button>
        </div>
      </div>
    </div>
  );
}

// ── FarmSetup ─────────────────────────────────────────────────────────────────
function FarmSetup({ onDone }) {
  const [,] = useLang();
  const [name, setName] = useState("");
  const submit = () => { if(name.trim()) onDone(name.trim()); };
  return (
    <div className="role-screen">
      <div style={{fontSize:"3.5rem",marginBottom:8}}>🐑</div>
      <h1 style={{marginBottom:6}}>{T.setupWelcome}</h1>
      <p>{T.setupDesc}</p>
      <div className="role-cards">
        <div className="role-card" style={{cursor:"default"}}>
          <div className="role-card-icon">🏡</div>
          <h3>{T.setupFarmName}</h3>
          <input className="form-input" value={name} onChange={e=>setName(e.target.value)}
            placeholder={T.farmNamePlaceholder} autoFocus
            onKeyDown={e=>e.key==="Enter"&&submit()} style={{marginTop:12,marginBottom:10}}/>
          <button className="btn btn-primary btn-full" onClick={submit} disabled={!name.trim()}>{T.setupContinue}</button>
        </div>
      </div>
    </div>
  );
}

// ── SettingsModal — now includes LSU fields ───────────────────────────────────
function SettingsModal({ settings, onSave, onClose, onSignOut, onFarmReset }) {
  const [,] = useLang();
  const [s, setS] = useState({
    farmName: settings.farmName||"",
    haPerLSU: settings.haPerLSU||"",
    sheepFrame: settings.sheepFrame||"medium",
    goatFrame: settings.goatFrame||"medium",
    cattleFrame: settings.cattleFrame||"medium",
    restPoolEnabled: settings.restPoolEnabled||false,
    simultaneousRestSlots: settings.simultaneousRestSlots||1,
    defaultRestDurationMonths: settings.defaultRestDurationMonths||12,
  });
  const [saved, setSaved] = useState(false);
  const [resetStep, setResetStep] = useState(0); // 0=hidden, 1=warn, 2=confirm
  const [resetName, setResetName] = useState("");
  const [resetErr,  setResetErr]  = useState("");
  const [resetDone, setResetDone] = useState(false);

  const upd = (k,v) => setS(prev=>({...prev,[k]:v}));

  const submit = () => {
    if(!s.farmName.trim()) return;
    onSave({ ...settings, ...s, farmName: s.farmName.trim() });
    setSaved(true);
    setTimeout(()=>{ setSaved(false); onClose(); }, 1200);
  };

  const handleReset = async () => {
    if (resetName !== settings.farmName) {
      setResetErr(getLang()==="en"?"Farm name does not match":"Plaas naam stem nie ooreen nie");
      return;
    }
    const ok = await onFarmReset(resetName);
    if (ok) { setResetDone(true); setTimeout(()=>onClose(), 2000); }
  };

  const frameOptions = [
    { value:"klein",  label:T.frameKlein },
    { value:"medium", label:T.frameMedium },
    { value:"groot",  label:T.frameGroot },
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <h2>⚙️ {T.settings}</h2>

        <div className="form-group">
          <label className="form-label">{T.farmName}</label>
          <input className="form-input" value={s.farmName} onChange={e=>upd("farmName",e.target.value)} placeholder={T.farmNamePlaceholder} autoFocus/>
        </div>

        <div style={{borderTop:"1px solid var(--border)",marginTop:16,paddingTop:16}}>
          <div style={{fontSize:".82rem",fontWeight:700,color:"var(--olive)",marginBottom:12}}>⚖️ {getLang()==="en"?"Carrying Capacity":"Drakrag"}</div>

          <div className="form-group">
            <label className="form-label">{T.haPerLSU}</label>
            <input className="form-input" type="number" min="0.1" step="0.1" value={s.haPerLSU}
              onChange={e=>upd("haPerLSU",e.target.value)} placeholder="bv. 8"/>
            <div className="form-hint">{getLang()==="en"?"Hectares needed to support 1 LSU on this farm":"Hektaar benodig om 1 LSU op hierdie plaas te onderhou"}</div>
          </div>

          <div className="form-group">
            <label className="form-label">🐑 {T.sheepFrame}</label>
            <select className="form-select" value={s.sheepFrame} onChange={e=>upd("sheepFrame",e.target.value)}>
              {frameOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="form-hint">{T.sheepFrameHint}</div>
          </div>

          <div className="form-group">
            <label className="form-label">🐐 {T.goatFrame}</label>
            <select className="form-select" value={s.goatFrame} onChange={e=>upd("goatFrame",e.target.value)}>
              {frameOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="form-hint">{T.goatFrameHint}</div>
          </div>

          <div className="form-group">
            <label className="form-label">🐄 {T.cattleFrame}</label>
            <select className="form-select" value={s.cattleFrame} onChange={e=>upd("cattleFrame",e.target.value)}>
              {frameOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="form-hint">{T.cattleFrameHint}</div>
          </div>
        </div>

        <div style={{borderTop:"1px solid var(--border)",marginTop:16,paddingTop:16}}>
          <div style={{fontSize:".82rem",fontWeight:700,color:"var(--olive)",marginBottom:12}}>🌱 {T.restPlan}</div>
          <label className="linked-check">
            <input type="checkbox" checked={s.restPoolEnabled} onChange={e=>upd("restPoolEnabled",e.target.checked)} />
            🔁 {T.restPoolEnabled}
          </label>
          {s.restPoolEnabled && (
            <>
              <div className="form-group" style={{marginTop:10}}>
                <label className="form-label">{T.simultaneousRestSlots}</label>
                <input className="form-input" type="number" min="1" value={s.simultaneousRestSlots}
                  onChange={e=>upd("simultaneousRestSlots",e.target.value)} placeholder="1"/>
              </div>
              <div className="form-group">
                <label className="form-label">{T.defaultRestMonths}</label>
                <input className="form-input" type="number" min="1" value={s.defaultRestDurationMonths}
                  onChange={e=>upd("defaultRestDurationMonths",e.target.value)} placeholder="12"/>
              </div>
              <div className="form-hint">{T.restPoolHint}</div>
            </>
          )}
        </div>

        <button className="btn btn-primary btn-full" onClick={submit} disabled={!s.farmName.trim()}>
          {saved ? T.settingsSaved : T.save}
        </button>
        <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={onClose}>{T.cancel}</button>

        {/* ── Sign Out ── */}
        <div className="danger-zone">
          <button className="btn btn-ghost btn-full" style={{color:"var(--rust)"}} onClick={onSignOut}>🚪 {T.signOut}</button>
        </div>

        {/* ── Farm Reset ── */}
        <div className="danger-zone">
          <div style={{fontSize:".78rem",fontWeight:700,color:"var(--rust)",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>
            ⚠️ {getLang()==="en"?"Danger Zone":"Gevaar Sone"}
          </div>
          {resetStep === 0 && (
            <button className="btn btn-ghost btn-full" style={{color:"var(--rust)",borderColor:"var(--rust)"}}
              onClick={()=>setResetStep(1)}>
              🗑️ {getLang()==="en"?"Reset All Farm Data":"Stel Alle Plaas Data Terug"}
            </button>
          )}
          {resetStep === 1 && (
            <div style={{background:"#fff8f8",border:"1.5px solid var(--rust)",borderRadius:10,padding:14}}>
              <div style={{fontWeight:700,color:"var(--rust)",marginBottom:8}}>
                ⚠️ {getLang()==="en"?"This will permanently erase ALL data":"Dit sal ALLE data permanent uitvee"}
              </div>
              <div style={{fontSize:".82rem",color:"var(--muted)",marginBottom:12}}>
                {getLang()==="en"
                  ?"All paddocks, animals, movements, losses, treatments, tasks and issues will be deleted. This cannot be undone."
                  :"Alle kampe, diere, bewegings, verliese, behandelings, take en probleme sal verwyder word. Dit kan nie ontdoen word nie."}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-rust" style={{flex:1}} onClick={()=>setResetStep(2)}>
                  {getLang()==="en"?"Yes, continue":"Ja, gaan voort"}
                </button>
                <button className="btn btn-ghost" onClick={()=>setResetStep(0)}>{T.cancel}</button>
              </div>
            </div>
          )}
          {resetStep === 2 && (
            <div style={{background:"#fff8f8",border:"2px solid var(--rust)",borderRadius:10,padding:14}}>
              {resetDone ? (
                <div style={{color:"var(--green)",fontWeight:700,textAlign:"center"}}>
                  ✅ {getLang()==="en"?"Farm data cleared":"Plaas data uitgevee"}
                </div>
              ) : (
                <>
                  <div style={{fontWeight:700,color:"var(--rust)",marginBottom:8}}>
                    {getLang()==="en"
                      ?`Type "${settings.farmName}" to confirm`
                      :`Tik "${settings.farmName}" om te bevestig`}
                  </div>
                  <input
                    className="reset-confirm-input"
                    value={resetName}
                    onChange={e=>{setResetName(e.target.value);setResetErr("");}}
                    placeholder={settings.farmName}
                  />
                  {resetErr && <div style={{color:"var(--rust)",fontSize:".78rem",marginTop:4}}>{resetErr}</div>}
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button className="btn btn-rust" style={{flex:1}} onClick={handleReset}
                      disabled={resetName !== settings.farmName}>
                      🗑️ {getLang()==="en"?"Erase Everything":"Vee Alles Uit"}
                    </button>
                    <button className="btn btn-ghost" onClick={()=>{setResetStep(0);setResetName("");setResetErr("");}}>
                      {T.cancel}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ paddocks, setPaddocks, events, tasks, issues, role, setTab, addInspection, settings, farmTotalLSU, farmTotalCapacity, farmLoadPct }) {
  const [,] = useLang();
  const [detailId, setDetailId] = useState(null);
  const detailPaddock = paddocks.find(p=>p.id===detailId);
  const totSheep  = paddocks.reduce((s,p)=>s+totalCat(p.sheep),0);
  const totGoats  = paddocks.reduce((s,p)=>s+totalCat(p.goats),0);
  const totCattle = paddocks.reduce((s,p)=>s+totalCattle(p.cattle||emptyCattle()),0);
  const pending  = tasks.filter(t=>t.status==="pending").length;
  const overdue  = tasks.filter(t=>t.status==="pending"&&isOverdue(t.dueDate)).length;
  const openI    = issues.filter(i=>i.status==="open").length;
  const lsuColor = farmLoadPct===null?"var(--muted)":farmLoadPct>100?"var(--rust)":farmLoadPct>80?"var(--amber)":"var(--green)";

  return (
    <>
      <div className="sec-head"><h2>{T.overview}</h2></div>
      <div className="summary-strip">
        <div className="chip"><div className="chip-val sheep-c">{totSheep}</div><div className="chip-lbl">🐑 {T.sheep}</div></div>
        <div className="chip"><div className="chip-val goats-c">{totGoats}</div><div className="chip-lbl">🐐 {T.goats}</div></div>
        <div className="chip"><div className="chip-val" style={{color:"var(--teal)"}}>{totCattle}</div><div className="chip-lbl">🐄 {T.cattle}</div></div>
        <div className="chip"><div className="chip-val total-c">{totSheep+totGoats+totCattle}</div><div className="chip-lbl">{T.total}</div></div>
        {farmLoadPct !== null && (
          <div className="chip">
            <div className="chip-val" style={{color:lsuColor}}>{farmLoadPct.toFixed(0)}%</div>
            <div className="chip-lbl">⚖️ {T.farmLSU}</div>
          </div>
        )}
        {settings?.restPoolEnabled && (
          <div className="chip">
            <div className="chip-val" style={{color:"var(--olive2)"}}>{paddocks.filter(p=>p.resting).length}</div>
            <div className="chip-lbl">🌱 {T.resting}</div>
          </div>
        )}
        <div className="chip">
          <div className="chip-val" style={{color:overdue?"var(--rust)":pending?"var(--amber)":"var(--olive2)"}}>{pending}</div>
          <div className="chip-lbl">{overdue?`⚠️ ${overdue} Agterstallig`:T.pendingTasks}</div>
        </div>
        <div className="chip"><div className="chip-val" style={{color:openI?"var(--rust)":"var(--olive2)"}}>{openI}</div><div className="chip-lbl">{T.openIssues}</div></div>
      </div>

      {overdue>0 && (
        <div className="card" style={{borderColor:"var(--rust)",background:"#fff8f8",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div className="card-title overdue-text">⚠️ {overdue} {T.overdueWarning}</div>
            <button className="btn btn-rust btn-sm" onClick={()=>setTab("tasks")}>{T.viewTasks}</button>
          </div>
        </div>
      )}

      <div className="sec-head" style={{marginTop:8}}>
        <h2>{T.paddocks}</h2>
        <span style={{fontSize:".72rem",color:"var(--muted)"}}>Tik vir detail</span>
      </div>
      {paddocks.map(p=>(
        <PaddockCard key={p.id} p={p} role={role} settings={settings}
          onClick={()=>setDetailId(p.id)}
          onDelete={role==="admin"
            ? (e)=>{e.stopPropagation();if(confirm(`${p.name} ${T.confirmDelete}`))setPaddocks(prev=>prev.filter(x=>x.id!==p.id));}
            : undefined}
        />
      ))}

      {events.length>0 && (
        <>
          <div className="sec-head" style={{marginTop:18}}><h2>{T.recentActivity}</h2></div>
          <div className="card">{events.slice(0,5).map(ev=><EventRow key={ev.id} ev={ev}/>)}</div>
        </>
      )}
      {detailId && detailPaddock && (
        <PaddockDetailModal p={detailPaddock} settings={settings} onClose={()=>setDetailId(null)} addInspection={addInspection}/>
      )}
    </>
  );
}

// ── Paddock Card ──────────────────────────────────────────────────────────────
function PaddockCard({ p, role, settings, onDelete, onReset, onRestManage, onClick }) {
  const [,] = useLang();
  const days = daysSince(p.arrivedAt);
  const hasSheep = totalCat(p.sheep)>0;
  const hasGoats = totalCat(p.goats)>0;
  const gradeClass = days===null?"":days<7?"graze-ok":days<14?"graze-warn":"graze-high";
  const gradeLabel = days===null?"": `${days} ${T.daysInPaddock}${days>=14?" "+T.considerMoving:days>=7?" "+T.monitor:" "+T.okStatus}`;
  const latest = (p.conditionHistory||[])[0];

  return (
    <div className={`card ${onClick?"card-tappable":""}`} style={{marginBottom:10}} onClick={onClick}>
      <div className="card-header">
        <div>
          <div className="card-title">{p.name}</div>
          {p.hectares ? <div style={{fontSize:".73rem",color:"var(--muted)"}}>{p.hectares} ha</div> : null}
        </div>
        {role==="admin" && (onDelete||onReset||onRestManage) && (
          <div className="admin-actions">
            {onReset  && <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();onReset();}}>📊 {T.setNumbers}</button>}
            {onRestManage && <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();onRestManage();}}>🌱 {T.restPlan}</button>}
            {onDelete && <button className="btn btn-ghost btn-sm" style={{color:"var(--rust)"}} onClick={e=>{e.stopPropagation();onDelete(e);}}>{T.delete}</button>}
          </div>
        )}
      </div>

      {hasSheep && (
        <div style={{marginBottom:8}}>
          <div style={{fontSize:".78rem",fontWeight:700,color:"var(--olive)",marginBottom:4}}>🐑 {T.sheep}</div>
          <div className="stats">
            {CATS.map(c=>(<div key={c} className="stat"><div className="stat-val sheep-c">{p.sheep[c]}</div><div className="stat-lbl">{CATLABEL()[c]}</div></div>))}
            <div className="stat" style={{gridColumn:"span 2"}}><div className="stat-val">{totalCat(p.sheep)}</div><div className="stat-lbl">{T.total}</div></div>
          </div>
        </div>
      )}
      {hasGoats && (
        <div>
          <div style={{fontSize:".78rem",fontWeight:700,color:"var(--amber)",marginBottom:4}}>🐐 {T.goats}</div>
          <div className="stats">
            {CATS.map(c=>(<div key={c} className="stat"><div className="stat-val goats-c">{p.goats[c]}</div><div className="stat-lbl">{CATLABEL()[c]}</div></div>))}
            <div className="stat" style={{gridColumn:"span 2"}}><div className="stat-val">{totalCat(p.goats)}</div><div className="stat-lbl">{T.total}</div></div>
          </div>
        </div>
      )}
      {totalCattle(p.cattle||emptyCattle()) > 0 && (
        <div style={{marginTop:hasSheep||hasGoats?8:0}}>
          <div style={{fontSize:".78rem",fontWeight:700,color:"var(--teal)",marginBottom:4}}>🐄 {T.cattle}</div>
          <div className="stats">
            {CATTLE_CATS.map(c=>(<div key={c} className="stat"><div className="stat-val" style={{color:"var(--teal)"}}>{(p.cattle||emptyCattle())[c]}</div><div className="stat-lbl">{CATTLE_LABEL()[c]}</div></div>))}
            <div className="stat" style={{gridColumn:"span 2"}}><div className="stat-val">{totalCattle(p.cattle||emptyCattle())}</div><div className="stat-lbl">{T.total}</div></div>
          </div>
        </div>
      )}
      {!hasSheep && !hasGoats && totalCattle(p.cattle||emptyCattle())===0 && (
        <div style={{color:"var(--muted)",fontSize:".85rem",padding:"6px 0"}}>{T.noAnimals}</div>
      )}

      {(hasSheep||hasGoats||totalCattle(p.cattle||emptyCattle())>0) && days!==null && (
        <div className={`graze-badge ${gradeClass}`}>🌿 {gradeLabel}</div>
      )}
      {settings && <LSUBar paddock={p} settings={settings} />}
      {settings?.restPoolEnabled && p.inRestPool && (
        p.resting
          ? <div className="graze-badge graze-warn" style={{marginTop:6}}>🌱 {T.resting} — {Math.ceil(restMonthsLeft(p,settings)??0)} {T.monthsLeft}</div>
          : <div className="graze-badge graze-ok" style={{marginTop:6}}>🔁 {T.inRotation}</div>
      )}
      {p.paddockCondition!==null && p.paddockCondition!==undefined && (
        <div style={{marginTop:8}}><ConditionBar pct={p.paddockCondition}/></div>
      )}
      {p.arrivedAt && (hasSheep||hasGoats||totalCattle(p.cattle||emptyCattle())>0) && (
        <div style={{fontSize:".72rem",color:"var(--muted)",marginTop:4}}>{T.arrivedOn} {fmtDate(p.arrivedAt)}</div>
      )}
      {latest && (latest.sheepScore!==null||latest.goatScore!==null) && (
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6,alignItems:"center"}}>
          {latest.sheepScore!==null && <span className="hist-score-pill" style={{color:scoreColor(latest.sheepScore)}}>🐑 {latest.sheepScore}/5</span>}
          {latest.goatScore!==null  && <span className="hist-score-pill" style={{color:scoreColor(latest.goatScore)}}>🐐 {latest.goatScore}/5</span>}
          <span style={{fontSize:".7rem",color:"var(--muted)"}}>{fmtDate(latest.ts)}</span>
        </div>
      )}
      {onClick && <div style={{fontSize:".7rem",color:"var(--olive2)",marginTop:6,fontWeight:600}}>Tik vir detail & inspeksie →</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Rest Pool Modal — land type & multi-year rest settings, per paddock
// ══════════════════════════════════════════════════════════════════════════════
function RestPoolModal({ p, settings, onSave, onClose }) {
  const [,] = useLang();
  const [landType, setLandType] = useState(p.landType || "veld");
  const [inPool,   setInPool]   = useState(!!p.inRestPool);
  const [override, setOverride] = useState(p.restDurationMonths ?? "");
  const [saved,    setSaved]    = useState(false);
  const isEmpty = totalCat(p.sheep)+totalCat(p.goats)+totalCattle(p.cattle||emptyCattle())===0;

  const submit = () => {
    onSave(p.id, {
      landType,
      inRestPool: landType==="veld" ? inPool : false,
      restDurationMonths: override!==""  ? Number(override) : null,
    });
    setSaved(true); setTimeout(onClose, 900);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <h2>🌱 {T.restPlan}: {p.name}</h2>

        <div className="form-group">
          <label className="form-label">{T.landType}</label>
          <select className="form-select" value={landType} onChange={e=>setLandType(e.target.value)}>
            <option value="veld">{T.veldType}</option>
            <option value="irrigated">{T.irrigatedType}</option>
            <option value="other">{T.otherType}</option>
          </select>
        </div>

        {landType==="veld" ? (
          <>
            <label className="linked-check">
              <input type="checkbox" checked={inPool} onChange={e=>setInPool(e.target.checked)} />
              🔁 {T.inRestPool}
            </label>
            {inPool && (
              <div className="form-group" style={{marginTop:8}}>
                <label className="form-label">{T.restDurationOverride}</label>
                <input className="form-input" type="number" min="1" value={override}
                  onChange={e=>setOverride(e.target.value)}
                  placeholder={`${T.useFarmDefault} (${settings.defaultRestDurationMonths||12})`}/>
              </div>
            )}
            {inPool && p.resting && (
              <div className="form-hint" style={{marginTop:6,color:"var(--amber)"}}>
                🌱 {T.resting} — {Math.ceil(restMonthsLeft(p,settings)??0)} {T.monthsLeft}
              </div>
            )}
            {inPool && !p.resting && !isEmpty && (
              <div className="form-hint" style={{marginTop:6,color:"var(--rust)"}}>⚠️ {T.mustBeEmpty}</div>
            )}
          </>
        ) : (
          <div className="form-hint">{T.restPoolHint}</div>
        )}

        <button className="btn btn-primary btn-full" style={{marginTop:14}} onClick={submit}>
          {saved ? T.restSaved : T.save}
        </button>
        <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={onClose}>{T.cancel}</button>
      </div>
    </div>
  );
}

// ── Paddocks page ─────────────────────────────────────────────────────────────
function Paddocks({ paddocks, setPaddocks, role, addEvent, addInspection, settings, pushUndo, snapNow }) {
  const [,] = useLang();
  const [addModal, setAddModal] = useState(false);
  const [name,     setName]     = useState("");
  const [hectares, setHectares] = useState("");
  const [landType, setLandType] = useState("veld");
  const [resetP,   setResetP]   = useState(null);
  const [resetSh,  setResetSh]  = useState(emptyCat());
  const [resetGo,  setResetGo]  = useState(emptyCat());
  const [resetCa,  setResetCa]  = useState(emptyCattle());
  const [resetHa,  setResetHa]  = useState("");
  const [resetDate,setResetDate]= useState(todayStr());
  const [detailId, setDetailId] = useState(null);
  const [restModalP, setRestModalP] = useState(null);
  const detailPaddock = paddocks.find(p=>p.id===detailId);

  const addPaddock = () => {
    if(!name.trim()) return;
    pushUndo(getLang()==="en"?"Paddock added":"Kamp bygevoeg", snapNow());
    setPaddocks(prev=>[...prev,{id:uid(),name:name.trim(),
      sheep:emptyCat(),goats:emptyCat(),cattle:emptyCattle(),
      hectares: hectares ? Number(hectares) : null,
      arrivedAt:null,paddockCondition:null,conditionHistory:[],
      landType, inRestPool:false, restDurationMonths:null,
      resting:false, restStartDate:null, lastRestEndDate:null}]);
    setName(""); setHectares(""); setLandType("veld"); setAddModal(false);
  };

  const saveRestSettings = (paddockId, updates) => {
    pushUndo(getLang()==="en"?"Rest settings updated":"Rus-instellings opdateer", snapNow());
    const current = paddocks.find(p=>p.id===paddockId);
    const willClearRest = current && current.resting && updates.inRestPool===false;
    setPaddocks(prev=>prev.map(p=>{
      if (p.id!==paddockId) return p;
      const merged = {...p, ...updates};
      // If taken out of the pool while actively resting, clear the resting
      // status too — otherwise processRestQueue ignores it forever (it only
      // ever looks at inRestPool paddocks) and it stays stuck "resting".
      if (!merged.inRestPool && p.resting) {
        merged.resting = false;
        merged.restStartDate = null;
        merged.lastRestEndDate = nowISO();
      }
      return merged;
    }));
    if (willClearRest) addEvent({ type:"restEnd", paddock:paddockId, paddockName:current.name });
  };

  const openReset = (p) => {
    setResetP(p); setResetSh({...p.sheep}); setResetGo({...p.goats});
    setResetCa({...(p.cattle||emptyCattle())}); setResetHa(p.hectares||"");
    setResetDate(todayStr());
  };

  const saveReset = () => {
    if(!resetP) return;
    pushUndo(getLang()==="en"?"Stock take":"Voorraadopname", snapNow());
    const ts = dateToISO(resetDate);
    const newTotal = totalCat(resetSh)+totalCat(resetGo)+totalCattle(resetCa);
    addEvent({type:"stockTake", ts, paddock:resetP.id, paddockName:resetP.name,
      before:{sheep:{...resetP.sheep}, goats:{...resetP.goats}, cattle:{...(resetP.cattle||emptyCattle())}},
      after:{sheep:{...resetSh}, goats:{...resetGo}, cattle:{...resetCa}}});
    setPaddocks(prev=>prev.map(p=>{
      if(p.id!==resetP.id) return p;
      const newLSU = calcCurrentLSU({...p,sheep:resetSh,goats:resetGo,cattle:resetCa}, settings).totalLSU;
      const wasEmpty = totalCat(p.sheep)+totalCat(p.goats)+totalCattle(p.cattle||emptyCattle())===0;
      const updated = wasEmpty && newTotal>0
        ? {...p, sheep:{...resetSh}, goats:{...resetGo}, cattle:{...resetCa},
            hectares: resetHa ? Number(resetHa) : p.hectares,
            grazingYearStart: p.grazingYearStart || new Date().toISOString(),
            arrivedAt: p.arrivedAt || new Date().toISOString(),
            periodStartDate: new Date().toISOString(),
            periodStartLSU: newLSU}
        : {...closePeriod(p, newTotal>0 ? newLSU : 0),
            sheep:{...resetSh}, goats:{...resetGo}, cattle:{...resetCa},
            hectares: resetHa ? Number(resetHa) : p.hectares,
            arrivedAt: newTotal>0 ? (p.arrivedAt || new Date().toISOString()) : null,
            periodStartLSU: newTotal>0 ? newLSU : 0};
      return updated;
    }));
    setResetP(null); setResetDate(todayStr());
  };

  return (
    <>
      <div className="sec-head">
        <h2>{T.paddocks}</h2>
        {role==="admin" && <button className="btn btn-primary btn-sm" onClick={()=>setAddModal(true)}>+ {T.add}</button>}
      </div>
      {paddocks.length===0 && <div className="empty"><div className="empty-icon">📍</div><p>{T.noPaddocks}</p></div>}
      {paddocks.map(p=>(
        <PaddockCard key={p.id} p={p} role={role} settings={settings}
          onClick={()=>setDetailId(p.id)}
          onDelete={()=>{if(confirm(`${p.name} ${T.confirmDelete}`))setPaddocks(prev=>prev.filter(x=>x.id!==p.id));}}
          onReset={()=>openReset(p)}
          onRestManage={()=>setRestModalP(p)}
        />
      ))}

      {addModal && (
        <div className="overlay" onClick={()=>setAddModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <h2>{T.newPaddock}</h2>
            <div className="form-group">
              <label className="form-label">{T.paddockName}</label>
              <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="bv. Westelike Kamp" autoFocus/>
            </div>
            <div className="form-group">
              <label className="form-label">{T.hectares}</label>
              <input className="form-input" type="number" min="0" step="0.1" value={hectares}
                onChange={e=>setHectares(e.target.value)} placeholder="bv. 45"/>
              <div className="form-hint">{getLang()==="en"?"Used to calculate LSU carrying capacity":"Gebruik om LSU drakrag te bereken"}</div>
            </div>
            <div className="form-group">
              <label className="form-label">{T.landType}</label>
              <select className="form-select" value={landType} onChange={e=>setLandType(e.target.value)}>
                <option value="veld">{T.veldType}</option>
                <option value="irrigated">{T.irrigatedType}</option>
                <option value="other">{T.otherType}</option>
              </select>
            </div>
            <button className="btn btn-primary btn-full" onClick={addPaddock}>+ {T.add}</button>
          </div>
        </div>
      )}

      {resetP && (
        <div className="overlay" onClick={()=>setResetP(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <h2>📊 {T.stockTake}: {resetP.name}</h2>
            <div className="form-group">
              <label className="form-label">📅 {getLang()==="en"?"Event Date":"Datum van Gebeurtenis"}</label>
              <input className="form-input" type="date" value={resetDate} max={todayStr()}
                onChange={e=>setResetDate(e.target.value)}/>
              {resetDate !== todayStr() && <div className="form-hint" style={{color:"var(--amber)",fontWeight:600}}>📅 {getLang()==="en"?"Backdated entry":"Teruggedateerde inskrywing"}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">{T.hectares}</label>
              <input className="form-input" type="number" min="0" step="0.1" value={resetHa}
                onChange={e=>setResetHa(e.target.value)} placeholder="bv. 45"/>
            </div>
            <CategoryGrid label={`🐑 ${T.sheep}`} values={resetSh} onChange={(c,v)=>setResetSh(prev=>({...prev,[c]:Number(v)||0}))}/>
            <CategoryGrid label={`🐐 ${T.goats}`} values={resetGo} onChange={(c,v)=>setResetGo(prev=>({...prev,[c]:Number(v)||0}))}/>
            <CattleCategoryGrid label={`🐄 ${T.cattle}`} values={resetCa} onChange={(c,v)=>setResetCa(prev=>({...prev,[c]:Number(v)||0}))}/>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={saveReset}>{T.save}</button>
              <button className="btn btn-ghost" onClick={()=>setResetP(null)}>{T.cancel}</button>
            </div>
          </div>
        </div>
      )}
      {detailId && detailPaddock && (
        <PaddockDetailModal p={detailPaddock} settings={settings} onClose={()=>setDetailId(null)} addInspection={addInspection}/>
      )}
      {restModalP && (
        <RestPoolModal p={restModalP} settings={settings} onClose={()=>setRestModalP(null)} onSave={saveRestSettings}/>
      )}
    </>
  );
}

// ── Transaksies ───────────────────────────────────────────────────────────────
function Transaksies({ paddocks, setPaddocks, addEvent, settings, pushUndo, snapNow }) {
  const [,] = useLang();
  const [type, setType] = useState("bought");
  const [paddock, setPaddock] = useState("");
  const [moveSh, setMoveSh] = useState(emptyCat());
  const [moveGo, setMoveGo] = useState(emptyCat());
  const [moveCa, setMoveCa] = useState(emptyCattle());
  const [sheepLambs, setSheepLambs] = useState("");
  const [goatLambs, setGoatLambs] = useState("");
  const [notes, setNotes] = useState("");
  const [eventDate, setEventDate] = useState(todayStr());
  const [saved, setSaved] = useState(false);

  const isNewLambs = type==="newLambs";
  const fromP = paddocks.find(p=>p.id===paddock);
  const totalAnimals = isNewLambs ? (Number(sheepLambs)||0)+(Number(goatLambs)||0) : totalCat(moveSh)+totalCat(moveGo)+totalCattle(moveCa);
  const valid = paddock && totalAnimals>0;

  const reset = () => { setPaddock(""); setMoveSh(emptyCat()); setMoveGo(emptyCat()); setMoveCa(emptyCattle()); setSheepLambs(""); setGoatLambs(""); setNotes(""); setEventDate(todayStr()); };

  const submit = () => {
    if(!valid) return;
    const ts = dateToISO(eventDate);
    const paddockName = fromP?.name;
    pushUndo(getLang()==="en"?`${type} recorded`:`${type} rekordeer`, snapNow());
    if(isNewLambs) {
      const sl = Number(sheepLambs)||0, gl = Number(goatLambs)||0;
      setPaddocks(prev=>prev.map(p=>{
        if(p.id!==paddock) return p;
        const newSh = {...p.sheep, lambs:(p.sheep.lambs||0)+sl};
        const newGo = {...p.goats, lambs:(p.goats.lambs||0)+gl};
        const newLSU = calcCurrentLSU({...p,sheep:newSh,goats:newGo}, settings).totalLSU;
        const wasEmpty = totalCat(p.sheep)+totalCat(p.goats)===0;
        const updated = wasEmpty && (sl+gl)>0
          ? {...p, sheep:newSh, goats:newGo,
              grazingYearStart: p.grazingYearStart || new Date().toISOString(),
              arrivedAt: new Date().toISOString(),
              periodStartDate: new Date().toISOString(),
              periodStartLSU: newLSU}
          : {...closePeriod(p, newLSU), sheep:newSh, goats:newGo};
        return updated;
      }));
      addEvent({type:"newLambs", ts, paddock, paddockName, sheepLambs:sl, goatLambs:gl, notes});
    } else if(type==="bought") {
      setPaddocks(prev=>prev.map(p=>{
        if(p.id!==paddock) return p;
        const newSh = addCat(p.sheep,moveSh);
        const newGo = addCat(p.goats,moveGo);
        const newCa = addCattle(p.cattle||emptyCattle(),moveCa);
        const newLSU = calcCurrentLSU({...p,sheep:newSh,goats:newGo,cattle:newCa}, settings).totalLSU;
        const wasEmpty = totalCat(p.sheep)+totalCat(p.goats)+totalCattle(p.cattle||emptyCattle())===0;
        const updated = wasEmpty
          ? {...p, sheep:newSh, goats:newGo, cattle:newCa,
              grazingYearStart: p.grazingYearStart || new Date().toISOString(),
              arrivedAt: new Date().toISOString(),
              periodStartDate: new Date().toISOString(),
              periodStartLSU: newLSU}
          : {...closePeriod(p, newLSU), sheep:newSh, goats:newGo, cattle:newCa};
        return updated;
      }));
      addEvent({type:"bought", ts, paddock, paddockName, sheep:moveSh, goats:moveGo, cattle:moveCa, notes});
    } else {
      setPaddocks(prev=>prev.map(p=>{
        if(p.id!==paddock) return p;
        const newSh = subCat(p.sheep,moveSh);
        const newGo = subCat(p.goats,moveGo);
        const newCa = subCattle(p.cattle||emptyCattle(),moveCa);
        const newLSU = calcCurrentLSU({...p,sheep:newSh,goats:newGo,cattle:newCa}, settings).totalLSU;
        const isEmpty = totalCat(newSh)+totalCat(newGo)+totalCattle(newCa)===0;
        const updated = closePeriod(p, isEmpty ? 0 : newLSU);
        return {...updated, sheep:newSh, goats:newGo, cattle:newCa,
          arrivedAt: isEmpty ? null : updated.arrivedAt,
          periodStartLSU: isEmpty ? 0 : newLSU};
      }));
      addEvent({type:"sold", ts, paddock, paddockName, sheep:moveSh, goats:moveGo, cattle:moveCa, notes});
    }
    reset(); setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  const btnClass = type==="bought"?"btn-primary":type==="sold"?"btn-rust":"btn-teal";

  return (
    <>
      <div className="sec-head"><h2>{T.transactions}</h2></div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button className={`btn btn-sm ${type==="bought"?"btn-primary":"btn-ghost"}`} onClick={()=>setType("bought")}>🛒 {T.bought}</button>
        <button className={`btn btn-sm ${type==="sold"?"btn-rust":"btn-ghost"}`} onClick={()=>setType("sold")}>💰 {T.sold}</button>
        <button className={`btn btn-sm ${type==="newLambs"?"btn-teal":"btn-ghost"}`} onClick={()=>setType("newLambs")}>🐣 {T.newLambs}</button>
      </div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">📅 {getLang()==="en"?"Event Date":"Datum van Gebeurtenis"}</label>
          <input className="form-input" type="date" value={eventDate} max={todayStr()}
            onChange={e=>setEventDate(e.target.value)}/>
          {eventDate !== todayStr() && <div className="form-hint" style={{color:"var(--amber)",fontWeight:600}}>📅 {getLang()==="en"?"Backdated entry":"Teruggedateerde inskrywing"}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">{T.paddock}</label>
          <select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}>
            <option value="">{T.select}</option>
            {paddocks.filter(p=>!p.resting).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {isNewLambs ? (
          <div className="form-row">
            <div className="form-group"><label className="form-label">🐑 {T.sheepLambs}</label><input className="form-input" type="number" min="0" value={sheepLambs} onChange={e=>setSheepLambs(e.target.value)} placeholder="0"/></div>
            <div className="form-group"><label className="form-label">🐐 {T.goatLambs}</label><input className="form-input" type="number" min="0" value={goatLambs} onChange={e=>setGoatLambs(e.target.value)} placeholder="0"/></div>
          </div>
        ) : (
          <>
            <CategoryGrid label={`🐑 ${T.sheep}`} values={moveSh} onChange={(c,v)=>setMoveSh(prev=>({...prev,[c]:Number(v)||0}))} max={type==="sold"?fromP?.sheep:undefined}/>
            <CategoryGrid label={`🐐 ${T.goats}`} values={moveGo} onChange={(c,v)=>setMoveGo(prev=>({...prev,[c]:Number(v)||0}))} max={type==="sold"?fromP?.goats:undefined}/>
            <CattleCategoryGrid label={`🐄 ${T.cattle}`} values={moveCa} onChange={(c,v)=>setMoveCa(prev=>({...prev,[c]:Number(v)||0}))} max={type==="sold"?fromP?.cattle||emptyCattle():undefined}/>
          </>
        )}
        <div className="form-group"><label className="form-label">{T.notes}</label><textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Enige notas…"/></div>
        <button className={`btn btn-full ${btnClass}`} onClick={submit} disabled={!valid}>{saved ? T.transactionSaved : T.recordTransaction}</button>
      </div>
    </>
  );
}

// ── Bewegings ─────────────────────────────────────────────────────────────────
function Bewegings({ paddocks, setPaddocks, addEvent, applyExtra, settings, pushUndo, snapNow }) {
  const [,] = useLang();
  const [from,  setFrom]  = useState("");
  const [to,    setTo]    = useState("");
  const [moveSh,setMoveSh]   = useState(emptyCat());
  const [moveGo,setMoveGo]   = useState(emptyCat());
  const [moveCa,setMoveCa]   = useState(emptyCattle());
  const [notes, setNotes] = useState("");
  const [extra, setExtra] = useState(emptyExtra());
  const [eventDate, setEventDate] = useState(todayStr());
  const [saved, setSaved] = useState(false);
  const [err,   setErr]   = useState("");

  const fromP = paddocks.find(p=>p.id===from);
  const valid = from && to && from!==to && (totalCat(moveSh)+totalCat(moveGo)+totalCattle(moveCa)>0);

  const submit = () => {
    if(!valid) return;
    for(const c of CATS) {
      if((moveSh[c]||0) > (fromP?.sheep[c]||0)) return setErr(`${T.errTooManySheep} (${CATLABEL()[c]}): ${T.errOnly} ${fromP?.sheep[c]||0} ${T.errAvail}`);
      if((moveGo[c]||0) > (fromP?.goats[c]||0)) return setErr(`${T.errTooManyGoats} (${CATLABEL()[c]}): ${T.errOnly} ${fromP?.goats[c]||0} ${T.errAvail}`);
    }
    for(const c of CATTLE_CATS) {
      if((moveCa[c]||0) > ((fromP?.cattle||emptyCattle())[c]||0)) return setErr(`${T.errTooManyCattle} (${CATTLE_LABEL()[c]}): ${T.errOnly} ${(fromP?.cattle||emptyCattle())[c]||0} ${T.errAvail}`);
    }
    setErr("");
    const ts = dateToISO(eventDate);
    pushUndo(getLang()==="en"?"Movement recorded":"Beweging rekordeer", snapNow());
    const fromName = paddocks.find(p=>p.id===from)?.name;
    const toName   = paddocks.find(p=>p.id===to)?.name;
    setPaddocks(prev=>prev.map(p=>{
      if(p.id===from) {
        const newSh = subCat(p.sheep,moveSh);
        const newGo = subCat(p.goats,moveGo);
        const newCa = subCattle(p.cattle||emptyCattle(),moveCa);
        const newLSU = calcCurrentLSU({...p,sheep:newSh,goats:newGo,cattle:newCa}, settings).totalLSU;
        const updated = closePeriod(p, newLSU);
        const isEmpty = totalCat(newSh)+totalCat(newGo)+totalCattle(newCa)===0;
        return {...updated, sheep:newSh, goats:newGo, cattle:newCa,
          arrivedAt: isEmpty ? null : updated.arrivedAt,
          periodStartLSU: isEmpty ? 0 : newLSU};
      }
      if(p.id===to) {
        const newSh = addCat(p.sheep,moveSh);
        const newGo = addCat(p.goats,moveGo);
        const newCa = addCattle(p.cattle||emptyCattle(),moveCa);
        const newLSU = calcCurrentLSU({...p,sheep:newSh,goats:newGo,cattle:newCa}, settings).totalLSU;
        const wasEmpty = totalCat(p.sheep)+totalCat(p.goats)+totalCattle(p.cattle||emptyCattle())===0;
        const updated = wasEmpty
          ? {...p, sheep:newSh, goats:newGo, cattle:newCa,
              grazingYearStart: p.grazingYearStart || new Date().toISOString(),
              arrivedAt: new Date().toISOString(),
              periodStartDate: new Date().toISOString(),
              periodStartLSU: newLSU}
          : {...closePeriod(p, newLSU), sheep:newSh, goats:newGo, cattle:newCa};
        return updated;
      }
      return p;
    }));
    addEvent({type:"movement",ts,from,to,fromName,toName,sheep:moveSh,goats:moveGo,cattle:moveCa,notes,
      sheepScore:extra.sheepScore,goatScore:extra.goatScore,paddockCond:extra.paddockCond,observations:extra.observations});
    applyExtra(extra, from, to, ts);
    setFrom("");setTo("");setMoveSh(emptyCat());setMoveGo(emptyCat());setMoveCa(emptyCattle());setNotes("");setExtra(emptyExtra());setEventDate(todayStr());
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  return (
    <>
      <div className="sec-head"><h2>{T.movements}</h2></div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">📅 {getLang()==="en"?"Event Date":"Datum van Gebeurtenis"}</label>
          <input className="form-input" type="date" value={eventDate} max={todayStr()}
            onChange={e=>setEventDate(e.target.value)}/>
          {eventDate !== todayStr() && <div className="form-hint" style={{color:"var(--amber)",fontWeight:600}}>📅 {getLang()==="en"?"Backdated entry":"Teruggedateerde inskrywing"}</div>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{T.fromPaddock}</label>
            <select className="form-select" value={from} onChange={e=>setFrom(e.target.value)}>
              <option value="">{T.select}</option>
              {paddocks.filter(p=>!p.resting).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{T.toPaddock}</label>
            <select className="form-select" value={to} onChange={e=>setTo(e.target.value)}>
              <option value="">{T.select}</option>
              {paddocks.filter(p=>p.id!==from && !p.resting).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <CategoryGrid label={`🐑 ${T.sheep}`} values={moveSh} onChange={(c,v)=>setMoveSh(prev=>({...prev,[c]:Number(v)||0}))} max={fromP?.sheep}/>
        <CategoryGrid label={`🐐 ${T.goats}`} values={moveGo} onChange={(c,v)=>setMoveGo(prev=>({...prev,[c]:Number(v)||0}))} max={fromP?.goats}/>
        <CattleCategoryGrid label={`🐄 ${T.cattle}`} values={moveCa} onChange={(c,v)=>setMoveCa(prev=>({...prev,[c]:Number(v)||0}))} max={fromP?.cattle||emptyCattle()}/>
        <div className="form-group"><label className="form-label">{T.notes}</label><textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Enige notas…"/></div>
        <AdditionalRecords extra={extra} setExtra={setExtra} />
        {err && <div style={{color:"var(--rust)",fontSize:".85rem",margin:"8px 0",fontWeight:600}}>⚠️ {err}</div>}
        <button className="btn btn-sky btn-full" onClick={submit} disabled={!valid}>{saved ? T.movementSaved : T.recordMovement}</button>
      </div>
      {fromP && (
        <div className="card" style={{marginTop:10,background:"var(--bg)"}}>
          <div style={{fontSize:".8rem",color:"var(--muted)",marginBottom:6}}>{T.currentStock} {fromP.name}</div>
          <div className="stats">
            {CATS.map(c=>(<div key={c} className="stat"><div style={{fontSize:".7rem",color:"var(--muted)"}}>{CATLABEL()[c]}</div><div className="stat-val sheep-c">{fromP.sheep[c]}</div><div className="stat-val goats-c" style={{fontSize:".9rem"}}>{fromP.goats[c]}</div></div>))}
            {CATTLE_CATS.map(c=>(<div key={c} className="stat"><div style={{fontSize:".7rem",color:"var(--muted)"}}>{CATTLE_LABEL()[c]}</div><div className="stat-val" style={{color:"var(--teal)"}}>{(fromP.cattle||emptyCattle())[c]}</div></div>))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Verliese ──────────────────────────────────────────────────────────────────
function Verliese({ paddocks, setPaddocks, events, addEvent, settings, pushUndo, snapNow }) {
  const [,] = useLang();
  const [type, setType] = useState("death");
  const [paddock, setPaddock] = useState("");
  const [sheep, setSheep] = useState(emptyCat());
  const [goats, setGoats] = useState(emptyCat());
  const [cattle, setCattle] = useState(emptyCattle());
  const [cause, setCause] = useState("");
  const [notes, setNotes] = useState("");
  const [eventDate, setEventDate] = useState(todayStr());
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  // ── Mark Found — recovers from the pooled missing-animal total ──
  const [showFound,    setShowFound]    = useState(false);
  const [foundPaddock, setFoundPaddock] = useState("");
  const [foundSh,       setFoundSh]     = useState(emptyCat());
  const [foundGo,       setFoundGo]     = useState(emptyCat());
  const [foundCa,       setFoundCa]     = useState(emptyCattle());
  const [foundNotes,    setFoundNotes]  = useState("");
  const [foundDate,     setFoundDate]   = useState(todayStr());
  const [foundSaved,    setFoundSaved]  = useState(false);
  const [foundErr,      setFoundErr]    = useState("");

  const missing = computeMissingTotals(events);
  const totalMissing = totalCat(missing.sheep)+totalCat(missing.goats)+totalCattle(missing.cattle);
  const validFound = foundPaddock && (totalCat(foundSh)+totalCat(foundGo)+totalCattle(foundCa)>0);

  const submitFound = () => {
    if(!validFound) return;
    for(const c of CATS) {
      if((foundSh[c]||0) > (missing.sheep[c]||0)) return setFoundErr(`${T.errTooManySheep} (${CATLABEL()[c]}): ${T.errOnly} ${missing.sheep[c]||0} ${T.errAvail}`);
      if((foundGo[c]||0) > (missing.goats[c]||0)) return setFoundErr(`${T.errTooManyGoats} (${CATLABEL()[c]}): ${T.errOnly} ${missing.goats[c]||0} ${T.errAvail}`);
    }
    for(const c of CATTLE_CATS) {
      if((foundCa[c]||0) > (missing.cattle[c]||0)) return setFoundErr(`${T.errTooManyCattle} (${CATTLE_LABEL()[c]}): ${T.errOnly} ${missing.cattle[c]||0} ${T.errAvail}`);
    }
    setFoundErr("");
    const ts = dateToISO(foundDate);
    pushUndo(getLang()==="en"?"Found recorded":"Gevind rekordeer", snapNow());
    const paddockName = paddocks.find(p=>p.id===foundPaddock)?.name;
    setPaddocks(prev=>prev.map(p=>{
      if(p.id!==foundPaddock) return p;
      const newSh = addCat(p.sheep,foundSh);
      const newGo = addCat(p.goats,foundGo);
      const newCa = addCattle(p.cattle||emptyCattle(),foundCa);
      const newLSU = calcCurrentLSU({...p,sheep:newSh,goats:newGo,cattle:newCa}, settings).totalLSU;
      const wasEmpty = totalCat(p.sheep)+totalCat(p.goats)+totalCattle(p.cattle||emptyCattle())===0;
      const updated = wasEmpty
        ? {...p, sheep:newSh, goats:newGo, cattle:newCa,
            grazingYearStart: p.grazingYearStart || new Date().toISOString(),
            arrivedAt: new Date().toISOString(),
            periodStartDate: new Date().toISOString(),
            periodStartLSU: newLSU}
        : {...closePeriod(p, newLSU), sheep:newSh, goats:newGo, cattle:newCa};
      return updated;
    }));
    addEvent({type:"found", ts, paddock:foundPaddock, paddockName, sheep:foundSh, goats:foundGo, cattle:foundCa, notes:foundNotes});
    setFoundPaddock("");setFoundSh(emptyCat());setFoundGo(emptyCat());setFoundCa(emptyCattle());setFoundNotes("");setFoundDate(todayStr());
    setFoundSaved(true); setTimeout(()=>setFoundSaved(false),2500);
  };

  const fromP = paddocks.find(p=>p.id===paddock);
  const valid = paddock && (totalCat(sheep)+totalCat(goats)+totalCattle(cattle)>0);

  const submit = () => {
    if(!valid) return;
    for(const c of CATS) {
      if((sheep[c]||0) > (fromP?.sheep[c]||0)) return setErr(`${T.errTooManySheep} (${CATLABEL()[c]}): ${T.errOnly} ${fromP?.sheep[c]||0} ${T.errAvail}`);
      if((goats[c]||0) > (fromP?.goats[c]||0)) return setErr(`${T.errTooManyGoats} (${CATLABEL()[c]}): ${T.errOnly} ${fromP?.goats[c]||0} ${T.errAvail}`);
    }
    for(const c of CATTLE_CATS) {
      if((cattle[c]||0) > ((fromP?.cattle||emptyCattle())[c]||0)) return setErr(`${T.errTooManyCattle} (${CATTLE_LABEL()[c]}): ${T.errOnly} ${(fromP?.cattle||emptyCattle())[c]||0} ${T.errAvail}`);
    }
    setErr("");
    const ts = dateToISO(eventDate);
    pushUndo(getLang()==="en"?`${type} recorded`:`${type} rekordeer`, snapNow());
    const paddockName = paddocks.find(p=>p.id===paddock)?.name;
    setPaddocks(prev=>prev.map(p=>{
      if(p.id!==paddock) return p;
      const newSh = subCat(p.sheep,sheep);
      const newGo = subCat(p.goats,goats);
      const newCa = subCattle(p.cattle||emptyCattle(),cattle);
      const newLSU = calcCurrentLSU({...p,sheep:newSh,goats:newGo,cattle:newCa}, settings).totalLSU;
      const isEmpty = totalCat(newSh)+totalCat(newGo)+totalCattle(newCa)===0;
      const updated = closePeriod(p, isEmpty ? 0 : newLSU);
      return {...updated, sheep:newSh, goats:newGo, cattle:newCa,
        arrivedAt: isEmpty ? null : updated.arrivedAt,
        periodStartLSU: isEmpty ? 0 : newLSU};
    }));
    addEvent({type, ts, paddock, paddockName, sheep, goats, cattle, cause, notes});
    setPaddock("");setSheep(emptyCat());setGoats(emptyCat());setCattle(emptyCattle());setCause("");setNotes("");setEventDate(todayStr());
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  return (
    <>
      <div className="sec-head"><h2>{T.losses}</h2></div>

      <div className="card" style={{marginBottom:14, ...(totalMissing>0 ? {borderColor:"var(--amber)", background:"#fff8f0"} : {})}}>
        <div className="card-header">
          <div className="card-title">🔍 {T.totalMissing}</div>
          {totalMissing>0 && <span className="pill pill-open">{totalMissing}</span>}
        </div>
        {totalMissing===0 ? (
          <div style={{color:"var(--muted)",fontSize:".85rem"}}>{T.noMissing}</div>
        ) : (
          <>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
              {totalCat(missing.sheep)>0 && <span className="hist-score-pill" style={{color:"var(--olive)"}}>🐑 {totalCat(missing.sheep)}</span>}
              {totalCat(missing.goats)>0 && <span className="hist-score-pill" style={{color:"var(--amber)"}}>🐐 {totalCat(missing.goats)}</span>}
              {totalCattle(missing.cattle)>0 && <span className="hist-score-pill" style={{color:"var(--teal)"}}>🐄 {totalCattle(missing.cattle)}</span>}
            </div>
            <button className="btn btn-teal btn-sm" onClick={()=>setShowFound(o=>!o)}>
              {showFound ? T.hideAdditional : `✅ ${T.markFound}`}
            </button>
          </>
        )}

        {showFound && totalMissing>0 && (
          <div className="extra-section" style={{marginTop:10}}>
            <div className="form-group">
              <label className="form-label">📅 {getLang()==="en"?"Event Date":"Datum van Gebeurtenis"}</label>
              <input className="form-input" type="date" value={foundDate} max={todayStr()}
                onChange={e=>setFoundDate(e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">{T.returnTo}</label>
              <select className="form-select" value={foundPaddock} onChange={e=>setFoundPaddock(e.target.value)}>
                <option value="">{T.select}</option>
                {paddocks.filter(p=>!p.resting).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {totalCat(missing.sheep)>0 && <CategoryGrid label={`🐑 ${T.sheep}`} values={foundSh} onChange={(c,v)=>setFoundSh(prev=>({...prev,[c]:Number(v)||0}))} max={missing.sheep}/>}
            {totalCat(missing.goats)>0 && <CategoryGrid label={`🐐 ${T.goats}`} values={foundGo} onChange={(c,v)=>setFoundGo(prev=>({...prev,[c]:Number(v)||0}))} max={missing.goats}/>}
            {totalCattle(missing.cattle)>0 && <CattleCategoryGrid label={`🐄 ${T.cattle}`} values={foundCa} onChange={(c,v)=>setFoundCa(prev=>({...prev,[c]:Number(v)||0}))} max={missing.cattle}/>}
            <div className="form-group"><label className="form-label">{T.notes}</label><textarea className="form-textarea" rows={2} value={foundNotes} onChange={e=>setFoundNotes(e.target.value)} placeholder="Notas…"/></div>
            {foundErr && <div style={{color:"var(--rust)",fontSize:".85rem",margin:"8px 0",fontWeight:600}}>⚠️ {foundErr}</div>}
            <button className="btn btn-teal btn-full" onClick={submitFound} disabled={!validFound}>{foundSaved ? T.foundSaved : `✅ ${T.markFound}`}</button>
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button className={`btn btn-sm ${type==="death"?"btn-rust":"btn-ghost"}`} onClick={()=>setType("death")}>☠️ {T.death}</button>
        <button className={`btn btn-sm ${type==="lost"?"btn-amber":"btn-ghost"}`} onClick={()=>setType("lost")}>🔍 {T.lost}</button>
      </div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">📅 {getLang()==="en"?"Event Date":"Datum van Gebeurtenis"}</label>
          <input className="form-input" type="date" value={eventDate} max={todayStr()}
            onChange={e=>setEventDate(e.target.value)}/>
          {eventDate !== todayStr() && <div className="form-hint" style={{color:"var(--amber)",fontWeight:600}}>📅 {getLang()==="en"?"Backdated entry":"Teruggedateerde inskrywing"}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">{T.paddock}</label>
          <select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}>
            <option value="">{T.select}</option>
            {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <CategoryGrid label={`🐑 ${T.sheep}`} values={sheep} onChange={(c,v)=>setSheep(prev=>({...prev,[c]:Number(v)||0}))}/>
        <CategoryGrid label={`🐐 ${T.goats}`} values={goats} onChange={(c,v)=>setGoats(prev=>({...prev,[c]:Number(v)||0}))}/>
        <CattleCategoryGrid label={`🐄 ${T.cattle}`} values={cattle} onChange={(c,v)=>setCattle(prev=>({...prev,[c]:Number(v)||0}))}/>
        {type==="death" && (
          <div className="form-group">
            <label className="form-label">{T.cause}</label>
            <select className="form-select" value={cause} onChange={e=>setCause(e.target.value)}>
              <option value="">{T.unknown}</option>
              <option value={T.illness}>{T.illness}</option>
              <option value={T.injury}>{T.injury}</option>
              <option value={T.predator}>{T.predator}</option>
              <option value={T.oldAge}>{T.oldAge}</option>
              <option value={T.birthComp}>{T.birthComp}</option>
              <option value={T.other}>{T.other}</option>
            </select>
          </div>
        )}
        <div className="form-group"><label className="form-label">{T.notes}</label><textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Bykomende besonderhede…"/></div>
        {err && <div style={{color:"var(--rust)",fontSize:".85rem",margin:"8px 0",fontWeight:600}}>⚠️ {err}</div>}
        <button className={`btn btn-full ${type==="death"?"btn-rust":"btn-amber"}`} onClick={submit} disabled={!valid}>{saved ? T.lossSaved : T.lossRecord}</button>
      </div>
    </>
  );
}

// ── Behandelings ──────────────────────────────────────────────────────────────
function Behandelings({ paddocks, setPaddocks, treatments, setTreatments, addEvent, applyExtra, settings, pushUndo, snapNow }) {
  const [,] = useLang();
  const [paddock,setP]       = useState("");
  const [species,setSpecies] = useState("sheep");
  const [cat,    setCat]     = useState("ewes");
  const [count,  setCount]   = useState("");
  const [tname,  setTname]   = useState("");
  const [dosage, setDosage]  = useState("");
  const [method, setMethod]  = useState("");
  const [adminBy,setAdminBy] = useState("");
  const [notes,  setNotes]   = useState("");
  const [extra,  setExtra]   = useState(emptyExtra());
  const [linkedToMove,setLinked] = useState(false);
  const [destPaddock,setDestPad] = useState("");
  const [eventDate, setEventDate] = useState(todayStr());
  const [saved,  setSaved]   = useState(false);

  const valid = paddock && tname.trim() && Number(count)>0;

  const submit = () => {
    if(!valid) return;
    const ts = dateToISO(eventDate);
    pushUndo(getLang()==="en"?"Treatment recorded":"Behandeling rekordeer", snapNow());
    const paddockName = paddocks.find(p=>p.id===paddock)?.name;
    const destName = linkedToMove&&destPaddock ? paddocks.find(p=>p.id===destPaddock)?.name : null;
    const rec = {id:uid(),ts,paddock,paddockName,species,category:cat,
      count:Number(count),treatment:tname,dosage,method,administeredBy:adminBy,notes,
      sheepScore:extra.sheepScore,goatScore:extra.goatScore,cattleScore:extra.cattleScore,
      paddockCond:extra.paddockCond,observations:extra.observations,
      linkedToMove,destPaddock:linkedToMove&&destPaddock?destPaddock:null,destName};
    setTreatments(prev=>[rec,...prev]);
    addEvent({type:"treatment",ts,paddock,paddockName,species,category:cat,count:Number(count),treatment:tname,method,administeredBy:adminBy,
      sheepScore:extra.sheepScore,goatScore:extra.goatScore,cattleScore:extra.cattleScore,linkedToMove,destName});
    applyExtra(extra, paddock, linkedToMove&&destPaddock?destPaddock:null, ts);
    setP("");setSpecies("sheep");setCat("ewes");setCount("");setTname("");setDosage("");setMethod("");setAdminBy("");setNotes("");setExtra(emptyExtra());setLinked(false);setDestPad("");setEventDate(todayStr());
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  return (
    <>
      <div className="sec-head"><h2>{T.treatments}</h2></div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">📅 {getLang()==="en"?"Event Date":"Datum van Gebeurtenis"}</label>
          <input className="form-input" type="date" value={eventDate} max={todayStr()}
            onChange={e=>setEventDate(e.target.value)}/>
          {eventDate !== todayStr() && <div className="form-hint" style={{color:"var(--amber)",fontWeight:600}}>📅 {getLang()==="en"?"Backdated entry":"Teruggedateerde inskrywing"}</div>}
        </div>
        <div className="form-group">
          <label className="form-label">{T.paddock}</label>
          <select className="form-select" value={paddock} onChange={e=>setP(e.target.value)}>
            <option value="">{T.select}</option>
            {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{T.animalGroup}</label>
            <select className="form-select" value={species} onChange={e=>setSpecies(e.target.value)}>
              <option value="sheep">🐑 {T.sheep}</option>
              <option value="goats">🐐 {T.goats}</option>
              <option value="cattle">🐄 {T.cattle}</option>
              <option value="both">{T.both}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{T.category}</label>
            <select className="form-select" value={cat} onChange={e=>setCat(e.target.value)}>
              {CATS.map(c=><option key={c} value={c}>{CATLABEL()[c]}</option>)}
              <option value="all">{T.all}</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label className="form-label">{T.countTreated}</label><input className="form-input" type="number" min="1" value={count} onChange={e=>setCount(e.target.value)} placeholder="0"/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">{T.treatmentName}</label><input className="form-input" value={tname} onChange={e=>setTname(e.target.value)} placeholder="bv. Ivermectien"/></div>
          <div className="form-group"><label className="form-label">{T.dosage}</label><input className="form-input" value={dosage} onChange={e=>setDosage(e.target.value)} placeholder="bv. 1ml/10kg"/></div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{T.method}</label>
            <select className="form-select" value={method} onChange={e=>setMethod(e.target.value)}>
              <option value="">{T.select}</option>
              <option value={T.oral}>{T.oral}</option>
              <option value={T.injection}>{T.injection}</option>
              <option value={T.pourOn}>{T.pourOn}</option>
              <option value={T.spray}>{T.spray}</option>
              <option value={T.dip}>{T.dip}</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">{T.administeredBy}</label><input className="form-input" value={adminBy} onChange={e=>setAdminBy(e.target.value)} placeholder="Naam…"/></div>
        </div>
        <div className="form-group"><label className="form-label">{T.notes}</label><textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas…"/></div>
        <label className="linked-check">
          <input type="checkbox" checked={linkedToMove} onChange={e=>{setLinked(e.target.checked);if(!e.target.checked)setDestPad("");}}/>
          🔀 {T.linkedToMove}
        </label>
        {linkedToMove && (
          <div className="form-group">
            <label className="form-label">{T.destPaddock}</label>
            <select className="form-select" value={destPaddock} onChange={e=>setDestPad(e.target.value)}>
              <option value="">{T.select}</option>
              {paddocks.filter(p=>p.id!==paddock).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <AdditionalRecords extra={extra} setExtra={setExtra} />
        <button className="btn btn-teal btn-full" onClick={submit} disabled={!valid}>{saved ? T.treatmentSaved : T.recordTreatment}</button>
      </div>
      {treatments.length>0 && (
        <>
          <div className="sec-head" style={{marginTop:18}}><h2>{getLang()==="en"?"Records":"Rekords"}</h2></div>
          {treatments.map(tr=>(
            <div className="card" key={tr.id}>
              <div className="card-header">
                <div>
                  <div className="card-title">💊 {tr.treatment}</div>
                  <div style={{fontSize:".82rem",color:"var(--muted)"}}>{tr.count} × {tr.species==="sheep"?`🐑 ${T.sheep}`:tr.species==="goats"?`🐐 ${T.goats}`:tr.species==="cattle"?`🐄 ${T.cattle}`:T.both} — {CATLABEL()[tr.category]||T.all}</div>
                  <div style={{fontSize:".8rem",color:"var(--muted)"}}>📍 {tr.paddockName}</div>
                </div>
              </div>
              {tr.dosage && <div style={{fontSize:".82rem",color:"var(--muted)"}}>{T.dosage}: {tr.dosage}{tr.method?` · ${tr.method}`:""}</div>}
              {tr.administeredBy && <div style={{fontSize:".82rem",color:"var(--muted)"}}>{T.administeredBy}: {tr.administeredBy}</div>}
              {tr.linkedToMove && tr.destName && <div style={{fontSize:".8rem",color:"var(--sky)"}}>🔀 Na: {tr.destName}</div>}
              {(tr.sheepScore!==null||tr.goatScore!==null||tr.cattleScore!==null) && (
                <div style={{display:"flex",gap:6,marginTop:6}}>
                  {tr.sheepScore!==null && <span className="hist-score-pill" style={{color:scoreColor(tr.sheepScore)}}>🐑 {tr.sheepScore}/5</span>}
                  {tr.goatScore!==null  && <span className="hist-score-pill" style={{color:scoreColor(tr.goatScore)}}>🐐 {tr.goatScore}/5</span>}
                  {tr.cattleScore!==null && <span className="hist-score-pill" style={{color:scoreColor(tr.cattleScore)}}>🐄 {tr.cattleScore}/5</span>}
                </div>
              )}
              <div style={{fontSize:".75rem",color:"var(--muted)",marginTop:6}}>{fmtTime(tr.ts)}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

// ── Take ──────────────────────────────────────────────────────────────────────
function Take({ tasks, setTasks, paddocks, role, addEvent }) {
  const [,] = useLang();
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState(""); const [assign, setAssign] = useState("");
  const [paddock, setPaddock] = useState(""); const [notes, setNotes] = useState("");
  const [due, setDue] = useState(""); const [filter, setFilter] = useState("all");
  const [photo, setPhoto] = useState(null);
  const fileRef = useRef();

  const add = () => {
    if(!title.trim()) return;
    setTasks(prev=>[{id:uid(),title:title.trim(),assignedTo:assign,paddock,notes,dueDate:due,status:"pending",createdAt:nowISO(),photo},...prev]);
    addEvent({type:"task",action:"created",taskTitle:title,assignedTo:assign,paddockName:paddocks.find(p=>p.id===paddock)?.name});
    setTitle("");setAssign("");setPaddock("");setNotes("");setDue("");setPhoto(null);setModal(false);
  };

  const complete = (id) => {
    setTasks(prev=>prev.map(t=>t.id===id?{...t,status:"done",doneAt:nowISO()}:t));
    const t=tasks.find(x=>x.id===id);
    if(t) addEvent({type:"task",action:"completed",taskTitle:t.title});
  };

  const shown = tasks.filter(t=> filter==="all"?true:filter==="overdue"?(isOverdue(t.dueDate)&&t.status==="pending"):t.status===filter);
  const ovCount = tasks.filter(t=>t.status==="pending"&&isOverdue(t.dueDate)).length;

  return (
    <>
      <div className="sec-head"><h2>{T.tasks}</h2>{role==="admin"&&<button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}>+ {T.add}</button>}</div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {["all","pending","overdue","done"].map(f=>(
          <button key={f} className={`btn btn-sm ${filter===f?"btn-primary":"btn-ghost"}`} onClick={()=>setFilter(f)}>
            {f==="all"?T.all:f==="pending"?T.pending:f==="overdue"?`${T.overdue}${ovCount?` (${ovCount})`:""}`:T.done}
          </button>
        ))}
      </div>
      {shown.length===0&&<div className="empty"><div className="empty-icon">✅</div><p>{T.noTasks}</p></div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {shown.map(t=>{
          const od=isOverdue(t.dueDate)&&t.status==="pending";
          return (
            <div className="card" key={t.id} style={{borderColor:od?"var(--rust)":"var(--border)"}}>
              <div className="card-header">
                <div style={{flex:1}}>
                  <div className="card-title">{t.title}</div>
                  {t.assignedTo&&<div style={{fontSize:".82rem",color:"var(--muted)"}}>→ {t.assignedTo}</div>}
                  {t.paddock&&<div style={{fontSize:".82rem",color:"var(--muted)"}}>📍 {paddocks.find(p=>p.id===t.paddock)?.name}</div>}
                  {t.dueDate&&<div style={{fontSize:".8rem",marginTop:2,color:od?"var(--rust)":"var(--muted)",fontWeight:od?700:400}}>{od?"⚠️ Agterstallig — was gesperd ":"Sperdatum: "}{fmtDate(t.dueDate)}</div>}
                </div>
                <span className={`pill ${t.status==="done"?"pill-done":od?"pill-overdue":"pill-pending"}`}>{t.status==="done"?"✅ "+T.done:od?"⚠️ "+T.overdue:"⏳ "+T.pending}</span>
              </div>
              {t.notes&&<p style={{fontSize:".85rem",color:"var(--muted)",marginBottom:8}}>{t.notes}</p>}
              {t.photo&&<img src={t.photo} alt="taak" className="photo-preview"/>}
              <div style={{fontSize:".73rem",color:"var(--muted)",marginTop:6,marginBottom:t.status==="pending"?8:0}}>{fmtDate(t.createdAt)}{t.doneAt?` · Klaar ${fmtTime(t.doneAt)}`:""}</div>
              {t.status==="pending"&&(
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-done btn-sm" onClick={()=>complete(t.id)}>{T.markDone}</button>
                  {role==="admin"&&<button className="btn btn-ghost btn-sm" style={{color:"var(--rust)"}} onClick={()=>{if(confirm(T.confirmDeleteTask))setTasks(prev=>prev.filter(x=>x.id!==t.id));}}>❌</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {modal&&(
        <div className="overlay" onClick={()=>setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/><h2>{T.assignTask}</h2>
            <div className="form-group"><label className="form-label">{T.taskDesc}</label><input className="form-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="bv. Kontroleer watertrôe" autoFocus/></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">{T.assignTo}</label><input className="form-input" value={assign} onChange={e=>setAssign(e.target.value)} placeholder="Werker naam"/></div>
              <div className="form-group"><label className="form-label">{T.dueDate}</label><input className="form-input" type="date" value={due} min={todayStr()} onChange={e=>setDue(e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">{T.paddock}</label><select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}><option value="">{T.noSpecific}</option>{paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="form-group"><label className="form-label">{T.notes}</label><textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ekstra besonderhede…"/></div>
            <div className="form-group"><label className="form-label">Foto</label>
              <div className="photo-upload" onClick={()=>fileRef.current?.click()}>{photo?<img src={photo} alt="v" style={{maxHeight:90,borderRadius:6}}/>:T.addPhoto}</div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{const f=e.target.files?.[0];if(f)setPhoto(await compressImage(f));}}/></div>
            <button className="btn btn-primary btn-full" onClick={add}>{T.assignTask}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Probleme ──────────────────────────────────────────────────────────────────
function Probleme({ issues, setIssues, paddocks, addEvent }) {
  const [,] = useLang();
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState(""); const [paddock, setPaddock] = useState("");
  const [type, setType] = useState(""); const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [filter, setFilter] = useState("open");
  const [viewing, setViewing] = useState(null);
  const fileRef = useRef();

  const add = () => {
    if(!title.trim()) return;
    const iss={id:uid(),title:title.trim(),paddock,type,notes,photo,status:"open",createdAt:nowISO()};
    setIssues(prev=>[iss,...prev]);
    addEvent({type:"issue",action:"reported",issueTitle:title,issueType:type,paddockName:paddocks.find(p=>p.id===paddock)?.name});
    setTitle("");setPaddock("");setType("");setNotes("");setPhoto(null);setModal(false);
  };

  const shown=issues.filter(i=>filter==="all"?true:i.status===filter);

  return (
    <>
      <div className="sec-head"><h2>{T.issues}</h2><button className="btn btn-amber btn-sm" onClick={()=>setModal(true)}>+ {T.report}</button></div>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {["open","resolved","all"].map(f=>(
          <button key={f} className={`btn btn-sm ${filter===f?"btn-primary":"btn-ghost"}`} onClick={()=>setFilter(f)}>{f==="open"?T.open:f==="resolved"?T.resolved:T.all}</button>
        ))}
      </div>
      {shown.length===0&&<div className="empty"><div className="empty-icon">⚠️</div><p>{T.noIssues}</p></div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {shown.map(iss=>(
          <div className="card" key={iss.id} style={{borderColor:iss.status==="open"?"var(--amber)":"var(--border)"}}>
            <div className="card-header">
              <div style={{flex:1}}>
                <div className="card-title">{iss.title}</div>
                {iss.type&&<div style={{fontSize:".82rem",color:"var(--muted)"}}>{iss.type}</div>}
                {iss.paddock&&<div style={{fontSize:".82rem",color:"var(--muted)"}}>📍 {paddocks.find(p=>p.id===iss.paddock)?.name}</div>}
              </div>
              <span className={`pill ${iss.status==="open"?"pill-open":"pill-resolved"}`}>{iss.status==="open"?"🔴 "+T.open:"✅ "+T.resolved}</span>
            </div>
            {iss.notes&&<p style={{fontSize:".85rem",color:"var(--muted)",marginBottom:8}}>{iss.notes}</p>}
            {iss.photo&&<img src={iss.photo} alt="p" className="photo-preview" style={{cursor:"pointer"}} onClick={()=>setViewing(iss.photo)}/>}
            <div style={{fontSize:".73rem",color:"var(--muted)",marginTop:6,marginBottom:iss.status==="open"?8:0}}>{fmtTime(iss.createdAt)}{iss.resolvedAt?` · Opgelos ${fmtTime(iss.resolvedAt)}`:""}</div>
            {iss.status==="open"&&(
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-done btn-sm" onClick={()=>{setIssues(prev=>prev.map(i=>i.id===iss.id?{...i,status:"resolved",resolvedAt:nowISO()}:i));addEvent({type:"issue",action:"resolved",issueTitle:iss.title});}}>{T.markResolved}</button>
                <button className="btn btn-ghost btn-sm" style={{color:"var(--rust)"}} onClick={()=>{if(confirm(T.confirmDeleteIssue))setIssues(prev=>prev.filter(i=>i.id!==iss.id));}}> ❌</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {viewing&&<div className="overlay" onClick={()=>setViewing(null)} style={{alignItems:"center",justifyContent:"center"}}><img src={viewing} alt="vol" style={{maxWidth:"95vw",maxHeight:"90vh",borderRadius:12}} onClick={e=>e.stopPropagation()}/></div>}
      {modal&&(
        <div className="overlay" onClick={()=>setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/><h2>{T.reportIssue}</h2>
            <div className="form-group"><label className="form-label">Beskrywing</label><input className="form-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="bv. Heining gebreek" autoFocus/></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">{T.issueType}</label><select className="form-select" value={type} onChange={e=>setType(e.target.value)}><option value="">{T.generalIssue}</option><option value={T.fenceGate}>{T.fenceGate}</option><option value={T.waterSupply}>{T.waterSupply}</option><option value={T.animalHealth}>{T.animalHealth}</option><option value={T.predator}>{T.predator}</option><option value={T.equipment}>{T.equipment}</option><option value={T.feedPasture}>{T.feedPasture}</option><option value={T.other}>{T.other}</option></select></div>
              <div className="form-group"><label className="form-label">{T.paddock}</label><select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}><option value="">{T.noSpecific}</option>{paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <div className="form-group"><label className="form-label">{T.notes}</label><textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Meer besonderhede…"/></div>
            <div className="form-group"><label className="form-label">Foto</label>
              <div className="photo-upload" onClick={()=>fileRef.current?.click()}>{photo?<img src={photo} alt="v" style={{maxHeight:90,borderRadius:6}}/>:T.addPhoto}</div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={async e=>{const f=e.target.files?.[0];if(f)setPhoto(await compressImage(f));}}/></div>
            <button className="btn btn-amber btn-full" onClick={add}>{T.reportIssue}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Geskiedenis ───────────────────────────────────────────────────────────────
const HISTORY_FILTERS = () => [
  {id:"all", label:T.all},{id:"movement",label:T.movements},{id:"bought",label:T.bought},
  {id:"sold",label:T.sold},{id:"newLambs",label:T.newLambs},{id:"death",label:T.death},
  {id:"lost",label:T.lost},{id:"found",label:T.found},{id:"treatment",label:T.treatments},{id:"task",label:T.tasks},
  {id:"issue",label:T.issues},{id:"inspection",label:T.inspection},{id:"stockTake",label:T.stockTake},
  {id:"rest",label:T.restPlan},
];

function Geskiedenis({ events }) {
  const [,] = useLang();
  const [filter,setFilter]=useState("all");
  const sorted = [...events].sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  const shown=sorted.filter(e=>filter==="all"?true:filter==="rest"?(e.type==="restStart"||e.type==="restEnd"):e.type===filter);
  return (
    <>
      <div className="sec-head"><h2>{T.history}</h2></div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {HISTORY_FILTERS().map(f=>(
          <button key={f.id} className={`btn btn-sm ${filter===f.id?"btn-primary":"btn-ghost"}`} onClick={()=>setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      {shown.length===0&&<div className="empty"><div className="empty-icon">📋</div><p>{T.noEvents}</p></div>}
      {shown.length>0&&<div className="card">{shown.map(ev=><EventRow key={ev.id} ev={ev}/>)}</div>}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  CSS Chart Helpers (no external library)
// ══════════════════════════════════════════════════════════════════════════════

// Horizontal bar chart using pure CSS
function CSSBarChart({ data, valueKey="value", labelKey="name", colorFn, maxOverride, unit="" }) {
  if (!data || data.length === 0) return <div style={{color:"var(--muted)",fontSize:".82rem",padding:"8px 0"}}>{T.noData}</div>;
  const max = maxOverride || Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:7}}>
      {data.map((d, i) => {
        const val = d[valueKey] || 0;
        const pct = Math.min((val / max) * 100, 100);
        const color = colorFn ? colorFn(d, i) : "var(--olive)";
        return (
          <div key={i}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".75rem",marginBottom:2}}>
              <span style={{color:"var(--text)",fontWeight:600,maxWidth:"65%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d[labelKey]}</span>
              <span style={{color,fontWeight:700}}>{val}{unit}</span>
            </div>
            <div style={{height:10,background:"var(--border)",borderRadius:5,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:5,transition:"width .4s"}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Simple donut/pie using conic-gradient
function CSSDonut({ data, size=120 }) {
  if (!data || data.length === 0) return <div style={{color:"var(--muted)",fontSize:".82rem"}}>{T.noData}</div>;
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  if (total === 0) return <div style={{color:"var(--muted)",fontSize:".82rem"}}>{T.noData}</div>;
  let cumPct = 0;
  const segments = data.map(d => {
    const pct = (d.value / total) * 100;
    const seg = { ...d, pct, start: cumPct };
    cumPct += pct;
    return seg;
  });
  const gradient = segments.map(s => `${s.fill} ${s.start.toFixed(1)}% ${(s.start + s.pct).toFixed(1)}%`).join(", ");
  return (
    <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <div style={{width:size,height:size,borderRadius:"50%",background:`conic-gradient(${gradient})`,flexShrink:0,
        WebkitMaskImage:`radial-gradient(circle, transparent 38%, black 38%)`,
        maskImage:`radial-gradient(circle, transparent 38%, black 38%)`}}/>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {segments.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:".75rem"}}>
            <div style={{width:10,height:10,borderRadius:2,background:s.fill,flexShrink:0}}/>
            <span>{s.name}: <strong>{s.value}</strong> ({s.pct.toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sparkline-style mini line using SVG
function CSSSparkline({ data, color="var(--olive)", height=50 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.value ?? d.sheep ?? d.goat ?? 0).filter(v => v !== null && v !== undefined);
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const w = 100, h = height;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height}} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
      {vals.map((v,i)=>{
        const x=(i/(vals.length-1))*w, y=h-((v-min)/range)*(h-8)-4;
        return <circle key={i} cx={x} cy={y} r="3" fill={color}/>;
      })}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Analitiek (Stats) Tab
// ══════════════════════════════════════════════════════════════════════════════
function Analitiek({ paddocks, events, tasks, issues, treatments, settings }) {
  const [,] = useLang();
  const [panel, setPanel] = useState("stock");

  // ── Stock & Population derivations ─────────────────────────────────────────
  const totSheep  = paddocks.reduce((s,p)=>s+totalCat(p.sheep),0);
  const totGoats  = paddocks.reduce((s,p)=>s+totalCat(p.goats),0);
  const totCattle = paddocks.reduce((s,p)=>s+totalCattle(p.cattle||emptyCattle()),0);
  const deathEvents = events.filter(e=>e.type==="death");
  const lostEvents  = events.filter(e=>e.type==="lost");
  const foundEvents = events.filter(e=>e.type==="found");
  const newLambEvts = events.filter(e=>e.type==="newLambs");
  const totalDeaths   = deathEvents.reduce((s,e)=>s+totalCat(e.sheep||{})+totalCat(e.goats||{})+totalCattle(e.cattle||emptyCattle()),0);
  const totalLost     = lostEvents.reduce((s,e)=>s+totalCat(e.sheep||{})+totalCat(e.goats||{})+totalCattle(e.cattle||emptyCattle()),0);
  const totalFound    = foundEvents.reduce((s,e)=>s+totalCat(e.sheep||{})+totalCat(e.goats||{})+totalCattle(e.cattle||emptyCattle()),0);
  const netMissing    = Math.max(0, totalLost-totalFound);
  const totalNewLambs = newLambEvts.reduce((s,e)=>s+(e.sheepLambs||0)+(e.goatLambs||0),0);
  const totalHerd     = totSheep+totGoats+totCattle;
  const ewesCount     = paddocks.reduce((s,p)=>s+(p.sheep?.ewes||0)+(p.goats?.ewes||0),0);
  const lambCrop      = ewesCount>0 ? ((totalNewLambs/ewesCount)*100).toFixed(1) : null;
  const mortalityPct  = totalHerd>0 ? ((totalDeaths/(totalHerd+totalDeaths))*100).toFixed(1) : null;
  const lossPct       = totalHerd>0 ? ((netMissing/(totalHerd+netMissing))*100).toFixed(1) : null;

  // Monthly activity (last 6 months)
  const monthlyData = (() => {
    const months = {};
    [...events].sort((a,b)=>new Date(a.ts)-new Date(b.ts)).forEach(ev => {
      const m = ev.ts.slice(0,7);
      if(!months[m]) months[m]={month:m.slice(5)+"/"+m.slice(2,4),bought:0,sold:0,deaths:0,born:0};
      if(ev.type==="bought")   months[m].bought  += totalCat(ev.sheep||{})+totalCat(ev.goats||{})+totalCattle(ev.cattle||emptyCattle());
      if(ev.type==="sold")     months[m].sold    += totalCat(ev.sheep||{})+totalCat(ev.goats||{})+totalCattle(ev.cattle||emptyCattle());
      if(ev.type==="death")    months[m].deaths  += totalCat(ev.sheep||{})+totalCat(ev.goats||{})+totalCattle(ev.cattle||emptyCattle());
      if(ev.type==="newLambs") months[m].born    += (ev.sheepLambs||0)+(ev.goatLambs||0);
    });
    return Object.values(months).slice(-6);
  })();

  // ── Health derivations ─────────────────────────────────────────────────────
  const treatmentCounts = {};
  treatments.forEach(tr=>{ treatmentCounts[tr.treatment]=(treatmentCounts[tr.treatment]||0)+1; });
  const topTreatmentsData = Object.entries(treatmentCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,count])=>({name,count}));
  const deathCauses = {};
  deathEvents.forEach(e=>{ const c=e.cause||T.unknown; deathCauses[c]=(deathCauses[c]||0)+totalCat(e.sheep||{})+totalCat(e.goats||{})+totalCattle(e.cattle||emptyCattle()); });
  const deathCauseData = Object.entries(deathCauses).map(([name,value],i)=>({name,value,fill:["#a83c2a","#c17f2a","#2a6c8a","#4a5c3a","#2a7a6a"][i%5]}));

  // ── Paddock derivations ────────────────────────────────────────────────────
  const lsuPaddockData = paddocks.map(p=>{
    const lsu=calcLSU(p,settings);
    return {name:p.name,load:lsu.loadPct!==null?Math.round(lsu.loadPct):null,
            lsu:+lsu.totalLSU.toFixed(1),
            budget:lsu.budget?+lsu.budget.toFixed(0):null,
            consumed:lsu.consumed?+lsu.consumed.toFixed(0):null,
            daysLeft:lsu.daysLeft};
  }).filter(d=>d.load!==null).sort((a,b)=>b.load-a.load);
  const condPaddockData = paddocks.map(p=>({name:p.name,cond:p.paddockCondition??null})).filter(d=>d.cond!==null).sort((a,b)=>a.cond-b.cond);
  const daysPaddockData = paddocks.filter(p=>daysSince(p.arrivedAt)!==null).map(p=>({name:p.name,days:daysSince(p.arrivedAt)||0})).sort((a,b)=>b.days-a.days);

  // ── Operational derivations ────────────────────────────────────────────────
  const doneTasks    = tasks.filter(t=>t.status==="done");
  const pendTasks    = tasks.filter(t=>t.status==="pending");
  const taskDoneRate = tasks.length>0 ? Math.round((doneTasks.length/tasks.length)*100) : null;
  const avgTaskDays  = doneTasks.filter(t=>t.doneAt&&t.createdAt).length>0
    ? (doneTasks.filter(t=>t.doneAt&&t.createdAt).reduce((s,t)=>s+((new Date(t.doneAt)-new Date(t.createdAt))/86400000),0)/doneTasks.filter(t=>t.doneAt&&t.createdAt).length).toFixed(1) : null;
  const resolvedIssues = issues.filter(i=>i.status==="resolved"&&i.resolvedAt&&i.createdAt);
  const avgIssueDays   = resolvedIssues.length>0
    ? (resolvedIssues.reduce((s,i)=>s+((new Date(i.resolvedAt)-new Date(i.createdAt))/86400000),0)/resolvedIssues.length).toFixed(1) : null;
  const issueCounts = {};
  issues.forEach(i=>{ const t=i.type||T.generalIssue; issueCounts[t]=(issueCounts[t]||0)+1; });
  const issueTypeData = Object.entries(issueCounts).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}));
  const taskStatusData = [
    {name:T.done,    value:doneTasks.length,                                  fill:"#2a6a2a"},
    {name:T.overdue, value:pendTasks.filter(t=>isOverdue(t.dueDate)).length,  fill:"#a83c2a"},
    {name:T.pending, value:pendTasks.filter(t=>!isOverdue(t.dueDate)).length, fill:"#c17f2a"},
  ].filter(d=>d.value>0);

  const panels = [
    {id:"stock",   label:`📊 ${T.stockPopulation}`},
    {id:"health",  label:`💚 ${T.healthCondition}`},
    {id:"paddock", label:`📍 ${T.paddockMgmt}`},
    {id:"ops",     label:`✅ ${T.operational}`},
  ];

  return (
    <>
      <div className="sec-head"><h2>📈 {T.stats}</h2></div>
      <div className="stats-tabs">
        {panels.map(p=>(
          <button key={p.id} className={`btn btn-sm ${panel===p.id?"btn-primary":"btn-ghost"}`} onClick={()=>setPanel(p.id)}>{p.label}</button>
        ))}
      </div>

      {/* ── Stock & Population ── */}
      {panel==="stock" && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-val" style={{color:"var(--olive)"}}>{totalHerd}</div><div className="kpi-lbl">{T.totalAnimals}</div></div>
            <div className="kpi-card"><div className="kpi-val" style={{color:lambCrop?Number(lambCrop)>80?"var(--green)":"var(--amber)":"var(--muted)"}}>{lambCrop?lambCrop+"%":"—"}</div><div className="kpi-lbl">🐣 {T.lambCropRate}</div></div>
            <div className="kpi-card"><div className="kpi-val" style={{color:mortalityPct&&Number(mortalityPct)>5?"var(--rust)":"var(--green)"}}>{mortalityPct?mortalityPct+"%":"—"}</div><div className="kpi-lbl">☠️ {T.mortalityRate}</div></div>
            <div className="kpi-card"><div className="kpi-val" style={{color:lossPct&&Number(lossPct)>3?"var(--rust)":"var(--green)"}}>{lossPct?lossPct+"%":"—"}</div><div className="kpi-lbl">🔍 {T.lossRate}</div></div>
          </div>

          <div className="stat-panel-card">
            <div className="stat-panel-title">{T.totalAnimals}</div>
            <CSSBarChart
              data={[
                {name:`🐑 ${T.sheep}`, value:totSheep,  fill:"#4a5c3a"},
                {name:`🐐 ${T.goats}`, value:totGoats,  fill:"#c17f2a"},
                {name:`🐄 ${T.cattle}`,value:totCattle, fill:"#2a7a6a"},
              ].filter(d=>d.value>0)}
              colorFn={d=>d.fill}
            />
          </div>

          {monthlyData.length > 0 && (
            <div className="stat-panel-card">
              <div className="stat-panel-title">{T.monthlyHerd}</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {monthlyData.map((m,i)=>(
                  <div key={i}>
                    <div style={{fontSize:".75rem",fontWeight:700,color:"var(--muted)",marginBottom:4}}>{m.month}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {m.bought>0 && <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:`${Math.min((m.bought/Math.max(...monthlyData.map(x=>x.bought+x.born),1))*100,100)}%`,minWidth:4,height:8,background:"#2a6a2a",borderRadius:4}}/><span style={{fontSize:".7rem",color:"#2a6a2a"}}>+{m.bought} {T.bought2}</span></div>}
                      {m.born>0  && <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:`${Math.min((m.born/Math.max(...monthlyData.map(x=>x.bought+x.born),1))*100,100)}%`,minWidth:4,height:8,background:"#2a6c8a",borderRadius:4}}/><span style={{fontSize:".7rem",color:"#2a6c8a"}}>+{m.born} {T.newLambs}</span></div>}
                      {m.sold>0   && <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:`${Math.min((m.sold/Math.max(...monthlyData.map(x=>x.sold+x.deaths),1))*100,100)}%`,minWidth:4,height:8,background:"#c17f2a",borderRadius:4}}/><span style={{fontSize:".7rem",color:"#c17f2a"}}>-{m.sold} {T.sold2}</span></div>}
                      {m.deaths>0 && <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:`${Math.min((m.deaths/Math.max(...monthlyData.map(x=>x.sold+x.deaths),1))*100,100)}%`,minWidth:4,height:8,background:"#a83c2a",borderRadius:4}}/><span style={{fontSize:".7rem",color:"#a83c2a"}}>-{m.deaths} {T.death}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Health & Condition ── */}
      {panel==="health" && (
        <>
          {/* Condition scores per paddock — latest reading */}
          {paddocks.filter(p=>(p.conditionHistory||[]).length>0).length > 0 ? (
            <div className="stat-panel-card">
              <div className="stat-panel-title">{T.condTrend}</div>
              {paddocks.filter(p=>(p.conditionHistory||[]).length>0).map(p=>{
                const latest=(p.conditionHistory||[])[0];
                return (
                  <div key={p.id} style={{marginBottom:10}}>
                    <div style={{fontSize:".78rem",fontWeight:700,marginBottom:4}}>{p.name}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {latest.sheepScore!==null && (
                        <div style={{flex:1,minWidth:80}}>
                          <div style={{fontSize:".68rem",color:"var(--muted)",marginBottom:2}}>🐑 {latest.sheepScore}/5</div>
                          <div style={{height:8,background:"var(--border)",borderRadius:4,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${(latest.sheepScore/5)*100}%`,background:scoreColor(latest.sheepScore),borderRadius:4}}/>
                          </div>
                        </div>
                      )}
                      {latest.goatScore!==null && (
                        <div style={{flex:1,minWidth:80}}>
                          <div style={{fontSize:".68rem",color:"var(--muted)",marginBottom:2}}>🐐 {latest.goatScore}/5</div>
                          <div style={{height:8,background:"var(--border)",borderRadius:4,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${(latest.goatScore/5)*100}%`,background:scoreColor(latest.goatScore),borderRadius:4}}/>
                          </div>
                        </div>
                      )}
                      {latest.cattleScore!==null && (
                        <div style={{flex:1,minWidth:80}}>
                          <div style={{fontSize:".68rem",color:"var(--muted)",marginBottom:2}}>🐄 {latest.cattleScore}/5</div>
                          <div style={{height:8,background:"var(--border)",borderRadius:4,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${(latest.cattleScore/5)*100}%`,background:scoreColor(latest.cattleScore),borderRadius:4}}/>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Sparkline of sheep scores over time */}
                    {(p.conditionHistory||[]).filter(h=>h.sheepScore!==null).length>=2 && (
                      <div style={{marginTop:4}}>
                        <CSSSparkline data={(p.conditionHistory||[]).slice(0,8).reverse().map(h=>({value:h.sheepScore}))} color={scoreColor(latest.sheepScore||3)} height={36}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <div style={{color:"var(--muted)",fontSize:".82rem",padding:"12px 0"}}>{T.noData}</div>}

          {topTreatmentsData.length > 0 && (
            <div className="stat-panel-card">
              <div className="stat-panel-title">💊 {T.topTreatments}</div>
              <CSSBarChart data={topTreatmentsData} valueKey="count" labelKey="name" colorFn={()=>"var(--teal)"}/>
            </div>
          )}

          {deathCauseData.length > 0 && (
            <div className="stat-panel-card">
              <div className="stat-panel-title">☠️ {T.deathByCause}</div>
              <CSSDonut data={deathCauseData}/>
            </div>
          )}
        </>
      )}

      {/* ── Paddock Management ── */}
      {panel==="paddock" && (
        <>
          {lsuPaddockData.length > 0 ? (
            <div className="stat-panel-card">
              <div className="stat-panel-title">⚖️ {T.lsuByPaddock}</div>
              <CSSBarChart
                data={lsuPaddockData}
                valueKey="load"
                labelKey="name"
                maxOverride={Math.max(...lsuPaddockData.map(d=>d.load),100)}
                unit="%"
                colorFn={d=>d.load>100?"var(--rust)":d.load>80?"var(--amber)":"var(--green)"}
              />
              <div style={{fontSize:".7rem",color:"var(--muted)",marginTop:8}}>🟢 &lt;80%  🟡 80–100%  🔴 &gt;100%</div>
              {lsuPaddockData.filter(d=>d.daysLeft!==null&&d.daysLeft<30).map(d=>(
                <div key={d.name} style={{fontSize:".72rem",marginTop:4,color:d.daysLeft<14?"var(--rust)":"var(--amber)",fontWeight:600}}>
                  ⏳ {d.name}: {d.daysLeft} {getLang()==="en"?"days left":"dae oor"}
                </div>
              ))}
            </div>
          ) : (
            <div className="stat-panel-card">
              <div style={{color:"var(--muted)",fontSize:".85rem"}}>
                {getLang()==="en"?"Set hectares per paddock and ha/LSU in Settings to see load charts.":"Stel hektaar per kamp en ha/LSU in Instellings om laaigrafieke te sien."}
              </div>
            </div>
          )}

          {condPaddockData.length > 0 && (
            <div className="stat-panel-card">
              <div className="stat-panel-title">🌿 {T.paddockConditionPct}</div>
              <CSSBarChart
                data={condPaddockData}
                valueKey="cond"
                labelKey="name"
                maxOverride={100}
                unit="%"
                colorFn={d=>d.cond>=70?"var(--green)":d.cond>=40?"var(--amber)":"var(--rust)"}
              />
            </div>
          )}

          {daysPaddockData.length > 0 && (
            <div className="stat-panel-card">
              <div className="stat-panel-title">📅 {T.daysInPaddock}</div>
              <CSSBarChart
                data={daysPaddockData}
                valueKey="days"
                labelKey="name"
                colorFn={d=>d.days>=14?"var(--rust)":d.days>=7?"var(--amber)":"var(--green)"}
              />
            </div>
          )}
        </>
      )}

      {/* ── Operational ── */}
      {panel==="ops" && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-val" style={{color:taskDoneRate!==null&&taskDoneRate>=70?"var(--green)":"var(--amber)"}}>{taskDoneRate!==null?taskDoneRate+"%":"—"}</div><div className="kpi-lbl">✅ {T.taskCompletion}</div></div>
            <div className="kpi-card"><div className="kpi-val" style={{color:"var(--sky)"}}>{avgTaskDays!==null?avgTaskDays:"—"}</div><div className="kpi-lbl">📅 {T.avgTaskDays}</div></div>
            <div className="kpi-card"><div className="kpi-val" style={{color:"var(--amber)"}}>{issues.filter(i=>i.status==="open").length}</div><div className="kpi-lbl">⚠️ {T.openIssuesLbl}</div></div>
            <div className="kpi-card"><div className="kpi-val" style={{color:"var(--teal)"}}>{avgIssueDays!==null?avgIssueDays:"—"}</div><div className="kpi-lbl">🔧 {T.avgIssueDays}</div></div>
          </div>

          {taskStatusData.length > 0 && (
            <div className="stat-panel-card">
              <div className="stat-panel-title">{T.taskCompletion}</div>
              <CSSDonut data={taskStatusData}/>
            </div>
          )}

          {issueTypeData.length > 0 && (
            <div className="stat-panel-card">
              <div className="stat-panel-title">⚠️ {T.issuesByType}</div>
              <CSSBarChart data={issueTypeData} valueKey="count" labelKey="name" colorFn={()=>"var(--amber)"}/>
            </div>
          )}
          {issueTypeData.length===0 && <div style={{color:"var(--muted)",fontSize:".82rem",padding:"12px 0"}}>{T.noData}</div>}
        </>
      )}
    </>
  );
}

// ── Uitvoer ───────────────────────────────────────────────────────────────────
function Uitvoer({ paddocks, tasks, issues, events, treatments, settings }) {
  const [,] = useLang();
  const dl = (rows,fn) => {
    const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=fn;a.click();
  };
  const totS=paddocks.reduce((s,p)=>s+totalCat(p.sheep),0);
  const totG=paddocks.reduce((s,p)=>s+totalCat(p.goats),0);
  const totC=paddocks.reduce((s,p)=>s+totalCattle(p.cattle||emptyCattle()),0);
  const deaths=events.filter(e=>e.type==="death");
  const lost=events.filter(e=>e.type==="lost");
  const bought=events.filter(e=>e.type==="bought");
  const sold=events.filter(e=>e.type==="sold");
  const newL=events.filter(e=>e.type==="newLambs");
  const farmTotalLSU      = paddocks.reduce((s,p)=>s+calcLSU(p,settings).totalLSU,0);
  const farmTotalBudget   = paddocks.reduce((s,p)=>{ const c=calcLSU(p,settings); return s+(c.budget||0); },0);
  const farmTotalConsumed = paddocks.reduce((s,p)=>{ const c=calcLSU(p,settings); return s+(c.consumed||0); },0);
  const farmLoadPct       = farmTotalBudget>0 ? (farmTotalConsumed/farmTotalBudget)*100 : null;

  return (
    <>
      <div className="sec-head"><h2>{T.export}</h2></div>
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title" style={{marginBottom:10}}>📊 {T.farmSummary}</div>
        <table className="data-table"><tbody>
          <tr><td>{T.totalSheep}</td><td><strong>{totS}</strong></td></tr>
          <tr><td>{T.totalGoats}</td><td><strong>{totG}</strong></td></tr>
          <tr><td>{T.totalCattle}</td><td><strong>{totC}</strong></td></tr>
          <tr><td>{T.totalAnimals}</td><td><strong>{totS+totG+totC}</strong></td></tr>
          {farmTotalBudget>0 && <tr><td>⚖️ {T.farmLSU}</td><td><strong>{farmTotalConsumed.toFixed(0)} / {farmTotalBudget.toFixed(0)} {getLang()==="en"?"LSU-days":"LSU-dae"} ({farmLoadPct?farmLoadPct.toFixed(1):0}%)</strong></td></tr>}
          <tr><td>{T.animalsBought}</td><td>{bought.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>{T.animalsSold}</td><td>{sold.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>{T.newLambsRec}</td><td>{newL.reduce((s,e)=>s+(e.sheepLambs||0)+(e.goatLambs||0),0)}</td></tr>
          <tr><td>{T.deathsRec}</td><td>{deaths.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>{T.lostRec}</td><td>{lost.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>{T.treatments}</td><td>{treatments.length}</td></tr>
          <tr><td>{T.inspections}</td><td>{events.filter(e=>e.type==="inspection").length}</td></tr>
          <tr><td>{T.pendingTasksLbl}</td><td>{tasks.filter(t=>t.status==="pending").length}</td></tr>
          <tr><td>{T.openIssuesLbl}</td><td>{issues.filter(i=>i.status==="open").length}</td></tr>
          <tr><td>{T.totalEvents}</td><td>{events.length}</td></tr>
        </tbody></table>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title" style={{marginBottom:10}}>📍 {getLang()==="en"?"Paddock Animals, Condition & LSU":"Kamp Diere, Kondisie & LSU"}</div>
        <div style={{overflowX:"auto"}}>
          <table className="data-table">
            <thead><tr><th>{T.paddock}</th><th>{T.hectares}</th><th>LSU</th><th>{T.lsuDaysBudget}</th><th>{T.lsuDaysConsumed}</th><th>{T.lsuLoadPct}</th><th>{T.lsuDaysLeft}</th><th>Tot🐑</th><th>Tot🐐</th><th>Tot🐄</th><th>{T.fieldPaddockCond}</th></tr></thead>
            <tbody>{paddocks.map(p=>{
              const lsu=calcLSU(p,settings);
              const lsuColor = lsu.loadPct!==null?(lsu.loadPct>100?"var(--rust)":lsu.loadPct>80?"var(--amber)":"var(--green)"):"inherit";
              return <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.hectares??"-"}</td>
                <td>{lsu.totalLSU.toFixed(2)}</td>
                <td>{lsu.budget?lsu.budget.toFixed(0):"-"}</td>
                <td>{lsu.consumed?lsu.consumed.toFixed(1):"-"}</td>
                <td style={{color:lsuColor,fontWeight:700}}>{lsu.loadPct!==null?`${lsu.loadPct.toFixed(1)}%`:"-"}</td>
                <td style={{color:lsu.daysLeft!==null&&lsu.daysLeft<14?"var(--rust)":lsu.daysLeft!==null&&lsu.daysLeft<30?"var(--amber)":"inherit",fontWeight:600}}>{lsu.daysLeft??"-"}</td>
                <td><strong>{totalCat(p.sheep)}</strong></td>
                <td><strong>{totalCat(p.goats)}</strong></td>
                <td><strong>{totalCattle(p.cattle||emptyCattle())}</strong></td>
                <td style={{color:p.paddockCondition!=null?(p.paddockCondition>=70?"var(--green)":p.paddockCondition>=40?"var(--amber)":"var(--rust)"):"inherit"}}>{p.paddockCondition!=null?`${p.paddockCondition}%`:"-"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title" style={{marginBottom:12}}>⬇️ {T.downloadCSV}</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button className="btn btn-primary" onClick={()=>dl([
            [T.paddock,T.hectares,"LSU",T.lsuDaysBudget,T.lsuDaysConsumed,T.lsuLoadPct,T.lsuDaysLeft,`${T.ewes}🐑`,`${T.lambs}🐑`,`${T.rams}🐑`,`${T.wethers}🐑`,`Tot🐑`,`${T.ewes}🐐`,`${T.lambs}🐐`,`${T.rams}🐐`,`${T.wethers}🐐`,`Tot🐐`,`${T.bulls}🐄`,`${T.cows}🐄`,`${T.heifers}🐄`,`${T.calves}🐄`,`Tot🐄`,T.fieldDays,`${T.fieldPaddockCond}%`],
            ...paddocks.map(p=>{const lsu=calcLSU(p,settings);return[p.name,p.hectares??'',lsu.totalLSU.toFixed(2),lsu.budget?lsu.budget.toFixed(0):'',lsu.consumed?lsu.consumed.toFixed(1):'',lsu.loadPct?lsu.loadPct.toFixed(1)+'%':'',lsu.daysLeft??'',p.sheep.ewes,p.sheep.lambs,p.sheep.rams,p.sheep.wethers,totalCat(p.sheep),p.goats.ewes,p.goats.lambs,p.goats.rams,p.goats.wethers,totalCat(p.goats),(p.cattle||emptyCattle()).bulls,(p.cattle||emptyCattle()).cows,(p.cattle||emptyCattle()).heifers,(p.cattle||emptyCattle()).calves,totalCattle(p.cattle||emptyCattle()),daysSince(p.arrivedAt)??'',p.paddockCondition??''];})
          ],"kampe.csv")}>📍 {T.paddockReport}</button>
          <button className="btn btn-teal" onClick={()=>dl([
            [getLang()==="en"?"Date":"Datum",T.paddock,getLang()==="en"?"Animals":"Diere",T.category,getLang()==="en"?"Product":T.treatmentName,T.dosage,T.method,T.administeredBy],
            ...treatments.map(tr=>[fmtTime(tr.ts),tr.paddockName,tr.species==="sheep"?T.sheep:tr.species==="goats"?T.goats:tr.species==="cattle"?T.cattle:T.both,CATLABEL()[tr.category]||T.all,tr.treatment,tr.dosage,tr.method,tr.administeredBy])
          ],"behandelings.csv")}>💊 {T.treatmentReport}</button>
          <button className="btn btn-sky" onClick={()=>dl([
            [getLang()==="en"?"Task":T.taskDesc,T.assignTo,T.paddock,T.dueDate,getLang()==="en"?"Status":"Status",getLang()==="en"?"Created":"Geskep",T.done],
            ...tasks.map(t=>[t.title,t.assignedTo,paddocks.find(p=>p.id===t.paddock)?.name??"",t.dueDate?fmtDate(t.dueDate):"",t.status,fmtDate(t.createdAt),t.doneAt?fmtTime(t.doneAt):""]),
          ],"take.csv")}>✅ {T.taskReport}</button>
          <button className="btn btn-amber" onClick={()=>dl([
            [getLang()==="en"?"Date":"Datum",getLang()==="en"?"Type":"Tipe",getLang()==="en"?"Details":"Besonderhede",T.paddock,`🐑 ${getLang()==="en"?"Score":"K"}`,`🐐 ${getLang()==="en"?"Score":"K"}`,`🐄 ${getLang()==="en"?"Score":"K"}`,`${T.fieldPaddockCond}%`,T.observations],
            ...events.map(ev=>{
              let det="",loc="";
              if(ev.type==="movement"){det=`${T.moved}: ${totalCat(ev.sheep??{})} ${T.sheep2}, ${totalCat(ev.goats??{})} ${T.goats2}`;loc=`${ev.fromName||""}→${ev.toName||""}`;}
              else if(ev.type==="bought"){det=`${T.bought2}: ${totalCat(ev.sheep??{})} ${T.sheep2}`;loc=ev.paddockName||"";}
              else if(ev.type==="sold"){det=`${T.sold2}: ${totalCat(ev.sheep??{})} ${T.sheep2}`;loc=ev.paddockName||"";}
              else if(ev.type==="newLambs"){det=`${T.newLambs}: ${ev.sheepLambs||0}+${ev.goatLambs||0}`;loc=ev.paddockName||"";}
              else if(ev.type==="death"){det=`${T.dead}: ${totalCat(ev.sheep??{})+totalCat(ev.goats??{})}${ev.cause?` (${ev.cause})`:""}`;loc=ev.paddockName||"";}
              else if(ev.type==="lost"){det=`${T.missing}: ${totalCat(ev.sheep??{})+totalCat(ev.goats??{})}`;loc=ev.paddockName||"";}
              else if(ev.type==="found"){det=`${T.found}: ${totalCat(ev.sheep??{})+totalCat(ev.goats??{})}`;loc=ev.paddockName||"";}
              else if(ev.type==="treatment"){det=`${ev.treatment||""} — ${ev.count||0}`;loc=ev.paddockName||"";}
              else if(ev.type==="inspection"){det=T.inspectionEvent;loc=ev.paddockName||"";}
              else if(ev.type==="stockTake"){det=T.stockTakeEvent;loc=ev.paddockName||"";}
              else if(ev.type==="restStart"){det=T.restStarted;loc=ev.paddockName||"";}
              else if(ev.type==="restEnd"){det=T.restEnded;loc=ev.paddockName||"";}
              else if(ev.type==="task"){det=`${ev.action==="completed"?T.taskCompleted:T.taskAssigned}: ${ev.taskTitle||""}`;loc="";}
              else{det=`${ev.action==="resolved"?T.issueResolved:T.issueReported}: ${ev.issueTitle||""}`;loc=ev.paddockName||"";}
              return[fmtTime(ev.ts),ev.type,det,loc,ev.sheepScore??'',ev.goatScore??'',ev.cattleScore??'',ev.paddockCond??'',ev.observations??''];
            })
          ],"geskiedenis.csv")}>📋 {T.fullHistory}</button>
          <button className="btn btn-ghost" onClick={()=>window.print()}>🖨️ {T.printPage}</button>
        </div>
      </div>
    </>
  );
}

// ── Event Row ─────────────────────────────────────────────────────────────────
function EventRow({ ev }) {
  const [,] = useLang();
  const configs = {
    movement:  {icon:"🔀",cls:"ev-move", title:`${T.moved}: ${totalCat(ev.sheep??{})} ${T.sheep2}, ${totalCat(ev.goats??{})} ${T.goats2}${totalCattle(ev.cattle||emptyCattle())>0?`, ${totalCattle(ev.cattle||emptyCattle())} ${T.cattle2}`:""}`,meta:`${ev.fromName||""}→${ev.toName||""}${ev.notes?` · ${ev.notes}`:""}`},
    bought:    {icon:"🛒",cls:"ev-buy",  title:`${T.bought2}: ${totalCat(ev.sheep??{})} ${T.sheep2}, ${totalCat(ev.goats??{})} ${T.goats2}${totalCattle(ev.cattle||emptyCattle())>0?`, ${totalCattle(ev.cattle||emptyCattle())} ${T.cattle2}`:""}`, meta:ev.paddockName||""},
    sold:      {icon:"💰",cls:"ev-sell", title:`${T.sold2}: ${totalCat(ev.sheep??{})} ${T.sheep2}, ${totalCat(ev.goats??{})} ${T.goats2}${totalCattle(ev.cattle||emptyCattle())>0?`, ${totalCattle(ev.cattle||emptyCattle())} ${T.cattle2}`:""}`,meta:ev.paddockName||""},
    newLambs:  {icon:"🐣",cls:"ev-treat",title:`${T.newLambs}: ${(ev.sheepLambs||0)+(ev.goatLambs||0)} ${T.lambs2}`, meta:ev.paddockName||""},
    death:     {icon:"☠️",cls:"ev-death",title:`${T.death}: ${totalCat(ev.sheep??{})} ${T.sheep2}, ${totalCat(ev.goats??{})} ${T.goats2}${totalCattle(ev.cattle||emptyCattle())>0?`, ${totalCattle(ev.cattle||emptyCattle())} ${T.cattle2}`:""}`,meta:`${ev.paddockName||""}${ev.cause?` · ${ev.cause}`:""}`},
    lost:      {icon:"🔍",cls:"ev-lost", title:`${T.lost}: ${totalCat(ev.sheep??{})} ${T.sheep2}, ${totalCat(ev.goats??{})} ${T.goats2}${totalCattle(ev.cattle||emptyCattle())>0?`, ${totalCattle(ev.cattle||emptyCattle())} ${T.cattle2}`:""}`, meta:ev.paddockName||""},
    found:     {icon:"✅",cls:"ev-buy", title:`${T.found}: ${totalCat(ev.sheep??{})} ${T.sheep2}, ${totalCat(ev.goats??{})} ${T.goats2}${totalCattle(ev.cattle||emptyCattle())>0?`, ${totalCattle(ev.cattle||emptyCattle())} ${T.cattle2}`:""}`, meta:ev.paddockName||""},
    treatment: {icon:"💊",cls:"ev-treat",title:`${T.treatment2}: ${ev.treatment||""} — ${ev.count||0} ${getLang()==="en"?"animals":"diere"}`, meta:`${ev.paddockName||""}${ev.method?` · ${ev.method}`:""}`},
    stockTake: {icon:"📊",cls:"ev-task", title:`${T.stockTakeEvent}: ${ev.paddockName||""}`, meta:""},
    inspection:{icon:"🔍",cls:"ev-insp", title:`${T.inspectionEvent}: ${ev.paddockName||""}`,
      meta:`${ev.sheepScore!==null&&ev.sheepScore!==undefined?` 🐑${ev.sheepScore}/5`:""}${ev.goatScore!==null&&ev.goatScore!==undefined?` 🐐${ev.goatScore}/5`:""}${ev.paddockCond!=null?` 🌿${ev.paddockCond}%`:""}`.trim()},
    task:      {icon:"✅",cls:"ev-task", title:`${getLang()==="en"?"Task":"Taak"} ${ev.action==="completed"?T.taskCompleted:T.taskAssigned}: ${ev.taskTitle||""}`,meta:ev.assignedTo?`→ ${ev.assignedTo}`:""},
    issue:     {icon:"⚠️",cls:"ev-issue",title:`${getLang()==="en"?"Issue":"Probleem"} ${ev.action==="resolved"?T.issueResolved:T.issueReported}: ${ev.issueTitle||""}`,meta:ev.paddockName||""},
    restStart: {icon:"🌱",cls:"ev-insp", title:`${ev.paddockName||""} ${T.restStarted}`, meta:""},
    restEnd:   {icon:"🔁",cls:"ev-insp", title:`${ev.paddockName||""} ${T.restEnded}`, meta:""},
  };
  const cfg=configs[ev.type]||{icon:"📝",cls:"ev-task",title:ev.type,meta:""};
  return (
    <div className="event-item">
      <div className={`event-icon ${cfg.cls}`}>{cfg.icon}</div>
      <div className="event-body">
        <div className="event-title">{cfg.title}</div>
        <div className="event-meta">
          {fmtTime(ev.ts)}{cfg.meta?` · ${cfg.meta}`:""}
          {isBackdated(ev.ts) && <span className="backdated-badge">📅 {getLang()==="en"?"backdated":"teruggedateer"}</span>}
        </div>
      </div>
    </div>
  );
}
