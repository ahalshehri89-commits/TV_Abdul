import { describe, it, expect, afterEach, vi } from 'vitest';
import { vodService, sanitizeCatalog, formatDuration, VOD_CATEGORIES } from '../src/services/vodService.js';

const remoteItems = [
  { id: 'yt-aaa', category: 'cinema', title: 'Film A', titleAr: 'فيلم أ', youtubeId: 'aaa', channel: 'Rotana Cinema', duration: 5400 },
  { id: 'ytl-bbb', category: 'drama', title: 'Series B', youtubePlaylistId: 'PLbbb', count: 30, channel: 'MBC Drama' },
  { id: 'ia-ccc', category: 'classics', title: 'The Kid', url: 'https://archive.org/download/x/x.mp4', year: 1921 }
];

describe('VODService', () => {
  afterEach(() => {
    vodService.remote = [];
    vodService.rebuild();
    vi.restoreAllMocks();
    delete global.fetch;
  });

  it('offers the expected categories', () => {
    const ids = VOD_CATEGORIES.map((c) => c.id);
    ['all', 'featured', 'plays', 'cinema', 'drama', 'documentary', 'kids', 'classics'].forEach((id) => expect(ids).toContain(id));
  });

  it('ships a featured shelf with no placeholder video links', () => {
    const featured = vodService.getItems({ category: 'featured' });
    expect(featured.length).toBeGreaterThanOrEqual(15);
    featured.forEach((item) => {
      expect(item.streamUrl).toBeUndefined();
      expect(Boolean(item.youtubeId || item.youtubePlaylistId || item.url)).toBe(true);
    });
    expect(vodService.getItemById('play-madrasat-al-mushaghbeen').youtubeId).toBe('-xieo900Smg');
  });

  it('merges the downloaded catalog after the featured shelf', () => {
    const before = vodService.getCount();
    expect(vodService.applyCatalog({ generatedAt: '2026-11-12', items: remoteItems })).toBe(true);
    expect(vodService.getCount()).toBe(before + 3);
    expect(vodService.getItems({ category: 'classics' }).map((i) => i.id)).toContain('ia-ccc');
    expect(vodService.getItems()[0].featured).toBe(true);
  });

  it('does not repeat a featured title that also appears in the downloaded catalog', () => {
    const before = vodService.getCount();
    vodService.applyCatalog({ items: [{ id: 'yt-dup', category: 'plays', title: 'Dup', youtubeId: '-xieo900Smg' }, remoteItems[0]] });
    expect(vodService.getCount()).toBe(before + 1);
  });

  it('searches titles in both languages and by source channel', () => {
    vodService.applyCatalog({ items: remoteItems });
    expect(vodService.getItems({ q: 'film a' }).map((i) => i.id)).toEqual(['yt-aaa']);
    expect(vodService.getItems({ q: 'فيلم' }).map((i) => i.id)).toContain('yt-aaa');
    expect(vodService.getItems({ q: 'mbc' }).map((i) => i.id)).toEqual(['ytl-bbb']);
  });

  it('drops malformed, duplicate and unknown-category rows', () => {
    const clean = sanitizeCatalog([
      remoteItems[0],
      remoteItems[0],
      { id: 'no-source', category: 'cinema', title: 'x' },
      { id: 'bad-cat', category: 'nope', title: 'x', youtubeId: 'z' },
      { category: 'cinema', title: 'no id', youtubeId: 'z' },
      null
    ]);
    expect(clean).toEqual([remoteItems[0]]);
    expect(sanitizeCatalog('nonsense')).toEqual([]);
  });

  it('keeps the current catalog when a download fails or is empty', async () => {
    vodService.applyCatalog({ items: remoteItems });
    const count = vodService.getCount();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    await vodService.load({ force: true });
    expect(vodService.getCount()).toBe(count);
    expect(vodService.applyCatalog({ items: [] })).toBe(false);
    expect(vodService.getCount()).toBe(count);
  });

  it('downloads and applies the catalog', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: remoteItems }) });
    await vodService.load({ force: true });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/catalog.json'), expect.anything());
    expect(vodService.getItemById('ia-ccc')).not.toBeNull();
  });

  it('formats durations given in seconds', () => {
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(1500)).toBe('25m');
    expect(formatDuration('3h 45m')).toBe('3h 45m');
    expect(formatDuration(undefined)).toBe('');
  });
});
