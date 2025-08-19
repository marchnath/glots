"use client";

import { useEffect, useRef, useState } from "react";
import { useVocabStore } from "../store/vocabStore";
import {
  Mic,
  Square,
  MicOff,
  CheckCircle2,
  XCircle,
  Heart,
  RotateCcw,
  ChevronDown,
  Keyboard,
  MousePointer,
  Shuffle,
} from "lucide-react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

export default function VocabularyChallenge() {
  const {
    currentExerciseIndex,
    userAnswers,
    currentWordIndex,
    isAnswered,
    showResult,
    isComplete,
    setUserAnswer,
    submitAnswer,
    nextQuestion,
    resetExercise,
    getCurrentExercise,
    exercises,
    isCurrentWordAnswered,
    goToNextWord,
    goToPrevWord,
    hearts,
    isOutOfHearts,
    inputType,
    currentInputMode,
    setInputType,
  } = useVocabStore();

  const [showFeedback, setShowFeedback] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardDirection, setCardDirection] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [typingInput, setTypingInput] = useState("");
  const recognitionRef = useRef(null);
  const speechTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);
  const hiddenInputRef = useRef(null);

  const currentExercise = getCurrentExercise();
  const currentWord = currentExercise?.wordsToReplace[currentWordIndex];

  // Helper function to check if an answer is correct (word or phrase)
  const isAnswerCorrect = (userAnswer, wordObj) => {
    if (!userAnswer || !wordObj) return false;
    const normalizedAnswer = userAnswer.toLowerCase().trim();
    const correctWord = wordObj.correctAnswer.toLowerCase();
    const firstPhrase = wordObj.phrases?.[0]?.toLowerCase();

    return (
      normalizedAnswer === correctWord ||
      (firstPhrase && normalizedAnswer === firstPhrase)
    );
  };

  // Determine the effective input mode
  const getEffectiveInputMode = () => {
    if (inputType === "mixed") {
      return currentInputMode;
    }
    return inputType;
  };

  useEffect(() => {
    setShowFeedback(false);
    setIsFlipped(false);
    setTypingInput(""); // Reset typing input when changing questions
  }, [currentExerciseIndex, currentWordIndex, userAnswers]);

  // Auto-submit when typing input matches the phrase length
  useEffect(() => {
    const targetPhrase = currentWord?.phrases?.[0];
    if (
      targetPhrase &&
      typingInput.length === targetPhrase.length &&
      typingInput.trim()
    ) {
      setUserAnswer(typingInput.trim());
      submitAnswer();
      setTimeout(() => nextQuestion(), 1200);
    }
  }, [typingInput, currentWord, setUserAnswer, submitAnswer, nextQuestion]);

  // Auto-focus input when in typing mode
  useEffect(() => {
    const effectiveMode = getEffectiveInputMode();
    if (
      effectiveMode === "typing" &&
      !isCurrentWordAnswered() &&
      hiddenInputRef.current
    ) {
      const timer = setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [
    currentExerciseIndex,
    currentWordIndex,
    inputType,
    currentInputMode,
    isCurrentWordAnswered,
  ]);

  useEffect(() => {
    if (showResult) setShowFeedback(true);
  }, [showResult]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Web Speech API
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        if (speechTimeoutRef.current) {
          clearTimeout(speechTimeoutRef.current);
        }
        const last = event.results.length - 1;
        const transcript = (event.results[last][0]?.transcript || "").trim();
        if (transcript) {
          const effectiveMode = getEffectiveInputMode();
          if (effectiveMode === "typing") {
            // For typing mode, populate the input field
            setTypingInput(transcript);
          } else {
            // For other modes, submit directly
            setUserAnswer(transcript);
            speechTimeoutRef.current = setTimeout(() => {
              submitAnswer();
              setTimeout(() => nextQuestion(), 1200);
            }, 800);
          }
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
    };
  }, [setUserAnswer, submitAnswer, nextQuestion]);

  const handleHintClick = (hint) => {
    if (isCurrentWordAnswered()) return;
    setUserAnswer(hint);
    submitAnswer();
    setTimeout(() => nextQuestion(), 1200);
  };

  const handleInputTypeChange = (type) => {
    setInputType(type);
    setShowDropdown(false);
    setTypingInput(""); // Reset typing input when changing input type
  };

  const getInputTypeIcon = (type) => {
    switch (type) {
      case "hints":
        return <MousePointer size={16} />;
      case "voice":
        return <Mic size={16} />;
      case "typing":
        return <Keyboard size={16} />;
      case "mixed":
        return <Shuffle size={16} />;
      default:
        return <MousePointer size={16} />;
    }
  };

  const getInputTypeLabel = (type) => {
    switch (type) {
      case "hints":
        return "Select Hints";
      case "voice":
        return "Voice Only";
      case "typing":
        return "Type Answer";
      case "mixed":
        return "Mixed Mode";
      default:
        return "Select Hints";
    }
  };

  const handleCardFlip = () => {
    if (isFlipped || isCurrentWordAnswered()) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleSwipeNext = () => {
    if (canGoNext()) {
      setCardDirection(1);
      setTimeout(() => {
        goToNextWord();
        setCardDirection(0);
      }, 150);
    }
  };

  const handleSwipePrev = () => {
    if (canGoPrev()) {
      setCardDirection(-1);
      setTimeout(() => {
        goToPrevWord();
        setCardDirection(0);
      }, 150);
    }
  };

  const navigateToCard = (direction) => {
    if (direction === "prev" && canGoPrev()) {
      setCardDirection(-1);
      setTimeout(() => {
        goToPrevWord();
        setCardDirection(0);
      }, 150);
    } else if (direction === "next" && canGoNext()) {
      setCardDirection(1);
      setTimeout(() => {
        goToNextWord();
        setCardDirection(0);
      }, 150);
    }
  };

  const handleDragEnd = (event, info) => {
    const { offset, velocity } = info;
    const swipeThreshold = 100;
    const velocityThreshold = 500;

    if (
      (offset.x > swipeThreshold || velocity.x > velocityThreshold) &&
      canGoPrev()
    ) {
      handleSwipePrev();
    } else if (
      (offset.x < -swipeThreshold || velocity.x < -velocityThreshold) &&
      canGoNext()
    ) {
      handleSwipeNext();
    }
  };

  const startListening = () => {
    if (!speechSupported || isCurrentWordAnswered()) return;
    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch {}
  };
  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
  };

  const isCorrect =
    isCurrentWordAnswered() &&
    isAnswerCorrect(userAnswers[currentWordIndex], currentWord);
  const hasAnyAnswer = (userAnswers || []).some(
    (a) => typeof a === "string" && a.trim().length > 0
  );

  const canGoNext = () => {
    if (!isCurrentWordAnswered()) return false;
    if (currentWordIndex < (currentExercise?.wordsToReplace.length || 0) - 1)
      return true;
    return currentExerciseIndex < exercises.length - 1;
  };
  const canGoPrev = () => currentExerciseIndex > 0 || currentWordIndex > 0;

  const renderInputInterface = () => {
    const effectiveMode = getEffectiveInputMode();

    if (effectiveMode === "typing") {
      const targetPhrase = currentWord?.phrases?.[0];
      return (
        <div className="mb-8">
          <div className="flex justify-center">
            <input
              ref={hiddenInputRef}
              type="text"
              value={typingInput}
              onChange={(e) => setTypingInput(e.target.value)}
              disabled={isCurrentWordAnswered()}
              placeholder={targetPhrase || "Type the phrase..."}
              className="text-center text-xl bg-transparent border-0  focus:outline-none px-4 py-2 min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              maxLength={targetPhrase?.length || 50}
              autoFocus
            />
          </div>
        </div>
      );
    }

    // For hints mode (including voice mode which still shows hints)
    return (
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 justify-center max-w-md">
          {currentExercise?.hints?.map((hint, index) => {
            const isUsed = currentExercise?.wordsToReplace
              .slice(0, currentWordIndex + (isCurrentWordAnswered() ? 1 : 0))
              .some(
                (w) => w.correctAnswer.toLowerCase() === hint.toLowerCase()
              );

            // Check if this hint was used as the user's answer for current word
            const isCurrentAnswer =
              isCurrentWordAnswered() &&
              userAnswers[currentWordIndex]?.toLowerCase().trim() ===
                hint.toLowerCase();

            // Check if this hint is the correct answer for current word (word or phrase)
            const isCorrectAnswer =
              hint.toLowerCase() === currentWord?.correctAnswer.toLowerCase() ||
              hint.toLowerCase() === currentWord?.phrases?.[0]?.toLowerCase();

            let buttonClass =
              "bg-gray-50 text-gray-700 ring-gray-200 hover:bg-indigo-50 hover:text-indigo-700";

            if (isCurrentAnswer) {
              // If this hint was selected by user for current word
              if (isCorrectAnswer) {
                buttonClass = "bg-emerald-50 text-emerald-700 ring-emerald-200";
              } else {
                buttonClass = "bg-rose-50 text-rose-700 ring-rose-200";
              }
            } else if (isUsed) {
              // If this hint was used for a previous word (and was correct)
              buttonClass = "bg-emerald-50 text-emerald-700 ring-emerald-200";
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleHintClick(hint)}
                disabled={isCurrentWordAnswered() || effectiveMode === "voice"}
                className={`px-4 py-2 rounded-full text-sm ring-1 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${buttonClass}`}
              >
                {hint}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFlashcardContent = () => {
    if (!currentExercise) return null;

    if (isFlipped) {
      // Back side - show meaning
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-6">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4 capitalize">
              {currentWord?.correctAnswer}
            </h3>
            <p className="text-lg text-gray-700 leading-relaxed">
              {currentExercise.meaning}
            </p>
          </div>
        </div>
      );
    }

    // Front side - show exercise
    const text = currentExercise.text;
    const wordsToReplace = currentExercise.wordsToReplace;

    const elements = [];
    let remainingText = text;
    let elementKey = 0;

    wordsToReplace.forEach((wordObj, index) => {
      const placeholder = `{{${wordObj.word}}}`;
      const i = remainingText.indexOf(placeholder);
      if (i !== -1) {
        if (i > 0) {
          elements.push(
            <span key={`text-${elementKey++}`}>
              {remainingText.slice(0, i)}
            </span>
          );
        }
        if (index < currentWordIndex) {
          // Already answered word - show user's answer
          const userAnswer = userAnswers[index] || wordObj.word;
          const correct = isAnswerCorrect(userAnswer, wordObj);
          elements.push(
            <span
              key={`done-${index}`}
              className={`px-3 py-1 rounded-md ring-1 ${
                correct
                  ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                  : "bg-rose-100 text-rose-700 ring-rose-200"
              }`}
            >
              {userAnswer}
            </span>
          );
        } else if (index === currentWordIndex) {
          // Current word
          if (isCurrentWordAnswered()) {
            // Show user's answer for current word
            const userAnswer = userAnswers[index] || wordObj.word;
            const correct = isAnswerCorrect(userAnswer, wordObj);
            elements.push(
              <span
                key={`ans-${index}`}
                className={`px-3 py-1 rounded-md ring-1 ${
                  correct
                    ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                    : "bg-rose-100 text-rose-700 ring-rose-200"
                }`}
              >
                {userAnswer}
              </span>
            );
          } else {
            // Show placeholder for unanswered current word
            elements.push(
              <button
                key={`cur-${index}`}
                type="button"
                className="px-3 py-1 rounded-md font-semibold ring-1 ring-indigo-200 bg-indigo-100 text-indigo-700 hover:bg-indigo-200/70 transition-colors"
              >
                {wordObj.word}
              </button>
            );
          }
        } else {
          // Future word - show placeholder
          elements.push(
            <span
              key={`future-${index}`}
              className="px-3 py-1 rounded-md ring-1 ring-gray-200 bg-gray-100 text-gray-500"
            >
              {wordObj.word}
            </span>
          );
        }
        remainingText = remainingText.slice(i + placeholder.length);
      }
    });
    if (remainingText.length > 0) {
      elements.push(<span key="final-text">{remainingText}</span>);
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-between p-8">
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Only show sentence context if not in typing mode */}
          {getEffectiveInputMode() !== "typing" && (
            <div className="text-xl md:text-2xl leading-relaxed text-gray-800 mb-8 text-center max-w-lg">
              {elements}
            </div>
          )}

          {renderInputInterface()}
        </div>

        <div className="flex flex-col items-center gap-4">
          {/* Voice input - always available */}
          <div className="relative">
            {isListening && (
              <span
                className="absolute inset-0 rounded-full bg-red-200/50 animate-ping"
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isListening) {
                  stopListening();
                } else {
                  startListening();
                }
              }}
              disabled={!speechSupported || isCurrentWordAnswered()}
              aria-label={isListening ? "Stop listening" : "Start voice answer"}
              className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm ring-1 ${
                isListening
                  ? "bg-rose-50 text-rose-600 ring-rose-200"
                  : "bg-indigo-50 text-indigo-600 ring-indigo-200 hover:bg-indigo-100"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {speechSupported ? (
                isListening ? (
                  <Square size={20} />
                ) : (
                  <Mic size={20} />
                )
              ) : (
                <MicOff size={20} />
              )}
            </button>
          </div>

          {!speechSupported && (
            <p className="text-xs text-gray-500 text-center">
              Voice input not supported in your browser.
            </p>
          )}
        </div>
      </div>
    );
  };

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl text-center ring-1 ring-gray-200">
        <div className="mb-6">
          <div className="text-6xl mb-4">🎉</div>
          {isOutOfHearts ? (
            <>
              <h2 className="text-3xl font-semibold text-rose-600 mb-2">
                Out of hearts
              </h2>
              <p className="text-base text-gray-600 mb-4">
                Practice again to keep improving.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-semibold text-emerald-600 mb-2">
                Nice work!
              </h2>
              <p className="text-base text-gray-600 mb-4">
                You've completed all vocabulary exercises.
              </p>
            </>
          )}
        </div>
        <button
          onClick={resetExercise}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 transition"
        >
          Practice Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-full min-h-screen flex flex-col px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-3 rounded-full bg-indigo-500"
              initial={{ width: 0 }}
              animate={{
                width: `${
                  ((currentExerciseIndex + 1) / exercises.length) * 100
                }%`,
              }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Heart
              size={24}
              className={hearts > 0 ? "text-rose-500" : "text-gray-300"}
              fill={hearts > 0 ? "currentColor" : "none"}
            />
            <span className="text-lg font-semibold text-gray-800">
              {hearts}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-gray-800">
            Replace the word
          </h1>

          {/* Input Type Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              {getInputTypeIcon(inputType)}
              <span className="hidden sm:inline">
                {getInputTypeLabel(inputType)}
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${
                  showDropdown ? "rotate-180" : ""
                }`}
              />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="py-1">
                  {[
                    {
                      value: "hints",
                      label: "Select Hints",
                      icon: MousePointer,
                    },
                    { value: "voice", label: "Voice Only", icon: Mic },
                    { value: "typing", label: "Type Answer", icon: Keyboard },
                    { value: "mixed", label: "Mixed Mode", icon: Shuffle },
                  ].map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleInputTypeChange(option.value)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                          inputType === option.value
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-gray-700"
                        }`}
                      >
                        <IconComponent size={16} />
                        <span>{option.label}</span>
                        {inputType === option.value && (
                          <CheckCircle2
                            size={16}
                            className="ml-auto text-indigo-600"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Show current mode indicator for mixed mode */}
        {inputType === "mixed" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <span>Current mode:</span>
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md">
              {getInputTypeIcon(currentInputMode)}
              <span>{getInputTypeLabel(currentInputMode)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Flashcard Container */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Main flashcard */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentExerciseIndex}-${currentWordIndex}`}
            className="relative w-full max-w-md h-96 z-10 cursor-pointer"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            whileDrag={{ scale: 1.05 }}
            initial={{
              x: cardDirection === 0 ? 0 : cardDirection > 0 ? 300 : -300,
              opacity: 0,
              scale: 0.8,
            }}
            animate={{
              x: 0,
              opacity: 1,
              scale: 1,
            }}
            exit={{
              x: cardDirection > 0 ? -300 : cardDirection < 0 ? 300 : 0,
              opacity: 0,
              scale: 0.8,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 },
            }}
          >
            <motion.div
              className="w-full h-full relative preserve-3d"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Front of card */}
              <motion.div
                className="absolute inset-0 backface-hidden bg-gradient-to-br from-indigo-50 to-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden"
                onClick={handleCardFlip}
                style={{ backfaceVisibility: "hidden" }}
              >
                {!isFlipped && renderFlashcardContent()}
              </motion.div>

              {/* Back of card */}
              <motion.div
                className="absolute inset-0 backface-hidden bg-gradient-to-br from-purple-50 to-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden"
                onClick={handleCardFlip}
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                {isFlipped && renderFlashcardContent()}
              </motion.div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation dots */}
      <div className="mt-8 text-center">
        <div className="flex justify-center items-center gap-4">
          {/* Previous dot */}
          <button
            onClick={() => navigateToCard("prev")}
            disabled={!canGoPrev()}
            className={`w-3 h-3 rounded-full transition-all duration-200 ${
              canGoPrev()
                ? "bg-gray-400 hover:bg-gray-500 cursor-pointer transform hover:scale-110"
                : "bg-gray-200 cursor-not-allowed"
            }`}
            aria-label="Previous card"
          />

          {/* Current dot */}
          <div className="w-4 h-4 rounded-full bg-indigo-500 ring-2 ring-indigo-200 transform scale-110" />

          {/* Next dot */}
          <button
            onClick={() => navigateToCard("next")}
            disabled={!canGoNext()}
            className={`w-3 h-3 rounded-full transition-all duration-200 ${
              canGoNext()
                ? "bg-gray-400 hover:bg-gray-500 cursor-pointer transform hover:scale-110"
                : "bg-gray-200 cursor-not-allowed"
            }`}
            aria-label="Next card"
          />
        </div>
      </div>
    </div>
  );
}
