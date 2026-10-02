import React, { useState } from 'react';
import { ProjectState, LyricLine, type ChallengeConfig as ChallengeConfigType } from '../../types';
import { Settings2, ArrowRight, CornerDownRight, Plus, Minus, Layers, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isRTLText, isPunctuationOnly, getSelectableWordsForLines } from '../../utils';

interface Props {
  state: ProjectState | null;
  updateState: (s: Partial<ProjectState>) => void;
  onNext: () => void;
}

export default function ChallengeConfig({ state, updateState, onNext }: Props) {
  const [activeEditorLine, setActiveEditorLine] = useState<number | null>(null);

  const lyrics = state?.lyrics || [];
  const challengesMap = state?.challenges || {};

  // Non-instrumental lines paired with their 0-based lineNumber in state.lyrics
  const nonInstrumentalEntries = lyrics
    .map((line, lineNumber) => ({ line, lineNumber }))
    .filter(({ line }) => !line.isInstrumental);

  const toggleChallenge = (lineNumber: number, currentChallenge?: ChallengeConfigType) => {
    if (!state?.lyrics) return;

    const nextChallenges: Record<number, ChallengeConfigType> = { ...challengesMap };

    if (currentChallenge?.isActive) {
      delete nextChallenges[lineNumber];
      const included = currentChallenge.includedLineNumbers || [];
      included.forEach((n) => delete nextChallenges[n]);
      updateState({ challenges: nextChallenges });
      setActiveEditorLine(null);
    } else {
      nextChallenges[lineNumber] = {
        isActive: true,
        lineNumber,
        type: 'jumbled',
        timeLimit: 120,
        maxErrors: 1,
        lockCorrectOnMistake: true,
        blanks: [],
        excludedWordIndices: [],
        options: [],
        includedLineNumbers: [],
        includedLineIds: []
      };
      updateState({ challenges: nextChallenges });
      setActiveEditorLine(null);
    }
  };

  const updateChallenge = (lineNumber: number, updates: Partial<ChallengeConfigType>) => {
    if (!state?.lyrics) return;
    const current = challengesMap[lineNumber] || state.lyrics[lineNumber]?.challenge;
    if (!current) return;

    const nextChallenges: Record<number, ChallengeConfigType> = {
      ...challengesMap,
      [lineNumber]: {
        ...current,
        ...updates,
        lineNumber
      }
    };
    updateState({ challenges: nextChallenges });
  };

  const addChildToChallenge = (childLineNumber: number, parentLineNumber: number) => {
    if (!state?.lyrics) return;
    const parentChallenge = challengesMap[parentLineNumber] || state.lyrics[parentLineNumber]?.challenge;
    const childChallenge = challengesMap[childLineNumber] || state.lyrics[childLineNumber]?.challenge;
    if (!parentChallenge) return;

    const currentIncluded = parentChallenge.includedLineNumbers || [];
    if (currentIncluded.includes(childLineNumber)) return;

    // If child line already has its own included line numbers, merge them too
    const childIncluded = childChallenge?.includedLineNumbers || [];
    const newIncluded = Array.from(new Set([...currentIncluded, childLineNumber, ...childIncluded])).sort((a, b) => a - b);

    const nextChallenges: Record<number, ChallengeConfigType> = { ...challengesMap };
    delete nextChallenges[childLineNumber];
    childIncluded.forEach((n) => delete nextChallenges[n]);

    nextChallenges[parentLineNumber] = {
      ...parentChallenge,
      lineNumber: parentLineNumber,
      includedLineNumbers: newIncluded,
      includedLineIds: newIncluded.map((n) => `line-${n}`)
    };

    updateState({ challenges: nextChallenges });
    setActiveEditorLine(null);
  };

  const removeChildFromChallenge = (childLineNumber: number, parentLineNumber: number) => {
    if (!state?.lyrics) return;
    const parentChallenge = challengesMap[parentLineNumber] || state.lyrics[parentLineNumber]?.challenge;
    if (!parentChallenge) return;

    const currentIncluded = parentChallenge.includedLineNumbers || [];
    const childIdx = currentIncluded.indexOf(childLineNumber);
    if (childIdx === -1) return;

    const newIncluded = currentIncluded.slice(0, childIdx);
    const remainingTotalWords = getSelectableWordsForLines(state.lyrics, parentLineNumber, newIncluded).length;
    const cleanedExcluded = (parentChallenge.excludedWordIndices || []).filter((idx) => idx < remainingTotalWords);

    const nextChallenges: Record<number, ChallengeConfigType> = {
      ...challengesMap,
      [parentLineNumber]: {
        ...parentChallenge,
        lineNumber: parentLineNumber,
        includedLineNumbers: newIncluded,
        includedLineIds: newIncluded.map((n) => `line-${n}`),
        excludedWordIndices: cleanedExcluded
      }
    };

    updateState({ challenges: nextChallenges });
  };

  const toggleWordBlankByIndex = (parentLineNumber: number, wordGlobalIdx: number) => {
    if (!state?.lyrics) return;
    const parentChallenge = challengesMap[parentLineNumber] || state.lyrics[parentLineNumber]?.challenge;
    if (!parentChallenge) return;

    const currentExcluded = parentChallenge.excludedWordIndices || [];
    const isCurrentlyExcluded = currentExcluded.includes(wordGlobalIdx);

    const nextExcluded = isCurrentlyExcluded
      ? currentExcluded.filter((i) => i !== wordGlobalIdx)
      : [...currentExcluded, wordGlobalIdx];

    updateChallenge(parentLineNumber, { excludedWordIndices: nextExcluded });
  };

  const selectAllWords = (parentLineNumber: number) => {
    updateChallenge(parentLineNumber, { excludedWordIndices: [] });
  };

  const clearAllWords = (parentLineNumber: number) => {
    if (!state?.lyrics) return;
    const parentChallenge = challengesMap[parentLineNumber] || state.lyrics[parentLineNumber]?.challenge;
    if (!parentChallenge) return;
    const incNums = parentChallenge.includedLineNumbers || [];
    const totalWords = getSelectableWordsForLines(state.lyrics, parentLineNumber, incNums).length;
    const allIndices = Array.from({ length: totalWords }, (_, i) => i);
    updateChallenge(parentLineNumber, { excludedWordIndices: allIndices });
  };

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 pt-2">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-1 text-white">Challenge Configuration</h2>
        <p className="text-zinc-400 text-sm">
          Select lyric lines to turn into interactive challenges, or combine consecutive lines into multi-line challenges.
        </p>
      </div>

      <div className="space-y-3">
        {nonInstrumentalEntries.map(({ line, lineNumber }, displayIdx) => {
          const challenge = challengesMap[lineNumber] || line.challenge;
          const isParentChallenge = Boolean(challenge?.isActive && line.parentLineNumber === undefined);
          const isMergedChild = line.parentLineNumber !== undefined;
          const isEditing = activeEditorLine === lineNumber;

          const prevEntry = displayIdx > 0 ? nonInstrumentalEntries[displayIdx - 1] : null;
          const prevChallenge = prevEntry ? (challengesMap[prevEntry.lineNumber] || prevEntry.line.challenge) : undefined;
          const activeChallengeAboveLineNum = prevEntry
            ? (prevEntry.line.parentLineNumber !== undefined
                ? prevEntry.line.parentLineNumber
                : (prevChallenge?.isActive ? prevEntry.lineNumber : null))
            : null;

          const parentOfAbove = activeChallengeAboveLineNum !== null ? lyrics[activeChallengeAboveLineNum] : null;

          const canAddToAbove = Boolean(
            activeChallengeAboveLineNum !== null &&
            !isParentChallenge &&
            (!isMergedChild || line.parentLineNumber !== activeChallengeAboveLineNum)
          );

          const includedLineNumbers = isParentChallenge && challenge?.includedLineNumbers
            ? challenge.includedLineNumbers
            : [];
          const includedLines = includedLineNumbers
            .map((num) => ({ line: lyrics[num], lineNumber: num }))
            .filter((item): item is { line: LyricLine; lineNumber: number } => Boolean(item.line));

          const excludedIndices = challenge?.excludedWordIndices || [];
          const allSelectableWords = isParentChallenge
            ? getSelectableWordsForLines(lyrics, lineNumber, includedLineNumbers)
            : [];
          const selectedCount = Math.max(0, allSelectableWords.length - excludedIndices.length);

          // Track global selectable word index across parent line + included child lines
          let runningSelectableWordIdx = 0;

          return (
            <div 
              key={`line-${lineNumber}`} 
              className={`rounded-2xl border transition-all ${
                isParentChallenge 
                  ? 'border-indigo-500/50 bg-indigo-500/5 shadow-md shadow-indigo-950/20' 
                  : isMergedChild 
                    ? 'border-indigo-500/30 bg-indigo-950/20 ml-6' 
                    : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0 flex items-start sm:items-center gap-2 sm:gap-3">
                  {isMergedChild && (
                    <CornerDownRight size={16} className="text-indigo-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                  )}

                  <span className="text-[11px] font-mono text-zinc-500 bg-zinc-950/80 px-2 py-0.5 rounded border border-zinc-800 shrink-0">
                    #{lineNumber + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-100 font-medium text-sm sm:text-base leading-snug" dir={isRTLText(line.text) ? 'rtl' : 'ltr'}>{line.text}</p>
                    
                    {isParentChallenge && includedLines.length > 0 && (
                      <p className="text-xs text-indigo-400 mt-1 flex items-center gap-1.5">
                        <Layers size={13} />
                        <span>Combined with {includedLines.length} line{includedLines.length > 1 ? 's' : ''} below</span>
                      </p>
                    )}

                    {isMergedChild && parentOfAbove && (
                      <p className="text-xs text-indigo-300/80 mt-1">
                        Part of Combined Challenge (Line #{(line.parentLineNumber ?? 0) + 1})
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap justify-end pt-1 sm:pt-0 border-t border-zinc-800/60 sm:border-t-0">
                  {isParentChallenge && (
                    <>
                      {activeChallengeAboveLineNum !== null && (
                        <button 
                          type="button"
                          onClick={() => addChildToChallenge(lineNumber, activeChallengeAboveLineNum)}
                          className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title="Combine this challenge with the challenge above"
                        >
                          <Plus size={14} />
                          <span>Combine</span>
                        </button>
                      )}

                      <button 
                        type="button"
                        onClick={() => setActiveEditorLine(isEditing ? null : lineNumber)} 
                        className={`p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center ${
                          isEditing ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                        title="Configure challenge settings & blanks"
                      >
                        <Settings2 size={18} />
                      </button>

                      <button 
                        type="button"
                        onClick={() => toggleChallenge(lineNumber, challenge)}
                        className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors bg-red-500/20 text-red-400 hover:bg-red-500/30 cursor-pointer"
                      >
                        Cancel Challenge
                      </button>
                    </>
                  )}

                  {isMergedChild && line.parentLineNumber !== undefined && (
                    <button 
                      type="button"
                      onClick={() => removeChildFromChallenge(lineNumber, line.parentLineNumber!)}
                      className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 flex items-center gap-1.5 cursor-pointer"
                      title="Remove this line from the challenge above"
                    >
                      <Minus size={14} />
                      <span>Remove from Challenge</span>
                    </button>
                  )}

                  {!isParentChallenge && !isMergedChild && canAddToAbove && activeChallengeAboveLineNum !== null && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button 
                        type="button"
                        onClick={() => toggleChallenge(lineNumber)}
                        className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 cursor-pointer"
                      >
                        Make Challenge
                      </button>

                      <button 
                        type="button"
                        onClick={() => addChildToChallenge(lineNumber, activeChallengeAboveLineNum)}
                        className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                        title="Combine this line with challenge above"
                      >
                        <Plus size={14} />
                        <span>Combine</span>
                      </button>
                    </div>
                  )}

                  {!isParentChallenge && !isMergedChild && !canAddToAbove && (
                    <button 
                      type="button"
                      onClick={() => toggleChallenge(lineNumber)}
                      className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 cursor-pointer"
                    >
                      Make Challenge
                    </button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isEditing && challenge && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-indigo-500/20 bg-indigo-950/20"
                  >
                    <div className="p-5 space-y-5">
                      
                      {/* Challenge Mode Switcher */}
                      <div className="space-y-2 bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800/80">
                        <label className="text-xs font-semibold text-zinc-300">
                          Challenge Question Type:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => updateChallenge(lineNumber, { type: 'jumbled' })}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              (challenge.type || 'jumbled') === 'jumbled'
                                ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400 font-bold'
                                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                            }`}
                          >
                            <span>🧩 Jumbled Words</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const currentBlanksText = allSelectableWords
                                .filter((_, wIdx) => !excludedIndices.includes(wIdx))
                                .join(' ');
                              const currentOpts = challenge.options && challenge.options.length === 4
                                ? challenge.options
                                : [currentBlanksText || line.text || 'Option 1', '', '', ''];
                              updateChallenge(lineNumber, { 
                                type: 'mcq',
                                options: currentOpts,
                                correctOption: challenge.correctOption || currentOpts[0] || currentBlanksText
                              });
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              challenge.type === 'mcq'
                                ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400 font-bold'
                                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                            }`}
                          >
                            <span>📝 4-Option Multiple Choice</span>
                          </button>
                        </div>
                      </div>

                      {/* Explanation / Hint Input (Displayed below blanks in both modes) */}
                      <div className="space-y-1.5 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80">
                        <label className="text-xs font-medium text-indigo-300 flex items-center justify-between">
                          <span>Explanation / Hint (Shown below blanks)</span>
                          <span className="text-[10px] text-zinc-400 font-normal">Optional hint or context</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Choose the correct phrase that fits the lyrics..."
                          value={challenge.explanation || ''}
                          onChange={(e) => updateChallenge(lineNumber, { explanation: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                        />
                      </div>

                      {/* 4 Options Configuration (Shown when type === 'mcq') */}
                      {challenge.type === 'mcq' && (
                        <div className="space-y-3 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-indigo-300">
                              4 Multiple-Choice Options:
                            </label>
                            <span className="text-[10px] text-zinc-400">
                              Tap the number/check to set correct answer
                            </span>
                          </div>

                          <div className="space-y-2 pt-1">
                            {[0, 1, 2, 3].map((optIdx) => {
                              const currentOpts = challenge.options && challenge.options.length === 4
                                ? [...challenge.options]
                                : ['', '', '', ''];
                              const optVal = currentOpts[optIdx] || '';
                              const targetCorrect = challenge.correctOption || currentOpts[0] || '';
                              const isCorrect = targetCorrect !== '' && targetCorrect === optVal;

                              return (
                                <div key={`opt-input-${optIdx}`} className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    title="Mark as correct option"
                                    onClick={() => {
                                      if (!optVal.trim()) return;
                                      updateChallenge(lineNumber, { correctOption: optVal });
                                    }}
                                    className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center transition-all cursor-pointer text-xs font-bold ${
                                      isCorrect
                                        ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                                    }`}
                                  >
                                    {isCorrect ? '✓' : `${optIdx + 1}`}
                                  </button>
                                  <input
                                    type="text"
                                    placeholder={`Option ${optIdx + 1} ${optIdx === 0 ? '(Correct Option)' : ''}`}
                                    value={optVal}
                                    onChange={(e) => {
                                      const newOpts = [...currentOpts];
                                      newOpts[optIdx] = e.target.value;
                                      const updates: Partial<ChallengeConfigType> = { options: newOpts };
                                      if (isCorrect || !challenge.correctOption) {
                                        updates.correctOption = newOpts[optIdx];
                                      }
                                      updateChallenge(lineNumber, updates);
                                    }}
                                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Blanks selection */}
                      <div className="space-y-3">
                         <div className="flex items-center justify-between flex-wrap gap-2">
                           <div>
                             <label className="text-sm font-medium text-indigo-300">
                               Select words to replace with blanks:
                             </label>
                             <p className="text-xs text-zinc-400 mt-0.5">
                               All words on this line number are selected by default. Click any word to toggle.
                             </p>
                           </div>
                           <div className="flex items-center gap-2">
                             <button 
                               type="button"
                               onClick={() => selectAllWords(lineNumber)}
                               className="text-xs px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 transition-colors font-medium cursor-pointer"
                             >
                               Select All
                             </button>
                             <button 
                               type="button"
                               onClick={() => clearAllWords(lineNumber)}
                               className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors font-medium cursor-pointer"
                             >
                               Clear All
                             </button>
                             <span className="text-xs text-zinc-400 ml-1">
                               Selected: <strong className="text-indigo-300 font-mono">{selectedCount}</strong>
                             </span>
                           </div>
                         </div>

                         {/* Words of Main Line */}
                         <div className="space-y-1.5">
                           <span className="text-xs font-mono text-zinc-400">Line #{lineNumber + 1}:</span>
                           <div className="flex flex-wrap gap-2.5 py-2" dir={isRTLText(line.text) ? 'rtl' : 'ltr'}>
                              {line.text.split(/\s+/).filter(w => w.trim().length > 0 && !isPunctuationOnly(w)).map((word, i) => {
                                 const wordGlobalIdx = runningSelectableWordIdx++;
                                 const isBlank = !excludedIndices.includes(wordGlobalIdx);
                                 return (
                                   <button 
                                     key={`main-${lineNumber}-${i}`}
                                     type="button"
                                     onClick={() => toggleWordBlankByIndex(lineNumber, wordGlobalIdx)}
                                     className={`px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer ${
                                       isBlank 
                                         ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)] scale-105 font-bold ring-1 ring-indigo-400' 
                                         : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                                     }`}
                                   >
                                     {word}
                                   </button>
                                 );
                              })}
                           </div>
                         </div>

                         {/* Words of Included Child Lines */}
                         {includedLines.map(({ line: incLine, lineNumber: incLineNumber }) => (
                           <div key={`inc-${incLineNumber}`} className="space-y-1.5 pt-1">
                             <span className="text-xs font-mono text-indigo-300/80">Line #{incLineNumber + 1}:</span>
                             <div className="flex flex-wrap gap-2.5 py-2" dir={isRTLText(incLine.text) ? 'rtl' : 'ltr'}>
                                {incLine.text.split(/\s+/).filter(w => w.trim().length > 0 && !isPunctuationOnly(w)).map((word, wIdx) => {
                                   const wordGlobalIdx = runningSelectableWordIdx++;
                                   const isBlank = !excludedIndices.includes(wordGlobalIdx);
                                   return (
                                     <button 
                                       key={`inc-${incLineNumber}-${wIdx}`}
                                       type="button"
                                       onClick={() => toggleWordBlankByIndex(lineNumber, wordGlobalIdx)}
                                       className={`px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer ${
                                         isBlank 
                                           ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)] scale-105 font-bold ring-1 ring-indigo-400' 
                                           : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                                       }`}
                                     >
                                       {word}
                                     </button>
                                   );
                                })}
                             </div>
                           </div>
                         ))}
                      </div>

                      {/* Settings */}
                      <div className="space-y-4 pt-2 border-t border-zinc-800/80">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Time Limit Setting */}
                          <div className="space-y-1.5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/70">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                                <Clock size={13} className="text-indigo-400" />
                                <span>Time Limit (Seconds)</span>
                              </label>
                              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-900/50">
                                {challenge.timeLimit || 120}s ({( (challenge.timeLimit || 120) / 60 ).toFixed(1)} min)
                              </span>
                            </div>
                            <input 
                              type="number" 
                              min="5"
                              max="600"
                              placeholder="120"
                              value={challenge.timeLimit ?? ''}
                              onChange={(e) => updateChallenge(lineNumber, { timeLimit: e.target.value === '' ? undefined : parseInt(e.target.value) || 120 })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                            />
                            <div className="flex items-center gap-1.5 pt-1">
                              {[30, 60, 120, 180].map((sec) => (
                                <button
                                  key={sec}
                                  type="button"
                                  onClick={() => updateChallenge(lineNumber, { timeLimit: sec })}
                                  className={`text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                    (challenge.timeLimit ?? 120) === sec 
                                      ? 'bg-indigo-600 text-white font-medium' 
                                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  {sec === 120 ? '120s (2m ★)' : `${sec}s`}
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-zinc-500">
                              Default: 120 seconds (2 minutes)
                            </p>
                          </div>

                          {/* Max Errors Setting */}
                          <div className="space-y-1.5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/70">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                                <AlertTriangle size={13} className="text-amber-400" />
                                <span>Max Allowed Errors</span>
                              </label>
                              <span className="text-[11px] font-mono text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-900/50">
                                {challenge.maxErrors ?? 1} Chance
                              </span>
                            </div>
                            <input 
                              type="number" 
                              min="0"
                              max="10"
                              placeholder="1"
                              value={challenge.maxErrors ?? ''}
                              onChange={(e) => updateChallenge(lineNumber, { maxErrors: e.target.value === '' ? undefined : parseInt(e.target.value) ?? 1 })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 outline-none"
                            />
                            <div className="flex items-center gap-1.5 pt-1">
                              {[1, 2, 3, 5].map((cnt) => (
                                <button
                                  key={cnt}
                                  type="button"
                                  onClick={() => updateChallenge(lineNumber, { maxErrors: cnt })}
                                  className={`text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                    (challenge.maxErrors ?? 1) === cnt 
                                      ? 'bg-amber-600 text-white font-medium' 
                                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  {cnt === 1 ? '1 Chance (Default ★)' : `${cnt} errors`}
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-zinc-500">
                              1 means 1 mistake allowed; failing on 2nd error.
                            </p>
                          </div>
                        </div>

                        {/* Lock Correct Placed Words on Mistake Card */}
                        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
                          <label className="flex items-start sm:items-center justify-between gap-3 cursor-pointer select-none">
                            <div className="flex items-center gap-2.5">
                              <input 
                                type="checkbox" 
                                checked={challenge.lockCorrectOnMistake ?? true}
                                onChange={(e) => updateChallenge(lineNumber, { lockCorrectOnMistake: e.target.checked })}
                                className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-950 cursor-pointer"
                              />
                              <div>
                                <span className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                                  <ShieldCheck size={16} className="text-emerald-400" />
                                  <span>Lock Correctly Placed Words on Mistake</span>
                                </span>
                              </div>
                            </div>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              (challenge.lockCorrectOnMistake ?? true)
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}>
                              {(challenge.lockCorrectOnMistake ?? true) ? 'Enabled' : 'Disabled'}
                            </span>
                          </label>

                          <div className="bg-zinc-900/90 rounded-lg p-3 text-xs space-y-1.5 border border-zinc-800/80 text-zinc-300 leading-relaxed">
                            <p className="text-[11px] text-zinc-400">
                              When enabled, if a player confirms their answer with some words in correct positions and some wrong, the correct words automatically turn green and lock permanently into place. Only incorrect words return to the pool.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button 
          onClick={onNext}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-600/20 cursor-pointer"
        >
          <span>Next: Send to Chat</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

