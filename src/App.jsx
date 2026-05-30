import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         onAuthStateChanged, signOut } from "firebase/auth";

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

// Offline persistence: caches all data to device, queues writes when offline,
// syncs automatically when connection returns.
const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache()
});
const auth = getAuth(firebaseApp);

// ── Storage (Firestore) ───────────────────────────────────────────────────────
const KEYS = { p:"fm4_p", e:"fm4_e", t:"fm4_t", i:"fm4_i", tr:"fm4_tr", pin:"fm4_pin", epin:"fm4_epin", s:"fm4_settings" };

// Farm data lives under /farms/{farmId}/data/{key} — each farm is fully isolated.
// Client/billing records live under /clients/{farmId} — readable by dashboard.
async function load(key, fb, farmId) {
  try {
    const snap = await getDoc(doc(db, "farms", farmId, "data", key));
    return snap.exists() ? JSON.parse(snap.data().value) : fb;
  } catch(e) { console.error("Load error:", key, e); return fb; }
}
async function save(key, val, farmId) {
  try {
    await setDoc(doc(db, "farms", farmId, "data", key), { value: JSON.stringify(val) });
  } catch(e) { console.error("Save error:", key, e); }
}
async function loadClient(farmId) {
  try {
    const snap = await getDoc(doc(db, "clients", farmId));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}
async function saveClient(farmId, data) {
  try { await setDoc(doc(db, "clients", farmId), data, { merge: true }); } catch {}
}

// ── Translation ───────────────────────────────────────────────────────────────
const T = {
  app:"Plaasbestuurder", overview:"Oorsig", paddocks:"Kampe", movements:"Bewegings",
  losses:"Verliese", treatments:"Behandelings", tasks:"Take", issues:"Probleme",
  history:"Geskiedenis", export:"Uitvoer", transactions:"Transaksies",
  admin:"Bestuurder", worker:"Plaaswerker",
  adminDesc:"Volle toegang — wys take toe, bestuur kampe, sien alle rekords",
  workerDesc:"Rekordeer bewegings, verliese, behandelings en voltooi take",
  selectRole:"Kies jou rol om voort te gaan",
  sheep:"Skape", goats:"Bokke", ewes:"Ooie", lambs:"Lammers", rams:"Ramme", wethers:"Hamels", total:"Totaal",
  add:"Voeg by", save:"Stoor", cancel:"Kanselleer", delete:"Verwyder", record:"Rekordeer",
  from:"Van", to:"Na", notes:"Notas", cause:"Oorsaak", name:"Naam", paddock:"Kamp",
  select:"Kies...", noSpecific:"Nie spesifiek", all:"Almal", other:"Ander",
  fromPaddock:"Van Kamp", toPaddock:"Na Kamp", currentStock:"Huidige diere in",
  recordMovement:"Rekordeer Beweging →", movementSaved:"✅ Beweging Rekordeer!",
  death:"Sterfte", lost:"Vermis", lossType:"Tipe Verlies",
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
  // Auth strings
  signIn:"Teken In", signUp:"Registreer", email:"E-pos", password:"Wagwoord",
  confirmPassword:"Bevestig Wagwoord", noAccount:"Geen rekening? Registreer →",
  hasAccount:"Het reeds 'n rekening? Teken In →",
  signOut:"Teken Uit", signOutConfirm:"Is jy seker jy wil uitteken?",
  // Subscription strings
  subscriptionExpired:"Jou proeftydperk het verval. Kontak ons om voort te gaan.",
  subscriptionSuspended:"Jou rekening is tydelik opgeskort. Kontak ons vir hulp.",
  trialDaysLeft:"proefdae oor",
  // Settings strings
  settings:"Instellings", farmName:"Plaas Naam", settingsSaved:"✅ Instellings Gestoor!",
  farmNamePlaceholder:"bv. Groenplaas", setupWelcome:"Welkom by Plaasbestuurder",
  setupDesc:"Stel jou plaas op om te begin. Jy kan dit later verander onder Instellings.",
  setupFarmName:"Wat is jou plaas se naam?", setupContinue:"Begin →",
  // Admin PIN strings
  enterPin:"Voer PIN in", setPin:"Stel Admin PIN", confirmPin:"Bevestig PIN",
  pinMismatch:"PIN stem nie ooreen nie", pinWrong:"Verkeerde PIN", pinSet:"PIN gestel ✅",
  pinPrompt:"4-syfer PIN vir Bestuurder toegang",
  // Entry gate PIN strings
  enterEntryPin:"Voer toegangskode in", setEntryPin:"Stel Toegangskode",
  entryPinPrompt:"Voer die plaas toegangskode in om voort te gaan",
  entryPinSet:"Toegangskode gestel ✅", wrongEntryPin:"Verkeerde toegangskode",
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CATS = ["ewes","lambs","rams","wethers"];
const CATLABEL = { ewes:T.ewes, lambs:T.lambs, rams:T.rams, wethers:T.wethers };
const emptyCat    = () => ({ ewes:0, lambs:0, rams:0, wethers:0 });
const emptyScores = () => ({ ewes:null, lambs:null, rams:null, wethers:null });
const totalCat    = (o) => CATS.reduce((s,c) => s+(Number(o?.[c])||0), 0);
const addCat      = (a,b) => Object.fromEntries(CATS.map(c=>[c,(Number(a?.[c])||0)+(Number(b?.[c])||0)]));
const subCat      = (a,b) => Object.fromEntries(CATS.map(c=>[c,Math.max(0,(Number(a?.[c])||0)-(Number(b?.[c])||0))]));

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid      = () => Math.random().toString(36).slice(2,9);
const nowISO   = () => new Date().toISOString();
const fmtDate  = (s) => s ? new Date(s).toLocaleDateString("af-ZA",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fmtTime  = (s) => s ? new Date(s).toLocaleString("af-ZA",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
const daysSince= (s) => s ? Math.floor((Date.now()-new Date(s))/86400000) : null;
const isOverdue= (d) => d && new Date(d)<new Date() && new Date(d).toDateString()!==new Date().toDateString();
const todayStr = () => new Date().toISOString().split("T")[0];

async function compressImage(file, maxW=600) {
  return new Promise(res => {
    const r=new FileReader(); r.onload=e=>{const img=new Image();img.onload=()=>{
      const sc=Math.min(1,maxW/img.width),cv=document.createElement("canvas");
      cv.width=img.width*sc;cv.height=img.height*sc;cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
      res(cv.toDataURL("image/jpeg",0.7));};img.src=e.target.result;};r.readAsDataURL(file);
  });
}

// ── Seed data — starts empty; admin adds paddocks via the Kampe tab ───────────
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
.ev-buy{background:#e8f4e8}.ev-sell{background:#fce8e8}
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

@media print{.nav,.tabs,.btn,.btn-full,.overlay{display:none!important}.page{padding:0}.card{box-shadow:none;break-inside:avoid}}
`;

// ══════════════════════════════════════════════════════════════════════════════
//  Reusable Components
// ══════════════════════════════════════════════════════════════════════════════

function CategoryGrid({ label, values, onChange, max }) {
  return (
    <div className="species-block">
      <h4>{label}</h4>
      <div className="cat-grid">
        {CATS.map(c => (
          <div key={c} className="form-group" style={{marginBottom:0}}>
            <label className="form-label">{CATLABEL[c]}</label>
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

function AdditionalRecords({ extra, setExtra }) {
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

          <h4 style={{marginTop:10}}>☠️ {T.deadDuring}</h4>
          <CategoryGrid label={`🐑 ${T.sheep}`} values={extra.dead.sheep} onChange={(c,v)=>upd(`dead.sheep.${c}`,Number(v)||0)} />
          <CategoryGrid label={`🐐 ${T.goats}`} values={extra.dead.goats} onChange={(c,v)=>upd(`dead.goats.${c}`,Number(v)||0)} />
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
          {["sheep","goats"].map(sp => (
            <div key={sp} className="species-block">
              <h4>{sp==="sheep"?`🐑 ${T.sheep}`:`🐐 ${T.goats}`}</h4>
              {CATS.map(c => (
                <div key={c} style={{marginBottom:8}}>
                  <div style={{fontSize:".78rem",color:"var(--muted)",marginBottom:4}}>{CATLABEL[c]}</div>
                  <ScoreSelector value={extra.scores[sp][c]} onChange={v=>upd(`scores.${sp}.${c}`,v)} />
                </div>
              ))}
            </div>
          ))}

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
  lost:{ sheep:emptyCat(), goats:emptyCat() },
  dead:{ sheep:emptyCat(), goats:emptyCat() },
  deadCause:"", scores:{ sheep:emptyScores(), goats:emptyScores() },
  paddockCond:null, observations:""
});

// ══════════════════════════════════════════════════════════════════════════════
//  Entry Gate (locks the whole app behind a shared farm PIN)
// ══════════════════════════════════════════════════════════════════════════════
function EntryGate({ onPass, farmName, farmId }) {
  const [pin,    setPin]    = useState("");
  const [pin2,   setPin2]   = useState("");
  const [err,    setErr]    = useState("");
  const [hasPin, setHasPin] = useState(null);

  useEffect(() => {
    load(KEYS.epin, null, farmId).then(v => setHasPin(!!v));
  }, []);

  const submit = async () => {
    const stored = await load(KEYS.epin, null, farmId);
    if (!stored) {
      if (pin.length < 4) return setErr("Min 4 syfers");
      if (pin !== pin2)   return setErr(T.pinMismatch);
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
      <div style={{fontSize:".85rem",opacity:.7}}>Laai…</div>
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
//  Role Screen (with admin PIN)
// ══════════════════════════════════════════════════════════════════════════════
function RoleScreen({ onPick, farmName, farmId }) {
  const [pickingAdmin, setPickingAdmin] = useState(false);
  const [pin,   setPin]   = useState("");
  const [pin2,  setPin2]  = useState("");
  const [err,   setErr]   = useState("");
  const [hasPin,setHasPin]= useState(null);

  useEffect(()=>{
    load(KEYS.pin, null, farmId).then(v => setHasPin(!!v));
  },[]);

  const handleAdmin = async () => {
    const stored = await load(KEYS.pin, null, farmId);
    setHasPin(!!stored);
    setPickingAdmin(true);
    setPin(""); setPin2(""); setErr("");
  };

  const submitPin = async () => {
    const stored = await load(KEYS.pin, null, farmId);
    if (!stored) {
      if (pin.length < 4) return setErr("Min 4 syfers");
      if (pin !== pin2)   return setErr(T.pinMismatch);
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
  // ── Auth & subscription state ──────────────────────────────────────────────
  const [authReady,  setAuthReady]  = useState(false); // onAuthStateChanged resolved
  const [farmId,     setFarmId]     = useState(null);  // Firebase uid
  const [clientDoc,  setClientDoc]  = useState(null);  // /clients/{farmId} record

  // ── Farm data state ────────────────────────────────────────────────────────
  const [entryPassed, setEntryPassed] = useState(false);
  const [role,        setRole]        = useState(null);
  const [tab,         setTab]         = useState("dashboard");
  const [paddocks,    setPaddocks]    = useState([]);
  const [events,      setEvents]      = useState([]);
  const [tasks,       setTasks]       = useState([]);
  const [issues,      setIssues]      = useState([]);
  const [treatments,  setTreatments]  = useState([]);
  const [settings,    setSettings]    = useState({ farmName:"" });
  const [loaded,      setLoaded]      = useState(false);
  const [syncing,     setSyncing]     = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);

  // PIN modal state for nav role switch
  const [pinModal, setPinModal] = useState(false);
  const [pinVal,   setPinVal]   = useState("");
  const [pinErr,   setPinErr]   = useState("");

  // ── Firebase Auth listener ─────────────────────────────────────────────────
  // Runs once on mount. When auth state changes (login/logout/page refresh),
  // loads the client record and updates lastActive for dashboard tracking.
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFarmId(user.uid);
        let client = await loadClient(user.uid);
        if (!client) {
          // No client record — create a default one (handles manual Firebase accounts)
          client = {
            email: user.email, farmName: "",
            status: "trial",
            trialEndsAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            payfastSubId: null
          };
          await saveClient(user.uid, client);
        } else {
          await saveClient(user.uid, { lastActive: new Date().toISOString() });
        }
        setClientDoc(client);
      } else {
        setFarmId(null);
        setClientDoc(null);
      }
      setAuthReady(true);
    });
  }, []);

  // ── Load farm data once we know which farm ─────────────────────────────────
  useEffect(() => {
    if (!farmId) return;
    (async () => {
      const [p,e,t,i,tr,s] = await Promise.all([
        load(KEYS.p, SEED_PADDOCKS, farmId), load(KEYS.e, [], farmId),
        load(KEYS.t, [], farmId),            load(KEYS.i, [], farmId),
        load(KEYS.tr, [], farmId),           load(KEYS.s, { farmName:"" }, farmId),
      ]);
      setPaddocks(p);setEvents(e);setTasks(t);setIssues(i);setTreatments(tr);setSettings(s);
      setLoaded(true);
    })();
  }, [farmId]);

  // ── Save effects — all scoped to this farm's path ──────────────────────────
  useEffect(() => { if(loaded&&farmId){ setSyncing(true); save(KEYS.p,paddocks,farmId).then(()=>setSyncing(false)); }}, [paddocks,loaded]);
  useEffect(() => { if(loaded&&farmId) save(KEYS.e, events,     farmId); }, [events,     loaded]);
  useEffect(() => { if(loaded&&farmId) save(KEYS.t, tasks,      farmId); }, [tasks,      loaded]);
  useEffect(() => { if(loaded&&farmId) save(KEYS.i, issues,     farmId); }, [issues,     loaded]);
  useEffect(() => { if(loaded&&farmId) save(KEYS.tr,treatments, farmId); }, [treatments, loaded]);
  useEffect(() => { if(loaded&&farmId) save(KEYS.s, settings,   farmId); }, [settings,   loaded]);
  // Mirror farmName to client record so dashboard always sees current name
  useEffect(() => {
    if(loaded&&farmId&&settings.farmName) saveClient(farmId, { farmName:settings.farmName });
  }, [settings.farmName, loaded]);

  const addEvent = (ev) => setEvents(prev => [{ id:uid(), ts:nowISO(), ...ev }, ...prev]);

  const applyExtra = (extra, paddockId) => {
    const lostSh = totalCat(extra.lost.sheep), lostGo = totalCat(extra.lost.goats);
    const deadSh = totalCat(extra.dead.sheep), deadGo = totalCat(extra.dead.goats);
    if (lostSh+lostGo > 0) {
      setPaddocks(prev => prev.map(p => p.id===paddockId
        ? {...p, sheep:subCat(p.sheep,extra.lost.sheep), goats:subCat(p.goats,extra.lost.goats)} : p));
      addEvent({type:"lost", paddock:paddockId, paddockName:paddocks.find(p=>p.id===paddockId)?.name,
        sheep:extra.lost.sheep, goats:extra.lost.goats});
    }
    if (deadSh+deadGo > 0) {
      setPaddocks(prev => prev.map(p => p.id===paddockId
        ? {...p, sheep:subCat(p.sheep,extra.dead.sheep), goats:subCat(p.goats,extra.dead.goats)} : p));
      addEvent({type:"death", paddock:paddockId, paddockName:paddocks.find(p=>p.id===paddockId)?.name,
        sheep:extra.dead.sheep, goats:extra.dead.goats, cause:extra.deadCause});
    }
    if (extra.paddockCond !== null) {
      setPaddocks(prev => prev.map(p => p.id===paddockId ? {...p, paddockCondition:extra.paddockCond} : p));
    }
  };

  const handleNavSwitch = async () => {
    if (role === "admin") { setRole("worker"); }
    else { setPinVal(""); setPinErr(""); setPinModal(true); }
  };

  const submitNavPin = async () => {
    const stored = await load(KEYS.pin, null, farmId);
    if (pinVal !== stored) return setPinErr(T.pinWrong);
    setRole("admin");
    setPinModal(false);
  };

  const handleSignOut = async () => {
    if (!confirm(T.signOutConfirm)) return;
    await signOut(auth);
    // Reset all local state — next render shows AuthScreen
    setFarmId(null); setClientDoc(null); setEntryPassed(false); setRole(null);
    setLoaded(false); setPaddocks([]); setEvents([]); setTasks([]);
    setIssues([]); setTreatments([]); setSettings({ farmName:"" });
  };

  // ── Render flow ────────────────────────────────────────────────────────────

  // 1. Waiting for Firebase Auth to resolve (page refresh / cold start)
  if (!authReady) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"100vh",background:"var(--olive)",color:"#fff",gap:12}}>
      <div style={{fontSize:"3rem"}}>🐑</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.4rem"}}>{T.app}</div>
      <div style={{fontSize:".85rem",opacity:.7}}>Laai…</div>
    </div>
  );

  // 2. Not logged in — show auth screen
  if (!farmId) return (
    <><style>{CSS}</style><AuthScreen/></>
  );

  // 3. Check subscription status
  const trialExpired = clientDoc?.status === "trial" &&
    clientDoc?.trialEndsAt && new Date(clientDoc.trialEndsAt) < new Date();
  const isBlocked = clientDoc?.status === "suspended" ||
    clientDoc?.status === "cancelled" || trialExpired;
  if (isBlocked) return (
    <><style>{CSS}</style><PaywallScreen clientDoc={clientDoc} onSignOut={handleSignOut}/></>
  );

  // 4. Entry gate (workers use this; admin session persists past it)
  const displayName = settings.farmName || clientDoc?.farmName || T.app;
  if (!entryPassed) return (
    <><style>{CSS}</style><EntryGate onPass={()=>setEntryPassed(true)} farmName={displayName} farmId={farmId}/></>
  );

  // 5. Loading farm data from Firestore
  if (!loaded) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"100vh",background:"var(--olive)",color:"#fff",gap:12}}>
      <div style={{fontSize:"3rem"}}>🐑</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.4rem"}}>{displayName}</div>
      <div style={{fontSize:".85rem",opacity:.7}}>Laai data van bediener…</div>
    </div>
  );

  // 6. First-run: no farm name set yet (fallback for edge cases)
  if (!settings.farmName) return (
    <><style>{CSS}</style><FarmSetup onDone={name=>setSettings({farmName:name})}/></>
  );

  if (!role) return (
    <><style>{CSS}</style><RoleScreen onPick={r=>setRole(r)} farmName={settings.farmName} farmId={farmId}/></>
  );

  // 8. Trial banner — show days remaining if on trial
  const trialDaysLeft = clientDoc?.status === "trial" && clientDoc?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(clientDoc.trialEndsAt) - new Date()) / 86400000))
    : null;

  const pendingCount = tasks.filter(t=>t.status==="pending").length;
  const overdueCount = tasks.filter(t=>t.status==="pending"&&isOverdue(t.dueDate)).length;
  const openIssues   = issues.filter(i=>i.status==="open").length;

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
    ...(role==="admin" ? [{id:"export", label:"📊 "+T.export}] : []),
  ];

  const ctx = { paddocks, setPaddocks, events, setEvents, tasks, setTasks,
                issues, setIssues, treatments, setTreatments, role, addEvent, applyExtra };

  return (
    <>
      <style>{CSS}</style>
      {trialDaysLeft !== null && trialDaysLeft <= 14 && (
        <div className="sync-bar" style={{background:"var(--amber)"}}>
          ⏳ {trialDaysLeft} {T.trialDaysLeft}
        </div>
      )}
      {syncing && <div className="sync-bar">☁️ Stoor na bediener…</div>}
      <nav className="nav">
        <h1>🐑 {settings.farmName}</h1>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {role==="admin" && (
            <button className="nav-role" onClick={()=>setSettingsModal(true)} title={T.settings}>⚙️</button>
          )}
          <button className="nav-role" onClick={handleNavSwitch}>
            {role==="admin"?"👤 "+T.admin:"👷 "+T.worker}
          </button>
        </div>
      </nav>
      <div className="tabs">
        {TABS.map(tb => <button key={tb.id} className={`tab ${tab===tb.id?"active":""}`} onClick={()=>setTab(tb.id)}>{tb.label}</button>)}
      </div>
      <div className="page">
        {tab==="dashboard"    && <Dashboard    {...ctx} setTab={setTab} />}
        {tab==="paddocks"     && <Paddocks     {...ctx} />}
        {tab==="movements"    && <Bewegings    {...ctx} />}
        {tab==="transactions" && <Transaksies  {...ctx} />}
        {tab==="losses"       && <Verliese     {...ctx} />}
        {tab==="treatments"   && <Behandelings {...ctx} />}
        {tab==="tasks"        && <Take         {...ctx} />}
        {tab==="issues"       && <Probleme     {...ctx} />}
        {tab==="history"      && <Geskiedenis  events={events} paddocks={paddocks} />}
        {tab==="export"       && <Uitvoer      {...ctx} />}
      </div>

      {/* PIN modal for nav role switch */}
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

      {/* Settings modal (admin only) */}
      {settingsModal && (
        <SettingsModal
          settings={settings}
          onSave={s=>{ setSettings(s); setSettingsModal(false); }}
          onClose={()=>setSettingsModal(false)}
          onSignOut={handleSignOut}
        />
      )}
    </>
  );
}

// ── AuthScreen — sign in or register a new farm account ──────────────────────
function AuthScreen() {
  const [mode,      setMode]      = useState("signin");
  const [farmName,  setFarmName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [err,       setErr]       = useState("");
  const [busy,      setBusy]      = useState(false);

  const errMsg = (code) => {
    if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential"].includes(code))
      return "Verkeerde e-pos of wagwoord";
    if (code === "auth/email-already-in-use") return "E-pos reeds geregistreer";
    if (code === "auth/weak-password")        return "Wagwoord te kort (min 6 karakters)";
    if (code === "auth/invalid-email")        return "Ongeldige e-pos adres";
    return `Fout: ${code}`;
  };

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (!farmName.trim()) { setErr("Voer jou plaas naam in"); setBusy(false); return; }
        if (password !== password2) { setErr(T.pinMismatch); setBusy(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const uid = cred.user.uid;
        // Create client record — this is what your dashboard reads
        await saveClient(uid, {
          email: email.trim(), farmName: farmName.trim(),
          status: "trial",
          trialEndsAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          payfastSubId: null
        });
        // Pre-save farm name into settings so FarmSetup never shows
        await save(KEYS.s, { farmName: farmName.trim() }, uid);
        // onAuthStateChanged fires automatically — app transitions to main flow
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        // onAuthStateChanged fires automatically
      }
    } catch(e) { setErr(errMsg(e.code)); }
    setBusy(false);
  };

  return (
    <div className="role-screen">
      <div style={{fontSize:"3rem",marginBottom:8}}>🐑</div>
      <h1 style={{marginBottom:6}}>{T.app}</h1>
      <p>{mode==="signup" ? "Skep jou plaas rekening" : "Teken in by jou plaas"}</p>
      <div className="role-cards">
        <div className="role-card" style={{cursor:"default"}}>
          {mode==="signup" && (
            <div className="form-group">
              <label className="form-label">{T.farmName}</label>
              <input className="form-input" value={farmName}
                onChange={e=>{setFarmName(e.target.value);setErr("");}}
                placeholder={T.farmNamePlaceholder} autoFocus/>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{T.email}</label>
            <input className="form-input" type="email" value={email}
              onChange={e=>{setEmail(e.target.value);setErr("");}}
              placeholder="jan@plaas.co.za" autoFocus={mode==="signin"}/>
          </div>
          <div className="form-group">
            <label className="form-label">{T.password}</label>
            <input className="form-input" type="password" value={password}
              onChange={e=>{setPassword(e.target.value);setErr("");}}
              placeholder="••••••"
              onKeyDown={e=>e.key==="Enter"&&mode==="signin"&&submit()}/>
          </div>
          {mode==="signup" && (
            <div className="form-group">
              <label className="form-label">{T.confirmPassword}</label>
              <input className="form-input" type="password" value={password2}
                onChange={e=>{setPassword2(e.target.value);setErr("");}}
                placeholder="••••••"/>
            </div>
          )}
          {err && <div style={{color:"var(--rust)",fontSize:".82rem",marginBottom:8}}>{err}</div>}
          <button className="btn btn-primary btn-full" onClick={submit} disabled={busy}>
            {busy ? "Besig…" : mode==="signup" ? T.signUp : T.signIn}
          </button>
          <button className="btn btn-ghost btn-full" style={{marginTop:8}}
            onClick={()=>{setMode(m=>m==="signin"?"signup":"signin");setErr("");}}>
            {mode==="signup" ? T.hasAccount : T.noAccount}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PaywallScreen — shown when trial expired or account suspended ──────────────
function PaywallScreen({ clientDoc, onSignOut }) {
  const suspended = clientDoc?.status === "suspended";
  return (
    <div className="role-screen">
      <div style={{fontSize:"3rem",marginBottom:8}}>🔒</div>
      <h1 style={{marginBottom:6}}>{suspended ? "Rekening Opgeskort" : "Proeftydperk Verval"}</h1>
      <div className="role-cards">
        <div className="role-card" style={{cursor:"default",textAlign:"center"}}>
          <p style={{color:"var(--muted)",marginBottom:16}}>
            {suspended ? T.subscriptionSuspended : T.subscriptionExpired}
          </p>
          <div style={{fontWeight:700,fontSize:"1rem",marginBottom:16}}>
            support@plaasbestuurder.co.za
          </div>
          <button className="btn btn-ghost btn-full" onClick={onSignOut}>{T.signOut}</button>
        </div>
      </div>
    </div>
  );
}

// ── FarmSetup — first-run wizard shown before anything else ──────────────────
function FarmSetup({ onDone }) {
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
            onKeyDown={e=>e.key==="Enter"&&submit()}
            style={{marginTop:12,marginBottom:10}}/>
          <button className="btn btn-primary btn-full" onClick={submit} disabled={!name.trim()}>
            {T.setupContinue}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SettingsModal — admin can change farm name ────────────────────────────────
function SettingsModal({ settings, onSave, onClose, onSignOut }) {
  const [farmName, setFarmName] = useState(settings.farmName||"");
  const [saved, setSaved] = useState(false);
  const submit = () => {
    if(!farmName.trim()) return;
    onSave({ ...settings, farmName: farmName.trim() });
    setSaved(true);
    setTimeout(()=>{ setSaved(false); onClose(); }, 1200);
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <h2>⚙️ {T.settings}</h2>
        <div className="form-group">
          <label className="form-label">{T.farmName}</label>
          <input className="form-input" value={farmName} onChange={e=>setFarmName(e.target.value)}
            placeholder={T.farmNamePlaceholder} autoFocus/>
        </div>
        <button className="btn btn-primary btn-full" onClick={submit} disabled={!farmName.trim()}>
          {saved ? T.settingsSaved : T.save}
        </button>
        <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={onClose}>{T.cancel}</button>
        <div style={{borderTop:"1px solid var(--border)",marginTop:20,paddingTop:16}}>
          <button className="btn btn-ghost btn-full" style={{color:"var(--rust)"}} onClick={onSignOut}>
            🚪 {T.signOut}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ paddocks, setPaddocks, events, tasks, issues, role, setTab }) {
  const totSheep = paddocks.reduce((s,p)=>s+totalCat(p.sheep),0);
  const totGoats = paddocks.reduce((s,p)=>s+totalCat(p.goats),0);
  const pending  = tasks.filter(t=>t.status==="pending").length;
  const overdue  = tasks.filter(t=>t.status==="pending"&&isOverdue(t.dueDate)).length;
  const openI    = issues.filter(i=>i.status==="open").length;

  return (
    <>
      <div className="sec-head"><h2>{T.overview}</h2></div>
      <div className="summary-strip">
        <div className="chip"><div className="chip-val sheep-c">{totSheep}</div><div className="chip-lbl">🐑 {T.sheep}</div></div>
        <div className="chip"><div className="chip-val goats-c">{totGoats}</div><div className="chip-lbl">🐐 {T.goats}</div></div>
        <div className="chip"><div className="chip-val total-c">{totSheep+totGoats}</div><div className="chip-lbl">{T.total}</div></div>
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

      <div className="sec-head" style={{marginTop:8}}><h2>{T.paddocks}</h2></div>
      {paddocks.map(p=>(
        <PaddockCard key={p.id} p={p} role={role}
          onDelete={role==="admin"
            ? ()=>{if(confirm(`${p.name} verwyder?`))setPaddocks(prev=>prev.filter(x=>x.id!==p.id));}
            : undefined}
        />
      ))}

      {events.length>0 && (
        <>
          <div className="sec-head" style={{marginTop:18}}><h2>{T.recentActivity}</h2></div>
          <div className="card">{events.slice(0,5).map(ev=><EventRow key={ev.id} ev={ev}/>)}</div>
        </>
      )}
    </>
  );
}

// ── Paddock Card ──────────────────────────────────────────────────────────────
function PaddockCard({ p, role, onDelete, onReset }) {
  const days = daysSince(p.arrivedAt);
  const hasSheep = totalCat(p.sheep)>0;
  const hasGoats = totalCat(p.goats)>0;
  const gradeClass = days===null?"":days<7?"graze-ok":days<14?"graze-warn":"graze-high";
  const gradeLabel = days===null?"": `${days} ${T.daysInPaddock}${days>=14?" "+T.considerMoving:days>=7?" "+T.monitor:" "+T.okStatus}`;

  return (
    <div className="card" style={{marginBottom:10}}>
      <div className="card-header">
        <div className="card-title">{p.name}</div>
        {role==="admin" && (onDelete||onReset) && (
          <div className="admin-actions">
            {onReset  && <button className="btn btn-ghost btn-sm" onClick={onReset}>📊 {T.setNumbers}</button>}
            {onDelete && <button className="btn btn-ghost btn-sm" style={{color:"var(--rust)"}} onClick={onDelete}>{T.delete}</button>}
          </div>
        )}
      </div>

      {hasSheep && (
        <div style={{marginBottom:8}}>
          <div style={{fontSize:".78rem",fontWeight:700,color:"var(--olive)",marginBottom:4}}>🐑 {T.sheep}</div>
          <div className="stats">
            {CATS.map(c=>(
              <div key={c} className="stat">
                <div className="stat-val sheep-c">{p.sheep[c]}</div>
                <div className="stat-lbl">{CATLABEL[c]}</div>
              </div>
            ))}
            <div className="stat" style={{gridColumn:"span 2"}}>
              <div className="stat-val">{totalCat(p.sheep)}</div>
              <div className="stat-lbl">{T.total}</div>
            </div>
          </div>
        </div>
      )}

      {hasGoats && (
        <div>
          <div style={{fontSize:".78rem",fontWeight:700,color:"var(--amber)",marginBottom:4}}>🐐 {T.goats}</div>
          <div className="stats">
            {CATS.map(c=>(
              <div key={c} className="stat">
                <div className="stat-val goats-c">{p.goats[c]}</div>
                <div className="stat-lbl">{CATLABEL[c]}</div>
              </div>
            ))}
            <div className="stat" style={{gridColumn:"span 2"}}>
              <div className="stat-val">{totalCat(p.goats)}</div>
              <div className="stat-lbl">{T.total}</div>
            </div>
          </div>
        </div>
      )}

      {!hasSheep && !hasGoats && (
        <div style={{color:"var(--muted)",fontSize:".85rem",padding:"6px 0"}}>Geen diere tans</div>
      )}

      {(hasSheep||hasGoats) && days!==null && (
        <div className={`graze-badge ${gradeClass}`}>🌿 {gradeLabel}</div>
      )}
      {p.paddockCondition!==null && p.paddockCondition!==undefined && (
        <div style={{marginTop:8}}><ConditionBar pct={p.paddockCondition}/></div>
      )}
      {p.arrivedAt && (hasSheep||hasGoats) && (
        <div style={{fontSize:".72rem",color:"var(--muted)",marginTop:4}}>{T.arrivedOn} {fmtDate(p.arrivedAt)}</div>
      )}
    </div>
  );
}

// ── Paddocks page ─────────────────────────────────────────────────────────────
function Paddocks({ paddocks, setPaddocks, role, addEvent }) {
  const [addModal, setAddModal] = useState(false);
  const [name,     setName]     = useState("");
  const [resetP,   setResetP]   = useState(null);
  const [resetSh,  setResetSh]  = useState(emptyCat());
  const [resetGo,  setResetGo]  = useState(emptyCat());

  const addPaddock = () => {
    if(!name.trim()) return;
    setPaddocks(prev=>[...prev,{id:uid(),name:name.trim(),
      sheep:emptyCat(),goats:emptyCat(),arrivedAt:null,paddockCondition:null,
      conditionScores:{sheep:emptyScores(),goats:emptyScores()}}]);
    setName(""); setAddModal(false);
  };

  const openReset = (p) => { setResetP(p); setResetSh({...p.sheep}); setResetGo({...p.goats}); };

  const saveReset = () => {
    if(!resetP) return;
    const newTotal = totalCat(resetSh)+totalCat(resetGo);
    addEvent({type:"stockTake", paddock:resetP.id, paddockName:resetP.name,
      before:{sheep:{...resetP.sheep}, goats:{...resetP.goats}},
      after:{sheep:{...resetSh}, goats:{...resetGo}}});
    setPaddocks(prev=>prev.map(p=>p.id===resetP.id
      ? {...p, sheep:{...resetSh}, goats:{...resetGo},
         arrivedAt: newTotal>0 ? (p.arrivedAt || nowISO()) : null} : p));
    setResetP(null);
  };

  return (
    <>
      <div className="sec-head">
        <h2>{T.paddocks}</h2>
        {role==="admin" && <button className="btn btn-primary btn-sm" onClick={()=>setAddModal(true)}>+ {T.add}</button>}
      </div>
      {paddocks.length===0 && <div className="empty"><div className="empty-icon">📍</div><p>{T.noPaddocks}</p></div>}
      {paddocks.map(p=>(
        <PaddockCard key={p.id} p={p} role={role}
          onDelete={()=>{if(confirm(`${p.name} verwyder?`))setPaddocks(prev=>prev.filter(x=>x.id!==p.id));}}
          onReset={()=>openReset(p)}
        />
      ))}

      {addModal && (
        <div className="overlay" onClick={()=>setAddModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <h2>{T.newPaddock}</h2>
            <div className="form-group">
              <label className="form-label">{T.paddockName}</label>
              <input className="form-input" value={name} onChange={e=>setName(e.target.value)}
                placeholder="bv. Westelike Kamp" autoFocus/>
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
            <CategoryGrid label={`🐑 ${T.sheep}`} values={resetSh}
              onChange={(c,v)=>setResetSh(prev=>({...prev,[c]:Number(v)||0}))}/>
            <CategoryGrid label={`🐐 ${T.goats}`} values={resetGo}
              onChange={(c,v)=>setResetGo(prev=>({...prev,[c]:Number(v)||0}))}/>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={saveReset}>{T.save}</button>
              <button className="btn btn-ghost" onClick={()=>setResetP(null)}>{T.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Transaksies ───────────────────────────────────────────────────────────────
function Transaksies({ paddocks, setPaddocks, addEvent }) {
  const [type,       setType]       = useState("bought");
  const [paddock,    setPaddock]    = useState("");
  const [moveSh,     setMoveSh]     = useState(emptyCat());
  const [moveGo,     setMoveGo]     = useState(emptyCat());
  const [sheepLambs, setSheepLambs] = useState("");
  const [goatLambs,  setGoatLambs]  = useState("");
  const [notes,      setNotes]      = useState("");
  const [saved,      setSaved]      = useState(false);

  const isNewLambs = type==="newLambs";
  const fromP = paddocks.find(p=>p.id===paddock);
  const totalAnimals = isNewLambs
    ? (Number(sheepLambs)||0)+(Number(goatLambs)||0)
    : totalCat(moveSh)+totalCat(moveGo);
  const valid = paddock && totalAnimals>0;

  const reset = () => {
    setPaddock(""); setMoveSh(emptyCat()); setMoveGo(emptyCat());
    setSheepLambs(""); setGoatLambs(""); setNotes("");
  };

  const submit = () => {
    if(!valid) return;
    const paddockName = fromP?.name;
    const ts = nowISO();

    if(isNewLambs) {
      const sl = Number(sheepLambs)||0, gl = Number(goatLambs)||0;
      setPaddocks(prev=>prev.map(p=>{
        if(p.id!==paddock) return p;
        const wasEmpty = totalCat(p.sheep)+totalCat(p.goats)===0;
        return {...p, sheep:{...p.sheep,lambs:(p.sheep.lambs||0)+sl},
          goats:{...p.goats,lambs:(p.goats.lambs||0)+gl},
          arrivedAt: wasEmpty&&(sl+gl)>0 ? ts : p.arrivedAt};
      }));
      addEvent({type:"newLambs", paddock, paddockName, sheepLambs:sl, goatLambs:gl, notes});
    } else if(type==="bought") {
      setPaddocks(prev=>prev.map(p=>{
        if(p.id!==paddock) return p;
        const wasEmpty = totalCat(p.sheep)+totalCat(p.goats)===0;
        return {...p, sheep:addCat(p.sheep,moveSh), goats:addCat(p.goats,moveGo),
          arrivedAt: wasEmpty ? ts : p.arrivedAt};
      }));
      addEvent({type:"bought", paddock, paddockName, sheep:moveSh, goats:moveGo, notes});
    } else {
      setPaddocks(prev=>prev.map(p=>{
        if(p.id!==paddock) return p;
        const newSheep=subCat(p.sheep,moveSh), newGoats=subCat(p.goats,moveGo);
        const isEmpty=totalCat(newSheep)+totalCat(newGoats)===0;
        return {...p, sheep:newSheep, goats:newGoats, arrivedAt: isEmpty?null:p.arrivedAt};
      }));
      addEvent({type:"sold", paddock, paddockName, sheep:moveSh, goats:moveGo, notes});
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
          <label className="form-label">{T.paddock}</label>
          <select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}>
            <option value="">{T.select}</option>
            {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {isNewLambs ? (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">🐑 {T.sheepLambs}</label>
              <input className="form-input" type="number" min="0" value={sheepLambs}
                onChange={e=>setSheepLambs(e.target.value)} placeholder="0"/>
            </div>
            <div className="form-group">
              <label className="form-label">🐐 {T.goatLambs}</label>
              <input className="form-input" type="number" min="0" value={goatLambs}
                onChange={e=>setGoatLambs(e.target.value)} placeholder="0"/>
            </div>
          </div>
        ) : (
          <>
            <CategoryGrid label={`🐑 ${T.sheep}`} values={moveSh}
              onChange={(c,v)=>setMoveSh(prev=>({...prev,[c]:Number(v)||0}))}
              max={type==="sold"?fromP?.sheep:undefined}/>
            <CategoryGrid label={`🐐 ${T.goats}`} values={moveGo}
              onChange={(c,v)=>setMoveGo(prev=>({...prev,[c]:Number(v)||0}))}
              max={type==="sold"?fromP?.goats:undefined}/>
          </>
        )}
        <div className="form-group">
          <label className="form-label">{T.notes}</label>
          <textarea className="form-textarea" rows={2} value={notes}
            onChange={e=>setNotes(e.target.value)} placeholder="Enige notas…"/>
        </div>
        <button className={`btn btn-full ${btnClass}`} onClick={submit} disabled={!valid}>
          {saved ? T.transactionSaved : T.recordTransaction}
        </button>
      </div>
      {fromP && (totalCat(fromP.sheep)+totalCat(fromP.goats)>0) && (
        <div className="card" style={{marginTop:10,background:"var(--bg)"}}>
          <div style={{fontSize:".8rem",color:"var(--muted)",marginBottom:6}}>{T.currentStock} {fromP.name}</div>
          <div className="stats">
            {CATS.map(c=>(
              <div key={c} className="stat">
                <div style={{fontSize:".7rem",color:"var(--muted)"}}>{CATLABEL[c]}</div>
                <div className="stat-val sheep-c">{fromP.sheep[c]}</div>
                <div className="stat-val goats-c" style={{fontSize:".9rem"}}>{fromP.goats[c]}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Bewegings ─────────────────────────────────────────────────────────────────
function Bewegings({ paddocks, setPaddocks, addEvent, applyExtra }) {
  const [from,  setFrom]  = useState("");
  const [to,    setTo]    = useState("");
  const [moveSh,setMoveSh]= useState(emptyCat());
  const [moveGo,setMoveGo]= useState(emptyCat());
  const [notes, setNotes] = useState("");
  const [extra, setExtra] = useState(emptyExtra());
  const [saved, setSaved] = useState(false);
  const [err,   setErr]   = useState("");

  const fromP = paddocks.find(p=>p.id===from);
  const valid = from && to && from!==to && (totalCat(moveSh)+totalCat(moveGo)>0);

  const submit = () => {
    if(!valid) return;
    // ── Strict stock validation — cannot move more than exists ──
    for(const c of CATS) {
      if((moveSh[c]||0) > (fromP?.sheep[c]||0))
        return setErr(`Te veel skape (${CATLABEL[c]}): slegs ${fromP?.sheep[c]||0} beskikbaar`);
      if((moveGo[c]||0) > (fromP?.goats[c]||0))
        return setErr(`Te veel bokke (${CATLABEL[c]}): slegs ${fromP?.goats[c]||0} beskikbaar`);
    }
    setErr("");
    const ts = nowISO();
    const fromName = paddocks.find(p=>p.id===from)?.name;
    const toName   = paddocks.find(p=>p.id===to)?.name;
    setPaddocks(prev=>prev.map(p=>{
      if(p.id===from) return {...p,sheep:subCat(p.sheep,moveSh),goats:subCat(p.goats,moveGo)};
      if(p.id===to)   return {...p,sheep:addCat(p.sheep,moveSh),goats:addCat(p.goats,moveGo),arrivedAt:ts,
        paddockCondition:extra.paddockCond!==null?extra.paddockCond:p.paddockCondition};
      return p;
    }));
    addEvent({type:"movement",from,to,fromName,toName,sheep:moveSh,goats:moveGo,notes,
      scores:extra.scores,paddockCond:extra.paddockCond,observations:extra.observations});
    applyExtra(extra, from);
    setFrom("");setTo("");setMoveSh(emptyCat());setMoveGo(emptyCat());setNotes("");setExtra(emptyExtra());
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  return (
    <>
      <div className="sec-head"><h2>{T.movements}</h2></div>
      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{T.fromPaddock}</label>
            <select className="form-select" value={from} onChange={e=>setFrom(e.target.value)}>
              <option value="">{T.select}</option>
              {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{T.toPaddock}</label>
            <select className="form-select" value={to} onChange={e=>setTo(e.target.value)}>
              <option value="">{T.select}</option>
              {paddocks.filter(p=>p.id!==from).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <CategoryGrid label={`🐑 ${T.sheep}`} values={moveSh}
          onChange={(c,v)=>setMoveSh(prev=>({...prev,[c]:Number(v)||0}))} max={fromP?.sheep}/>
        <CategoryGrid label={`🐐 ${T.goats}`} values={moveGo}
          onChange={(c,v)=>setMoveGo(prev=>({...prev,[c]:Number(v)||0}))} max={fromP?.goats}/>
        <div className="form-group">
          <label className="form-label">{T.notes}</label>
          <textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Enige notas…"/>
        </div>
        <AdditionalRecords extra={extra} setExtra={setExtra} />
        {err && <div style={{color:"var(--rust)",fontSize:".85rem",margin:"8px 0",fontWeight:600}}>⚠️ {err}</div>}
        <button className="btn btn-sky btn-full" onClick={submit} disabled={!valid}>
          {saved ? T.movementSaved : T.recordMovement}
        </button>
      </div>
      {fromP && (
        <div className="card" style={{marginTop:10,background:"var(--bg)"}}>
          <div style={{fontSize:".8rem",color:"var(--muted)",marginBottom:6}}>{T.currentStock} {fromP.name}</div>
          <div className="stats">
            {CATS.map(c=>(
              <div key={c} className="stat">
                <div style={{fontSize:".7rem",color:"var(--muted)"}}>{CATLABEL[c]}</div>
                <div className="stat-val sheep-c">{fromP.sheep[c]}</div>
                <div className="stat-val goats-c" style={{fontSize:".9rem"}}>{fromP.goats[c]}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Verliese ──────────────────────────────────────────────────────────────────
function Verliese({ paddocks, setPaddocks, addEvent }) {
  const [type,    setType]    = useState("death");
  const [paddock, setPaddock] = useState("");
  const [sheep,   setSheep]   = useState(emptyCat());
  const [goats,   setGoats]   = useState(emptyCat());
  const [cause,   setCause]   = useState("");
  const [notes,   setNotes]   = useState("");
  const [saved,   setSaved]   = useState(false);
  const [err,     setErr]     = useState("");

  const fromP = paddocks.find(p=>p.id===paddock);
  const valid = paddock && (totalCat(sheep)+totalCat(goats)>0);

  const submit = () => {
    if(!valid) return;
    // ── Strict stock validation — cannot lose more than exists ──
    for(const c of CATS) {
      if((sheep[c]||0) > (fromP?.sheep[c]||0))
        return setErr(`Te veel skape (${CATLABEL[c]}): slegs ${fromP?.sheep[c]||0} beskikbaar`);
      if((goats[c]||0) > (fromP?.goats[c]||0))
        return setErr(`Te veel bokke (${CATLABEL[c]}): slegs ${fromP?.goats[c]||0} beskikbaar`);
    }
    setErr("");
    const paddockName = paddocks.find(p=>p.id===paddock)?.name;
    setPaddocks(prev=>prev.map(p=>p.id===paddock
      ?{...p,sheep:subCat(p.sheep,sheep),goats:subCat(p.goats,goats)}:p));
    addEvent({type, paddock, paddockName, sheep, goats, cause, notes});
    setPaddock("");setSheep(emptyCat());setGoats(emptyCat());setCause("");setNotes("");
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  return (
    <>
      <div className="sec-head"><h2>{T.losses}</h2></div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button className={`btn btn-sm ${type==="death"?"btn-rust":"btn-ghost"}`} onClick={()=>setType("death")}>☠️ {T.death}</button>
        <button className={`btn btn-sm ${type==="lost"?"btn-amber":"btn-ghost"}`} onClick={()=>setType("lost")}>🔍 {T.lost}</button>
      </div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">{T.paddock}</label>
          <select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}>
            <option value="">{T.select}</option>
            {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <CategoryGrid label={`🐑 ${T.sheep}`} values={sheep} onChange={(c,v)=>setSheep(prev=>({...prev,[c]:Number(v)||0}))}/>
        <CategoryGrid label={`🐐 ${T.goats}`} values={goats} onChange={(c,v)=>setGoats(prev=>({...prev,[c]:Number(v)||0}))}/>
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
        <div className="form-group">
          <label className="form-label">{T.notes}</label>
          <textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Bykomende besonderhede…"/>
        </div>
        {err && <div style={{color:"var(--rust)",fontSize:".85rem",margin:"8px 0",fontWeight:600}}>⚠️ {err}</div>}
        <button className={`btn btn-full ${type==="death"?"btn-rust":"btn-amber"}`} onClick={submit} disabled={!valid}>
          {saved ? T.lossSaved : T.lossRecord}
        </button>
      </div>
    </>
  );
}

// ── Behandelings ──────────────────────────────────────────────────────────────
function Behandelings({ paddocks, setPaddocks, treatments, setTreatments, addEvent, applyExtra }) {
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
  const [saved,  setSaved]   = useState(false);

  const valid = paddock && tname.trim() && Number(count)>0;

  const submit = () => {
    if(!valid) return;
    const paddockName = paddocks.find(p=>p.id===paddock)?.name;
    const rec = {id:uid(),ts:nowISO(),paddock,paddockName,species,category:cat,
      count:Number(count),treatment:tname,dosage,method,administeredBy:adminBy,notes,
      scores:extra.scores,paddockCond:extra.paddockCond,observations:extra.observations};
    setTreatments(prev=>[rec,...prev]);
    addEvent({type:"treatment",paddock,paddockName,species,category:cat,
      count:Number(count),treatment:tname,method,administeredBy:adminBy});
    applyExtra(extra, paddock);
    setP("");setSpecies("sheep");setCat("ewes");setCount("");
    setTname("");setDosage("");setMethod("");setAdminBy("");setNotes("");setExtra(emptyExtra());
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  return (
    <>
      <div className="sec-head"><h2>{T.treatments}</h2></div>
      <div className="card">
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
              <option value="both">{T.both}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{T.category}</label>
            <select className="form-select" value={cat} onChange={e=>setCat(e.target.value)}>
              {CATS.map(c=><option key={c} value={c}>{CATLABEL[c]}</option>)}
              <option value="all">{T.all}</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{T.countTreated}</label>
          <input className="form-input" type="number" min="1" value={count} onChange={e=>setCount(e.target.value)} placeholder="0"/>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{T.treatmentName}</label>
            <input className="form-input" value={tname} onChange={e=>setTname(e.target.value)} placeholder="bv. Ivermectien"/>
          </div>
          <div className="form-group">
            <label className="form-label">{T.dosage}</label>
            <input className="form-input" value={dosage} onChange={e=>setDosage(e.target.value)} placeholder="bv. 1ml/10kg"/>
          </div>
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
          <div className="form-group">
            <label className="form-label">{T.administeredBy}</label>
            <input className="form-input" value={adminBy} onChange={e=>setAdminBy(e.target.value)} placeholder="Naam…"/>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{T.notes}</label>
          <textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas…"/>
        </div>
        <AdditionalRecords extra={extra} setExtra={setExtra} />
        <button className="btn btn-teal btn-full" onClick={submit} disabled={!valid}>
          {saved ? T.treatmentSaved : T.recordTreatment}
        </button>
      </div>

      {treatments.length>0 && (
        <>
          <div className="sec-head" style={{marginTop:18}}><h2>Rekords</h2></div>
          {treatments.map(tr=>(
            <div className="card" key={tr.id}>
              <div className="card-header">
                <div>
                  <div className="card-title">💊 {tr.treatment}</div>
                  <div style={{fontSize:".82rem",color:"var(--muted)"}}>
                    {tr.count} × {tr.species==="sheep"?`🐑 ${T.sheep}`:tr.species==="goats"?`🐐 ${T.goats}`:T.both} — {CATLABEL[tr.category]||T.all}
                  </div>
                  <div style={{fontSize:".8rem",color:"var(--muted)"}}>📍 {tr.paddockName}</div>
                </div>
              </div>
              {tr.dosage && <div style={{fontSize:".82rem",color:"var(--muted)"}}>{T.dosage}: {tr.dosage}{tr.method?` · ${tr.method}`:""}</div>}
              {tr.administeredBy && <div style={{fontSize:".82rem",color:"var(--muted)"}}>{T.administeredBy}: {tr.administeredBy}</div>}
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
  const [modal,  setModal]  = useState(false);
  const [title,  setTitle]  = useState(""); const [assign, setAssign] = useState("");
  const [paddock,setPaddock]= useState(""); const [notes,  setNotes]  = useState("");
  const [due,    setDue]    = useState(""); const [filter, setFilter] = useState("all");
  const [photo,  setPhoto]  = useState(null);
  const fileRef = useRef();

  const add = () => {
    if(!title.trim()) return;
    setTasks(prev=>[{id:uid(),title:title.trim(),assignedTo:assign,paddock,notes,dueDate:due,
      status:"pending",createdAt:nowISO(),photo},...prev]);
    addEvent({type:"task",action:"created",taskTitle:title,assignedTo:assign,
      paddockName:paddocks.find(p=>p.id===paddock)?.name});
    setTitle("");setAssign("");setPaddock("");setNotes("");setDue("");setPhoto(null);setModal(false);
  };

  const complete = (id) => {
    setTasks(prev=>prev.map(t=>t.id===id?{...t,status:"done",doneAt:nowISO()}:t));
    const t=tasks.find(x=>x.id===id);
    if(t) addEvent({type:"task",action:"completed",taskTitle:t.title});
  };

  const shown = tasks.filter(t=>
    filter==="all"?true:filter==="overdue"?(isOverdue(t.dueDate)&&t.status==="pending"):t.status===filter);
  const ovCount = tasks.filter(t=>t.status==="pending"&&isOverdue(t.dueDate)).length;

  return (
    <>
      <div className="sec-head">
        <h2>{T.tasks}</h2>
        {role==="admin"&&<button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}>+ {T.add}</button>}
      </div>
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
                  {t.dueDate&&<div style={{fontSize:".8rem",marginTop:2,color:od?"var(--rust)":"var(--muted)",fontWeight:od?700:400}}>
                    {od?"⚠️ Agterstallig — was gesperd ":"Sperdatum: "}{fmtDate(t.dueDate)}</div>}
                </div>
                <span className={`pill ${t.status==="done"?"pill-done":od?"pill-overdue":"pill-pending"}`}>
                  {t.status==="done"?"✅ "+T.done:od?"⚠️ "+T.overdue:"⏳ "+T.pending}
                </span>
              </div>
              {t.notes&&<p style={{fontSize:".85rem",color:"var(--muted)",marginBottom:8}}>{t.notes}</p>}
              {t.photo&&<img src={t.photo} alt="taak" className="photo-preview"/>}
              <div style={{fontSize:".73rem",color:"var(--muted)",marginTop:6,marginBottom:t.status==="pending"?8:0}}>
                {fmtDate(t.createdAt)}{t.doneAt?` · Klaar ${fmtTime(t.doneAt)}`:""}
              </div>
              {t.status==="pending"&&(
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-done btn-sm" onClick={()=>complete(t.id)}>{T.markDone}</button>
                  {role==="admin"&&<button className="btn btn-ghost btn-sm" style={{color:"var(--rust)"}}
                    onClick={()=>{if(confirm("Taak verwyder?"))setTasks(prev=>prev.filter(x=>x.id!==t.id));}}>❌</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {modal&&(
        <div className="overlay" onClick={()=>setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <h2>{T.assignTask}</h2>
            <div className="form-group"><label className="form-label">{T.taskDesc}</label>
              <input className="form-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="bv. Kontroleer watertrôe" autoFocus/></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">{T.assignTo}</label>
                <input className="form-input" value={assign} onChange={e=>setAssign(e.target.value)} placeholder="Werker naam"/></div>
              <div className="form-group"><label className="form-label">{T.dueDate}</label>
                <input className="form-input" type="date" value={due} min={todayStr()} onChange={e=>setDue(e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">{T.paddock}</label>
              <select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}>
                <option value="">{T.noSpecific}</option>
                {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">{T.notes}</label>
              <textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ekstra besonderhede…"/></div>
            <div className="form-group"><label className="form-label">Foto</label>
              <div className="photo-upload" onClick={()=>fileRef.current?.click()}>
                {photo?<img src={photo} alt="v" style={{maxHeight:90,borderRadius:6}}/>:T.addPhoto}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
                onChange={async e=>{const f=e.target.files?.[0];if(f)setPhoto(await compressImage(f));}}/></div>
            <button className="btn btn-primary btn-full" onClick={add}>{T.assignTask}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Probleme ──────────────────────────────────────────────────────────────────
function Probleme({ issues, setIssues, paddocks, addEvent }) {
  const [modal,   setModal]   = useState(false);
  const [title,   setTitle]   = useState(""); const [paddock,setPaddock]=useState("");
  const [type,    setType]    = useState(""); const [notes,  setNotes]  = useState("");
  const [photo,   setPhoto]   = useState(null);
  const [filter,  setFilter]  = useState("open");
  const [viewing, setViewing] = useState(null);
  const fileRef = useRef();

  const add = () => {
    if(!title.trim()) return;
    const iss={id:uid(),title:title.trim(),paddock,type,notes,photo,status:"open",createdAt:nowISO()};
    setIssues(prev=>[iss,...prev]);
    addEvent({type:"issue",action:"reported",issueTitle:title,issueType:type,
      paddockName:paddocks.find(p=>p.id===paddock)?.name});
    setTitle("");setPaddock("");setType("");setNotes("");setPhoto(null);setModal(false);
  };

  const shown=issues.filter(i=>filter==="all"?true:i.status===filter);

  return (
    <>
      <div className="sec-head"><h2>{T.issues}
        </h2><button className="btn btn-amber btn-sm" onClick={()=>setModal(true)}>+ {T.report}</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {["open","resolved","all"].map(f=>(
          <button key={f} className={`btn btn-sm ${filter===f?"btn-primary":"btn-ghost"}`} onClick={()=>setFilter(f)}>
            {f==="open"?T.open:f==="resolved"?T.resolved:T.all}
          </button>
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
              <span className={`pill ${iss.status==="open"?"pill-open":"pill-resolved"}`}>
                {iss.status==="open"?"🔴 "+T.open:"✅ "+T.resolved}
              </span>
            </div>
            {iss.notes&&<p style={{fontSize:".85rem",color:"var(--muted)",marginBottom:8}}>{iss.notes}</p>}
            {iss.photo&&<img src={iss.photo} alt="p" className="photo-preview" style={{cursor:"pointer"}} onClick={()=>setViewing(iss.photo)}/>}
            <div style={{fontSize:".73rem",color:"var(--muted)",marginTop:6,marginBottom:iss.status==="open"?8:0}}>
              {fmtTime(iss.createdAt)}{iss.resolvedAt?` · Opgelos ${fmtTime(iss.resolvedAt)}`:""}
            </div>
            {iss.status==="open"&&(
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-done btn-sm" onClick={()=>{
                  setIssues(prev=>prev.map(i=>i.id===iss.id?{...i,status:"resolved",resolvedAt:nowISO()}:i));
                  addEvent({type:"issue",action:"resolved",issueTitle:iss.title});
                }}>{T.markResolved}</button>
                <button className="btn btn-ghost btn-sm" style={{color:"var(--rust)"}}
                  onClick={()=>{if(confirm("Verwyder?"))setIssues(prev=>prev.filter(i=>i.id!==iss.id));}}>❌</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {viewing&&<div className="overlay" onClick={()=>setViewing(null)} style={{alignItems:"center",justifyContent:"center"}}>
        <img src={viewing} alt="vol" style={{maxWidth:"95vw",maxHeight:"90vh",borderRadius:12}} onClick={e=>e.stopPropagation()}/></div>}
      {modal&&(
        <div className="overlay" onClick={()=>setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/><h2>{T.reportIssue}</h2>
            <div className="form-group"><label className="form-label">Beskrywing</label>
              <input className="form-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="bv. Heining gebreek" autoFocus/></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">{T.issueType}</label>
                <select className="form-select" value={type} onChange={e=>setType(e.target.value)}>
                  <option value="">Algemeen</option>
                  <option value={T.fenceGate}>{T.fenceGate}</option>
                  <option value={T.waterSupply}>{T.waterSupply}</option>
                  <option value={T.animalHealth}>{T.animalHealth}</option>
                  <option value={T.predator}>{T.predator}</option>
                  <option value={T.equipment}>{T.equipment}</option>
                  <option value={T.feedPasture}>{T.feedPasture}</option>
                  <option value={T.other}>{T.other}</option>
                </select></div>
              <div className="form-group"><label className="form-label">{T.paddock}</label>
                <select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}>
                  <option value="">{T.noSpecific}</option>
                  {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
            </div>
            <div className="form-group"><label className="form-label">{T.notes}</label>
              <textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Meer besonderhede…"/></div>
            <div className="form-group"><label className="form-label">Foto</label>
              <div className="photo-upload" onClick={()=>fileRef.current?.click()}>
                {photo?<img src={photo} alt="v" style={{maxHeight:90,borderRadius:6}}/>:T.addPhoto}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}}
                onChange={async e=>{const f=e.target.files?.[0];if(f)setPhoto(await compressImage(f));}}/></div>
            <button className="btn btn-amber btn-full" onClick={add}>{T.reportIssue}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Geskiedenis ───────────────────────────────────────────────────────────────
const HISTORY_FILTERS = [
  {id:"all",label:"Almal"},{id:"movement",label:"Bewegings"},
  {id:"bought",label:"Gekoop"},{id:"sold",label:"Verkoop"},
  {id:"newLambs",label:"Nuwe Lammers"},{id:"death",label:"Sterfte"},
  {id:"lost",label:"Vermis"},{id:"treatment",label:"Behandelings"},
  {id:"task",label:"Take"},{id:"issue",label:"Probleme"},
  {id:"stockTake",label:"Voorraadopname"},
];

function Geskiedenis({ events }) {
  const [filter,setFilter]=useState("all");
  const shown=events.filter(e=>filter==="all"?true:e.type===filter);
  return (
    <>
      <div className="sec-head"><h2>{T.history}</h2></div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {HISTORY_FILTERS.map(f=>(
          <button key={f.id} className={`btn btn-sm ${filter===f.id?"btn-primary":"btn-ghost"}`}
            onClick={()=>setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      {shown.length===0&&<div className="empty"><div className="empty-icon">📋</div><p>{T.noEvents}</p></div>}
      {shown.length>0&&<div className="card">{shown.map(ev=><EventRow key={ev.id} ev={ev}/>)}</div>}
    </>
  );
}

// ── Uitvoer ───────────────────────────────────────────────────────────────────
function Uitvoer({ paddocks, tasks, issues, events, treatments }) {
  const dl = (rows,fn) => {
    const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=fn;a.click();
  };
  const totS=paddocks.reduce((s,p)=>s+totalCat(p.sheep),0);
  const totG=paddocks.reduce((s,p)=>s+totalCat(p.goats),0);
  const deaths=events.filter(e=>e.type==="death");
  const lost=events.filter(e=>e.type==="lost");
  const bought=events.filter(e=>e.type==="bought");
  const sold=events.filter(e=>e.type==="sold");
  const newL=events.filter(e=>e.type==="newLambs");

  return (
    <>
      <div className="sec-head"><h2>{T.export}</h2></div>
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title" style={{marginBottom:10}}>📊 {T.farmSummary}</div>
        <table className="data-table"><tbody>
          <tr><td>Totale Skape</td><td><strong>{totS}</strong></td></tr>
          <tr><td>Totale Bokke</td><td><strong>{totG}</strong></td></tr>
          <tr><td>Totale Diere</td><td><strong>{totS+totG}</strong></td></tr>
          <tr><td>Diere Gekoop</td><td>{bought.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>Diere Verkoop</td><td>{sold.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>Nuwe Lammers</td><td>{newL.reduce((s,e)=>s+(e.sheepLambs||0)+(e.goatLambs||0),0)}</td></tr>
          <tr><td>Sterftes Rekordeer</td><td>{deaths.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>Vermis Rekordeer</td><td>{lost.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>Behandelings</td><td>{treatments.length}</td></tr>
          <tr><td>Hangende Take</td><td>{tasks.filter(t=>t.status==="pending").length}</td></tr>
          <tr><td>Oop Probleme</td><td>{issues.filter(i=>i.status==="open").length}</td></tr>
          <tr><td>Totale Gebeure</td><td>{events.length}</td></tr>
        </tbody></table>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title" style={{marginBottom:10}}>📍 Kamp Diere</div>
        <table className="data-table">
          <thead><tr><th>Kamp</th><th>Ooie</th><th>Lam</th><th>Ram</th><th>Ham</th><th>Tot🐑</th><th>Tot🐐</th><th>Dae</th></tr></thead>
          <tbody>{paddocks.map(p=>(
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.sheep.ewes}</td><td>{p.sheep.lambs}</td><td>{p.sheep.rams}</td><td>{p.sheep.wethers}</td>
              <td><strong>{totalCat(p.sheep)}</strong></td>
              <td><strong>{totalCat(p.goats)}</strong></td>
              <td style={{color:(daysSince(p.arrivedAt)||0)>=14?"var(--rust)":(daysSince(p.arrivedAt)||0)>=7?"var(--amber)":"inherit"}}>
                {daysSince(p.arrivedAt)??"-"}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title" style={{marginBottom:12}}>⬇️ {T.downloadCSV}</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button className="btn btn-primary" onClick={()=>dl([
            ["Kamp","Ooie🐑","Lam🐑","Ram🐑","Ham🐑","Tot🐑","Ooie🐐","Lam🐐","Ram🐐","Ham🐐","Tot🐐","Dae","Kond%"],
            ...paddocks.map(p=>[p.name,p.sheep.ewes,p.sheep.lambs,p.sheep.rams,p.sheep.wethers,totalCat(p.sheep),
              p.goats.ewes,p.goats.lambs,p.goats.rams,p.goats.wethers,totalCat(p.goats),daysSince(p.arrivedAt)??'',p.paddockCondition??''])
          ],"kampe.csv")}>📍 Kamp Verslag</button>
          <button className="btn btn-teal" onClick={()=>dl([
            ["Datum","Kamp","Diere","Kategorie","Middel","Dosis","Metode","Toegedien Deur"],
            ...treatments.map(tr=>[fmtTime(tr.ts),tr.paddockName,
              tr.species==="sheep"?T.sheep:tr.species==="goats"?T.goats:T.both,
              CATLABEL[tr.category]||T.all,tr.treatment,tr.dosage,tr.method,tr.administeredBy])
          ],"behandelings.csv")}>💊 Behandelings Verslag</button>
          <button className="btn btn-sky" onClick={()=>dl([
            ["Taak","Wys toe","Kamp","Sperdatum","Status","Geskep","Klaar"],
            ...tasks.map(t=>[t.title,t.assignedTo,
              paddocks.find(p=>p.id===t.paddock)?.name??"",
              t.dueDate?fmtDate(t.dueDate):"",t.status,fmtDate(t.createdAt),t.doneAt?fmtTime(t.doneAt):""])
          ],"take.csv")}>✅ Take Verslag</button>
          <button className="btn btn-amber" onClick={()=>dl([
            ["Datum","Tipe","Besonderhede","Kamp"],
            ...events.map(ev=>{
              let det="",loc="";
              if(ev.type==="movement"){det=`Geskuif: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`;loc=`${ev.fromName}→${ev.toName}`;}
              else if(ev.type==="bought"){det=`Gekoop: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`;loc=ev.paddockName||"";}
              else if(ev.type==="sold"){det=`Verkoop: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`;loc=ev.paddockName||"";}
              else if(ev.type==="newLambs"){det=`Nuwe Lammers: ${ev.sheepLambs||0} skaapl, ${ev.goatLambs||0} bokl`;loc=ev.paddockName||"";}
              else if(ev.type==="death"){det=`Dood: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke${ev.cause?` (${ev.cause})`:""}`;loc=ev.paddockName||"";}
              else if(ev.type==="lost"){det=`Vermis: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`;loc=ev.paddockName||"";}
              else if(ev.type==="treatment"){det=`${ev.treatment} — ${ev.count} diere`;loc=ev.paddockName||"";}
              else if(ev.type==="stockTake"){det="Voorraadopname";loc=ev.paddockName||"";}
              else if(ev.type==="task"){det=`Taak ${ev.action}: ${ev.taskTitle}`;loc="";}
              else{det=`Probleem ${ev.action}: ${ev.issueTitle}`;loc=ev.paddockName||"";}
              return[fmtTime(ev.ts),ev.type,det,loc];
            })
          ],"geskiedenis.csv")}>📋 Volle Geskiedenis</button>
          <button className="btn btn-ghost" onClick={()=>window.print()}>🖨️ {T.printPage}</button>
        </div>
      </div>
    </>
  );
}

// ── Event Row ─────────────────────────────────────────────────────────────────
function EventRow({ ev }) {
  const configs = {
    movement:  {icon:"🔀",cls:"ev-move", title:`Geskuif: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`,meta:`${ev.fromName||""}→${ev.toName||""}${ev.notes?` · ${ev.notes}`:""}`},
    bought:    {icon:"🛒",cls:"ev-buy",  title:`Gekoop: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`, meta:ev.paddockName||""},
    sold:      {icon:"💰",cls:"ev-sell", title:`Verkoop: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`,meta:ev.paddockName||""},
    newLambs:  {icon:"🐣",cls:"ev-treat",title:`Nuwe Lammers: ${(ev.sheepLambs||0)+(ev.goatLambs||0)} lammers`,          meta:ev.paddockName||""},
    death:     {icon:"☠️",cls:"ev-death",title:`Sterfte: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`,meta:`${ev.paddockName||""}${ev.cause?` · ${ev.cause}`:""}`},
    lost:      {icon:"🔍",cls:"ev-lost", title:`Vermis: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`, meta:ev.paddockName||""},
    treatment: {icon:"💊",cls:"ev-treat",title:`Behandeling: ${ev.treatment||""} — ${ev.count||0} diere`,                 meta:`${ev.paddockName||""}${ev.method?` · ${ev.method}`:""}`},
    stockTake: {icon:"📊",cls:"ev-task", title:`Voorraadopname: ${ev.paddockName||""}`,                                   meta:""},
    task:      {icon:"✅",cls:"ev-task", title:`Taak ${ev.action==="completed"?"voltooi":"toegewys"}: ${ev.taskTitle||""}`,meta:ev.assignedTo?`→ ${ev.assignedTo}`:""},
    issue:     {icon:"⚠️",cls:"ev-issue",title:`Probleem ${ev.action==="resolved"?"opgelos":"gerapporteer"}: ${ev.issueTitle||""}`,meta:ev.paddockName||""},
  };
  const cfg=configs[ev.type]||{icon:"📝",cls:"ev-task",title:ev.type,meta:""};
  return (
    <div className="event-item">
      <div className={`event-icon ${cfg.cls}`}>{cfg.icon}</div>
      <div className="event-body">
        <div className="event-title">{cfg.title}</div>
        <div className="event-meta">{fmtTime(ev.ts)}{cfg.meta?` · ${cfg.meta}`:""}</div>
      </div>
    </div>
  );
}
