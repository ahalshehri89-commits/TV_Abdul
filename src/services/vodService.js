/**
 * TV_Abdul: VODService
 * The on-demand catalog: a hand-picked featured shelf bundled with the app, plus the large
 * catalog built daily from approved YouTube owner channels and Internet Archive
 * (see scripts/catalog/). The large catalog is downloaded, cached and refreshed in the background.
 *
 * Item shape:
 *   { id, category, title, titleAr?, poster, duration?, channel?, year?,
 *     youtubeId? | youtubePlaylistId? (+ count) | url? (direct file), featured? }
 */

import seedVOD from '../data/seedVOD.json';
import { DATA_BASE_URL } from '../config.js';
import { kvStore, fetchJson } from './kvStore.js';

const CACHE_KEY = 'vod_catalog_v1';
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

export const VOD_CATEGORIES = [
  { id: 'all', name: 'All', nameAr: 'كل المحتوى' },
  { id: 'featured', name: 'Featured', nameAr: 'مختارات مميزة' },
  { id: 'plays', name: 'Plays', nameAr: 'مسرحيات' },
  { id: 'cinema', name: 'Arabic Cinema', nameAr: 'أفلام عربية' },
  { id: 'drama', name: 'Series', nameAr: 'مسلسلات' },
  { id: 'documentary', name: 'Documentaries', nameAr: 'وثائقيات' },
  { id: 'kids', name: 'Kids', nameAr: 'أطفال' },
  { id: 'classics', name: 'World Classics', nameAr: 'كلاسيكيات عالمية' }
];

const KNOWN_CATEGORIES = new Set(VOD_CATEGORIES.map((c) => c.id));

/** Keep only well-formed catalog entries; a bad row must never break the screen. */
export function sanitizeCatalog(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.filter((item) => {
    if (!item || typeof item.id !== 'string' || !item.title || seen.has(item.id)) return false;
    if (!item.youtubeId && !item.youtubePlaylistId && !item.url) return false;
    if (!KNOWN_CATEGORIES.has(item.category)) return false;
    seen.add(item.id);
    return true;
  });
}

export function formatDuration(value) {
  if (typeof value !== 'number') return value || '';
  const hours = Math.floor(value / 3600);
  const minutes = Math.round((value % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
}

class VODService {
  constructor() {
    this.featured = seedVOD;
    this.remote = [];
    this.updatedAt = null;
    this.listeners = new Set();
    this.loading = null;
    this.rebuild();
  }

  rebuild() {
    const featuredKeys = new Set();
    this.featured.forEach((item) => {
      if (item.youtubeId) featuredKeys.add(item.youtubeId);
      if (item.youtubePlaylistId) featuredKeys.add(item.youtubePlaylistId);
    });
    // A title already on the featured shelf is not repeated from the big catalog.
    const extra = this.remote.filter(
      (item) => !featuredKeys.has(item.youtubeId) && !featuredKeys.has(item.youtubePlaylistId)
    );
    this.vodList = [...this.featured, ...extra];
    this.vodMap = new Map(this.vodList.map((item) => [item.id, item]));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {}
    });
  }

  applyCatalog(payload) {
    const items = sanitizeCatalog(payload && payload.items);
    if (items.length === 0) return false;
    this.remote = items;
    this.updatedAt = (payload && payload.generatedAt) || null;
    this.rebuild();
    this.notify();
    return true;
  }

  /**
   * Load the large catalog: cached copy first (instant), then a network refresh when stale.
   * Safe to call repeatedly; failures leave the current catalog in place.
   */
  load({ force = false } = {}) {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      let cached = null;
      try {
        cached = await kvStore.get(CACHE_KEY);
        if (cached && cached.payload && this.remote.length === 0) this.applyCatalog(cached.payload);
      } catch (e) {}

      const fresh = cached && Date.now() - cached.fetchedAt < REFRESH_AFTER_MS;
      if (fresh && !force) return;
      try {
        const payload = await fetchJson(`${DATA_BASE_URL}/catalog.json`);
        if (this.applyCatalog(payload)) {
          await kvStore.set(CACHE_KEY, { fetchedAt: Date.now(), payload });
          console.log(`[vod] catalog loaded: ${this.remote.length} titles`);
        }
      } catch (e) {
        console.warn('[vod] catalog download failed:', e && e.message);
      }
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  getCategories() {
    return VOD_CATEGORIES;
  }

  getCount() {
    return this.vodList.length;
  }

  getItems(filter = {}) {
    const { category, type, q } = filter;
    let list = this.vodList;

    if (category === 'featured') {
      list = list.filter((item) => item.featured);
    } else if (category && category !== 'all') {
      list = list.filter((item) => item.category === category || item.categories?.includes(category));
    }

    if (type) {
      list = list.filter((item) => item.type === type);
    }

    if (q && q.trim()) {
      const raw = q.trim();
      const lower = raw.toLowerCase();
      list = list.filter(
        (item) =>
          item.title?.toLowerCase().includes(lower) ||
          item.titleAr?.includes(raw) ||
          item.channel?.toLowerCase().includes(lower) ||
          item.cast?.some((actor) => actor.includes(raw))
      );
    }

    return list;
  }

  getItemById(id) {
    return this.vodMap.get(id) || null;
  }
}

export const vodService = new VODService();
