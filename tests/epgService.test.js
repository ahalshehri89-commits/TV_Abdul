import { describe, it, expect, afterEach, vi } from 'vitest';
import { epgService } from '../src/services/epgService.js';
import { parseXmltv, parseXmltvTime, normalizeName, matchChannels, buildGuide } from '../scripts/epg/xmltv.js';

const NOW = new Date('2026-11-12T18:30:00Z');
const sec = (iso) => Date.parse(iso) / 1000;
const guide = {
  generatedAt: '2026-11-12T02:00:00Z',
  channels: {
    'AlJazeera.qa': [
      [sec('2026-11-12T17:00:00Z'), sec('2026-11-12T18:00:00Z'), 'Earlier show'],
      [sec('2026-11-12T18:00:00Z'), sec('2026-11-12T19:00:00Z'), 'الحصاد'],
      [sec('2026-11-12T19:00:00Z'), sec('2026-11-12T19:30:00Z'), 'Next show']
    ],
    'Old.sa': [[sec('2026-11-11T10:00:00Z'), sec('2026-11-11T11:00:00Z'), 'Yesterday']]
  }
};

describe('EPGService', () => {
  afterEach(() => {
    epgService.channels = {};
    vi.restoreAllMocks();
    delete global.fetch;
  });

  it('has no guide and no "now playing" for a channel without real data', () => {
    epgService.applyGuide(guide);
    expect(epgService.hasGuide('Unknown.xx', NOW)).toBe(false);
    expect(epgService.getChannelSchedule('Unknown.xx', NOW)).toEqual([]);
    expect(epgService.getNowPlaying('Unknown.xx', NOW)).toBeNull();
  });

  it('reports the programme on air, its progress and what follows', () => {
    epgService.applyGuide(guide);
    const info = epgService.getNowPlaying('AlJazeera.qa', NOW);
    expect(info.current.title).toBe('الحصاد');
    expect(info.progressPercent).toBe(50);
    expect(info.next.title).toBe('Next show');
    expect(epgService.getChannelSchedule('AlJazeera.qa', NOW).map((p) => p.title)).toEqual(['الحصاد', 'Next show']);
    expect(info.current.durationMinutes).toBe(60);
  });

  it('treats a channel whose data has all expired as having no guide', () => {
    epgService.applyGuide(guide);
    expect(epgService.hasGuide('Old.sa', NOW)).toBe(false);
    expect(epgService.getNowPlaying('Old.sa', NOW)).toBeNull();
  });

  it('keeps the current guide when a download fails or is malformed', async () => {
    epgService.applyGuide(guide);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    await epgService.load({ force: true });
    expect(epgService.hasGuide('AlJazeera.qa', NOW)).toBe(true);
    expect(epgService.applyGuide({ channels: {} })).toBe(false);
    expect(epgService.applyGuide(null)).toBe(false);
    expect(epgService.hasGuide('AlJazeera.qa', NOW)).toBe(true);
  });
});

describe('XMLTV guide building', () => {
  const xml = `<?xml version="1.0"?><tv>
    <channel id="Al.Jazeera.HD.ae"><display-name>Al Jazeera HD</display-name></channel>
    <channel id="ctv"><display-name>CTV</display-name></channel>
    <channel id="x1"><display-name>Unknown &amp; Co</display-name></channel>
    <programme start="20261112180000 +0000" stop="20261112190000 +0000" channel="Al.Jazeera.HD.ae"><title lang="ar">الحصاد &amp; more</title></programme>
    <programme start="20261112210000 +0300" stop="20261112220000 +0300" channel="Al.Jazeera.HD.ae"><title>Late</title></programme>
    <programme start="20261112180000 +0000" stop="20261112190000 +0000" channel="ctv"><title>Somewhere else</title></programme>
    <programme start="bad" stop="20261112190000 +0000" channel="x1"><title>Broken</title></programme>
  </tv>`;

  it('parses times with zone offsets', () => {
    expect(parseXmltvTime('20261112183000 +0300')).toBe(sec('2026-11-12T15:30:00Z'));
    expect(parseXmltvTime('20261112183000')).toBe(sec('2026-11-12T18:30:00Z'));
    expect(parseXmltvTime('garbage')).toBeNaN();
  });

  it('parses channels and programmes and skips broken rows', () => {
    const parsed = parseXmltv(xml);
    expect(parsed.channels.get('Al.Jazeera.HD.ae')).toEqual(['Al Jazeera HD']);
    expect(parsed.programmes).toHaveLength(3);
    expect(parsed.programmes[0].title).toBe('الحصاد & more');
  });

  it('normalises names so quality tags and spacing do not matter', () => {
    expect(normalizeName('Al Jazeera HD')).toBe(normalizeName('AlJazeera'));
    expect(normalizeName('MBC 1 (1080p) [Geo-blocked]')).toBe('mbc1');
  });

  it('matches by exact name only, and does not let a short foreign name collide', () => {
    const parsed = parseXmltv(xml);
    const app = [
      { id: 'AlJazeera.qa', name: 'Al Jazeera', regional: true },
      { id: 'CTV.us', name: 'CTV', regional: false },
      { id: 'AlJazeeraDocumentary.qa', name: 'Al Jazeera Documentary', regional: true }
    ];
    const mapping = matchChannels(parsed.channels, app);
    expect(mapping.get('Al.Jazeera.HD.ae')).toBe('AlJazeera.qa');
    expect(mapping.has('ctv')).toBe(false);
    expect(mapping.has('x1')).toBe(false);
  });

  it('builds a compact guide limited to the time window', () => {
    const app = [{ id: 'AlJazeera.qa', name: 'Al Jazeera', regional: true }];
    const result = buildGuide([parseXmltv(xml)], app, sec('2026-11-12T17:00:00Z'), sec('2026-11-12T18:30:00Z'));
    expect(result).toEqual({ 'AlJazeera.qa': [[sec('2026-11-12T18:00:00Z'), sec('2026-11-12T19:00:00Z'), 'الحصاد & more']] });
  });
});
