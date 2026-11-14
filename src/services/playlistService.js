/**
 * TV_Abdul: PlaylistService
 * Loads the user's own M3U / M3U8 channel playlists and merges them into the channel guide
 * under "My Playlists". Each playlist is cached so its channels still appear when its
 * address is temporarily unreachable.
 */

import { storageService } from './storageService.js';
import { kvStore } from './kvStore.js';

const FETCH_TIMEOUT_MS = 20000;
const MAX_CHANNELS_PER_PLAYLIST = 5000;

function hashString(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function readAttribute(line, name) {
  const match = line.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : '';
}

/**
 * Parse M3U text into guide channels. Entries with the same name become one channel with
 * several sources.
 * @param {string} text playlist contents
 * @param {string} sourceUrl the playlist address (used to build stable channel ids)
 * @returns {Array} channels
 */
export function parsePlaylist(text, sourceUrl) {
  const body = String(text || '').replace(/^﻿/, '');
  if (!/#EXTINF/i.test(body)) return [];

  const prefix = `pl-${hashString(sourceUrl)}`;
  const byName = new Map();
  let pending = null;

  body.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    if (/^#EXTINF/i.test(line)) {
      // The display name follows the first comma that is not inside a quoted attribute.
      let commaIndex = -1;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (line[i] === ',' && !inQuotes) {
          commaIndex = i;
          break;
        }
      }
      const displayName = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : '';
      pending = {
        name: displayName || readAttribute(line, 'tvg-name') || 'Untitled',
        logo: readAttribute(line, 'tvg-logo') || null,
        group: readAttribute(line, 'group-title') || '',
        tvgId: readAttribute(line, 'tvg-id'),
        userAgent: undefined,
        referrer: undefined
      };
      return;
    }

    if (/^#EXTVLCOPT:/i.test(line) && pending) {
      const option = line.slice('#EXTVLCOPT:'.length);
      const [key, ...rest] = option.split('=');
      const value = rest.join('=').trim();
      if (/^http-user-agent$/i.test(key.trim())) pending.userAgent = value;
      if (/^http-referr?er$/i.test(key.trim())) pending.referrer = value;
      return;
    }

    if (line.startsWith('#')) return;

    if (pending && /^(https?|rtmp|rtsp):\/\//i.test(line)) {
      const key = pending.name.toLowerCase();
      const stream = { url: line, quality: 'HD', online: true, userAgent: pending.userAgent, referrer: pending.referrer };
      const existing = byName.get(key);
      if (existing) {
        if (!existing.streams.some((s) => s.url === line)) existing.streams.push(stream);
      } else if (byName.size < MAX_CHANNELS_PER_PLAYLIST) {
        byName.set(key, {
          id: `${prefix}-${hashString(key)}`,
          name: pending.name,
          logo: pending.logo,
          group: pending.group,
          tvgId: pending.tvgId || undefined,
          country: '',
          countryName: pending.group || 'My Playlists',
          flag: '📋',
          categories: ['my_playlists'],
          bestQuality: 'HD',
          playlistUrl: sourceUrl,
          streams: [stream]
        });
      }
    }
    pending = null;
  });

  return [...byName.values()];
}

export function isValidPlaylistUrl(url) {
  return /^https?:\/\/\S+$/i.test(String(url || '').trim());
}

async function fetchText(url) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  try {
    const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) throw new Error(`the server answered ${response.status}`);
    return await response.text();
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('the address did not answer in time');
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class PlaylistService {
  constructor() {
    this.catalog = null;
  }

  /** The catalog service the channels are merged into (set once at start-up). */
  attach(catalog) {
    this.catalog = catalog;
  }

  /**
   * Download and parse one playlist.
   * @returns {Promise<Array>} its channels; rejects with a readable reason
   */
  async download(url) {
    const text = await fetchText(url);
    const channels = parsePlaylist(text, url);
    if (channels.length === 0) throw new Error('no channels were found at that address (is it an M3U playlist?)');
    return channels;
  }

  /**
   * Add a playlist: it must download and contain channels before it is saved.
   * @returns {Promise<{ok: boolean, count?: number, error?: string}>}
   */
  async add(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!isValidPlaylistUrl(url)) return { ok: false, error: 'Enter a full address starting with http:// or https://' };
    if (storageService.getCustomPlaylists().includes(url)) return { ok: false, error: 'This playlist is already added.' };
    try {
      const channels = await this.download(url);
      storageService.addCustomPlaylist(url);
      await kvStore.set(`playlist:${url}`, channels);
      if (this.catalog) this.catalog.setPlaylistChannels(url, channels);
      return { ok: true, count: channels.length };
    } catch (error) {
      return { ok: false, error: `Could not load the playlist: ${(error && error.message) || 'unknown error'}.` };
    }
  }

  async remove(url) {
    storageService.removeCustomPlaylist(url);
    await kvStore.set(`playlist:${url}`, null);
    if (this.catalog) this.catalog.removePlaylistChannels(url);
  }

  /**
   * Load every saved playlist: cached channels appear at once, then each is refreshed.
   * @returns {Promise<Array<{url: string, count: number, stale: boolean, error?: string}>>}
   */
  async loadAll() {
    const results = [];
    for (const url of storageService.getCustomPlaylists()) {
      let cached = null;
      try {
        cached = await kvStore.get(`playlist:${url}`);
        if (cached && cached.length > 0 && this.catalog) this.catalog.setPlaylistChannels(url, cached);
      } catch (e) {}
      try {
        const channels = await this.download(url);
        await kvStore.set(`playlist:${url}`, channels);
        if (this.catalog) this.catalog.setPlaylistChannels(url, channels);
        results.push({ url, count: channels.length, stale: false });
      } catch (error) {
        console.warn('[playlists] refresh failed for', url, error && error.message);
        results.push({ url, count: cached ? cached.length : 0, stale: true, error: (error && error.message) || 'failed' });
      }
    }
    return results;
  }
}

export const playlistService = new PlaylistService();
