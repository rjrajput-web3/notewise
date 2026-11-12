/**
 * Notewise — UI wiring.
 *
 * One clear flow: pick or write a note → run an AI action → read the result
 * with a badge that says exactly where it ran (on-device Nano, cloud
 * Gemini, or local demo). Nothing here invents results: every AI answer
 * comes from the AIService, and demo results are labelled as demo.
 */
import "./styles.css";
import { initFirebase, getAuthState, getFirestoreState } from "./firebase.js";
import { AIService } from "./ai.js";
import { NotesStore } from "./store.js";

const $ = (id) => document.getElementById(id);

const store = new NotesStore();
let aiService = null;
let currentNoteId = null;
let quizState = null;

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
    setEngineStatus("demo", "Demo mode — AI Logic not enabled yet");
  }
  $("mode-note").textContent =
    status.mode === "firebase"
      ? `Connected to project hybridai-smart-notes. Firestore: ${fs}; Auth: ${auth}.`
      : `Demo mode: ${status.reason} Firestore: ${fs}; Auth: ${auth}.`;
}

function renderNotesList() {
  const list = $("notes-list");
  list.innerHTML = "";
  for (const note of store.list()) {
    const li = document.createElement("li");
    li.className = "note-item" + (note.id === currentNoteId ? " active" : "");
    li.innerHTML = `
      <span class="note-item-title">${escapeHtml(note.title || "(Untitled note)")}</span>
      <span class="note-item-meta">${note.sample ? "Sample · " : ""}${(note.body || "").split(/\s+/).filter(Boolean).length} words${note.tags && note.tags.length ? " · " + note.tags.map(escapeHtml).join(", ") : ""}</span>
    `;
    li.addEventListener("click", () => selectNote(note.id));
    list.appendChild(li);
  }
}

function selectNote(id) {
  const note = store.get(id);
  if (!note) return;
  currentNoteId = id;
  $("note-title").value = note.title || "";
  $("note-body").value = note.body || "";
  $("save-state").textContent = "";
  quizState = null;
  renderNotesList();
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
  renderNotesList();
  return note;
}

function resultBadge(result) {
  if (result.source === "on-device") return `<span class="badge badge-device">✦ On-device · ${escapeHtml(result.model)}</span>`;
  if (result.source === "cloud") return `<span class="badge badge-cloud">☁ Cloud · ${escapeHtml(result.model)}</span>`;
  return `<span class="badge badge-demo">Demo mode · ${escapeHtml(result.model)}</span>`;
}

function renderResult(result) {
  const out = $("ai-output");
  let html = `<div class="result-head">${resultBadge(result)}<span class="latency">${result.latencyMs ? result.latencyMs + " ms" : "instant"}</span></div>`;
  if (result.fallbackReason) {
    html += `<p class="fallback-note">⚠ ${escapeHtml(result.fallbackReason)}</p>`;
  }
  if (result.kind === "summary") {
    const d = result.data;
    html += `<h3>Summary</h3><p>${escapeHtml(d.summary)}</p>`;
    if (d.title) {
      html += `<p><strong>Suggested title:</strong> ${escapeHtml(d.title)} <button class="btn btn-ghost btn-small" id="use-title-btn">Use this title</button></p>`;
    }
    if (d.tags && d.tags.length) {
      html += `<p><strong>Tags:</strong> ${d.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</p>`;
    }
  } else if (result.kind === "research") {
    html += markdownToHtml(result.data.markdown);
  } else if (result.kind === "quiz") {
    html += `<h3>Quiz — ${result.data.questions.length} questions</h3>`;
    html += result.data.questions
      .map((q, qi) => {
        return `<div class="quiz-q" data-qi="${qi}">
          <p><strong>Q${qi + 1}.</strong> ${escapeHtml(q.q)}</p>
          <div class="quiz-options">${q.options
            .map((opt, oi) => `<button class="quiz-opt" data-qi="${qi}" data-oi="${oi}">${escapeHtml(opt)}</button>`)
            .join("")}</div>
          <p class="quiz-feedback" id="quiz-feedback-${qi}"></p>
        </div>`;
      })
      .join("");
    quizState = result.data.questions;
  }
  out.innerHTML = html;

  const useTitle = $("use-title-btn");
  if (useTitle) {
    useTitle.addEventListener("click", () => {
      $("note-title").value = result.data.title;
      saveCurrentNote();
    });
  }
  out.querySelectorAll(".quiz-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const qi = Number(btn.dataset.qi);
      const oi = Number(btn.dataset.oi);
      const q = quizState[qi];
      const feedback = $(`quiz-feedback-${qi}`);
      out.querySelectorAll(`.quiz-opt[data-qi="${qi}"]`).forEach((b) => (b.disabled = true));
      if (oi === q.answer) {
        btn.classList.add("correct");
        feedback.textContent = "✓ Correct. " + (q.why || "");
      } else {
        btn.classList.add("wrong");
        out.querySelector(`.quiz-opt[data-qi="${qi}"][data-oi="${q.answer}"]`)?.classList.add("correct");
        feedback.textContent = "✗ Not quite. " + (q.why || "");
      }
    });
  });
}

function renderLoading(actionLabel) {
  $("ai-output").innerHTML = `<p class="ai-loading">${escapeHtml(actionLabel)}…</p>`;
}

async function runAi(kind) {
  const { body, combined } = currentText();
  if (!body || body.split(/\s+/).filter(Boolean).length < 5) {
    $("ai-output").innerHTML =
      `<p class="ai-error">Write at least a few sentences in the note first — the AI needs something to work with.</p>`;
    return;
  }
  saveCurrentNote(false);
  const labels = { summary: "Summarizing on-device", research: "Researching in the cloud", quiz: "Writing your quiz" };
  renderLoading(labels[kind]);
  // Research and quiz work from the note body only; the title would
  // otherwise be repeated verbatim in the demo brief.
  const input = kind === "summary" ? combined : body;
  try {
    const result =
      kind === "summary"
        ? await aiService.summarize(input)
        : kind === "research"
          ? await aiService.research(input)
          : await aiService.quiz(input);
    renderResult(result);
  } catch (err) {
    $("ai-output").innerHTML = `<p class="ai-error">Something went wrong: ${escapeHtml(err.message || String(err))}</p>`;
  }
}

function init() {
  const { app } = initFirebase();
  aiService = new AIService(app);
  refreshEngineStatus();
  // Auth state settles async; refresh the footer note once it does.
  setTimeout(refreshEngineStatus, 3000);

  const notes = store.list();
  selectNote(notes[0].id);

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
    else {
      const note = store.create();
      selectNote(note.id);
    }
  });
  $("note-title").addEventListener("input", () => saveCurrentNote(false));
  $("note-body").addEventListener("input", () => saveCurrentNote(false));

  $("summarize-btn").addEventListener("click", () => runAi("summary"));
  $("research-btn").addEventListener("click", () => runAi("research"));
  $("quiz-btn").addEventListener("click", () => runAi("quiz"));
}

document.addEventListener("DOMContentLoaded", init);
