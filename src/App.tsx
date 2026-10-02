import { useState, useEffect } from 'react';
import { useIndexedDB } from './hooks/useIndexedDB';
import { ProjectState } from './types';
import { syncLyricsWithChallenges } from './utils';
import Dashboard from './components/Creator/Dashboard';
import LyricSync from './components/Creator/LyricSync';
import ChallengeConfig from './components/Creator/ChallengeConfig';
import Packager from './components/Creator/Packager';
import PlayerPreview from './components/Player/PlayerPreview';
import OnboardingModal from './components/OnboardingModal';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Mic2, Settings, Share2, PlaySquare, HelpCircle } from 'lucide-react';

export default function App() {
  const { projectState, saveState, isLoading } = useIndexedDB();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sync' | 'config' | 'packager' | 'preview'>('dashboard');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('has_seen_onboarding');
    if (!hasSeen) {
      setIsOnboardingOpen(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    localStorage.setItem('has_seen_onboarding', 'true');
    setIsOnboardingOpen(false);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">Loading...</div>;
  }

  const handleUpdateState = (newState: Partial<ProjectState>) => {
    saveState((prev: ProjectState | null) => {
      if (prev) {
        const rawLyrics = newState.lyrics !== undefined ? newState.lyrics : prev.lyrics;
        const rawChallenges = newState.challenges !== undefined ? newState.challenges : prev.challenges;
        const synced = syncLyricsWithChallenges(rawLyrics, rawChallenges);

        return {
          ...prev,
          ...newState,
          lyrics: synced.lyrics,
          challenges: synced.challenges,
          metadata: {
            ...prev.metadata,
            ...(newState.metadata || {})
          },
          media: newState.media ? { ...prev.media, ...newState.media } : prev.media,
          settings: newState.settings ? { ...prev.settings, ...newState.settings } : prev.settings
        };
      } else {
        const rawLyrics = newState.lyrics || [];
        const synced = syncLyricsWithChallenges(rawLyrics, newState.challenges);
        const initial: ProjectState = {
          id: uuidv4(),
          metadata: { title: '', description: '', coverImage: null },
          media: { file: null, type: null },
          ...newState,
          lyrics: synced.lyrics,
          challenges: synced.challenges,
        };
        return initial;
      }
    });
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Music },
    { id: 'sync', label: 'Lyrics', icon: Mic2 },
    { id: 'config', label: 'Challenge', icon: Settings },
    { id: 'packager', label: 'Send to Chat', icon: Share2 },
    { id: 'preview', label: 'Preview', icon: PlaySquare },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-2 sm:px-4 py-1.5 sm:py-2 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="w-8 shrink-0"></div>

          {/* Navigation Bar: Responsive compact layout fitting within the header without horizontal scroll */}
          <nav className="flex items-center justify-center w-full max-w-lg gap-1 sm:gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { window.scrollTo(0, 0); setActiveTab(tab.id); }}
                  className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 px-1 sm:px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-transparent'
                  }`}
                >
                  <Icon size={15} className={`flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
                  <span className="text-[10px] sm:text-xs tracking-tight whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Guide / Onboarding Trigger */}
          <div className="w-8 shrink-0 flex justify-end">
            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Workflow Guide"
            >
              <HelpCircle size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 w-full ${activeTab === 'preview' ? 'p-0 m-0 max-w-none h-full overflow-hidden' : 'max-w-6xl mx-auto p-4 sm:p-6'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full"
          >
            {activeTab === 'dashboard' && <Dashboard state={projectState} updateState={handleUpdateState} onNext={() => { window.scrollTo(0, 0); setActiveTab('sync'); }} />}
            {activeTab === 'sync' && <LyricSync state={projectState} updateState={handleUpdateState} onNext={() => { window.scrollTo(0, 0); setActiveTab('config'); }} />}
            {activeTab === 'config' && <ChallengeConfig state={projectState} updateState={handleUpdateState} onNext={() => { window.scrollTo(0, 0); setActiveTab('packager'); }} />}
            {activeTab === 'packager' && <Packager state={projectState} />}
            {activeTab === 'preview' && <PlayerPreview state={projectState} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <OnboardingModal isOpen={isOnboardingOpen} onClose={handleCloseOnboarding} />
    </div>
  );
}
