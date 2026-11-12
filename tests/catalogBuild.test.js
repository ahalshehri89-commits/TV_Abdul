import { describe, it, expect } from 'vitest';
import { parseLength, pickVideoFile, toArchiveItem } from '../scripts/catalog/archive.js';
import { parseIsoDuration, toVideoItem, toPlaylistItem } from '../scripts/catalog/youtube.js';
import { mergeCatalog } from '../scripts/catalog/build-catalog.js';

describe('Internet Archive catalog', () => {
  it('parses lengths given as seconds or as a clock', () => {
    expect(parseLength('5712.4')).toBe(5712);
    expect(parseLength('1:35:12')).toBe(5712);
    expect(parseLength('45:00')).toBe(2700);
    expect(parseLength(undefined)).toBe(0);
    expect(parseLength('n/a')).toBe(0);
  });

  it('prefers the H.264 MP4 and ignores other formats', () => {
    const files = [
      { name: 'film.ogv', format: 'Ogg Video', size: '900' },
      { name: 'film_512kb.mp4', format: '512Kb MPEG4', size: '400', height: '240' },
      { name: 'film.mp4', format: 'h.264', size: '800', height: '480' },
      { name: 'film.avi', format: 'Cinepack', size: '2000' }
    ];
    expect(pickVideoFile(files).name).toBe('film.mp4');
    expect(pickVideoFile([{ name: 'film.ogv', format: 'Ogg Video', size: '1' }])).toBeNull();
    expect(pickVideoFile([])).toBeNull();
  });

  it('builds an entry for a feature film and rejects shorts', () => {
    const doc = { identifier: 'the_kid', title: 'The Kid', year: '1921' };
    const item = toArchiveItem(doc, [{ name: 'The Kid.mp4', format: 'h.264', size: '1000', length: '3600' }]);
    expect(item).toEqual({
      id: 'ia-the_kid',
      category: 'classics',
      title: 'The Kid',
      year: 1921,
      duration: 3600,
      channel: 'Internet Archive',
      poster: 'https://archive.org/services/img/the_kid',
      url: 'https://archive.org/download/the_kid/The%20Kid.mp4'
    });
    expect(toArchiveItem(doc, [{ name: 'short.mp4', format: 'h.264', size: '10', length: '600' }])).toBeNull();
  });

  it('leaves exploitation titles off the shelf', () => {
    const files = [{ name: 'a.mp4', format: 'h.264', size: '1000', length: '3600' }];
    expect(toArchiveItem({ identifier: 'x', title: 'Sex Madness' }, files)).toBeNull();
    expect(toArchiveItem({ identifier: 'y', title: 'Reefer Madness' }, files)).toBeNull();
    expect(toArchiveItem({ identifier: 'z', title: 'Sussex Nights' }, files)).not.toBeNull();
  });
});

describe('YouTube catalog', () => {
  const channel = { id: 'UCx', name: 'Rotana Cinema', videos: 'cinema', playlists: 'drama' };
  const video = (overrides = {}) => ({
    id: 'abc',
    snippet: { title: 'فيلم', thumbnails: { high: { url: 'h.jpg' } }, liveBroadcastContent: 'none' },
    contentDetails: { duration: 'PT1H30M' },
    status: { privacyStatus: 'public', embeddable: true },
    ...overrides
  });

  it('parses ISO durations', () => {
    expect(parseIsoDuration('PT1H32M5S')).toBe(5525);
    expect(parseIsoDuration('PT45S')).toBe(45);
    expect(parseIsoDuration('P1DT2H')).toBe(93600);
    expect(parseIsoDuration('')).toBe(0);
  });

  it('keeps long, public, embeddable videos only', () => {
    expect(toVideoItem(video(), channel)).toEqual({
      id: 'yt-abc',
      category: 'cinema',
      title: 'فيلم',
      duration: 5400,
      channel: 'Rotana Cinema',
      poster: 'h.jpg',
      youtubeId: 'abc'
    });
    expect(toVideoItem(video({ contentDetails: { duration: 'PT5M' } }), channel)).toBeNull();
    expect(toVideoItem(video({ status: { privacyStatus: 'public', embeddable: false } }), channel)).toBeNull();
    expect(toVideoItem(video({ status: { privacyStatus: 'private' } }), channel)).toBeNull();
  });

  it('drops promos and single episodes, and files titles by their wording', () => {
    const titled = (title) => video({ snippet: { title, thumbnails: {}, liveBroadcastContent: 'none' } });
    expect(toVideoItem(titled('برومو فيلم جديد'), channel)).toBeNull();
    expect(toVideoItem(titled('مسلسل الأيام الحلقة 3'), channel)).toBeNull();
    expect(toVideoItem(titled('مسرحية العيال كبرت'), channel).category).toBe('plays');
    const docs = { id: 'UCd', name: 'DW', videos: 'documentary', playlists: null };
    expect(toVideoItem(titled('رحلة النيل | الحلقة الثانية'), docs)).not.toBeNull();
  });

  it('keeps playlists with at least three items as series', () => {
    const playlist = { id: 'PL1', snippet: { title: 'مسلسل', thumbnails: {} }, contentDetails: { itemCount: 30 } };
    expect(toPlaylistItem(playlist, channel)).toMatchObject({ id: 'ytl-PL1', category: 'drama', count: 30, youtubePlaylistId: 'PL1' });
    expect(toPlaylistItem({ ...playlist, contentDetails: { itemCount: 2 } }, channel)).toBeNull();
  });
});

describe('catalog merge', () => {
  const ia = { id: 'ia-1', url: 'u', channel: 'Internet Archive' };
  const ytA = { id: 'yt-a', youtubeId: 'a', channel: 'A' };
  const ytB = { id: 'yt-b', youtubeId: 'b', channel: 'B' };

  it('keeps previous YouTube entries when no key is configured', () => {
    expect(mergeCatalog({ previous: [ytA, ia], archive: [ia], youtube: null }).map((i) => i.id)).toEqual(['yt-a', 'ia-1']);
  });

  it('keeps a failed channel from the previous run and replaces the rest', () => {
    const fresh = { id: 'yt-a2', youtubeId: 'a2', channel: 'A' };
    const merged = mergeCatalog({ previous: [ytA, ytB], archive: [ia], youtube: [fresh], failedChannels: ['B'] });
    expect(merged.map((i) => i.id)).toEqual(['yt-a2', 'yt-b', 'ia-1']);
  });

  it('keeps previous archive entries when the archive source returns nothing', () => {
    expect(mergeCatalog({ previous: [ia], archive: [], youtube: [ytA] }).map((i) => i.id)).toEqual(['yt-a', 'ia-1']);
  });
});
