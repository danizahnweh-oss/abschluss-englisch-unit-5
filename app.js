/* ============================================================
   Global Matters – interactive revision
   Handles: navigation, XP, badges, progress, timer,
   quizzes, drag & drop, gap-fills, word counts, certificate,
   and SEQUENTIAL GATING (unlock one task/module after another).
   Free-text tasks require at least 200 characters.
   Progress is stored in localStorage.
   ============================================================ */

const MODULES = [
  { id: 0, title: "Start",                    est: "" },
  { id: 1, title: "The big picture",          est: "30 min" },
  { id: 2, title: "Trade & its price",        est: "30 min" },
  { id: 3, title: "Greener, fairer world",    est: "30 min" },
  { id: 4, title: "English worldwide",        est: "30 min" },
  { id: 5, title: "Exam skills",              est: "30 min" },
  { id: 6, title: "Finish line",              est: "30 min" },
];

const BADGES = [
  { mod:1, ico:"🌍", nm:"Globalist" },
  { mod:2, ico:"🚢", nm:"Trade Pro" },
  { mod:3, ico:"🍩", nm:"Eco Thinker" },
  { mod:4, ico:"🗣️", nm:"Word Traveller" },
  { mod:5, ico:"🔍", nm:"Text Analyst" },
  { mod:6, ico:"🎓", nm:"Graduate" },
];

const STORE_KEY = "globalMattersProgress_v1";
const MIN_CHARS = 200;   // minimum characters for every free-text task

/* ---------- state ---------- */
let state = loadState();

function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if(s && typeof s === "object") return Object.assign(defaultState(), s);
  }catch(e){}
  return defaultState();
}
function defaultState(){
  return {
    points: 0,
    answered: {},          // unique keys of already-scored items
    doneModules: [],       // completed module ids
    completedSteps: {},    // unlocked/solved task steps  (key -> true)
    texts: {},             // saved free-text answers (stepKey -> value)
    secondsLeft: 180*60,   // 180 min countdown
    name: ""
  };
}
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

/* ---------- award points once per item ---------- */
function award(key, pts){
  if(state.answered[key]) return false;
  state.answered[key] = true;
  state.points += pts;
  save();
  updateHUD();
  return true;
}

/* ============================================================
   NAVIGATION + GATING CORE
   ============================================================ */
const modules = [...document.querySelectorAll(".module")];
const modnav  = document.getElementById("modnav");

/* a module is unlocked once the previous one is finished */
function moduleUnlocked(id){
  id = +id;
  if(id <= 1) return true;                 // Start + Module 1 always open
  return state.doneModules.includes(id - 1);
}

/* the interactive "steps" of a module (cards + book tasks, in order) */
function stepEls(modEl){
  return [...modEl.children].filter(c => c.matches(".card, .booktask"));
}

/* mark a step solved -> save and unlock the next one */
function completeStep(step){
  const key = step.dataset.stepKey;
  if(!key || state.completedSteps[key]) return;   // already done
  state.completedSteps[key] = true;
  save();
  const modEl = step.closest(".module");
  refreshModule(modEl);
  toast("✅ Task solved – next one unlocked");
}

/* show/lock steps of one module according to progress */
function refreshModule(modEl){
  const mod = +modEl.dataset.mod;
  const moduleDone = state.doneModules.includes(mod);
  const st = stepEls(modEl);
  let allPrev = true;                        // all previous steps complete?
  st.forEach(el=>{
    const key = el.dataset.stepKey;
    const unlocked = moduleDone || allPrev;
    el.classList.toggle("locked-step", !unlocked);
    if(unlocked && el.dataset.passive === "1") state.completedSteps[key] = true;
    allPrev = allPrev && !!state.completedSteps[key];
  });
  // enable / dim the "Finish module" button
  const cbtn = modEl.querySelector(".complete-mod");
  if(cbtn){
    const done = st.every(el => state.completedSteps[el.dataset.stepKey]);
    cbtn.classList.toggle("is-disabled", !(done || moduleDone));
  }
}

function buildNav(){
  modnav.innerHTML = "";
  MODULES.forEach(m=>{
    const b = document.createElement("button");
    const open = moduleUnlocked(m.id);
    b.textContent = m.id === 0 ? "🏠 Start" : `${open ? "" : "🔒 "}${m.id}. ${m.title}`;
    b.dataset.goto = m.id;
    if(state.doneModules.includes(m.id)) b.classList.add("done");
    if(!open) b.classList.add("locked");
    b.addEventListener("click", ()=> goTo(m.id));
    modnav.appendChild(b);
  });
}

function goTo(id){
  id = +id;
  if(!moduleUnlocked(id)){
    toast("🔒 Finish the previous module first to unlock Module " + id);
    return;
  }
  modules.forEach(sec=> sec.classList.toggle("active", +sec.dataset.mod === id));
  [...modnav.children].forEach(b=> b.classList.toggle("active", +b.dataset.goto === id));
  const target = modules.find(sec=> +sec.dataset.mod === id);
  if(target) refreshModule(target);
  window.scrollTo({top:0, behavior:"smooth"});
  if(id === 6) renderCertificate();
}

document.querySelectorAll("[data-goto]").forEach(el=>{
  el.addEventListener("click", ()=> goTo(el.dataset.goto));
});

/* overview cards on start page */
const overview = document.getElementById("overview");
MODULES.filter(m=>m.id>0).forEach(m=>{
  const d = document.createElement("div");
  d.className = "ov-card";
  d.innerHTML = `<div class="n">Module ${m.id}</div><h4>${m.title}</h4><small>⏱️ ${m.est}</small>`;
  d.addEventListener("click", ()=> goTo(m.id));
  overview.appendChild(d);
});

/* ============================================================
   HUD (points, badges, progress bar)
   ============================================================ */
function updateHUD(){
  document.getElementById("points").textContent = state.points;
  document.getElementById("badgeCount").textContent = state.doneModules.filter(x=>x>0).length;
  const pct = Math.round(state.doneModules.filter(x=>x>0).length / 6 * 100);
  document.getElementById("progressBar").style.width = pct + "%";
}

/* ============================================================
   TIMER (counts down from 180 min, persists)
   ============================================================ */
function fmt(s){
  const m = Math.floor(s/60), sec = s%60;
  return `${m}:${sec.toString().padStart(2,"0")}`;
}
function tick(){
  if(state.secondsLeft > 0){
    state.secondsLeft--;
    if(state.secondsLeft % 5 === 0) save();
  }
  document.getElementById("timer").textContent = fmt(state.secondsLeft);
}
setInterval(tick, 1000);

/* ============================================================
   STEP SETUP – assign keys, add "continue" to reading cards
   (must run before the quiz / gap / text handlers below)
   ============================================================ */
modules.filter(m => +m.dataset.mod >= 1).forEach(modEl=>{
  stepEls(modEl).forEach((step, i)=>{
    step.dataset.stepKey = "s" + modEl.dataset.mod + "-" + i;

    // certificate & badge cards: purely passive display -> auto-complete when reached
    if(step.querySelector(".certificate") || step.querySelector("#badgeGrid")){
      step.dataset.passive = "1";
      return;
    }
    if(step.querySelector("textarea[data-count]")) return;   // free-text (handled below)
    if(step.querySelector("[data-q]"))  return;              // quiz
    if(step.querySelector("[data-dd]")) return;              // drag & drop
    if(step.querySelector("[data-gap]"))return;              // gap fill

    // pure reading card -> add a "continue" button to acknowledge
    const row = document.createElement("div");
    row.className = "btn-row";
    const b = document.createElement("button");
    b.className = "btn ghost continue-step";
    b.textContent = "I've read this ✓";
    b.addEventListener("click", ()=>{
      completeStep(step);
      b.textContent = "Read ✓";
      b.disabled = true;
    });
    row.appendChild(b);
    step.appendChild(row);
  });
});

/* ============================================================
   QUIZ (multiple choice, retry until correct)
   ============================================================ */
let qCounter = 0;
document.querySelectorAll("[data-q]").forEach(q=>{
  const key = "q" + (qCounter++);
  const opts = [...q.querySelectorAll(".opt")];
  const fb   = q.querySelector(".feedback");
  const okText = fb ? fb.textContent : "";
  const step = q.closest(".card, .booktask");

  opts.forEach((opt,i)=>{
    const mark = document.createElement("span");
    mark.className = "mark";
    mark.textContent = String.fromCharCode(65+i);
    opt.prepend(mark);

    opt.addEventListener("click", ()=>{
      if(q.classList.contains("solved")) return;          // already correct
      const correct = opt.dataset.correct === "true";

      if(correct){
        q.classList.add("solved");
        opts.forEach(o=>{
          o.classList.add("locked");
          if(o.dataset.correct === "true") o.classList.add("correct");
        });
        if(fb){ fb.classList.add("show","ok"); fb.classList.remove("no"); fb.textContent = okText; }
        award(key, 10) && toast("+10 XP ⭐");
        // step done when every question in it is solved
        if([...step.querySelectorAll("[data-q]")].every(x=>x.classList.contains("solved"))){
          completeStep(step);
        }
      }else{
        // wrong -> let them try again
        opt.classList.add("wrong");
        if(fb){ fb.classList.remove("ok"); fb.classList.add("show","no"); fb.textContent = "Not quite – try again."; }
        setTimeout(()=> opt.classList.remove("wrong"), 900);
      }
    });
  });
});

/* ============================================================
   DRAG & DROP matching
   ============================================================ */
document.querySelectorAll("[data-dd]").forEach((dd,di)=>{
  const key = "dd" + di;
  const step = dd.closest(".card, .booktask");
  const pool = dd.querySelector(".dd-pool");
  const zones = [...dd.querySelectorAll(".dropzone")];
  let dragged = null;

  function bindToken(t){
    t.addEventListener("dragstart", e=>{ dragged = t; t.classList.add("dragging"); });
    t.addEventListener("dragend",   e=>{ t.classList.remove("dragging"); });
  }
  dd.querySelectorAll(".token").forEach(bindToken);

  function allowDrop(container){
    container.addEventListener("dragover", e=>{ e.preventDefault(); container.classList.add("over"); });
    container.addEventListener("dragleave", ()=> container.classList.remove("over"));
    container.addEventListener("drop", e=>{
      e.preventDefault();
      container.classList.remove("over");
      if(!dragged) return;
      if(container.classList.contains("dropzone")){
        const existing = container.querySelector(".token");
        if(existing) pool.appendChild(existing);
      }
      container.appendChild(dragged);
      container.classList.remove("ok","no");
    });
  }
  zones.forEach(allowDrop);
  allowDrop(pool);

  // tap fallback for touch: click a token then click a zone
  let selected = null;
  dd.addEventListener("click", e=>{
    const tok = e.target.closest(".token");
    const zone = e.target.closest(".dropzone") || (e.target.closest(".dd-pool"));
    if(tok){
      if(selected) selected.style.outline = "";
      selected = (selected === tok) ? null : tok;
      if(selected) selected.style.outline = "3px solid var(--gold)";
      return;
    }
    if(zone && selected){
      if(zone.classList.contains("dropzone")){
        const existing = zone.querySelector(".token");
        if(existing) pool.appendChild(existing);
      }
      zone.appendChild(selected);
      zone.classList && zone.classList.remove("ok","no");
      selected.style.outline = "";
      selected = null;
    }
  });

  const btn = dd.querySelector(".check-dd");
  const pill = dd.querySelector(".result-pill");
  btn.addEventListener("click", ()=>{
    let correct = 0;
    zones.forEach(z=>{
      const accept = z.dataset.accept.split(",");
      const tok = z.querySelector(".token");
      const ok = tok && accept.includes(tok.dataset.id);
      z.classList.toggle("ok", !!ok);
      z.classList.toggle("no", !ok);
      if(ok) correct++;
    });
    const total = zones.length;
    pill.className = "result-pill show " + (correct===total ? "ok":"mid");
    pill.textContent = `${correct}/${total} correct`;
    if(correct===total){
      award(key, 15) && toast("+15 XP ⭐ perfect match!");
      completeStep(step);
    }
  });
});

/* ============================================================
   GAP FILL
   ============================================================ */
document.querySelectorAll("[data-gap]").forEach((gap,gi)=>{
  const key = "gap" + gi;
  const step = gap.closest(".card, .booktask");
  const inputs = [...gap.querySelectorAll("input")];
  const btn = gap.querySelector(".check-gap");
  const pill = gap.querySelector(".result-pill");
  btn.addEventListener("click", ()=>{
    let correct = 0;
    inputs.forEach(inp=>{
      const answers = inp.dataset.answer.toLowerCase().split("|").map(s=>s.trim());
      const val = inp.value.trim().toLowerCase();
      const ok = answers.includes(val);
      inp.classList.toggle("ok", ok);
      inp.classList.toggle("no", !ok);
      if(ok) correct++;
    });
    pill.className = "result-pill show " + (correct===inputs.length ? "ok":"mid");
    pill.textContent = `${correct}/${inputs.length} correct`;
    if(correct===inputs.length){
      award(key, 10) && toast("+10 XP ⭐");
      completeStep(step);
    }
  });
});

/* ============================================================
   FREE TEXT – word/char count + 200-character gate
   ============================================================ */
document.querySelectorAll("textarea[data-count]").forEach(ta=>{
  const label = ta.nextElementSibling;              // .wordcount
  const step  = ta.closest(".card, .booktask");
  const isBook = step.classList.contains("booktask");
  const skey  = step.dataset.stepKey;

  // restore saved text
  if(skey && state.texts[skey]) ta.value = state.texts[skey];

  function readOk(){
    const rb = step.querySelector(".read-done");
    return !isBook || (rb && rb.classList.contains("done"));
  }
  function upd(){
    const raw = ta.value;
    const t = raw.trim();
    const words = t ? t.split(/\s+/).length : 0;
    const chars = raw.length;
    const enough = chars >= MIN_CHARS;
    label.innerHTML =
      `${words} ${words===1?"word":"words"} · ` +
      `<span class="charcnt ${enough?"cok":"cno"}">${chars}/${MIN_CHARS} characters` +
      `${enough?" ✓":""}</span>`;
    if(skey){ state.texts[skey] = raw; save(); }
    const dt = step.querySelector("details.reveal");
    if(dt && dt._syncLock) dt._syncLock();
    if(enough && readOk()) completeStep(step);
  }
  ta._upd = upd;
  ta.addEventListener("input", upd);
  upd();
});

/* model answers: locked until the student has written >= 200 characters */
document.querySelectorAll("details.reveal").forEach((d,ri)=>{
  const card = d.closest(".card, .booktask");
  const ta = card ? card.querySelector("textarea[data-count]") : null;
  const summary = d.querySelector("summary");
  const origLabel = summary ? summary.textContent : "";
  function locked(){ return ta && ta.value.length < MIN_CHARS; }
  function syncLock(){
    if(!summary) return;
    if(locked()){
      d.classList.add("reveal-locked");
      d.open = false;
      summary.textContent = "🔒 Write at least " + MIN_CHARS + " characters to unlock the sample answer";
    }else{
      d.classList.remove("reveal-locked");
      summary.textContent = origLabel;
    }
  }
  d._syncLock = syncLock;
  if(summary){
    summary.addEventListener("click", e=>{
      if(locked()){ e.preventDefault(); toast("🔒 Write at least " + MIN_CHARS + " characters first"); }
    });
  }
  d.addEventListener("toggle", ()=>{
    if(d.open) award("reveal"+ri, 5) && toast("+5 XP for self-checking ✅");
  });
  syncLock();
});

/* ============================================================
   BOOK READING TASKS ("I've read the text")
   ============================================================ */
document.querySelectorAll(".read-done").forEach((btn,ri)=>{
  const step = btn.closest(".booktask");
  const pill = btn.parentElement.querySelector(".result-pill");
  btn.addEventListener("click", ()=>{
    btn.classList.add("done");
    btn.textContent = "Read ✓";
    if(pill){ pill.className = "result-pill show ok"; pill.textContent = "Nice – now write your notes (min. 200 characters)."; }
    award("read"+ri, 5) && toast("+5 XP for reading 📖");
    const ta = step.querySelector("textarea[data-count]");
    if(ta && ta._upd) ta._upd();     // re-check the 200-char gate
  });
});

/* ============================================================
   MODULE COMPLETION
   ============================================================ */
document.querySelectorAll(".complete-mod").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const mod = +btn.dataset.mod;
    const modEl = btn.closest(".module");
    const st = stepEls(modEl);
    const allDone = st.every(el => state.completedSteps[el.dataset.stepKey]);

    if(!state.doneModules.includes(mod) && !allDone){
      toast("🔒 Finish every task in this module first");
      return;
    }

    if(!state.doneModules.includes(mod)){
      state.doneModules.push(mod);
      award("modbonus"+mod, 20);
      save();
      buildNav();
      goTo(mod); // refresh nav active state
      const badge = BADGES.find(b=>b.mod===mod);
      toast(`Module ${mod} done! ${badge?badge.ico+" "+badge.nm+" badge earned":""}`);
    }else{
      toast("Module already completed ✓");
    }
    updateHUD();
    // auto-advance to the (now unlocked) next module
    const next = mod + 1;
    if(next <= 6) setTimeout(()=> goTo(next), 900);
  });
});

/* ============================================================
   CERTIFICATE
   ============================================================ */
function renderCertificate(){
  const grid = document.getElementById("badgeGrid");
  if(grid){
    grid.innerHTML = "";
    BADGES.forEach(b=>{
      const el = document.createElement("div");
      el.className = "badge" + (state.doneModules.includes(b.mod) ? " earned":"");
      el.innerHTML = `<div class="ico">${b.ico}</div><div class="nm">${b.nm}</div>`;
      grid.appendChild(el);
    });
  }
  document.getElementById("certScore").textContent = state.points;
  document.getElementById("certModules").textContent = state.doneModules.filter(x=>x>0).length;
  const cn = document.getElementById("certName");
  if(cn){
    cn.value = state.name || "";
    cn.oninput = ()=>{ state.name = cn.value; save(); };
  }
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer;
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove("show"), 2200);
}

/* ============================================================
   RESET
   ============================================================ */
document.getElementById("resetBtn").addEventListener("click", ()=>{
  if(confirm("Delete all progress and start over?")){
    localStorage.removeItem(STORE_KEY);
    location.reload();
  }
});

/* ============================================================
   INIT
   ============================================================ */
buildNav();
updateHUD();
modules.filter(m => +m.dataset.mod >= 1).forEach(refreshModule);   // apply gating
goTo(0);
document.getElementById("timer").textContent = fmt(state.secondsLeft);
