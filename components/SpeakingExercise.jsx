"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, MicOff, StopCircle, Shuffle } from "lucide-react";

const SEED_TOPICS = [
  "Tell me about a hobby you enjoy and why.",
  "Describe a challenge you overcame recently.",
  "What's a book or movie that changed your perspective?",
  "If you could design your ideal weekend, what would it include?",
  "What habit are you trying to build this month?",
  "Explain a technology you use daily to someone new to it.",
  "What makes a conversation memorable to you?",
  "Tell me about a place you want to visit and why.",
  "What did you learn this week that surprised you?",
  "What's an opinion you changed your mind about?",
];

// Simple follow-up generator based on keywords in the user's answer.
function generateFollowUps(answer) {
  const a = (answer || "").toLowerCase();
  const f = [];
  if (/work|job|office|career/.test(a))
    f.push("What part of your work energizes you the most?");
  if (/travel|trip|country|city|place/.test(a))
    f.push("What did that place teach you about yourself?");
  if (/book|read|novel|author/.test(a))
    f.push("Which idea from that book stuck with you and why?");
  if (/movie|film|series/.test(a))
    f.push("How would you recommend it to a friend in one sentence?");
  if (/friend|family|people|relationship/.test(a))
    f.push("How do you nurture that relationship?");
  if (/learn|study|course|class|school/.test(a))
    f.push("What’s one way you apply that learning day-to-day?");
  if (/health|run|gym|sport|fitness/.test(a))
    f.push("How do you stay consistent when motivation dips?");
  if (/music|song|artist|band/.test(a))
    f.push("How does that music influence your mood or focus?");
  if (f.length < 2)
    f.push("Can you share a specific example to illustrate that?");
  if (f.length < 3) f.push("What makes that important to you right now?");
  return Array.from(new Set(f)).slice(0, 3);
}

function pickRandomTopic(prevTopic) {
  const pool = SEED_TOPICS.filter((t) => t !== prevTopic);
  return pool[Math.floor(Math.random() * pool.length)] || SEED_TOPICS[0];
}

export default function SpeakingExercise() {
  const [topic, setTopic] = useState(() => pickRandomTopic());
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [sessionActive, setSessionActive] = useState(true);
  const [turns, setTurns] = useState([]); // {question, answer, durationMs, words}
  const [currentTranscript, setCurrentTranscript] = useState("");
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  // Setup Web Speech API
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event) => {
        const results = Array.from(event.results);
        const finalText = results
          .map((r) => r[0]?.transcript || "")
          .join(" ")
          .trim();
        setCurrentTranscript(finalText);
      };

      recognition.onerror = () => {
        setIsListening(false);
        stopTimer();
      };

      recognition.onend = () => {
        setIsListening(false);
        stopTimer();
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }
    return () => stopTimer();
  }, []);

  const wordsCount = useMemo(() => {
    return currentTranscript ? currentTranscript.trim().split(/\s+/).length : 0;
  }, [currentTranscript]);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleListening = () => {
    if (!speechSupported || !sessionActive) return;
    if (isListening) {
      // Stop listening and commit the turn
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      stopTimer();
      const durationMs = Date.now() - startTimeRef.current;
      const turn = {
        question: topic,
        answer: currentTranscript,
        durationMs,
        words: wordsCount,
      };
      setTurns((t) => [...t, turn]);
      setCurrentTranscript("");
      setElapsedMs(0);

      // Generate follow up topic based on answer, or random related
      const followUps = generateFollowUps(turn.answer);
      const next = followUps[0] || pickRandomTopic(topic);
      setTopic(next);
    } else {
      // Start listening for a new answer
      setElapsedMs(0);
      setCurrentTranscript("");
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        startTimer();
      } catch {
        // Already started or not allowed
      }
    }
  };

  const endSession = () => {
    if (!sessionActive) return;
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
    }
    stopTimer();
    setIsListening(false);
    setSessionActive(false);
  };

  // Simple feedback scoring
  const totalWords = turns.reduce((acc, t) => acc + (t.words || 0), 0);
  const totalTimeMs = turns.reduce((acc, t) => acc + (t.durationMs || 0), 0);
  const avgWpm =
    totalTimeMs > 0 ? Math.round(totalWords / (totalTimeMs / 60000) || 0) : 0;
  const depthHints = useMemo(
    () => generateFollowUps(turns[turns.length - 1]?.answer || ""),
    [turns]
  );

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const mins = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const secs = (s % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  if (!sessionActive) {
    // Summary screen
    const rounds = turns.length;
    const message =
      rounds >= 3 && totalWords >= 120
        ? "Excellent depth and flow—your responses were thoughtful and sustained."
        : rounds >= 2 && totalWords >= 60
        ? "Good progress—try elaborating with more specifics and examples."
        : "Warm-up complete—next time, aim for longer, more detailed answers.";

    return (
      <div className="max-w-2xl mx-auto h-screen flex flex-col">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">
            Speaking Summary
          </h2>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-lg p-6 mb-4 flex flex-col justify-center">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Rounds</p>
              <p className="text-3xl font-bold text-blue-600">{rounds}</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Total Words</p>
              <p className="text-3xl font-bold text-blue-600">{totalWords}</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Avg WPM</p>
              <p className="text-3xl font-bold text-blue-600">{avgWpm}</p>
            </div>
          </div>
          <p className="text-lg text-gray-700 text-center mb-4">{message}</p>
          {depthHints.length > 0 && (
            <p className="text-sm text-gray-600 text-center">
              Next time, explore: {depthHints.join(" · ")}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 flex items-center justify-center">
          <button
            onClick={() => {
              // reset session
              setTurns([]);
              setTopic(pickRandomTopic());
              setSessionActive(true);
              setElapsedMs(0);
              setCurrentTranscript("");
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative max-w-2xl mx-auto h-screen flex flex-col">
      {/* Header: timer left, end session right */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <p className="text-sm text-gray-600">Timer</p>
            <p className="text-3xl font-bold text-blue-600">
              {formatTime(elapsedMs)}
            </p>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={endSession}
              className="px-4 py-2 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition flex items-center gap-2"
            >
              <StopCircle size={18} /> End
            </button>
          </div>
        </div>
      </div>

      {/* Main Card: topic */}
      <div className="flex-1 bg-white rounded-xl shadow-lg p-6 mb-4 flex flex-col justify-center">
        <div className="text-2xl leading-relaxed text-gray-700 p-6 mb-28 bg-gray-50 rounded-lg">
          {topic}
        </div>
      </div>

      {/* Corner Controls */}
      <div className="fixed left-4 bottom-4">
        <button
          type="button"
          onClick={toggleListening}
          disabled={!speechSupported}
          aria-label={isListening ? "Pause speaking" : "Start speaking"}
          className={`w-16 h-16 rounded-full border flex items-center justify-center transition-all shadow-sm ${
            isListening
              ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
              : "bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {speechSupported ? (
            isListening ? (
              <Square size={26} />
            ) : (
              <Mic size={26} />
            )
          ) : (
            <MicOff size={26} />
          )}
        </button>
      </div>

      <div className="fixed right-4 bottom-4">
        <button
          type="button"
          onClick={() => setTopic(pickRandomTopic(topic))}
          aria-label="Shuffle topic"
          className="w-14 h-14 rounded-full border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition flex items-center justify-center shadow-sm"
        >
          <Shuffle size={22} />
        </button>
      </div>
    </div>
  );
}
