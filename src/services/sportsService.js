/**
 * TV_Abdul: SportsService
 * Real football fixtures and results from TheSportsDB (https://www.thesportsdb.com).
 * Information only: matches are not tuned to channels. Each match carries a `watch` field,
 * always null today, reserved for attaching a channel later.
 */

import { SPORTS_API_KEY } from '../config.js';
import { kvStore, fetchJson } from './kvStore.js';

const API = 'https://www.thesportsdb.com/api/v1/json';
const CACHE_KEY = 'sports_fixtures_v1';
const FRESH_FOR_MS = 10 * 60 * 1000;
const MATCH_LENGTH_MS = 2.5 * 60 * 60 * 1000;

export const LEAGUES = [
  { id: '4668', name: 'Saudi Pro League', nameAr: 'دوري روشن السعودي' },
  { id: '4328', name: 'Premier League', nameAr: 'الدوري الإنجليزي الممتاز' },
  { id: '4480', name: 'UEFA Champions League', nameAr: 'دوري أبطال أوروبا' },
  { id: '4335', name: 'La Liga', nameAr: 'الدوري الإسباني' }
];

const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO', 'Match Finished']);
const IN_PLAY = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']);
const CALLED_OFF = new Set(['PST', 'CANC', 'ABD', 'SUSP', 'Postponed', 'Cancelled']);

/**
 * Convert a TheSportsDB event into a match. Timestamps from the service are UTC.
 * status: 'upcoming' | 'live' | 'in_progress' | 'finished' | 'postponed'
 *   'live'        the service reports the match in play
 *   'in_progress' kick-off has passed and no result has arrived yet (scores can lag)
 */
export function normalizeEvent(event, league, now = Date.now()) {
  const stamp = event.strTimestamp || (event.dateEvent ? `${event.dateEvent}T${event.strTime || '00:00:00'}` : null);
  const kickoff = stamp ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(stamp) ? stamp : `${stamp}Z`) : NaN;
  const hasScore = event.intHomeScore !== null && event.intHomeScore !== undefined && event.intHomeScore !== '';
  const raw = event.strStatus || '';

  let status = 'upcoming';
  if (CALLED_OFF.has(raw) || event.strPostponed === 'yes') status = 'postponed';
  else if (FINISHED.has(raw)) status = 'finished';
  else if (IN_PLAY.has(raw)) status = 'live';
  else if (isFinite(kickoff) && now >= kickoff) {
    if (now - kickoff < MATCH_LENGTH_MS) status = 'in_progress';
    else status = hasScore ? 'finished' : 'in_progress';
  }

  return {
    id: String(event.idEvent),
    leagueId: league.id,
    league: league.name,
    leagueAr: league.nameAr,
    round: event.intRound ? String(event.intRound) : '',
    kickoff: isFinite(kickoff) ? kickoff : null,
    status,
    home: { name: event.strHomeTeam || '', badge: event.strHomeTeamBadge || '' },
    away: { name: event.strAwayTeam || '', badge: event.strAwayTeamBadge || '' },
    score: hasScore ? `${event.intHomeScore} - ${event.intAwayScore}` : null,
    venue: event.strVenue || '',
    watch: null
  };
}

/** Split matches into what to show: in play, coming up (soonest first), recent results (latest first). */
export function groupMatches(matches, now = Date.now()) {
  const live = matches.filter((m) => m.status === 'live' || m.status === 'in_progress');
  const upcoming = matches
    .filter((m) => m.status === 'upcoming' && m.kickoff && m.kickoff >= now)
    .sort((a, b) => a.kickoff - b.kickoff);
  const results = matches.filter((m) => m.status === 'finished').sort((a, b) => (b.kickoff || 0) - (a.kickoff || 0));
  return { live, upcoming, results };
}

export function formatKickoff(kickoff, now = Date.now()) {
  if (!kickoff) return '';
  const date = new Date(kickoff);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStart = (ms) => new Date(ms).setHours(0, 0, 0, 0);
  const days = Math.round((dayStart(kickoff) - dayStart(now)) / 86400000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

class SportsService {
  constructor() {
    this.matches = [];
    this.fetchedAt = 0;
    this.loading = null;
  }

  async fetchLeague(league) {
    const base = `${API}/${SPORTS_API_KEY}`;
    // The next fixture tells us the current round and season; whole rounds are then fetched.
    const next = await fetchJson(`${base}/eventsnextleague.php?id=${league.id}`);
    const anchor = next && next.events && next.events[0];
    if (!anchor || !anchor.intRound || !anchor.strSeason) {
      return (next && next.events ? next.events : []).map((e) => normalizeEvent(e, league));
    }
    const round = Number(anchor.intRound);
    const season = encodeURIComponent(anchor.strSeason);
    const rounds = [round, round - 1].filter((r) => r >= 1);
    const events = [];
    for (const r of rounds) {
      try {
        const data = await fetchJson(`${base}/eventsround.php?id=${league.id}&r=${r}&s=${season}`);
        if (data && data.events) events.push(...data.events);
      } catch (e) {
        console.warn(`[sports] ${league.name} round ${r} failed:`, e && e.message);
      }
    }
    if (events.length === 0) events.push(anchor);
    return events.map((e) => normalizeEvent(e, league));
  }

  /**
   * Fixtures and results for all leagues.
   * @returns {Promise<{matches: Array, fetchedAt: number, stale: boolean, error: string|null}>}
   */
  load({ force = false } = {}) {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      if (!force && this.matches.length > 0 && Date.now() - this.fetchedAt < FRESH_FOR_MS) {
        return { matches: this.matches, fetchedAt: this.fetchedAt, stale: false, error: null };
      }
      const collected = [];
      const failures = [];
      for (const league of LEAGUES) {
        try {
          collected.push(...(await this.fetchLeague(league)));
        } catch (e) {
          failures.push(league.name);
          console.warn(`[sports] ${league.name} failed:`, e && e.message);
        }
      }
      if (collected.length > 0) {
        this.matches = collected;
        this.fetchedAt = Date.now();
        await kvStore.set(CACHE_KEY, { matches: collected, fetchedAt: this.fetchedAt });
        return {
          matches: collected,
          fetchedAt: this.fetchedAt,
          stale: false,
          error: failures.length ? `No data for: ${failures.join(', ')}` : null
        };
      }
      // Nothing came back: fall back to the last saved fixtures and say so.
      const cached = await kvStore.get(CACHE_KEY);
      if (cached && cached.matches && cached.matches.length > 0) {
        this.matches = cached.matches;
        return { matches: cached.matches, fetchedAt: cached.fetchedAt, stale: true, error: 'The fixtures service is unreachable.' };
      }
      return { matches: [], fetchedAt: 0, stale: true, error: 'The fixtures service is unreachable.' };
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }
}

export const sportsService = new SportsService();
