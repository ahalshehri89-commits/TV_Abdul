import { describe, it, expect } from 'vitest';
import { channelSyncService } from '../src/services/channelSyncService.js';

describe('ChannelSyncService', () => {
  it('should parse M3U content and extract channel metadata', () => {
    const sampleM3u = `
#EXTM3U
#EXTINF:-1 tvg-id="AlArabiya.sa" tvg-logo="https://example.com/arabiya.png" group-title="News",Al Arabiya (1080p)
https://example.com/arabiya/live.m3u8
#EXTINF:-1 tvg-id="BeinSports.qa" tvg-logo="https://example.com/bein.png" group-title="Sports",beIN Sports News (720p)
https://example.com/bein/live.m3u8
    `;

    const channels = channelSyncService.parseM3u(sampleM3u);
    expect(channels.length).toBe(2);

    expect(channels[0].name).toBe('Al Arabiya');
    expect(channels[0].country).toBe('SA');
    expect(channels[0].quality).toBe('1080p');
    expect(channels[0].url).toBe('https://example.com/arabiya/live.m3u8');

    expect(channels[1].name).toBe('beIN Sports News');
    expect(channels[1].country).toBe('QA');
    expect(channels[1].quality).toBe('720p');
  });

  it('should manage last sync timestamp', () => {
    const now = Date.now();
    channelSyncService.setLastSyncTime(now);
    expect(channelSyncService.getLastSyncTime()).toBe(now);
  });
});
