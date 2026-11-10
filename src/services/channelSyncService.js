/**
 * TV_Abdul: ChannelSyncService
 * Background automatic cloud sync for live channels and streaming sources from IPTV-org CDN.
 * Persists cached channels to IndexedDB / localStorage for instant 0ms offline boot.
 */

const SYNC_SOURCES = [
  { id: 'arabic', name: 'Arabic', url: 'https://iptv-org.github.io/iptv/languages/ara.m3u' },
  { id: 'sports', name: 'Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', category: 'sports' },
  { id: 'movies', name: 'Movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u', category: 'movies' },
  { id: 'news', name: 'News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u', category: 'news' },
  { id: 'us', name: 'United States', url: 'https://iptv-org.github.io/iptv/countries/us.m3u', country: 'US' }
];

const DB_NAME = 'TV_Abdul_Cache';
const STORE_NAME = 'catalog';
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

class ChannelSyncService {
  constructor() {
    this.isSyncing = false;
    this.listeners = new Set();
    this.memoryTimestamp = 0;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    this.listeners.forEach((fn) => {
      try {
        fn(event, data);
      } catch (e) {}
    });
  }

  /**
   * Fast M3U text parser
   */
  parseM3u(text, defaultCategory = null, defaultCountry = null) {
    const lines = text.split('\n');
    const items = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF')) {
        const url = lines[i + 1]?.trim();
        if (!url || url.startsWith('#')) continue;

        const tvgId = line.match(/tvg-id="([^"]+)"/)?.[1] || '';
        const tvgLogo = line.match(/tvg-logo="([^"]+)"/)?.[1] || '';
        const groupTitle = line.match(/group-title="([^"]+)"/)?.[1] || defaultCategory || 'General';
        const rawName = line.split(',').slice(1).join(',').trim();

        let quality = 'HD';
        const qMatch = rawName.match(/\((1080p|720p|576p|4k|2160p|480p|360p)\)/i);
        if (qMatch) quality = qMatch[1].toLowerCase();

        const cleanName = rawName
          .replace(/\((1080p|720p|576p|4k|2160p|480p|360p)\)/gi, '')
          .replace(/\[Not 24\/7\]/gi, '')
          .replace(/\[Geo-blocked\]/gi, '')
          .replace(/@\w+/g, '')
          .trim();

        let countryCode = defaultCountry;
        const dotCountryMatch = tvgId.match(/\.([a-z]{2})(@|$)/i);
        if (dotCountryMatch) {
          countryCode = dotCountryMatch[1].toUpperCase();
        }

        const normId = tvgId ? tvgId.replace(/@\w+$/, '') : cleanName.replace(/[^a-zA-Z0-9]/g, '_');

        items.push({
          id: normId,
          name: cleanName,
          country: countryCode || 'US',
          categories: [defaultCategory || 'general'],
          logo: tvgLogo || null,
          quality,
          url
        });
      }
    }

    return items;
  }

  /**
   * Open IndexedDB storage
   */
  async openDB() {
    if (typeof window === 'undefined' || !window.indexedDB) return null;

    return new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * Load previously synced channels from cache
   */
  async loadCachedChannels() {
    const db = await this.openDB();
    if (!db) {
      // Fallback to localStorage if any
      try {
        const raw = localStorage.getItem('tv_abdul_synced_channels');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * Save updated channels to cache
   */
  async saveCachedChannels(channels) {
    const db = await this.openDB();
    if (!db) {
      try {
        // Save first 300 essential updates to localStorage to stay within quota
        const subset = channels.slice(0, 300);
        localStorage.setItem('tv_abdul_synced_channels', JSON.stringify(subset));
      } catch (e) {}
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        channels.forEach((ch) => store.put(ch));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  getLastSyncTime() {
    try {
      if (typeof localStorage !== 'undefined') {
        const ts = localStorage.getItem('tv_abdul_last_sync_timestamp');
        if (ts) return parseInt(ts, 10);
      }
    } catch (e) {}
    return this.memoryTimestamp || 0;
  }

  setLastSyncTime(ts) {
    this.memoryTimestamp = ts;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tv_abdul_last_sync_timestamp', String(ts));
      }
    } catch (e) {}
  }

  /**
   * Execute Cloud Sync across IPTV-org feeds
   */
  async sync({ force = false, onProgress = null } = {}) {
    if (this.isSyncing) return { status: 'already_syncing' };

    const lastSync = this.getLastSyncTime();
    const now = Date.now();

    if (!force && now - lastSync < SYNC_INTERVAL_MS) {
      console.log('ℹ Cloud catalog sync was run recently; skipping background sync.');
      return { status: 'skipped', lastSync };
    }

    this.isSyncing = true;
    this.notify('syncStart');

    try {
      console.log('🌐 Starting automatic cloud sync from IPTV-org...');
      const updatedChannelMap = new Map();

      for (let sIdx = 0; sIdx < SYNC_SOURCES.length; sIdx++) {
        const src = SYNC_SOURCES[sIdx];
        if (onProgress) {
          onProgress(`Syncing ${src.name} channels (${sIdx + 1}/${SYNC_SOURCES.length})...`);
        }

        try {
          const res = await fetch(src.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0)' },
            signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
          });

          if (res.ok) {
            const text = await res.text();
            const parsed = this.parseM3u(text, src.category, src.country);

            parsed.forEach((item) => {
              if (!updatedChannelMap.has(item.id)) {
                updatedChannelMap.set(item.id, {
                  id: item.id,
                  name: item.name,
                  country: item.country,
                  categories: item.categories,
                  logo: item.logo,
                  bestQuality: item.quality,
                  streams: [{ url: item.url, quality: item.quality, online: true }]
                });
              } else {
                const existing = updatedChannelMap.get(item.id);
                if (!existing.streams.some((s) => s.url === item.url)) {
                  existing.streams.push({ url: item.url, quality: item.quality, online: true });
                }
              }
            });
          }
        } catch (fetchErr) {
          console.warn(`Failed to sync source ${src.id}:`, fetchErr.message);
        }
      }

      const updatedList = Array.from(updatedChannelMap.values());
      if (updatedList.length > 0) {
        await this.saveCachedChannels(updatedList);
        this.setLastSyncTime(now);
        this.notify('syncComplete', { count: updatedList.length, channels: updatedList });
        console.log(`✔ Cloud sync complete! Updated ${updatedList.length} channels.`);
        return { status: 'success', count: updatedList.length, channels: updatedList };
      }

      return { status: 'no_updates' };
    } catch (e) {
      console.error('Cloud sync error:', e);
      this.notify('syncError', { error: e.message });
      return { status: 'error', error: e.message };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const channelSyncService = new ChannelSyncService();
