import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ProjectState, LyricLine } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { createObjectUrl, isRTLText, formatTime, isPunctuationOnly } from '../../utils';
import { ImmersiveBokehBackground } from './ImmersiveBokehBackground';
import { CompletionModal } from './CompletionModal';
import { 
  ChallengeToken, 
  JumbledWordItem, 
  PlacedBlankItem, 
  WebxdcPlayerStat, 
  distributeJumbledWords 
} from './wordLayoutUtils';
import confetti from 'canvas-confetti';
import { 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  Play, 
  Pause, 
  Music, 
  Sparkles, 
  Forward, 
  Trophy, 
  Star, 
  StarOff, 
  HelpCircle 
} from 'lucide-react';

interface Props {
  state: ProjectState | null;
  isStandalone?: boolean;
}

export default function PlayerPreview({ state, isStandalone = false }: Props) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'challenge' | 'end'>('intro');
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<LyricLine | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // Performance / animation preference
  const isDashboardDisabledDefault = Boolean(state?.settings?.disableAnimations);
  const [animationsDisabled, setAnimationsDisabled] = useState(isDashboardDisabledDefault);

  useEffect(() => {
    setAnimationsDisabled(Boolean(state?.settings?.disableAnimations));
  }, [state?.settings?.disableAnimations]);

  // Challenge game loop state
  const [timeLeft, setTimeLeft] = useState(120);
  const [errors, setErrors] = useState(0);
  const [totalAccumulatedErrors, setTotalAccumulatedErrors] = useState(0);
  const [failureReason, setFailureReason] = useState<'time' | 'errors' | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [verifyFeedback, setVerifyFeedback] = useState<string | null>(null);

  // Challenge Tokens & Interaction
  const [challengeTokens, setChallengeTokens] = useState<ChallengeToken[]>([]);
  const [filledBlanks, setFilledBlanks] = useState<(PlacedBlankItem | null)[]>([]);
  const [lockedBlanks, setLockedBlanks] = useState<boolean[]>([]);
  const [jumbledWords, setJumbledWords] = useState<JumbledWordItem[]>([]);
  const [selectedWord, setSelectedWord] = useState<JumbledWordItem | null>(null);
  const [activeHoverSlotIndex, setActiveHoverSlotIndex] = useState<number | null>(null);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  // MCQ (Multiple Choice) State
  const [mcqShuffledOptions, setMcqShuffledOptions] = useState<string[]>([]);
  const [mcqCorrectOption, setMcqCorrectOption] = useState<string>('');

  // Game Victory Summary Modal
  const [showWinStatsModal, setShowWinStatsModal] = useState(false);
  const [communityStats, setCommunityStats] = useState<WebxdcPlayerStat>({ totalPlayed: 1, totalWon: 1 });
  const [solvedChallengeIds, setSolvedChallengeIds] = useState<string[]>([]);

  const audioRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const dropZoneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const jumbledAreaRef = useRef<HTMLDivElement>(null);
  const isFadingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const [lyricsTrackY, setLyricsTrackY] = useState<number>(0);
  const lineItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Web Audio API refs for real-time volume & beat reactive background
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceConnectedRef = useRef(false);
  const audioReactiveBgRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothVolumeRef = useRef(0);

  // Initialize Web Audio API Analyser on first playback interaction
  const initAudioAnalyser = useCallback(() => {
    if (!audioRef.current || sourceConnectedRef.current) return;
    try {
      // Bypass createMediaElementSource on video elements in mobile WebViews as it mutes audio or freezes video decoding
      if (state?.media.type === 'video') return;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }

      if (!sourceConnectedRef.current && audioRef.current) {
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.75;

        const source = audioContextRef.current.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(audioContextRef.current.destination);

        analyserRef.current = analyser;
        sourceConnectedRef.current = true;
      }
    } catch (e) {
      console.warn('Web Audio initialization (benign fallback):', e);
    }
  }, [state?.media.type]);

  useEffect(() => {
    if (animationsDisabled) return;

    let isMounted = true;
    const dataArray = new Uint8Array(64);

    const updateAudioReactivity = () => {
      if (!isMounted) return;

      let instantVol = 0;
      if (analyserRef.current && isAudioPlaying) {
        try {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          const binCount = 28;
          for (let i = 1; i <= binCount; i++) {
            sum += dataArray[i];
          }
          instantVol = (sum / binCount) / 255;
        } catch (e) {
          instantVol = 0;
        }
      }

      // Dynamic beat & vocal modulation fallback when playing to guarantee vibrant, responsive pulsing
      if (isAudioPlaying && audioRef.current) {
        const t = audioRef.current.currentTime || 0;
        const proceduralRhythm = Math.abs(Math.sin(t * 3.14 * 2.2)) * 0.5 + Math.abs(Math.cos(t * 1.6)) * 0.3;
        if (instantVol === 0) {
          instantVol = 0.35 + proceduralRhythm * 0.45;
        } else {
          instantVol = instantVol * 0.7 + (0.3 + proceduralRhythm * 0.4) * 0.3;
        }
      }

      if (isAudioPlaying) {
        if (instantVol > smoothVolumeRef.current) {
          smoothVolumeRef.current = smoothVolumeRef.current * 0.22 + instantVol * 0.78;
        } else {
          smoothVolumeRef.current = smoothVolumeRef.current * 0.88 + instantVol * 0.12;
        }
      } else {
        smoothVolumeRef.current = smoothVolumeRef.current * 0.80;
      }

      const v = smoothVolumeRef.current; // 0.0 to 1.0

      if (audioReactiveBgRef.current) {
        // High-contrast, vibrant audio-reactive modulation for background canvas
        const opacity = 0.22 + v * 0.78;
        const scale = 1.0 + v * 0.28;
        const brightness = 0.85 + v * 0.95;

        audioReactiveBgRef.current.style.opacity = opacity.toFixed(3);
        audioReactiveBgRef.current.style.transform = `scale(${scale.toFixed(3)})`;
        audioReactiveBgRef.current.style.filter = `brightness(${brightness.toFixed(3)})`;
      }

      animationFrameRef.current = requestAnimationFrame(updateAudioReactivity);
    };

    animationFrameRef.current = requestAnimationFrame(updateAudioReactivity);

    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animationsDisabled, isAudioPlaying]);

  // Setup media and cover URLs
  useEffect(() => {
    if (state?.media.file) {
      const url = createObjectUrl(state.media.file);
      setMediaUrl(url);
      return () => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      };
    } else {
      setMediaUrl(null);
    }
  }, [state?.media.file]);

  useEffect(() => {
    if (state?.metadata.coverImage) {
      const url = createObjectUrl(state.metadata.coverImage);
      setCoverUrl(url);
      return () => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      };
    } else {
      setCoverUrl(null);
    }
  }, [state?.metadata.coverImage]);

  // Setup Webxdc updates listener
  useEffect(() => {
    const isWebxdc = typeof (window as any).webxdc !== 'undefined';
    if (isWebxdc && (window as any).webxdc?.setUpdateListener) {
      try {
        (window as any).webxdc.setUpdateListener((update: any) => {
          if (update.payload?.type === 'game_result') {
            setCommunityStats(prev => ({
              totalPlayed: (prev.totalPlayed || 0) + 1,
              totalWon: update.payload.won ? (prev.totalWon || 0) + 1 : (prev.totalWon || 0)
            }));
          }
        });
      } catch (e) {
        console.warn('Webxdc listener setup:', e);
      }
    }
  }, []);

  // Smooth Audio Fading helper
  const fadeAudio = (targetVol: number, durationMs: number = 300): Promise<void> => {
    return new Promise((resolve) => {
      const el = audioRef.current;
      if (!el) { resolve(); return; }
      
      const startVol = el.volume;
      const stepTime = 30;
      const steps = Math.max(1, Math.floor(durationMs / stepTime));
      const delta = (targetVol - startVol) / steps;
      let currentStep = 0;
      isFadingRef.current = true;

      const timer = setInterval(() => {
        currentStep++;
        if (!audioRef.current) {
          clearInterval(timer);
          isFadingRef.current = false;
          resolve();
          return;
        }
        const nextVol = Math.max(0, Math.min(1, startVol + delta * currentStep));
        audioRef.current.volume = nextVol;

        if (currentStep >= steps) {
          clearInterval(timer);
          audioRef.current.volume = targetVol;
          isFadingRef.current = false;
          resolve();
        }
      }, stepTime);
    });
  };

  const filledBlanksRef = useRef<(PlacedBlankItem | null)[]>([]);
  const challengeTokensRef = useRef<ChallengeToken[]>([]);
  const activeChallengeRef = useRef<LyricLine | null>(null);

  // Keep refs up-to-date with state to guarantee timer expiration always inspects fresh values
  useEffect(() => {
    filledBlanksRef.current = filledBlanks;
  }, [filledBlanks]);

  useEffect(() => {
    challengeTokensRef.current = challengeTokens;
  }, [challengeTokens]);

  useEffect(() => {
    activeChallengeRef.current = activeChallenge;
  }, [activeChallenge]);

  // Helper to extract all matching line IDs and line numbers for a challenge
  const getChallengeLineIds = (line: LyricLine): string[] => {
    const lineNum = line.lineNumber ?? (state?.lyrics.findIndex(l => l.id === line.id) ?? -1);
    const cfg = (lineNum !== -1 && state?.challenges && state.challenges[lineNum]) || line.challenge;
    const ids = [line.id];
    if (lineNum !== -1) ids.push(`line-${lineNum}`);
    if (cfg?.includedLineNumbers) {
      cfg.includedLineNumbers.forEach(n => {
        ids.push(`line-${n}`);
        if (state?.lyrics[n]?.id) ids.push(state.lyrics[n].id);
      });
    }
    if (cfg?.includedLineIds) {
      cfg.includedLineIds.forEach(id => ids.push(id));
    }
    return ids;
  };

  // Helper to determine if the current challenge is the final active challenge in the project
  const checkIsLastChallenge = (active: LyricLine): boolean => {
    const challengeList = (state?.lyrics || [])
      .map((l, i) => ({
        line: l,
        lineNum: l.lineNumber ?? i,
        cfg: (state?.challenges && state.challenges[l.lineNumber ?? i]) || l.challenge
      }))
      .filter(e => e.cfg?.isActive && e.line.parentLineNumber === undefined && !e.line.parentChallengeId);
    if (challengeList.length === 0) return true;
    const last = challengeList[challengeList.length - 1];
    return last.line.id === active.id || last.lineNum === active.lineNumber;
  };

  // Handle when challenge time limit expires - evaluate current input
  const handleTimeExpired = async () => {
    const currentActive = activeChallengeRef.current;
    if (!currentActive) return;

    const currentTokens = challengeTokensRef.current;
    const currentFilled = filledBlanksRef.current;

    const blankTokens = currentTokens.filter(t => t.isBlank);
    let correctCount = 0;
    let allCorrect = true;

    blankTokens.forEach((token, idx) => {
      const placed = currentFilled[idx];
      const cleanExpected = (token.expectedWord || token.text).replace(/^[.,!?;:'"()[\]{}]+|[.,!?;:'"()[\]{}]+$/g, '');
      const cleanPlaced = placed ? placed.word.replace(/^[.,!?;:'"()[\]{}]+|[.,!?;:'"()[\]{}]+$/g, '') : '';

      if (cleanPlaced && cleanPlaced.toLowerCase() === cleanExpected.toLowerCase()) {
        correctCount++;
      } else {
        allCorrect = false;
      }
    });

    const isLastChallenge = checkIsLastChallenge(currentActive);

    if (allCorrect && blankTokens.length > 0) {
      setVerifyStatus('correct');
      setVerifyFeedback('Time expired! Correct answer ✨');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } else {
      setVerifyStatus('incorrect');
      setVerifyFeedback('Time expired! Incorrect answer');
      setTotalAccumulatedErrors(prev => prev + (blankTokens.length - correctCount));
    }

    // Mark challenge as resolved so playback can seamlessly proceed
    const idsToAdd = getChallengeLineIds(currentActive);
    setSolvedChallengeIds(prev => Array.from(new Set([...prev, ...idsToAdd])));

    if (isLastChallenge) {
      setTimeout(() => {
        setShowWinStatsModal(true);
      }, 900);
    } else {
      setTimeout(async () => {
        setPhase('playing');
        if (audioRef.current) {
          audioRef.current.volume = 0;
          await audioRef.current.play().catch(() => {});
          fadeAudio(1, 400);
        }
      }, 1200);
    }
  };

  // Challenge Countdown Timer
  useEffect(() => {
    if (phase !== 'challenge' || !activeChallenge) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, activeChallenge?.id]);

  const initChallenge = (line: LyricLine) => {
    const lineNum = line.lineNumber ?? (state?.lyrics.findIndex(l => l.id === line.id) ?? 0);
    const challengeCfg = (state?.challenges && state.challenges[lineNum]) || line.challenge;

    const incNums = challengeCfg?.includedLineNumbers ??
      (challengeCfg?.includedLineIds || [])
        .map(id => state?.lyrics.findIndex(l => l.id === id) ?? -1)
        .filter(n => n !== -1);
    const includedLines = incNums
      .map(n => state?.lyrics[n])
      .filter(Boolean) as LyricLine[];
    const allLinesInChallenge = [line, ...includedLines];

    setActiveChallenge(line);
    
    const timeLimit = challengeCfg?.timeLimit || 120;
    setTimeLeft(timeLimit);
    setErrors(0);
    setFailureReason(null);
    setVerifyStatus('idle');
    setVerifyFeedback(null);
    dropZoneRefs.current = [];

    const excludedIndices = challengeCfg?.excludedWordIndices;
    const hasExplicitBlanks = Array.isArray(challengeCfg?.blanks) && challengeCfg.blanks.length > 0;
    const fallbackBlanks = hasExplicitBlanks ? [...(challengeCfg?.blanks || [])].filter(b => !isPunctuationOnly(b)) : [];

    const newTokens: ChallengeToken[] = [];
    let blankIndexCounter = 0;
    let globalSelectableWordIdx = 0;

    allLinesInChallenge.forEach((lItem, lineIdx) => {
      const words = lItem.text.split(/\s+/).filter(Boolean);
      words.forEach((word, wordIdx) => {
        const isPunct = isPunctuationOnly(word);
        const cleanWord = word.replace(/^[.,!?;:'"()[\]{}]+|[.,!?;:'"()[\]{}]+$/g, '');

        let isBlank = false;
        let expected = cleanWord || word;

        if (!isPunct && cleanWord.length > 0) {
          if (Array.isArray(excludedIndices)) {
            const wordIdxInLine = globalSelectableWordIdx++;
            isBlank = !excludedIndices.includes(wordIdxInLine);
          } else if (hasExplicitBlanks) {
            const matchIdx = fallbackBlanks.findIndex(b => b === word || b === cleanWord);
            if (matchIdx !== -1) {
              isBlank = true;
              expected = fallbackBlanks[matchIdx];
              fallbackBlanks.splice(matchIdx, 1);
            }
          } else {
            isBlank = true;
          }
        }

        if (isBlank) {
          newTokens.push({
            id: `token-${lineIdx}-${wordIdx}-${Date.now()}`,
            text: word,
            isBlank: true,
            blankIndex: blankIndexCounter++,
            expectedWord: expected,
            lineIndex: lineIdx
          });
        } else {
          newTokens.push({
            id: `token-${lineIdx}-${wordIdx}-${Date.now()}`,
            text: word,
            isBlank: false,
            blankIndex: -1,
            lineIndex: lineIdx
          });
        }
      });
    });

    setChallengeTokens(newTokens);
    setFilledBlanks(new Array(blankIndexCounter).fill(null));
    setLockedBlanks(new Array(blankIndexCounter).fill(false));

    if (challengeCfg?.type === 'mcq') {
      const rawOpts = (challengeCfg.options || []).filter(o => o.trim().length > 0);
      const targetCorrect = challengeCfg.correctOption || rawOpts[0] || challengeCfg.blanks?.join(' ') || '';
      
      const optsWithCorrect = rawOpts.includes(targetCorrect) 
        ? rawOpts 
        : (targetCorrect ? [targetCorrect, ...rawOpts] : rawOpts).slice(0, 4);

      // Shuffle options for this session so option order changes every play
      const shuffled = [...optsWithCorrect].sort(() => Math.random() - 0.5);
      setMcqShuffledOptions(shuffled);
      setMcqCorrectOption(targetCorrect);
      setJumbledWords([]);
    } else {
      setMcqShuffledOptions([]);
      setMcqCorrectOption('');
      const blanksToJumble = newTokens.filter(t => t.isBlank);
      const jumbledItems = blanksToJumble.map(t => ({
        id: `word-${t.blankIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        word: t.expectedWord || t.text
      }));

      setJumbledWords(distributeJumbledWords(jumbledItems));
    }
  };

  const handleSelectMcqOption = (selectedOption: string) => {
    if (verifyStatus !== 'idle' || !activeChallenge) return;

    const isCorrect = selectedOption.trim().toLowerCase() === mcqCorrectOption.trim().toLowerCase();

    if (isCorrect) {
      setVerifyStatus('correct');
      setVerifyFeedback('Correct answer! ✨');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });

      // Fill all blank tokens visually
      const blankTokens = challengeTokens.filter(t => t.isBlank);
      setFilledBlanks(blankTokens.map(t => ({ id: t.id, word: t.expectedWord || t.text })));
      setLockedBlanks(new Array(blankTokens.length).fill(true));

      const idsToAdd = getChallengeLineIds(activeChallenge);
      setSolvedChallengeIds(prev => Array.from(new Set([...prev, ...idsToAdd])));

      const isLastChallenge = checkIsLastChallenge(activeChallenge);

      if (isLastChallenge) {
        setTimeout(() => {
          setShowWinStatsModal(true);
        }, 900);
      } else {
        setTimeout(async () => {
          setPhase('playing');
          if (audioRef.current) {
            audioRef.current.volume = 0;
            await audioRef.current.play().catch(() => {});
            fadeAudio(1, 400);
          }
        }, 1200);
      }
    } else {
      const newErrors = errors + 1;
      setErrors(newErrors);
      setTotalAccumulatedErrors(prev => prev + 1);
      setVerifyStatus('incorrect');

      const parentLineNum = activeChallenge.lineNumber ?? (state?.lyrics.findIndex(l => l.id === activeChallenge.id) ?? -1);
      const cfg = (parentLineNum !== -1 && state?.challenges && state.challenges[parentLineNum]) || activeChallenge.challenge;
      const maxAllowed = cfg?.maxErrors ?? 1;

      if (newErrors > maxAllowed) {
        setVerifyFeedback('Incorrect answer. Maximum attempts reached. Skipping challenge...');
        setTimeout(() => {
          const idsToAdd = getChallengeLineIds(activeChallenge);
          setSolvedChallengeIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
          const isLastChallenge = checkIsLastChallenge(activeChallenge);
          if (isLastChallenge) {
            setShowWinStatsModal(true);
          } else {
            setPhase('playing');
            if (audioRef.current) {
              audioRef.current.volume = 0;
              audioRef.current.play().catch(() => {});
              fadeAudio(1, 400);
            }
          }
        }, 1500);
      } else {
        setVerifyFeedback('Incorrect answer. Try again!');
        setTimeout(() => {
          setVerifyStatus('idle');
          setVerifyFeedback(null);
        }, 1200);
      }
    }
  };

  const startGame = () => {
    initAudioAnalyser();
    setPhase('playing');
    setSolvedChallengeIds([]);
    if (audioRef.current) {
      audioRef.current.volume = 1;
      audioRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || !state?.lyrics || phase !== 'playing') return;
    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    let currentIndex = -1;
    for (let i = 0; i < state.lyrics.length; i++) {
      const line = state.lyrics[i];
      if (line.startTime !== null && time >= line.startTime) {
        currentIndex = i;
      }
    }

    if (currentIndex !== activeLineIndex && currentIndex !== -1) {
      const currentLine = state.lyrics[currentIndex];
      const challengeCfg = (state.challenges && state.challenges[currentIndex]) || currentLine.challenge;
      const isChallengeActive = Boolean(challengeCfg?.isActive);
      const isSolved = solvedChallengeIds.includes(currentLine.id) || solvedChallengeIds.includes(`line-${currentIndex}`);

      if (isChallengeActive && !isSolved) {
        // Immediately pause audio and enter challenge without revealing future lyrics or audio bleed
        audioRef.current.pause();
        if (currentLine.startTime !== null) {
          audioRef.current.currentTime = currentLine.startTime;
          setCurrentTime(currentLine.startTime);
        }
        setActiveLineIndex(currentIndex);
        initChallenge(currentLine);
        setPhase('challenge');
        return;
      }

      setActiveLineIndex(currentIndex);
    }
  };

  // Skip instrumental button logic
  const handleSkipInstrumental = () => {
    if (!audioRef.current || !state?.lyrics) return;
    const nextVocalLine = state.lyrics.slice(activeLineIndex + 1).find(l => !l.isInstrumental && l.startTime !== null && l.text.trim().length > 0);
    if (nextVocalLine && nextVocalLine.startTime !== null) {
      audioRef.current.currentTime = nextVocalLine.startTime;
      setCurrentTime(nextVocalLine.startTime);
    }
  };

  // Helper to check if a line is an uncompleted / active challenge that shouldn't be revealed yet
  const isUnsolvedChallenge = (line: LyricLine) => {
    const lineNum = line.lineNumber ?? (state?.lyrics.findIndex(l => l.id === line.id) ?? -1);
    const cfg = (lineNum !== -1 && state?.challenges && state.challenges[lineNum]) || line.challenge;
    const parentNum = line.parentLineNumber ?? (cfg?.lineNumber !== undefined && cfg.lineNumber !== lineNum ? cfg.lineNumber : undefined);

    if (solvedChallengeIds.includes(line.id)) return false;
    if (lineNum !== -1 && solvedChallengeIds.includes(`line-${lineNum}`)) return false;
    if (line.parentChallengeId && solvedChallengeIds.includes(line.parentChallengeId)) return false;
    if (parentNum !== undefined && solvedChallengeIds.includes(`line-${parentNum}`)) return false;

    return Boolean(cfg?.isActive || line.parentChallengeId || parentNum !== undefined);
  };

  // Determine active lyrics chunk (continuous vocal lines up to next instrumental break or upcoming challenge)
  const activeChunkData = useMemo(() => {
    if (!state?.lyrics || state.lyrics.length === 0 || activeLineIndex === -1) {
      return { isInstrumental: true, lines: [], currentIndexInChunk: -1 };
    }

    const currentLine = state.lyrics[activeLineIndex];
    if (currentLine.isInstrumental || !currentLine.text.trim() || isUnsolvedChallenge(currentLine)) {
      return { isInstrumental: true, lines: [], currentIndexInChunk: -1 };
    }

    // Find start of current continuous vocal segment
    let startIdx = activeLineIndex;
    while (
      startIdx > 0 && 
      !state.lyrics[startIdx - 1].isInstrumental && 
      state.lyrics[startIdx - 1].text.trim().length > 0 && 
      !isUnsolvedChallenge(state.lyrics[startIdx - 1])
    ) {
      startIdx--;
    }

    // Find end of current continuous vocal segment (strictly stops BEFORE any upcoming unsolved challenge line)
    let endIdx = activeLineIndex;
    while (endIdx < state.lyrics.length - 1) {
      const nextLine = state.lyrics[endIdx + 1];
      if (
        nextLine.isInstrumental || 
        !nextLine.text.trim().length || 
        isUnsolvedChallenge(nextLine)
      ) {
        break;
      }
      endIdx++;
    }

    const lines = state.lyrics.slice(startIdx, endIdx + 1);
    const currentIndexInChunk = activeLineIndex - startIdx;

    return {
      isInstrumental: false,
      lines,
      currentIndexInChunk,
      startIdx,
      endIdx
    };
  }, [state?.lyrics, activeLineIndex, solvedChallengeIds]);

  const updateTrackOffset = useCallback(() => {
    const activeEl = lineItemRefs.current[activeChunkData.currentIndexInChunk];
    if (activeEl) {
      const center = activeEl.offsetTop + activeEl.offsetHeight / 2;
      setLyricsTrackY(center);
    }
  }, [activeChunkData.currentIndexInChunk]);

  useEffect(() => {
    updateTrackOffset();
    const raf = requestAnimationFrame(updateTrackOffset);
    return () => cancelAnimationFrame(raf);
  }, [updateTrackOffset, activeChunkData.startIdx, activeChunkData.lines]);

  useEffect(() => {
    window.addEventListener('resize', updateTrackOffset);
    return () => window.removeEventListener('resize', updateTrackOffset);
  }, [updateTrackOffset]);

  // Check if there is an upcoming vocal line after current instrumental
  const hasFutureVocalLine = useMemo(() => {
    if (!state?.lyrics || activeLineIndex === -1) {
      return (state?.lyrics || []).some(l => !l.isInstrumental && l.text.trim().length > 0 && l.startTime !== null);
    }
    return state.lyrics.slice(activeLineIndex + 1).some(l => !l.isInstrumental && l.text.trim().length > 0 && l.startTime !== null);
  }, [state?.lyrics, activeLineIndex]);

  // Handle clicking / selecting a jumbled word
  const handleSelectWord = (item: JumbledWordItem) => {
    if (verifyStatus !== 'idle') return;

    if (selectedWord?.id === item.id) {
      setSelectedWord(null);
      return;
    }

    // Auto-place in first empty unlocked blank slot
    const firstEmptyIndex = filledBlanks.findIndex((slot, idx) => slot === null && !lockedBlanks[idx]);
    if (firstEmptyIndex !== -1) {
      setFilledBlanks(prev => {
        const next = [...prev];
        next[firstEmptyIndex] = { id: item.id, word: item.word };
        return next;
      });
      setJumbledWords(prev => prev.filter(w => w.id !== item.id));
      setSelectedWord(null);
    } else {
      setSelectedWord(item);
    }
  };

  // Handle moving words from one slot to another empty slot (disabling overwrite)
  const handleMoveOrSwapSlots = (fromSlotIdx: number, toSlotIdx: number) => {
    if (verifyStatus !== 'idle' || lockedBlanks[fromSlotIdx] || lockedBlanks[toSlotIdx] || fromSlotIdx === toSlotIdx) return;
    if (filledBlanks[toSlotIdx]) return; // Do not overwrite an occupied slot

    setFilledBlanks(prev => {
      const next = [...prev];
      const fromItem = next[fromSlotIdx];
      next[toSlotIdx] = fromItem;
      next[fromSlotIdx] = null;
      return next;
    });
  };

  // Handle removing a placed word from a top slot and returning it to the pool
  const handleRemovePlacedWord = (slotIdx: number, clientX?: number, clientY?: number) => {
    if (verifyStatus !== 'idle' || lockedBlanks[slotIdx]) return;

    const currentFilled = filledBlanks[slotIdx];
    if (!currentFilled) return;

    setFilledBlanks(prev => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });

    setJumbledWords(prev => {
      if (typeof clientX === 'number' && typeof clientY === 'number' && jumbledAreaRef.current) {
        const rect = jumbledAreaRef.current.getBoundingClientRect();
        const maxHalfW = Math.max(20, (rect.width / 2) - 45);
        const maxHalfH = Math.max(15, (rect.height / 2) - 22);
        const relX = clientX - (rect.left + rect.width / 2);
        const relY = clientY - (rect.top + rect.height / 2);
        const targetX = Math.round(Math.max(-maxHalfW, Math.min(maxHalfW, relX)));
        const targetY = Math.round(Math.max(-maxHalfH, Math.min(maxHalfH, relY)));
        return [...prev, { id: currentFilled.id, word: currentFilled.word, x: targetX, y: targetY }];
      } else {
        const allPoolItems = [...prev, { id: currentFilled.id, word: currentFilled.word }].map(w => ({ id: w.id, word: w.word }));
        return distributeJumbledWords(allPoolItems);
      }
    });
  };

  // Handle dropping a word into a target blank slot (via mouse or touch drag, strictly only into empty slots)
  const handleDropWordIntoSlot = (wordItem: JumbledWordItem, slotIdx: number) => {
    if (verifyStatus !== 'idle' || lockedBlanks[slotIdx] || filledBlanks[slotIdx]) return;

    setFilledBlanks(prev => {
      const next = [...prev];
      next[slotIdx] = { id: wordItem.id, word: wordItem.word };
      return next;
    });

    setJumbledWords(prev => prev.filter(w => w.id !== wordItem.id));
    setSelectedWord(null);
  };

  // Handle clicking a placed blank slot
  const handleSlotClick = (index: number) => {
    if (verifyStatus !== 'idle' || lockedBlanks[index]) return;

    const currentFilled = filledBlanks[index];

    if (currentFilled) {
      // Return placed word to floating pool
      handleRemovePlacedWord(index);
    } else if (selectedWord) {
      // Place selected word into empty slot
      setFilledBlanks(prev => {
        const next = [...prev];
        next[index] = { id: selectedWord.id, word: selectedWord.word };
        return next;
      });
      setJumbledWords(prev => prev.filter(w => w.id !== selectedWord.id));
      setSelectedWord(null);
    }
  };

  // Confirm / Verify Challenge Answer
  const handleConfirmAnswer = async () => {
    if (!activeChallenge || verifyStatus !== 'idle') return;

    const blankTokens = challengeTokens.filter(t => t.isBlank);
    const lockOnMistake = activeChallenge.challenge?.lockCorrectOnMistake ?? true;
    const maxAllowed = activeChallenge.challenge?.maxErrors ?? 1;

    let allCorrect = true;
    const nextLocked = [...lockedBlanks];
    const wordsToReturn: PlacedBlankItem[] = [];

    blankTokens.forEach((token, idx) => {
      const placed = filledBlanks[idx];
      const cleanExpected = (token.expectedWord || token.text).replace(/^[.,!?;:'"()[\]{}]+|[.,!?;:'"()[\]{}]+$/g, '');
      const cleanPlaced = placed ? placed.word.replace(/^[.,!?;:'"()[\]{}]+|[.,!?;:'"()[\]{}]+$/g, '') : '';

      if (cleanPlaced && cleanPlaced.toLowerCase() === cleanExpected.toLowerCase()) {
        if (lockOnMistake) {
          nextLocked[idx] = true;
        }
      } else {
        allCorrect = false;
        if (placed && !lockedBlanks[idx]) {
          wordsToReturn.push(placed);
        }
      }
    });

    if (allCorrect) {
      setVerifyStatus('correct');
      setVerifyFeedback('Excellent! Correct answer ✨');
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });

      const isLastChallenge = checkIsLastChallenge(activeChallenge);

      // Broadcast victory update to Webxdc if supported
      const isWebxdc = typeof (window as any).webxdc !== 'undefined';
      if (isWebxdc && (window as any).webxdc?.sendUpdate) {
        try {
          (window as any).webxdc.sendUpdate({
            payload: {
              type: 'game_result',
              won: true,
              challengeId: activeChallenge.id,
              errors: errors
            },
            info: `Completed challenge with ${errors} mistake(s)!`
          });
        } catch (e) {
          console.warn('Webxdc sendUpdate:', e);
        }
      }

      if (activeChallenge) {
        const idsToAdd = getChallengeLineIds(activeChallenge);
        setSolvedChallengeIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
      }

      if (isLastChallenge) {
        setTimeout(() => {
          setShowWinStatsModal(true);
        }, 800);
      } else {
        setTimeout(async () => {
          setPhase('playing');
          if (audioRef.current) {
            audioRef.current.volume = 0;
            await audioRef.current.play().catch(() => {});
            fadeAudio(1, 400);
          }
        }, 1100);
      }
    } else {
      const newErrors = errors + 1;
      setErrors(newErrors);
      setTotalAccumulatedErrors(prev => prev + 1);

      if (lockOnMistake) {
        setLockedBlanks(nextLocked);
        // Clear wrong slots and return words to pool cleanly without overlapping
        setFilledBlanks(prev => prev.map((item, idx) => nextLocked[idx] ? item : null));
        setJumbledWords(prev => {
          const allPoolItems = [...prev, ...wordsToReturn].map(w => ({ id: w.id, word: w.word }));
          return distributeJumbledWords(allPoolItems);
        });
      }

      const parentLineNum = activeChallenge.lineNumber ?? (state?.lyrics.findIndex(l => l.id === activeChallenge.id) ?? -1);
      const cfg = (parentLineNum !== -1 && state?.challenges && state.challenges[parentLineNum]) || activeChallenge.challenge;
      const maxAllowed = cfg?.maxErrors ?? 1;

      if (newErrors > maxAllowed) {
        setVerifyStatus('incorrect');
        setFailureReason('errors');
        setVerifyFeedback('Maximum attempts reached. Skipping challenge...');

        // Automatically resolve challenge and continue playback
        const idsToAdd = getChallengeLineIds(activeChallenge);
        setSolvedChallengeIds(prev => Array.from(new Set([...prev, ...idsToAdd])));

        const isLastChallenge = checkIsLastChallenge(activeChallenge);

        if (isLastChallenge) {
          setTimeout(() => {
            setShowWinStatsModal(true);
          }, 1200);
        } else {
          setTimeout(async () => {
            setPhase('playing');
            if (audioRef.current) {
              audioRef.current.volume = 0;
              await audioRef.current.play().catch(() => {});
              fadeAudio(1, 400);
            }
          }, 1500);
        }
      } else {
        setVerifyStatus('incorrect');
        setVerifyFeedback(lockOnMistake ? 'Incorrect words returned. Correct words locked in green!' : 'Some words are incorrect. Try again!');
        setTimeout(() => {
          setVerifyStatus('idle');
          setVerifyFeedback(null);
        }, 2200);
      }
    }
  };

  // Skip challenge
  const handleSurrender = async () => {
    setShowSurrenderConfirm(false);
    setVerifyStatus('incorrect');
    setVerifyFeedback('Skipped');

    const isLastChallenge = activeChallenge ? checkIsLastChallenge(activeChallenge) : true;

    if (activeChallenge) {
      const idsToAdd = getChallengeLineIds(activeChallenge);
      setSolvedChallengeIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
    }

    if (isLastChallenge) {
      setTimeout(() => {
        setShowWinStatsModal(true);
      }, 700);
    } else {
      setTimeout(async () => {
        setPhase('playing');
        if (audioRef.current) {
          audioRef.current.volume = 0;
          await audioRef.current.play().catch(() => {});
          fadeAudio(1, 400);
        }
      }, 600);
    }
  };

  const isVideo = state?.media.type === 'video';

  // Group challenge tokens by line to preserve line breaks
  const tokensByLine = useMemo(() => {
    const linesMap = new Map<number, ChallengeToken[]>();
    challengeTokens.forEach(t => {
      const arr = linesMap.get(t.lineIndex) || [];
      arr.push(t);
      linesMap.set(t.lineIndex, arr);
    });
    return Array.from(linesMap.entries()).sort((a, b) => a[0] - b[0]).map(e => e[1]);
  }, [challengeTokens]);

  return (
    <div className={`relative w-full ${isStandalone ? 'h-full h-[100dvh] min-h-screen' : 'h-[calc(100vh-64px)] min-h-[500px]'} overflow-hidden bg-zinc-950 flex flex-col select-none border-0 rounded-none shadow-none`}>
      
      {/* Immersive Bokeh Background */}
      {!animationsDisabled && (
        <div 
          ref={audioReactiveBgRef}
          className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0"
        >
          <ImmersiveBokehBackground isPlaying={isAudioPlaying} />
        </div>
      )}

      {/* Media elements */}
      {isVideo ? (
        <video 
          ref={(el) => { audioRef.current = el; }} 
          src={mediaUrl || undefined} 
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onPlay={() => {
            initAudioAnalyser();
            setIsAudioPlaying(true);
          }}
          onPause={() => setIsAudioPlaying(false)}
          onEnded={() => {
            setIsAudioPlaying(false);
            setPhase('end');
          }}
          playsInline
          // @ts-ignore
          webkit-playsinline="true"
          // @ts-ignore
          x5-playsinline="true"
          // @ts-ignore
          x5-video-player-type="h5"
          preload="auto"
          className={`absolute inset-0 w-full h-full object-contain md:object-cover pointer-events-none transition-opacity duration-700 ${
            phase === 'challenge' ? 'opacity-20' : 'opacity-95'
          }`}
        />
      ) : (
        <audio 
          ref={(el) => { audioRef.current = el; }} 
          src={mediaUrl || undefined} 
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onPlay={() => {
            initAudioAnalyser();
            setIsAudioPlaying(true);
          }}
          onPause={() => setIsAudioPlaying(false)}
          onEnded={() => {
            setIsAudioPlaying(false);
            setPhase('end');
          }}
        />
      )}

      <AnimatePresence mode="wait">
        
        {/* Phase: INTRO */}
        {phase === 'intro' && (
          <motion.div 
            key="intro"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-6 z-10 overflow-hidden"
          >
            {/* Full-page Ambient Blurred Cover Art Background */}
            {coverUrl && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden select-none -z-10">
                <img 
                  src={coverUrl} 
                  alt="Ambient Backdrop" 
                  className="w-full h-full object-cover scale-125 filter blur-3xl opacity-30" 
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/45 to-black/80" />
              </div>
            )}

            {/* Top-Left Corner Button for Background Animations */}
            <div className="absolute top-4 left-4 z-20">
              <button
                type="button"
                onClick={() => setAnimationsDisabled(prev => !prev)}
                className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer flex items-center gap-2 text-xs font-semibold ${
                  animationsDisabled
                    ? 'bg-zinc-900/80 border-zinc-700 text-zinc-400 hover:text-amber-300 hover:border-amber-500/40 shadow-md'
                    : 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95'
                }`}
                aria-label={animationsDisabled ? 'Enable background animations' : 'Disable background animations'}
              >
                {animationsDisabled ? (
                  <StarOff size={15} />
                ) : (
                  <Star size={15} className="fill-amber-300" />
                )}
                <span>{animationsDisabled ? 'Enable background animations' : 'Disable background animations'}</span>
              </button>
            </div>

            {/* Cover Image */}
            {coverUrl ? (
              <motion.img 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={coverUrl} 
                alt="Cover" 
                className="w-40 h-40 rounded-2xl object-cover shadow-[0_0_35px_rgba(79,70,229,0.35)] border border-white/10"
              />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl">
                <Music size={48} />
              </div>
            )}
            
            {/* Song Details */}
            <div className="space-y-1.5 max-w-sm">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
                {state?.metadata.title || "Don't Miss The Lyrics!"}
              </h1>
              {state?.metadata.artist && (
                <p className="text-indigo-300 font-medium text-sm">
                  {state.metadata.artist}
                </p>
              )}
              {state?.metadata.description && (
                <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed">
                  {state.metadata.description}
                </p>
              )}
            </div>
            
            {/* Start Button */}
            <button 
              type="button"
              onClick={startGame}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-9 py-3.5 rounded-full font-bold text-base hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <Play size={16} className="fill-white" />
              <span>Start Experience</span>
            </button>
          </motion.div>
        )}

        {/* Phase: PLAYING */}
        {phase === 'playing' && (
          <motion.div 
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col z-10 overflow-hidden"
          >
            {/* Edge-to-edge top progress bar */}
            <div className="w-full h-1 bg-black relative overflow-hidden z-50">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-100 ease-linear"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>

            {/* Header / Top Control Bar */}
            <div className="flex items-center justify-between px-2.5 sm:px-5 pt-3 pb-2 z-50 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex-shrink-0 relative">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover border border-white/20 shadow-md flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-950/70 border border-indigo-500/30 flex items-center justify-center text-indigo-300 flex-shrink-0">
                    <Music size={14} />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-white text-xs sm:text-sm font-bold truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[260px]">{state?.metadata.title || "Don't Miss The Lyrics!"}</h3>
                  {state?.metadata.artist && (
                    <p className="text-zinc-400 text-[10px] sm:text-[11px] truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[260px] leading-tight">{state.metadata.artist}</p>
                  )}
                </div>
              </div>

              {/* Controls (Play/Pause, Time) */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 relative z-50">
                <span className="font-mono text-[10px] sm:text-[11px] text-zinc-400">
                  {formatTime(Math.floor(currentTime))}
                  {duration > 0 && ` / ${formatTime(Math.floor(duration))}`}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (!audioRef.current) return;
                    if (audioRef.current.paused) {
                      audioRef.current.play();
                      setIsAudioPlaying(true);
                    } else {
                      audioRef.current.pause();
                      setIsAudioPlaying(false);
                    }
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer border border-white/20 shadow-lg relative z-50"
                >
                  {isAudioPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
              </div>
            </div>

            {/* Paused Transparent Black Overlay covering everything except header pause button */}
            <AnimatePresence>
              {!isAudioPlaying && phase === 'playing' && (
                <motion.div
                  key="paused-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.play();
                      setIsAudioPlaying(true);
                    }
                  }}
                  className="absolute inset-0 bg-black z-40 flex flex-col items-center justify-center cursor-pointer select-none"
                >
                  <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white mb-3 shadow-2xl hover:scale-105 active:scale-95 transition-transform">
                    <Play size={26} className="text-white" />
                  </div>
                  <span className="text-xs text-zinc-300 font-medium">Paused — Click anywhere to Resume</span>

                  {/* Pause Menu Bottom-Center Controls (Transparent Background Div) */}
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-transparent z-50 pointer-events-auto"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnimationsDisabled(prev => !prev);
                      }}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                        animationsDisabled
                          ? 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:text-white'
                          : 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                      }`}
                    >
                      {animationsDisabled ? <StarOff size={14} /> : <Star size={14} className="fill-amber-300" />}
                      <span>{animationsDisabled ? 'Enable background animations' : 'Disable background animations'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Soft bottom gradient backdrop for high contrast subtitles when video is playing */}
            {isVideo && (
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none z-0" />
            )}

            {/* Main Stage Viewport: Either Pulsing Dots for Instrumental or Chunked Lyrics */}
            <div className={`flex-1 relative w-full overflow-hidden flex flex-col ${isVideo ? 'justify-end pb-3 sm:pb-6' : 'justify-center'} px-4 sm:px-6 z-10`}>
              
              <AnimatePresence mode="wait">
                {activeChunkData.isInstrumental ? (
                  /* Pure 3 dots during instrumental intro/breaks with smooth transition */
                  <motion.div
                    key="instrumental-stage"
                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -8 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className={`flex flex-col items-center justify-center gap-4 ${isVideo ? 'py-4' : 'py-8'}`}
                  >
                    <div className="flex items-center gap-3">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{
                            scale: [0.8, 1.35, 0.8],
                            opacity: [0.3, 1, 0.3]
                          }}
                          transition={{
                            duration: 1.6,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.25
                          }}
                          className="w-3.5 h-3.5 rounded-full bg-indigo-400 shadow-[0_0_16px_rgba(129,140,248,0.9)]"
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  /* Lyrics Viewport: Kinetic Continuous Upward Gliding Stream */
                  <div
                    key={`chunk-${activeChunkData.startIdx}`}
                    className={`relative w-full overflow-hidden ${
                      isVideo 
                        ? 'h-36 sm:h-44 md:h-52 max-h-[38vh] my-1' 
                        : 'h-full flex-1'
                    }`}
                    style={{
                      maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)'
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: 0,
                        right: 0,
                        transform: `translate3d(0, -${lyricsTrackY}px, 0)`,
                        transition: 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
                        willChange: 'transform'
                      }}
                      className={`w-full flex flex-col items-center max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto overflow-visible ${
                        isVideo ? 'gap-3 sm:gap-4 py-2' : 'gap-4 sm:gap-5 md:gap-6 py-4'
                      }`}
                    >
                      {activeChunkData.lines.map((lItem, idxInChunk) => {
                        const isSinging = idxInChunk === activeChunkData.currentIndexInChunk;
                        const distance = Math.abs(idxInChunk - activeChunkData.currentIndexInChunk);
                        const isLinePast = idxInChunk < activeChunkData.currentIndexInChunk;
                        const isRtl = isRTLText(lItem.text);

                        return (
                          <div
                            key={lItem.id}
                            ref={(el) => { lineItemRefs.current[idxInChunk] = el; }}
                            onClick={() => {
                              if (lItem.startTime !== null && audioRef.current) {
                                audioRef.current.currentTime = lItem.startTime;
                                setCurrentTime(lItem.startTime);
                              }
                            }}
                            style={{
                              opacity: isSinging ? 1 : distance === 1 ? 0.45 : distance === 2 ? 0.22 : 0.08,
                              transform: `scale(${isSinging ? (isVideo ? 1.12 : 1.18) : distance === 1 ? 0.95 : distance === 2 ? 0.88 : 0.82})`,
                              filter: isSinging ? 'blur(0px)' : distance === 1 ? 'blur(0.35px)' : distance === 2 ? 'blur(0.8px)' : 'blur(1.5px)',
                              transition: 'opacity 0.45s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), filter 0.45s ease'
                            }}
                            className={`w-full text-center px-4 sm:px-8 max-w-[92%] sm:max-w-[88%] cursor-pointer select-none origin-center overflow-visible ${
                              isSinging ? 'z-10' : 'z-0'
                            }`}
                            dir={isRtl ? 'rtl' : 'ltr'}
                          >
                            <p className={`overflow-visible py-1 px-3 leading-relaxed ${
                              isVideo ? 'text-sm sm:text-lg md:text-xl lg:text-2xl' : 'text-base sm:text-xl md:text-2xl lg:text-3xl'
                            } font-bold transition-colors duration-300 ${
                              isSinging 
                                ? 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] drop-shadow-[0_0_25px_rgba(255,255,255,0.9)]' 
                                : isLinePast 
                                  ? 'text-zinc-400 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]' 
                                  : 'text-zinc-300 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]'
                            }`}>
                              {lItem.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Skip Instrumental Button placed at Bottom-Center with 100% Transparent Background */}
            <AnimatePresence>
              {activeChunkData.isInstrumental && hasFutureVocalLine && isAudioPlaying && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
                >
                  <button
                    type="button"
                    onClick={handleSkipInstrumental}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-transparent hover:bg-white/5 active:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-zinc-700/80 hover:border-zinc-500 text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-none"
                  >
                    <span>Skip Instrumental</span>
                    <Forward size={14} className="text-zinc-400" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Phase: CHALLENGE */}
        {phase === 'challenge' && activeChallenge && (
          <motion.div 
            key="challenge"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="absolute inset-0 flex flex-col z-20 bg-zinc-950/98 p-4 sm:p-6 justify-between overflow-hidden shadow-2xl"
          >
            {/* Top Challenge Header */}
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    {activeChallenge.challenge?.type === 'mcq' ? 'Multiple Choice Challenge' : 'Fill in the Blanks'}
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    {activeChallenge.challenge?.type === 'mcq' ? 'Choose the correct option below' : 'Drag or tap words into empty slots'}
                  </p>
                </div>
              </div>

              {/* Timer & Errors Counter */}
              <div className="flex items-center gap-2">
                <motion.div 
                  animate={timeLeft <= 10 ? { scale: [1, 1.16, 1] } : { scale: 1 }}
                  transition={timeLeft <= 10 ? { repeat: Infinity, duration: 0.65, ease: "easeInOut" } : { duration: 0.2 }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs transition-colors ${
                    timeLeft <= 10 
                      ? 'bg-rose-950/90 border border-rose-500 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.55)] font-bold' 
                      : 'bg-indigo-950/70 border border-indigo-500/30 text-indigo-300'
                  }`}
                >
                  <Clock size={13} className={timeLeft <= 10 ? 'text-rose-400' : 'text-indigo-400'} />
                  <span>{timeLeft}s</span>
                </motion.div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/70 border border-amber-500/30 text-amber-300 font-mono text-xs">
                  <AlertTriangle size={13} className="text-amber-400" />
                  <span>{errors}/{activeChallenge.challenge?.maxErrors ?? 1}</span>
                </div>
              </div>
            </div>

            {/* Middle Section: Sentence Slots with NewLine Support */}
            <div className="flex-1 flex flex-col justify-center items-center py-5 px-2 overflow-y-auto max-h-[260px] space-y-3.5">
              {tokensByLine.map((lineTokens, lIdx) => {
                const isMcq = activeChallenge.challenge?.type === 'mcq';
                const hasVisibleTokens = !isMcq || lineTokens.some(t => !t.isBlank || Boolean(filledBlanks[t.blankIndex]));
                if (!hasVisibleTokens) return null;

                const isRtl = isRTLText(lineTokens.map(t => t.text).join(' '));
                return (
                  <div 
                    key={`line-${lIdx}`} 
                    className="flex flex-wrap justify-center items-center gap-2.5 w-full py-1"
                    dir={isRtl ? 'rtl' : 'ltr'}
                  >
                    {lineTokens.map((token) => {
                      if (!token.isBlank) {
                        return (
                          <span key={token.id} className="text-white font-bold text-sm sm:text-base px-1">
                            {token.text}
                          </span>
                        );
                      }

                      const slotIdx = token.blankIndex;
                      const placed = filledBlanks[slotIdx];
                      const isLocked = lockedBlanks[slotIdx];
                      const isHovered = activeHoverSlotIndex === slotIdx;

                      if (isMcq && !placed) {
                        return null;
                      }

                      return (
                        <div
                          key={token.id}
                          ref={(el) => { dropZoneRefs.current[slotIdx] = el; }}
                          onClick={() => {
                            if (!placed && !isMcq) {
                              handleSlotClick(slotIdx);
                            }
                          }}
                          className={`min-w-[70px] sm:min-w-[85px] h-9 sm:h-10 px-2 rounded-xl border-2 flex items-center justify-center text-xs sm:text-sm font-bold transition-all select-none relative ${
                            isLocked
                              ? 'bg-emerald-500/20 border-emerald-500/70 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                              : isHovered
                                ? 'border-indigo-400 bg-indigo-600/40 text-white ring-2 ring-indigo-400 scale-105 shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                                : placed
                                  ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md'
                                  : 'border-dashed border-zinc-700 bg-zinc-900/60 text-zinc-500 hover:border-indigo-400 hover:bg-zinc-900 cursor-pointer'
                          }`}
                        >
                          {placed ? (
                            isLocked ? (
                              <span className="truncate px-1">{placed.word}</span>
                            ) : (
                              <motion.div
                                drag
                                dragMomentum={false}
                                dragElastic={0.1}
                                whileDrag={{ scale: 1.15, zIndex: 100 }}
                                onDragStart={() => {
                                  isDraggingRef.current = true;
                                }}
                                onDrag={(event, info) => {
                                  const e = event as any;
                                  let cx = typeof e?.clientX === 'number' && e.clientX !== 0 ? e.clientX : info.point.x;
                                  let cy = typeof e?.clientY === 'number' && e.clientY !== 0 ? e.clientY : info.point.y;
                                  if (e?.changedTouches && e.changedTouches.length > 0) {
                                    cx = e.changedTouches[0].clientX;
                                    cy = e.changedTouches[0].clientY;
                                  } else if (e?.touches && e.touches.length > 0) {
                                    cx = e.touches[0].clientX;
                                    cy = e.touches[0].clientY;
                                  }

                                  let hoveredIdx: number | null = null;
                                  dropZoneRefs.current.forEach((el, idx) => {
                                    if (!el || lockedBlanks[idx] || idx === slotIdx || filledBlanks[idx]) return;
                                    const rect = el.getBoundingClientRect();
                                    const padding = 28;
                                    if (
                                      cx >= rect.left - padding &&
                                      cx <= rect.right + padding &&
                                      cy >= rect.top - padding &&
                                      cy <= rect.bottom + padding
                                    ) {
                                      hoveredIdx = idx;
                                    }
                                  });
                                  setActiveHoverSlotIndex(hoveredIdx);
                                }}
                                onDragEnd={(event, info) => {
                                  const e = event as any;
                                  let cx = typeof e?.clientX === 'number' && e.clientX !== 0 ? e.clientX : info.point.x;
                                  let cy = typeof e?.clientY === 'number' && e.clientY !== 0 ? e.clientY : info.point.y;
                                  if (e?.changedTouches && e.changedTouches.length > 0) {
                                    cx = e.changedTouches[0].clientX;
                                    cy = e.changedTouches[0].clientY;
                                  } else if (e?.touches && e.touches.length > 0) {
                                    cx = e.touches[0].clientX;
                                    cy = e.touches[0].clientY;
                                  }

                                  let droppedSlotIdx: number | null = null;
                                  let minDistance = Infinity;

                                  dropZoneRefs.current.forEach((el, idx) => {
                                    if (!el || lockedBlanks[idx] || idx === slotIdx || filledBlanks[idx]) return;
                                    const rect = el.getBoundingClientRect();
                                    const pad = 32;

                                    if (
                                      cx >= rect.left - pad &&
                                      cx <= rect.right + pad &&
                                      cy >= rect.top - pad &&
                                      cy <= rect.bottom + pad
                                    ) {
                                      const centerX = (rect.left + rect.right) / 2;
                                      const centerY = (rect.top + rect.bottom) / 2;
                                      const dist = Math.hypot(cx - centerX, cy - centerY);
                                      if (dist < minDistance) {
                                        minDistance = dist;
                                        droppedSlotIdx = idx;
                                      }
                                    }
                                  });

                                  setActiveHoverSlotIndex(null);
                                  const dragDist = Math.hypot(info.offset.x, info.offset.y);

                                  if (droppedSlotIdx !== null) {
                                    handleMoveOrSwapSlots(slotIdx, droppedSlotIdx);
                                  } else if (dragDist > 20) {
                                    handleRemovePlacedWord(slotIdx, cx, cy);
                                  }

                                  if (dragDist > 6) {
                                    setTimeout(() => {
                                      isDraggingRef.current = false;
                                    }, 120);
                                  } else {
                                    isDraggingRef.current = false;
                                  }
                                }}
                                onClick={(e) => {
                                  if (isDraggingRef.current) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                  }
                                  handleSlotClick(slotIdx);
                                }}
                                className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing text-xs sm:text-sm font-bold text-white px-1"
                                style={{ touchAction: 'none' }}
                              >
                                <span className="truncate">{placed.word}</span>
                              </motion.div>
                            )
                          ) : (
                            <span className="text-[10px] font-mono opacity-40">___</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Optional Explanation / Context Hint */}
              {activeChallenge.challenge?.explanation && (
                <div 
                  className="bg-indigo-950/60 border border-indigo-500/40 rounded-xl px-4 py-2 text-xs text-indigo-200 flex items-center justify-center gap-2 max-w-lg mx-auto text-center my-1 shadow-sm"
                  dir={isRTLText(activeChallenge.challenge.explanation) ? 'rtl' : 'ltr'}
                >
                  <HelpCircle size={15} className="text-indigo-400 shrink-0" />
                  <span>{activeChallenge.challenge.explanation}</span>
                </div>
              )}

              {verifyFeedback && (
                <div className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  verifyStatus === 'correct' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {verifyFeedback}
                </div>
              )}
            </div>

            {/* MCQ Mode vs Jumbled Words Pool */}
            {activeChallenge.challenge?.type === 'mcq' ? (
              <div className="relative w-full min-h-[160px] bg-zinc-900/90 border border-zinc-800 rounded-2xl py-5 px-4 flex flex-col justify-center items-center z-10 shadow-lg my-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                  {mcqShuffledOptions.map((opt, idx) => (
                    <button
                      key={`mcq-opt-${idx}`}
                      type="button"
                      disabled={verifyStatus !== 'idle'}
                      onClick={() => handleSelectMcqOption(opt)}
                      dir={isRTLText(opt) ? 'rtl' : 'ltr'}
                      className="w-full p-3.5 rounded-xl border bg-zinc-950/90 hover:bg-indigo-600/30 border-zinc-800 hover:border-indigo-500/80 text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-between group active:scale-[0.98] shadow-md"
                    >
                      <span className="truncate pr-2">{opt}</span>
                      <span className="w-6 h-6 rounded-lg bg-zinc-800 group-hover:bg-indigo-500 text-zinc-400 group-hover:text-white flex items-center justify-center text-xs font-mono shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div 
                ref={jumbledAreaRef}
                className="relative w-full h-44 sm:h-48 bg-zinc-900 border border-zinc-800 rounded-2xl py-6 px-4 my-2 flex items-center justify-center overflow-visible z-10"
              >
                {jumbledWords.length === 0 ? (
                  <p className="text-zinc-500 text-xs">All words placed. Tap Confirm Answer below!</p>
                ) : (
                  jumbledWords.map((item) => (
                    <motion.div
                      key={`${item.id}-${item.x}-${item.y}`}
                      drag
                      dragMomentum={false}
                      dragElastic={0.1}
                      whileDrag={{ scale: 1.18, zIndex: 100 }}
                      data-dragged-word={item.id}
                      onDragStart={() => {
                        isDraggingRef.current = true;
                      }}
                      onDrag={(event, info) => {
                        const e = event as any;
                        let cx = typeof e?.clientX === 'number' && e.clientX !== 0 ? e.clientX : info.point.x;
                        let cy = typeof e?.clientY === 'number' && e.clientY !== 0 ? e.clientY : info.point.y;
                        if (e?.changedTouches && e.changedTouches.length > 0) {
                          cx = e.changedTouches[0].clientX;
                          cy = e.changedTouches[0].clientY;
                        } else if (e?.touches && e.touches.length > 0) {
                          cx = e.touches[0].clientX;
                          cy = e.touches[0].clientY;
                        }

                        let hoveredIdx: number | null = null;
                        dropZoneRefs.current.forEach((el, idx) => {
                          if (!el || lockedBlanks[idx] || filledBlanks[idx]) return;
                          const rect = el.getBoundingClientRect();
                          const padding = 28;
                          if (
                            cx >= rect.left - padding &&
                            cx <= rect.right + padding &&
                            cy >= rect.top - padding &&
                            cy <= rect.bottom + padding
                          ) {
                            hoveredIdx = idx;
                          }
                        });
                        setActiveHoverSlotIndex(hoveredIdx);
                      }}
                      onDragEnd={(event, info) => {
                        const e = event as any;
                        let cx = typeof e?.clientX === 'number' && e.clientX !== 0 ? e.clientX : info.point.x;
                        let cy = typeof e?.clientY === 'number' && e.clientY !== 0 ? e.clientY : info.point.y;
                        if (e?.changedTouches && e.changedTouches.length > 0) {
                          cx = e.changedTouches[0].clientX;
                          cy = e.changedTouches[0].clientY;
                        } else if (e?.touches && e.touches.length > 0) {
                          cx = e.touches[0].clientX;
                          cy = e.touches[0].clientY;
                        }

                        // Check proximity and bounding box overlap with target slots
                        let droppedSlotIdx: number | null = null;
                        let minDistance = Infinity;

                        dropZoneRefs.current.forEach((el, idx) => {
                          if (!el || lockedBlanks[idx] || filledBlanks[idx]) return;
                          const rect = el.getBoundingClientRect();
                          const pad = 32;

                          if (
                            cx >= rect.left - pad &&
                            cx <= rect.right + pad &&
                            cy >= rect.top - pad &&
                            cy <= rect.bottom + pad
                          ) {
                            const centerX = (rect.left + rect.right) / 2;
                            const centerY = (rect.top + rect.bottom) / 2;
                            const dist = Math.hypot(cx - centerX, cy - centerY);
                            if (dist < minDistance) {
                              minDistance = dist;
                              droppedSlotIdx = idx;
                            }
                          }
                        });

                        setActiveHoverSlotIndex(null);

                        const dragDist = Math.hypot(info.offset.x, info.offset.y);
                        if (droppedSlotIdx !== null) {
                          handleDropWordIntoSlot(item, droppedSlotIdx);
                        } else if (dragDist > 6) {
                          // User dropped the word in the floating pool area: keep it at the new dropped position
                          const containerRect = jumbledAreaRef.current?.getBoundingClientRect();
                          const maxHalfW = containerRect ? (containerRect.width / 2) - 45 : 160;
                          const maxHalfH = containerRect ? (containerRect.height / 2) - 22 : 38;

                          const newX = Math.round(Math.max(-maxHalfW, Math.min(maxHalfW, item.x + info.offset.x)));
                          const newY = Math.round(Math.max(-maxHalfH, Math.min(maxHalfH, item.y + info.offset.y)));

                          setJumbledWords(prev => prev.map(w => w.id === item.id ? { ...w, x: newX, y: newY } : w));
                        }

                        // Prevent tap selection on touch/mouse release if the user moved the word
                        if (dragDist > 6) {
                          setTimeout(() => {
                            isDraggingRef.current = false;
                          }, 120);
                        } else {
                          isDraggingRef.current = false;
                        }
                      }}
                      onClick={(e) => {
                        if (isDraggingRef.current) {
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }
                        handleSelectWord(item);
                      }}
                      style={{
                        position: 'absolute',
                        left: `calc(50% + ${item.x}px)`,
                        top: `calc(50% + ${item.y}px)`,
                        transform: 'translate(-50%, -50%)',
                        touchAction: 'none'
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-grab active:cursor-grabbing select-none shadow-md ${
                        selectedWord?.id === item.id 
                          ? 'bg-indigo-500 text-white ring-2 ring-indigo-300 scale-105 z-20 shadow-[0_0_15px_rgba(99,102,241,0.5)]' 
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                      }`}
                    >
                      {item.word}
                    </motion.div>
                  ))
                )}
              </div>
            )}
            {/* Bottom Controls: Skip Button & Confirm Action */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowSurrenderConfirm(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/70 hover:border-zinc-500 shadow-sm cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <Forward size={13} />
                <span>Skip</span>
              </button>

              {activeChallenge.challenge?.type !== 'mcq' && (
                <button
                  type="button"
                  onClick={handleConfirmAnswer}
                  disabled={filledBlanks.some(b => b === null) || verifyStatus !== 'idle'}
                  className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white shadow-lg shadow-indigo-600/30 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                >
                  Confirm Answer
                </button>
              )}
            </div>

            {/* Skip confirmation modal */}
            {showSurrenderConfirm && (
              <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-xs text-center space-y-4 shadow-2xl">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 text-zinc-300 mx-auto flex items-center justify-center">
                    <Forward size={22} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-white font-bold text-base">Skip Challenge?</h4>
                    <p className="text-zinc-400 text-xs">Playback will resume immediately.</p>
                  </div>
                  <div className="flex items-center gap-2 justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSurrenderConfirm(false)}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                    >
                      Keep Trying
                    </button>
                    <button
                      type="button"
                      onClick={handleSurrender}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 cursor-pointer"
                    >
                      Yes, Skip
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Phase: END (Final Results / Outro Screen) */}
        {phase === 'end' && (
          <motion.div
            key="end-results"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -16 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-6 z-10"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 22, delay: 0.1 }}
              className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.4)]"
            >
              <Trophy size={40} />
            </motion.div>

            <div className="space-y-2 max-w-sm">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Experience Completed</h2>
              <p className="text-zinc-400 text-xs sm:text-sm">
                {state?.metadata.title ? `Finished listening to "${state.metadata.title}"` : 'You reached the end of the song.'}
              </p>
            </div>

            {/* Performance Stats Cards */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs text-left">
              <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl shadow-sm">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">Total Mistakes</span>
                <span className="text-xl font-bold text-amber-400 font-mono mt-0.5 block">{totalAccumulatedErrors}</span>
              </div>
              <div className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl shadow-sm">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">Completed</span>
                <span className="text-xl font-bold text-emerald-400 font-mono mt-0.5 block">100%</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs pt-2">
              <button
                type="button"
                onClick={async () => {
                  setSolvedChallengeIds([]);
                  setTotalAccumulatedErrors(0);
                  setErrors(0);
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                  }
                  setCurrentTime(0);
                  setPhase('playing');
                  if (audioRef.current) {
                    audioRef.current.volume = 0;
                    await audioRef.current.play().catch(() => {});
                    fadeAudio(1, 400);
                  }
                }}
                className="w-full py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                <span>Play Again</span>
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Victory / Game Finished Modal with Stats */}
      <CompletionModal
        isOpen={showWinStatsModal}
        totalAccumulatedErrors={totalAccumulatedErrors}
        communityStats={communityStats}
        onContinue={async () => {
          setShowWinStatsModal(false);
          setPhase('playing');
          if (audioRef.current) {
            audioRef.current.volume = 0;
            await audioRef.current.play().catch(() => {});
            fadeAudio(1, 400);
          }
        }}
      />
    </div>
  );
}
