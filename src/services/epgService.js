/**
 * TV_Abdul: EPGService
 * Real programme guide. Schedules are built daily from public XMLTV feeds
 * (see scripts/epg/) and downloaded by the TV. A channel without real data has no guide:
 * nothing is ever generated or guessed.
 *
 * Downloaded shape: { generatedAt, channels: { [channelId]: [[startSec, stopSec, title], ...] } }
 */

import { DATA_BASE_URL } from '../config.js';
import { kvStore, fetchJson } from './kvStore.js';

const CACHE_KEY = 'epg_v1';
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

const timeLabel = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

class EPGService {
  constructor() {
    this.channels = {};
    this.generatedAt = null;
    this.listeners = new Set();
    this.loading = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  applyGuide(payload) {
    if (!payload || typeof payload.channels !== 'object' || payload.channels === null) return false;
    if (Object.keys(payload.channels).length === 0) return false;
    this.channels = payload.channels;
    this.generatedAt = payload.generatedAt || null;
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {}
    });
    return true;
  }

  /** Load the guide: cached copy first, then a network refresh when stale. */
  load({ force = false } = {}) {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      let cached = null;
      try {
        cached = await kvStore.get(CACHE_KEY);
        if (cached && cached.payload && Object.keys(this.channels).length === 0) this.applyGuide(cached.payload);
      } catch (e) {}
      if (!force && cached && Date.now() - cached.fetchedAt < REFRESH_AFTER_MS) return;
      try {
        const payload = await fetchJson(`${DATA_BASE_URL}/epg.json`);
        if (this.applyGuide(payload)) await kvStore.set(CACHE_KEY, { fetchedAt: Date.now(), payload });
      } catch (e) {
        console.warn('[epg] guide download failed:', e && e.message);
      }
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /** True when the channel has at least one programme that has not ended yet. */
  hasGuide(channelId, now = new Date()) {
    const rows = this.channels[channelId];
    if (!rows) return false;
    const nowSec = now.getTime() / 1000;
    return rows.some((row) => row[1] > nowSec);
  }

  /**
   * The channel's programmes from the one on air now onwards. Empty when there is no data.
   */
  getChannelSchedule(channelId, now = new Date()) {
    const rows = this.channels[channelId] || [];
    const nowSec = now.getTime() / 1000;
    return rows
      .filter((row) => row[1] > nowSec)
      .map(([start, stop, title]) => {
        const startTime = new Date(start * 1000);
        const endTime = new Date(stop * 1000);
        return {
          id: `${channelId}-${start}`,
          title,
          startTime,
          endTime,
          startTimeStr: timeLabel(startTime),
          endTimeStr: timeLabel(endTime),
          durationMinutes: Math.round((stop - start) / 60)
        };
      });
  }

  /**
   * @returns {{current, next, progressPercent}|null} null when nothing is known to be on air
   */
  getNowPlaying(channelId, now = new Date()) {
    const schedule = this.getChannelSchedule(channelId, now);
    const nowMs = now.getTime();
    const index = schedule.findIndex((p) => nowMs >= p.startTime.getTime() && nowMs < p.endTime.getTime());
    if (index === -1) return null;
    const current = schedule[index];
    const total = current.endTime.getTime() - current.startTime.getTime();
    return {
      current,
      next: schedule[index + 1] || null,
      progressPercent: Math.min(100, Math.max(0, Math.round(((nowMs - current.startTime.getTime()) / total) * 100)))
    };
  }
}

export const epgService = new EPGService();
