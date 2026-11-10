import { describe, it, expect } from 'vitest';
import { catalogService, PRIMARY_CATEGORIES } from '../src/services/catalogService.js';

describe('CatalogService', () => {
  it('should provide predefined primary categories', () => {
    const cats = catalogService.getCategories();
    expect(cats.length).toBeGreaterThan(5);
    const ids = cats.map((c) => c.id);
    expect(ids).toContain('all');
    expect(ids).toContain('news');
    expect(ids).toContain('sports');
    expect(ids).toContain('movies');
    expect(ids).toContain('favorites');
  });

  it('should return seed channels synchronously', () => {
    const channels = catalogService.getSeedChannels();
    expect(channels.length).toBeGreaterThan(50);
    const first = channels[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('streams');
    expect(first.streams.length).toBeGreaterThan(0);
  });

  it('should filter seed channels by category', () => {
    const newsChannels = catalogService.getSeedChannels({ category: 'news' });
    expect(newsChannels.length).toBeGreaterThan(0);
    newsChannels.forEach((ch) => {
      expect(ch.categories).toContain('news');
    });
  });

  it('should filter seed channels by search query', () => {
    const searchResults = catalogService.getSeedChannels({ q: 'Jazeera' });
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].name.toLowerCase()).toContain('jazeera');
  });

  it('should list available countries and support filtering by country', () => {
    const countries = catalogService.getCountries();
    expect(countries.length).toBeGreaterThan(10);
    expect(countries[0].code).toBe('all');

    const usChannels = catalogService.getSeedChannels({ country: 'US' });
    expect(usChannels.length).toBeGreaterThan(10);
    usChannels.forEach((ch) => {
      expect(ch.country).toBe('US');
    });

    const saChannels = catalogService.getSeedChannels({ country: 'SA' });
    expect(saChannels.length).toBeGreaterThan(0);
    saChannels.forEach((ch) => {
      expect(ch.country).toBe('SA');
    });
  });
});
