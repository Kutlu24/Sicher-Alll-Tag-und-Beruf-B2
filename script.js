// ═══════════════════════════════════════════════
//  SABİTLER & DURUM
// ═══════════════════════════════════════════════
const NOW        = Date.now();
const DAILY_GOAL = 10;
const LS_LEARNED = "m1_learned";
const LS_FAV     = "m1_fav";
const LS_DATE    = "m1_today_date";
const LS_COUNT   = "m1_today_count";

const KEY_KARTE   = "Veröffentlichungsdatum \n(Karte)";
const KEY_WORT    = "Wort";
const KEY_GRAMM   = "Grammatik\n(Artikel/Konjugation)";
const KEY_SENT    = "Beispiel Satz";
const KEY_KAPI    = "Kapitel";
const KEY_AUDIO   = "ses_dosyasi";
const KEY_AUDIO2  = "Audio Datei";

// Modul 1
let m1All      = [];
let m1Vocab    = [];   // yayınlanmış
let m1Session  = [];
let m1Index    = 0;
let m1Mode     = "flash";
let learnedSet = new Set();
let favSet     = new Set();
let todayCount = 0;

// Modul 2
const M2_COL   = { lesson:"Lektion", de:"Deutsch", sentence:"Beispiel Satz" };
const M2_LANGS = ["Turkisch","Englisch","Ukrainisch (Українська)","Arabisch (العربية)","Farsi (فارسی)","Kurdisch (Kurmancî)"];
let m2Vocab    = [];
let m2Session  = [];
let m2Index    = 0;
let m2Quiz     = false;
let m2Stats    = { correct:0, wrong:0 };

// ═══════════════════════════════════════════════
//  LOCAL STORAGE
// ═══════════════════════════════════════════════
function lsGet(k)  { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function lsSet(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

function loadProgress() {
  learnedSet = new Set(lsGet(LS_LEARNED) || []);
  favSet     = new Set(lsGet(LS_FAV) || []);
  const today = new Date().toDateString();
  if (lsGet(LS_DATE) !== today) { lsSet(LS_DATE, today); lsSet(LS_COUNT, 0); todayCount = 0; }
  else todayCount = lsGet(LS_COUNT) || 0;
}
function saveProgress() {
  lsSet(LS_LEARNED, [...learnedSet]);
  lsSet(LS_FAV,     [...favSet]);
  lsSet(LS_COUNT,   todayCount);
}

// ═══════════════════════════════════════════════
//  YÜKLEME
// ═══════════════════════════════════════════════
async function loadModul1() {
  try {
    const res = await fetch("modul1.json", { cache:"no-store" });
    if (!res.ok) throw new Error(res.status);
    m1All = await res.json();
    loadProgress();

    // Tarih filtresi: sadece Karte tarihi geçmiş olanlar
    m1Vocab = m1All.filter(r => {
      const ts = r[KEY_KARTE];
      return ts && ts <= NOW;
    });

    // Kapitel bilgisi
    const allK  = [...new Set(m1All.map(r => r[KEY_KAPI]).filter(Boolean))].sort((a,b)=>a-b);
    const openK = [...new Set(m1Vocab.map(r => r[KEY_KAPI]).filter(Boolean))].sort((a,b)=>a-b);

    setText("m1-words-display",  `${m1Vocab.length} Wörter verfügbar`);
    setText("m1-kapitel-info",   `${openK.length} von ${allK.length} Kapitel verfügbar`);
    setBtn ("m1-btn", "Starten →", false);

    buildMenu1();
  } catch(e) {
    console.error("M1:", e);
    setText("m1-words-display", "Ladefehler!");
    setText("load-hint", "modul1.json konnte nicht geladen werden. Prüfe ob alle Dateien im gleichen Ordner sind.");
  }
}

async function loadModul2() {
  try {
    const res = await fetch("sicher.csv", { cache:"no-store" });
    if (!res.ok) throw new Error(res.status);
    const txt = await res.text();
    const parsed = Papa.parse(txt, { header:true, skipEmptyLines:true, dynamicTyping:false });
    m2Vocab = (parsed.data || []).map(normM2).filter(r => r && r[M2_COL.de] && r[M2_COL.sentence]);

    setText("m2-words-display", `${m2Vocab.length} Wörter bereit`);
    setBtn ("m2-btn", "Starten →", false);
    buildMenu2();
  } catch(e) {
    console.error("M2:", e);
    setText("m2-words-display", "CSV Fehler!");
  }
}

function normM2(row) {
  const c = {};
  for (const k in row) { const key=(k||"").trim(); c[key]=typeof row[k]==="string"?row[k].replace(/\u00A0/g," ").trim():row[k]; }
  const n = parseInt(String(c[M2_COL.lesson]||"").trim(), 10);
  c[M2_COL.lesson] = isFinite(n) ? n : null;
  M2_LANGS.forEach(l => { if(typeof c[l]==="string") c[l]=c[l].trim(); });
  return c;
}

function buildMenu1() {
  const sel  = document.getElementById("f-unit");
  const sel2 = document.getElementById("f-part");
  if (!sel) return;
  const ks = [...new Set(m1Vocab.map(r=>r[KEY_KAPI]).filter(Boolean))].sort((a,b)=>a-b);
  [sel, sel2].forEach(s => {
    s.innerHTML = `<option value="all">Alle</option>`;
    ks.forEach(k => { const o=document.createElement("option"); o.value=String(k); o.innerText=`Kapitel ${k}`; s.appendChild(o); });
  });
}

function buildMenu2() {
  const sel = document.getElementById("m2-unit");
  if (!sel) return;
  sel.innerHTML = `<option value="all">Alle Lektionen</option>`;
  [...new Set(m2Vocab.map(v=>v[M2_COL.lesson]).filter(x=>isFinite(x)))].sort((a,b)=>a-b)
    .forEach(l => { const o=document.createElement("option"); o.value=String(l); o.innerText=`Lektion ${l}`; sel.appendChild(o); });
}

// ═══════════════════════════════════════════════
//  NAVİGASYON
// ═══════════════════════════════════════════════
function openTrainer(mod) {
  const vocab = mod===1 ? m1Vocab : m2Vocab;
  if (!vocab.length) { alert("Daten noch nicht geladen. Bitte warten."); return; }
  hide("page-menu");
  mod===1 ? (show("page-m1"), hide("page-m2")) : (hide("page-m1"), show("page-m2"));
  if (mod===1) { m1Mode="flash"; syncTabs(); initSession(); }
  else         { m2Quiz=false; show("m2-flash"); hide("m2-quiz"); setText("m2-toggle-btn","🎯 Quiz Modus"); m2Init(); }
}

function showMenu() {
  const a = document.getElementById("m1-audio");
  if (a) { a.pause(); a.src=""; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  show("page-menu"); hide("page-m1"); hide("page-m2");
}

// ═══════════════════════════════════════════════
//  MODUL 1 – OTURUM
// ═══════════════════════════════════════════════
function initSession() {
  const unit   = val("f-unit");
  const status = val("f-status");
  const search = (val("f-search")||"").toLowerCase();

  let list = unit==="all" ? [...m1Vocab] : m1Vocab.filter(r=>String(r[KEY_KAPI])===unit);
  if (status==="learned")   list = list.filter(r => learnedSet.has(r[KEY_WORT]));
  if (status==="unlearned") list = list.filter(r => !learnedSet.has(r[KEY_WORT]));
  if (status==="fav")       list = list.filter(r => favSet.has(r[KEY_WORT]));
  if (search) list = list.filter(r =>
    (r[KEY_WORT]||"").toLowerCase().includes(search) ||
    (r[KEY_SENT]||"").toLowerCase().includes(search)
  );

  m1Session = list;
  m1Index   = 0;

  if (m1Mode==="review") { renderReview(); return; }
  renderCard();
}

function doShuffle() { m1Session.sort(()=>Math.random()-.5); m1Index=0; renderCard(); }
function doReset() {
  if (!confirm("Alle Fortschritte zurücksetzen?")) return;
  learnedSet.clear(); favSet.clear(); todayCount=0; saveProgress(); initSession();
}
function doStats() {
  alert(`📊 Statistik\n\nGesamt: ${m1Vocab.length} Wörter\nGelernt: ${learnedSet.size}\nÜbrig: ${m1Vocab.length-learnedSet.size}\nFavoriten: ${favSet.size}\nHeute gelernt: ${todayCount} / ${DAILY_GOAL}`);
}

// ═══════════════════════════════════════════════
//  MODUL 1 – RENDER
// ═══════════════════════════════════════════════
function renderCard() {
  updateStats();

  if (!m1Session.length) {
    setText("fc-word", "Keine Wörter gefunden");
    setText("fc-grammar",""); setText("fc-badges",""); setText("fc-sentence","");
    return;
  }
  if (m1Index >= m1Session.length) m1Index = m1Session.length-1;
  if (m1Index < 0) m1Index = 0;

  const item = m1Session[m1Index];

  if (m1Mode==="flash") {
    setText("fc-word",     item[KEY_WORT]  || "");
    setText("fc-grammar",  item[KEY_GRAMM] || "");
    setText("fc-sentence", item[KEY_SENT]  || "");

    const k = item[KEY_KAPI];
    const badgeEl = document.getElementById("fc-badges");
    if (badgeEl) badgeEl.innerHTML = k
      ? `<span class="m1-badge">Lektion ${k}</span><span class="m1-badge">Teil ${k}</span>`
      : "";

    const favBtn = document.getElementById("fav-btn");
    if (favBtn) favBtn.textContent = favSet.has(item[KEY_WORT]) ? "★" : "☆";

    const audioEl = document.getElementById("m1-audio");
    if (audioEl) audioEl.src = item[KEY_AUDIO] || item[KEY_AUDIO2] || "";

    // Kartı sıfırla
    document.getElementById("m1-card-inner")?.classList.remove("flipped");

  } else if (m1Mode==="quiz") {
    setupQuiz(item);
  } else if (m1Mode==="write") {
    setupWrite(item);
  }
}

function updateStats() {
  const total    = m1Vocab.length;
  const learned  = learnedSet.size;
  const pct      = Math.min(100, Math.round(todayCount/DAILY_GOAL*100));
  setText("s-total",     total);
  setText("s-learned",   learned);
  setText("s-remaining", Math.max(0,total-learned));
  setText("s-fav",       favSet.size);
  setText("s-today",     todayCount);
  const fill = document.getElementById("s-fill");
  if (fill) fill.style.width = pct + "%";
}

// ═══════════════════════════════════════════════
//  MODUL 1 – FLASHCARD AKSİYONLAR
// ═══════════════════════════════════════════════
function doFlip() {
  const inner = document.getElementById("m1-card-inner");
  if (!inner) return;
  inner.classList.toggle("flipped");
  if (inner.classList.contains("flipped")) doAudio();
}

function doAudio() {
  const item = m1Session[m1Index];
  if (!item) return;
  const file = item[KEY_AUDIO] || item[KEY_AUDIO2] || "";
  if (file) {
    const a = document.getElementById("m1-audio");
    a.src = file; a.currentTime = 0;
    a.play().catch(() => tts(item[KEY_WORT]||""));
  } else {
    tts(item[KEY_WORT]||"");
  }
}

function tts(text) {
  if (!text || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE"; u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function doLearned() {
  const item = m1Session[m1Index];
  if (!item) return;
  if (!learnedSet.has(item[KEY_WORT])) {
    learnedSet.add(item[KEY_WORT]); todayCount++; saveProgress();
  }
  doNext();
}

function doFav() {
  const item = m1Session[m1Index];
  if (!item) return;
  const w = item[KEY_WORT];
  favSet.has(w) ? favSet.delete(w) : favSet.add(w);
  saveProgress();
  const favBtn = document.getElementById("fav-btn");
  if (favBtn) favBtn.textContent = favSet.has(w) ? "★" : "☆";
  updateStats();
}

function doNext() {
  m1Index++;
  if (m1Index >= m1Session.length) {
    alert(`🎉 Abschnitt beendet! ${m1Session.length} Wörter durchgegangen.`);
    m1Index = 0;
  }
  renderCard();
}
function doPrev() { if (m1Index>0) m1Index--; renderCard(); }

// ═══════════════════════════════════════════════
//  MODUL 1 – QUIZ
// ═══════════════════════════════════════════════
function setupQuiz(item) {
  const correct = item[KEY_WORT] || "";
  setText("q-question", item[KEY_SENT] || "");
  setText("q-meta", `#${m1Index+1} / ${m1Session.length}`);

  const opts = [correct];
  let g=0;
  while (opts.length<4 && g++<500) {
    const r = m1Vocab[Math.floor(Math.random()*m1Vocab.length)][KEY_WORT];
    if (r && !opts.includes(r)) opts.push(r);
  }
  while (opts.length<4) opts.push("(keine Option)");
  opts.sort(()=>Math.random()-.5);

  const box = document.getElementById("q-opts");
  box.innerHTML="";
  opts.forEach(opt => {
    const btn=document.createElement("button");
    btn.className="m1-opt"; btn.innerText=opt;
    btn.onclick=()=>{
      box.querySelectorAll("button").forEach(b=>b.disabled=true);
      if (opt===correct) {
        btn.classList.add("c-ok");
        learnedSet.add(correct); todayCount++; saveProgress();
        setTimeout(doNext, 500);
      } else {
        btn.classList.add("c-err");
        box.querySelectorAll("button").forEach(b=>{ if(b.innerText===correct) b.classList.add("c-ok"); });
        setTimeout(doNext, 700);
      }
      updateStats();
    };
    box.appendChild(btn);
  });
}

// ═══════════════════════════════════════════════
//  MODUL 1 – SCHREIB-QUIZ
// ═══════════════════════════════════════════════
function setupWrite(item) {
  setText("w-question", item[KEY_SENT]||"");
  setText("w-meta", `#${m1Index+1} / ${m1Session.length}`);
  const inp = document.getElementById("w-input");
  if (inp) inp.value="";
  const res = document.getElementById("w-result");
  if (res) { res.classList.add("hidden"); res.className="m1-wresult hidden"; }
}

function doCheck() {
  const item = m1Session[m1Index];
  if (!item) return;
  const correct = (item[KEY_WORT]||"").toLowerCase().trim();
  const answer  = (document.getElementById("w-input")?.value||"").toLowerCase().trim();
  const res = document.getElementById("w-result");
  res.classList.remove("hidden");
  if (answer===correct) {
    res.className="m1-wresult c-ok"; res.innerText="✅ Richtig!";
    learnedSet.add(item[KEY_WORT]); todayCount++; saveProgress(); updateStats();
    setTimeout(doNext, 700);
  } else {
    res.className="m1-wresult c-err"; res.innerText=`❌ Falsch – Richtig: ${item[KEY_WORT]}`;
  }
}

// ═══════════════════════════════════════════════
//  MODUL 1 – WİEDERHOLUNG
// ═══════════════════════════════════════════════
function renderReview() {
  const el = document.getElementById("review-content");
  if (!el) return;
  const unlearned = m1Vocab.filter(v => !learnedSet.has(v[KEY_WORT]));
  if (!unlearned.length) {
    el.innerHTML=`<div class="rv-empty">🎉 Alle Wörter gelernt! Großartig!</div>`;
    return;
  }
  el.innerHTML = unlearned.map((v,i) => `
    <div class="rv-row">
      <span class="rv-num">${i+1}</span>
      <div class="rv-text">
        <strong>${esc(v[KEY_WORT]||"")}</strong>
        <span>${esc(v[KEY_SENT]||"")}</span>
      </div>
      <button class="rv-play" onclick="tts('${esc(v[KEY_WORT]||"").replace(/'/g,"\\'")}')">🔊</button>
    </div>
  `).join("");
}

// ═══════════════════════════════════════════════
//  MODUL 1 – MOD
// ═══════════════════════════════════════════════
function setMode(mode) {
  m1Mode=mode; syncTabs(); initSession();
}

function syncTabs() {
  ["flash","quiz","write","review"].forEach(m => {
    document.getElementById("tab-"+m)?.classList.toggle("active", m===m1Mode);
    document.getElementById("area-"+m)?.classList.toggle("hidden", m!==m1Mode);
  });
}

// ═══════════════════════════════════════════════
//  MODUL 2
// ═══════════════════════════════════════════════
function m2Init() {
  const unit = val("m2-unit");
  m2Session = unit==="all" ? [...m2Vocab] : m2Vocab.filter(v=>String(v[M2_COL.lesson])===unit);
  m2Session.sort(()=>Math.random()-.5);
  m2Index=0; m2Stats={correct:0,wrong:0};
  m2Render();
}

function m2Render() {
  if (!m2Session.length) return;
  if (m2Index>=m2Session.length) { alert("🎉 Lektion beendet!"); showMenu(); return; }
  const item=m2Session[m2Index];
  const lang=val("m2-lang");
  setText("m2-de",   item[M2_COL.de]||"");
  setText("m2-tr",   item[lang]||"(keine Übersetzung)");
  setText("m2-sent", item[M2_COL.sentence]||"");
  document.getElementById("m2-flash")?.classList.remove("flipped");
  setText("m2-correct", m2Stats.correct);
  setText("m2-wrong",   m2Stats.wrong);
  setText("m2-pct",     Math.round(m2Index/m2Session.length*100)+"%");
  if (m2Quiz) m2SetupQuiz(item, lang);
}

function m2Flip() { document.getElementById("m2-flash")?.classList.toggle("flipped"); }
function m2Next() { m2Index++; m2Render(); }

function m2Toggle() {
  m2Quiz=!m2Quiz;
  m2Quiz ? (show("m2-quiz"), hide("m2-flash")) : (show("m2-flash"), hide("m2-quiz"));
  setText("m2-toggle-btn", m2Quiz ? "🗂 Flashcards" : "🎯 Quiz Modus");
  m2Render();
}

function m2SetupQuiz(item, lang) {
  const correct=item[lang];
  setText("m2-qq",   item[M2_COL.de]||"");
  setText("m2-qmeta",`#${m2Index+1} / ${m2Session.length}`);
  const box=document.getElementById("m2-qopts");
  box.innerHTML="";
  const opts=[correct].filter(Boolean);
  let g=0;
  while(opts.length<4&&g++<500){const r=m2Vocab[Math.floor(Math.random()*m2Vocab.length)][lang];if(r&&!opts.includes(r))opts.push(r);}
  while(opts.length<4)opts.push("(keine Option)");
  opts.sort(()=>Math.random()-.5);
  opts.forEach(opt=>{
    const btn=document.createElement("button");
    btn.className="opt-btn"; btn.innerText=opt;
    btn.onclick=()=>{
      box.querySelectorAll("button").forEach(b=>b.disabled=true);
      if(opt===correct){btn.classList.add("c-ok");m2Stats.correct++;setTimeout(m2Next,450);}
      else{btn.classList.add("c-err");m2Stats.wrong++;box.querySelectorAll("button").forEach(b=>{if(b.innerText===correct)b.classList.add("c-ok");});setTimeout(m2Next,650);}
      setText("m2-correct",m2Stats.correct); setText("m2-wrong",m2Stats.wrong);
    };
    box.appendChild(btn);
  });
}

// ═══════════════════════════════════════════════
//  YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════
function setText(id, txt) { const el=document.getElementById(id); if(el) el.innerText=String(txt); }
function setBtn(id, txt, disabled) { const el=document.getElementById(id); if(el){el.innerText=txt; el.disabled=disabled;} }
function val(id) { const el=document.getElementById(id); return el ? el.value : ""; }
function show(id) { document.getElementById(id)?.classList.remove("hidden"); }
function hide(id) { document.getElementById(id)?.classList.add("hidden"); }
function esc(s)  { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// ═══════════════════════════════════════════════
//  BAŞLAT
// ═══════════════════════════════════════════════
loadModul1();
loadModul2();
