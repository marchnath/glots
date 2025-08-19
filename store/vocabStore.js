import { create } from "zustand";
import vocabData from "../data/vocabs.json";

// Transform the data to use only the first task from each vocabulary item
const transformedVocabData = vocabData.map((item) => {
  const task = item.tasks[0];
  return {
    id: item.id,
    meaning: item.meaning,
    phrases: item.phrases, // Include phrases from the original data
    text: task.text,
    hints: task.hints,
    wordsToReplace: task.wordsToReplace.map((wordObj) => ({
      ...wordObj,
      phrases: item.phrases, // Add phrases to each word object
    })),
  };
});

export const useVocabStore = create((set, get) => ({
  // State
  exercises: transformedVocabData,
  currentExerciseIndex: 0,
  currentWordIndex: 0, // Track which word in the current exercise
  score: 0,
  hearts: 5, // lives remaining
  userAnswers: [], // Array to store answers for current exercise (loaded from cache)
  answersCache: {}, // { [exerciseIndex]: string[] } persist answers across exercises
  selectedWordIndex: null, // Which word is currently being edited
  isAnswered: false,
  showResult: false,
  isComplete: false,
  isOutOfHearts: false,
  meaningsShown: {}, // { [exerciseIndex]: boolean } whether meaning panel is shown per exercise
  inputType: "mixed", // "hints", "voice", "typing", "mixed"
  currentInputMode: "hints", // For mixed mode - current mode for this question

  // Actions
  setInputType: (type) => {
    const { currentExerciseIndex, currentWordIndex } = get();
    let currentMode = type;

    // For mixed mode, randomly choose between hints and typing
    if (type === "mixed") {
      // Use a more varied approach to ensure both modes appear
      const seed =
        (currentExerciseIndex * 17 + currentWordIndex * 7 + Date.now()) % 100;
      currentMode = seed % 2 === 0 ? "hints" : "typing";
    }

    set({
      inputType: type,
      currentInputMode: currentMode,
    });
  },

  // Update current input mode for mixed type when moving to next question
  updateInputModeForMixed: () => {
    const { inputType, currentExerciseIndex, currentWordIndex } = get();
    if (inputType === "mixed") {
      // Use a more varied approach with alternating pattern plus some randomness
      const basePattern = (currentExerciseIndex + currentWordIndex) % 2;
      const randomFactor = Math.floor(Math.random() * 3); // 0, 1, or 2
      const shouldBeTyping = (basePattern + randomFactor) % 2 === 0;
      const newMode = shouldBeTyping ? "typing" : "hints";
      console.log(
        `Mixed mode update: Exercise ${currentExerciseIndex}, Word ${currentWordIndex}, Mode: ${newMode}`
      );
      set({ currentInputMode: newMode });
    }
  },

  setUserAnswer: (answer) => {
    const {
      currentWordIndex,
      currentExerciseIndex,
      userAnswers,
      answersCache,
    } = get();
    const currentAnswers = [...(userAnswers || [])];
    currentAnswers[currentWordIndex] = answer;
    set({
      userAnswers: currentAnswers,
      answersCache: {
        ...answersCache,
        [currentExerciseIndex]: currentAnswers,
      },
    });
  },

  selectWord: (wordIndex) => {
    set({
      selectedWordIndex: wordIndex,
      currentWordIndex: wordIndex,
      isAnswered: false,
      showResult: false,
    });
  },

  submitAnswer: () => {
    const { exercises, currentExerciseIndex, currentWordIndex, userAnswers } =
      get();
    const currentExercise = exercises[currentExerciseIndex];
    const currentWord = currentExercise.wordsToReplace[currentWordIndex];
    const userAnswer = userAnswers[currentWordIndex] || "";

    // Check if answer matches either the correct word or the first phrase
    const normalizedAnswer = userAnswer.toLowerCase().trim();
    const correctWord = currentWord.correctAnswer.toLowerCase();
    const firstPhrase = currentWord.phrases?.[0]?.toLowerCase();

    const isCorrect =
      normalizedAnswer === correctWord ||
      (firstPhrase && normalizedAnswer === firstPhrase);

    // Update score or hearts based on correctness
    if (isCorrect) {
      set({
        isAnswered: true,
        showResult: true,
        selectedWordIndex: null,
        score: get().score + 1,
      });
    } else {
      const currentHearts = get().hearts;
      const nextHearts = Math.max(0, currentHearts - 1);
      const out = nextHearts === 0;
      set({
        isAnswered: true,
        showResult: true,
        selectedWordIndex: null,
        hearts: nextHearts,
        isOutOfHearts: out,
        isComplete: out ? true : get().isComplete,
      });
    }
  },

  // Navigate to a specific exercise and load its cached answers
  goToExercise: (index) => {
    const { exercises, answersCache } = get();
    if (index < 0 || index >= exercises.length) return; // out of bounds guard
    const cached = answersCache[index] || [];
    set({
      currentExerciseIndex: index,
      currentWordIndex: 0,
      selectedWordIndex: null,
      userAnswers: cached,
      isAnswered: false,
      showResult: false,
    });
  },

  prevExercise: () => {
    const { currentExerciseIndex } = get();
    get().goToExercise(currentExerciseIndex - 1);
  },

  nextExercise: () => {
    const { currentExerciseIndex, currentWordIndex, userAnswers } = get();
    // Don't allow moving to next exercise if current word is unanswered
    const currentAnswer = userAnswers[currentWordIndex];
    if (!currentAnswer || currentAnswer.trim() === "") {
      return false; // Prevent navigation if current word is unanswered
    }
    get().goToExercise(currentExerciseIndex + 1);
    return true;
  },

  nextQuestion: () => {
    const { exercises, currentExerciseIndex, currentWordIndex, userAnswers } =
      get();
    const currentExercise = exercises[currentExerciseIndex];
    const nextWordIndex = currentWordIndex + 1;

    // Don't allow moving to next question if current word is unanswered
    const currentAnswer = userAnswers[currentWordIndex];
    if (!currentAnswer || currentAnswer.trim() === "") {
      return; // Prevent navigation if current word is unanswered
    }

    // If there are more words in the current exercise
    if (nextWordIndex < currentExercise.wordsToReplace.length) {
      set({
        currentWordIndex: nextWordIndex,
        selectedWordIndex: null,
        isAnswered: false,
        showResult: false,
      });
      // Update input mode for mixed type
      get().updateInputModeForMixed();
    } else {
      // Move to next exercise
      const nextExerciseIndex = currentExerciseIndex + 1;

      if (nextExerciseIndex >= exercises.length) {
        set({ isComplete: true });
      } else {
        const { answersCache } = get();
        set({
          currentExerciseIndex: nextExerciseIndex,
          currentWordIndex: 0,
          selectedWordIndex: null,
          userAnswers: answersCache[nextExerciseIndex] || [],
          isAnswered: false,
          showResult: false,
        });
        // Update input mode for mixed type
        get().updateInputModeForMixed();
      }
    }
  },

  resetExercise: () =>
    set({
      currentExerciseIndex: 0,
      currentWordIndex: 0,
      selectedWordIndex: null,
      score: 0,
      hearts: 5,
      userAnswers: [],
      answersCache: {},
      isAnswered: false,
      showResult: false,
      isComplete: false,
      isOutOfHearts: false,
      meaningsShown: {},
    }),

  getCurrentExercise: () => {
    const { exercises, currentExerciseIndex } = get();
    return exercises[currentExerciseIndex];
  },

  // Meaning visibility per exercise
  toggleMeaningShown: () => {
    const { currentExerciseIndex, meaningsShown } = get();
    const current = !!meaningsShown[currentExerciseIndex];
    set({
      meaningsShown: {
        ...meaningsShown,
        [currentExerciseIndex]: !current,
      },
    });
  },
  isMeaningShown: () => {
    const { currentExerciseIndex, meaningsShown } = get();
    return !!meaningsShown[currentExerciseIndex];
  },

  // Helper to check if current word is answered
  isCurrentWordAnswered: () => {
    const { currentWordIndex, userAnswers } = get();
    const currentAnswer = userAnswers[currentWordIndex];
    return currentAnswer && currentAnswer.trim() !== "";
  },

  // Navigate to next word within current exercise or next exercise
  goToNextWord: () => {
    const { exercises, currentExerciseIndex, currentWordIndex, userAnswers } =
      get();

    // Don't allow moving if current word is unanswered
    const currentAnswer = userAnswers[currentWordIndex];
    if (!currentAnswer || currentAnswer.trim() === "") {
      return false; // Prevent navigation if current word is unanswered
    }

    const currentExercise = exercises[currentExerciseIndex];
    const nextWordIndex = currentWordIndex + 1;

    // If there are more words in the current exercise
    if (nextWordIndex < currentExercise.wordsToReplace.length) {
      set({
        currentWordIndex: nextWordIndex,
        selectedWordIndex: null,
        isAnswered: false,
        showResult: false,
      });
      // Update input mode for mixed type
      get().updateInputModeForMixed();
      return true;
    } else {
      // Move to next exercise
      const success = get().nextExercise();
      if (success) {
        get().updateInputModeForMixed();
      }
      return success;
    }
  },

  // Navigate to previous word within current exercise or previous exercise
  goToPrevWord: () => {
    const { exercises, currentExerciseIndex, currentWordIndex } = get();

    // If we can go back within current exercise
    if (currentWordIndex > 0) {
      set({
        currentWordIndex: currentWordIndex - 1,
        selectedWordIndex: null,
        isAnswered: false,
        showResult: false,
      });
      // Update input mode for mixed type
      get().updateInputModeForMixed();
      return true;
    } else {
      // Move to previous exercise (to its last word)
      if (currentExerciseIndex > 0) {
        const prevExerciseIndex = currentExerciseIndex - 1;
        const { answersCache } = get();
        const prevExercise = exercises[prevExerciseIndex];
        const lastWordIndex = prevExercise.wordsToReplace.length - 1;

        set({
          currentExerciseIndex: prevExerciseIndex,
          currentWordIndex: lastWordIndex,
          selectedWordIndex: null,
          userAnswers: answersCache[prevExerciseIndex] || [],
          isAnswered: false,
          showResult: false,
        });
        // Update input mode for mixed type
        get().updateInputModeForMixed();
        return true;
      }
      return false;
    }
  },
}));
