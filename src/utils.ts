import { LyricLine, ChallengeConfig } from './types';

// Convert File/Blob or string URL/path to usable URL safely
export function createObjectUrl(file: File | Blob | string | null | undefined): string | null {
  if (!file) return null;
  if (typeof file === 'string') {
    return file;
  }
  try {
    return URL.createObjectURL(file);
  } catch (e) {
    return null;
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function isRTLText(text: string | null | undefined): boolean {
  if (!text) return false;
  // Persian, Arabic, Hebrew Unicode ranges
  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  return rtlRegex.test(text);
}

export function isPunctuationOnly(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  // Matches when the string contains only punctuation, symbols, brackets, quotes, dashes, ellipses, or Persian/Arabic punctuation (like ، ؛ ؟) without any word/letter/digit characters
  return /^[\p{P}\p{S}\s]+$/u.test(trimmed);
}

// Estimate word badge width for responsive placement
export function estimateWordWidth(word: string): number {
  return Math.max(60, Math.min(140, word.length * 10 + 28));
}

// Extract all selectable (non-punctuation) words for a parent line number and its included line numbers
export function getSelectableWordsForLines(
  lyrics: LyricLine[],
  parentLineNumber: number,
  includedLineNumbers: number[] = []
): string[] {
  const lineNums = [parentLineNumber, ...includedLineNumbers];
  const words: string[] = [];
  for (const ln of lineNums) {
    const line = lyrics[ln];
    if (!line) continue;
    const lineWords = line.text
      .split(/\s+/)
      .filter((w) => w.trim().length > 0 && !isPunctuationOnly(w));
    words.push(...lineWords);
  }
  return words;
}

// Synchronize challenges by line number (0-based index) across lyrics and the challenges map
export function syncLyricsWithChallenges(
  lyrics: LyricLine[],
  existingChallenges?: Record<number, ChallengeConfig>
): { lyrics: LyricLine[]; challenges: Record<number, ChallengeConfig> } {
  const challenges: Record<number, ChallengeConfig> = {};

  // Seed challenges from existingChallenges map
  if (existingChallenges) {
    for (const [key, val] of Object.entries(existingChallenges)) {
      const lineNum = Number(key);
      if (!Number.isNaN(lineNum) && val && val.isActive) {
        challenges[lineNum] = { ...val, lineNumber: lineNum };
      }
    }
  }

  // 3. Build parent lookup map for combined child line numbers
  const childToParentLine = new Map<number, number>();
  for (const [key, ch] of Object.entries(challenges)) {
    const parentNum = Number(key);
    if (!ch?.isActive) continue;
    const incNums = ch.includedLineNumbers || [];
    for (const childNum of incNums) {
      childToParentLine.set(childNum, parentNum);
    }
  }

  // 4. Synchronize lyrics array by line number, deriving blanks from current line text at that line number
  const syncedLyrics: LyricLine[] = lyrics.map((line, idx) => {
    const lineId = `line-${idx}`;
    const parentNum = childToParentLine.get(idx);

    if (parentNum !== undefined) {
      return {
        ...line,
        id: lineId,
        lineNumber: idx,
        challenge: undefined,
        parentLineNumber: parentNum,
        parentChallengeId: `line-${parentNum}`,
      };
    }

    const ch = challenges[idx];
    if (ch && ch.isActive && !line.isInstrumental) {
      const incNums = (ch.includedLineNumbers || []).filter((n) => n > idx && n < lyrics.length);
      const selectableWords = getSelectableWordsForLines(lyrics, idx, incNums);
      const excluded = ch.excludedWordIndices || [];
      const activeBlanks = selectableWords.filter((_, wIdx) => !excluded.includes(wIdx));

      const updatedChallenge: ChallengeConfig = {
        ...ch,
        lineNumber: idx,
        includedLineNumbers: incNums,
        includedLineIds: incNums.map((n) => `line-${n}`),
        excludedWordIndices: excluded,
        blanks: activeBlanks,
      };
      challenges[idx] = updatedChallenge;

      return {
        ...line,
        id: lineId,
        lineNumber: idx,
        challenge: updatedChallenge,
        parentLineNumber: undefined,
        parentChallengeId: undefined,
      };
    }

    return {
      ...line,
      id: lineId,
      lineNumber: idx,
      challenge: undefined,
      parentLineNumber: undefined,
      parentChallengeId: undefined,
    };
  });

  return { lyrics: syncedLyrics, challenges };
}
