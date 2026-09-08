import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TARGET_WORDS } from './words.js';
import {
  loadCycleState,
  saveCycleState,
  loadStats,
  saveStats,
  loadGameState,
  saveGameState,
  isValidWord,
  evaluateGuess,
  getKeyboardStatuses,
  generateOrder
} from './gameLogic.js';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
];

export default function App() {
  // Cycle state: array of 750 shuffled word indices
  const [cycleState, setCycleState] = useState(() => loadCycleState());
  const currentTargetWord = TARGET_WORDS[cycleState.order[cycleState.index]] || TARGET_WORDS[0];

  // Active game state
  const [targetWord, setTargetWord] = useState(currentTargetWord);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing' | 'won' | 'lost'

  // Animations & UI state
  const [isShaking, setIsShaking] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [animatingRow, setAnimatingRow] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [stats, setStats] = useState(() => loadStats());
  const [bounceWinRow, setBounceWinRow] = useState(false);

  // References to prevent stale closures during event handling
  const isRevealingRef = useRef(false);
  isRevealingRef.current = isRevealing;
  const gameStatusRef = useRef(gameStatus);
  gameStatusRef.current = gameStatus;

  // Sync game state when target word changes (from cycle index)
  useEffect(() => {
    const loadedGame = loadGameState(currentTargetWord);
    setTargetWord(currentTargetWord);
    setGuesses(loadedGame.guesses);
    setGameStatus(loadedGame.gameStatus);
    setCurrentGuess('');
    setAnimatingRow(null);
    setBounceWinRow(false);
  }, [cycleState.index, currentTargetWord]);

  // Persist game state
  useEffect(() => {
    saveGameState({
      targetWord,
      guesses,
      gameStatus
    });
  }, [targetWord, guesses, gameStatus]);

  // Toast notification
  const showToast = useCallback((message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  }, []);

  // Advance to next word in the cycle
  const advanceToNextWord = useCallback(() => {
    setCycleState((prev) => {
      const nextIndex = prev.index + 1;
      if (nextIndex >= prev.order.length) {
        // All words played once: Re-roll the array
        const newOrder = generateOrder(TARGET_WORDS.length);
        const nextState = {
          order: newOrder,
          index: 0,
          cycle: prev.cycle + 1,
          completedInCycle: 0
        };
        saveCycleState(nextState);
        showToast(`All words completed. Array re-rolled for Cycle ${nextState.cycle}.`);
        return nextState;
      } else {
        const nextState = {
          ...prev,
          index: nextIndex,
          completedInCycle: prev.completedInCycle + 1
        };
        saveCycleState(nextState);
        return nextState;
      }
    });
  }, [showToast]);

  // Manual re-roll of the array
  const handleManualReroll = useCallback(() => {
    const newOrder = generateOrder(TARGET_WORDS.length);
    const nextState = {
      order: newOrder,
      index: 0,
      cycle: cycleState.cycle + 1,
      completedInCycle: 0
    };
    setCycleState(nextState);
    saveCycleState(nextState);
    showToast(`Array re-rolled. Cycle ${nextState.cycle} started.`);
    setShowStatsModal(false);
  }, [cycleState.cycle, showToast]);

  // Guess submission
  const submitGuess = useCallback(() => {
    if (isRevealingRef.current || gameStatusRef.current !== 'playing') {
      return;
    }

    if (currentGuess.length !== 5) {
      showToast('Not enough letters');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    if (!isValidWord(currentGuess)) {
      showToast('Not in word list');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    const submittedGuess = currentGuess;
    const rowIndex = guesses.length;
    const newGuesses = [...guesses, submittedGuess];

    setIsRevealing(true);
    setAnimatingRow(rowIndex);
    setGuesses(newGuesses);
    setCurrentGuess('');

    // Staggered reveal animation duration (4 * 250ms delay + 500ms animation = 1500ms)
    setTimeout(() => {
      setIsRevealing(false);
      setAnimatingRow(null);

      if (submittedGuess === targetWord) {
        setGameStatus('won');
        setBounceWinRow(true);
        const attempts = newGuesses.length;
        const messages = ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'];
        showToast(messages[attempts - 1] || 'Correct');

        setStats((prev) => {
          const newPlayed = prev.played + 1;
          const newWon = prev.won + 1;
          const newStreak = prev.currentStreak + 1;
          const newMaxStreak = Math.max(newStreak, prev.maxStreak);
          const newGuessesDist = [...prev.guesses];
          newGuessesDist[attempts - 1] = (newGuessesDist[attempts - 1] || 0) + 1;

          const updated = {
            played: newPlayed,
            won: newWon,
            currentStreak: newStreak,
            maxStreak: newMaxStreak,
            guesses: newGuessesDist
          };
          saveStats(updated);
          return updated;
        });
      } else if (newGuesses.length >= 6) {
        setGameStatus('lost');
        showToast(`Word was ${targetWord}`);

        setStats((prev) => {
          const newPlayed = prev.played + 1;
          const updated = {
            ...prev,
            played: newPlayed,
            currentStreak: 0
          };
          saveStats(updated);
          return updated;
        });
      }
    }, 1600);
  }, [currentGuess, guesses, targetWord, showToast]);

  // Key press handler
  const handleKey = useCallback(
    (key) => {
      if (isRevealingRef.current) return;

      if (gameStatusRef.current !== 'playing') {
        if (key === 'ENTER') {
          advanceToNextWord();
        }
        return;
      }

      if (key === 'ENTER') {
        submitGuess();
      } else if (key === 'BACK' || key === 'BACKSPACE') {
        setCurrentGuess((prev) => prev.slice(0, -1));
      } else if (/^[A-Z]$/.test(key)) {
        setCurrentGuess((prev) => (prev.length < 5 ? prev + key : prev));
      }
    },
    [submitGuess, advanceToNextWord]
  );

  // Keyboard event listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toUpperCase();

      if (key === 'ENTER') {
        e.preventDefault();
        handleKey('ENTER');
      } else if (key === 'BACKSPACE') {
        e.preventDefault();
        handleKey('BACK');
      } else if (/^[A-Z]$/.test(key)) {
        e.preventDefault();
        handleKey(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKey]);

  // Evaluated guesses for keyboard (only up to completed rows, delayed if revealing)
  const keyboardGuesses = isRevealing ? guesses.slice(0, -1) : guesses;
  const keyboardStatuses = getKeyboardStatuses(keyboardGuesses, targetWord);

  return (
    <div className="app-container">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <span className="cycle-badge">
            {cycleState.index + 1} / {cycleState.order.length}
            {cycleState.cycle > 1 ? ` · Cycle ${cycleState.cycle}` : ''}
          </span>
        </div>
        <h1 className="app-title">WORDLE</h1>
        <div className="header-actions">
          <button
            className="icon-btn"
            onClick={() => setShowStatsModal(true)}
            aria-label="View Statistics"
          >
            STATS
          </button>
          <button
            className="icon-btn"
            onClick={advanceToNextWord}
            aria-label="Next Word"
          >
            NEXT
          </button>
        </div>
      </header>

      {/* Game Board */}
      <main className="board-container">
        <div className="grid">
          {Array.from({ length: 6 }).map((_, rowIndex) => {
            const isCompletedRow = rowIndex < guesses.length;
            const isCurrentRow = rowIndex === guesses.length;
            const rowWord = isCompletedRow
              ? guesses[rowIndex]
              : isCurrentRow
              ? currentGuess
              : '';

            const evalResults = isCompletedRow
              ? evaluateGuess(rowWord, targetWord)
              : [];

            const isAnimating = animatingRow === rowIndex;
            const isWinningRow = bounceWinRow && rowIndex === guesses.length - 1;

            return (
              <div
                key={rowIndex}
                className={`row ${isCurrentRow && isShaking ? 'shake' : ''} ${
                  isWinningRow ? 'bounce' : ''
                }`}
              >
                {Array.from({ length: 5 }).map((_, colIndex) => {
                  const letter = rowWord[colIndex] || '';
                  const status = isCompletedRow ? evalResults[colIndex] : '';

                  let tileClass = 'tile';
                  if (letter) tileClass += ' filled';
                  if (status) tileClass += ` ${status}`;
                  if (isAnimating) tileClass += ' flip';

                  const tileStyle = isAnimating
                    ? { animationDelay: `${colIndex * 250}ms` }
                    : undefined;

                  return (
                    <div key={colIndex} className={tileClass} style={tileStyle}>
                      {letter}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </main>

      {/* Bottom End-of-Word Banner */}
      {gameStatus !== 'playing' && !isRevealing && (
        <div className="game-over-banner">
          <div className="game-over-text">
            <span className="game-over-title">
              {gameStatus === 'won'
                ? `Solved in ${guesses.length} attempt${guesses.length === 1 ? '' : 's'}`
                : `Word was ${targetWord}`}
            </span>
            <span className="game-over-subtitle">
              Word {cycleState.index + 1} of {cycleState.order.length}
              {cycleState.cycle > 1 ? ` · Cycle ${cycleState.cycle}` : ''}
            </span>
          </div>
          <button className="banner-btn" onClick={advanceToNextWord}>
            NEXT WORD
          </button>
        </div>
      )}

      {/* Virtual Keyboard */}
      <footer className="keyboard">
        {KEYBOARD_ROWS.map((row, rIdx) => (
          <div key={rIdx} className="keyboard-row">
            {row.map((key) => {
              const isWide = key === 'ENTER' || key === 'BACK';
              const status = keyboardStatuses[key] || '';
              return (
                <button
                  key={key}
                  className={`key ${isWide ? 'wide' : ''} ${status}`}
                  onClick={() => handleKey(key)}
                  aria-label={key}
                >
                  {key === 'BACK' ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                      <line x1="18" y1="9" x2="12" y2="15" />
                      <line x1="12" y1="9" x2="18" y2="15" />
                    </svg>
                  ) : (
                    key
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </footer>

      {/* Stats Modal */}
      {showStatsModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowStatsModal(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">STATISTICS</span>
              <button
                className="close-btn"
                onClick={() => setShowStatsModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{stats.played}</span>
                <span className="stat-label">Played</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">
                  {stats.played > 0
                    ? Math.round((stats.won / stats.played) * 100)
                    : 0}
                  %
                </span>
                <span className="stat-label">Win %</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.currentStreak}</span>
                <span className="stat-label">Streak</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.maxStreak}</span>
                <span className="stat-label">Max</span>
              </div>
            </div>

            <div className="distribution-section">
              <div className="section-label">Guess Distribution</div>
              {stats.guesses.map((count, idx) => {
                const maxCount = Math.max(...stats.guesses, 1);
                const pct = Math.round((count / maxCount) * 100);
                const isCurrentWin =
                  gameStatus === 'won' && guesses.length === idx + 1;
                return (
                  <div key={idx} className="dist-row">
                    <span className="dist-number">{idx + 1}</span>
                    <div className="dist-bar-wrapper">
                      <div
                        className={`dist-bar ${isCurrentWin ? 'highlight' : ''}`}
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      >
                        {count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="cycle-info-box">
              <div>
                <strong>Word Cycle {cycleState.cycle}</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                  Progress: {cycleState.index + 1} of {cycleState.order.length} words
                </div>
              </div>
              <button
                className="action-btn-secondary"
                onClick={handleManualReroll}
                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
              >
                Re-roll Array
              </button>
            </div>

            <div className="modal-actions">
              <button
                className="action-btn-primary"
                onClick={() => setShowStatsModal(false)}
              >
                CONTINUE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
