/**
 * TV_Abdul: FileBrowserService
 * Read-only browsing of USB drives connected to the TV, through the Tizen filesystem API.
 * Nothing here writes, renames or deletes.
 */

const VIDEO_EXTENSIONS = new Set(['mp4', 'mkv', 'avi', 'mov', 'm4v', 'ts', 'm2ts', 'mpg', 'mpeg', 'wmv', 'webm', 'flv', '3gp']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']);
const SUBTITLE_EXTENSIONS = new Set(['srt']);
const HIDDEN_NAMES = new Set(['system volume information', '$recycle.bin', 'lost.dir', 'found.000']);
const MAX_SUBTITLE_BYTES = 3 * 1024 * 1024;

export function getExtension(name) {
  const dot = String(name).lastIndexOf('.');
  return dot > 0 ? String(name).slice(dot + 1).toLowerCase() : '';
}

export function getBaseName(name) {
  const dot = String(name).lastIndexOf('.');
  return dot > 0 ? String(name).slice(0, dot) : String(name);
}

/** @returns {'video'|'image'|'subtitle'|'other'} */
export function classifyFile(name) {
  const ext = getExtension(name);
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (SUBTITLE_EXTENSIONS.has(ext)) return 'subtitle';
  return 'other';
}

export function isHiddenName(name) {
  const value = String(name);
  return value.startsWith('.') || HIDDEN_NAMES.has(value.toLowerCase());
}

/** Compare names so that "Episode 2" sorts before "Episode 10". */
export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** Folders first, then files, each in natural name order. */
export function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return naturalCompare(a.name, b.name);
  });
}

/**
 * Keep what the browser shows (folders, videos, images) and drop hidden or system entries.
 */
export function filterVisible(entries) {
  return entries.filter((entry) => {
    if (isHiddenName(entry.name)) return false;
    return entry.isDirectory || entry.kind === 'video' || entry.kind === 'image';
  });
}

/**
 * Find subtitle files that belong to a video: "Film.srt", "Film.ar.srt", "Film.en.srt".
 * Arabic-tagged files come first.
 */
export function findSubtitlesFor(videoName, siblings) {
  const base = getBaseName(videoName).toLowerCase();
  const matches = siblings.filter((entry) => {
    if (entry.isDirectory || entry.kind !== 'subtitle') return false;
    const subBase = getBaseName(entry.name).toLowerCase();
    return subBase === base || subBase.startsWith(`${base}.`);
  });
  const isArabic = (name) => /\.(ar|ara|arabic)\.srt$/i.test(name);
  return matches.sort((a, b) => Number(isArabic(b.name)) - Number(isArabic(a.name)) || naturalCompare(a.name, b.name));
}

export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

function getFilesystem() {
  return typeof window !== 'undefined' && window.tizen && window.tizen.filesystem ? window.tizen.filesystem : null;
}

function toEntry(file) {
  const name = file.name;
  return {
    name,
    path: file.fullPath,
    uri: file.toURI(),
    isDirectory: Boolean(file.isDirectory),
    size: file.isDirectory ? 0 : Number(file.fileSize) || 0,
    kind: file.isDirectory ? 'folder' : classifyFile(name)
  };
}

class FileBrowserService {
  isAvailable() {
    return Boolean(getFilesystem());
  }

  /**
   * List mounted removable drives.
   * @returns {Promise<Array<{label: string, name: string}>>}
   */
  listDrives() {
    const fs = getFilesystem();
    if (!fs) return Promise.resolve([]);
    return new Promise((resolve) => {
      try {
        fs.listStorages(
          (storages) => {
            const drives = (storages || [])
              .filter((s) => s.type === 'EXTERNAL' && s.state === 'MOUNTED')
              .map((s, index) => ({ label: s.label, name: `USB ${index + 1}` }));
            resolve(drives);
          },
          (err) => {
            console.warn('[files] listStorages failed:', err && err.message);
            resolve([]);
          }
        );
      } catch (e) {
        console.warn('[files] listStorages threw:', e && e.message);
        resolve([]);
      }
    });
  }

  resolve(path) {
    const fs = getFilesystem();
    return new Promise((resolve, reject) => {
      if (!fs) {
        reject(new Error('File access is only available on the TV.'));
        return;
      }
      try {
        fs.resolve(path, resolve, (err) => reject(new Error((err && err.message) || 'Cannot open this location.')), 'r');
      } catch (e) {
        reject(new Error((e && e.message) || 'Cannot open this location.'));
      }
    });
  }

  /**
   * List every entry of a folder (unfiltered), sorted folders-first.
   * @param {string} path a drive label or a folder path returned by a previous listing
   */
  async listAll(path) {
    const dir = await this.resolve(path);
    const files = await new Promise((resolve, reject) => {
      try {
        dir.listFiles(resolve, (err) => reject(new Error((err && err.message) || 'Cannot read this folder.')));
      } catch (e) {
        reject(new Error((e && e.message) || 'Cannot read this folder.'));
      }
    });
    return sortEntries((files || []).map(toEntry));
  }

  /**
   * Read a small file fully (used for subtitles).
   * @returns {Promise<Uint8Array>}
   */
  async readBytes(path) {
    const file = await this.resolve(path);
    const size = Math.min(Number(file.fileSize) || 0, MAX_SUBTITLE_BYTES);
    return new Promise((resolve, reject) => {
      try {
        file.openStream(
          'r',
          (stream) => {
            try {
              const bytes = stream.readBytes(size);
              stream.close();
              resolve(Uint8Array.from(bytes));
            } catch (e) {
              try {
                stream.close();
              } catch (closeErr) {}
              reject(e);
            }
          },
          (err) => reject(new Error((err && err.message) || 'Cannot read this file.'))
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Be told when a drive is plugged in or removed.
   * @returns {Function} stop watching
   */
  watchDrives(callback) {
    const fs = getFilesystem();
    if (!fs || !fs.addStorageStateChangeListener) return () => {};
    try {
      const watchId = fs.addStorageStateChangeListener(() => callback());
      return () => {
        try {
          fs.removeStorageStateChangeListener(watchId);
        } catch (e) {}
      };
    } catch (e) {
      return () => {};
    }
  }
}

export const fileBrowserService = new FileBrowserService();
