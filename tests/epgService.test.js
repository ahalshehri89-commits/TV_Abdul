import { describe, it, expect } from 'vitest';
import { epgService } from '../src/services/epgService.js';

describe('EPGService', () => {
  it('should generate a 24-hour deterministic schedule for a channel', () => {
    const schedule = epgService.getChannelSchedule('test-channel-1');
    expect(schedule.length).toBeGreaterThanOrEqual(10);
    const first = schedule[0];
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('startTime');
    expect(first).toHaveProperty('endTime');
    expect(first.durationMinutes).toBeGreaterThan(0);
  });

  it('should calculate Now Playing program with progress percentage', () => {
    const now = new Date();
    const result = epgService.getNowPlaying('test-channel-1', now);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('current');
    expect(result).toHaveProperty('progressPercent');
    expect(result.progressPercent).toBeGreaterThanOrEqual(0);
    expect(result.progressPercent).toBeLessThanOrEqual(100);
  });

  it('should provide upcoming next program information', () => {
    const result = epgService.getNowPlaying('test-channel-2');
    expect(result.next).not.toBeNull();
    expect(result.next).toHaveProperty('title');
  });
});
