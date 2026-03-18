// ── Genel durum ──────────────────────────────────────────────
let activeModule = null;   // 1 veya 2

// Modul 1 (JSON)
let m1Vocab = [];          // tüm veriler

// Modul 2 (CSV)
let m2Vocab = [];

// Oturum
let sessionList = [];
let currentIndex = 0;
let quizMode = false;
let stats = { correct: 0, wrong: 0 };

// CSV kolon isimleri (Modul 2)
const COL = {
  lesson: "Lektion",
  de: "Deutsch",
  sentence: "Beispiel Satz",
};
const LANG_OPTIONS = [
  "Turkisch",
  "Englisch",
  "Ukrainisch (Українська)",
  "Arabisch (العربية)",
  "Farsi (فارسی)",
  "Kurdisch (Kurmancî)",
];

// ── Yardımcı ─────────────────────────────────────────────────
function setStatus(text, isError = false) {
  const el = document.getElementById("load-hint");
  if (!el) return;
  el.textContent = text || "";
  el.style.opacity = text ? "1" : "0";
  el.style.color = isError ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.9)";
}

// ── Modul 1 yükle (JSON) ─────────────────────────────────────
async function loadModul1() {
  try {
    const res = await fetch("modul1.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`modul1.json: ${res.status}`);
    const raw = await res.json();

    m1Vocab = raw.filter(r => r["Wort"] && r["Beispiel Satz"]);

    const display = document.getElementById("m1-words-display");
    const btn = document.getElementById("m1-btn");
    if (display) display.innerText = `${m1Vocab.length} Wörter bereit`;
    if (btn) { btn.disabled = false; btn.innerText = "Starten →"; }
  } catch (err) {
    console.error("Modul 1 Fehler:", err);
    const display = document.getElementById("m1-words-display");
    if (display) display.innerText = "Ladefehler!";
    setStatus("modul1.json konnte nicht geladen werden.", true);
  }
}

// ── Modul 2 yükle (CSV) ──────────────────────────────────────
async function loadModul2() {
  try {
    const res = await fetch("sicher.csv", { cache: "no-store" });
    if (!res.ok) throw new Error(`sicher.csv: ${res.status}`);
    const csvText = await res.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    m2Vocab = (parsed.data || [])
      .map(normalizeM2Row)
      .filter(r => r && r[COL.de] && r[COL.sentence]);

    const display = document.getElementById("m2-words-display");
    const btn = document.getElementById("m2-btn");
    if (display) display.innerText = `${m2Vocab.length} Wörter bereit`;
    if (btn) { btn.disabled = false; btn.innerText = "Starten →"; }
  } catch (err) {
    console.error("Modul 2 Fehler:", err);
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
  const lessonNum = parseInt(String(clean[COL.lesson] || "").trim(), 10);
  clean[COL.lesson] = Number.isFinite(lessonNum) ? lessonNum : null;
  LANG_OPTIONS.forEach(c => {
    if (typeof clean[c] === "string") clean[c] = clean[c].trim();
  });
  return clean;
}

// ── Navigasyon ───────────────────────────────────────────────
function openTrainer(moduleNum) {
  const vocab = moduleNum === 1 ? m1Vocab : m2Vocab;
  if (!vocab.length) {
    alert("Daten sind noch nicht geladen. Bitte kurz warten.");
    return;
  }

  activeModule = moduleNum;
  document.getElementById("main-menu").classList.add("hidden");
  document.getElementById("trainer-area").classList.remove("hidden");

  // Dil seçimini Modul 1'de gizle, Modul 2'de göster
  const langWrap = document.getElementById("lang-wrap");
  if (langWrap) langWrap.classList.toggle("hidden", moduleNum === 1);

  // Unit label
  const unitLabel = document.getElementById("unit-label");
  if (unitLabel) unitLabel.textContent = moduleNum === 1 ? "Kapitel" : "Lektion";

  buildUnitMenu(moduleNum);

  // Sessizce kart moduna dön
  quizMode = false;
  document.getElementById("flashcard-container").classList.remove("hidden");
  document.getElementById("quiz-container").classList.add("hidden");
  document.getElementById("toggle-mode-btn").innerText = "🎯 Quiz Modus";

  initSession();
}

function showMenu() {
  // Audioyu durdur
  const audio = document.getElementById("audio-player");
  if (audio) { audio.pause(); audio.src = ""; }

  document.getElementById("trainer-area").classList.add("hidden");
  document.getElementById("main-menu").classList.remove("hidden");
}

// ── Ünite menüsü ─────────────────────────────────────────────
function buildUnitMenu(moduleNum) {
  const select = document.getElementById("unit-select");
  select.innerHTML = `<option value="all">Alle</option>`;

  if (moduleNum === 1) {
    const kapitel = Array.from(new Set(m1Vocab.map(v => v["Kapitel"]).filter(x => x != null)))
      .sort((a, b) => a - b);
    kapitel.forEach(k => {
      const opt = document.createElement("option");
      opt.value = String(k);
      opt.innerText = `Kapitel ${k}`;
      select.appendChild(opt);
    });
  } else {
    const lessons = Array.from(new Set(m2Vocab.map(v => v[COL.lesson]).filter(x => Number.isFinite(x))))
      .sort((a, b) => a - b);
    lessons.forEach(l => {
      const opt = document.createElement("option");
      opt.value = String(l);
      opt.innerText = `Lektion ${l}`;
      select.appendChild(opt);
    });
  }
}

// ── Oturum ───────────────────────────────────────────────────
function initSession() {
  const unit = document.getElementById("unit-select").value;

  if (activeModule === 1) {
    sessionList = unit === "all"
      ? [...m1Vocab]
      : m1Vocab.filter(v => String(v["Kapitel"]) === unit);
  } else {
    sessionList = unit === "all"
      ? [...m2Vocab]
      : m2Vocab.filter(v => String(v[COL.lesson]) === unit);
  }

  sessionList.sort(() => Math.random() - 0.5);
  currentIndex = 0;
  stats = { correct: 0, wrong: 0 };
  updateUI();
}

// ── UI Güncelle ──────────────────────────────────────────────
function updateUI() {
  if (!sessionList.length) return;

  if (currentIndex >= sessionList.length) {
    alert("Glückwunsch! Abschnitt beendet. 🎉");
    showMenu();
    return;
  }

  const item = sessionList[currentIndex];

  if (activeModule === 1) {
    updateUIModul1(item);
  } else {
    updateUIModul2(item);
  }

  document.getElementById("flashcard-container").classList.remove("flipped");

  if (quizMode) {
    if (activeModule === 1) setupQuizM1(item);
    else setupQuizM2(item);
  }

  document.getElementById("correct-count").innerText = stats.correct;
  document.getElementById("wrong-count").innerText = stats.wrong;
  document.getElementById("progress-percent").innerText =
    Math.round((currentIndex / sessionList.length) * 100) + "%";
}

function updateUIModul1(item) {
  const word = item["Wort"] || "(kein Wort)";
  const grammar = item["Grammatik\n(Artikel/Konjugation)"] || "";
  const sentence = item["Beispiel Satz"] || "";
  const audioFile = item["ses_dosyasi"] || item["Audio Datei"] || "";

  document.getElementById("de-word").innerText = word;
  document.getElementById("de-grammar").innerText = grammar;
  document.getElementById("target-word").innerText = ""; // Modul 1'de çeviri yok
  document.getElementById("b2-sentence").innerText = sentence;

  // Grammar ipucunu göster
  const grammarEl = document.getElementById("de-grammar");
  if (grammarEl) grammarEl.classList.toggle("hidden", !grammar);

  // Audio
  const audioArea = document.getElementById("audio-area");
  const audioPlayer = document.getElementById("audio-player");
  if (audioFile) {
    audioArea.classList.remove("hidden");
    audioPlayer.src = audioFile;
  } else {
    audioArea.classList.add("hidden");
    audioPlayer.src = "";
  }
}

function updateUIModul2(item) {
  const langKey = document.getElementById("lang-select").value;
  const de = item[COL.de] || "(kein Wort)";
  const tr = item[langKey] || "(keine Übersetzung)";
  const sentence = item[COL.sentence] || "";

  document.getElementById("de-word").innerText = de;
  document.getElementById("de-grammar").innerText = "";
  document.getElementById("target-word").innerText = tr;
  document.getElementById("b2-sentence").innerText = sentence;

  const audioArea = document.getElementById("audio-area");
  audioArea.classList.add("hidden");
}

// ── Audio ────────────────────────────────────────────────────
function playAudio() {
  const player = document.getElementById("audio-player");
  if (player && player.src) {
    player.currentTime = 0;
    player.play().catch(e => console.warn("Audio Fehler:", e));
  }
}

// ── Quiz: Modul 1 ────────────────────────────────────────────
function setupQuizM1(correctItem) {
  const correct = correctItem["Wort"] || "";
  document.getElementById("quiz-question").innerText = correctItem["Beispiel Satz"] || "";
  document.getElementById("quiz-meta").innerText = `#${currentIndex + 1} / ${sessionList.length}`;

  const optionsBox = document.getElementById("quiz-options");
  optionsBox.innerHTML = "";

  const options = [correct];
  let guard = 0;
  while (options.length < 4 && guard < 500) {
    guard++;
    const rand = m1Vocab[Math.floor(Math.random() * m1Vocab.length)]["Wort"];
    if (rand && !options.includes(rand)) options.push(rand);
  }
  while (options.length < 4) options.push("(keine Option)");
  options.sort(() => Math.random() - 0.5);

  renderQuizOptions(optionsBox, options, correct);
}

// ── Quiz: Modul 2 ────────────────────────────────────────────
function setupQuizM2(correctItem) {
  const langKey = document.getElementById("lang-select").value;
  const correct = correctItem[langKey];
  document.getElementById("quiz-question").innerText = correctItem[COL.de] || "";
  document.getElementById("quiz-meta").innerText = `#${currentIndex + 1} / ${sessionList.length}`;

  const optionsBox = document.getElementById("quiz-options");
  optionsBox.innerHTML = "";

  const options = [correct].filter(Boolean);
  let guard = 0;
  while (options.length < 4 && guard < 500) {
    guard++;
    const rand = m2Vocab[Math.floor(Math.random() * m2Vocab.length)][langKey];
    if (rand && !options.includes(rand)) options.push(rand);
  }
  while (options.length < 4) options.push("(keine Option)");
  options.sort(() => Math.random() - 0.5);

  renderQuizOptions(optionsBox, options, correct);
}

// ── Quiz ortak render ────────────────────────────────────────
function renderQuizOptions(optionsBox, options, correct) {
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.innerText = opt;
    btn.onclick = () => {
      const buttons = optionsBox.querySelectorAll("button");
      buttons.forEach(b => (b.disabled = true));

      if (opt === correct) {
        btn.classList.add("correct-ans");
        stats.correct++;
        setTimeout(nextWord, 450);
      } else {
        btn.classList.add("wrong-ans");
        stats.wrong++;
        buttons.forEach(b => { if (b.innerText === correct) b.classList.add("correct-ans"); });
        setTimeout(nextWord, 650);
      }
      document.getElementById("correct-count").innerText = stats.correct;
      document.getElementById("wrong-count").innerText = stats.wrong;
    };
    optionsBox.appendChild(btn);
  });
}

// ── Kontroller ───────────────────────────────────────────────
function nextWord() {
  currentIndex++;
  updateUI();
}

function flipCard() {
  document.getElementById("flashcard-container").classList.toggle("flipped");
  // Modul 1: kart döndüğünde otomatik audio çal
  if (activeModule === 1) {
    const isFlipped = document.getElementById("flashcard-container").classList.contains("flipped");
    if (isFlipped) playAudio();
  }
}

function toggleMode() {
  quizMode = !quizMode;
  document.getElementById("flashcard-container").classList.toggle("hidden", quizMode);
  document.getElementById("quiz-container").classList.toggle("hidden", !quizMode);
  document.getElementById("toggle-mode-btn").innerText = quizMode ? "🗂 Flashcards" : "🎯 Quiz Modus";
  updateUI();
}

// ── Başlat ───────────────────────────────────────────────────
loadModul1();
loadModul2();
