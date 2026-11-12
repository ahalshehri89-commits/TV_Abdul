/**
 * TV_Abdul: CatalogService
 * Manages channel discovery, search, categorization, live sync, and multi-stream resolution.
 */

import seedChannels from '../data/seedChannels.json';
import rawCategories from '../data/categories.json';
import fastChannels from '../data/fastChannels.json';
import { storageService } from './storageService.js';
import { channelSyncService } from './channelSyncService.js';

export const PRIMARY_CATEGORIES = [
  { id: 'all', name: 'All Channels' },
  { id: 'arabic', name: 'Arabic' },
  { id: 'fast', name: 'FAST Networks 24/7' },
  { id: 'favorites', name: 'Favorites' },
  { id: 'my_playlists', name: 'My Playlists' },
  { id: 'recent', name: 'Recently Watched' },
  { id: 'news', name: 'News' },
  { id: 'sports', name: 'Sports' },
  { id: 'movies', name: 'Movies' },
  { id: 'entertainment', name: 'Entertainment' },
  { id: 'documentary', name: 'Documentaries' },
  { id: 'kids', name: 'Kids' },
  { id: 'music', name: 'Music' },
  { id: 'auto', name: 'Auto' },
  { id: 'general', name: 'General' }
];

class CatalogService {
  constructor() {
    this.seedMap = new Map();
    seedChannels.forEach((ch) => {
      this.seedMap.set(ch.id, ch);
    });
    fastChannels.forEach((ch) => {
      this.seedMap.set(ch.id, ch);
    });
    this.apiEndpoint = storageService.getSettings().apiEndpoint || 'https://freetv.fuckyouthisismywebsite.com';
    this.dynamicCache = new Map();
    this.listeners = new Set();
    this.playlistChannelIds = new Map(); // playlist address -> ids of the channels it added
    this.loadCachedData();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, payload) {
    this.listeners.forEach((fn) => {
      try {
        fn(event, payload);
      } catch (e) {}
    });
  }

  /**
   * Load any newer cached channels from previous background syncs
   */
  async loadCachedData() {
    try {
      const cached = await channelSyncService.loadCachedChannels();
      if (cached && cached.length > 0) {
        cached.forEach((ch) => {
          const existing = this.seedMap.get(ch.id);
          if (existing) {
            this.seedMap.set(ch.id, { ...existing, ...ch });
          } else {
            this.seedMap.set(ch.id, { ...ch, number: this.seedMap.size + 1 });
          }
        });
        console.log(`Loaded ${cached.length} cached channels from storage.`);
        this.notify('catalogUpdated', { total: this.seedMap.size });
      }
    } catch (e) {
      console.warn('Failed to load cached channels:', e);
    }
  }

  /**
   * Sync with Cloud CDN (IPTV-org)
   */
  async syncCloud({ force = false, onProgress = null } = {}) {
    const result = await channelSyncService.sync({ force, onProgress });
    if (result.status === 'success' && result.channels) {
      result.channels.forEach((ch) => {
        const existing = this.seedMap.get(ch.id);
        if (existing) {
          this.seedMap.set(ch.id, { ...existing, ...ch });
        } else {
          this.seedMap.set(ch.id, { ...ch, number: this.seedMap.size + 1 });
        }
      });
      this.notify('catalogUpdated', { total: this.seedMap.size });
    }
    return result;
  }

  /**
   * Start non-blocking background sync 5 seconds after TV boot
   */
  startBackgroundSync() {
    setTimeout(() => {
      this.syncCloud({ force: false }).catch(() => {});
    }, 5000);
  }

  /**
   * Replace the channels contributed by one user playlist.
   */
  setPlaylistChannels(url, channels) {
    this.removePlaylistChannels(url, { silent: true });
    const ids = [];
    channels.forEach((ch) => {
      this.seedMap.set(ch.id, { ...ch, number: this.seedMap.size + 1 });
      ids.push(ch.id);
    });
    this.playlistChannelIds.set(url, ids);
    this.notify('catalogUpdated', { total: this.seedMap.size, source: 'playlist' });
  }

  removePlaylistChannels(url, { silent = false } = {}) {
    const ids = this.playlistChannelIds.get(url) || [];
    ids.forEach((id) => this.seedMap.delete(id));
    this.playlistChannelIds.delete(url);
    if (!silent && ids.length > 0) this.notify('catalogUpdated', { total: this.seedMap.size, source: 'playlist' });
  }

  getPlaylistChannelCount(url) {
    return (this.playlistChannelIds.get(url) || []).length;
  }

  getCategories() {
    return PRIMARY_CATEGORIES;
  }

  /**
   * Return unique countries represented in catalog sorted by channel frequency
   */
  getCountries() {
    const map = new Map();
    this.seedMap.forEach((ch) => {
      if (ch.country && ch.countryName) {
        if (!map.has(ch.country)) {
          map.set(ch.country, {
            code: ch.country,
            name: ch.countryName,
            flag: ch.flag || '🌐',
            count: 0
          });
        }
        map.get(ch.country).count++;
      }
    });
    return [
      { code: 'all', name: 'All Countries', flag: '🌐', count: this.seedMap.size },
      ...Array.from(map.values()).sort((a, b) => b.count - a.count)
    ];
  }

  /**
   * Filter local seed channels synchronously (instant TV boot)
   */
  getSeedChannels(filter = {}) {
    const { category, country, q, favorites, recent } = filter;
    let list = Array.from(this.seedMap.values());

    if (favorites || category === 'favorites') {
      const favIds = new Set(storageService.getFavorites().map(String));
      list = list.filter((ch) => favIds.has(String(ch.id)));
    } else if (recent || category === 'recent') {
      const recentList = storageService.getRecentChannels();
      const recentIds = recentList.map((item) => String(typeof item === 'string' ? item : item.id));
      list = recentIds
        .map((id) => this.seedMap.get(id) || recentList.find((r) => String(r.id) === id))
        .filter(Boolean);
    } else if (category === 'arabic') {
      const arabicCodes = new Set(['SA', 'AE', 'EG', 'LB', 'QA', 'KW', 'OM', 'BH', 'JO', 'IQ', 'SY', 'PS', 'YE', 'MA', 'DZ', 'TN', 'SD', 'LY']);
      list = list.filter((ch) => arabicCodes.has(ch.country) || (ch.categories && ch.categories.includes('arabic')));
    } else if (category && category !== 'all') {
      list = list.filter((ch) => ch.categories && ch.categories.includes(category));
    }

    if (country && country !== 'all' && category !== 'favorites' && category !== 'recent' && category !== 'fast') {
      list = list.filter(
        (ch) =>
          ch.country?.toUpperCase() === country.toUpperCase() ||
          ch.countryName?.toLowerCase() === country.toLowerCase()
      );
    }

    if (q && q.trim()) {
      const query = q.trim().toLowerCase();
      list = list.filter((ch) => {
        return (
          ch.name.toLowerCase().includes(query) ||
          (ch.countryName && ch.countryName.toLowerCase().includes(query)) ||
          String(ch.number) === query
        );
      });
    }

    return list;
  }

  /**
   * Fetch channels instantly from local memory database (0ms latency for smooth TV UX)
   */
  getChannels({ category = 'all', country = 'all', q = '', page = 1, limit = null } = {}) {
    const local = this.getSeedChannels({ category, country, q });
    const items = limit ? local.slice((page - 1) * limit, page * limit) : local;
    return {
      items,
      total: local.length,
      page,
      source: 'local'
    };
  }

  /**
   * Get full stream records for playback, attempting live fetch if needed
   */
  async getChannelDetails(channelId) {
    // 1. Check local seed map
    const seed = this.seedMap.get(channelId);
    if (seed && seed.streams && seed.streams.length > 0) {
      return seed;
    }

    // 2. Fetch details from API
    try {
      const response = await fetch(`${this.apiEndpoint}/api/channels/${encodeURIComponent(channelId)}`, {
        signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined
      });
      if (response.ok) {
        const detail = await response.json();
        const mapped = {
          id: detail.id,
          number: detail.number,
          name: detail.name,
          country: detail.country,
          countryName: detail.countryName,
          flag: detail.flag || '📺',
          categories: (detail.categories || []).map((c) => (typeof c === 'object' ? c.id : c)),
          logo: `${this.apiEndpoint}/logo/${detail.id}`,
          bestQuality: (detail.streams && detail.streams[0] && detail.streams[0].quality) || '720p',
          streams: (detail.streams || []).map((s, idx) => ({
            index: s.index ?? idx,
            url: s.url,
            title: s.title || detail.name,
            quality: s.quality || '720p',
            online: s.online ?? true,
            userAgent: s.userAgent,
            referrer: s.referrer
          }))
        };
        this.seedMap.set(channelId, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Failed to fetch channel details:', e);
    }

    return seed || null;
  }
}

export const catalogService = new CatalogService();
