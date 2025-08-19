"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, RotateCcw } from "lucide-react";

const SUGGESTIONS = [
  "Write about the moment today that made you pause.",
  "Describe a small decision that changed your week.",
  "Tell a story about a habit you're trying to build and why.",
  "Write a letter to your future self in six months.",
  "Describe a conversation you wish you handled differently.",
  "What belief are you rethinking lately? Explore both sides.",
  "If your day were a short film, what would the opening scene be?",
  "Describe a place that makes you feel calm. Why?",
  "Write about a recent challenge and how you moved through it.",
  "Capture a memory using as many senses as possible.",
];

const MIN_WORDS = 300;

function pickSuggestion(prev) {
  const pool = SUGGESTIONS.filter((s) => s !== prev);
  return pool[Math.floor(Math.random() * pool.length)] || SUGGESTIONS[0];
}

function tokenizeWords(text) {
  return (text?.toLowerCase() || "")
    .replace(/[^a-zA-Z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function splitSentences(text) {
  return (text || "")
    .replace(/[\n\r]+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitParagraphs(text) {
  return (text || "")
    .split(/\n\s*\n/) // blank line
    .map((p) => p.trim())
    .filter(Boolean);
}

const STOPWORDS = new Set(
  "the a an and or but so to of in on for with at by from as is are was were be been being this that it you i they we he she them us our your my me his her their".split(
    /\s+/
  )
);

const TRANSITIONS = new Set(
  [
    "however",
    "therefore",
    "meanwhile",
    "because",
    "then",
    "first",
    "next",
    "finally",
    "for example",
    "in addition",
    "on the other hand",
    "as a result",
    "overall",
    "instead",
    "after",
    "before",
    "later",
  ].map((s) => s.toLowerCase())
);

const FILLERS = new Set(
  [
    "very",
    "really",
    "just",
    "like",
    "actually",
    "basically",
    "literally",
    "maybe",
    "kinda",
    "sort",
    "sort of",
    "kind of",
    "perhaps",
  ].map((s) => s.toLowerCase())
);

const STORY_MARKERS = new Set(
  [
    "challenge",
    "problem",
    "obstacle",
    "struggle",
    "learned",
    "change",
    "decision",
    "realized",
    "goal",
    "result",
    "because",
    "so",
    "but",
  ].map((s) => s.toLowerCase())
);

function analyzeWriting(text) {
  const words = tokenizeWords(text);
  const wordCount = words.length;
  const sentences = splitSentences(text);
  const paragraphs = splitParagraphs(text);

  const sentenceLengths = sentences.map((s) => tokenizeWords(s).length);
  const avgSentenceLen = sentenceLengths.length
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0;
  const longSentenceCount = sentenceLengths.filter((n) => n >= 25).length;

  // transitions (phrase + single word)
  const textLower = (text || "").toLowerCase();
  let transitionHits = 0;
  TRANSITIONS.forEach((t) => {
    if (t.includes(" ")) {
      if (textLower.includes(t)) transitionHits += 1;
    } else {
      const re = new RegExp(`(^|\\\W)${t}(\\\W|$)`, "g");
      if (re.test(textLower)) transitionHits += 1;
    }
  });

  // lexical diversity
  const uniqueWords = Array.from(
    new Set(words.filter((w) => !STOPWORDS.has(w)))
  );
  const typeTokenRatio = wordCount ? uniqueWords.length / wordCount : 0;

  // filler words
  const fillerCount = words.filter((w) => FILLERS.has(w)).length;
  const fillerRatio = wordCount ? fillerCount / wordCount : 0;

  // story markers
  const storyCount = words.filter((w) => STORY_MARKERS.has(w)).length;

  // repetition: most frequent non-stop words
  const freq = new Map();
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const topRepeated = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .filter(([, n]) => n >= 4)
    .map(([w, n]) => `${w} (${n}×)`);

  // punctuation variety
  const punctuationVariety = [",", ";", ":", "—", "-"].filter((p) =>
    text.includes(p)
  ).length;

  // scoring 0-10
  const structureScore = Math.max(
    0,
    Math.min(
      10,
      (paragraphs.length >= 3 ? 6 : paragraphs.length * 2) +
        (transitionHits >= 2 ? 4 : transitionHits * 2)
    )
  );
  const flowScore = Math.max(
    0,
    Math.min(
      10,
      (avgSentenceLen >= 12 && avgSentenceLen <= 22 ? 6 : 3) +
        (punctuationVariety >= 2 ? 2 : 1) +
        (longSentenceCount <= sentences.length * 0.2 ? 2 : 0)
    )
  );
  const storyScore = Math.max(
    0,
    Math.min(
      10,
      (storyCount >= 6 ? 6 : storyCount) + (words.length >= 350 ? 4 : 2)
    )
  );
  const wordChoiceScore = Math.max(
    0,
    Math.min(
      10,
      (typeTokenRatio >= 0.4 ? 6 : typeTokenRatio >= 0.3 ? 4 : 2) +
        (fillerRatio <= 0.02 ? 4 : fillerRatio <= 0.04 ? 3 : 1)
    )
  );

  const overall = Math.round(
    (structureScore + flowScore + storyScore + wordChoiceScore) / 4
  );

  const suggestions = [];
  if (paragraphs.length < 3)
    suggestions.push(
      "Structure: Try intro (hook/context), body (2–3 ideas with examples), and a brief conclusion (what changed or what's next)."
    );
  if (transitionHits < 2)
    suggestions.push(
      "Flow: Add transitions like 'for example', 'on the other hand', 'as a result', 'meanwhile' to guide the reader."
    );
  if (longSentenceCount > sentences.length * 0.25)
    suggestions.push(
      "Clarity: Break a few long sentences (25+ words) into two. Aim for a mix of short and medium sentences."
    );
  if (storyCount < 4)
    suggestions.push(
      "Story: Highlight a concrete moment—set the scene, show a tension/decision, and end with a takeaway."
    );
  if (fillerRatio > 0.03)
    suggestions.push(
      "Word choice: Replace fillers (really, very, just) with stronger verbs or cut them entirely."
    );
  if (topRepeated.length)
    suggestions.push(
      `Variety: You're repeating ${topRepeated.join(
        ", "
      )}. Swap a few for precise synonyms or restructure sentences.`
    );

  const quickChecklist = [
    "Underline your main point in the first 3–4 sentences.",
    "Add one concrete example (who/what/when/where).",
    "Introduce 2–3 transitions between ideas.",
    "Replace two weak adjectives with vivid verbs.",
    "End with a one-sentence takeaway or next step.",
  ];

  return {
    wordCount,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    avgSentenceLen: Number(avgSentenceLen.toFixed(1)),
    longSentenceCount,
    transitionHits,
    typeTokenRatio: Number(typeTokenRatio.toFixed(2)),
    fillerRatio: Number(fillerRatio.toFixed(3)),
    storyCount,
    punctuationVariety,
    topRepeated,
    scores: {
      structure: structureScore,
      flow: flowScore,
      story: storyScore,
      wordChoice: wordChoiceScore,
      overall,
    },
    suggestions,
    quickChecklist,
  };
}

export default function WritingExercise() {
  const [placeholder, setPlaceholder] = useState(() => pickSuggestion());
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const words = useMemo(() => tokenizeWords(text).length, [text]);
  const remaining = Math.max(0, MIN_WORDS - words);
  const canSubmit = words >= MIN_WORDS;

  // Auto-shuffle the suggestion every 4 seconds while editing
  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => {
      setPlaceholder((p) => pickSuggestion(p));
    }, 10000);
    return () => clearInterval(id);
  }, [submitted]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const a = analyzeWriting(text);
    setAnalysis(a);
    setSubmitted(true);
  };

  const reset = () => {
    setText("");
    setSubmitted(false);
    setAnalysis(null);
    setPlaceholder(pickSuggestion());
  };

  if (submitted && analysis) {
    const s = analysis.scores;
    return (
      <div className="max-w-2xl mx-auto h-screen flex flex-col">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">
            Writing Feedback
          </h2>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-lg p-6 mb-4">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Words</p>
              <p className="text-3xl font-bold text-blue-600">
                {analysis.wordCount}
              </p>
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Overall</p>
              <p className="text-3xl font-bold text-blue-600">{s.overall}/10</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Avg words/sentence</p>
              <p className="text-3xl font-bold text-blue-600">
                {analysis.avgSentenceLen}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <ScoreCard label="Structure" value={s.structure} />
            <ScoreCard label="Flow" value={s.flow} />
            <ScoreCard label="Story" value={s.story} />
            <ScoreCard label="Word Choice" value={s.wordChoice} />
          </div>

          {analysis.suggestions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                How to improve
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                {analysis.suggestions.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Quick edit checklist
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              {analysis.quickChecklist.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 flex items-center justify-center">
          <button
            onClick={reset}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow flex items-center gap-2"
          >
            <RotateCcw size={18} /> Start New Entry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative max-w-2xl mx-auto h-screen flex flex-col">
      {/* Header: word count left, submit right */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <p className="text-sm text-gray-600">Word count</p>
            <p className="text-3xl font-bold text-blue-600">{words}</p>
            <p
              className={`text-xs mt-1 ${
                canSubmit ? "text-green-600" : "text-gray-500"
              }`}
            >
              {canSubmit
                ? "Minimum reached"
                : `${remaining} to reach ${MIN_WORDS}`}
            </p>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-label="Submit writing"
              className={`px-4 py-2 rounded-lg transition flex items-center justify-center gap-2 shadow ${
                canSubmit
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
                  : "bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"
              }`}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Card: textarea */}
      <div className="flex-1 bg-white rounded-xl shadow-lg p-4 mb-4 flex">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="w-full h-full resize-none outline-none p-4 text-lg leading-relaxed text-gray-800 bg-gray-50 rounded-lg"
        />
      </div>

      {/* No floating controls; submission is in header */}
    </div>
  );
}

function ScoreCard({ label, value }) {
  const color =
    value >= 8
      ? "text-green-600"
      : value >= 6
      ? "text-blue-600"
      : value >= 4
      ? "text-amber-600"
      : "text-red-600";
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}/10</p>
    </div>
  );
}
