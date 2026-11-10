import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spatialNav } from '../src/services/spatialNav.js';

class MockElement {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = attrs;
    this.className = attrs.class || '';
    this.id = attrs.id || '';
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  focus() {
    global.document.activeElement = this;
  }

  scrollIntoView() {}
}

describe('SpatialNav Zone-Based Navigation', () => {
  let elements = [];

  beforeEach(() => {
    elements = [
      new MockElement('button', { 'data-nav': 'true', 'data-nav-zone': 'header', 'data-nav-id': 'btn-country' }),
      new MockElement('button', { 'data-nav': 'true', 'data-nav-zone': 'header', 'data-nav-id': 'btn-favorites' }),
      new MockElement('button', { 'data-nav': 'true', 'data-nav-zone': 'categories', 'data-nav-id': 'cat-all', class: 'tv-category-pill active' }),
      new MockElement('button', { 'data-nav': 'true', 'data-nav-zone': 'categories', 'data-nav-id': 'cat-news', class: 'tv-category-pill' }),
      new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'ch-1' }),
      new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'ch-2' }),
      new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'ch-3' }),
      new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'ch-4' }),
      new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'ch-5' }),
      new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'ch-6' }),
      new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'ch-7' }),
    ];

    global.document = {
      activeElement: null,
      querySelector: (selector) => {
        if (selector.includes('[data-nav-id="')) {
          const id = selector.match(/data-nav-id="([^"]+)"/)?.[1];
          return elements.find(el => el.getAttribute('data-nav-id') === id) || null;
        }
        if (selector.includes('.active')) {
          return elements.find(el => el.className.includes('active')) || null;
        }
        if (selector.includes('[data-nav-zone="categories"]')) {
          return elements.find(el => el.getAttribute('data-nav-zone') === 'categories') || null;
        }
        if (selector.includes('[data-nav-zone="grid"]')) {
          return elements.find(el => el.getAttribute('data-nav-zone') === 'grid') || null;
        }
        if (selector.includes('[data-nav-zone="header"]')) {
          return elements.find(el => el.getAttribute('data-nav-zone') === 'header') || null;
        }
        return elements[0] || null;
      },
      querySelectorAll: (selector) => {
        if (selector.includes('[data-nav-zone="grid"]')) {
          return elements.filter(el => el.getAttribute('data-nav-zone') === 'grid');
        }
        if (selector.includes('[data-nav-zone="categories"]')) {
          return elements.filter(el => el.getAttribute('data-nav-zone') === 'categories');
        }
        if (selector.includes('[data-nav-zone="header"]')) {
          return elements.filter(el => el.getAttribute('data-nav-zone') === 'header');
        }
        return elements;
      }
    };
  });

  afterEach(() => {
    delete global.document;
  });

  it('should navigate strictly between channels on RIGHT/LEFT in grid', () => {
    spatialNav.focus('ch-1');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('ch-1');

    spatialNav.move('RIGHT');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('ch-2');

    spatialNav.move('RIGHT');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('ch-3');

    spatialNav.move('LEFT');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('ch-2');
  });

  it('should move down and up by row in 5-column grid', () => {
    spatialNav.focus('ch-2'); // Col 1, Row 0
    spatialNav.move('DOWN');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('ch-7'); // 2 + 5 = 7

    spatialNav.move('UP');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('ch-2');
  });

  it('should transition from top row of grid to Category Bar on UP', () => {
    spatialNav.focus('ch-1');
    spatialNav.move('UP');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('cat-all');
  });

  it('should transition from Categories to Header on UP and down to Grid on DOWN', () => {
    spatialNav.focus('cat-all');
    spatialNav.move('UP');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('btn-country');

    spatialNav.move('DOWN');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('cat-all');

    spatialNav.move('DOWN');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('ch-1');
  });

  it('should emit loadMore event when moving near or past the grid bottom', () => {
    let triggered = false;
    const unsub = spatialNav.onLoadMore(() => {
      triggered = true;
    });

    spatialNav.focus('ch-7');
    spatialNav.move('DOWN');
    expect(triggered).toBe(true);
    unsub();
  });

  it('should navigate 2-column sports match grid correctly with match- ids', () => {
    const match1 = new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'match-1' });
    const match2 = new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'match-2' });
    const match3 = new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'match-3' });
    const match4 = new MockElement('div', { 'data-nav': 'true', 'data-nav-zone': 'grid', 'data-nav-id': 'match-4' });
    elements.push(match1, match2, match3, match4);

    spatialNav.focus('match-1');
    spatialNav.move('DOWN');
    // match-1 (idx 11 in elements array with 2 columns moves by 2: idx 13 is match-3)
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('match-3');

    spatialNav.move('UP');
    expect(global.document.activeElement.getAttribute('data-nav-id')).toBe('match-1');
  });
});
