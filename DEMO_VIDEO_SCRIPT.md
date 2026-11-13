# Notewise — demo video script (≤ 3:00, real screen recording)

Record the real app running in Chrome at https://notewiseapp.vercel.app
(or `npm run dev`, http://localhost:5173). No AI visuals, no stock footage —
every shot is the live app. Keep the total under 3 minutes; target ~2:30.

## Setup before recording

- Open https://notewiseapp.vercel.app in Chrome, clean profile, desktop 1920×1080.
- The app opens on the landing page (dark obsidian glass design, canvas
  particles, 3D-tilt preview card). Scroll to the workspace for the AI shots.
- Use the "Lecture Notes" 1-click sample for the main flow — its output is
  pre-computed, so the demo never stalls even if the live Gemini API is busy.
- Keep the Firebase console AI Logic page open in a second tab (shot 7).

## Shot list

| # | Time | What to show | What to say (voiceover) |
|---|------|--------------|--------------------------|
| 1 | 0:00–0:18 | Landing hero: headline, dual CTAs, canvas particles, 3D-tilt preview card animating messy text → structured output. Hover the card to show the tilt. | "Notewise turns messy notes into structured knowledge. You write a note — and the AI works where it makes sense: on your device, or in the cloud." |
| 2 | 0:18–0:32 | Scroll the Bento grid: Smart Synthesis, Flashcards, Export, Instant Search. Click the mini-quiz answer (green). | "Four things, one workspace: synthesis, flashcards, export, and instant search — all live on this page." |
| 3 | 0:32–0:55 | Click **Load "Lecture Notes" sample**. The workspace fills; all four tabs (Summary, Key Takeaways, Flashcards, Research) are already populated with the "Live Preview Mode" badge. | "One click loads a full sample. Every tab is filled instantly — and the badge always says exactly what produced the output." |
| 4 | 0:55–1:20 | Click **Summarize** on the sample. Watch the typewriter reveal + suggested title + tags. Switch to **Key Takeaways**. | "Summarize runs on Gemini Nano on-device when available, Gemini in the cloud when it counts — and if the live API is busy, a local preview steps in, labelled as one." |
| 5 | 1:20–1:50 | Click **Quiz me**. Five questions appear. Answer Q1 correctly (green), Q2 wrong (red + correct answer shown). | "Quiz me turns the note into five questions, checked right here in the app." |
| 6 | 1:50–2:10 | Click **Deep research**, show the structured brief, then **Export Markdown** (download appears). | "Deep research writes the brief. One click exports the whole note as Markdown." |
| 7 | 2:10–2:35 | Switch tab: show `src/ai.js` — the multi-provider fallback chain (verified-live Gemini models, then the `/api/llm` proxy, then Pollinations, then the labelled local demo) — then the Firebase console AI Logic page. | "Under the hood it's the Firebase AI Logic SDK: hybrid inference for Nano, cloud models for deep work, with a full fallback chain so the demo never breaks." |
| 8 | 2:35–2:50 | Back to the app, full landing view. End card text on screen: "Notewise — Turn messy notes into structured knowledge. Built with Firebase AI Logic. github.com/rjrajput-web3/notewise". | "Notewise — smart notes, on-device and in the cloud." |

## Notes

- If the live Gemini API is busy, the app shows clearly labelled "Live Preview
  Mode" output — never a raw error. For the final video, record after the
  ~06:36 IST re-test confirms whether the cloud model answers; the sample
  flow (shots 3–6) works either way.
- Keep the voiceover in plain English, one idea per shot.
- Export at 1080p, upload as Public to YouTube (ReelCine channel), and use
  that link in the Devpost submission.
