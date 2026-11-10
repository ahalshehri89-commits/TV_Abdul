import { describe, it, expect } from 'vitest';
import { prebufferService } from '../src/services/prebufferService.js';

describe('PrebufferService', () => {
  it('should ignore non-HLS streams', () => {
    prebufferService.preloadStream('https://example.com/video.mp4');
    expect(prebufferService.isPreloaded('https://example.com/video.mp4')).toBe(false);
  });

  it('should preload adjacent channel manifests', () => {
    const channels = [
      { id: '1', streams: [{ url: 'https://example.com/stream1.m3u8' }] },
      { id: '2', streams: [{ url: 'https://example.com/stream2.m3u8' }] },
      { id: '3', streams: [{ url: 'https://example.com/stream3.m3u8' }] }
    ];

    expect(() => prebufferService.preloadAdjacent(1, channels)).not.toThrow();
  });
});
