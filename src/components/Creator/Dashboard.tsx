import React, { useRef, useState, useEffect } from 'react';
import { ProjectState } from '../../types';
import { Image as ImageIcon, Music, ArrowRight, Sparkles, Sliders, CheckCircle2, User, X } from 'lucide-react';
import { createObjectUrl } from '../../utils';
import { extractAudioMetadata } from '../../services/MetadataParser';

interface Props {
  state: ProjectState | null;
  updateState: (s: Partial<ProjectState>) => void;
  onNext: () => void;
}

export default function Dashboard({ state, updateState, onNext }: Props) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);
  const [metadataFoundNotice, setMetadataFoundNotice] = useState<string | null>(null);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.metadata.coverImage) {
      setCoverUrl(createObjectUrl(state.metadata.coverImage));
    }
    return () => {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
    };
  }, [state?.metadata.coverImage]);

  const processMediaFile = async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const mediaType = isVideo ? 'video' : 'audio';

    if (isVideo) {
      updateState({
        media: { file, type: 'video' },
        metadata: {
          ...state?.metadata,
          title: state?.metadata.title || file.name.replace(/\.[^/.]+$/, ""),
          artist: state?.metadata.artist || '',
          description: state?.metadata.description || ''
        } as ProjectState['metadata']
      });
      return;
    }

    try {
      setIsExtractingMetadata(true);
      const parsed = await extractAudioMetadata(file);

      const updates: Partial<ProjectState> = {
        media: { file, type: 'audio' },
        metadata: {
          ...state?.metadata,
          title: parsed.title || state?.metadata.title || file.name.replace(/\.[^/.]+$/, ""),
          artist: parsed.artist || state?.metadata.artist || '',
          description: state?.metadata.description || '',
          coverImage: parsed.coverImage || state?.metadata.coverImage,
        } as ProjectState['metadata']
      };

      if (parsed.lyrics && parsed.lyrics.length > 0) {
        updates.lyrics = parsed.lyrics;
      }

      updateState(updates);

      const items = [
        parsed.title && 'Title',
        parsed.artist && 'Artist',
        parsed.coverImage && 'Cover Art',
        parsed.lyrics && parsed.lyrics.length > 0 && 'Lyrics'
      ].filter(Boolean);

      if (items.length > 0) {
        setMetadataFoundNotice(`Extracted metadata from audio: ${items.join(', ')}`);
        setTimeout(() => setMetadataFoundNotice(null), 6000);
      }
    } catch (err) {
      console.warn('Could not extract metadata tags:', err);
      updateState({
        media: { file, type: 'audio' },
        metadata: {
          ...state?.metadata,
          title: state?.metadata.title || file.name.replace(/\.[^/.]+$/, ""),
          artist: state?.metadata.artist || '',
          description: state?.metadata.description || ''
        } as ProjectState['metadata']
      });
    } finally {
      setIsExtractingMetadata(false);
    }
  };

  const handleSelectMedia = async () => {
    if (typeof (window as any).webxdc?.importFiles === 'function') {
      try {
        const files = await (window as any).webxdc.importFiles({
          mimeTypes: ['audio/*', 'video/*'],
          extensions: ['.mp4', '.mp3', '.m4a', '.wav', '.ogg', '.webm', '.mov', '.mkv']
        });
        if (files && files.length > 0) {
          await processMediaFile(files[0]);
        }
      } catch (err) {
        console.warn('webxdc.importFiles failed, falling back to file input:', err);
        mediaInputRef.current?.click();
      }
    } else {
      mediaInputRef.current?.click();
    }
  };

  const handleSelectCover = async () => {
    if (typeof (window as any).webxdc?.importFiles === 'function') {
      try {
        const files = await (window as any).webxdc.importFiles({
          mimeTypes: ['image/*'],
          extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        });
        if (files && files.length > 0) {
          updateState({ metadata: { ...state?.metadata, coverImage: files[0] } as ProjectState['metadata'] });
        }
      } catch (err) {
        console.warn('webxdc.importFiles for cover failed, falling back to file input:', err);
        coverInputRef.current?.click();
      }
    } else {
      coverInputRef.current?.click();
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processMediaFile(file);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateState({ metadata: { ...state?.metadata, coverImage: file } as ProjectState['metadata'] });
  };

  const handleMediaDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingMedia(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
      await processMediaFile(file);
    }
  };

  const handleCoverDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCover(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      updateState({ metadata: { ...state?.metadata, coverImage: file } as ProjectState['metadata'] });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-3 pb-16">
      {/* App Emblem / Logo Section at the top of Dashboard */}
      <div className="flex flex-col items-center justify-center text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center shadow-xl shadow-indigo-500/20 border border-indigo-500/20 p-3">
          <svg viewBox="0 0 512 512" className="w-full h-full text-indigo-400 fill-current">
            <path d="M488.413,118.27c0-31.606-12.309-61.323-34.659-83.671C411.664-7.493,345.498-11.175,299.184,23.53l-7.131-7.131 L268.211,40.24l7.12,7.12c-16.405,21.844-24.698,48.595-23.458,76.141L39.935,351.283l38.815,38.815 c-18.243,21.376-21.458,35.552-24.34,48.289c-2.975,13.143-5.545,24.493-30.822,49.771L47.429,512 c32.17-32.171,36.257-50.232,39.865-66.169c2.247-9.924,4.128-18.212,15.358-31.83l34.416,34.416l227.782-211.94 c1.797,0.081,3.593,0.133,5.382,0.133c25.634,0,50.338-8.262,70.754-23.594l7.124,7.124l23.841-23.841l-7.121-7.121 C480.132,168.825,488.413,144.186,488.413,118.27z M137.911,401.577L86.773,350.44l182.909-196.581l64.81,64.811L137.911,401.577 z M366.302,202.793l-80.745-80.745c-0.818-18.069,4.097-35.659,13.96-50.502l117.286,117.287 C401.963,198.697,384.374,203.609,366.302,202.793z M440.649,164.995L323.369,47.714c32.839-21.755,77.634-18.184,106.543,10.725 c15.982,15.982,24.783,37.231,24.783,59.83C454.695,135.143,449.785,151.259,440.649,164.995z"></path>
            <rect x="191.378" y="260.003" transform="matrix(-0.7071 -0.7071 0.7071 -0.7071 165.2732 622.1811)" width="40.234" height="33.717"></rect>
          </svg>
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100">Don’t Miss The Lyrics!</h2>
          <p className="text-zinc-400 text-sm">Select your music or video file and customize challenge parameters.</p>
        </div>
      </div>

      {metadataFoundNotice && (
        <div className="max-w-2xl mx-auto px-4 py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs flex items-center gap-2 shadow-sm">
          <Sparkles size={16} className="text-indigo-400 flex-shrink-0" />
          <span>{metadataFoundNotice}</span>
        </div>
      )}

      {/* Primary Media Section (Prominent) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <span>Audio or Video File</span>
            <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
              Required
            </span>
          </label>
        </div>

        <div 
          className={`bg-zinc-900/90 border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 transition-all group cursor-pointer ${
            isDraggingMedia 
              ? 'border-indigo-500 bg-indigo-950/30 scale-[1.01]' 
              : state?.media.file 
                ? 'border-indigo-500/60 bg-zinc-900'
                : 'border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/60'
          }`}
          onClick={handleSelectMedia}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingMedia(true); }}
          onDragLeave={() => setIsDraggingMedia(false)}
          onDrop={handleMediaDrop}
        >
          <input 
            type="file" 
            accept="audio/*,video/*" 
            className="hidden" 
            ref={mediaInputRef} 
            onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
            onChange={handleMediaUpload} 
          />
          
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
            <Music className="text-indigo-400" size={32} />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">
              {state?.media.file ? (state.media.file as File).name || 'Media File Loaded' : 'Select or Drop Audio / Video File'}
            </h3>
            <p className="text-xs text-zinc-400">
              {isExtractingMetadata 
                ? 'Reading metadata (title, artist, cover art, lyrics)...' 
                : state?.media.file 
                  ? `${state.media.type === 'video' ? 'Video' : 'Audio'} ready • Click to change file`
                  : 'Click anywhere to browse, or drag and drop your media file here'}
            </p>
          </div>

          {state?.media.file && (
            <div className="px-3.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>File Attached</span>
            </div>
          )}
        </div>
      </div>

      {/* Cover Image Upload (Compact & Subordinate) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <span>Challenge Cover Image</span>
            <span className="text-[11px] font-medium text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700">
              Optional
            </span>
          </label>
        </div>

        <div 
          className={`bg-zinc-900/60 border border-dashed rounded-xl p-4 flex items-center justify-between gap-4 transition-all group cursor-pointer relative overflow-hidden ${
            isDraggingCover 
              ? 'border-purple-500 bg-purple-950/30' 
              : 'border-zinc-800 hover:border-purple-500/40 hover:bg-zinc-900'
          }`}
          onClick={handleSelectCover}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingCover(true); }}
          onDragLeave={() => setIsDraggingCover(false)}
          onDrop={handleCoverDrop}
        >
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={coverInputRef} 
            onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
            onChange={handleCoverUpload} 
          />
          
          <div className="flex items-center gap-3 min-w-0">
            {coverUrl ? (
              <img src={coverUrl} alt="Cover" className="w-14 h-14 rounded-lg object-cover border border-purple-500/40 shadow-sm flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="text-purple-400" size={22} />
              </div>
            )}
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold text-zinc-200 truncate">
                {state?.metadata.coverImage ? (state.metadata.coverImage as File).name || 'Cover Image Selected' : 'Choose Cover Artwork'}
              </h4>
              <p className="text-[11px] text-zinc-500 truncate">
                JPG, PNG, WEBP (Click or Drag & Drop)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {state?.metadata.coverImage && (
              <button 
                type="button" 
                onClick={(e) => {
                  e.stopPropagation();
                  if (coverInputRef.current) coverInputRef.current.value = '';
                  updateState({ metadata: { ...state.metadata, coverImage: undefined } as ProjectState['metadata'] });
                }}
                title="Remove cover artwork"
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-700 hover:border-rose-500/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={15} />
              </button>
            )}

            <button 
              type="button" 
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
            >
              {state?.metadata.coverImage ? 'Change' : 'Browse'}
            </button>
          </div>
        </div>
      </div>

      {/* Metadata & Details Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Sliders size={16} className="text-indigo-400" />
          <span>Challenge Information & Metadata</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-300">Challenge Name / Track Title</label>
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                Required
              </span>
            </div>
            <input 
              type="text" 
              value={state?.metadata?.title || ''} 
              onChange={(e) => updateState({ metadata: { ...state?.metadata, title: e.target.value } as ProjectState['metadata'] })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="e.g. Bohemian Rhapsody"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <User size={13} className="text-zinc-400" />
                <span>Artist Name</span>
              </label>
              <span className="text-[10px] font-medium text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-700">
                Optional
              </span>
            </div>
            <input 
              type="text" 
              value={state?.metadata?.artist || ''} 
              onChange={(e) => updateState({ metadata: { ...state?.metadata, artist: e.target.value } as ProjectState['metadata'] })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="e.g. Queen"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-zinc-300">Short Description</label>
            <span className="text-[10px] font-medium text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-700">
              Optional
            </span>
          </div>
          <textarea 
            value={state?.metadata?.description || ''} 
            onChange={(e) => updateState({ metadata: { ...state?.metadata, description: e.target.value } as ProjectState['metadata'] })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all min-h-[75px] resize-y"
            placeholder="Write a brief intro or rules for players..."
          />
        </div>
      </div>

      {/* Bottom Continue Action */}
      <div className="flex justify-end pt-2">
        <button 
          onClick={onNext}
          disabled={!state?.media.file || !state?.metadata.title}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
        >
          <span>Next: Sync Lyrics</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
