# Notewise — Smart notes, on-device & in the cloud

**#BuildHybridAI 2026 entry** · Platform: **Web (Chrome)** · Category: Best Web/Chrome App

Notewise is an offline-first smart notes and study app. It shows what
Firebase AI Logic hybrid inference is for: the same app runs prompts
**on-device with Gemini Nano** when a local model is available, and
**in the cloud with Gemini** when the task needs deeper reasoning.

## The one flow

1. Write or paste a note (a lecture, an article, meeting notes). Two sample
   notes ship with the app so it demos instantly.
2. **✦ Summarize on-device** — Gemini Nano (Firebase AI Logic,
   `InferenceMode.PREFER_ON_DEVICE`) writes a 2–3 sentence summary, suggests
   a title and tags. Fast, private, works offline.
3. **☁ Deep research** — cloud Gemini (`gemini-3.8-flash`, `ONLY_IN_CLOUD`
   via the same SDK) turns the note into a structured research brief: key
   ideas, background, connections, open questions.
4. **? Quiz me** — cloud Gemini writes 5 multiple-choice questions from the
   note. Answers are checked in the app, with a one-line explanation.

Every result carries a badge stating exactly where it ran — **On-device ·
Gemini Nano**, **Cloud · Gemini 3.8 Flash**, or **Demo mode** — and the
latency of the call.

## How Firebase AI Logic is used (in code)

`src/ai.js` — the real integration, imported and called at runtime:

```js
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

// On-device first, cloud fallback (summarize)
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: { model: "gemini-3.8-flash" }
});

// Cloud only (deep research, quiz)
const cloud = getGenerativeModel(ai, { model: "gemini-3.8-flash" });
const result = await model.generateContent({ contents: [...] });
const where = result.response.inferenceSource; // "on_device" | "in_cloud"
```

Other Firebase products used:

- **App Check** — debug token in dev (`src/firebase.js`); a reCAPTCHA
  Enterprise site key can be supplied via `VITE_APPCHECK_SITE_KEY`.
  Production ships with NO App Check provider unless that key is set, so
  App Check enforcement for the Firebase AI Logic API must be OFF in the
  console (Firebase console → App Check → APIs → Firebase AI Logic API →
  "Not enforced"). If enforcement is ON with no provider configured, every
  AI call fails with 401 "Firebase App Check token is invalid" and the app
  falls back to demo mode — this happened in production on 2026-11-13 and
  is a console setting, not a code bug. (Enforcing App Check instead is the
  stronger option: create a reCAPTCHA Enterprise site key, allowlist the
  Vercel domain, set `VITE_APPCHECK_SITE_KEY`, redeploy.)
- **Firestore** — notes are mirrored to the `notes` collection when available.
- **Authentication** — anonymous sign-in, best-effort. If the footer says
  "Auth: unavailable", enable the Anonymous provider in the console
  (Authentication → Sign-in method → Anonymous → Enable). The app keeps
  working on local storage without it.

## Demo mode (honest fallback)

Firebase AI Logic must be enabled in the Firebase console before the first
real AI call works. Until then — and whenever a call fails — Notewise falls
back to a local, deterministic text processor (`src/demo.js`: extractive
summary, keyword tags, fill-in-the-blank quiz built from the note itself).
Demo results are **always labelled "Demo mode"** in the UI, with the reason
for the fallback shown. Demo output is never presented as Gemini output.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build on :4173
```

The app ships with the live Firebase project config
(`src/firebase-config.js`, project `hybridai-smart-notes`, Spark plan,
free tier). No keys to add. To point it at a different project, copy
`.env.example` to `.env` and set the `VITE_FIREBASE_*` values.

**To enable real AI calls:** in the
[Firebase console](https://console.firebase.google.com/project/hybridai-smart-notes/ailogic),
open **AI Logic** and click **Get started**. No paid API is used and no
billing is attached to the project.

## Project structure

```
index.html            entry point
src/
  main.js             UI wiring — one flow: note → AI action → labelled result
  firebase-config.js  live Firebase project config (public web client key)
  firebase.js         app init, App Check, Auth, Firestore (graceful fallback)
  ai.js               Firebase AI Logic hybrid inference (real integration)
  demo.js             local demo engine (clearly labelled fallback)
  store.js            notes: localStorage first, Firestore mirror when available
  styles.css          UI styles
```

## Architecture

```
Note text
   │
   ├─ Summarize ──► Firebase AI Logic, PREFER_ON_DEVICE ──► Gemini Nano
   │                    (cloud fallback: Gemini 3.8 Flash)      or demo engine
   │
   ├─ Deep research ─► Firebase AI Logic, cloud model ──► Gemini 3.8 Flash
   │
   └─ Quiz ─────────► Firebase AI Logic, cloud model ──► Gemini 3.8 Flash
                        │
                        ▼
              Result badge: on-device / cloud / demo
```

## What was built during the submission period

Notewise is a brand-new project, created entirely during the #BuildHybridAI
2026 submission period (Nov 11–30, 2026). No pre-existing code was used.
The only third-party code is the Firebase JS SDK and Vite (see
`package.json`).

## License

MIT — see [LICENSE](LICENSE).
