// ═══════════════════════════════════════════════
//  GENEL
// ═══════════════════════════════════════════════
const NOW = Date.now();

// LocalStorage anahtarları
const LS_LEARNED = "m1_learned";
const LS_FAV     = "m1_fav";
const LS_TODAY   = "m1_today_date";
const LS_TODAY_N = "m1_today_count";
const DAILY_GOAL = 10;

// ═══════════════════════════════════════════════
//  MODUL 1 – durum
// ═══════════════════════════════════════════════
let m1Vocab      = [];   // sadece yayınlanmış kartlar
let m1AllVocab   = [];   // tüm ham veri (kilitli kapitel bilgisi için)
let m1Session    = [];
let m1Index      = 0;
let m1Mode       = "flash";  // flash | quiz | write | review
let m1LearnedSet = new Set();
let m1FavSet     = new Set();
let m1TodayCount = 0;

// ═══════════════════════════════════════════════
//  MODUL 2 – durum
// ═══════════════════════════════════════════════
let m2Vocab    = [];
let m2Session  = [];
let m2Index    = 0;
let m2QuizMode = false;
let m2Stats    = { correct: 0, wrong: 0 };

const M2_COL = { lesson: "Lektion", de: "Deutsch", sentence: "Beispiel Satz" };
const M2_LANGS = ["Turkisch","Englisch","Ukrainisch (Українська)","Arabisch (العربية)","Farsi (فارسی)","Kurdisch (Kurmancî)"];

// ═══════════════════════════════════════════════
//  YARDIMCI
// ═══════════════════════════════════════════════
function setStatus(text, isError) {
  const el = document.getElementById("load-hint");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.9)";
}

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function loadProgress() {
  m1LearnedSet = new Set(lsGet(LS_LEARNED) || []);
  m1FavSet     = new Set(lsGet(LS_FAV) || []);
  // Günlük sayaç – gün geçtiyse sıfırla
  const savedDate = lsGet(LS_TODAY);
  const today = new Date().toDateString();
  if (savedDate !== today) {
    lsSet(LS_TODAY, today);
    lsSet(LS_TODAY_N, 0);
    m1TodayCount = 0;
  } else {
    m1TodayCount = lsGet(LS_TODAY_N) || 0;
  }
}

function saveProgress() {
  lsSet(LS_LEARNED, [...m1LearnedSet]);
  lsSet(LS_FAV,     [...m1FavSet]);
  lsSet(LS_TODAY_N, m1TodayCount);
}

// ═══════════════════════════════════════════════
//  MODUL 1 – YÜKLEME
// ═══════════════════════════════════════════════
async function loadModul1() {
  try {
    const res = await fetch("modul1.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`modul1.json: ${res.status}`);
    m1AllVocab = await res.json();

    loadProgress();

    // Yayınlanmış kartları filtrele (Veröffentlichungsdatum Karte <= şu an)
    const KEY_KARTE = "Veröffentlichungsdatum \n(Karte)";
    m1Vocab = m1AllVocab.filter(r => {
      const ts = r[KEY_KARTE];
      return ts && ts <= NOW;
    });

    // Kapitel bilgisi (yayınlanan / toplam)
    const allKapitel  = [...new Set(m1AllVocab.map(r => r["Kapitel"]).filter(Boolean))].sort((a,b)=>a-b);
    const openKapitel = [...new Set(m1Vocab.map(r => r["Kapitel"]).filter(Boolean))].sort((a,b)=>a-b);

    const infoEl = document.getElementById("m1-kapitel-info");
    if (infoEl) {
      infoEl.textContent = `${openKapitel.length} von ${allKapitel.length} Kapitel verfügbar`;
    }

    const display = document.getElementById("m1-words-display");
    if (display) display.innerText = `${m1Vocab.length} Wörter verfügbar`;

    const btn = document.getElementById("m1-btn");
    if (btn) { btn.disabled = false; btn.innerText = "Starten →"; }

    buildM1UnitMenu();
    setStatus("");
  } catch (err) {
    console.error("Modul 1:", err);
    const display = document.getElementById("m1-words-display");
    if (display) display.innerText = "Ladefehler!";
    setStatus("modul1.json konnte nicht geladen werden. Prüfe ob die Datei im gleichen Ordner liegt.", true);
  }
}

function buildM1UnitMenu() {
  const sel = document.getElementById("m1-unit-select");
  if (!sel) return;
  sel.innerHTML = `<option value="all">Alle</option>`;
  const kapitel = [...new Set(m1Vocab.map(r => r["Kapitel"]).filter(Boolean))].sort((a,b)=>a-b);
  kapitel.forEach(k => {
    const o = document.createElement("option");
    o.value = String(k);
    o.innerText = `Kapitel ${k}`;
    sel.appendChild(o);
  });
  // Teil menüsü (şimdilik Kapitel ile aynı)
  const sel2 = document.getElementById("m1-part-select");
  if (sel2) {
    sel2.innerHTML = `<option value="all">Alle</option>`;
    kapitel.forEach(k => {
      const o = document.createElement("option");
      o.value = String(k);
      o.innerText = `Teil ${k}`;
      sel2.appendChild(o);
    });
  }
}

// ═══════════════════════════════════════════════
//  MODUL 2 – YÜKLEME
// ═══════════════════════════════════════════════
async function loadModul2() {
  try {
    const res = await fetch("sicher.csv", { cache: "no-store" });
    if (!res.ok) throw new Error(`sicher.csv: ${res.status}`);
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, dynamicTyping: false });

    m2Vocab = (parsed.data || [])
      .map(normalizeM2Row)
      .filter(r => r && r[M2_COL.de] && r[M2_COL.sentence]);

    const display = document.getElementById("m2-words-display");
    if (display) display.innerText = `${m2Vocab.length} Wörter bereit`;

    const btn = document.getElementById("m2-btn");
    if (btn) { btn.disabled = false; btn.innerText = "Starten →"; }

    buildM2UnitMenu();
  } catch (err) {
    console.error("Modul 2:", err);
    const display = document.getElementById("m2-words-display");
    if (display) display.innerText = "CSV Fehler!";
    setStatus("sicher.csv konnte nicht geladen werden.", true);
  }
}

function normalizeM2Row(row) {
  const clean = {};
  for (const k in row) {
    const key = (k || "").trim();
    clean[key] = typeof row[k] === "string" ? row[k].replace(/\u00A0/g, " ").trim() : row[k];
  }
  const n = parseInt(String(clean[M2_COL.lesson] || "").trim(), 10);
  clean[M2_COL.lesson] = isFinite(n) ? n : null;
  M2_LANGS.forEach(c => { if (typeof clean[c] === "string") clean[c] = clean[c].trim(); });
  return clean;
}

function buildM2UnitMenu() {
  const sel = document.getElementById("unit-select");
  if (!sel) return;
  sel.innerHTML = `<option value="all">Alle Lektionen</option>`;
  const lessons = [...new Set(m2Vocab.map(v => v[M2_COL.lesson]).filter(x => isFinite(x)))].sort((a,b)=>a-b);
  lessons.forEach(l => {
    const o = document.createElement("option");
    o.value = String(l);
    o.innerText = `Lektion ${l}`;
    sel.appendChild(o);
  });
}

// ═══════════════════════════════════════════════
//  NAVİGASYON
// ═══════════════════════════════════════════════
function openTrainer(moduleNum) {
  const vocab = moduleNum === 1 ? m1Vocab : m2Vocab;
  if (!vocab.length) {
    alert("Daten sind noch nicht geladen. Bitte kurz warten.");
    return;
  }
  document.getElementById("main-menu").classList.add("hidden");
  document.getElementById("m1-trainer").classList.toggle("hidden", moduleNum !== 1);
  document.getElementById("m2-trainer").classList.toggle("hidden", moduleNum !== 2);

  if (moduleNum === 1) {
    m1Mode = "flash";
    m1InitSession();
    updateAllTabs();
  } else {
    m2QuizMode = false;
    document.getElementById("flashcard-container").classList.remove("hidden");
    document.getElementById("quiz-container").classList.add("hidden");
    document.getElementById("toggle-mode-btn").innerText = "🎯 Quiz Modus";
    m2InitSession();
  }
}

function showMenu() {
  const audio = document.getElementById("m1-audio");
  if (audio) { audio.pause(); audio.src = ""; }
  document.getElementById("main-menu").classList.remove("hidden");
  document.getElementById("m1-trainer").classList.add("hidden");
  document.getElementById("m2-trainer").classList.add("hidden");
}

// ═══════════════════════════════════════════════
//  MODUL 1 – OTURUM & FİLTRE
// ═══════════════════════════════════════════════
function m1InitSession() {
  const unit    = document.getElementById("m1-unit-select")?.value || "all";
  const filter  = document.getElementById("m1-filter-select")?.value || "all";
  const search  = (document.getElementById("m1-search")?.value || "").toLowerCase();

  let list = unit === "all" ? [...m1Vocab] : m1Vocab.filter(v => String(v["Kapitel"]) === unit);

  if (filter === "learned")   list = list.filter(v => m1LearnedSet.has(v["Wort"]));
  if (filter === "unlearned") list = list.filter(v => !m1LearnedSet.has(v["Wort"]));
  if (filter === "fav")       list = list.filter(v => m1FavSet.has(v["Wort"]));
  if (search) list = list.filter(v => (v["Wort"]||"").toLowerCase().includes(search) || (v["Beispiel Satz"]||"").toLowerCase().includes(search));

  m1Session = list;
  m1Index   = 0;

  if (m1Mode === "review") { renderReview(); return; }
  m1UpdateUI();
}

function m1Shuffle() {
  m1Session.sort(() => Math.random() - 0.5);
  m1Index = 0;
  m1UpdateUI();
}

function m1Reset() {
  if (!confirm("Alle Fortschritte zurücksetzen?")) return;
  m1LearnedSet.clear();
  m1FavSet.clear();
  m1TodayCount = 0;
  saveProgress();
  m1InitSession();
}

// ═══════════════════════════════════════════════
//  MODUL 1 – UI GÜNCELLE
// ═══════════════════════════════════════════════
function m1UpdateUI() {
  updateM1StatCards();

  if (!m1Session.length) {
    document.getElementById("m1-word").innerText = "Keine Wörter gefunden";
    document.getElementById("m1-grammar").innerText = "";
    document.getElementById("m1-kbadge").innerHTML = "";
    document.getElementById("m1-sentence-back").innerText = "";
    return;
  }

  if (m1Index >= m1Session.length) m1Index = m1Session.length - 1;
  if (m1Index < 0) m1Index = 0;

  const item = m1Session[m1Index];
  const word = item["Wort"] || "";
  const grammar = item["Grammatik\n(Artikel/Konjugation)"] || "";
  const sentence = item["Beispiel Satz"] || "";
  const kapitel = item["Kapitel"];
  const audioFile = item["ses_dosyasi"] || item["Audio Datei"] || "";

  if (m1Mode === "flash") {
    // Kart ön yüzü
    document.getElementById("m1-word").innerText = word;
    document.getElementById("m1-grammar").innerText = grammar;
    document.getElementById("m1-sentence-back").innerText = sentence;

    // Kapitel badge
    const badge = document.getElementById("m1-kbadge");
    badge.innerHTML = kapitel
      ? `<span class="m1-badge-pill">Lektion ${kapitel}</span><span class="m1-badge-pill">Teil ${kapitel}</span>`
      : "";

    // Favori butonu
    const favBtn = document.getElementById("fav-btn");
    if (favBtn) favBtn.textContent = m1FavSet.has(word) ? "★" : "☆";

    // Audio
    const audioEl = document.getElementById("m1-audio");
    if (audioEl) audioEl.src = audioFile || "";

    // Kart çevirmesini sıfırla
    document.getElementById("m1-card-inner")?.classList.remove("flipped");

  } else if (m1Mode === "quiz") {
    setupM1Quiz(item);
  } else if (m1Mode === "write") {
    setupM1Write(item);
  }
}

function updateM1StatCards() {
  const total    = m1Vocab.length;
  const learned  = m1LearnedSet.size;
  const remaining = Math.max(0, total - learned);
  const fav      = m1FavSet.size;
  const pct      = Math.min(100, Math.round((m1TodayCount / DAILY_GOAL) * 100));

  document.getElementById("m1-total").innerText     = total;
  document.getElementById("m1-learned").innerText   = learned;
  document.getElementById("m1-remaining").innerText = remaining;
  document.getElementById("m1-favcount").innerText  = fav;
  document.getElementById("m1-today").innerText     = m1TodayCount;
  document.getElementById("m1-progress-fill").style.width = pct + "%";
}

// ═══════════════════════════════════════════════
//  MODUL 1 – FLASHCARD AKSİYONLAR
// ═══════════════════════════════════════════════
function m1Flip() {
  const inner = document.getElementById("m1-card-inner");
  if (!inner) return;
  inner.classList.toggle("flipped");
  // Kart çevrilince otomatik audio çal
  if (inner.classList.contains("flipped")) m1PlayAudio();
}

function m1PlayAudio() {
  const item = m1Session[m1Index];
  if (!item) return;
  const audioFile = item["ses_dosyasi"] || item["Audio Datei"] || "";
  if (audioFile) {
    const audio = document.getElementById("m1-audio");
    audio.src = audioFile;
    audio.currentTime = 0;
    audio.play().catch(e => {
      // Dosya yoksa TTS kullan
      m1TTS(item["Wort"] || "");
    });
  } else {
    m1TTS(item["Wort"] || "");
  }
}

function m1TTS(text) {
  if (!text || !window.speechSynthesis) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "de-DE";
  utt.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
}

function m1MarkLearned() {
  const item = m1Session[m1Index];
  if (!item) return;
  const word = item["Wort"];
  if (!m1LearnedSet.has(word)) {
    m1LearnedSet.add(word);
    m1TodayCount++;
    saveProgress();
  }
  m1Next();
}

function m1ToggleFav() {
  const item = m1Session[m1Index];
  if (!item) return;
  const word = item["Wort"];
  if (m1FavSet.has(word)) m1FavSet.delete(word);
  else m1FavSet.add(word);
  saveProgress();
  const favBtn = document.getElementById("fav-btn");
  if (favBtn) favBtn.textContent = m1FavSet.has(word) ? "★" : "☆";
  updateM1StatCards();
}

function m1Next() {
  m1Index++;
  if (m1Index >= m1Session.length) {
    alert(`🎉 Abschnitt beendet! ${m1Session.length} Wörter durchgegangen.`);
    m1Index = 0;
  }
  m1UpdateUI();
}

function m1Prev() {
  m1Index = Math.max(0, m1Index - 1);
  m1UpdateUI();
}

// ═══════════════════════════════════════════════
//  MODUL 1 – MULTIPLE CHOICE
// ═══════════════════════════════════════════════
function setupM1Quiz(correctItem) {
  const correct = correctItem["Wort"] || "";
  document.getElementById("m1-quiz-q").innerText = correctItem["Beispiel Satz"] || "";
  document.getElementById("m1-quiz-meta").innerText = `#${m1Index + 1} / ${m1Session.length}`;

  const opts = [correct];
  let g = 0;
  while (opts.length < 4 && g++ < 500) {
    const r = m1Vocab[Math.floor(Math.random() * m1Vocab.length)]["Wort"];
    if (r && !opts.includes(r)) opts.push(r);
  }
  while (opts.length < 4) opts.push("(keine Option)");
  opts.sort(() => Math.random() - 0.5);

  const box = document.getElementById("m1-quiz-opts");
  box.innerHTML = "";
  opts.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "m1-opt-btn";
    btn.innerText = opt;
    btn.onclick = () => {
      box.querySelectorAll("button").forEach(b => b.disabled = true);
      if (opt === correct) {
        btn.classList.add("correct-ans");
        m1LearnedSet.add(correct);
        m1TodayCount++;
        saveProgress();
        setTimeout(m1Next, 500);
      } else {
        btn.classList.add("wrong-ans");
        box.querySelectorAll("button").forEach(b => { if (b.innerText === correct) b.classList.add("correct-ans"); });
        setTimeout(m1Next, 700);
      }
      updateM1StatCards();
    };
    box.appendChild(btn);
  });
}

// ═══════════════════════════════════════════════
//  MODUL 1 – SCHREIB-QUIZ
// ═══════════════════════════════════════════════
function setupM1Write(item) {
  document.getElementById("m1-write-q").innerText = item["Beispiel Satz"] || "";
  document.getElementById("m1-write-meta").innerText = `#${m1Index + 1} / ${m1Session.length}`;
  document.getElementById("m1-write-input").value = "";
  const res = document.getElementById("m1-write-result");
  res.classList.add("hidden");
  res.className = "m1-write-result hidden";
}

function m1CheckWrite() {
  const item = m1Session[m1Index];
  if (!item) return;
  const correct = (item["Wort"] || "").toLowerCase().trim();
  const answer  = (document.getElementById("m1-write-input").value || "").toLowerCase().trim();
  const res     = document.getElementById("m1-write-result");
  res.classList.remove("hidden");

  if (answer === correct) {
    res.className = "m1-write-result correct-ans";
    res.innerText = "✅ Richtig!";
    m1LearnedSet.add(item["Wort"]);
    m1TodayCount++;
    saveProgress();
    updateM1StatCards();
    setTimeout(m1Next, 700);
  } else {
    res.className = "m1-write-result wrong-ans";
    res.innerText = `❌ Falsch. Richtige Antwort: ${item["Wort"]}`;
  }
}

// ═══════════════════════════════════════════════
//  MODUL 1 – WIEDERHOLUNG
// ═══════════════════════════════════════════════
function renderReview() {
  const el = document.getElementById("m1-review-content");
  if (!el) return;

  const unlearnedWords = m1Vocab.filter(v => !m1LearnedSet.has(v["Wort"]));

  if (!unlearnedWords.length) {
    el.innerHTML = `<div class="m1-review-empty">🎉 Alle Wörter gelernt! Großartig!</div>`;
    return;
  }

  el.innerHTML = unlearnedWords.map((v, i) => `
    <div class="m1-review-row">
      <span class="m1-review-num">${i + 1}</span>
      <div class="m1-review-text">
        <strong>${v["Wort"] || ""}</strong>
        <span>${v["Beispiel Satz"] || ""}</span>
      </div>
      <button class="m1-review-play" onclick="m1TTSFromText('${(v["Wort"]||"").replace(/'/g,"\\'")}')">🔊</button>
    </div>
  `).join("");
}

function m1TTSFromText(text) { m1TTS(text); }

// ═══════════════════════════════════════════════
//  MODUL 1 – MOD DEĞİŞTİR
// ═══════════════════════════════════════════════
function setM1Mode(mode) {
  m1Mode = mode;
  updateAllTabs();
  m1InitSession();
}

function updateAllTabs() {
  ["flash","quiz","write","review"].forEach(m => {
    const tab = document.getElementById("tab-" + m);
    if (tab) tab.classList.toggle("active", m === m1Mode);
  });
  document.getElementById("m1-flash-area").classList.toggle("hidden",  m1Mode !== "flash");
  document.getElementById("m1-quiz-area").classList.toggle("hidden",   m1Mode !== "quiz");
  document.getElementById("m1-write-area").classList.toggle("hidden",  m1Mode !== "write");
  document.getElementById("m1-review-area").classList.toggle("hidden", m1Mode !== "review");
}

// ═══════════════════════════════════════════════
//  MODUL 2 – OTURUM & UI
// ═══════════════════════════════════════════════
function m2InitSession() {
  const unit = document.getElementById("unit-select")?.value || "all";
  m2Session = unit === "all" ? [...m2Vocab] : m2Vocab.filter(v => String(v[M2_COL.lesson]) === unit);
  m2Session.sort(() => Math.random() - 0.5);
  m2Index = 0;
  m2Stats = { correct: 0, wrong: 0 };
  m2UpdateUI();
}

function m2UpdateUI() {
  if (!m2Session.length) return;
  if (m2Index >= m2Session.length) {
    alert("Glückwunsch! Lektion beendet. 🎉");
    showMenu(); return;
  }
  const item    = m2Session[m2Index];
  const langKey = document.getElementById("lang-select").value;
  document.getElementById("de-word").innerText     = item[M2_COL.de] || "";
  document.getElementById("target-word").innerText = item[langKey] || "(keine Übersetzung)";
  document.getElementById("b2-sentence").innerText = item[M2_COL.sentence] || "";
  document.getElementById("flashcard-container").classList.remove("flipped");
  document.getElementById("correct-count").innerText  = m2Stats.correct;
  document.getElementById("wrong-count").innerText    = m2Stats.wrong;
  document.getElementById("progress-percent").innerText = Math.round((m2Index / m2Session.length) * 100) + "%";
  if (m2QuizMode) setupM2Quiz(item, langKey);
}

function flipCard() {
  document.getElementById("flashcard-container").classList.toggle("flipped");
}

function m2NextWord() { m2Index++; m2UpdateUI(); }

function toggleMode() {
  m2QuizMode = !m2QuizMode;
  document.getElementById("flashcard-container").classList.toggle("hidden", m2QuizMode);
  document.getElementById("quiz-container").classList.toggle("hidden", !m2QuizMode);
  document.getElementById("toggle-mode-btn").innerText = m2QuizMode ? "🗂 Flashcards" : "🎯 Quiz Modus";
  m2UpdateUI();
}

function setupM2Quiz(correctItem, langKey) {
  const correct = correctItem[langKey];
  document.getElementById("quiz-question").innerText = correctItem[M2_COL.de] || "";
  document.getElementById("quiz-meta").innerText = `#${m2Index + 1} / ${m2Session.length}`;
  const box = document.getElementById("quiz-options");
  box.innerHTML = "";
  const opts = [correct].filter(Boolean);
  let g = 0;
  while (opts.length < 4 && g++ < 500) {
    const r = m2Vocab[Math.floor(Math.random() * m2Vocab.length)][langKey];
    if (r && !opts.includes(r)) opts.push(r);
  }
  while (opts.length < 4) opts.push("(keine Option)");
  opts.sort(() => Math.random() - 0.5);
  opts.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.innerText = opt;
    btn.onclick = () => {
      box.querySelectorAll("button").forEach(b => b.disabled = true);
      if (opt === correct) {
        btn.classList.add("correct-ans"); m2Stats.correct++;
        setTimeout(m2NextWord, 450);
      } else {
        btn.classList.add("wrong-ans"); m2Stats.wrong++;
        box.querySelectorAll("button").forEach(b => { if (b.innerText === correct) b.classList.add("correct-ans"); });
        setTimeout(m2NextWord, 650);
      }
      document.getElementById("correct-count").innerText = m2Stats.correct;
      document.getElementById("wrong-count").innerText   = m2Stats.wrong;
    };
    box.appendChild(btn);
  });
}

// ═══════════════════════════════════════════════
//  BAŞLAT
// ═══════════════════════════════════════════════
loadModul1();
loadModul2();
