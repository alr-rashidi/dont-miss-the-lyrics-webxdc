import React, { useState } from 'react';
import { ProjectState } from '../../types';
import { Loader2, Share2, Check, MessageSquare } from 'lucide-react';
import { BuilderService } from '../../services/BuilderService';

interface Props {
  state: ProjectState | null;
}

export default function Packager({ state }: Props) {
  const [isPackaging, setIsPackaging] = useState(false);
  const [shared, setShared] = useState(false);

  const handleSendToChat = async () => {
    if (!state) return;
    setIsPackaging(true);

    try {
      const appName = "🎤 Don't Miss The Lyrics!";
      const sanitizedTitle = (state.metadata.title?.trim() || 'Dont_Miss_The_Lyrics').replace(/[/\\?%*:|"<>]/g, '_');
      const fileName = `${sanitizedTitle}.xdc`;
      const shareText = appName;

      const rawBlob = await BuilderService.buildXDC(state);
      const targetWebxdc = (window as any).webxdc || (typeof window !== 'undefined' && (window as any).parent?.webxdc);

      if (targetWebxdc && typeof targetWebxdc.sendToChat === 'function') {
        let sent = false;
        
        // Attempt 1: Standard Blob format
        try {
          await targetWebxdc.sendToChat({
            file: {
              name: fileName,
              blob: rawBlob,
            },
            text: shareText,
          });
          sent = true;
        } catch (e1) {
          console.warn("sendToChat with blob rejected, trying base64:", e1);
        }

        // Attempt 2: Base64 format if Blob wasn't accepted
        if (!sent) {
          try {
            const base64Data = await BuilderService.buildXDCBase64(state);
            await targetWebxdc.sendToChat({
              file: {
                name: fileName,
                base64: base64Data,
              },
              text: shareText,
            });
            sent = true;
          } catch (e2) {
            console.warn("sendToChat with base64 rejected, trying text:", e2);
          }
        }

        // Attempt 3: Text only
        if (!sent) {
          try {
            await targetWebxdc.sendToChat({ text: shareText });
            sent = true;
          } catch (e3) {
            console.error("sendToChat all methods failed:", e3);
          }
        }

        setShared(true);
        setTimeout(() => setShared(false), 4000);
      } else {
        // Direct browser download fallback
        const url = URL.createObjectURL(rawBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        setShared(true);
        setTimeout(() => setShared(false), 4000);
      }
    } catch (error) {
      console.error("Packaging failed:", error);
    } finally {
      setIsPackaging(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-500 pt-4 pb-16">
      
      <div className="text-center space-y-3">
         <div className="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
            <MessageSquare size={40} className="text-indigo-400" />
         </div>
         <h2 className="text-2xl sm:text-3xl font-bold text-white">
           Send Challenge to Chat
         </h2>
         <p className="text-zinc-400 text-sm max-w-sm mx-auto">
           Package and send this interactive music challenge directly into your chat.
         </p>
      </div>

      <div className="flex flex-col items-center gap-3.5 w-full max-w-xs">
        <div className="w-full">
          {/* Send to Chat Button */}
          <button 
            type="button"
            onClick={handleSendToChat}
            disabled={isPackaging}
            className="w-full flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white px-7 py-3.5 rounded-2xl font-bold text-base transition-all active:scale-95 shadow-lg shadow-indigo-600/30 cursor-pointer disabled:cursor-not-allowed"
          >
            {isPackaging ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Preparing for Chat...</span>
              </>
            ) : shared ? (
              <>
                <Check size={20} className="text-emerald-300" />
                <span>Sent to Chat!</span>
              </>
            ) : (
              <>
                <Share2 size={20} />
                <span>Send to Chat</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Challenge Summary */}
      {state && (() => {
        const challengesMap = state.challenges || {};
        const challengesList = Object.entries(challengesMap)
          .map(([numStr, cfg]) => ({ lineNum: Number(numStr), cfg }))
          .filter(e => !isNaN(e.lineNum) && e.cfg?.isActive);

        const totalChallenges = challengesList.length;

        const challengedLineNums = new Set<number>();
        challengesList.forEach(({ lineNum, cfg }) => {
          challengedLineNums.add(lineNum);
          (cfg.includedLineNumbers || []).forEach(n => challengedLineNums.add(n));
        });

        const totalChallengedLines = challengedLineNums.size;
        const totalLines = state.lyrics.filter(l => !l.isInstrumental).length;

        return (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 w-full max-w-sm space-y-3">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Package Summary</div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                <div className="text-xl font-bold text-white">{totalChallenges}</div>
                <div className="text-[11px] text-zinc-400">Total Challenges</div>
              </div>
              <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                <div className="text-xl font-bold text-white">{totalChallengedLines} / {totalLines}</div>
                <div className="text-[11px] text-zinc-400">Lines Challenged</div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
