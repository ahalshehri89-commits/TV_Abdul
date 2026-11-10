/**
 * TV_Abdul v2.0: FastChannelService
 * Ingestion of high-bitrate Free Ad-Supported TV (FAST) networks:
 * Pluto TV, Samsung TV Plus, Plex, and Red Bull Media.
 */

import fastChannels from '../data/fastChannels.json';

class FastChannelService {
  constructor() {
    this.channels = fastChannels;
    this.channelMap = new Map();
    this.channels.forEach((ch) => {
      this.channelMap.set(ch.id, ch);
    });
  }

  getChannels(filter = {}) {
    let list = this.channels;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.network?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }

  getChannelById(id) {
    return this.channelMap.get(id) || null;
  }
}

export const fastChannelService = new FastChannelService();
