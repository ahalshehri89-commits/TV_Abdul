import { describe, it, expect } from 'vitest';
import { sportsService } from '../src/services/sportsService.js';

describe('SportsService', () => {
  it('should return fixtures including live and upcoming matches', () => {
    const all = sportsService.getMatches();
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it('should provide live matches with active scoreboards', () => {
    const live = sportsService.getLiveMatches();
    expect(live.length).toBeGreaterThan(0);
    const first = live[0];
    expect(first.status).toBe('live');
    expect(first.score).not.toBeNull();
    expect(first.homeTeam).toHaveProperty('nameAr');
    expect(first.awayTeam).toHaveProperty('nameAr');
  });

  it('should find match by id', () => {
    const match = sportsService.getMatchById('match-spl-derby-riyadh');
    expect(match).not.toBeNull();
    expect(match.league).toContain('Saudi Pro League');
  });
});
