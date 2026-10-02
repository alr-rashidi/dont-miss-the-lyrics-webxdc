import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  (window as any).Buffer = (window as any).Buffer || Buffer;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
}

import * as mm from 'music-metadata-browser';
import { formatTime } from '../utils';

export interface ExtractedAudioData {
  title?: string;
  artist?: string;
  description?: string;
  coverImage?: File;
  lyrics?: {
    id: string;
    text: string;
    startTime: number | null;
    isInstrumental: boolean;
  }[];
}

/**
 * Sanitizes metadata strings by stripping Unicode replacement characters (),
 * BOM markers (\uFEFF, \uFFFE), null bytes, and non-printable control codes.
 */
export function cleanMetadataString(str: string | null | undefined): string | undefined {
  if (!str) return undefined;
  let cleaned = str
    .replace(/[\uFFFD\uFEFF\uFFFE\0]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .trim();

  // Strip any remaining leading or trailing replacement/junk glyphs
  cleaned = cleaned.replace(/^[\uFFFD\uFEFF\uFFFE\s]+|[\uFFFD\uFEFF\uFFFE\s]+$/g, '');

  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Decodes ID3 text frames respecting the encoding flag byte at frame payload start.
 */
function decodeID3FrameText(frameBytes: Uint8Array): string {
  if (frameBytes.length === 0) return '';
  const encoding = frameBytes[0];
  const payload = frameBytes.slice(1);
  try {
    let text = '';
    if (encoding === 1) { // UTF-16 with BOM
      text = new TextDecoder('utf-16').decode(payload);
    } else if (encoding === 2) { // UTF-16BE
      text = new TextDecoder('utf-16be').decode(payload);
    } else if (encoding === 3) { // UTF-8
      text = new TextDecoder('utf-8').decode(payload);
    } else { // ISO-8859-1 / ASCII
      text = new TextDecoder('iso-8859-1').decode(payload);
    }
    return text;
  } catch {
    return new TextDecoder('utf-8').decode(payload);
  }
}

// Fallback ID3v2 reader for pictures and tags if music-metadata encounters issues
async function parseFallbackID3v2(file: File): Promise<{ title?: string, artist?: string, coverImage?: File, lyricsText?: string }> {
  try {
    const buffer = await file.slice(0, 10 * 1024 * 1024).arrayBuffer(); // Increased to 10MB for large cover/lyrics
    const bytes = new Uint8Array(buffer);
    
    // Check ID3 marker (ID3v2)
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      const latin1Decoder = new TextDecoder('iso-8859-1');
      const rawLatin1 = latin1Decoder.decode(bytes);
      
      let title: string | undefined;
      let artist: string | undefined;
      let coverImage: File | undefined;
      let lyricsText: string | undefined;

      // Scan for TIT2 (Title)
      const tit2Idx = rawLatin1.indexOf('TIT2');
      if (tit2Idx !== -1 && tit2Idx + 10 < bytes.length) {
        const size = (bytes[tit2Idx + 4] << 24) | (bytes[tit2Idx + 5] << 16) | (bytes[tit2Idx + 6] << 8) | bytes[tit2Idx + 7];
        if (size > 0 && size < 5000 && tit2Idx + 10 + size <= bytes.length) {
          const frameBytes = bytes.slice(tit2Idx + 10, tit2Idx + 10 + size);
          const t = cleanMetadataString(decodeID3FrameText(frameBytes));
          if (t) title = t;
        }
      }

      // Scan for TPE1 (Artist)
      const tpe1Idx = rawLatin1.indexOf('TPE1');
      if (tpe1Idx !== -1 && tpe1Idx + 10 < bytes.length) {
        const size = (bytes[tpe1Idx + 4] << 24) | (bytes[tpe1Idx + 5] << 16) | (bytes[tpe1Idx + 6] << 8) | bytes[tpe1Idx + 7];
        if (size > 0 && size < 5000 && tpe1Idx + 10 + size <= bytes.length) {
          const frameBytes = bytes.slice(tpe1Idx + 10, tpe1Idx + 10 + size);
          const a = cleanMetadataString(decodeID3FrameText(frameBytes));
          if (a) artist = a;
        }
      }

      // Scan for USLT (Unsynchronized lyrics)
      const usltIdx = rawLatin1.indexOf('USLT');
      if (usltIdx !== -1 && usltIdx + 10 < bytes.length) {
        let frameSize = (bytes[usltIdx + 4] << 24) | (bytes[usltIdx + 5] << 16) | (bytes[usltIdx + 6] << 8) | bytes[usltIdx + 7];
        const majorVersion = bytes[3];
        if (majorVersion === 4) {
          frameSize = ((bytes[usltIdx + 4] & 0x7f) << 21) | ((bytes[usltIdx + 5] & 0x7f) << 14) | ((bytes[usltIdx + 6] & 0x7f) << 7) | (bytes[usltIdx + 7] & 0x7f);
        }
        if (frameSize > 0 && usltIdx + 10 + frameSize <= bytes.length) {
          const frameBytes = bytes.slice(usltIdx + 10, usltIdx + 10 + frameSize);
          if (frameBytes.length > 4) {
            const encoding = frameBytes[0];
            let payloadStart = 4; // Skip encoding and 3 language bytes
            
            // Skip content descriptor (null terminated string)
            if (encoding === 1 || encoding === 2) {
              while (payloadStart < frameBytes.length - 1 && (frameBytes[payloadStart] !== 0 || frameBytes[payloadStart+1] !== 0)) {
                payloadStart += 2;
              }
              payloadStart += 2;
            } else {
              while (payloadStart < frameBytes.length && frameBytes[payloadStart] !== 0) {
                payloadStart++;
              }
              payloadStart++;
            }
            
            if (payloadStart < frameBytes.length) {
              const textPayload = frameBytes.slice(payloadStart);
              const textWithEncoding = new Uint8Array(textPayload.length + 1);
              textWithEncoding[0] = encoding;
              textWithEncoding.set(textPayload, 1);
              const l = cleanMetadataString(decodeID3FrameText(textWithEncoding));
              if (l) lyricsText = l;
            }
          }
        }
      }

      // Scan for APIC (Attached Picture)
      const apicIdx = rawLatin1.indexOf('APIC');
      if (apicIdx !== -1 && apicIdx + 10 < bytes.length) {
        let frameSize = (bytes[apicIdx + 4] << 24) | (bytes[apicIdx + 5] << 16) | (bytes[apicIdx + 6] << 8) | bytes[apicIdx + 7];
        // Handle synchsafe integer if ID3v2.4
        const majorVersion = bytes[3];
        if (majorVersion === 4) {
          frameSize = ((bytes[apicIdx + 4] & 0x7f) << 21) | ((bytes[apicIdx + 5] & 0x7f) << 14) | ((bytes[apicIdx + 6] & 0x7f) << 7) | (bytes[apicIdx + 7] & 0x7f);
        }
        if (frameSize > 100 && apicIdx + 10 + frameSize <= bytes.length) {
          const apicBytes = bytes.slice(apicIdx + 10, apicIdx + 10 + frameSize);
          // Look for JPEG magic numbers (FF D8 FF) or PNG magic numbers (89 50 4E 47)
          let imgStart = -1;
          let mime = 'image/jpeg';
          for (let i = 0; i < apicBytes.length - 4; i++) {
            if (apicBytes[i] === 0xff && apicBytes[i + 1] === 0xd8 && apicBytes[i + 2] === 0xff) {
              imgStart = i;
              mime = 'image/jpeg';
              break;
            }
            if (apicBytes[i] === 0x89 && apicBytes[i + 1] === 0x50 && apicBytes[i + 2] === 0x4e && apicBytes[i + 3] === 0x47) {
              imgStart = i;
              mime = 'image/png';
              break;
            }
          }
          if (imgStart !== -1) {
            const imgData = apicBytes.slice(imgStart);
            const blob = new Blob([imgData], { type: mime });
            coverImage = new File([blob], mime === 'image/png' ? 'cover.png' : 'cover.jpg', { type: mime });
          }
        }
      }

      return { title, artist, coverImage, lyricsText };
    }
  } catch (err) {
    console.warn('Fallback tag parser failed:', err);
  }
  return {};
}

export async function extractAudioMetadata(file: File): Promise<ExtractedAudioData> {
  let extractedTitle: string | undefined;
  let extractedArtist: string | undefined;
  let extractedCover: File | undefined;
  let extractedLyricsText = '';

  try {
    const meta = await mm.parseBlob(file, { duration: true, skipCovers: false });
    if (meta.common.title) extractedTitle = cleanMetadataString(meta.common.title);
    if (meta.common.artist) extractedArtist = cleanMetadataString(meta.common.artist);

    // Comprehensive extraction of cover art across pictures array
    if (meta.common.picture && meta.common.picture.length > 0) {
      for (const pic of meta.common.picture) {
        if (pic && pic.data && pic.data.length > 0) {
          let mimeType = pic.format || 'image/jpeg';
          if (!mimeType.includes('/')) {
            mimeType = `image/${mimeType}`;
          }
          const blob = new Blob([pic.data], { type: mimeType });
          const ext = mimeType.includes('png') ? 'png' : 'jpg';
          extractedCover = new File([blob], `cover.${ext}`, { type: mimeType });
          break;
        }
      }
    }

    // Inspect native tags for images if common picture was not found
    if (!extractedCover && meta.native) {
      for (const tagType of Object.keys(meta.native)) {
        const tags = meta.native[tagType];
        for (const tag of tags) {
          const tid = tag.id?.toUpperCase() || '';
          if (tid === 'APIC' || tid === 'PIC' || tid === 'COVER' || tid === 'METADATA_BLOCK_PICTURE' || tid === 'COVR') {
            const val = tag.value;
            if (val && val.data && val.data.length > 0) {
              const mime = val.format || 'image/jpeg';
              const blob = new Blob([val.data], { type: mime.includes('/') ? mime : `image/${mime}` });
              extractedCover = new File([blob], 'cover.jpg', { type: blob.type });
              break;
            }
          }
        }
        if (extractedCover) break;
      }
    }

    // Parse lyrics from common tags
    if (meta.common.lyrics && meta.common.lyrics.length > 0) {
      extractedLyricsText = meta.common.lyrics
        .map((item: any) => {
          if (typeof item === 'string') return cleanMetadataString(item);
          if (item?.text) return cleanMetadataString(item.text);
          if (item?.syncText && Array.isArray(item.syncText)) {
            return item.syncText
              .map((st: any) => `[${formatTime((st.timestamp || 0) / 1000)}] ${cleanMetadataString(st.text) || ''}`)
              .join('\n');
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }

    // Inspect native ID3 tags for lyrics
    if (!extractedLyricsText && meta.native) {
      for (const tagType of Object.keys(meta.native)) {
        const tags = meta.native[tagType];
        for (const tag of tags) {
          const tid = tag.id?.toUpperCase() || '';
          if (tid === 'USLT' || tid === 'SYLT' || tid === 'LYRICS' || tid.includes('LYRIC')) {
            if (typeof tag.value === 'string') {
              extractedLyricsText = cleanMetadataString(tag.value) || '';
              break;
            } else if (tag.value?.text) {
              extractedLyricsText = cleanMetadataString(tag.value.text) || '';
              break;
            }
          }
        }
        if (extractedLyricsText) break;
      }
    }
  } catch (e) {
    console.warn('music-metadata parseBlob warning:', e);
  }

  // If cover, title, artist, or lyrics are missing, try fallback binary scan
  if (!extractedCover || !extractedTitle || !extractedArtist || !extractedLyricsText) {
    const fallback = await parseFallbackID3v2(file);
    if (!extractedTitle && fallback.title) extractedTitle = cleanMetadataString(fallback.title);
    if (!extractedArtist && fallback.artist) extractedArtist = cleanMetadataString(fallback.artist);
    if (!extractedCover && fallback.coverImage) extractedCover = fallback.coverImage;
    if (!extractedLyricsText && fallback.lyricsText) extractedLyricsText = cleanMetadataString(fallback.lyricsText) || '';
  }

  // If title was still not found, derive cleanly from file name
  if (!extractedTitle) {
    const rawName = cleanMetadataString(file.name.replace(/\.[^/.]+$/, '')) || file.name;
    if (rawName.includes(' - ')) {
      const parts = rawName.split(' - ');
      if (!extractedArtist && parts[0]) extractedArtist = cleanMetadataString(parts[0]);
      extractedTitle = cleanMetadataString(parts.slice(1).join(' - ')) || rawName;
    } else {
      extractedTitle = rawName;
    }
  }

  // Clean final title and artist one last time
  extractedTitle = cleanMetadataString(extractedTitle);
  extractedArtist = cleanMetadataString(extractedArtist);

  let lyrics: ExtractedAudioData['lyrics'] = undefined;
  if (extractedLyricsText) {
    // 1. Normalize HTML line breaks, escaped breaks, and carriage returns
    let normalized = extractedLyricsText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n|\r/g, '\n');

    // 2. Separate inline LRC timestamp tags (e.g. [00:10.00]Line 1[00:15.00]Line 2)
    normalized = normalized.replace(/(\[\d{1,2}:\d{2}(?:\.\d{1,3})?\])/g, '\n$1');

    let rawLines = normalized.split('\n')
      .map(line => cleanMetadataString(line))
      .filter((line): line is string => Boolean(line));

    // 3. Fallback for single-line un-synced text containing delimiter separators (e.g., ' / ' or ' | ' or '; ')
    if (rawLines.length === 1 && rawLines[0].length > 60) {
      const singleLine = rawLines[0];
      if (singleLine.includes(' / ')) {
        rawLines = singleLine.split(' / ').map(l => cleanMetadataString(l)).filter((l): l is string => Boolean(l));
      } else if (singleLine.includes(' | ')) {
        rawLines = singleLine.split(' | ').map(l => cleanMetadataString(l)).filter((l): l is string => Boolean(l));
      } else if (singleLine.includes(' ; ')) {
        rawLines = singleLine.split(' ; ').map(l => cleanMetadataString(l)).filter((l): l is string => Boolean(l));
      }
    }

    const lrcRegex = /^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]\s*(.*)$/;
    lyrics = rawLines
      .map((line, idx) => {
        const match = line.match(lrcRegex);
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseFloat(match[2]);
          const lyricText = cleanMetadataString(match[3]) || '';
          return {
            id: `line-${idx}-${Date.now()}`,
            text: lyricText,
            startTime: minutes * 60 + seconds,
            isInstrumental: lyricText.trim().length === 0
          };
        }
        return {
          id: `line-${idx}-${Date.now()}`,
          text: line,
          startTime: null,
          isInstrumental: line.trim().length === 0
        };
      });
  }

  return {
    title: extractedTitle,
    artist: extractedArtist,
    description: undefined, // Do not auto-fill description
    coverImage: extractedCover,
    lyrics
  };
}
