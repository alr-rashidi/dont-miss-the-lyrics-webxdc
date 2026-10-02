import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Mic2, Settings, Share2, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const steps = [
    {
      step: '1',
      title: 'Dashboard',
      icon: Music,
      color: 'from-indigo-500 to-blue-500',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      description: 'Upload your music or video file and customize basic project details (title, artist, cover art).'
    },
    {
      step: '2',
      title: 'Lyrics',
      icon: Mic2,
      color: 'from-purple-500 to-indigo-500',
      bgColor: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      description: 'Add lyric lines, sync timestamps with live audio playback, or import an LRC file directly.'
    },
    {
      step: '3',
      title: 'Challenge',
      icon: Settings,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      description: 'Turn lyrics into interactive fill-in-the-blank puzzles, select missing words, and combine lines.'
    },
    {
      step: '4',
      title: 'Send to Chat',
      icon: Share2,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      description: 'Package your interactive game and send it directly into your chat via WebXDC to play with friends!'
    }
  ];

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 my-auto"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
            aria-label="Close onboarding modal"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="text-center space-y-3 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Sparkles size={14} />
              <span>Welcome to Don't Miss The Lyrics!</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Workflow Guide</h2>
            <p className="text-zinc-400 text-sm max-w-lg mx-auto leading-relaxed">
              <strong>Don't Miss The Lyrics</strong> is an interactive mini-game builder. It allows you to transform any song or music video into a fun, fill-in-the-blank lyric challenge. Once built, you can send your custom game directly into chat via WebXDC and play it with friends.
              <br /><br />
              Follow these 4 simple steps to build your custom interactive challenge:
            </p>
          </div>

          {/* Workflow Steps Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {steps.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4 flex gap-3.5 items-start relative group hover:border-zinc-700 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${item.bgColor}`}>
                    <Icon size={20} />
                  </div>
                  <div className="space-y-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-zinc-500">STEP {item.step}</span>
                      <h3 className="text-sm font-semibold text-zinc-100">{item.title}</h3>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Workflow Arrow Footer indicator */}
          <div className="bg-zinc-950/50 border border-zinc-800/60 rounded-xl p-3 flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <CheckCircle2 size={15} className="text-emerald-400" />
              Standard Flow:
            </span>
            <span className="font-mono text-[11px] text-zinc-400 tracking-tight">
              Dashboard ➔ Lyrics ➔ Challenge ➔ Send to Chat
            </span>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98]"
            >
              Get Started
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
