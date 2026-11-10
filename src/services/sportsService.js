/**
 * TV_Abdul v2.0: SportsService
 * Manages Live Sports Match Center, match countdowns, and automatic stream channel routing.
 */

import seedSports from '../data/seedSports.json';

class SportsService {
  constructor() {
    this.matches = seedSports;
  }

  getMatches() {
    return this.matches;
  }

  getLiveMatches() {
    return this.matches.filter((m) => m.status === 'live');
  }

  getUpcomingMatches() {
    return this.matches.filter((m) => m.status === 'upcoming');
  }

  getMatchById(id) {
    return this.matches.find((m) => m.id === id) || null;
  }
}

export const sportsService = new SportsService();
