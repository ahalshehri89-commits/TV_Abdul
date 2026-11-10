/**
 * TV_Abdul v2.0: VODService
 * Manages Free Movies & Series Hub (VOD) catalog, resume playback history, and categories.
 */

import seedVOD from '../data/seedVOD.json';

const STORAGE_KEYS = {
  VOD_HISTORY: 'freetv:vod_history',
  VOD_BOOKMARKS: 'freetv:vod_bookmarks'
};

export const VOD_CATEGORIES = [
  { id: 'all', name: 'All VOD', nameAr: 'كل المحتوى' },
  { id: 'playlists', name: 'YouTube Playlists & Collections', nameAr: 'قوائم تشغيل يوتيوب كاملة' },
  { id: 'plays', name: 'Classic Plays', nameAr: 'مسرحيات كلاسيكية' },
  { id: 'cinema', name: 'Egyptian Cinema', nameAr: 'السينما المصرية الذهبية' },
  { id: 'drama', name: 'Ramadan & Historical Series', nameAr: 'مسلسلات ودراما تاريخية' },
  { id: 'classics', name: 'World Cinema Classics', nameAr: 'كلاسيكيات السينما العالمية' }
];

class VODService {
  constructor() {
    this.vodList = seedVOD;
    this.vodMap = new Map();
    this.vodList.forEach((item) => {
      this.vodMap.set(item.id, item);
    });
  }

  getCategories() {
    return VOD_CATEGORIES;
  }

  getItems(filter = {}) {
    const { category, type, q } = filter;
    let list = this.vodList;

    if (category && category !== 'all') {
      list = list.filter((item) => item.category === category || item.categories?.includes(category));
    }

    if (type) {
      list = list.filter((item) => item.type === type);
    }

    if (q) {
      const lower = q.toLowerCase();
      list = list.filter(
        (item) =>
          item.title?.toLowerCase().includes(lower) ||
          item.titleAr?.includes(q) ||
          item.cast?.some((actor) => actor.includes(q))
      );
    }

    return list;
  }

  getItemById(id) {
    return this.vodMap.get(id) || null;
  }

  getResumePosition(id) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VOD_HISTORY);
      if (!data) return 0;
      const history = JSON.parse(data);
      return history[id] ? history[id].position || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  saveResumePosition(id, position, duration = 0) {
    if (!id || position <= 0) return;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VOD_HISTORY);
      const history = data ? JSON.parse(data) : {};
      history[id] = {
        position,
        duration,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.VOD_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save VOD resume position:', e);
    }
  }
}

export const vodService = new VODService();
