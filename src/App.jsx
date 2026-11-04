import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, onSnapshot
} from 'firebase/firestore';
import { 
  Trophy, RotateCw, Volume2, VolumeX, Plus, Trash2, Edit2, Play, Check, 
  X, RefreshCw, Smartphone, Tv, ShieldCheck, Award, Zap, AlertTriangle, Sparkles, HelpCircle
} from 'lucide-react';

// ==========================================
// FIREBASE & APP CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAmN_TnyIkGLPicHuMx4ZIaSMRyMrnSwUc",
  authDomain: "wc-training-wheel.firebaseapp.com",
  projectId: "wc-training-wheel",
  storageBucket: "wc-training-wheel.firebasestorage.app",
  messagingSenderId: "38684144478",
  appId: "1:38684144478:web:9b1d8f68a05e57d9ce15cf"
};

const appId = 'wc-training-wheel';
let firebaseApp = null;
let db = null;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
  } catch (e) {
    console.warn('Firebase init error:', e);
  }
}

// Default initial state for a new game session
const INITIAL_GAME_STATE = {
  status: 'idle', // 'idle', 'spinning', 'landed', 'solved', 'game_over'
  activePuzzleIndex: 0,
  puzzles: [
    { phrase: 'SAFETY FIRST ALWAYS', category: 'WASHINGTON COUNTY CULTURE', hint: 'Priority in the workplace' },
    { phrase: 'EXCELLENT CUSTOMER SERVICE', category: 'CORE VALUES', hint: 'Our main client goal' },
    { phrase: 'CONTINUOUS IMPROVEMENT', category: 'LEAN METHODOLOGY', hint: 'Kaizen mindset' }
  ],
  guessedLetters: [], // e.g. ['A', 'B', 'S']
  players: [
    { id: 'player1', name: 'Alex', score: 0, totalScore: 0, color: '#005B2B' },
    { id: 'player2', name: 'Jordan', score: 0, totalScore: 0, color: '#003865' },
    { id: 'player3', name: 'Taylor', score: 0, totalScore: 0, color: '#008EAA' }
  ],
  activePlayerIndex: 0,
  currentSpinValue: null, // number or 'BANKRUPT' or 'LOSE_A_TURN' or 'FREE_SPIN'
  wheelRotation: 0, // degrees
  lastActionText: 'Welcome to Washington County Training Wheel! Press Start Game in Admin.',
  soundEnabled: true,
  solveAttempt: null
};

// Wheel wedges config with Washington County palette accents
const WHEEL_WEDGES = [
  { label: '500', value: 500, color: '#005B2B', text: '#ffffff' },
  { label: 'BANKRUPT', value: 'BANKRUPT', color: '#1a202c', text: '#ef4444' },
  { label: '250', value: 250, color: '#003865', text: '#ffffff' },
  { label: '750', value: 750, color: '#78BE21', text: '#003865' },
  { label: 'LOSE A TURN', value: 'LOSE_A_TURN', color: '#ea580c', text: '#ffffff' },
  { label: '1000', value: 1000, color: '#008EAA', text: '#ffffff' },
  { label: '100', value: 100, color: '#005B2B', text: '#ffffff' },
  { label: '2000', value: 2000, color: '#78BE21', text: '#003865' },
  { label: 'FREE SPIN', value: 'FREE_SPIN', color: '#003865', text: '#ffffff' },
  { label: '300', value: 300, color: '#008EAA', text: '#ffffff' },
  { label: '400', value: 400, color: '#005B2B', text: '#ffffff' },
  { label: '1500', value: 1500, color: '#78BE21', text: '#003865' }
];

// Alphabet list
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ==========================================
// WEB AUDIO SYNTHESIZER (NO EXTERNAL FILES)
// ==========================================
class SoundFX {
  ctx = null;

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTick() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }

  playDing() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.5);
    } catch (e) {}
  }

  playBuzzer() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, now); // Low buzz
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.4);
    } catch (e) {}
  }

  playWin() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.3, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.4);
      });
    } catch (e) {}
  }

  playTurnChange() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.2);
    } catch (e) {}
  }
}

const sfx = new SoundFX();

const ADMIN_SECRET = '1234';

// ==========================================
// MAIN COMPONENT & STATE MANAGER
// ==========================================
export default function App() {
  const [viewMode, setViewMode] = useState('display'); // 'display', 'player', 'admin'
  const [selectedPlayerId, setSelectedPlayerId] = useState('player1');
  const [isPlayerSelected, setIsPlayerSelected] = useState(false);
  const [showPlayerSolveModal, setShowPlayerSolveModal] = useState(false);
  const [localSolveInput, setLocalSolveInput] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminPassError, setAdminPassError] = useState(false);
  const [gameState, setGameState] = useState(INITIAL_GAME_STATE);
  const [newPuzzlePhrase, setNewPuzzlePhrase] = useState('');
  const [newPuzzleCategory, setNewPuzzleCategory] = useState('');
  const [newPuzzleHint, setNewPuzzleHint] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const prevGameStateRef = useRef(gameState);

  // Dynamic calculation of current active puzzle & active player
  const safeActiveIndex = (gameState.activePuzzleIndex >= 0 && gameState.activePuzzleIndex < (gameState.puzzles?.length || 0))
    ? gameState.activePuzzleIndex 
    : 0;

  const currentPuzzle = gameState.puzzles?.[safeActiveIndex] || {
    phrase: 'SAFETY FIRST ALWAYS',
    category: 'WASHINGTON COUNTY CULTURE',
    hint: 'Priority in the workplace'
  };

  const activePlayer = gameState.players?.[gameState.activePlayerIndex] || gameState.players?.[0] || { name: 'Player', color: '#005B2B' };

  // Sync state update helper function
  const updateGame = (updater) => {
    setGameState((prev) => {
      const nextState = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (db) {
        const gameDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'current');
        setDoc(gameDocRef, nextState, { merge: true }).catch(() => {});
      }
      return nextState;
    });
  };

  // Sound triggering on game state changes (Only play on Display TV View)
  useEffect(() => {
    if (!gameState.soundEnabled || viewMode !== 'display') return;
    const prev = prevGameStateRef.current;

    if (prev.status === 'spinning' && gameState.status === 'landed') {
      if (gameState.currentSpinValue === 'BANKRUPT' || gameState.currentSpinValue === 'LOSE_A_TURN') {
        sfx.playBuzzer();
      } else {
        sfx.playDing();
      }
    } else if (prev.status !== 'solved' && gameState.status === 'solved') {
      sfx.playWin();
    } else if (prev.activePlayerIndex !== gameState.activePlayerIndex) {
      sfx.playTurnChange();
    }

    prevGameStateRef.current = gameState;
  }, [gameState, viewMode]);

  // Firestore Sync Effect
  useEffect(() => {
    if (!db) return;
    const gameDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'current');
    
    const unsubscribe = onSnapshot(gameDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameState(data);
      }
    }, (err) => {
      console.warn("Firestore sync error:", err);
    });

    return () => unsubscribe();
  }, []);

  // Spin Wheel Action (Corrected angle alignment to match top 12 o'clock pointer)
  const handleSpinWheel = () => {
    if (gameState.status !== 'idle' && gameState.status !== 'landed') return;

    // Calculate spin wedge landing against 12 o'clock top pointer
    const randomIndex = Math.floor(Math.random() * WHEEL_WEDGES.length);
    const wedgeAngle = 360 / WHEEL_WEDGES.length;
    
    // SVG 0deg starts at 3 o'clock (90deg East). 
    // Top pointer is at 12 o'clock (270deg / -90deg North).
    // Correct total rotation formula accounting for 90-degree initial SVG offset:
    const baseWedgeAngle = randomIndex * wedgeAngle + (wedgeAngle / 2);
    const targetAngleAtTop = (360 - baseWedgeAngle - 90 + 360) % 360;
    
    const currentRot = gameState.wheelRotation || 0;
    const currentNormalized = currentRot % 360;
    let distanceToTarget = targetAngleAtTop - currentNormalized;
    if (distanceToTarget <= 0) {
      distanceToTarget += 360;
    }
    
    // Add 5 full rotations (1800 deg) + exact distance to target wedge center at top
    const newTotalRotation = currentRot + 1800 + distanceToTarget;

    updateGame((prev) => ({
      ...prev,
      status: 'spinning',
      wheelRotation: newTotalRotation,
      lastActionText: `${activePlayer.name} is spinning the wheel...`
    }));

    if (gameState.soundEnabled && viewMode === 'display') {
      let ticks = 0;
      const interval = setInterval(() => {
        sfx.playTick();
        ticks++;
        if (ticks > 22) clearInterval(interval);
      }, 130);
    }

    setTimeout(() => {
      updateGame((prev) => {
        const chosenWedge = WHEEL_WEDGES[randomIndex];
        let actionMsg = `${activePlayer.name} landed on $${chosenWedge.label}! Select a letter.`;
        let nextStatus = 'landed';
        let updatedPlayers = [...prev.players];
        let nextPlayerIndex = prev.activePlayerIndex;

        if (chosenWedge.value === 'BANKRUPT') {
          actionMsg = `OH NO! ${activePlayer.name} hit BANKRUPT! Lost turn and round earnings.`;
          updatedPlayers[prev.activePlayerIndex] = {
            ...updatedPlayers[prev.activePlayerIndex],
            score: 0
          };
          nextPlayerIndex = (prev.activePlayerIndex + 1) % prev.players.length;
          nextStatus = 'idle';
        } else if (chosenWedge.value === 'LOSE_A_TURN') {
          actionMsg = `LOSE A TURN! ${activePlayer.name}'s turn is skipped.`;
          nextPlayerIndex = (prev.activePlayerIndex + 1) % prev.players.length;
          nextStatus = 'idle';
        } else if (chosenWedge.value === 'FREE_SPIN') {
          actionMsg = `FREE SPIN! ${activePlayer.name} gets an extra spin or letter call!`;
        }

        return {
          ...prev,
          status: nextStatus,
          currentSpinValue: chosenWedge.value,
          players: updatedPlayers,
          activePlayerIndex: nextPlayerIndex,
          lastActionText: actionMsg
        };
      });
    }, 3200);
  };

  const handleSelectLetter = (letter) => {
    if (gameState.guessedLetters.includes(letter)) return;

    const phraseUpper = currentPuzzle.phrase.toUpperCase();
    const count = phraseUpper.split('').filter((char) => char === letter).length;

    let pointsEarned = 0;
    let spinVal = typeof gameState.currentSpinValue === 'number' ? gameState.currentSpinValue : 0;
    
    if (count > 0 && spinVal > 0) {
      pointsEarned = count * spinVal;
    }

    const nextGuessed = [...gameState.guessedLetters, letter];
    const uniquePhraseLetters = Array.from(new Set(phraseUpper.replace(/[^A-Z]/g, '')));
    const isPuzzleSolved = uniquePhraseLetters.every((l) => nextGuessed.includes(l));

    updateGame((prev) => {
      const updatedPlayers = [...prev.players];
      let nextPlayerIdx = prev.activePlayerIndex;

      if (count > 0) {
        updatedPlayers[prev.activePlayerIndex] = {
          ...updatedPlayers[prev.activePlayerIndex],
          score: updatedPlayers[prev.activePlayerIndex].score + pointsEarned
        };
        if (gameState.soundEnabled && viewMode === 'display') sfx.playDing();
      } else {
        if (gameState.soundEnabled && viewMode === 'display') sfx.playBuzzer();
        nextPlayerIdx = (prev.activePlayerIndex + 1) % prev.players.length;
      }

      if (isPuzzleSolved) {
        updatedPlayers[prev.activePlayerIndex] = {
          ...updatedPlayers[prev.activePlayerIndex],
          totalScore: updatedPlayers[prev.activePlayerIndex].totalScore + updatedPlayers[prev.activePlayerIndex].score
        };
      }

      return {
        ...prev,
        guessedLetters: nextGuessed,
        players: updatedPlayers,
        activePlayerIndex: nextPlayerIdx,
        status: isPuzzleSolved ? 'solved' : 'idle',
        currentSpinValue: null,
        lastActionText: count > 0 
          ? `Correct! '${letter}' appeared ${count} time(s)! +$${pointsEarned}`
          : `Sorry, there are no '${letter}'s! Next player's turn.`
      };
    });
  };

  const handleSolveAttempt = (attemptString) => {
    const cleanAttempt = attemptString.trim().toUpperCase();
    const cleanActual = currentPuzzle.phrase.trim().toUpperCase();

    if (cleanAttempt === cleanActual) {
      const allLetters = ALPHABET.filter((char) => cleanActual.includes(char));
      
      updateGame((prev) => {
        const updatedPlayers = [...prev.players];
        const bonusPoints = 1000;
        updatedPlayers[prev.activePlayerIndex] = {
          ...updatedPlayers[prev.activePlayerIndex],
          score: updatedPlayers[prev.activePlayerIndex].score + bonusPoints,
          totalScore: updatedPlayers[prev.activePlayerIndex].totalScore + updatedPlayers[prev.activePlayerIndex].score + bonusPoints
        };

        return {
          ...prev,
          guessedLetters: Array.from(new Set([...prev.guessedLetters, ...allLetters])),
          status: 'solved',
          players: updatedPlayers,
          lastActionText: `🎉 AMAZING! ${activePlayer.name} SOLVED THE PUZZLE correctly!`
        };
      });
    } else {
      if (gameState.soundEnabled && viewMode === 'display') sfx.playBuzzer();
      updateGame((prev) => ({
        ...prev,
        activePlayerIndex: (prev.activePlayerIndex + 1) % prev.players.length,
        status: 'idle',
        lastActionText: `Incorrect solve attempt! Turn moves to the next player.`
      }));
    }
  };

  const handleNextRound = () => {
    const nextPuzzleIdx = (gameState.activePuzzleIndex + 1) % gameState.puzzles.length;
    updateGame((prev) => ({
      ...prev,
      status: 'idle',
      activePuzzleIndex: nextPuzzleIdx,
      guessedLetters: [],
      currentSpinValue: null,
      players: prev.players.map(p => ({ ...p, score: 0 })),
      lastActionText: `Round ${nextPuzzleIdx + 1} Started! Category: ${gameState.puzzles[nextPuzzleIdx]?.category || 'Training'}`
    }));
  };

  const handleAddPlayerSubmit = (e) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    if (gameState.players.length >= 8) return;
    const colors = ['#005B2B', '#003865', '#008EAA', '#78BE21', '#ea580c', '#8b5cf6', '#ec4899', '#f59e0b'];
    const newId = `player${Date.now()}`;
    const color = colors[gameState.players.length % colors.length];
    const newP = { id: newId, name: newPlayerName.trim(), score: 0, totalScore: 0, color };
    updateGame((prev) => ({
      ...prev,
      players: [...prev.players, newP]
    }));
    setNewPlayerName('');
  };

  const handleDeletePuzzle = (puzzleIdx) => {
    if (gameState.puzzles.length <= 1) {
      alert("You must keep at least one puzzle in the bank!");
      return;
    }
    updateGame((prev) => {
      const updatedPuzzles = prev.puzzles.filter((_, idx) => idx !== puzzleIdx);
      let nextActiveIdx = prev.activePuzzleIndex;
      if (puzzleIdx === prev.activePuzzleIndex) {
        nextActiveIdx = 0;
      } else if (puzzleIdx < prev.activePuzzleIndex) {
        nextActiveIdx = prev.activePuzzleIndex - 1;
      }
      return {
        ...prev,
        puzzles: updatedPuzzles,
        activePuzzleIndex: nextActiveIdx,
        guessedLetters: puzzleIdx === prev.activePuzzleIndex ? [] : prev.guessedLetters,
        status: puzzleIdx === prev.activePuzzleIndex ? 'idle' : prev.status
      };
    });
  };

  const phrase = (currentPuzzle.phrase || '').trim().toUpperCase();
  const words = phrase ? phrase.split(/\s+/) : [];
  const isMyTurn = gameState.players[gameState.activePlayerIndex]?.id === selectedPlayerId;
  const playerObj = gameState.players.find((p) => p.id === selectedPlayerId) || gameState.players[0];
  const canSpin = isMyTurn && (gameState.status === 'idle' || gameState.status === 'landed');
  const canPickLetter = isMyTurn && gameState.status === 'landed' && typeof gameState.currentSpinValue === 'number';

  return (
    <div className="min-h-screen bg-slate-950 font-sans">
      {/* Top Floating View Switcher Bar */}
      <nav className="bg-[#003865] border-b border-[#008EAA]/40 p-2 sticky top-0 z-50 backdrop-blur flex justify-center gap-2">
        <button
          onClick={() => setViewMode('display')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            viewMode === 'display'
              ? 'bg-[#78BE21] text-[#003865] shadow-md'
              : 'bg-[#005B2B] text-white hover:bg-[#008EAA]'
          }`}
        >
          <Tv className="w-4 h-4" /> BIG SCREEN TV VIEW
        </button>

        <button
          onClick={() => setViewMode('player')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            viewMode === 'player'
              ? 'bg-[#78BE21] text-[#003865] shadow-md'
              : 'bg-[#005B2B] text-white hover:bg-[#008EAA]'
          }`}
        >
          <Smartphone className="w-4 h-4" /> PLAYER PHONE VIEW
        </button>

        <button
          onClick={() => setViewMode('admin')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            viewMode === 'admin'
              ? 'bg-[#78BE21] text-[#003865] shadow-md'
              : 'bg-[#005B2B] text-white hover:bg-[#008EAA]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> ADMIN PANEL
        </button>
      </nav>

      {/* 1. DISPLAY VIEW */}
      {viewMode === 'display' && (
        <div className="min-h-screen bg-[#071927] text-white flex flex-col justify-between p-4 sm:p-6 overflow-hidden relative font-sans">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#005B2B]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#008EAA]/20 rounded-full blur-3xl pointer-events-none" />

          <header className="flex flex-col sm:flex-row justify-between items-center bg-[#003865]/90 border border-[#008EAA]/40 rounded-2xl p-4 shadow-2xl backdrop-blur gap-4 z-10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#78BE21]/20 text-[#78BE21] rounded-xl border border-[#78BE21]/30">
                <Trophy className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-wider text-white">WASHINGTON COUNTY</h1>
                <p className="text-xs text-[#78BE21] uppercase tracking-widest font-extrabold">Training & Learning Wheel</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-[#071927] px-6 py-2.5 rounded-xl border border-[#003865]">
              <div className="text-right">
                <div className="text-xs text-slate-400 font-semibold uppercase">Category</div>
                <div className="text-lg font-bold text-[#78BE21]">{currentPuzzle.category}</div>
              </div>
              {currentPuzzle.hint && (
                <div className="hidden lg:block border-l border-slate-800 pl-4 text-left">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Hint</div>
                  <div className="text-sm text-slate-200 italic">{currentPuzzle.hint}</div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateGame({ soundEnabled: !gameState.soundEnabled })}
                className="p-2.5 rounded-xl bg-[#003865] hover:bg-[#008EAA] text-white border border-slate-700 transition"
                title="Toggle Audio SFX"
              >
                {gameState.soundEnabled ? <Volume2 className="w-5 h-5 text-[#78BE21]" /> : <VolumeX className="w-5 h-5 text-rose-400" />}
              </button>
              <div className="text-xs font-mono bg-[#071927] px-3 py-2 rounded-xl text-slate-300 border border-[#003865]">
                ROUND {gameState.activePuzzleIndex + 1} / {gameState.puzzles.length}
              </div>
            </div>
          </header>

          <main className="my-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
            <div className="lg:col-span-8 flex flex-col items-center justify-center">
              <div className="w-full bg-[#003865]/90 border-4 border-[#78BE21]/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(120,190,33,0.15)] backdrop-blur">
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-4xl mx-auto">
                  {words.map((word, wordIdx) => (
                    <React.Fragment key={wordIdx}>
                      <div className="flex gap-1.5 sm:gap-2 my-1">
                        {word.split('').map((char, charIdx) => {
                          const isRevealed = gameState.guessedLetters.includes(char) || !ALPHABET.includes(char);
                          return (
                            <div
                              key={charIdx}
                              className={`w-8 h-11 sm:w-11 sm:h-15 border-2 flex items-center justify-center font-black text-lg sm:text-2xl rounded-lg shadow-inner transition-all duration-500 transform ${
                                !ALPHABET.includes(char)
                                  ? 'bg-transparent border-transparent text-[#78BE21]'
                                  : isRevealed
                                  ? 'bg-white border-[#005B2B] text-[#003865] shadow-md scale-100 rotate-0'
                                  : 'bg-[#005B2B]/90 border-[#78BE21]/40 text-transparent scale-95'
                              }`}
                            >
                              {isRevealed ? char : ''}
                            </div>
                          );
                        })}
                      </div>
                      {wordIdx < words.length - 1 && (
                        <div className="w-4 sm:w-6 h-11 sm:h-15 inline-block shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="mt-6 w-full bg-[#003865]/80 border border-[#008EAA]/40 rounded-2xl p-4 text-center shadow-lg">
                <div className="text-xs font-bold text-[#78BE21] uppercase tracking-wider mb-1">Status Log</div>
                <div className="text-lg sm:text-xl font-bold text-white animate-pulse">
                  {gameState.lastActionText}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col items-center justify-center">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
                <div className="absolute -top-3 z-30 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[32px] border-t-[#78BE21] drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]" />

                <div
                  className="w-full h-full rounded-full shadow-[0_0_40px_rgba(0,0,0,0.9)] border-8 border-[#003865] overflow-hidden relative transition-transform ease-out"
                  style={{
                    transform: `rotate(${gameState.wheelRotation}deg)`,
                    transitionDuration: gameState.status === 'spinning' ? '3.2s' : '0s'
                  }}
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    {WHEEL_WEDGES.map((wedge, idx) => {
                      const angle = 360 / WHEEL_WEDGES.length;
                      const startAngle = idx * angle;
                      const endAngle = (idx + 1) * angle;
                      const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180);
                      const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180);
                      const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180);
                      const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180);
                      const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;
                      const textAngle = startAngle + angle / 2;
                      const isLongText = wedge.label.length > 5;
                      const fontSize = isLongText ? "3.2" : "4.8";
                      const textRadius = isLongText ? 31 : 33;

                      return (
                        <g key={idx}>
                          <path d={pathData} fill={wedge.color} stroke="#003865" strokeWidth="0.5" />
                          <text
                            x="50"
                            y={50 - textRadius}
                            fill={wedge.text}
                            fontSize={fontSize}
                            fontWeight="900"
                            letterSpacing={isLongText ? "-0.2" : "0"}
                            dominantBaseline="central"
                            textAnchor="middle"
                            transform={`rotate(${textAngle + 90}, 50, 50)`}
                          >
                            {wedge.label}
                          </text>
                        </g>
                      );
                    })}
                    <circle cx="50" cy="50" r="10" fill="#003865" stroke="#78BE21" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              {gameState.currentSpinValue && (
                <div className="mt-4 px-6 py-2 rounded-xl bg-[#78BE21] text-[#003865] font-black text-xl shadow-lg animate-bounce">
                  LANDED ON: {gameState.currentSpinValue}
                </div>
              )}
            </div>
          </main>

          <footer className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch z-10">
            <div className="lg:col-span-8 bg-[#003865]/90 border border-[#008EAA]/40 rounded-2xl p-4 flex flex-wrap sm:flex-nowrap gap-4 justify-around items-center shadow-xl">
              {gameState.players.map((p, idx) => {
                const isActive = idx === gameState.activePlayerIndex;
                return (
                  <div
                    key={p.id}
                    className={`flex-1 min-w-[140px] p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-[#005B2B] border-[#78BE21] shadow-[0_0_20px_rgba(120,190,33,0.3)] scale-105'
                        : 'bg-[#071927]/80 border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-bold text-sm truncate">{p.name}</span>
                      {isActive && <span className="text-[10px] bg-[#78BE21] text-[#003865] px-1.5 py-0.5 rounded font-black">TURN</span>}
                    </div>
                    <div className="flex justify-between items-baseline mt-2">
                      <div>
                        <span className="text-[10px] text-slate-300 uppercase block">Round</span>
                        <span className="text-xl font-extrabold text-[#78BE21]">${p.score}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-300 uppercase block">Total</span>
                        <span className="text-sm font-bold text-slate-200">${p.totalScore}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-4 bg-[#003865]/90 border border-[#008EAA]/40 rounded-2xl p-4 shadow-xl flex flex-col justify-center">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
                Used Letters Board
              </div>
              <div className="flex flex-wrap justify-center gap-1">
                {ALPHABET.map((char) => {
                  const isUsed = gameState.guessedLetters.includes(char);
                  return (
                    <span
                      key={char}
                      className={`w-6 h-6 text-xs font-bold rounded flex items-center justify-center border ${
                        isUsed
                          ? 'bg-slate-900 border-slate-800 text-slate-600 line-through'
                          : 'bg-[#005B2B] border-[#78BE21] text-white'
                      }`}
                    >
                      {char}
                    </span>
                  );
                })}
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* 2. PLAYER PHONE VIEW */}
      {viewMode === 'player' && (
        !isPlayerSelected ? (
          <div className="min-h-screen bg-[#071927] text-white p-6 max-w-md mx-auto flex flex-col justify-center items-center font-sans">
            <div className="w-full bg-[#003865] border border-[#008EAA]/40 rounded-3xl p-6 shadow-2xl text-center">
              <div className="p-3 bg-[#78BE21]/20 text-[#78BE21] rounded-2xl w-14 h-14 flex items-center justify-center mx-auto mb-4 border border-[#78BE21]/30">
                <Smartphone className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Join Game</h2>
              <p className="text-xs text-[#78BE21] font-extrabold uppercase mb-6">Select your name to register your phone</p>

              <div className="space-y-3 mb-6">
                {gameState.players.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPlayerId(p.id);
                      setIsPlayerSelected(true);
                    }}
                    className="w-full py-4 px-4 bg-[#005B2B] hover:bg-[#78BE21] hover:text-[#003865] font-black text-lg rounded-2xl border border-[#78BE21]/30 transition shadow-lg flex items-center justify-between"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                    <span className="text-xs opacity-75">Select →</span>
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-slate-400">Ask your host if your name is not listed yet.</p>
            </div>
          </div>
        ) : (
          <div className="min-h-screen bg-[#F8F9FA] text-[#1A202C] p-4 max-w-md mx-auto flex flex-col justify-between font-sans">
            <header className="bg-[#003865] text-white rounded-2xl p-4 shadow-xl">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs text-[#78BE21] font-extrabold uppercase">Washington County Player Phone</div>
                <button
                  onClick={() => setIsPlayerSelected(false)}
                  className="text-[10px] bg-[#005B2B] px-2 py-1 rounded text-slate-200 hover:text-white"
                >
                  Switch Name
                </button>
              </div>
              
              <div className="flex items-center gap-3 bg-[#071927] p-3 rounded-xl border border-white/10 mb-3">
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: playerObj?.color }} />
                <span className="font-