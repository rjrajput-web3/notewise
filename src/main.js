/**
 * Notewise — UI wiring (redesigned).
 *
 * Landing: hero canvas particles, 3D-tilt preview card with a looping
 * messy→structured animation, bento mini-interactions.
 *
 * Workspace: split-pane editor + tabbed AI output (Summary / Key Takeaways /
 * Flashcards / Research), 1-click presets with pre-computed output, file
 * drop, copy + Markdown export, keyboard shortcuts.
 *
 * Honesty rules (never broken):
 *  - Every AI result carries a badge saying exactly what produced it:
 *    "On-device · Gemini Nano", "Cloud · Gemini …", or
 *    "Live Preview Mode" (a local preview, never live AI).
 *  - Raw API error text NEVER reaches the DOM. A failed live call shows a
 *    fixed friendly note and the local preview instead.
 */
import "./styles.css";
import { initFirebase, getAuthState, getFirestoreState } from "./firebase.js";
import { AIService } from "./ai.js";
import { NotesStore, SAMPLE_NOTES } from "./store.js";
import { takeawaysDemo, summarizeDemo, researchDemo, quizDemo } from "./demo.js";
import { PRESETS, getPreset } from "./presets.js";

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const store = new NotesStore();
let aiService = null;
let currentNoteId = null;
let currentPresetId = null;
let quizState = null;
let activeTab = "summary";
let lastOutputs = { summary: null, takeaways: null, quiz: null, research: null };
let lastBadge = null;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToHtml(md) {
  const lines = String(md || "").split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${escapeHtml(line.replace(/^##\s+/, ""))}</h3>`;
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`;
    } else if (/^\d+\.\s+/.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${escapeHtml(line)}</p>`;
    } else if (line.trim() === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${escapeHtml(line)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function parseKeyIdeas(markdown) {
  const section = String(markdown || "").split("## Key ideas")[1] || "";
  const body = section.split("## ")[0];
  return body.split("\n").map((l) => l.replace(/^[-*]\s+/, "").trim()).filter(Boolean).slice(0, 5);
}

/* ================= engine status ================= */

function setEngineStatus(mode, label) {
  const dot = $("engine-dot");
  const text = $("engine-label");
  dot.className = "dot " + (mode === "firebase" ? "dot-live" : mode === "demo" ? "dot-demo" : "dot-warn");
  text.textContent = label;
}

function refreshEngineStatus() {
  const status = aiService ? aiService.status : { mode: "demo", reason: "AI not initialized." };
  const fs = getFirestoreState();
  const auth = getAuthState();
  if (status.mode === "firebase") {
    setEngineStatus("firebase", "Firebase AI Logic ready");
  } else {
    setEngineStatus("demo", "Live Preview Mode");
  }
  $("mode-note").textContent =
    status.mode === "firebase"
      ? `Connected to project hybridai-smart-notes. Firestore: ${fs}; Auth: ${auth}.`
      : `Live Preview Mode: ${status.reason} Firestore: ${fs}; Auth: ${auth}.`;
}

/* ================= hero: canvas particles ================= */

function initHeroCanvas() {
  const canvas = $("hero-canvas");
  if (!canvas || reducedMotion) return;
  const ctx = canvas.getContext("2d");
  let w, h, raf = null;
  const COUNT = 56;
  let pts = [];
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function seed() {
    pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: 1 + Math.random() * 1.6,
      violet: Math.random() > 0.45
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.violet ? "rgba(167,139,250,0.55)" : "rgba(34,211,238,0.5)";
      ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(139,92,246,${0.14 * (1 - Math.sqrt(d2) / 120)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf && !document.hidden) { resize(); if (!pts.length) seed(); raf = requestAnimationFrame(tick); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  window.addEventListener("resize", () => { if (raf) resize(); });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  start();
}

/* ================= hero: 3D tilt + preview loop ================= */

function initTilt() {
  const wrap = document.querySelector(".preview-wrap");
  const card = $("preview-card");
  if (!wrap || !card || !finePointer || reducedMotion) return;
  wrap.addEventListener("mousemove", (e) => {
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(1000px) rotateX(${(6 - py * 10).toFixed(2)}deg) rotateY(${(px * 12).toFixed(2)}deg)`;
  });
  wrap.addEventListener("mouseleave", () => {
    card.style.transform = "perspective(1000px) rotateX(6deg) rotateY(0deg)";
  });
}

const PREVIEW_RAW = "photosynthesis is how plants make food using sunlight water and carbon dioxide… it happens in the leaves, in chloroplasts…";
const PREVIEW_OUT = [
  `<strong>Summary:</strong> Plants convert light, water and CO₂ into glucose in their leaves.`,
  `<span class="po-tag">biology</span><span class="po-tag">energy</span><span class="po-tag">plants</span>`,
  `✓ 5 flashcards ready — “Which organelle runs photosynthesis?”`
];

function initPreviewLoop() {
  const rawEl = $("preview-raw-text");
  const outEl = $("preview-out-lines");
  if (!rawEl || !outEl) return;
  if (reducedMotion) {
    rawEl.textContent = PREVIEW_RAW;
    outEl.innerHTML = PREVIEW_OUT.map((l) => `<p class="show">${l}</p>`).join("");
    return;
  }
  let timer = null;
  function runCycle() {
    rawEl.innerHTML = "";
    outEl.innerHTML = "";
    let i = 0;
    const typeTimer = setInterval(() => {
      rawEl.innerHTML = escapeHtml(PREVIEW_RAW.slice(0, i)) + '<span class="caret"></span>';
      i += 2;
      if (i > PREVIEW_RAW.length) {
        clearInterval(typeTimer);
        rawEl.textContent = PREVIEW_RAW;
        PREVIEW_OUT.forEach((line, li) => {
          setTimeout(() => {
            const p = document.createElement("p");
            p.innerHTML = line;
            outEl.appendChild(p);
            requestAnimationFrame(() => p.classList.add("show"));
          }, 350 * (li + 1));
        });
      }
    }, 24);
    timer = setTimeout(runCycle, 9000);
  }
  runCycle();
}

/* ================= reveal on scroll ================= */

function initReveals() {
  const els = $$(".reveal");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("in-view"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
    }
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}

/* ================= bento mini-interactions ================= */

function initBento() {
  // Mini quiz: one clickable question.
  $$("#mini-quiz .mini-quiz-opts button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fb = $("mini-quiz-feedback");
      $$("#mini-quiz .mini-quiz-opts button").forEach((b) => (b.disabled = true));
      if (btn.dataset.correct === "true") {
        btn.classList.add("correct");
        fb.textContent = "✓ Correct — photosynthesis runs in the chloroplast.";
      } else {
        btn.classList.add("wrong");
        $$("#mini-quiz .mini-quiz-opts button").find((b) => b.dataset.correct === "true")?.classList.add("correct");
        fb.textContent = "✗ Not quite — it is the chloroplast, not the mitochondrion.";
      }
    });
  });

  // Mini copy.
  $("mini-copy-btn").addEventListener("click", async () => {
    const text = "## Summary\nPlants convert light, water and CO₂ into glucose…\n\n## Key takeaways\n- Light reactions split water\n- Calvin cycle fixes carbon";
    try {
      await navigator.clipboard.writeText(text);
      $("mini-copy-btn").textContent = "Copied ✓";
    } catch {
      $("mini-copy-btn").textContent = "Copy failed — select the text manually";
    }
    setTimeout(() => { $("mini-copy-btn").textContent = "Copy this snippet"; }, 1800);
  });

  // Mini search over sample notes + presets.
  const searchEl = $("mini-search");
  const resultsEl = $("mini-search-results");
  const items = [
    ...SAMPLE_NOTES.map((n) => ({ title: n.title, body: n.body })),
    ...PRESETS.map((p) => ({ title: p.title, body: p.body }))
  ];
  function renderMiniSearch(q) {
    const query = q.trim().toLowerCase();
    const hits = query
      ? items.filter((it) => (it.title + " " + it.body).toLowerCase().includes(query)).slice(0, 4)
      : items.slice(0, 3);
    resultsEl.innerHTML = hits.length
      ? hits.map((it) => {
          const idx = query ? it.title.toLowerCase().indexOf(query) : -1;
          const title = idx >= 0
            ? escapeHtml(it.title.slice(0, idx)) + '<span class="hit">' + escapeHtml(it.title.slice(idx, idx + query.length)) + "</span>" + escapeHtml(it.title.slice(idx + query.length))
            : escapeHtml(it.title);
          return `<li>${title}</li>`;
        }).join("")
      : `<li>No matches — try “photosynthesis” or “transformer”.</li>`;
  }
  searchEl.addEventListener("input", () => renderMiniSearch(searchEl.value));
  renderMiniSearch("");
}

/* ================= presets ================= */

const PRESET_ICONS = {
  cap: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v5"/></svg>',
  paper: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  meeting: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
};

function renderPresets() {
  $("preset-row").innerHTML = PRESETS.map((p) => `
    <article class="preset-card reveal in-view">
      <div class="preset-icon" aria-hidden="true">${PRESET_ICONS[p.icon] || PRESET_ICONS.cap}</div>
      <h3>${escapeHtml(p.label)}</h3>
      <p class="preset-tag">${escapeHtml(p.tagline)}</p>
      <p>${escapeHtml(p.title)} — load it and the summary, takeaways, flashcards and research brief appear instantly.</p>
      <button class="btn btn-primary" type="button" data-preset="${p.id}">Load “${escapeHtml(p.label)}” sample →</button>
    </article>
  `).join("");
  $("side-preset-list").innerHTML = PRESETS.map((p) => `
    <button class="side-preset-btn" type="button" data-preset="${p.id}">✦ ${escapeHtml(p.label)} — ${escapeHtml(p.tagline)}</button>
  `).join("");
  $$("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => loadPreset(btn.dataset.preset));
  });
}

/* ================= notes store UI ================= */

function renderNotesList(filter = "") {
  const list = $("notes-list");
  const q = filter.trim().toLowerCase();
  const notes = store.list().filter((n) => !q || (n.title + " " + (n.body || "")).toLowerCase().includes(q));
  list.innerHTML = "";
  for (const note of notes) {
    const li = document.createElement("li");
    li.className = "note-item" + (note.id === currentNoteId ? " active" : "");
    li.innerHTML = `
      <span class="note-item-title">${escapeHtml(note.title || "(Untitled note)")}</span>
      <span class="note-item-meta">${note.sample ? "Sample · " : ""}${note.preset ? "Preset · " : ""}${(note.body || "").split(/\s+/).filter(Boolean).length} words${note.tags && note.tags.length ? " · " + note.tags.map(escapeHtml).join(", ") : ""}</span>
    `;
    li.addEventListener("click", () => selectNote(note.id));
    list.appendChild(li);
  }
  if (!notes.length) {
    list.innerHTML = `<li class="note-item"><span class="note-item-meta">No notes match “${escapeHtml(filter)}”.</span></li>`;
  }
}

function selectNote(id) {
  const note = store.get(id);
  if (!note) return;
  currentNoteId = id;
  currentPresetId = note.preset || null;
  $("note-title").value = note.title || "";
  $("note-body").value = note.body || "";
  $("save-state").textContent = "";
  quizState = null;
  clearOutputs();
  renderNotesList($("note-search").value);
  $$(".side-preset-btn").forEach((b) => b.classList.toggle("active", b.dataset.preset === currentPresetId));
  if (currentPresetId) {
    const preset = getPreset(currentPresetId);
    if (preset) fillPresetOutputs(preset);
  }
  closeSidebarMobile();
}

function currentText() {
  const title = $("note-title").value.trim();
  const body = $("note-body").value.trim();
  return { title, body, combined: [title, body].filter(Boolean).join("\n\n") };
}

function saveCurrentNote(showState = true) {
  if (!currentNoteId) return null;
  const { title, body } = currentText();
  const note = store.update(currentNoteId, { title, body });
  if (showState) $("save-state").textContent = "Saved " + new Date().toLocaleTimeString();
  renderNotesList($("note-search").value);
  return note;
}

/** If the user edits a preset note, it stops being a preset — the
 *  pre-computed output no longer matches the text. */
function maybeInvalidatePreset() {
  if (!currentPresetId) return;
  const preset = getPreset(currentPresetId);
  const note = store.get(currentNoteId);
  if (preset && note && $("note-body").value.trim() !== preset.body.trim()) {
    currentPresetId = null;
    store.update(currentNoteId, { preset: null });
    $$(".side-preset-btn").forEach((b) => b.classList.remove("active"));
    clearOutputs();
  }
}

/* ================= output rendering ================= */

function resultBadge(result) {
  if (result.source === "on-device") return `<span class="badge badge-device">✦ On-device · ${escapeHtml(result.model)}</span>`;
  if (result.source === "cloud") return `<span class="badge badge-cloud">☁ Cloud · ${escapeHtml(result.model)}</span>`;
  return `<span class="badge badge-demo" title="Live AI was busy — this is a local preview, not live AI output.">◐ Live Preview Mode · Local preview</span>`;
}

function setWsBadge(source) {
  const el = $("ws-badge");
  if (source === "on-device") { el.className = "ws-badge live"; el.textContent = "✦ On-device"; }
  else if (source === "cloud") { el.className = "ws-badge cloud"; el.textContent = "☁ Cloud"; }
  else { el.className = "ws-badge"; el.textContent = "◐ Live Preview"; }
  lastBadge = source;
}

function switchTab(tab) {
  activeTab = tab;
  $$(".output-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === tab));
}

function clearOutputs() {
  lastOutputs = { summary: null, takeaways: null, quiz: null, research: null };
  $("panel-summary").innerHTML = `<p class="ai-empty">Pick a note, then run one of the AI actions. Results appear here — with a badge that says exactly where they ran.</p>`;
  $("panel-takeaways").innerHTML = `<p class="ai-empty">Key takeaways appear here after you summarize or research a note.</p>`;
  $("panel-flashcards").innerHTML = `<p class="ai-empty">Flashcards appear here after you run “Quiz me”.</p>`;
  $("panel-research").innerHTML = `<p class="ai-empty">The structured research brief appears here after “Deep research”.</p>`;
  setWsBadge("demo");
}

function renderSkeleton(panelId, label) {
  $(panelId).innerHTML = `
    <p class="skeleton-label">${escapeHtml(label)}</p>
    <div class="skeleton" aria-hidden="true">
      <div class="skeleton-line"></div>
      <div class="skeleton-line mid"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
    </div>`;
}

function resultHead(result) {
  let html = `<div class="result-head">${resultBadge(result)}<span class="latency">${result.latencyMs ? result.latencyMs + " ms" : "instant"}</span></div>`;
  if (result.fallbackReason) {
    html += `<p class="preview-note">◐ ${escapeHtml(result.fallbackReason)}</p>`;
  }
  return html;
}

function typewriterInto(el, text) {
  if (reducedMotion) { el.textContent = text; return; }
  el.innerHTML = "";
  let i = 0;
  const step = Math.max(4, Math.min(14, Math.floor(2400 / Math.max(text.length, 1))));
  const timer = setInterval(() => {
    i += 3;
    el.textContent = text.slice(0, i);
    if (i >= text.length) { clearInterval(timer); el.textContent = text; }
  }, step);
}

function renderSummary(result) {
  const d = result.data;
  const panel = $("panel-summary");
  panel.innerHTML = resultHead(result) + `<h3>Summary</h3><p id="summary-text"></p>` +
    (d.title ? `<p><strong>Suggested title:</strong> ${escapeHtml(d.title)} <button class="btn btn-ghost btn-small" id="use-title-btn" type="button">Use this title</button></p>` : "") +
    (d.tags && d.tags.length ? `<p><strong>Tags:</strong> ${d.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</p>` : "");
  typewriterInto($("summary-text"), d.summary || "");
  const useTitle = $("use-title-btn");
  if (useTitle) {
    useTitle.addEventListener("click", () => {
      $("note-title").value = result.data.title;
      saveCurrentNote();
    });
  }
  lastOutputs.summary = result;
  setWsBadge(result.source);
}

function renderTakeaways(items, result, mindmap) {
  const panel = $("panel-takeaways");
  let html = result ? resultHead(result) : "";
  if (mindmap) {
    html += `<div class="mindmap"><span class="mindmap-center">${escapeHtml(mindmap.center)}</span><div class="mindmap-branches">` +
      mindmap.branches.map((b, i) => `
        <div class="mindmap-branch" style="animation-delay:${i * 0.07}s">
          <h4>${escapeHtml(b.label)}</h4>
          <ul>${b.children.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
        </div>`).join("") +
      `</div></div>`;
  }
  html += `<h3>Key takeaways</h3><ul>${items.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`;
  panel.innerHTML = html;
  lastOutputs.takeaways = { items, mindmap: mindmap || null, result: result || null };
}

function renderQuiz(result) {
  const panel = $("panel-flashcards");
  let html = resultHead(result) + `<h3>Quiz — ${result.data.questions.length} questions</h3>`;
  html += result.data.questions.map((q, qi) => `
    <div class="quiz-q" data-qi="${qi}" style="animation-delay:${qi * 0.08}s">
      <p><strong>Q${qi + 1}.</strong> ${escapeHtml(q.q)}</p>
      <div class="quiz-options">${q.options.map((opt, oi) => `<button class="quiz-opt" data-qi="${qi}" data-oi="${oi}" type="button">${escapeHtml(opt)}</button>`).join("")}</div>
      <p class="quiz-feedback" id="quiz-feedback-${qi}"></p>
    </div>`).join("");
  panel.innerHTML = html;
  quizState = result.data.questions;
  panel.querySelectorAll(".quiz-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const qi = Number(btn.dataset.qi);
      const oi = Number(btn.dataset.oi);
      const q = quizState[qi];
      const feedback = $(`quiz-feedback-${qi}`);
      panel.querySelectorAll(`.quiz-opt[data-qi="${qi}"]`).forEach((b) => (b.disabled = true));
      if (oi === q.answer) {
        btn.classList.add("correct");
        feedback.textContent = "✓ Correct. " + (q.why || "");
      } else {
        btn.classList.add("wrong");
        panel.querySelector(`.quiz-opt[data-qi="${qi}"][data-oi="${q.answer}"]`)?.classList.add("correct");
        feedback.textContent = "✗ Not quite. " + (q.why || "");
      }
    });
  });
  lastOutputs.quiz = result;
  setWsBadge(result.source);
}

function renderResearch(result) {
  const panel = $("panel-research");
  panel.innerHTML = resultHead(result) + markdownToHtml(result.data.markdown);
  lastOutputs.research = result;
  setWsBadge(result.source);
}

function fillPresetOutputs(preset) {
  const out = preset.output;
  const previewResult = (kind, data) => ({
    kind, source: "demo", model: "Live Preview Mode (local preview)", latencyMs: 0, data,
    fallbackReason: "Live Preview Mode — pre-computed sample output, shown instantly."
  });
  renderSummary(previewResult("summary", out.summary));
  renderTakeaways(out.takeaways, previewResult("summary", out.summary), out.mindmap || null);
  renderQuiz(previewResult("quiz", { questions: out.quiz }));
  renderResearch(previewResult("research", { markdown: out.research }));
  switchTab("summary");
}

/* ================= AI runs ================= */

function needText() {
  const { body } = currentText();
  if (!body || body.split(/\s+/).filter(Boolean).length < 5) {
    $("panel-summary").innerHTML = `<p class="ai-hint">Write at least a few sentences in the note first — the AI needs something to work with. Or load a 1-click sample below.</p>`;
    switchTab("summary");
    return false;
  }
  return true;
}

async function runAi(kind) {
  if (!needText()) return;
  saveCurrentNote(false);
  const { body, combined } = currentText();

  // Preset notes: instant pre-computed output, no API call at all.
  if (currentPresetId) {
    const preset = getPreset(currentPresetId);
    if (preset) { fillPresetOutputs(preset); switchTab(kind === "quiz" ? "flashcards" : kind === "research" ? "research" : "summary"); return; }
  }

  const panelFor = { summary: "panel-summary", research: "panel-research", quiz: "panel-flashcards" };
  const labels = { summary: "Summarizing…", research: "Researching in the cloud…", quiz: "Writing your quiz…" };
  renderSkeleton(panelFor[kind], labels[kind]);
  switchTab(kind === "quiz" ? "flashcards" : kind);

  try {
    const input = kind === "summary" ? combined : body;
    const result =
      kind === "summary" ? await aiService.summarize(input)
      : kind === "research" ? await aiService.research(input)
      : await aiService.quiz(input);
    if (kind === "summary") {
      renderSummary(result);
      renderTakeaways(takeawaysDemo(body), result);
    } else if (kind === "research") {
      renderResearch(result);
      const ideas = parseKeyIdeas(result.data.markdown);
      renderTakeaways(ideas.length ? ideas : takeawaysDemo(body), result);
    } else {
      renderQuiz(result);
    }
  } catch (err) {
    // Backstop: the AI service already falls back internally, so reaching
    // here is unexpected. Never show the raw error — local preview instead.
    console.warn("[notewise] unexpected AI failure, showing local preview:", err);
    const previewReason = "Live AI is busy right now — showing a local preview instead.";
    if (kind === "summary") {
      const demo = summarizeDemo(body);
      renderSummary({ ...demo, fallbackReason: previewReason });
      renderTakeaways(takeawaysDemo(body), { ...demo, fallbackReason: previewReason });
    } else if (kind === "research") {
      const demo = researchDemo(body);
      renderResearch({ ...demo, fallbackReason: previewReason });
      renderTakeaways(takeawaysDemo(body), { ...demo, fallbackReason: previewReason });
    } else {
      const demo = quizDemo(body);
      renderQuiz({ ...demo, fallbackReason: previewReason });
    }
  }
}

async function generateAll() {
  if (!needText()) return;
  if (currentPresetId) {
    const preset = getPreset(currentPresetId);
    if (preset) { fillPresetOutputs(preset); return; }
  }
  await runAi("summary");
  await runAi("research");
  await runAi("quiz");
  switchTab("summary");
}

/* ================= presets: loading ================= */

function loadPreset(id) {
  const preset = getPreset(id);
  if (!preset) return;
  const note = store.create();
  store.update(note.id, { title: preset.title, body: preset.body, preset: preset.id, sample: true });
  selectNote(note.id);
  document.getElementById("workspace").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
}

/* ================= copy / export ================= */

function activePanelText() {
  const panel = document.querySelector(`.tab-panel[data-panel="${activeTab}"]`);
  return panel ? panel.innerText.trim() : "";
}

async function copyActiveTab() {
  const text = activePanelText();
  const btn = $("copy-tab-btn");
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied ✓";
  } catch {
    btn.textContent = "Copy failed";
  }
  setTimeout(() => { btn.textContent = "⧉ Copy this tab"; }, 1800);
}

function buildMarkdownExport() {
  const { title, body } = currentText();
  const lines = [`# ${title || "Untitled note"}`, ""];
  lines.push("## Original note", "", body, "");
  if (lastOutputs.summary) {
    const d = lastOutputs.summary.data;
    lines.push("## Summary", "", d.summary || "", "");
    if (d.title) lines.push(`Suggested title: ${d.title}`, "");
    if (d.tags && d.tags.length) lines.push(`Tags: ${d.tags.join(", ")}`, "");
  }
  if (lastOutputs.takeaways) {
    lines.push("## Key takeaways", "", ...lastOutputs.takeaways.items.map((t) => `- ${t}`), "");
  }
  if (lastOutputs.quiz) {
    lines.push("## Flashcards / Quiz", "");
    lastOutputs.quiz.data.questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.q}`);
      q.options.forEach((o, oi) => lines.push(`   ${oi === q.answer ? "✓" : "·"} ${o}`));
      if (q.why) lines.push(`   _${q.why}_`);
      lines.push("");
    });
  }
  if (lastOutputs.research) {
    lines.push("## Research brief", "", lastOutputs.research.data.markdown, "");
  }
  lines.push("---", "", `Exported from Notewise (notewiseapp.vercel.app) — ${lastBadge ? `last output: ${lastBadge}` : "no AI output yet"}.`);
  return lines.join("\n");
}

function exportMarkdown() {
  const md = buildMarkdownExport();
  const blob = new Blob([md], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${($("note-title").value.trim() || "notewise-note").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ================= sidebar / file drop / shortcuts ================= */

function closeSidebarMobile() {
  $("workspace-shell").classList.remove("sidebar-open");
}

function initWorkspaceChrome() {
  $$(".output-tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  $("copy-tab-btn").addEventListener("click", copyActiveTab);
  $("export-md-btn").addEventListener("click", exportMarkdown);

  $("sidebar-collapse-btn").addEventListener("click", () => {
    $("workspace-shell").classList.toggle("sidebar-hidden");
  });
  $("sidebar-open-btn").addEventListener("click", () => {
    const shell = $("workspace-shell");
    if (window.innerWidth <= 820) shell.classList.toggle("sidebar-open");
    else shell.classList.remove("sidebar-hidden");
  });
  $("note-search").addEventListener("input", (e) => renderNotesList(e.target.value));

  $("new-note-btn").addEventListener("click", () => {
    const note = store.create();
    selectNote(note.id);
    $("note-title").focus();
  });
  $("save-note-btn").addEventListener("click", () => saveCurrentNote());
  $("delete-note-btn").addEventListener("click", () => {
    if (!currentNoteId) return;
    if (!window.confirm("Delete this note?")) return;
    store.remove(currentNoteId);
    const remaining = store.list();
    if (remaining.length) selectNote(remaining[0].id);
    else selectNote(store.create().id);
  });
  $("note-title").addEventListener("input", () => saveCurrentNote(false));
  $("note-body").addEventListener("input", () => { maybeInvalidatePreset(); saveCurrentNote(false); });

  $("generate-all-btn").addEventListener("click", generateAll);
  $("summarize-btn").addEventListener("click", () => runAi("summary"));
  $("research-btn").addEventListener("click", () => runAi("research"));
  $("quiz-btn").addEventListener("click", () => runAi("quiz"));
  $("hero-sample-btn").addEventListener("click", () => loadPreset("lecture-nn"));

  // File drop + import.
  const pane = $("editor-pane");
  const overlay = $("drop-overlay");
  let dragDepth = 0;
  pane.addEventListener("dragenter", (e) => { e.preventDefault(); dragDepth++; overlay.classList.add("show"); });
  pane.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.classList.remove("show"); });
  pane.addEventListener("dragover", (e) => e.preventDefault());
  pane.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    overlay.classList.remove("show");
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadTextFile(file);
  });
  $("import-file-btn").addEventListener("click", () => $("import-file-input").click());
  $("import-file-input").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadTextFile(file);
    e.target.value = "";
  });

  // Keyboard shortcuts.
  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "Enter") { e.preventDefault(); generateAll(); }
    if (mod && (e.key === "s" || e.key === "S")) { e.preventDefault(); exportMarkdown(); }
    if (e.key === "Escape") closeSidebarMobile();
  });
}

function loadTextFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    if (!text.trim()) return;
    if (!currentNoteId) return;
    currentPresetId = null;
    $("note-body").value = text;
    if (!$("note-title").value.trim()) {
      $("note-title").value = file.name.replace(/\.(txt|md)$/i, "").replace(/[-_]+/g, " ");
    }
    saveCurrentNote();
    clearOutputs();
  };
  reader.readAsText(file);
}

/* ================= init ================= */

function init() {
  const { app } = initFirebase();
  aiService = new AIService(app);
  refreshEngineStatus();
  setTimeout(refreshEngineStatus, 3000);

  initHeroCanvas();
  initTilt();
  initPreviewLoop();
  initReveals();
  initBento();
  renderPresets();
  initWorkspaceChrome();

  const notes = store.list();
  selectNote(notes[0].id);
}

document.addEventListener("DOMContentLoaded", init);
