export interface ProjectState {
  id: string;
  metadata: {
    title: string;
    artist?: string;
    description: string;
    coverImage: File | Blob | string | null;
  };
  media: {
    file: File | Blob | string | null;
    type: 'audio' | 'video' | null;
  };
  settings?: {
    disableAnimations?: boolean;
  };
  challenges?: Record<number, ChallengeConfig>;
  lyrics: LyricLine[];
}

export interface LyricLine {
  id: string;
  lineNumber?: number;
  text: string;
  startTime: number | null;
  isInstrumental: boolean;
  challenge?: ChallengeConfig;
  parentChallengeId?: string;
  parentLineNumber?: number;
}

export interface ChallengeConfig {
  isActive: boolean;
  lineNumber?: number;
  type: 'jumbled' | 'mcq';
  timeLimit: number;
  maxErrors: number;
  lockCorrectOnMistake?: boolean;
  blanks: string[]; // Derived from line words by line number & excludedWordIndices
  excludedWordIndices?: number[]; // 0-based word indices deselected from being blanks
  options?: string[]; // 4 options for mcq
  correctOption?: string; // Correct option for mcq
  explanation?: string; // Explanation or hint text shown below blanks
  includedLineNumbers?: number[]; // Line numbers (0-based) combined into this challenge
  includedLineIds?: string[];
}
