/**
 * Notewise LLM fallback proxy — one reusable free-tier LLM endpoint.
 *
 * POST /api/llm  { task, prompt }
 *
 * Tries providers in order and returns the first real response:
 *   1. OpenRouter      (OPENROUTER_API_KEY) — :free models only
 *   2. Groq            (GROQ_API_KEY)       — llama-3.3-70b-versatile, then 8b-instant
 * Any tier whose key is absent is skipped silently. Nothing here is ever
 * hardcoded: keys come from Vercel env vars only, never from client code
 * or git. Other pipelines can reuse this endpoint with any prompt.
 *
 * RETIRED — GitHub Models: GitHub shut the whole service down on
 * 2026-07-30 (closed to new customers 2026-06-16; playground, catalog,
 * inference API and BYOK all removed). models.github.ai now answers every
 * request with a bare text/plain "OK" stub — verified 2026-11-13 from three
 * independent networks (VM curl, Vercel function, web crawler), on both
 * /inference/chat/completions and /catalog/models, with and without auth.
 * The provider was removed from this proxy; do NOT re-add it without
 * re-verifying the endpoint serves real completions.
 *
 * OPENROUTER :free MODELS — VERIFIED LIVE 2026-11-13 with the user's own
 * key (via the stored custom.openrouter credential): the two models the
 * first build shipped (meta-llama/llama-3.3-70b-instruct:free and
 * google/gemma-3-27b-it:free) are BOTH 404 "unavailable for free" — OpenRouter
 * rotated its free tier. The three models below each returned real visible
 * text (finish_reason "stop") with max_tokens 500. NOTE: several :free
 * models are reasoning models — with a tiny max_tokens budget they burn it
 * all on thinking and return null content; the proxy's max_tokens 1500
 * avoids that. Re-check /api/v1/models before swapping this list.
 *
 * Response (success): { text, provider, model, latencyMs }
 * Response (all tiers failed / no keys): HTTP 503 { error, detail }
 *
 * CORS is open (*) so the endpoint is reusable from other pipelines.
 * An open proxy is an abuse risk on a public demo — the prompt is capped
 * at 12,000 chars and each provider attempt has an 8s timeout, so a single
 * call can never burn much quota. For production use, put this behind auth.
 */

const MAX_PROMPT_CHARS = 12000;
const ATTEMPT_TIMEOUT_MS = 8000;

const PROVIDERS = [
  {
    name: "openrouter",
    label: (m) => `OpenRouter (${m})`,
    env: "OPENROUTER_API_KEY",
    bases: [
      {
        url: "https://openrouter.ai/api/v1/chat/completions",
        models: [
          "recursive/flint-v1.0:free",
          "particle-ai/particle-1:free",
          "baidu/ernie-5.5-flash-preview:free",
        ],
      },
    ],
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://notewiseapp.vercel.app",
      "X-Title": "Notewise",
    }),
  },
  {
    name: "groq",
    label: (m) => `Groq (${m})`,
    env: "GROQ_API_KEY",
    bases: [
      {
        url: "https://api.groq.com/openai/v1/chat/completions",
        models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
      },
    ],
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
];

function extractText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content;
  return null;
}

async function tryOnce(url, key, model, prompt, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers(key),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status} ${body.slice(0, 120)}`);
    }
    const data = await res.json();
    const text = extractText(data);
    if (!text) throw new Error("empty completion");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const started = Date.now();
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
  if (!prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
    return res.status(400).json({ error: "bad_prompt" });
  }

  const failures = [];
  for (const provider of PROVIDERS) {
    const key = process.env[provider.env];
    if (!key) continue; // tier absent — skip gracefully, never an error
    for (const base of provider.bases) {
      for (const model of base.models) {
        try {
          const text = await tryOnce(base.url, key, model, prompt, provider.headers);
          return res.status(200).json({
            text,
            provider: provider.name,
            model,
            label: provider.label(model),
            latencyMs: Date.now() - started,
          });
        } catch (err) {
          failures.push(`${provider.name}/${model}: ${String(err.message || err).slice(0, 100)}`);
          // 404/400 = model gone — next model. Anything else — next model too;
          // the client tier loop is the retry, this proxy stays fast.
        }
      }
    }
  }

  return res.status(503).json({
    error: "no_provider_available",
    detail: failures.length ? failures.join(" | ") : "no LLM provider key configured",
  });
}
