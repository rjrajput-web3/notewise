/**
 * AI service for Notewise — Firebase AI Logic hybrid inference.
 *
 * This is the real integration, not a stub:
 *  - Summarize uses HYBRID inference (InferenceMode.PREFER_ON_DEVICE):
 *    the Firebase AI Logic SDK runs the prompt on Gemini Nano in the browser
 *    when a local model is available and falls back to the cloud otherwise.
 *  - Deep research and Quiz use the CLOUD model (gemini-3.8-flash) via the
 *    same SDK, because they need deeper reasoning than a small on-device
 *    model.
 *  - Every result reports its real inference source
 *    (response.inferenceSource: "on_device" or "in_cloud").
 *
 * If Firebase AI Logic is not enabled in the project yet, or the call fails
 * for any other reason, the call falls back to the local demo engine
 * (src/demo.js) and the result is CLEARLY labelled as a demo result,
 * including the reason for the fallback. Demo results are never presented
 * as real AI output.
 */
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { summarizeDemo, researchDemo, quizDemo } from "./demo.js";

// Cloud fallback model. gemini-2.5-flash was retired by Google for new
// users (the API returned 404 "This model models/gemini-2.5-flash is no
// longer available to new users" on 2026-11-13) and the error itself named
// gemini-3.8-flash as the replacement. gemini-3.8-flash is Google's current
// Flash-tier model on the Gemini Developer API (released 2026-09-02, free
// tier available) — the same backend Firebase AI Logic uses here.
const CLOUD_MODEL = "gemini-3.8-flash";

const SUMMARIZE_PROMPT = `You are an on-device study assistant running on Gemini Nano.
Summarize the note below in 2-3 short sentences, suggest a title of at most 8 words,
and suggest up to 5 short topic tags.
Reply with JSON ONLY, no markdown fences, no extra text:
{"summary": "...", "title": "...", "tags": ["...", "..."]}

NOTE:
`;

const RESEARCH_PROMPT = `You are a research assistant.
Read the note below and write a structured research brief in Markdown with exactly
these sections:
## Key ideas
3-5 bullet points, each one sentence.
## Background
2-3 sentences of context a reader needs to understand the topic.
## Connections
2-3 bullets linking ideas in the note to each other or to wider concepts.
## Open questions
3 questions worth exploring next.
Keep the whole brief under 250 words. Do not invent facts that are not in, or
directly implied by, the note; if something is uncertain, say so.

NOTE:
`;

const QUIZ_PROMPT = `You are a study assistant.
Create exactly 5 multiple-choice questions based ONLY on the note below.
Each question must have 4 options and exactly one correct answer.
Reply with JSON ONLY, no markdown fences, no extra text:
[{"q": "...", "options": ["...", "...", "...", "..."], "answer": 0, "why": "one short sentence"}]
"answer" is the index (0-3) of the correct option. Do not invent facts that are
not in the note.

NOTE:
`;

function stripCodeFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(stripCodeFences(text));
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    const arrStart = text.indexOf("[");
    const arrEnd = text.lastIndexOf("]");
    if (arrStart >= 0 && arrEnd > arrStart) {
      try {
        return JSON.parse(text.slice(arrStart, arrEnd + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export class AIService {
  constructor(firebaseApp) {
    this.firebaseApp = firebaseApp;
    this.ai = null;
    this.initError = null;
    try {
      // Real Firebase AI Logic client SDK, Gemini Developer API backend.
      this.ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
    } catch (err) {
      this.initError = err;
    }
  }

  get status() {
    if (this.initError) return { mode: "demo", reason: this.initError.message };
    if (!this.ai) return { mode: "demo", reason: "Firebase AI Logic is not initialized." };
    return { mode: "firebase", reason: null };
  }

  /** Hybrid model: prefer on-device Gemini Nano, fall back to cloud. */
  _hybridModel() {
    return getGenerativeModel(this.ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: CLOUD_MODEL }
    });
  }

  /** Cloud-only model. */
  _cloudModel() {
    return getGenerativeModel(this.ai, { model: CLOUD_MODEL });
  }

  async _generate(model, prompt, timeoutMs) {
    const started = Date.now();
    const result = await model.generateContent(
      { contents: [{ role: "user", parts: [{ text: prompt }] }] },
      { timeout: timeoutMs }
    );
    const response = result.response;
    const source = response.inferenceSource || null; // "on_device" | "in_cloud"
    return { text: response.text(), source, latencyMs: Date.now() - started };
  }

  /**
   * Summarize on-device (Nano) with cloud fallback.
   * Returns { kind, source, model, latencyMs, data, fallbackReason? }
   */
  async summarize(text) {
    if (!this.ai) {
      return { ...summarizeDemo(text), fallbackReason: this._initReason() };
    }
    try {
      const { text: raw, source, latencyMs } = await this._generate(
        this._hybridModel(),
        SUMMARIZE_PROMPT + text,
        60000
      );
      const parsed = safeJsonParse(raw);
      const data = parsed || { summary: raw, title: "", tags: [] };
      return {
        kind: "summary",
        source: source === "on_device" ? "on-device" : "cloud",
        model: source === "on_device" ? "Gemini Nano (on-device)" : "Gemini 3.8 Flash (cloud fallback)",
        latencyMs,
        data
      };
    } catch (err) {
      return { ...summarizeDemo(text), fallbackReason: this._describeError(err) };
    }
  }

  /** Deep research brief — cloud Gemini. */
  async research(text) {
    if (!this.ai) {
      return { ...researchDemo(text), fallbackReason: this._initReason() };
    }
    try {
      const { text: raw, source, latencyMs } = await this._generate(
        this._cloudModel(),
        RESEARCH_PROMPT + text,
        90000
      );
      return {
        kind: "research",
        source: source === "on_device" ? "on-device" : "cloud",
        model: "Gemini 3.8 Flash (cloud)",
        latencyMs,
        data: { markdown: raw }
      };
    } catch (err) {
      return { ...researchDemo(text), fallbackReason: this._describeError(err) };
    }
  }

  /** 5-question quiz — cloud Gemini. */
  async quiz(text) {
    if (!this.ai) {
      return { ...quizDemo(text), fallbackReason: this._initReason() };
    }
    try {
      const { text: raw, source, latencyMs } = await this._generate(
        this._cloudModel(),
        QUIZ_PROMPT + text,
        90000
      );
      const parsed = safeJsonParse(raw);
      const questions = Array.isArray(parsed) ? parsed.slice(0, 5) : null;
      if (!questions || questions.length === 0) {
        return { ...quizDemo(text), fallbackReason: "Cloud reply was not valid quiz JSON." };
      }
      return {
        kind: "quiz",
        source: source === "on_device" ? "on-device" : "cloud",
        model: "Gemini 3.8 Flash (cloud)",
        latencyMs,
        data: { questions }
      };
    } catch (err) {
      return { ...quizDemo(text), fallbackReason: this._describeError(err) };
    }
  }

  _initReason() {
    if (this.initError) return this._describeError(this.initError);
    return "Firebase AI Logic is not initialized in this build.";
  }

  _describeError(err) {
    const msg = (err && (err.message || err.code || String(err))) || "Unknown error";
    // App Check 401: enforcement is ON for the AI Logic API in the console,
    // but this app ships with NO App Check provider in production (no
    // reCAPTCHA site key configured — see src/firebase.js). The backend
    // rejects every call until enforcement is turned off or a site key is
    // added. This is a console setting, not a code bug — say so plainly.
    if (/app[- ]?check|401/i.test(msg)) {
      return (
        "Firebase AI Logic rejected the request (App Check): enforcement is ON for this project, " +
        "but the app has no App Check provider configured in production. " +
        "Fix in the Firebase console: App Check → APIs → Firebase AI Logic API → set enforcement to 'Not enforced' " +
        "(or create a reCAPTCHA Enterprise site key and set VITE_APPCHECK_SITE_KEY). " +
        "Original error: " + msg
      );
    }
    // Model retired: Google returns 404 "This model models/<name> is no
    // longer available to new users" and names the replacement in the
    // message. Say plainly that CLOUD_MODEL must be updated to the model
    // the error names — no console step fixes this.
    if (/404|no longer available|models\/gemini/i.test(msg)) {
      return (
        "The cloud model this app calls is no longer available: " + msg +
        " Fix in code: update CLOUD_MODEL in src/ai.js to the replacement model named in the error, then redeploy."
      );
    }
    // AI Logic not yet enabled in the console surfaces as a 403 / failed-precondition.
    if (/403|permission|not enabled|failed-precondition|API has not been used/i.test(msg)) {
      return (
        "Firebase AI Logic returned an error — it is not enabled for this project yet. " +
        "Enable it in the Firebase console (AI Logic > Get started) and retry. " +
        "Original error: " + msg
      );
    }
    if (/network|fetch|Failed to fetch/i.test(msg)) {
      return "Network error reaching Firebase AI Logic: " + msg;
    }
    return msg;
  }
}
