/* ============================================================
   Global Matters – interactive revision
   Handles: navigation, XP, badges, progress, timer,
   quizzes, drag & drop, gap-fills, word counts, certificate.
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
   NAVIGATION
   ============================================================ */
const modules = [...document.querySelectorAll(".module")];
const modnav  = document.getElementById("modnav");

function buildNav(){
  modnav.innerHTML = "";
  MODULES.forEach(m=>{
    const b = document.createElement("button");
    b.textContent = m.id === 0 ? "🏠 Start" : `${m.id}. ${m.title}`;
    b.dataset.goto = m.id;
    if(state.doneModules.includes(m.id)) b.classList.add("done");
    b.addEventListener("click", ()=> goTo(m.id));
    modnav.appendChild(b);
  });
}

function goTo(id){
  modules.forEach(sec=> sec.classList.toggle("active", +sec.dataset.mod === +id));
  [...modnav.children].forEach(b=> b.classList.toggle("active", +b.dataset.goto === +id));
  window.scrollTo({top:0, behavior:"smooth"});
  if(+id === 6) renderCertificate();
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
   QUIZ (multiple choice, one correct)
   ============================================================ */
let qCounter = 0;
document.querySelectorAll("[data-q]").forEach(q=>{
  const key = "q" + (qCounter++);
  const opts = [...q.querySelectorAll(".opt")];
  const fb   = q.querySelector(".feedback");
  opts.forEach((opt,i)=>{
    // add letter marker
    const mark = document.createElement("span");
    mark.className = "mark";
    mark.textContent = String.fromCharCode(65+i);
    opt.prepend(mark);

    opt.addEventListener("click", ()=>{
      if(q.dataset.locked) return;
      q.dataset.locked = "1";
      const correct = opt.dataset.correct === "true";
      opts.forEach(o=>{
        o.classList.add("locked");
        if(o.dataset.correct === "true") o.classList.add("correct");
      });
      if(!correct) opt.classList.add("wrong");
      if(fb){
        fb.classList.add("show", correct ? "ok" : "no");
        if(!correct){
          const right = opts.find(o=>o.dataset.correct==="true");
          const letter = String.fromCharCode(65 + opts.indexOf(right));
          fb.classList.remove("ok"); fb.classList.add("no");
          fb.textContent = "Not quite – the correct answer is " + letter + ".";
        }
      }
      if(correct){ award(key, 10) && toast("+10 XP ⭐"); }
      else { award(key, 0); }
    });
  });
});

/* ============================================================
   DRAG & DROP matching
   ============================================================ */
document.querySelectorAll("[data-dd]").forEach((dd,di)=>{
  const key = "dd" + di;
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
      // a dropzone holds only one token: send existing token back to pool
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
    }
  });
});

/* ============================================================
   GAP FILL
   ============================================================ */
document.querySelectorAll("[data-gap]").forEach((gap,gi)=>{
  const key = "gap" + gi;
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
    }
  });
});

/* ============================================================
   WORD COUNT for writing tasks
   ============================================================ */
document.querySelectorAll("textarea[data-count]").forEach(ta=>{
  const label = ta.nextElementSibling; // .wordcount
  const upd = ()=>{
    const words = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    label.textContent = words + (words===1 ? " word" : " words");
  };
  ta.addEventListener("input", upd);
});

/* reward opening a model answer (encourages self-check) */
document.querySelectorAll("details.reveal").forEach((d,ri)=>{
  d.addEventListener("toggle", ()=>{
    if(d.open) award("reveal"+ri, 5) && toast("+5 XP for self-checking ✅");
  });
});

/* ============================================================
   BOOK READING TASKS ("I've read the text")
   ============================================================ */
document.querySelectorAll(".read-done").forEach((btn,ri)=>{
  const pill = btn.parentElement.querySelector(".result-pill");
  btn.addEventListener("click", ()=>{
    btn.classList.add("done");
    btn.textContent = "Read ✓";
    if(pill){ pill.className = "result-pill show ok"; pill.textContent = "Nice – now try the tasks!"; }
    award("read"+ri, 5) && toast("+5 XP for reading 📖");
  });
});

/* ============================================================
   MODULE COMPLETION
   ============================================================ */
document.querySelectorAll(".complete-mod").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const mod = +btn.dataset.mod;
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
    // auto-advance
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
goTo(0);
document.getElementById("timer").textContent = fmt(state.secondsLeft);
