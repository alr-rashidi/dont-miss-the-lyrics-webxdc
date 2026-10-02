import JSZip from 'jszip';
import { ProjectState } from '../types';
import { syncLyricsWithChallenges } from '../utils';
import { DEFAULT_ICON_BASE64 } from './defaultIcon';
import { STANDALONE_PLAYER_HTML } from './playerHtmlTemplate';

export class BuilderService {
  static async createXDCZip(state: ProjectState): Promise<JSZip> {
    const zip = new JSZip();
    const synced = syncLyricsWithChallenges(state.lyrics || [], state.challenges);

    // 1. Prepare standardized file references
    const config = {
      id: state.id,
      metadata: {
        title: state.metadata.title,
        artist: state.metadata.artist || '',
        description: state.metadata.description || '',
        coverImage: 'cover.png'
      },
      media: {
        file: 'media.mp3',
        type: state.media.type || 'audio'
      },
      settings: state.settings,
      challenges: synced.challenges,
      lyrics: synced.lyrics
    };

    // File 1: config.json
    zip.file("config.json", JSON.stringify(config, null, 2));

    // File 2: cover.png & File 3: icon.png
    if (state.metadata.coverImage && typeof state.metadata.coverImage !== 'string') {
      zip.file("cover.png", state.metadata.coverImage);
      zip.file("icon.png", state.metadata.coverImage);
    } else {
      zip.file("cover.png", DEFAULT_ICON_BASE64, { base64: true });
      zip.file("icon.png", DEFAULT_ICON_BASE64, { base64: true });
    }

    // File 4: manifest.toml for Webxdc
    const appTitle = (
      state.metadata.title?.trim()
        ? (state.metadata.artist?.trim() ? `${state.metadata.title.trim()} - ${state.metadata.artist.trim()}` : state.metadata.title.trim())
        : "Don't Miss The Lyrics!"
    ).replace(/"/g, "'");

    const appDesc = (
      state.metadata.description?.trim() ||
      (state.metadata.title?.trim() ? `Interactive music challenge for "${state.metadata.title.trim()}"` : 'Interactive music and lyric challenge')
    ).replace(/"/g, "'");

    const manifestToml = `name = "${appTitle}"
source_code_url = ""
description = "${appDesc}"
`;
    zip.file("manifest.toml", manifestToml);

    // File 5: media.mp3
    if (state.media.file && typeof state.media.file !== 'string') {
      zip.file("media.mp3", state.media.file);
    } else {
      zip.file("media.mp3", new Uint8Array(0));
    }

    // File 6: webxdc.js (standard empty file for host injection)
    zip.file("webxdc.js", "");

    // File 7: index.html (Bundled with the exact same React PlayerPreview code and Tailwind CSS as the preview)
    const customizedPlayerHtml = STANDALONE_PLAYER_HTML.replace(
      /<title>.*?<\/title>/i,
      `<title>${appTitle}</title>`
    );
    zip.file("index.html", customizedPlayerHtml);

    return zip;
  }

  static async buildXDC(state: ProjectState): Promise<Blob> {
    const zip = await this.createXDCZip(state);
    return await zip.generateAsync({ type: 'blob' });
  }

  static async buildXDCBase64(state: ProjectState): Promise<string> {
    const zip = await this.createXDCZip(state);
    return await zip.generateAsync({ type: 'base64' });
  }
}
