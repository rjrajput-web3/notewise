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

/**
 * Fill-in-the-blank quiz builder. ALWAYS returns exactly 5 questions.
 *
 * Sources, in order:
 *  A. Fill-in-the-blank from the note's own sentences (answer = a keyword
 *     from that sentence, distractors = other keywords from the note).
 *  B. "Which of these words appears in this note?" — one per keyword not
 *     already used as an answer, distractors = generic words that do NOT
 *     appear in the note (filtered case-insensitively), so no distractor
 *     can accidentally also be a correct answer.
 *  C. "Which word appears most often in this note?" — same distractor rule.
 *  D. "What is the title of this note?" — options are the note's own title
 *     plus generic labels; only the note's title is correct.
 *  E. Counting questions computed from the note itself (word count,
 *     sentence count).
 * Nothing is invented: every correct answer is computed from the note text.
 */

// Generic words used ONLY as distractors. Any word that appears in the note
// is filtered out before use, so a distractor can never also be correct.
const DISTRACTOR_POOL = [
  "quantum", "harvest", "symphony", "glacier", "telescope", "bicycle",
  "volcano", "sapphire", "lantern", "meadow", "compass", "thunder",
  "mosaic", "harbor", "velvet", "orbit"
];

function rotate(arr, shift) {
  const a = [...arr];
  const n = ((shift % a.length) + a.length) % a.length;
  for (let i = 0; i < n; i++) a.push(a.shift());
  return a;
}

export function quizDemo(text) {
  const sentences = sentencesOf(text);
  const keywords = topKeywords(text, 12);
  const lowerText = " " + text.toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
  const questions = [];
  const usedAnswers = new Set();

  const pushQuestion = (q) => {
    if (questions.length >= 5) return;
    const options = [...new Set(q.options.map((o) => String(o).trim()))].filter(Boolean);
    if (options.length !== 4) return;
    if (q.answer < 0 || q.answer > 3) return;
    questions.push({ q: q.q, options, answer: q.answer, why: q.why });
  };

  // Distractors: generic pool words that do NOT appear in the note, topped
  // up with other note keywords (also not the answer) if the pool runs out.
  const distractorsFor = (answer, n = 3) => {
    const answerLower = String(answer).toLowerCase();
    const out = [];
    for (const w of DISTRACTOR_POOL) {
      if (out.length >= n) break;
      if (w.toLowerCase() === answerLower) continue;
      if (lowerText.includes(" " + w.toLowerCase() + " ")) continue;
      out.push(w);
    }
    for (const k of keywords) {
      if (out.length >= n) break;
      if (k.toLowerCase() === answerLower) continue;
      if (out.includes(k)) continue;
      out.push(k);
    }
    return out;
  };

  const makeOptions = (answer, seed) => {
    const distractors = distractorsFor(answer, 3);
    if (distractors.length < 3) return null;
    const options = rotate([answer, ...distractors], seed % 4);
    return { options, answer: options.indexOf(answer) };
  };

  // A. Fill in the blank from the note's own sentences.
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const s of sentences) {
    if (questions.length >= 5) break;
    // Match whole words only, so "art" never blanks the middle of "heart".
    const key = keywords.find(
      (k) => k.length > 3 && new RegExp(`\\b${escapeRegExp(k)}\\b`, "i").test(s)
    );
    if (!key) continue;
    const blanked = s.replace(new RegExp(`\\b${escapeRegExp(key)}\\b`, "i"), "______");
    const built = makeOptions(key, s.length);
    if (!built) continue;
    usedAnswers.add(key.toLowerCase());
    pushQuestion({
      q: `Fill in the blank: ${blanked}`,
      options: built.options,
      answer: built.answer,
      why: `The note says: "${s}"`
    });
  }

  // B. Word-recognition questions for keywords not used as answers yet.
  for (const key of keywords) {
    if (questions.length >= 5) break;
    if (usedAnswers.has(key.toLowerCase())) continue;
    const built = makeOptions(key, key.length + 1);
    if (!built) continue;
    usedAnswers.add(key.toLowerCase());
    pushQuestion({
      q: "Which of these words appears in this note?",
      options: built.options,
      answer: built.answer,
      why: `The note uses the word "${key}".`
    });
  }

  // C. Most frequent word.
  if (questions.length < 5 && keywords.length > 0) {
    const top = keywords[0];
    const built = makeOptions(top, 7);
    if (built) {
      pushQuestion({
        q: "Which word appears most often in this note?",
        options: built.options,
        answer: built.answer,
        why: `"${top}" is the most frequent meaningful word in the note.`
      });
    }
  }

  // D. Note title (only when the note has a real first line).
  if (questions.length < 5) {
    const firstLine = (text.split("\n")[0] || "").trim().replace(/[#*]/g, "").trim();
    if (firstLine.length > 3 && firstLine.length <= 60) {
      const options = rotate([firstLine, "Untitled note", "Study notes", "My research"], firstLine.length % 4);
      pushQuestion({
        q: "What is the title of this note?",
        options,
        answer: options.indexOf(firstLine),
        why: `The note's title is "${firstLine}".`
      });
    }
  }

  // E. Counting questions computed from the note itself.
  if (questions.length < 5) {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const options = rotate([wordCount, wordCount + 10, wordCount + 25, wordCount + 50], wordCount % 4);
    pushQuestion({
      q: "About how many words are in this note?",
      options: options.map(String),
      answer: options.indexOf(wordCount),
      why: `The note has ${wordCount} words.`
    });
  }
  if (questions.length < 5) {
    const options = rotate([sentences.length, sentences.length + 1, sentences.length + 2, sentences.length + 3], sentences.length % 4);
    pushQuestion({
      q: "How many sentences are in this note?",
      options: options.map(String),
      answer: options.indexOf(sentences.length),
      why: `The note has ${sentences.length} sentence(s).`
    });
  }

  // Last resort (should not happen for any note with 5+ words): repeat the
  // main-topic question with a different keyword subset so the count is 5.
  while (questions.length < 5) {
    const topic = keywords[questions.length % Math.max(keywords.length, 1)] || "this topic";
    const built = makeOptions(topic, questions.length + 3);
    if (!built) break;
    pushQuestion({
      q: "Which of these words appears in this note?",
      options: built.options,
      answer: built.answer,
      why: `The note uses the word "${topic}".`
    });
    if (questions.length < 5 && !built) break;
  }

  return {
    kind: "quiz",
    source: "demo",
    model: "Demo mode (local text processing)",
    latencyMs: 0,
    data: { questions: questions.slice(0, 5) }
  };
}
