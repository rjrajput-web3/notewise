/**
 * Local demo engine for Notewise.
 *
 * Used ONLY when Firebase AI Logic cannot be reached (for example, AI Logic
 * is not enabled in the Firebase console yet). It is a plain, deterministic
 * text processor — extractive summarization, keyword tags, and fill-in-the-
 * blank questions built from the note itself. It invents nothing and it is
 * ALWAYS labelled "Demo mode" in the UI, never presented as Gemini output.
 */

const STOPWORDS = new Set(
  "a an the and or but if then else for of to in on at by with from as is are was were be been being it its this that these those there here what when where who whom how why which all any some no not do does did have has had will would can could should may might i you he she we they them his her their our your my me him us".split(
    " "
  )
);

function sentencesOf(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function wordsOf(text) {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter(
    (w) => !STOPWORDS.has(w)
  );
}

function topKeywords(text, n = 8) {
  const counts = new Map();
  for (const w of wordsOf(text)) counts.set(w, (counts.get(w) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

export function summarizeDemo(text) {
  const sentences = sentencesOf(text);
  const keywords = topKeywords(text, 8);
  const scored = sentences
    .map((s, i) => {
      const words = wordsOf(s);
      const score = words.reduce((acc, w) => acc + (keywords.includes(w) ? 2 : 0), 0) / Math.max(words.length, 1);
      return { s, score, i };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const picked = scored
    .slice(0, 3)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
  const summary =
    picked.length > 0
      ? picked.join(" ")
      : "This note is too short to summarize — add a few more sentences.";
  const firstLine = (text.split("\n")[0] || "").trim();
  const title =
    firstLine.length > 3 && firstLine.length <= 60
      ? firstLine.replace(/[#*]/g, "").trim()
      : keywords.slice(0, 4).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return {
    kind: "summary",
    source: "demo",
    model: "Demo mode (local text processing)",
    latencyMs: 0,
    data: { summary, title, tags: keywords.slice(0, 5) }
  };
}

export function researchDemo(text) {
  const sentences = sentencesOf(text);
  const keywords = topKeywords(text, 8);
  const keyIdeas = sentences.slice(0, 4).map((s) => `- ${s}`);
  const topic = keywords[0] ? keywords[0] : "this topic";
  const markdown = [
    "## Key ideas",
    ...(keyIdeas.length ? keyIdeas : ["- The note is short — add more detail to build a fuller brief."]),
    "",
    "## Background",
    `This brief was assembled from the note itself. Its main thread is about ${topic}, ` +
      `with supporting points on ${keywords.slice(1, 4).join(", ") || "related ideas"}.`,
    "",
    "## Connections",
    `- The ideas in this note connect through ${keywords.slice(0, 3).join(", ") || "its core terms"}.`,
    "- Add more notes on the same topic and the cloud research brief will link them together.",
    "",
    "## Open questions",
    `1. What is the most important thing to remember about ${topic}?`,
    `2. How does ${topic} connect to what you already know?`,
    `3. What would you ask an expert about ${topic}?`,
    "",
    "_Demo brief — generated locally from the note text. Enable Firebase AI Logic for a real cloud research brief._"
  ].join("\n");
  return {
    kind: "research",
    source: "demo",
    model: "Demo mode (local text processing)",
    latencyMs: 0,
    data: { markdown }
  };
}

export function quizDemo(text) {
  const sentences = sentencesOf(text);
  const keywords = topKeywords(text, 12);
  const questions = [];
  for (const s of sentences) {
    if (questions.length >= 5) break;
    const key = keywords.find(
      (k) => s.toLowerCase().includes(k) && k.length > 3
    );
    if (!key) continue;
    const blanked = s.replace(new RegExp(key, "i"), "______");
    const distractors = keywords.filter((k) => k !== key).slice(0, 3);
    if (distractors.length < 3) continue;
    const options = [key, ...distractors];
    // Deterministic shuffle by sentence length so the key is not always first.
    const shift = s.length % 4;
    for (let i = 0; i < shift; i++) options.push(options.shift());
    questions.push({
      q: `Fill in the blank: ${blanked}`,
      options,
      answer: options.indexOf(key),
      why: `The note says: "${s}"`
    });
  }
  while (questions.length < Math.min(5, Math.max(1, sentences.length))) {
    questions.push({
      q: "What is the main topic of this note?",
      options: keywords.slice(0, 4),
      answer: 0,
      why: "The most frequent meaningful word in the note is the topic."
    });
    break;
  }
  return {
    kind: "quiz",
    source: "demo",
    model: "Demo mode (local text processing)",
    latencyMs: 0,
    data: { questions }
  };
}
