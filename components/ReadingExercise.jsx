"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Check } from "lucide-react";

// A simple ~600-word article and key points for basic comprehension scoring
const ARTICLE = `Public speaking is a skill that blends preparation, practice, and a steady presence. In everyday life we present ideas to teammates, describe plans to friends, and advocate for ourselves in meetings. Yet many people hold their breath, rush their words, or trail off at the end of a sentence when placed in front of a group. The goal of this exercise is to help you read clearly and then narrate the main points with confidence.

Clarity begins with breathing. A calm inhale through the nose lowers tension in the shoulders and keeps the throat open. When we speak on a shallow breath our voice sounds thin and we run out of air mid-sentence. When we pace our breath, we can support each phrase and let important words land. Good pacing is not slow for the sake of slowness; it is deliberate. Silence is part of the message. A pause gives listeners time to absorb an idea and gives you time to choose the next one.

Pronunciation rides on articulation and intention. Moving the lips and tongue a bit more than feels natural increases intelligibility, especially in unfamiliar words or names. Recording yourself and listening for muddled endings can reveal where to sharpen consonants. Projection does not require shouting. Instead, imagine your voice reaching the last row as if you were speaking to a friend across a park. That image lifts the sound forward and encourages a steady volume without strain.

Tone and intonation guide attention. A flat tone blurs statements together. Subtle rises signal a question or a hinge in the argument. Gentle falls signal completion or emphasis. Varying pitch within a comfortable range keeps the voice lively and the message memorable. Try highlighting one important word per sentence and letting your melody move around it. This prevents a sing-song habit while keeping speech expressive.

When you finish reading a passage, summarize it in your own words. A helpful summary selects rather than repeats. Start with the core idea in one sentence. Then name two or three supporting points and, if relevant, one implication or example. This structure demonstrates comprehension and gives the listener a map. You do not need special vocabulary. Everyday words delivered with order and purpose carry authority.

Confidence grows with small wins. Choose a short piece of text, read it aloud with attention to breath, pacing, and articulation, and then explain what it said. The aim is not perfection. The aim is a voice that other people can understand without effort, and a message that travels from your mind to theirs.`;

const KEYWORDS = [
  "breathing",
  "pacing",
  "pause",
  "pronunciation",
  "articulation",
  "projection",
  "volume",
  "tone",
  "intonation",
  "summary",
  "core idea",
  "supporting points",
  "confidence",
  "clarity",
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Lightweight pitch estimation via autocorrelation; returns Hz or null
function estimatePitch(timeDomain, sampleRate) {
  // Normalize
  let size = timeDomain.length;
  let buffer = new Float32Array(size);
  let max = 0;
  for (let i = 0; i < size; i++) {
    const v = timeDomain[i];
    buffer[i] = v;
    max = Math.max(max, Math.abs(v));
  }
  if (max < 0.01) return null;

  // Autocorrelation
  const rms = Math.sqrt(buffer.reduce((s, v) => s + v * v, 0) / size);
  if (rms < 0.01) return null;

  let r1 = 0;
  let r2 = size - 1;
  const threshold = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buffer[size - i]) < threshold) {
      r2 = size - i;
      break;
    }
  }
  buffer = buffer.slice(r1, r2);
  size = buffer.length;

  const c = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] = c[i] + buffer[j] * buffer[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1,
    maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  if (maxpos <= 0) return null;

  // Parabolic interpolation for better precision
  const x1 = c[maxpos - 1] || 0;
  const x2 = c[maxpos];
  const x3 = c[maxpos + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const shift = a ? -b / (2 * a) : 0;
  const period = maxpos + shift;
  const freq = sampleRate / period;
  if (freq < 50 || freq > 500) return null; // human voice range rough
  return freq;
}

function useAudioCapture() {
  const mediaStreamRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const [supported, setSupported] = useState(true);

  const start = useCallback(async (onSample) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      mediaStreamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const timeData = new Float32Array(analyser.fftSize);

      const loop = () => {
        if (!analyserRef.current) return;
        if (analyser.getFloatTimeDomainData) {
          analyser.getFloatTimeDomainData(timeData);
        } else {
          // Fallback
          const bytes = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(bytes);
          for (let i = 0; i < bytes.length; i++) {
            timeData[i] = (bytes[i] - 128) / 128;
          }
        }

        // RMS volume
        let sum = 0;
        for (let i = 0; i < timeData.length; i++)
          sum += timeData[i] * timeData[i];
        const rms = Math.sqrt(sum / timeData.length);
        const pitch = estimatePitch(timeData, ctx.sampleRate);
        onSample({ rms, pitch });
        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      console.error("Mic access failed", e);
      setSupported(false);
      throw e;
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (analyserRef.current) analyserRef.current.disconnect();
    analyserRef.current = null;
    if (ctxRef.current) ctxRef.current.close();
    ctxRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { start, stop, supported };
}

function useSpeechRecognition() {
  const [available, setAvailable] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState([]); // array of confidences
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setAvailable(!!SR);
  }, []);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    setTranscript("");
    setConfidence([]);
    setListening(true);
    rec.onresult = (e) => {
      let text = "";
      const confs = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          text += res[0].transcript + " ";
          if (typeof res[0].confidence === "number")
            confs.push(res[0].confidence);
        }
      }
      setTranscript((prev) => (prev + " " + text).trim());
      if (confs.length) setConfidence((prev) => prev.concat(confs));
    };
    rec.onerror = () => {
      /* ignore */
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
  }, []);

  const avgConfidence = useMemo(() => {
    if (!confidence.length) return null;
    return confidence.reduce((a, b) => a + b, 0) / confidence.length;
  }, [confidence]);

  return { available, listening, transcript, avgConfidence, start, stop };
}

function scoreReading({
  durationSec,
  words,
  avgRms,
  peakRms,
  silentRatio,
  avgPitch,
  pitchStd,
  asrConfidence,
}) {
  // Heuristics
  const wpm = words && durationSec > 0 ? (words / durationSec) * 60 : null; // target 130–170
  const pacingScore =
    wpm == null ? 6 : clamp(10 - Math.abs((wpm - 150) / 15), 1, 10);
  const pauseScore = clamp(10 - Math.abs((silentRatio - 0.15) / 0.05), 1, 10);
  const volumeScore = clamp((avgRms * 200 + peakRms * 80) / 2, 1, 10); // tuned empirically
  const intonationScore =
    pitchStd == null ? 6 : clamp(pitchStd / 20 + 5, 1, 10); // 20Hz std ~ good variety
  const pronScore =
    asrConfidence == null ? 6 : clamp(2 + asrConfidence * 8, 1, 10);

  return {
    wpm,
    Pronunciation: Math.round(pronScore * 10) / 10,
    "Pacing & Pausing": Math.round(((pacingScore + pauseScore) / 2) * 10) / 10,
    "Projection & Volume": Math.round(volumeScore * 10) / 10,
    "Intonation & Tone": Math.round(intonationScore * 10) / 10,
  };
}

function scoreSummary({
  transcript,
  keywordsCovered,
  fillerRatio,
  durationSec,
}) {
  const comprehension = clamp(3 + keywordsCovered * 7, 1, 10); // based on 0..1 coverage
  const clarity = clamp(10 - fillerRatio * 20, 1, 10);
  const delivery = clamp(
    5 + (durationSec > 20 ? 2 : 0) - fillerRatio * 10,
    1,
    10
  );
  return {
    Comprehension: Math.round(comprehension * 10) / 10,
    "Clarity of Thought": Math.round(clarity * 10) / 10,
    Delivery: Math.round(delivery * 10) / 10,
  };
}

function ProgressDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-2">
      {[1, 2, 3].map((s) => (
        <span
          key={s}
          className={`h-2 w-2 rounded-full ${
            step === s ? "bg-indigo-600" : "bg-indigo-300"
          }`}
        />
      ))}
    </div>
  );
}

export default function ReadingExercise() {
  const [step, setStep] = useState(1); // 1=read, 2=summarize, 3=results
  const [isRecording, setIsRecording] = useState(false);

  const {
    start: startAudio,
    stop: stopAudio,
    supported: audioSupported,
  } = useAudioCapture();
  const readASR = useSpeechRecognition();
  const sumASR = useSpeechRecognition();

  const startTsRef = useRef(null);
  const samplesRef = useRef({
    count: 0,
    rmsSum: 0,
    rmsPeak: 0,
    silentCount: 0,
    pitchSum: 0,
    pitch2Sum: 0,
    pitchCount: 0,
  });

  const resetSamples = () => {
    samplesRef.current = {
      count: 0,
      rmsSum: 0,
      rmsPeak: 0,
      silentCount: 0,
      pitchSum: 0,
      pitch2Sum: 0,
      pitchCount: 0,
    };
  };

  const onSample = ({ rms, pitch }) => {
    const s = samplesRef.current;
    s.count++;
    s.rmsSum += rms;
    s.rmsPeak = Math.max(s.rmsPeak, rms);
    if (rms < 0.02) s.silentCount++;
    if (pitch) {
      s.pitchSum += pitch;
      s.pitch2Sum += pitch * pitch;
      s.pitchCount++;
    }
  };

  const [readingScores, setReadingScores] = useState(null);
  const [summaryScores, setSummaryScores] = useState(null);

  const [summaryTranscript, setSummaryTranscript] = useState("");

  const startRecording = async () => {
    resetSamples();
    await startAudio(onSample);
    (step === 1 ? readASR : sumASR).start();
    startTsRef.current = Date.now();
    setIsRecording(true);
  };

  const stopRecording = () => {
    stopAudio();
    (step === 1 ? readASR : sumASR).stop();
    setIsRecording(false);
  };

  const completeStep = () => {
    const durationSec = (Date.now() - startTsRef.current) / 1000;
    const s = samplesRef.current;
    const avgRms = s.count ? s.rmsSum / s.count : 0;
    const peakRms = s.rmsPeak || 0;
    const silentRatio = s.count ? s.silentCount / s.count : 0;
    const avgPitch = s.pitchCount ? s.pitchSum / s.pitchCount : null;
    const pitchVar = s.pitchCount
      ? s.pitch2Sum / s.pitchCount - (avgPitch || 0) ** 2
      : null;
    const pitchStd =
      pitchVar != null && pitchVar > 0 ? Math.sqrt(pitchVar) : null;

    if (step === 1) {
      const words = readASR.transcript
        ? readASR.transcript.trim().split(/\s+/).length
        : null;
      const rScores = scoreReading({
        durationSec,
        words,
        avgRms,
        peakRms,
        silentRatio,
        avgPitch,
        pitchStd,
        asrConfidence: readASR.avgConfidence,
      });
      setReadingScores(rScores);
      setStep(2);
    } else if (step === 2) {
      const tr = (sumASR.transcript || "").toLowerCase();
      setSummaryTranscript(sumASR.transcript || "");
      const found = KEYWORDS.reduce(
        (acc, k) => acc + (tr.includes(k) ? 1 : 0),
        0
      );
      const keywordsCovered = KEYWORDS.length ? found / KEYWORDS.length : 0;
      const fillerMatches = tr.match(
        /\b(um|uh|like|you know|sort of|kind of)\b/g
      );
      const fillerCount = fillerMatches ? fillerMatches.length : 0;
      const words = tr ? tr.trim().split(/\s+/).length : 1;
      const fillerRatio = fillerCount / words;
      const sScores = scoreSummary({
        transcript: tr,
        keywordsCovered,
        fillerRatio,
        durationSec,
      });
      setSummaryScores(sScores);
      setStep(3);
    }
  };

  const startBtn = (
    <button
      onClick={startRecording}
      disabled={isRecording}
      aria-label="Start recording"
      className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all shadow-sm 
        ${
          isRecording
            ? "bg-indigo-100 border-indigo-200 text-indigo-300 cursor-not-allowed"
            : "bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100"
        }
      `}
    >
      <Mic size={24} />
    </button>
  );

  const stopBtn = (
    <button
      onClick={() => {
        stopRecording();
        completeStep();
      }}
      disabled={!isRecording}
      aria-label="Finish recording"
      className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all shadow-sm 
        ${
          !isRecording
            ? "bg-rose-100 border-rose-200 text-rose-300 cursor-not-allowed"
            : "bg-rose-50 border-rose-300 text-rose-600 hover:bg-rose-100"
        }
      `}
    >
      <Check size={24} />
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl h-full flex flex-col">
      <div className="bg-white/70 backdrop-blur rounded-xl shadow-lg border border-indigo-100 p-4 sm:p-6 flex-1 flex flex-col overflow-hidden">
        {/* <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold text-indigo-900">
            Reading & Speaking Exercise
          </h1>
          <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
            Mic powered
          </span>
        </div> */}
        <ProgressDots step={step} />

        {!audioSupported && (
          <div className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded">
            Microphone unavailable. Please allow mic access in your browser
            settings.
          </div>
        )}

        {step === 1 && (
          <div className="mt-4 flex-1 flex flex-col min-h-0">
            <h2 className="text-lg font-medium text-slate-800">
              Step 1 — Read this aloud
            </h2>
            <p className="text-sm text-slate-600">
              Focus on clear pronunciation, steady pacing, and natural pauses.
            </p>
            <div className="mt-3 flex-1 border border-slate-200 rounded-md p-3 bg-slate-50 overflow-y-auto hide-scrollbar">
              {ARTICLE.split("\n\n").map((para, idx) => (
                <p key={idx} className="text-slate-800 leading-relaxed mb-3">
                  {para}
                </p>
              ))}
            </div>
            <div className="mt-4 flex flex-col items-center justify-center gap-2">
              <div className="flex items-center justify-center gap-4">
                {startBtn}
                {stopBtn}
              </div>
              <div className="text-xs text-slate-600">
                {readASR.available
                  ? readASR.listening || isRecording
                    ? "Listening…"
                    : "Speech recognition ready"
                  : "Speech recognition not available; partial scoring only"}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 flex-1 flex flex-col min-h-0">
            <h2 className="text-lg font-medium text-slate-800">
              Step 2 — Summarize the main points
            </h2>
            <p className="text-sm text-slate-600">
              Use your own words: core idea + 2–3 supporting points.
            </p>
            <div className="mt-3 flex-1 border border-slate-200 rounded-md p-3 bg-slate-50 overflow-y-auto hide-scrollbar">
              <p className="text-slate-700 text-sm">
                Speak into the microphone. When done, press “Done”.
              </p>
            </div>
            <div className="mt-4 flex flex-col items-center justify-center gap-2">
              <div className="flex items-center justify-center gap-4">
                {startBtn}
                {stopBtn}
              </div>
              <div className="text-xs text-slate-600">
                {sumASR.available
                  ? sumASR.listening || isRecording
                    ? "Listening…"
                    : "Speech recognition ready"
                  : "Speech recognition not available; partial scoring only"}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-md p-4 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Reading feedback</h3>
              {readingScores ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {Object.entries(readingScores).map(([k, v]) =>
                    typeof v === "number" ? (
                      <li key={k} className="flex items-center justify-between">
                        <span className="text-slate-700">{k}</span>
                        <span className="font-medium text-indigo-700">
                          {v}/10
                        </span>
                      </li>
                    ) : null
                  )}
                  {readingScores.wpm != null && (
                    <li className="text-xs text-slate-600">
                      Estimated pace: {Math.round(readingScores.wpm)} WPM
                      (target ~150)
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">No data.</p>
              )}
            </div>
            <div className="border border-slate-200 rounded-md p-4 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Summary feedback</h3>
              {summaryScores ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {Object.entries(summaryScores).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between">
                      <span className="text-slate-700">{k}</span>
                      <span className="font-medium text-indigo-700">
                        {v}/10
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">No data.</p>
              )}
              {summaryTranscript && (
                <div className="mt-3">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Your summary
                  </h4>
                  <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                    {summaryTranscript}
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 flex items-center justify-between mt-2">
              <button
                className="px-4 py-2 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                onClick={() => {
                  setStep(1);
                  setReadingScores(null);
                  setSummaryScores(null);
                  setSummaryTranscript("");
                  readASR.stop();
                  sumASR.stop();
                }}
              >
                Try Again
              </button>
              <a className="text-sm text-indigo-700 hover:underline" href="/">
                Back to Vocabulary Exercise
              </a>
            </div>
          </div>
        )}
      </div>

      {/* <div className="text-[10px] text-slate-500 text-center mt-2">
        Tip: Allow microphone access. Best experienced in Chrome for speech
        recognition.
      </div> */}
    </div>
  );
}
