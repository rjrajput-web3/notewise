# Notewise — multi-provider AI fallback chain

Built 2026-11-13. Every tier below was verified with a live call on
2026-11-13 unless marked otherwise. Nothing in this file is a claim without
a test behind it.

## Live site

https://notewiseapp.vercel.app (Vercel project `notewise`, team `rohit-3f05`)

## Chain order (first real response wins)

| # | Tier | What it is | Live status 2026-11-13 |
|---|------|-----------|------------------------|
| 1 | Firebase AI Logic | Hybrid inference: Gemini Nano on-device preferred, cloud model chain as fallback. Cloud chain: `gemini-3.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-3.6-flash` → `gemma-4-26b-a4b-it` → `gemini-3.8-flash` (last). | Models verified live via the Google AI Studio API (same Gemini Developer API backend). `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemma-4-26b-a4b-it` returned real text; `gemini-3.6-flash` returned real text (prose-wrapped JSON, parses OK); `gemini-3.8-flash` returns 503 "high demand" (kept last in case it recovers). |
| 2 | `/api/llm` proxy | Vercel serverless (`api/llm.js`, `POST {task, prompt}` → `{text, provider, model, label, latencyMs}`). Tries OpenRouter `:free` → Groq. Keys server-side only. CORS open so other pipelines can reuse it. | Deployed and verified live: `POST /api/llm` returns HTTP 503 `{"error":"no_provider_available","detail":"no LLM provider key configured"}` in ~0.9s when no keys are set (skip path works). Returns real completions as soon as a key is set — not yet verified with a real key because no OpenRouter/Groq key is available yet. |
| 3 | Pollinations | Keyless client-side GET `https://text.pollinations.ai/<prompt>?model=openai`, plain-text reply. | VERIFIED LIVE: real JSON summary (title + 5 tags) in 9.4s for the actual Summarize prompt. Badge shown: `Cloud · Pollinations (openai)`. The OpenAI-compatible POST endpoint (`/openai/v1/chat/completions`) timed out at 60s in testing — do NOT use it; the GET endpoint is the working one. |
| 4 | Demo mode | Local engine (`src/demo.js`). Badge: `◐ Live Preview Mode · Local preview`. | Verified locally (Playwright, 2026-11-13): Summarize, Research and Quiz all complete with the Live Preview badge and zero raw error text in the DOM when every live tier is unreachable. |

## What is NOT in the chain (and why)

### The user's originally requested Google order — retired, all 404
`gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash` →
`gemma-3-27b-it`. Tested live 2026-11-13 via the Google AI Studio API:
- `gemini-2.5-flash`: 404 "no longer available to new users"
- `gemini-2.0-flash`: 404 "no longer available"
- `gemini-1.5-flash`: 404 "not found for API version v1beta"
- `gemma-3-27b-it`: 404 "not found for API version v1beta"
- Also dead: `gemini-2.5-pro` (404), `gemini-2.5-flash-lite` (404).
- Busy (503 "high demand"), kept only as last resort: `gemini-3.8-flash`,
  `gemini-flash-latest`, `gemini-3.7-flash`.

The chain uses their live successors instead (`gemini-3.5-flash` family +
`gemma-4-26b-a4b-it`). If Google retires those too, re-run the model test
(`python3 ~/workspace/custom-connectors/custom.gemini/bin/gemini.py generate
--model <name> --prompt "..."`) and update `CLOUD_MODELS` in `src/ai.js`.

### GitHub Models — service retired 2026-07-30
GitHub closed GitHub Models to new customers 2026-06-16, ran brownouts
2026-07-16/23, and removed the playground, catalog, inference API and BYOK
for everyone on 2026-07-30. `models.github.ai` now answers every request
with a bare `text/plain "OK"` stub — verified 2026-11-13 from three
independent networks (VM curl, Vercel serverless function, web crawler),
on both `/inference/chat/completions` and `/catalog/models`, with and
without auth, with qualified (`openai/gpt-4o-mini`) and unqualified model
ids. The legacy endpoint `models.inference.ai.azure.com` is also dead
(connection fails). The provider was REMOVED from `api/llm.js` and its
token removed from all Vercel env vars. Do NOT re-add it without
re-verifying the endpoint serves real completions. GitHub points users to
Microsoft Foundry instead.

### Direct Gemini API proxy with the AI Studio key — not built
The registered `custom.gemini` connector holds the Google AI Studio key as
a surrogate that is only swapped in on approved requests to
`generativelanguage.googleapis.com` from this VM; the raw value is not
extractable, so it cannot be put in a Vercel env var. The Firebase AI
Logic tier already uses the same Gemini Developer API backend with the
same models, so a separate proxy tier would add no new coverage. If the
key is ever re-issued via Secure Vault, add it as `GEMINI_API_KEY` and a
matching provider in `api/llm.js`.

### Groq — dormant, awaiting the user's key
Signup is blocked server-side (`signup_blocked`) in the cloud browser AND
in the user's own phone browser — the block is account-side at Groq. The
user is getting the account whitelisted via GitHub OAuth / Groq Support.
The proxy already has a Groq tier (`llama-3.3-70b-versatile`,
`llama-3.1-8b-instant`) that activates the moment `GROQ_API_KEY` is set in
Vercel env. Never hardcode the key; never retry signup from a VM browser.

## Env vars (names only — never values)

| Var | Where | Status 2026-11-13 |
|-----|-------|-------------------|
| `GITHUB_MODELS_TOKEN` | Vercel (Production/Preview/Development) + local `.env` | REMOVED everywhere — service retired, see above. |
| `OPENROUTER_API_KEY` | Vercel env | NOT SET. An OpenRouter browser task is recreating the `notewise-fallback` key; the user will capture its value during takeover. Set with `vercel env add OPENROUTER_API_KEY --environment production --sensitive` (repeat for preview/development) once the value is in hand via Secure Vault. |
| `GROQ_API_KEY` | Vercel env | NOT SET. Pending the user's whitelisted account + key via Secure Vault. |
| `VITE_FIREBASE_API_KEY` etc. | `src/firebase-config.js` (public client key, rotated 2026-11-13) | Live. Restricted to Firestore + Firebase AI Logic + Identity Toolkit APIs, referrers `*.vercel.app`. |

## Reusable endpoint contract

`POST https://notewiseapp.vercel.app/api/llm`
Body: `{ "task": "summarize" | "research" | "quiz" | "raw", "prompt": "<string, 1–12000 chars>" }`
Success: `{ "text": "...", "provider": "openrouter" | "groq", "model": "...", "label": "OpenRouter (model)", "latencyMs": 123 }`
Failure: HTTP 503 `{ "error": "no_provider_available", "detail": "..." }`; HTTP 400 for a bad prompt; HTTP 405 for non-POST.
CORS: `Access-Control-Allow-Origin: *` (other pipelines can call it).
Limits: 8s per provider attempt; `maxDuration: 60` in `vercel.json`.

## Honest badges

Every result shows its real source — the UI never claims live AI for a
local preview:
- `✦ On-device · Gemini Nano (on-device)`
- `☁ Cloud · Gemini 3.5 Flash (cloud)` (or whichever Firebase model answered)
- `☁ Cloud · OpenRouter (meta-llama/llama-3.3-70b-instruct:free)`
- `☁ Cloud · Groq (llama-3.3-70b-versatile)`
- `☁ Cloud · Pollinations (openai)`
- `◐ Live Preview Mode · Local preview` (demo engine — never live AI)

## Verification log (2026-11-13)

- Google models: `gemini.py generate` per model, live text or error
  recorded above. Working: 3.5-flash, 3.5-flash-lite, 3.1-flash-lite,
  3.6-flash, gemma-4-26b-a4b-it.
- Pollinations GET: `curl https://text.pollinations.ai/...?model=openai` —
  HTTP 200, real sentence, ~7s. POST `/openai/v1/chat/completions` — 60s
  timeout, unusable.
- GitHub Models: `curl` + `gh api` + Vercel function + web crawler — all
  return text/plain `OK` (4 bytes). Retired 2026-07-30 (GitHub Changelog
  via grabaicredits.com roundup + docs).
- Proxy live: `POST /api/llm` on notewiseapp.vercel.app — 503 skip path
  verified (0.88s). Real-completion path pending a key.
- Client chain simulation (Node, live endpoints): proxy 503 → Pollinations
  200 in 9.4s → valid summary JSON (title "Self-Attention Transformer
  Breakthrough", 5 tags) → badge `Cloud · Pollinations (openai)`.
  Script: `/tmp/verify_chain_live.mjs`.
- Local app (Playwright + `vercel dev`): preset loads, Summarize /
  Research / Quiz all complete with the Live Preview badge and zero
  forbidden strings in the DOM when every live tier is unreachable from
  the VM. Console errors are only `ERR_TUNNEL_CONNECTION_FAILED` (the
  VM browser has no external network — environmental noise, not app
  errors).
- Deploy: `npx vercel --prod` — Ready, aliased to
  https://notewiseapp.vercel.app. No email verification code was needed.
- Repo: committed + pushed (see `git log`).

## Known limits

- Live-site client E2E (clicking Summarize in a real browser and watching
  the badge) could NOT be run from this VM: the VM's Chromium has no
  external network, so every live tier fails there by design and the app
  always shows Live Preview locally. The deployed proxy and Pollinations
  were verified live via curl/Node instead, and the deployed JS bundle was
  confirmed to contain the new chain (`pollinations`, `/api/llm`,
  `gemini-3.5-flash` all present in `assets/index-*.js`).
- The Firebase tier's model availability is inferred from the AI Studio
  key tests (same Gemini Developer API backend). If a model 404s via
  Firebase AI Logic specifically, the chain moves on automatically.
- `vercel.json` sets `maxDuration: 60` for `api/llm.js`; accepted on the
  Hobby plan at deploy time.
