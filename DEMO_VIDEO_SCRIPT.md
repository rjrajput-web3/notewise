# Notewise — demo video script (≤ 3:00, real screen recording)

Record the real app running in Chrome. No AI visuals, no stock footage —
every shot is the live app. Keep the total under 3 minutes; target ~2:30.

## Setup before recording

- `npm run dev`, open http://localhost:5173 in Chrome.
- Use a clean browser profile so no personal data shows.
- The app opens with two sample notes. Use the "Photosynthesis" sample.
- Keep the Firebase console AI Logic page open in a second tab (shot 7).

## Shot list

| # | Time | What to show | What to say (voiceover) |
|---|------|--------------|--------------------------|
| 1 | 0:00–0:15 | App open on the Photosynthesis sample note. Cursor highlights the title and body. | "Notewise is an offline-first smart notes app. You write a note — and the AI works where it makes sense: on your device, or in the cloud." |
| 2 | 0:15–0:45 | Click **Summarize on-device**. The summary, suggested title and tags appear with the "On-device · Gemini Nano" badge. | "Summarize runs on Gemini Nano, right in the browser. Fast, private, and it works offline. The badge tells you exactly where it ran." |
| 3 | 0:45–0:55 | Click **Use this title**. Title updates in the editor. | "One click applies the suggested title." |
| 4 | 0:55–1:35 | Click **Deep research**. The structured brief appears (Key ideas, Background, Connections, Open questions) with the "Cloud · Gemini 3.8 Flash" badge. | "For deeper work, the same note goes to Gemini in the cloud — a full research brief, still through Firebase AI Logic." |
| 5 | 1:35–2:15 | Click **Quiz me**. Five questions appear. Answer Q1 correctly (green), Q2 wrong (red + correct answer shown). | "And Quiz me turns the note into five questions, checked right here in the app." |
| 6 | 2:15–2:30 | Click **+ New note**, paste a short paragraph, run Summarize again to show it works on a fresh note. | "It works the same on any note you write." |
| 7 | 2:30–2:50 | Switch tab: show `src/ai.js` in the editor — the `getGenerativeModel` hybrid call and `InferenceMode.PREFER_ON_DEVICE` — then the Firebase console AI Logic page. | "Under the hood it's the Firebase AI Logic SDK: hybrid inference for Nano, cloud models for deep work. One SDK, both engines." |
| 8 | 2:50–3:00 | Back to the app, full view. End card text on screen: "Notewise — Smart notes, on-device & in the cloud. Built with Firebase AI Logic. github.com/rjrajput-web3/notewise". | "Notewise — smart notes, on-device and in the cloud." |

## Notes

- If AI Logic is not enabled in the console yet, the app shows clearly
  labelled demo results. For the final video, record AFTER enabling AI Logic
  in the console (AI Logic > Get started) so the on-device and cloud badges
  show real inference.
- Keep the voiceover in plain English, one idea per shot.
- Export at 1080p, upload as Public to YouTube (ReelCine channel), and use
  that link in the Devpost submission.
