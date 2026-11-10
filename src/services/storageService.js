/**
 * TV_Abdul: StorageService
 * Robust localStorage persistence for TV favorites, history, and preferences.
 */

const STORAGE_KEYS = {
  FAVORITES: 'freetv:favorites',
  RECENT: 'freetv:recent',
  LAST_CHANNEL: 'freetv:last_channel',
  SETTINGS: 'freetv:settings',
  CUSTOM_PLAYLISTS: 'freetv:custom_playlists'
};

const DEFAULT_SETTINGS = {
  preferredQuality: 'auto', // 'auto', '1080p', '720p', 'lowest'
  autoPlayLastChannel: false,
  apiEndpoint: 'https://freetv.fuckyouthisismywebsite.com',
  osdTimeoutSeconds: 5
};

class StorageService {
  getFavorites() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to read favorites from localStorage:', e);
      return [];
    }
  }

  isFavorite(channelId) {
    const list = this.getFavorites();
    return list.includes(channelId);
  }

  toggleFavorite(channelId) {
    try {
      let list = this.getFavorites();
      if (list.includes(channelId)) {
        list = list.filter((id) => id !== channelId);
      } else {
        list.push(channelId);
      }
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(list));
      return list;
    } catch (e) {
      console.warn('Failed to save favorite:', e);
      return this.getFavorites();
    }
  }

  getRecentChannels() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECENT);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to read recent channels from localStorage:', e);
      return [];
    }
  }

  addRecentChannel(channel) {
    if (!channel || !channel.id) return;
    try {
      let list = this.getRecentChannels();
      // Remove if already exists so it moves to front
      list = list.filter((item) => (typeof item === 'string' ? item !== channel.id : item.id !== channel.id));
      // Store minimal summary
      list.unshift({
        id: channel.id,
        number: channel.number,
        name: channel.name,
        logo: channel.logo,
        country: channel.country,
        flag: channel.flag,
        timestamp: Date.now()
      });
      // Cap at 30 items
      if (list.length > 30) list = list.slice(0, 30);
      localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save recent channel:', e);
    }
  }

  getLastChannelId() {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_CHANNEL);
    } catch (e) {
      return null;
    }
  }

  setLastChannelId(channelId) {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_CHANNEL, channelId);
    } catch (e) {
      console.warn('Failed to save last channel id:', e);
    }
  }

  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(newSettings) {
    try {
      const merged = { ...this.getSettings(), ...newSettings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.warn('Failed to save settings:', e);
      return DEFAULT_SETTINGS;
    }
  }

  getCustomPlaylists() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_PLAYLISTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  addCustomPlaylist(url) {
    if (!url || typeof url !== 'string') return [];
    try {
      let list = this.getCustomPlaylists();
      if (!list.includes(url)) {
        list.push(url.trim());
        localStorage.setItem(STORAGE_KEYS.CUSTOM_PLAYLISTS, JSON.stringify(list));
      }
      return list;
    } catch (e) {
      console.warn('Failed to add custom playlist:', e);
      return this.getCustomPlaylists();
    }
  }

  removeCustomPlaylist(url) {
    try {
      let list = this.getCustomPlaylists();
      list = list.filter((item) => item !== url);
      localStorage.setItem(STORAGE_KEYS.CUSTOM_PLAYLISTS, JSON.stringify(list));
      return list;
    } catch (e) {
      return this.getCustomPlaylists();
    }
  }
}

export const storageService = new StorageService();
