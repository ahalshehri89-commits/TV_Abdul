import { describe, it, expect, afterEach, vi } from 'vitest';
import { normalizeEvent, groupMatches, formatKickoff, sportsService, LEAGUES } from '../src/services/sportsService.js';

const league = LEAGUES[0];
const NOW = Date.parse('2026-11-20T18:00:00Z');
const event = (overrides = {}) => ({
  idEvent: '1',
  strHomeTeam: 'Al-Hilal',
  strAwayTeam: 'Al-Nassr',
  strHomeTeamBadge: 'h.png',
  strAwayTeamBadge: 'a.png',
  intRound: '14',
  strSeason: '2026-2027',
  strTimestamp: '2026-11-20T17:00:00',
  intHomeScore: null,
  intAwayScore: null,
  strStatus: 'NS',
  ...overrides
});

describe('SportsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
    sportsService.matches = [];
    sportsService.fetchedAt = 0;
  });

  it('reads the service timestamp as UTC', () => {
    const match = normalizeEvent(event(), league, Date.parse('2026-11-20T10:00:00Z'));
    expect(match.kickoff).toBe(Date.parse('2026-11-20T17:00:00Z'));
    expect(match.status).toBe('upcoming');
    expect(match.score).toBeNull();
    expect(match.watch).toBeNull();
    expect(match.home).toEqual({ name: 'Al-Hilal', badge: 'h.png' });
  });

  it('never invents a live score: after kick-off without a status it is only "in progress"', () => {
    expect(normalizeEvent(event(), league, NOW).status).toBe('in_progress');
    expect(normalizeEvent(event({ strStatus: '2H', intHomeScore: '1', intAwayScore: '0' }), league, NOW)).toMatchObject({
      status: 'live',
      score: '1 - 0'
    });
  });

  it('recognises finished and postponed matches', () => {
    expect(normalizeEvent(event({ strStatus: 'FT', intHomeScore: '2', intAwayScore: '1' }), league, NOW)).toMatchObject({
      status: 'finished',
      score: '2 - 1'
    });
    expect(normalizeEvent(event({ strStatus: 'PST' }), league, NOW).status).toBe('postponed');
    const longAgo = Date.parse('2026-11-25T00:00:00Z');
    expect(normalizeEvent(event({ intHomeScore: '0', intAwayScore: '0' }), league, longAgo).status).toBe('finished');
  });

  it('groups matches into live, upcoming (soonest first) and results (latest first)', () => {
    const matches = [
      { id: 'u2', status: 'upcoming', kickoff: NOW + 2000 },
      { id: 'r1', status: 'finished', kickoff: NOW - 5000 },
      { id: 'u1', status: 'upcoming', kickoff: NOW + 1000 },
      { id: 'l1', status: 'in_progress', kickoff: NOW - 100 },
      { id: 'r2', status: 'finished', kickoff: NOW - 1000 },
      { id: 'p1', status: 'postponed', kickoff: NOW + 500 }
    ];
    const groups = groupMatches(matches, NOW);
    expect(groups.live.map((m) => m.id)).toEqual(['l1']);
    expect(groups.upcoming.map((m) => m.id)).toEqual(['u1', 'u2']);
    expect(groups.results.map((m) => m.id)).toEqual(['r2', 'r1']);
  });

  it('labels kick-off days relative to today', () => {
    const noon = new Date(2026, 10, 20, 12, 0, 0).getTime();
    expect(formatKickoff(new Date(2026, 10, 20, 20, 0, 0).getTime(), noon)).toMatch(/^Today /);
    expect(formatKickoff(new Date(2026, 10, 21, 20, 0, 0).getTime(), noon)).toMatch(/^Tomorrow /);
    expect(formatKickoff(null)).toBe('');
  });

  it('fetches the current and previous round for each league', async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      if (url.includes('eventsnextleague')) return { ok: true, json: async () => ({ events: [event()] }) };
      return { ok: true, json: async () => ({ events: [event({ idEvent: url.includes('r=13') ? '13' : '14' })] }) };
    });
    const result = await sportsService.load({ force: true });
    expect(result.error).toBeNull();
    expect(result.matches).toHaveLength(LEAGUES.length * 2);
    expect(calls.filter((u) => u.includes('eventsround.php?id=4668')).map((u) => u.match(/r=(\d+)/)[1])).toEqual(['14', '13']);
    expect(calls.every((u) => u.includes('s=2026-2027') || u.includes('eventsnextleague'))).toBe(true);
  });

  it('falls back to the last saved fixtures and reports it when the service is down', async () => {
    global.fetch = vi.fn(async (url) =>
      url.includes('eventsnextleague')
        ? { ok: true, json: async () => ({ events: [event()] }) }
        : { ok: true, json: async () => ({ events: [event()] }) }
    );
    await sportsService.load({ force: true });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await sportsService.load({ force: true });
    expect(result.stale).toBe(true);
    expect(result.error).toContain('unreachable');
    expect(result.matches.length).toBeGreaterThan(0);
  });
});
