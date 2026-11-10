/**
 * TV_Abdul: Smart TV Spatial Navigation Engine
 * Zone-based deterministic navigation for TV remotes with boundary protection.
 */

class SpatialNav {
  constructor() {
    this.currentFocusedId = null;
    this.lastFocusedChannelId = null;
    this.listeners = new Set();
    this.loadMoreListeners = new Set();
    this.scopeStack = []; // For focus trapping inside modals
  }

  onLoadMore(callback) {
    this.loadMoreListeners.add(callback);
    return () => this.loadMoreListeners.delete(callback);
  }

  emitLoadMore() {
    this.loadMoreListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {}
    });
  }

  pushScope(scopeSelector) {
    this.scopeStack.push(scopeSelector);
  }

  popScope() {
    return this.scopeStack.pop();
  }

  getCurrentScope() {
    return this.scopeStack.length > 0 ? this.scopeStack[this.scopeStack.length - 1] : null;
  }

  /**
   * Set focus to a specific element by DOM element or nav id.
   */
  focus(target) {
    let el = null;
    if (typeof target === 'string') {
      el = document.querySelector(`[data-nav-id="${target}"]`);
    } else if (target && typeof target === 'object') {
      el = target;
    }

    if (el) {
      el.focus();
      const navId = el.getAttribute('data-nav-id') || el.id;
      this.currentFocusedId = navId;

      if (el.getAttribute('data-nav-zone') === 'grid') {
        this.lastFocusedChannelId = navId;
      }

      el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      this.notify(navId, el);
      return true;
    }
    return false;
  }

  focusFirst() {
    const scope = this.getCurrentScope();
    const container = scope ? document.querySelector(scope) : document;
    if (!container) return false;

    // Prioritize active category or first channel if on main screen
    if (!scope) {
      const activeCat = container.querySelector('.tv-category-pill.active');
      if (activeCat) return this.focus(activeCat);
    }

    const first = container.querySelector('[data-nav="true"]');
    if (first) {
      return this.focus(first);
    }
    return false;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(navId, el) {
    this.listeners.forEach((fn) => fn(navId, el));
  }

  /**
   * Move focus directionally: 'UP', 'DOWN', 'LEFT', 'RIGHT'
   */
  move(direction) {
    const activeEl = document.activeElement;
    const currentScope = this.getCurrentScope();

    // 1. MODAL NAVIGATION (Focus trapped inside modal)
    if (currentScope) {
      return this.handleModalMove(direction, activeEl, currentScope);
    }

    // 2. MAIN SCREEN ZONE NAVIGATION
    const zone = activeEl ? activeEl.getAttribute('data-nav-zone') : null;

    if (zone === 'grid') {
      return this.handleGridMove(direction, activeEl);
    }

    if (zone === 'categories') {
      return this.handleCategoriesMove(direction, activeEl);
    }

    if (zone === 'header') {
      return this.handleHeaderMove(direction, activeEl);
    }

    // Fallback if focus is not in any recognized zone
    return this.focusFirst();
  }

  handleGridMove(direction, activeEl) {
    const cards = Array.from(document.querySelectorAll('[data-nav-zone="grid"]'));
    if (cards.length === 0) return false;

    const idx = cards.indexOf(activeEl);
    if (idx === -1) {
      return this.focus(cards[0]);
    }

    const COLUMNS = 5;

    switch (direction) {
      case 'RIGHT':
        if (idx >= cards.length - COLUMNS) {
          this.emitLoadMore();
        }
        if (idx < cards.length - 1) {
          return this.focus(cards[idx + 1]);
        }
        return true; // Stay on last card, do NOT jump up to tabs!

      case 'LEFT':
        if (idx > 0) {
          return this.focus(cards[idx - 1]);
        }
        return true; // Stay on first card, do NOT jump up to tabs!

      case 'DOWN': {
        const nextRowIdx = idx + COLUMNS;
        if (nextRowIdx >= cards.length - (COLUMNS * 2)) {
          this.emitLoadMore();
        }
        if (nextRowIdx < cards.length) {
          return this.focus(cards[nextRowIdx]);
        } else if (idx < cards.length - 1) {
          return this.focus(cards[cards.length - 1]);
        }
        return true;
      }

      case 'UP': {
        if (idx >= COLUMNS) {
          return this.focus(cards[idx - COLUMNS]);
        }
        // Top row of channels (idx < 5): Transition UP into Categories
        const activeCat = document.querySelector('.tv-category-pill.active') ||
                          document.querySelector('[data-nav-zone="categories"]');
        if (activeCat) {
          return this.focus(activeCat);
        }
        return true;
      }

      default:
        return false;
    }
  }

  handleCategoriesMove(direction, activeEl) {
    const pills = Array.from(document.querySelectorAll('[data-nav-zone="categories"]'));
    if (pills.length === 0) return false;

    const idx = pills.indexOf(activeEl);
    if (idx === -1) {
      return this.focus(pills[0]);
    }

    switch (direction) {
      case 'RIGHT':
        if (idx < pills.length - 1) {
          return this.focus(pills[idx + 1]);
        }
        return true;

      case 'LEFT':
        if (idx > 0) {
          return this.focus(pills[idx - 1]);
        }
        return true;

      case 'DOWN': {
        // Transition DOWN into Channel Grid
        if (this.lastFocusedChannelId) {
          const lastEl = document.querySelector(`[data-nav-id="${this.lastFocusedChannelId}"]`);
          if (lastEl) return this.focus(lastEl);
        }
        const firstCard = document.querySelector('[data-nav-zone="grid"]');
        if (firstCard) {
          return this.focus(firstCard);
        }
        return true;
      }

      case 'UP': {
        // Transition UP into Header
        const countryBtn = document.querySelector('[data-nav-id="btn-country"]') ||
                           document.querySelector('[data-nav-zone="header"]');
        if (countryBtn) {
          return this.focus(countryBtn);
        }
        return true;
      }

      default:
        return false;
    }
  }

  handleHeaderMove(direction, activeEl) {
    const btns = Array.from(document.querySelectorAll('[data-nav-zone="header"]'));
    if (btns.length === 0) return false;

    const idx = btns.indexOf(activeEl);
    if (idx === -1) {
      return this.focus(btns[0]);
    }

    switch (direction) {
      case 'RIGHT':
        if (idx < btns.length - 1) {
          return this.focus(btns[idx + 1]);
        }
        return true;

      case 'LEFT':
        if (idx > 0) {
          return this.focus(btns[idx - 1]);
        }
        return true;

      case 'DOWN': {
        // Transition DOWN into active category pill
        const activeCat = document.querySelector('.tv-category-pill.active') ||
                          document.querySelector('[data-nav-zone="categories"]');
        if (activeCat) {
          return this.focus(activeCat);
        }
        return true;
      }

      case 'UP':
        return true; // Top boundary

      default:
        return false;
    }
  }

  handleModalMove(direction, activeEl, scopeSelector) {
    const container = document.querySelector(scopeSelector);
    if (!container) return false;

    const items = Array.from(container.querySelectorAll('[data-nav="true"]'));
    if (items.length === 0) return false;

    const idx = items.indexOf(activeEl);
    if (idx === -1) {
      return this.focus(items[0]);
    }

    // Check if Country Modal (3 columns grid of cards after close button)
    const cards = Array.from(container.querySelectorAll('.tv-country-card'));
    const closeBtn = container.querySelector('[data-nav-id="btn-close-country"]');

    if (cards.length > 0) {
      const cardIdx = cards.indexOf(activeEl);
      const COLUMNS = 3;

      if (activeEl === closeBtn) {
        if (direction === 'DOWN' || direction === 'LEFT') {
          return this.focus(cards[0]);
        }
        return true;
      }

      if (cardIdx !== -1) {
        switch (direction) {
          case 'RIGHT':
            if (cardIdx < cards.length - 1) return this.focus(cards[cardIdx + 1]);
            return true;
          case 'LEFT':
            if (cardIdx > 0) return this.focus(cards[cardIdx - 1]);
            return true;
          case 'DOWN': {
            const nextIdx = cardIdx + COLUMNS;
            if (nextIdx < cards.length) return this.focus(cards[nextIdx]);
            return this.focus(cards[cards.length - 1]);
          }
          case 'UP':
            if (cardIdx >= COLUMNS) return this.focus(cards[cardIdx - COLUMNS]);
            if (closeBtn) return this.focus(closeBtn);
            return true;
          default:
            return false;
        }
      }
    }

    // Generic linear modal navigation fallback
    switch (direction) {
      case 'RIGHT':
      case 'DOWN':
        if (idx < items.length - 1) return this.focus(items[idx + 1]);
        return this.focus(items[0]);
      case 'LEFT':
      case 'UP':
        if (idx > 0) return this.focus(items[idx - 1]);
        return this.focus(items[items.length - 1]);
      default:
        return false;
    }
  }
}

export const spatialNav = new SpatialNav();
