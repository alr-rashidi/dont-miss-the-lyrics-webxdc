import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';
import { WebxdcPlayerStat } from './wordLayoutUtils';

interface CompletionModalProps {
  isOpen: boolean;
  totalAccumulatedErrors: number;
  communityStats: WebxdcPlayerStat;
  onContinue: () => void;
}

export function CompletionModal({
  isOpen,
  totalAccumulatedErrors,
  communityStats,
  onContinue
}: CompletionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="win-stats-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="bg-zinc-900 border border-indigo-500/40 rounded-3xl p-6 max-w-sm w-full text-center space-y-5 shadow-[0_0_50px_rgba(79,70,229,0.3)]"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-500 text-white mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Trophy size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Challenge Completed!</h3>
              <p className="text-xs text-zinc-400">You conquered all interactive sections.</p>
            </div>

            {/* Performance Stats Cards */}
            <div className="grid grid-cols-2 gap-2.5 text-left">
              <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl">
                <span className="text-[10px] text-zinc-500 font-medium block">Total Mistakes</span>
                <span className="text-lg font-bold text-amber-400 font-mono">{totalAccumulatedErrors}</span>
              </div>
              <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl">
                <span className="text-[10px] text-zinc-500 font-medium block">Community Win Rate</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {Math.round((communityStats.totalWon / (communityStats.totalPlayed || 1)) * 100)}%
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onContinue}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all active:scale-95 cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              Continue Playing Music
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
