const url = (p) => new URL(`./data/${p}`, import.meta.url).href;
const fmt = (s) => { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`; };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const getJSON = async (p) => { const r = await fetch(url(p), { cache: "no-store" }); return r.ok ? r.json() : null; };
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const store = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const appEl = document.getElementById("app");
const { projects = [], owner = "" } = (await getJSON("projects.json")) || {};
const TABS = ["takes", "broll", "review"];

let observer = null;
const allVideos = [];
function lazyVideo(v, src, poster) {
  v.dataset.src = src; if (poster) v.dataset.poster = poster;
  observer.observe(v);
  v.addEventListener("play", () => allVideos.forEach((o) => { if (o !== v) o.pause(); }));
  allVideos.push(v);
}
function newObserver() {
  observer?.disconnect(); allVideos.length = 0;
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const v = e.target; if (v.dataset.poster) v.poster = v.dataset.poster; v.src = v.dataset.src; observer.unobserve(v);
    }
  }, { rootMargin: "300px" });
}

async function route() {
  const [, slug, tab] = location.hash.split("?")[0].replace(/^#\/?/, "#").split(/[#/]/);
  newObserver();
  appEl.replaceChildren();
  window.scrollTo(0, 0);
  const p = projects.find((x) => x.slug === slug);
  if (!p) return renderHome();
  const t = TABS.includes(tab) ? tab : await defaultTab(p);
  return renderProject(p, t);
}
window.addEventListener("hashchange", route);

// Open on the tab with the newest work (the script records it as "latest").
async function defaultTab(p) {
  if (TABS.includes(p.latest)) return p.latest;
  const t = await getJSON(`projects/${p.slug}/takes.json`);
  if (t?.lines?.length) return "takes";
  const r = await getJSON(`projects/${p.slug}/review.json`);
  return r?.versions?.length ? "review" : "takes";
}

async function renderHome() {
  const wrap = el("div");
  const hero = el("div", "hero");
  const h1 = el("h1", "title", "Welcome to your content studio");
  if (owner) h1.append(", ", el("em", "", owner));
  hero.append(h1);
  wrap.append(hero);
  wrap.append(el("h2", "sec", "📁 Projects"));
  if (!projects.length) { wrap.append(el("p", "empty", "No projects yet. Start working on a video and it shows up here.")); appEl.append(wrap); return; }
  const grid = el("div", "projects");
  for (const p of projects) {
    const a = el("a", "proj"); a.href = `#/${p.slug}`;
    a.append(el("p", "eyebrow", [p.type, p.brand].filter(Boolean).join(" · ") || p.created || ""), el("h2", "", `${p.emoji ? p.emoji + " " : ""}${p.title}`));
    grid.append(a);
  }
  wrap.append(grid);
  appEl.append(wrap);
}

function header(p, tab) {
  const h = el("div");
  const back = el("a", "back", "← Studio"); back.href = "#/";
  const title = el("h1", "title"); title.append(`${p.emoji || ""} ${p.title} `.trimStart());
  const tabs = el("nav", "tabs");
  for (const [k, lab] of [["takes", "🎬 Takes"], ["broll", "🎥 B-roll"], ["review", "🎞️ Review edit"]]) {
    const a = el("a", k === tab ? "on" : "", lab); a.href = `#/${p.slug}/${k}`; tabs.append(a);
  }
  const meta = el("div", "proj-meta");
  if (p.type) meta.append(el("span", "tag lav", p.type));
  if (p.brand) meta.append(el("span", "tag", p.brand));
  h.append(back, title, meta, tabs);
  return h;
}

async function renderProject(p, tab) {
  appEl.append(header(p, tab));
  const base = `projects/${p.slug}/`;
  if (tab === "review") return renderReview(p, base, await getJSON(base + "review.json"));
  const takes = await getJSON(base + "takes.json");
  if (tab === "takes") return renderTakes(p, base, takes);
  const broll = await getJSON(base + "broll.json");
  return renderBroll(p, base, broll, takes);
}

/* ---------------- Takes ---------------- */
function renderTakes(p, base, data) {
  if (!data?.lines?.length) { appEl.append(el("p", "empty", "No takes in this project yet.")); return; }
  const { lines } = data;
  const KEY = `picker:${p.slug}:takes`;
  let picks = load(KEY) || {};
  const bar = el("div", "bar");
  const prog = el("p", "progress"); const cnt = el("b", "", "0"); prog.append(cnt, ` of ${lines.length} lines picked`);
  const acts = el("div", "actions");
  const mk = (label, icon, cls, variant) => { const b = document.createElement("wa-button"); b.setAttribute("size", "small"); if (variant) b.setAttribute("variant", variant); if (cls) b.className = cls; const i = document.createElement("wa-icon"); i.setAttribute("slot", "start"); i.setAttribute("name", icon); b.append(i, label); return b; };
  const bPlay = mk("Play my cut", "play", "", "brand");
  const bCopy = mk("Copy my picks", "copy", "lime-btn");
  const bClear = document.createElement("wa-button"); bClear.setAttribute("size", "small"); bClear.setAttribute("appearance", "plain"); bClear.textContent = "Clear picks";
  acts.append(bPlay, bCopy, bClear); bar.append(prog, acts);
  const nav = el("nav", "chipnav");
  const list = el("div");
  appEl.append(bar, nav, list);

  for (const line of lines) {
    const a = el("a", "", String(line.n)); a.href = `#line-${line.n}`; a.dataset.n = line.n;
    a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById(`line-${line.n}`).scrollIntoView({ behavior: "smooth" }); });
    nav.append(a);
    const sec = el("section", "card"); sec.id = `line-${line.n}`;
    const head = el("div", "card-head"); const left = el("div");
    left.append(el("p", "eyebrow", `Line ${line.n}`), el("h2", "", line.script));
    head.append(left);
    const row = el("div", "takes");
    line.takes.forEach((t, i) => {
      const card = el("article", "take"); card.dataset.id = t.id; card.dataset.links = (t.links || []).map((k) => k.id).join(",");
      const v = document.createElement("video"); v.preload = "none"; v.playsInline = true; v.controls = true;
      lazyVideo(v, url(`${base}clips/${t.id}.mp4?v=2`), url(`${base}posters/${t.id}.jpg?v=2`));
      const body = el("div", "take-body");
      const meta = el("div", "take-meta"); meta.append(el("span", "mono", `${t.source} · ${fmt(t.start)}`));
      const tags = el("div", "line-tags");
      for (const k of t.links || []) {
        const lk = el("a", "tag link-tag", `🔗 Same clip as Line ${k.line}`); lk.href = `#line-${k.line}`;
        lk.addEventListener("click", (e) => { e.preventDefault(); document.getElementById(`line-${k.line}`).scrollIntoView({ behavior: "smooth" }); });
        tags.append(lk);
      }
      const match = el("span", "tag lime match-tag", "✨ Matches your pick"); match.hidden = true; tags.append(match);
      const btn = el("button", "heart pick", "🤍"); btn.type = "button"; btn.title = "Use this take";
      btn.addEventListener("click", () => { if (picks[line.n] === t.id) delete picks[line.n]; else picks[line.n] = t.id; store(KEY, picks); paint(); });
      meta.append(btn);
      body.append(meta, el("p", "said", `“${t.text}”`), tags);
      card.append(v, body); row.append(card);
    });
    sec.append(head, row); list.append(sec);
  }

  function paint() {
    const chosen = Object.values(picks); let n = 0;
    for (const line of lines) {
      const c = picks[line.n]; if (c) n++;
      document.getElementById(`line-${line.n}`).classList.toggle("done", !!c);
      nav.querySelector(`a[data-n="${line.n}"]`).classList.toggle("done", !!c);
      document.querySelectorAll(`#line-${line.n} .take`).forEach((card) => {
        const on = card.dataset.id === c;
        card.classList.toggle("picked", on);
        card.querySelector(".pick").textContent = on ? "❤️" : "🤍";
        const m = !on && card.dataset.links.split(",").some((id) => id && chosen.includes(id));
        card.classList.toggle("matches", m); card.querySelector(".match-tag").hidden = !m;
      });
    }
    cnt.textContent = n;
  }
  paint();

  const findTake = (l) => { const i = l.takes.findIndex((t) => t.id === picks[l.n]); return i < 0 ? null : { t: l.takes[i], i: i + 1 }; };
  bCopy.addEventListener("click", async () => {
    const rows = lines.map((l) => { const f = findTake(l); return f ? `${l.n}. Take ${f.i} · ${f.t.source} ${fmt(f.t.start)}-${fmt(f.t.end)} · ${f.t.id}` : `${l.n}. (no pick yet)`; });
    const text = `${p.title} take picks\n${rows.join("\n")}`;
    try { await navigator.clipboard.writeText(text); flash(bCopy); } catch { window.prompt("Copy your picks:", text); }
  });
  bClear.addEventListener("click", () => { picks = {}; store(KEY, picks); paint(); });

  const dialog = document.getElementById("cut-dialog"), cv = document.getElementById("cut-video"), now = document.getElementById("cut-now");
  let q = [], qi = 0;
  const playAt = (i) => { qi = i; const x = q[i]; cv.src = url(`${base}clips/${x.t.id}.mp4?v=2`); now.textContent = `Line ${x.n} (${i + 1} of ${q.length})`; cv.play().catch(() => {}); };
  cv.onended = () => { if (qi + 1 < q.length) playAt(qi + 1); else now.textContent = "That's your cut 🎉"; };
  bPlay.addEventListener("click", () => {
    q = lines.map((l) => ({ n: l.n, ...findTake(l) })).filter((x) => x.t);
    allVideos.forEach((v) => v.pause()); dialog.open = true;
    if (!q.length) { cv.removeAttribute("src"); now.textContent = "Pick at least one take first."; return; }
    playAt(0);
  });
  dialog.addEventListener("wa-after-hide", () => cv.pause());
}

function flash(b) { const old = [...b.childNodes]; b.textContent = "Copied ✨"; setTimeout(() => b.replaceChildren(...old), 1500); }

/* ---------------- B-roll ---------------- */
// The server streams videos without byte ranges, so browsers can't jump around in them.
// Download each b-roll video once into the page when it scrolls near, then swap it in so
// dragging the scrubber or clicking the timeline works anywhere.
const blobQueue = [];
let blobBusy = false;
const blobObserver = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { blobObserver.unobserve(e.target); blobQueue.push(e.target._blobJob); runBlobQueue(); }
}, { rootMargin: "400px" });
async function runBlobQueue() {
  if (blobBusy) return; const job = blobQueue.shift(); if (!job) return;
  blobBusy = true;
  try { await job(); } catch (err) { console.error(err); }
  blobBusy = false; runBlobQueue();
}
function blobLoad(video, src, note) {
  video._blobJob = async () => {
    note.textContent = "⏳ Getting the video ready to scrub…";
    const r = await fetch(src);
    const total = +r.headers.get("content-length") || 0;
    const reader = r.body.getReader(); const parts = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      parts.push(value); got += value.length;
      if (total) note.textContent = `⏳ Getting the video ready to scrub… ${Math.round((got / total) * 100)}%`;
    }
    const blobUrl = URL.createObjectURL(new Blob(parts, { type: "video/mp4" }));
    const t = video.currentTime, playing = !video.paused, rate = video.playbackRate;
    video.src = blobUrl;
    video.addEventListener("loadedmetadata", () => { video.currentTime = t; video.playbackRate = rate; if (playing) video.play().catch(() => {}); }, { once: true });
    note.textContent = "✅ Ready: drag anywhere";
    setTimeout(() => (note.textContent = ""), 2500);
  };
  blobObserver.observe(video);
}

function renderBroll(p, base, data, takes) {
  if (!data?.videos?.length) { appEl.append(el("p", "empty", "No b-roll in this project yet.")); return; }
  const { videos } = data; const lines = takes?.lines || [];
  const KEY = `picker:${p.slug}:broll`;
  const st = load(KEY) || {};
  const save = () => { store(KEY, st); count(); };
  const bar = el("div", "bar");
  const prog = el("p", "progress"); const cnt = el("b", "", "0"); const unit = el("span", "", " clips kept"); prog.append(cnt, unit);
  const bCopy = document.createElement("wa-button"); bCopy.className = "lime-btn"; bCopy.setAttribute("size", "small");
  const ic = document.createElement("wa-icon"); ic.setAttribute("slot", "start"); ic.setAttribute("name", "copy"); bCopy.append(ic, "Copy my clips");
  const acts = el("div", "actions"); acts.append(bCopy); bar.append(prog, acts);
  const nav = el("nav", "chipnav");
  appEl.append(bar, nav);
  const players = [];

  function count() {
    let n = 0;
    for (const v of videos) { const c = v.done ? v.picks.length : (st[v.id] || []).length; n += c; nav.querySelector(`a[data-id="${v.id}"]`)?.classList.toggle("done", c > 0); }
    cnt.textContent = n; unit.textContent = n === 1 ? " clip kept" : " clips kept";
  }

  videos.forEach((v, vi) => {
    st[v.id] ||= [];
    const a = el("a", "", `${vi + 1} · ${v.desc}`); a.href = `#vid-${v.id}`; a.dataset.id = v.id;
    a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById(`vid-${v.id}`).scrollIntoView({ behavior: "smooth" }); });
    nav.append(a);
    const sec = el("section", "card"); sec.id = `vid-${v.id}`;
    const head = el("div", "card-head"); const left = el("div"); left.append(el("p", "eyebrow", v.name), el("h2", "", v.desc)); head.append(left);
    if (v.done) {
      head.append(el("span", "tag lime", `✅ ${v.picks.length} clip${v.picks.length === 1 ? "" : "s"} kept`));
      const row = el("div", "takes");
      v.picks.forEach((c) => {
        const card = el("article", "take picked");
        const vid = document.createElement("video"); vid.preload = "none"; vid.playsInline = true; vid.controls = true;
        lazyVideo(vid, url(`${base}picks/${c.file}.mp4`), url(`${base}picks/${c.file}.jpg`));
        const body = el("div", "take-body");
        const meta = el("div", "take-meta"); meta.append(el("span", "tag", `#${c.pick}`), el("span", "mono", `${fmt(c.start)}–${fmt(c.end)}`));
        body.append(meta);
        if (c.line) body.append(el("p", "ln-tag mono", `Line ${c.line}`));
        body.append(el("p", "said", c.why || ""));
        card.append(vid, body); row.append(card);
      });
      sec.append(head, row); appEl.append(sec);
      return;
    }
    const grid = el("div", "vid-grid");

    const pl = el("div", "player");
    const video = document.createElement("video"); video.preload = "metadata"; video.controls = true; video.playsInline = true;
    video.src = url(`${base}videos/${v.id}.mp4`); video.poster = url(`${base}videos/${v.id}.jpg`);
    const loadNote = el("p", "load-note", "");
    blobLoad(video, url(`${base}videos/${v.id}.mp4`), loadNote);
    players.push(video); video.addEventListener("play", () => players.forEach((o) => { if (o !== video) o.pause(); }));
    const tl = el("div", "timeline"); const headM = el("div", "head"); const pend = el("div", "pending"); pend.hidden = true; tl.append(pend, headM);
    const tc = el("p", "timecode"); const cur = el("span", "", "0:00.0"); tc.append(cur, el("span", "", fmt(v.dur)));
    const steps = el("div", "steps");
    [["−1s", -1], ["−0.1s", -0.1], ["+0.1s", 0.1], ["+1s", 1]].forEach(([lab, d]) => { const b = el("button", "", lab); b.type = "button"; b.onclick = () => { video.pause(); video.currentTime = Math.max(0, Math.min(v.dur, video.currentTime + d)); }; steps.append(b); });
    const sp = el("button", "", "Speed 1x"); sp.type = "button";
    sp.onclick = () => { const r = video.playbackRate === 1 ? 0.5 : video.playbackRate === 0.5 ? 2 : 1; video.playbackRate = r; sp.textContent = `Speed ${r}x`; };
    steps.append(sp); pl.append(video, tl, tc, steps, loadNote);
    const seekTo = (e) => { const r = tl.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); video.currentTime = x * v.dur; };
    let dragging = false;
    tl.addEventListener("pointerdown", (e) => { dragging = true; tl.setPointerCapture(e.pointerId); video.pause(); seekTo(e); });
    tl.addEventListener("pointermove", (e) => { if (dragging) seekTo(e); });
    tl.addEventListener("pointerup", () => (dragging = false));
    tl.addEventListener("pointercancel", () => (dragging = false));

    const panel = el("div", "panel"); const mark = el("div", "mark");
    let inT = null, outT = null, stopAt = null;
    const row = el("div", "mark-row");
    const bIn = el("button", "", "⏮ Set start here"), bOut = el("button", "", "⏭ Set end here"), bPrev = el("button", "", "▶ Play this bit");
    [bIn, bOut, bPrev].forEach((b) => (b.type = "button"));
    const io = el("span", "in-out", "Start — · End —"); row.append(bIn, bOut, bPrev, io);
    const sel = document.createElement("select"); sel.append(new Option("Anywhere / not sure", ""));
    for (const l of lines) sel.append(new Option(`Line ${l.n}: ${l.script.slice(0, 70)}${l.script.length > 70 ? "…" : ""}`, String(l.n)));
    const why = document.createElement("textarea"); why.placeholder = "What makes this the best part?";
    const saveBtn = document.createElement("wa-button"); saveBtn.className = "lime-btn"; saveBtn.setAttribute("size", "small"); saveBtn.textContent = "Save this clip";
    mark.append(el("p", "eyebrow", "✂️ Mark a clip"), row);
    if (lines.length) mark.append(el("label", "", "Where it could go (optional)"), sel);
    mark.append(el("label", "", "Why this one?"), why, saveBtn);
    const clipsWrap = el("div", "clips");
    panel.append(mark, el("p", "eyebrow", "⭐ Your clips"), clipsWrap);
    grid.append(pl, panel); sec.append(head, grid); appEl.append(sec);

    const showIO = () => {
      io.textContent = `Start ${inT == null ? "—" : fmt(inT)} · End ${outT == null ? "—" : fmt(outT)}`;
      if (inT != null) { const e = outT ?? inT + 0.3; pend.hidden = false; pend.style.left = `${(inT / v.dur) * 100}%`; pend.style.width = `${Math.max(0.4, ((e - inT) / v.dur) * 100)}%`; } else pend.hidden = true;
    };
    bIn.onclick = () => { inT = +video.currentTime.toFixed(2); if (outT != null && outT <= inT) outT = null; showIO(); };
    bOut.onclick = () => { outT = +video.currentTime.toFixed(2); if (inT != null && outT <= inT) [inT, outT] = [outT, inT]; showIO(); };
    const playRange = (s, e) => { video.currentTime = s; stopAt = e; video.play(); };
    bPrev.onclick = () => { if (inT != null && outT != null) playRange(inT, outT); };
    video.addEventListener("timeupdate", () => {
      cur.textContent = fmt(video.currentTime); headM.style.left = `${(video.currentTime / v.dur) * 100}%`;
      if (stopAt != null && video.currentTime >= stopAt) { video.pause(); stopAt = null; }
    });
    saveBtn.addEventListener("click", () => {
      if (inT == null || outT == null) { io.textContent = "Set a start and an end first 👆"; return; }
      st[v.id].push({ start: inT, end: outT, line: sel.value ? Number(sel.value) : null, why: why.value.trim() });
      st[v.id].sort((a, b) => a.start - b.start);
      inT = outT = null; why.value = ""; sel.value = ""; showIO(); save(); draw();
    });
    function draw() {
      tl.querySelectorAll(".seg").forEach((s) => s.remove()); clipsWrap.replaceChildren();
      const L = st[v.id];
      if (!L.length) clipsWrap.append(el("p", "empty", "No clips yet."));
      L.forEach((c, i) => {
        const seg = el("div", "seg"); seg.style.left = `${(c.start / v.dur) * 100}%`; seg.style.width = `${((c.end - c.start) / v.dur) * 100}%`; tl.prepend(seg);
        const card = el("div", "clip"); const body = el("div");
        body.append(el("p", "t", `${fmt(c.start)} – ${fmt(c.end)} (${(c.end - c.start).toFixed(1)}s)`), el("p", "why", c.why || "No reason written yet"));
        if (c.line) body.append(el("p", "ln", `Line ${c.line}`));
        const acts2 = el("div", "clip-actions");
        const bp = el("button", "", "▶"); bp.onclick = () => playRange(c.start, c.end);
        const be = el("button", "", "✏️"); be.onclick = () => { inT = c.start; outT = c.end; why.value = c.why; sel.value = c.line ? String(c.line) : ""; L.splice(i, 1); save(); showIO(); draw(); why.focus(); };
        const bd = el("button", "", "🗑"); bd.onclick = () => { L.splice(i, 1); save(); draw(); };
        acts2.append(bp, be, bd); card.append(el("span", "num", `#${i + 1}`), body, acts2); clipsWrap.append(card);
      });
    }
    draw();
  });
  count();

  bCopy.addEventListener("click", async () => {
    const out = [`${p.title} b-roll picks`];
    for (const v of videos) {
      const L = v.done ? v.picks : (st[v.id] || []); if (!L.length) continue;
      out.push("", `${v.name} (${v.desc})`);
      L.forEach((c, i) => out.push(`${i + 1}. ${fmt(c.start)}-${fmt(c.end)}${c.line ? ` · Line ${c.line}` : ""} · Why: ${c.why || "(no reason)"}`));
    }
    const text = out.join("\n");
    try { await navigator.clipboard.writeText(text); flash(bCopy); } catch { window.prompt("Copy your clips:", text); }
  });
}

/* ---------------- Review edit ---------------- */
function renderReview(p, base, data) {
  const versions = data?.versions || [];
  if (!versions.length) { appEl.append(el("p", "empty", "No edits to review yet.")); return; }
  const verFromHash = Number(new URLSearchParams(location.hash.split("?")[1] || "").get("v"));
  let ver = versions.find((x) => x.v === verFromHash) || versions[versions.length - 1];

  const nav = el("div", "ver-pick");
  const sel = document.createElement("wa-select"); sel.setAttribute("label", "🎬 Version"); sel.setAttribute("size", "small");
  [...versions].reverse().forEach((x) => {
    const o = document.createElement("wa-option"); o.value = String(x.v);
    o.textContent = `V${x.v} · ${x.label}${load(`picker:${p.slug}:approved:v${x.v}`) ? " ✅" : ""}`; sel.append(o);
  });
  sel.setAttribute("value", String(ver.v));
  sel.addEventListener("change", () => { const x = versions.find((y) => String(y.v) === String(sel.value)); if (x && x.v !== ver.v) { ver = x; draw(); } });
  nav.append(sel);
  const bar = el("div", "bar");
  const prog = el("p", "progress"); const cnt = el("b", "", "0"); const verLab = el("span", "", ""); prog.append(cnt, " notes on ", verLab);
  const bCopy = document.createElement("wa-button"); bCopy.className = "lime-btn"; bCopy.setAttribute("size", "small");
  const ic = document.createElement("wa-icon"); ic.setAttribute("slot", "start"); ic.setAttribute("name", "copy"); bCopy.append(ic, "Copy my notes");
  const bOk = document.createElement("wa-button"); bOk.setAttribute("size", "small"); bOk.setAttribute("appearance", "outlined");
  const ic2 = document.createElement("wa-icon"); ic2.setAttribute("slot", "start"); ic2.setAttribute("name", "check"); bOk.append(ic2, "Approve this version");
  const acts = el("div", "actions"); acts.append(bCopy, bOk); bar.append(prog, acts);
  const holder = el("div");
  appEl.append(bar, nav, holder);

  let st = [], KEY = "";
  const save = () => { store(KEY, st); cnt.textContent = st.length; };

  function draw() {
    verLab.textContent = `V${ver.v}`;
    KEY = `picker:${p.slug}:review:v${ver.v}`; st = load(KEY) || []; cnt.textContent = st.length;
    holder.replaceChildren();
    const sec = el("section", "card");
    const head = el("div", "card-head"); const left = el("div");
    left.append(el("p", "eyebrow", `V${ver.v}${ver.date ? " · " + ver.date : ""}`), el("h2", "", ver.label));
    head.append(left, el("span", "tag lav", fmt(ver.dur)));
    if (load(`picker:${p.slug}:approved:v${ver.v}`)) head.append(el("span", "tag lime", "✅ Approved"));
    const grid = el("div", "vid-grid");
    const pl = el("div", "player");
    const video = document.createElement("video"); video.preload = "metadata"; video.controls = true; video.playsInline = true;
    const src = url(`${base}review/${ver.file}.mp4`);
    video.src = src; video.poster = url(`${base}review/${ver.file}.jpg`);
    const loadNote = el("p", "load-note", "");
    blobLoad(video, src, loadNote);
    const tl = el("div", "timeline"); const headM = el("div", "head"); tl.append(headM);
    const tc = el("p", "timecode"); const cur = el("span", "", "0:00.0"); tc.append(cur, el("span", "", fmt(ver.dur)));
    const steps = el("div", "steps");
    [["−1s", -1], ["−0.1s", -0.1], ["+0.1s", 0.1], ["+1s", 1]].forEach(([lab, d]) => { const b = el("button", "", lab); b.type = "button"; b.onclick = () => { video.pause(); video.currentTime = Math.max(0, Math.min(ver.dur, video.currentTime + d)); }; steps.append(b); });
    pl.append(video, tl, tc, steps, loadNote);
    const seekTo = (e) => { const r = tl.getBoundingClientRect(); video.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * ver.dur; };
    let dragging = false;
    tl.addEventListener("pointerdown", (e) => { if (e.target.classList.contains("dot")) return; dragging = true; tl.setPointerCapture(e.pointerId); video.pause(); seekTo(e); });
    tl.addEventListener("pointermove", (e) => { if (dragging) seekTo(e); });
    tl.addEventListener("pointerup", () => (dragging = false));
    tl.addEventListener("pointercancel", () => (dragging = false));
    video.addEventListener("timeupdate", () => { cur.textContent = fmt(video.currentTime); headM.style.left = `${(video.currentTime / ver.dur) * 100}%`; });

    const panel = el("div", "panel"); const mark = el("div", "mark");
    let at = null, general = false;
    const row = el("div", "mark-row");
    const atLab = el("span", "in-out", "Pause where you want to leave a note");
    const bGen = el("button", "", "🌐 Note on the whole video"); bGen.type = "button";
    row.append(atLab, bGen);
    const txt = document.createElement("textarea"); txt.placeholder = "What should change here?";
    const saveBtn = document.createElement("wa-button"); saveBtn.className = "lime-btn"; saveBtn.setAttribute("size", "small"); saveBtn.textContent = "Save note";
    mark.append(el("p", "eyebrow", "✍️ Leave a note"), row, txt, saveBtn);
    const notesWrap = el("div", "clips");
    panel.append(mark, el("p", "eyebrow", "📝 Your notes"), notesWrap);
    grid.append(pl, panel); sec.append(head, grid); holder.append(sec);

    const showAt = () => { atLab.textContent = general ? "🌐 Whole video" : at == null ? "Pause where you want to leave a note" : `📍 At ${fmt(at)}`; bGen.textContent = general ? "📍 Note at a moment instead" : "🌐 Note on the whole video"; };
    const grab = () => { if (!general) { at = +video.currentTime.toFixed(2); showAt(); } };
    video.addEventListener("pause", grab);
    txt.addEventListener("focus", () => { video.pause(); grab(); });
    bGen.onclick = () => { general = !general; if (!general) grab(); showAt(); };
    saveBtn.addEventListener("click", () => {
      const t = txt.value.trim(); if (!t) { txt.focus(); return; }
      st.push({ t: general ? null : (at ?? +video.currentTime.toFixed(2)), note: t });
      st.sort((a, b) => (a.t ?? -1) - (b.t ?? -1));
      txt.value = ""; general = false; save(); list(); showAt();
    });
    function list() {
      tl.querySelectorAll(".dot").forEach((d) => d.remove()); notesWrap.replaceChildren();
      if (!st.length) notesWrap.append(el("p", "empty", "No notes yet."));
      st.forEach((c, i) => {
        if (c.t != null) {
          const d = el("div", "dot"); d.style.left = `${(c.t / ver.dur) * 100}%`; d.title = c.note;
          d.onclick = () => { video.currentTime = c.t; }; tl.append(d);
        }
        const card = el("div", "clip"); const body = el("div");
        body.append(el("p", "t", c.t == null ? "🌐 Whole video" : `📍 ${fmt(c.t)}`), el("p", "why", c.note));
        const a2 = el("div", "clip-actions");
        const bp = el("button", "", "▶"); bp.type = "button"; bp.onclick = () => { if (c.t != null) { video.currentTime = Math.max(0, c.t - 1); video.play(); } };
        const be = el("button", "", "✏️"); be.type = "button"; be.onclick = () => { general = c.t == null; at = c.t; txt.value = c.note; st.splice(i, 1); save(); list(); showAt(); txt.focus(); };
        const bd = el("button", "", "🗑"); bd.type = "button"; bd.onclick = () => { st.splice(i, 1); save(); list(); };
        a2.append(bp, be, bd); card.append(el("span", "num", `#${i + 1}`), body, a2); notesWrap.append(card);
      });
    }
    list(); showAt();
  }
  draw();

  bOk.addEventListener("click", async () => {
    const text = `✅ Approved: ${p.title} · V${ver.v} (${ver.label}). Go ahead with the next step.`;
    store(`picker:${p.slug}:approved:v${ver.v}`, true);
    const op = sel.querySelector(`wa-option[value="${ver.v}"]`); if (op && !op.textContent.endsWith("✅")) op.textContent += " ✅";
    try { await navigator.clipboard.writeText(text); flash(bOk); } catch { window.prompt("Copy this and send it to Runneth:", text); }
    draw();
  });
  bCopy.addEventListener("click", async () => {
    const out = [`${p.title} · V${ver.v} (${ver.label}) notes`];
    st.forEach((c, i) => out.push(`${i + 1}. ${c.t == null ? "Whole video" : fmt(c.t)} · ${c.note}`));
    if (!st.length) out.push("(no notes yet)");
    const text = out.join("\n");
    try { await navigator.clipboard.writeText(text); flash(bCopy); } catch { window.prompt("Copy your notes:", text); }
  });
}

route();
