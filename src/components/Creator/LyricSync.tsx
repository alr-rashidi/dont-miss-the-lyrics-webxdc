import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, LyricLine } from '../../types';
import { 
  Play, 
  Pause, 
  Clock, 
  RotateCcw,
  Trash2, 
  Plus, 
  FileText, 
  ListMusic, 
  SkipBack, 
  SkipForward, 
  ArrowRight, 
  Check, 
  Copy, 
  Timer,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { createObjectUrl, formatTime, isRTLText } from '../../utils';

interface Props {
  state: ProjectState | null;
  updateState: (s: Partial<ProjectState>) => void;
  onNext: () => void;
}

// Convert LyricLine[] into standard LRC format
function formatLyricsToLRC(lyrics: LyricLine[]): string {
  if (!lyrics || lyrics.length === 0) return '';
  return lyrics
    .map((line) => {
      const timeTag = line.startTime !== null ? `[${formatTime(line.startTime)}] ` : '';
      return `${timeTag}${line.text}`;
    })
    .join('\n');
}

// Parse plaintext or LRC lines back into LyricLine[]
function parseTextToLyricLines(text: string, existingLyrics: LyricLine[] = []): LyricLine[] {
  const lines = text.split('\n');
  const result: LyricLine[] = [];

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed && index === lines.length - 1) return;

    const lrcRegex = /^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]\s*(.*)$/;
    const match = trimmed.match(lrcRegex);

    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const startTime = minutes * 60 + seconds;
      const lyricText = match[3] || '';

      const prev = existingLyrics[index];
      result.push({
        id: prev ? prev.id : `line-${index}-${Date.now()}`,
        text: lyricText,
        startTime: startTime,
        isInstrumental: lyricText.trim().length === 0,
        challenge: prev?.challenge,
        parentChallengeId: prev?.parentChallengeId
      });
    } else {
      const prev = existingLyrics[index];
      result.push({
        id: prev ? prev.id : `line-${index}-${Date.now()}`,
        text: trimmed,
        startTime: prev?.startTime ?? null,
        isInstrumental: trimmed.length === 0,
        challenge: prev?.challenge,
        parentChallengeId: prev?.parentChallengeId
      });
    }
  });

  return result;
}

// Optimized, responsive LyricRowItem component that never drops keystrokes
const LyricRowItem = React.memo(function LyricRowItem({
  line,
  isActive,
  isNextToStamp,
  seekTo,
  updateLine,
  deleteLine,
  activeLineRef,
}: {
  line: LyricLine;
  index: number;
  isActive: boolean;
  isNextToStamp: boolean;
  seekTo: (time: number) => void;
  updateLine: (id: string, updates: Partial<LyricLine>) => void;
  deleteLine: (id: string) => void;
  activeLineRef: React.RefObject<HTMLDivElement>;
}) {
  const [localText, setLocalText] = useState(line.text);
  const isTypingRef = useRef(false);

  // Sync prop changes only when not actively typing
  useEffect(() => {
    if (!isTypingRef.current) {
      setLocalText(line.text);
    }
  }, [line.text]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    isTypingRef.current = true;
    setLocalText(nextVal);
    updateLine(line.id, { text: nextVal });
  };

  const handleBlur = () => {
    isTypingRef.current = false;
    updateLine(line.id, { text: localText });
  };

  const isRTL = isRTLText(localText);

  return (
    <div 
      ref={isActive || isNextToStamp ? activeLineRef : null}
      className={`p-2.5 sm:p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 transition-all ${
        isActive 
          ? 'bg-indigo-600/15 border-indigo-500/80 shadow-md shadow-indigo-950/40' 
          : isNextToStamp 
            ? 'border-amber-500/50 bg-amber-500/5' 
            : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/40'
      }`}
    >
      {/* Mobile Top Controls Bar / Desktop Left Timestamp */}
      <div className="flex items-center justify-between sm:justify-start gap-2 sm:order-1">
        {line.startTime !== null ? (
          <button
            type="button"
            onClick={() => seekTo(line.startTime!)}
            className="flex items-center gap-1.5 font-mono text-xs text-indigo-300 bg-indigo-950/80 hover:bg-indigo-900 px-2.5 py-1 rounded-md border border-indigo-500/40 transition-colors flex-shrink-0 cursor-pointer shadow-sm active:scale-95"
            title="Seek playback to this timestamp"
          >
            <Clock size={12} className="text-indigo-400" />
            <span>{formatTime(line.startTime)}</span>
          </button>
        ) : (
          <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 flex-shrink-0">
            --:--.--
          </span>
        )}

        {/* Action icons shown on mobile top-right */}
        <div className="flex items-center gap-1 sm:hidden">
          {line.startTime !== null && (
            <button 
              type="button"
              onClick={() => updateLine(line.id, { startTime: null })}
              className="p-1.5 text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
              title="Clear timestamp"
            >
              <RotateCcw size={14} />
            </button>
          )}

          <button 
            type="button"
            onClick={() => deleteLine(line.id)}
            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
            title="Delete line"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Lyric line text input */}
      <div className="flex-1 min-w-0 sm:order-2">
        <input 
          type="text" 
          value={localText} 
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Lyric line text..."
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-full bg-zinc-900/50 sm:bg-transparent text-zinc-100 font-medium text-sm focus:outline-none focus:text-white px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-lg sm:rounded hover:bg-zinc-800/50 focus:bg-zinc-900 border border-zinc-800/60 sm:border-transparent focus:border-indigo-500/60 sm:focus:border-zinc-700 transition-colors"
        />
      </div>

      {/* Desktop Action Buttons (sm: and above) */}
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 sm:order-3">
        {line.startTime !== null && (
          <button 
            type="button"
            onClick={() => updateLine(line.id, { startTime: null })}
            className="p-1.5 text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
            title="Clear timestamp"
          >
            <RotateCcw size={14} />
          </button>
        )}

        <button 
          type="button"
          onClick={() => deleteLine(line.id)}
          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          title="Delete line"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
});

export default function LyricSync({ state, updateState, onNext }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  // If lyrics are completely empty, default viewMode directly to 'text' as requested!
  const hasInitialLyrics = Boolean(state?.lyrics && state.lyrics.length > 0);
  const [viewMode, setViewMode] = useState<'interactive' | 'text'>(hasInitialLyrics ? 'interactive' : 'text');
  
  const [rawText, setRawText] = useState(() => formatLyricsToLRC(state?.lyrics || []));
  const [copied, setCopied] = useState(false);

  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.media.file) {
      const url = createObjectUrl(state.media.file);
      setMediaUrl(url);
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    }
  }, [state?.media.file]);

  // Sync rawText whenever lyrics change from outside if text view is active
  useEffect(() => {
    if (viewMode === 'text') {
      setRawText(formatLyricsToLRC(state?.lyrics || []));
    }
  }, [viewMode]);

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
      setIsPlaying(false);
    } else {
      mediaRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!mediaRef.current) return;
    setCurrentTime(mediaRef.current.currentTime);
  };

  const seekTo = (time: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const skip = (seconds: number) => {
    if (!mediaRef.current) return;
    const target = Math.max(0, Math.min(mediaRef.current.duration || 0, mediaRef.current.currentTime + seconds));
    mediaRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const stampNextLine = () => {
    if (!state?.lyrics || !mediaRef.current) return;
    const stampTime = mediaRef.current.currentTime;

    const nextUnstampedIndex = state.lyrics.findIndex(l => l.startTime === null);
    if (nextUnstampedIndex !== -1) {
      const updated = [...state.lyrics];
      updated[nextUnstampedIndex] = {
        ...updated[nextUnstampedIndex],
        startTime: stampTime
      };
      updateState({ lyrics: updated });
    }
  };

  const updateLine = (id: string, updates: Partial<LyricLine>) => {
    if (!state?.lyrics) return;
    const updated = state.lyrics.map(l => l.id === id ? { ...l, ...updates } : l);
    updateState({ lyrics: updated });
  };

  const deleteLine = (id: string) => {
    if (!state?.lyrics) return;
    const updated = state.lyrics.filter(l => l.id !== id);
    updateState({ lyrics: updated });
  };

  const addNewLine = () => {
    if (!state?.lyrics) return;
    const newLine: LyricLine = {
      id: `line-${state.lyrics.length}-${Date.now()}`,
      text: '',
      startTime: mediaRef.current ? mediaRef.current.currentTime : null,
      isInstrumental: false
    };
    updateState({ lyrics: [...state.lyrics, newLine] });
  };

  const shiftAllTimestamps = (offsetSeconds: number) => {
    if (!state?.lyrics) return;
    const shifted = state.lyrics.map(l => {
      if (l.startTime === null) return l;
      const newTime = Math.max(0, parseFloat((l.startTime + offsetSeconds).toFixed(2)));
      return { ...l, startTime: newTime };
    });
    updateState({ lyrics: shifted });
  };

  const handleCopyLrc = () => {
    const lrc = formatLyricsToLRC(state?.lyrics || []);
    navigator.clipboard.writeText(lrc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const switchToInteractiveMode = () => {
    const parsed = parseTextToLyricLines(rawText, state?.lyrics || []);
    updateState({ lyrics: parsed });
    setViewMode('interactive');
  };

  const switchToTextMode = () => {
    setRawText(formatLyricsToLRC(state?.lyrics || []));
    setViewMode('text');
  };

  // Keyboard shortcut: Space is EXCLUSIVELY used for stamping unstamped lyric lines
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();

        if (viewMode === 'interactive') {
          stampNextLine();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [state?.lyrics, viewMode]);

  // Calculate active playback line index
  let activePlaybackIndex = -1;
  if (state?.lyrics) {
    for (let i = 0; i < state.lyrics.length; i++) {
      const line = state.lyrics[i];
      if (line.startTime !== null && currentTime >= line.startTime) {
        activePlaybackIndex = i;
      }
    }
  }

  // Auto-scroll interactive list to the current line or next line to stamp
  useEffect(() => {
    if (activeLineRef.current && (isPlaying || activePlaybackIndex !== -1)) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activePlaybackIndex, isPlaying]);

  const isVideo = state?.media.type === 'video';
  const hasLyrics = Boolean(state?.lyrics && state.lyrics.length > 0);

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28 pt-2">
      
      {/* Hidden Media Element */}
      {isVideo ? (
        <video 
          ref={(el) => { mediaRef.current = el; }} 
          src={mediaUrl || undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
          playsInline
        />
      ) : (
        <audio 
          ref={(el) => { mediaRef.current = el; }} 
          src={mediaUrl || undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {/* Scrubbing & Timeline Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2.5 sm:p-4 space-y-2 sm:space-y-3">
        <div className="flex w-full px-0 sm:px-1 items-center gap-1.5 sm:gap-3">
          <span className="text-[10px] sm:text-xs font-mono text-zinc-400 w-9 sm:w-12 text-right">{formatTime(currentTime)}</span>
          <div 
            className="flex-1 h-3 sm:h-3.5 bg-zinc-800 hover:bg-zinc-750 rounded-full overflow-hidden relative cursor-pointer group"
            onClick={(e) => {
              if (!mediaRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              mediaRef.current.currentTime = percent * (mediaRef.current.duration || 0);
            }}
          >
            <div 
              className="absolute top-0 left-0 h-full bg-indigo-500 group-hover:bg-indigo-400 transition-all pointer-events-none" 
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-[10px] sm:text-xs font-mono text-zinc-400 w-9 sm:w-12">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Mode Switcher Tabs: Interactive vs Plain */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-zinc-800">
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={switchToInteractiveMode}
            className={`flex flex-col xs:flex-row items-center justify-center gap-1 xs:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              viewMode === 'interactive'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <ListMusic size={16} />
            <span className="whitespace-nowrap">Interactive</span>
          </button>

          <button
            type="button"
            onClick={switchToTextMode}
            className={`flex flex-col xs:flex-row items-center justify-center gap-1 xs:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              viewMode === 'text'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <FileText size={16} />
            <span className="whitespace-nowrap">Plain</span>
          </button>
        </div>

        {/* Action buttons (Copy LRC) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLrc}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-medium border border-zinc-800 transition-colors cursor-pointer"
            title="Copy current lyrics with timestamps as LRC"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copied LRC!' : 'Copy LRC'}</span>
          </button>
        </div>
      </div>

      {/* Global Timestamp Shifting Toolbar (-5s, -500ms, +500ms, +5s) */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
          <Timer size={16} className="text-indigo-400 flex-shrink-0" />
          <span>Shift Timestamps:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => shiftAllTimestamps(-5)}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 hover:text-white rounded-lg text-xs font-mono font-medium border border-zinc-700/60 transition-all shadow-sm"
          >
            -5s
          </button>
          <button
            type="button"
            onClick={() => shiftAllTimestamps(-0.5)}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 hover:text-white rounded-lg text-xs font-mono font-medium border border-zinc-700/60 transition-all shadow-sm"
          >
            -500ms
          </button>
          <button
            type="button"
            onClick={() => shiftAllTimestamps(0.5)}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 hover:text-white rounded-lg text-xs font-mono font-medium border border-zinc-700/60 transition-all shadow-sm"
          >
            +500ms
          </button>
          <button
            type="button"
            onClick={() => shiftAllTimestamps(5)}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 hover:text-white rounded-lg text-xs font-mono font-medium border border-zinc-700/60 transition-all shadow-sm"
          >
            +5s
          </button>
        </div>
      </div>

      {/* VIEW MODE: TEXT / LRC EDITOR (With LRCLIB suggestion) */}
      {viewMode === 'text' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="block text-sm font-medium text-zinc-200">
              Lyrics
            </label>
          </div>

          <textarea 
            value={rawText}
            onChange={(e) => {
              const val = e.target.value;
              setRawText(val);
              const currentLRC = formatLyricsToLRC(state?.lyrics || []);
              if (val !== currentLRC) {
                const parsed = parseTextToLyricLines(val, state?.lyrics || []);
                updateState({ lyrics: parsed });
              }
            }}
            placeholder="Paste your lyrics here...&#10;[00:15.20] First synchronized line&#10;[00:19.40] Second synchronized line"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-indigo-500 min-h-[350px] resize-y font-mono text-sm leading-relaxed"
          />

          {/* LRCLIB Suggestion Banner */}
          <div className="bg-gradient-to-r from-indigo-950/50 to-purple-950/40 border border-indigo-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 flex-shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span>Need synchronized lyrics or plain text?</span>
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Search on <strong className="text-indigo-300">LRCLIB.net</strong> for ready-to-use LRC synced lyrics with millisecond timestamps.
                </p>
              </div>
            </div>

            <a
              href="https://lrclib.net"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all flex-shrink-0 active:scale-95"
            >
              <ExternalLink size={13} />
              <span>Open LRCLIB</span>
            </a>
          </div>
        </div>
      )}

      {/* VIEW MODE: INTERACTIVE TIMELINE SYNC */}
      {viewMode === 'interactive' && (
        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 overflow-y-auto space-y-2 max-h-[560px]">
          {(!state?.lyrics || state.lyrics.length === 0) ? (
            <div className="text-center py-16 space-y-4">
              <p className="text-zinc-400">No lyrics loaded yet.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('text')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
                >
                  <FileText size={16} />
                  <span>Open Lyric Text Editor</span>
                </button>
                <button
                  type="button"
                  onClick={addNewLine}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <Plus size={16} className="text-indigo-400" />
                  <span>Add Line to Write Lyrics One by One</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {(() => {
                const nextUnstampedIndex = state.lyrics?.findIndex(l => l.startTime === null) ?? -1;
                return state.lyrics.map((line, index) => {
                  const isActive = activePlaybackIndex === index;
                  const isNextToStamp = nextUnstampedIndex === index;

                  return (
                    <LyricRowItem
                      key={line.id}
                      line={line}
                      index={index}
                      isActive={isActive}
                      isNextToStamp={isNextToStamp}
                      seekTo={seekTo}
                      updateLine={updateLine}
                      deleteLine={deleteLine}
                      activeLineRef={activeLineRef}
                    />
                  );
                });
              })()}

              {/* Dedicated + Button Under Last Lyric in Interactive Mode as requested */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={addNewLine}
                  className="w-full py-3 px-4 rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500/80 bg-zinc-950/40 hover:bg-indigo-950/20 text-zinc-400 hover:text-indigo-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer group shadow-sm active:scale-98"
                >
                  <div className="w-6 h-6 rounded-full bg-zinc-800 group-hover:bg-indigo-600/30 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 transition-colors">
                    <Plus size={15} />
                  </div>
                  <span>Add Line Below</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Bottom Navigation & Controls */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zinc-900/98 p-2 rounded-full border border-zinc-700 shadow-2xl z-50">
        <button 
          type="button"
          tabIndex={-1}
          onClick={() => skip(-5)} 
          className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
          title="Rewind 5s"
        >
          <SkipBack size={18} />
        </button>
        
        <button 
          type="button"
          tabIndex={-1}
          onClick={togglePlay} 
          className="p-3 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 transition-colors cursor-pointer"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>
        
        <button 
          type="button"
          tabIndex={-1}
          onClick={() => skip(5)} 
          className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors mr-1 cursor-pointer"
          title="Forward 5s"
        >
          <SkipForward size={18} />
        </button>
        
        <div className="w-px h-7 bg-zinc-700 mx-1" />
        
        {viewMode === 'interactive' ? (
          <button 
            type="button"
            tabIndex={-1}
            onClick={stampNextLine}
            className="bg-indigo-600 text-white rounded-full px-5 py-2.5 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 font-bold text-sm cursor-pointer"
            title="Stamp current time to the next unstamped lyric line (or press Space)"
          >
            <Clock size={18} />
            <span className="hidden sm:inline">Stamp (Space)</span>
          </button>
        ) : (
          <button 
            type="button"
            tabIndex={-1}
            onClick={switchToInteractiveMode}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-5 py-2.5 shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 font-bold text-sm cursor-pointer"
          >
            <ListMusic size={18} />
            <span className="hidden sm:inline">Timeline Sync</span>
          </button>
        )}
        
        <button 
          type="button"
          onClick={onNext}
          className="bg-zinc-800 text-white rounded-full px-5 py-2.5 hover:bg-zinc-700 active:scale-95 transition-colors font-medium flex items-center gap-2 ml-1 text-sm cursor-pointer"
          title="Proceed to challenge configurations"
        >
          <span className="hidden sm:inline">Continue</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
