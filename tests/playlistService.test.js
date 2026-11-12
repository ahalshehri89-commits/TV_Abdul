import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parsePlaylist, isValidPlaylistUrl, playlistService } from '../src/services/playlistService.js';
import { storageService } from '../src/services/storageService.js';

const M3U = `#EXTM3U
#EXTINF:-1 tvg-id="One.sa" tvg-logo="http://logo/one.png" group-title="News",Channel One
http://example.com/one.m3u8
#EXTINF:-1 group-title="News",Channel One
http://backup.example.com/one.m3u8
#EXTINF:-1 tvg-name="Two, the second" group-title="A,B",قناة اثنان, HD
#EXTVLCOPT:http-user-agent=TestAgent/1.0
#EXTVLCOPT:http-referrer=http://ref.example.com/
https://example.com/two.m3u8

#EXTINF:-1,Broken entry
#EXTINF:-1,Local file
file:///etc/passwd
`;

describe('playlist parsing', () => {
  it('reads names, logos, groups and merges duplicate names into sources', () => {
    const channels = parsePlaylist(M3U, 'http://x/list.m3u');
    expect(channels.map((c) => c.name)).toEqual(['Channel One', 'قناة اثنان, HD']);
    expect(channels[1].group).toBe('A,B');
    const one = channels[0];
    expect(one.streams.map((s) => s.url)).toEqual(['http://example.com/one.m3u8', 'http://backup.example.com/one.m3u8']);
    expect(one.logo).toBe('http://logo/one.png');
    expect(one.group).toBe('News');
    expect(one.categories).toEqual(['my_playlists']);
  });

  it('carries per-channel player options and ignores non-network addresses', () => {
    const channels = parsePlaylist(M3U, 'http://x/list.m3u');
    expect(channels[1].streams[0]).toMatchObject({ userAgent: 'TestAgent/1.0', referrer: 'http://ref.example.com/' });
    expect(channels.some((c) => c.name === 'Local file' || c.name === 'Broken entry')).toBe(false);
  });

  it('gives stable ids that differ between playlists', () => {
    const a1 = parsePlaylist(M3U, 'http://a/list.m3u');
    const a2 = parsePlaylist(M3U, 'http://a/list.m3u');
    const b = parsePlaylist(M3U, 'http://b/list.m3u');
    expect(a1[0].id).toBe(a2[0].id);
    expect(a1[0].id).not.toBe(b[0].id);
  });

  it('returns nothing for text that is not a playlist', () => {
    expect(parsePlaylist('<html>Not found</html>', 'http://x')).toEqual([]);
    expect(parsePlaylist('', 'http://x')).toEqual([]);
  });

  it('validates addresses', () => {
    expect(isValidPlaylistUrl('https://example.com/a.m3u')).toBe(true);
    expect(isValidPlaylistUrl('example.com/a.m3u')).toBe(false);
    expect(isValidPlaylistUrl('file:///a.m3u')).toBe(false);
  });
});

describe('playlistService', () => {
  let catalog;

  beforeEach(() => {
    const store = {};
    global.localStorage = {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => {
        store[key] = String(value);
      },
      removeItem: (key) => delete store[key]
    };
    catalog = { setPlaylistChannels: vi.fn(), removePlaylistChannels: vi.fn() };
    playlistService.attach(catalog);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.fetch;
    vi.restoreAllMocks();
  });

  it('adds a playlist only after it downloads and contains channels', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => M3U });
    const result = await playlistService.add(' http://x/list.m3u ');
    expect(result).toEqual({ ok: true, count: 2 });
    expect(storageService.getCustomPlaylists()).toEqual(['http://x/list.m3u']);
    expect(catalog.setPlaylistChannels).toHaveBeenCalledWith('http://x/list.m3u', expect.any(Array));
    expect((await playlistService.add('http://x/list.m3u')).ok).toBe(false);
  });

  it('refuses bad addresses, unreachable servers and non-playlists without saving them', async () => {
    expect((await playlistService.add('not a url')).ok).toBe(false);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const notFound = await playlistService.add('http://x/missing.m3u');
    expect(notFound.ok).toBe(false);
    expect(notFound.error).toContain('404');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '<html></html>' });
    expect((await playlistService.add('http://x/page.html')).error).toContain('no channels');
    expect(storageService.getCustomPlaylists()).toEqual([]);
    expect(catalog.setPlaylistChannels).not.toHaveBeenCalled();
  });

  it('shows cached channels when a saved playlist cannot be refreshed', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => M3U });
    await playlistService.add('http://x/list.m3u');
    catalog.setPlaylistChannels.mockClear();
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const results = await playlistService.loadAll();
    expect(results).toEqual([{ url: 'http://x/list.m3u', count: 2, stale: true, error: 'offline' }]);
    expect(catalog.setPlaylistChannels).toHaveBeenCalledTimes(1);
  });

  it('removes a playlist and its channels', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => M3U });
    await playlistService.add('http://x/list.m3u');
    await playlistService.remove('http://x/list.m3u');
    expect(storageService.getCustomPlaylists()).toEqual([]);
    expect(catalog.removePlaylistChannels).toHaveBeenCalledWith('http://x/list.m3u');
  });
});
