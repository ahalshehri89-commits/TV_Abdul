import { describe, it, expect, beforeEach } from 'vitest';
import { storageService } from '../src/services/storageService.js';

describe('StorageService', () => {
  beforeEach(() => {
    // Mock localStorage in test environment
    const store = {};
    global.localStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, val) => {
        store[key] = String(val);
      },
      removeItem: (key) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) delete store[k];
      }
    };
  });

  it('should toggle favorites correctly', () => {
    expect(storageService.isFavorite('channel-1')).toBe(false);
    const updated = storageService.toggleFavorite('channel-1');
    expect(updated).toContain('channel-1');
    expect(storageService.isFavorite('channel-1')).toBe(true);

    const toggledOff = storageService.toggleFavorite('channel-1');
    expect(toggledOff).not.toContain('channel-1');
    expect(storageService.isFavorite('channel-1')).toBe(false);
  });

  it('should manage recent channels with timestamp and deduplication', () => {
    const ch = { id: 'test-chan', number: 1, name: 'Test Channel' };
    storageService.addRecentChannel(ch);
    let recents = storageService.getRecentChannels();
    expect(recents.length).toBe(1);
    expect(recents[0].id).toBe('test-chan');

    // Add again - should move to front and not duplicate
    storageService.addRecentChannel(ch);
    recents = storageService.getRecentChannels();
    expect(recents.length).toBe(1);
  });
});

describe('StorageService resume positions', () => {
  it('saves and returns a resume position', async () => {
    const { storageService } = await import('../src/services/storageService.js');
    storageService.saveResumePosition('file:a.mkv|100', 600, 3600);
    expect(storageService.getResumePosition('file:a.mkv|100')).toBe(600);
    expect(storageService.getResumePosition('unknown')).toBe(0);
  });

  it('clears the entry near the start and near the end', async () => {
    const { storageService } = await import('../src/services/storageService.js');
    storageService.saveResumePosition('k', 600, 3600);
    storageService.saveResumePosition('k', 10, 3600);
    expect(storageService.getResumePosition('k')).toBe(0);
    storageService.saveResumePosition('k', 600, 3600);
    storageService.saveResumePosition('k', 3500, 3600);
    expect(storageService.getResumePosition('k')).toBe(0);
  });
});
