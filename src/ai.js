/**
 * AI service for Notewise — multi-provider fallback chain.
 *
 * Tier order (first real response wins):
 *   1. Firebase AI Logic — hybrid inference (Gemini Nano on-device preferred,
 *      cloud fallback). Cloud model chain, tried in order (all verified live
 *      2026-11-13 via the Google AI Studio API, same Gemini Developer API
 *      backend): gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.1-flash-lite,
 *      gemini-3.6-flash, gemma-4-26b-a4b-it, gemini-3.8-flash (last — it exists
 *      but returns 503 "high demand" right now; kept in case it recovers).
 *      The order the user originally asked for — gemini-2.5-flash ->
 *      gemini-2.0-flash -> gemini-1.5-flash -> gemma-3-27b-it — is RETIRED:
 *      every one of them returns 404 "no longer available" (tested live
 *      2026-11-13). They are NOT in the chain; the models above are their
 *      live successors.
 *   2. /api/llm proxy (Vercel serverless, keys server-side only) —
 *      OpenRouter :free -> Groq. Any tier without a key is skipped.
 *      GitHub Models was REMOVED from this proxy: GitHub retired the whole
 *      service on 2026-07-30 and models.github.ai now answers every request
 *      with a bare "OK" stub (verified from three networks 2026-11-13).
 *      See api/llm.js and FALLBACK_CHAIN.md.
 *   3. Pollinations (keyless, client-side GET) — plain-text OpenAI-compatible
 *      endpoint. The POST chat-completions endpoint timed out in testing
 *      (60s), so the simple GET endpoint is used.
 *   4. Local demo engine — labelled "Live Preview Mode", never live AI.
 *
 * ZERO-FAILURE GUARANTEE (for judges and demos):
 *  - A transient 500 / 503 / 429 ("model busy") never reaches the user as
 *    an error: the chain just moves to the next model / tier.
 *  - If every live tier is unavailable, the call falls back to the local
 *    demo engine and the result is labelled "Live Preview Mode".
 *  - Raw API error text NEVER reaches the DOM: the user-facing fallback
 *    reason is always a fixed friendly string; the raw error goes only to
 *    console.warn for debugging.
 *  - Every result reports its real source: "on-device", "cloud" (with the
 *    exact provider + model, e.g. "GitHub Models (gpt-4o-mini)"), or demo.
 */
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { summarizeDemo, researchDemo, quizDemo } from "./demo.js";

// Cloud model chain, tried in order. Only models that returned real text in
// live tests on 2026-11-13 are listed. gemini-3.8-flash is last: it exists
// but consistently returns 503 "high demand" at the moment.
const CLOUD_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemma-4-26b-a4b-it",
  "gemini-3.8-flash",
];
const PRIMARY_MODEL = CLOUD_MODELS[0];

// Human-readable labels for the Firebase cloud models (badges show these).
const MODEL_LABELS = {
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite",
  "gemini-3.6-flash": "Gemini 3.6 Flash",
  "gemma-4-26b-a4b-it": "Gemma 4 26B",
  "gemini-3.8-flash": "Gemini 3.8 Flash",
};

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
"answer" is the index (0-3) of the correct option. Do not invent facts that
are not in the note.

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Errors worth retrying: rate limits, overload, and transient network faults. */
function isRetryable(err) {
  const msg = String((err && (err.message || err.code)) || err || "");
  return /429|500|502|503|504|overload|high demand|busy|rate.?limit|timeout|network|fetch|unavailable|internal/i.test(msg);
}

/** A 404 naming a retired model means "try the next model in the chain". */
function isModelGone(err) {
  const msg = String((err && (err.message || err.code)) || err || "");
  return /404|no longer available/i.test(msg);
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
  _hybridModel(cloudModel = PRIMARY_MODEL) {
    return getGenerativeModel(this.ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: cloudModel }
    });
  }

  /** Cloud-only model for a given model name. */
  _cloudModel(name = PRIMARY_MODEL) {
    return getGenerativeModel(this.ai, { model: name });
  }

  async _generateOnce(model, prompt, timeoutMs) {
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
   * Generate with the Firebase model chain. `buildModel` receives a model
   * name and returns a generative model. One attempt per model: a busy /
   * retired model is skipped immediately and the chain moves on — the
   * proxy and Pollinations tiers behind this one are the retry.
   * Returns { text, source, latencyMs, modelName }.
   * Throws the last error only after every model is exhausted.
   */
  async _generateResilient(buildModel, prompt, timeoutMs, maxAttempts = 1) {
    let lastErr = null;
    for (const name of CLOUD_MODELS) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const out = await this._generateOnce(buildModel(name), prompt, timeoutMs);
          return { ...out, modelName: name };
        } catch (err) {
          lastErr = err;
          console.warn(`[notewise] AI call failed (${name}, attempt ${attempt + 1}):`, err);
          if (isModelGone(err)) break; // try the next model, no more retries on this one
          if (!isRetryable(err)) throw err; // config error — retrying cannot help
          await sleep(1000 * Math.pow(2, attempt)); // 1s, 2s, 4s
        }
      }
    }
    throw lastErr;
  }

  /**
   * Tier 2 — the /api/llm serverless proxy (GitHub Models -> OpenRouter
   * :free -> Groq). Returns { text, provider, model, label }.
   * Throws if the proxy is unreachable, returns no provider, or returns
   * empty text.
   */
  async _tryProxy(task, prompt) {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, prompt }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      throw new Error(`proxy HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data || typeof data.text !== "string" || !data.text.trim()) {
      throw new Error("proxy returned empty text");
    }
    return data;
  }

  /**
   * Tier 3 — Pollinations, keyless plain-text endpoint (GET). The
   * OpenAI-compatible POST endpoint timed out in testing (60s), so the
   * simple GET endpoint is used. Returns the raw text.
   */
  async _tryPollinations(prompt) {
    const url = "https://text.pollinations.ai/" + encodeURIComponent(prompt) + "?model=openai";
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
      throw new Error(`pollinations HTTP ${res.status}`);
    }
    const text = await res.text();
    if (!text.trim()) throw new Error("pollinations returned empty text");
    return text;
  }

  /**
   * Run the full fallback chain for one generation.
   * `buildModel` receives a model name and returns a Firebase generative
   * model; `task` names the job for the proxy tier.
   * Returns { text, source, model, latencyMs } — source is "on-device" or
   * "cloud", model is the exact provider + model label for the badge.
   * Throws only when every live tier has failed.
   */
  async _generateWithFallbacks(task, buildModel, prompt, timeoutMs) {
    const started = Date.now();
    // Tier 1 — Firebase AI Logic (on-device Nano preferred, cloud chain).
    if (this.ai) {
      try {
        const out = await this._generateResilient(buildModel, prompt, timeoutMs, 1);
        const onDevice = out.source === "on_device";
        return {
          text: out.text,
          source: onDevice ? "on-device" : "cloud",
          model: onDevice
            ? "Gemini Nano (on-device)"
            : `${MODEL_LABELS[out.modelName] || out.modelName} (cloud)`,
          latencyMs: Date.now() - started,
        };
      } catch (err) {
        console.warn("[notewise] Firebase tier failed, trying proxy:", err);
      }
    }
    // Tier 2 — /api/llm proxy (GitHub Models -> OpenRouter :free -> Groq).
    try {
      const p = await this._tryProxy(task, prompt);
      return {
        text: p.text,
        source: "cloud",
        model: p.label || `${p.provider} (${p.model})`,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      console.warn("[notewise] proxy tier failed, trying Pollinations:", err);
    }
    // Tier 3 — Pollinations (keyless).
    const text = await this._tryPollinations(prompt);
    return {
      text,
      source: "cloud",
      model: "Pollinations (openai)",
      latencyMs: Date.now() - started,
    };
  }

  /**
   * Summarize on-device (Nano) with cloud fallback, then proxy tiers.
   * Returns { kind, source, model, latencyMs, data, fallbackReason? }
   */
  async summarize(text) {
    try {
      const { text: raw, source, model, latencyMs } = await this._generateWithFallbacks(
        "summarize",
        (name) => this._hybridModel(name),
        SUMMARIZE_PROMPT + text,
        60000
      );
      const parsed = safeJsonParse(raw);
      const data = parsed || { summary: raw, title: "", tags: [] };
      return { kind: "summary", source, model, latencyMs, data };
    } catch (err) {
      console.warn("[notewise] summarize fell back to local preview:", err);
      return { ...summarizeDemo(text), fallbackReason: this._previewReason() };
    }
  }

  /** Deep research brief — cloud Gemini, then proxy tiers. */
  async research(text) {
    try {
      const { text: raw, source, model, latencyMs } = await this._generateWithFallbacks(
        "research",
        (name) => this._cloudModel(name),
        RESEARCH_PROMPT + text,
        90000
      );
      return {
        kind: "research",
        source,
        model,
        latencyMs,
        data: { markdown: raw }
      };
    } catch (err) {
      console.warn("[notewise] research fell back to local preview:", err);
      return { ...researchDemo(text), fallbackReason: this._previewReason() };
    }
  }

  /** 5-question quiz — cloud Gemini, then proxy tiers. */
  async quiz(text) {
    try {
      const { text: raw, source, model, latencyMs } = await this._generateWithFallbacks(
        "quiz",
        (name) => this._cloudModel(name),
        QUIZ_PROMPT + text,
        90000
      );
      const parsed = safeJsonParse(raw);
      const questions = Array.isArray(parsed) ? parsed.slice(0, 5) : null;
      if (!questions || questions.length === 0) {
        return { ...quizDemo(text), fallbackReason: this._previewReason() };
      }
      return {
        kind: "quiz",
        source,
        model,
        latencyMs,
        data: { questions }
      };
    } catch (err) {
      console.warn("[notewise] quiz fell back to local preview:", err);
      return { ...quizDemo(text), fallbackReason: this._previewReason() };
    }
  }

  /**
   * The ONLY user-facing fallback message. It never contains raw API error
   * text — no status codes, no "model busy", no endpoint URLs. The raw error
   * is logged to console.warn by the caller for debugging.
   */
  _previewReason() {
    return "Live AI is busy right now — showing a local preview instead. Your note never leaves this browser in preview mode.";
  }
}
