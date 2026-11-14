import { describe, it, expect } from 'vitest';
import { fastChannelService } from '../src/services/fastChannelService.js';
import { catalogService } from '../src/services/catalogService.js';

describe('FastChannelService', () => {
  it('should provide FAST channels with streaming details', () => {
    const channels = fastChannelService.getChannels();
    expect(channels.length).toBeGreaterThanOrEqual(5);
    const topGear = channels.find((c) => c.id === 'fast-top-gear');
    expect(topGear).toBeDefined();
    expect(topGear.name).toContain('Top Gear');
    expect(topGear.streams.length).toBeGreaterThan(0);
  });

  it('should search FAST channels by network or query', () => {
    const ramsay = fastChannelService.getChannels({ q: 'Ramsay' });
    expect(ramsay.length).toBe(1);
    expect(ramsay[0].name).toContain('Gordon Ramsay');
  });

  it('should integrate seamlessly into catalogService as FAST category', () => {
    const fastChannelsFromCatalog = catalogService.getSeedChannels({ category: 'fast' });
    expect(fastChannelsFromCatalog.length).toBeGreaterThanOrEqual(5);
    const ufc = fastChannelsFromCatalog.find((c) => c.id === 'fast-ufc-classics');
    expect(ufc).toBeDefined();
  });
});
