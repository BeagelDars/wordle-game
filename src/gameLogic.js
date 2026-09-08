import { TARGET_WORDS, VALID_GUESSES } from './words.js';

const STORAGE_KEY_CYCLE = 'wordle_cycle_data';
const STORAGE_KEY_GAME = 'wordle_active_game';
const STORAGE_KEY_STATS = 'wordle_stats';

// Fisher-Yates shuffle
export function generateOrder(length) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Load or initialize cycle state
export function loadCycleState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CYCLE);
    if (saved) {
      const data = JSON.parse(saved);
      if (
        Array.isArray(data.order) &&
        data.order.length === TARGET_WORDS.length &&
        typeof data.index === 'number'
      ) {
        return data;
      }
    }
  } catch (e) {
    console.error('Failed to parse cycle state:', e);
  }

  const initial = {
    order: generateOrder(TARGET_WORDS.length),
    index: 0,
    cycle: 1,
    completedInCycle: 0
  };
  saveCycleState(initial);
  return initial;
}

export function saveCycleState(state) {
  try {
    localStorage.setItem(STORAGE_KEY_CYCLE, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save cycle state:', e);
  }
}

// Load or initialize stats
export function loadStats() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_STATS);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse stats:', e);
  }

  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    guesses: [0, 0, 0, 0, 0, 0] // 1-indexed (1 to 6)
  };
}

export function saveStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save stats:', e);
  }
}

// Load or initialize current game
export function loadGameState(expectedWord) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GAME);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.targetWord === expectedWord) {
        return data;
      }
    }
  } catch (e) {
    console.error('Failed to parse game state:', e);
  }

  return {
    targetWord: expectedWord,
    guesses: [],
    gameStatus: 'playing' // 'playing' | 'won' | 'lost'
  };
}

export function saveGameState(state) {
  try {
    localStorage.setItem(STORAGE_KEY_GAME, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
}

// Validate word
export function isValidWord(word) {
  const upper = word.toUpperCase();
  return VALID_GUESSES.has(upper);
}

// Wordle letter evaluation
export function evaluateGuess(guess, target) {
  const result = Array(5).fill('absent');
  const targetChars = target.split('');
  const guessChars = guess.split('');
  const letterCounts = {};

  // First pass: exact matches (correct)
  for (let i = 0; i < 5; i++) {
    if (guessChars[i] === targetChars[i]) {
      result[i] = 'correct';
    } else {
      letterCounts[targetChars[i]] = (letterCounts[targetChars[i]] || 0) + 1;
    }
  }

  // Second pass: present letters (present)
  for (let i = 0; i < 5; i++) {
    if (result[i] !== 'correct') {
      const char = guessChars[i];
      if (letterCounts[char] && letterCounts[char] > 0) {
        result[i] = 'present';
        letterCounts[char]--;
      }
    }
  }

  return result;
}

// Keyboard letter status priority: correct > present > absent > undefined
export function getKeyboardStatuses(guesses, target) {
  const statuses = {};
  guesses.forEach(guess => {
    const evalResults = evaluateGuess(guess, target);
    for (let i = 0; i < 5; i++) {
      const char = guess[i];
      const status = evalResults[i];
      const current = statuses[char];

      if (status === 'correct') {
        statuses[char] = 'correct';
      } else if (status === 'present') {
        if (current !== 'correct') {
          statuses[char] = 'present';
        }
      } else if (status === 'absent') {
        if (!current) {
          statuses[char] = 'absent';
        }
      }
    }
  });
  return statuses;
}
