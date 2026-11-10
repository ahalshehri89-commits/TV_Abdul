import { describe, it, expect, beforeEach } from 'vitest';
import { vodService, VOD_CATEGORIES } from '../src/services/vodService.js';

describe('VODService', () => {
  beforeEach(() => {
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

  it('should return predefined VOD categories', () => {
    const cats = vodService.getCategories();
    expect(cats.length).toBeGreaterThanOrEqual(4);
    const ids = cats.map((c) => c.id);
    expect(ids).toContain('plays');
    expect(ids).toContain('cinema');
    expect(ids).toContain('drama');
  });

  it('should filter items by category', () => {
    const plays = vodService.getItems({ category: 'plays' });
    expect(plays.length).toBeGreaterThan(0);
    plays.forEach((p) => expect(p.category).toBe('plays'));

    const cinema = vodService.getItems({ category: 'cinema' });
    expect(cinema.length).toBeGreaterThan(0);
    cinema.forEach((c) => expect(c.category).toBe('cinema'));
  });

  it('should find item by id', () => {
    const item = vodService.getItemById('play-madrasat-al-mushaghbeen');
    expect(item).not.toBeNull();
    expect(item.titleAr).toContain('مدرسة المشاغبين');
  });

  it('should save and retrieve resume position', () => {
    expect(vodService.getResumePosition('test-item')).toBe(0);
    vodService.saveResumePosition('test-item', 1420, 7200);
    expect(vodService.getResumePosition('test-item')).toBe(1420);
  });
});
