# Minimal Wordle

A minimalist, light-themed Wordle web game built with React and Vite.

## Features
- **Curated Word Bank**: 750 target words, supported by a 14,947-word dictionary for guess validation.
- **Ordered Cycle**: Guarantees every word appears once before any repetition. Automatically re-rolls the array when all words have been played.
- **Minimalist Light Design**: Clean sans-serif typography, subtle border outlines, emerald/amber/slate feedback, zero emojis, and no unnecessary labels.
- **Persistent Progress**: Current round, word progression, win streaks, and guess distribution persist in `localStorage`.
- **Keyboard & Touch**: Full physical keyboard support and responsive on-screen virtual keyboard.

## Development
```bash
npm install
npm run dev
```

## Production Build
```bash
npm run build
```
