/**
 * TV_Abdul: RemoteKeyManager
 * Samsung Smart TV Remote Control registration and key normalization.
 */

export const TV_KEYS = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  ENTER: 'ENTER',
  BACK: 'BACK',
  CH_UP: 'CH_UP',
  CH_DOWN: 'CH_DOWN',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  PLAY_PAUSE: 'PLAY_PAUSE',
  STOP: 'STOP',
  INFO: 'INFO',
  FAVORITE: 'FAVORITE',
  SEARCH: 'SEARCH',
  DIGIT: 'DIGIT'
};

const SAMSUNG_KEY_NAMES = [
  'MediaPlay',
  'MediaPause',
  'MediaPlayPause',
  'MediaStop',
  'MediaFastForward',
  'MediaRewind',
  'ChannelUp',
  'ChannelDown',
  'Info',
  'ColorF0Red',
  'ColorF1Green',
  'ColorF2Yellow',
  'ColorF3Blue',
  'Search',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
];

class RemoteKeyManager {
  constructor() {
    this.listeners = new Set();
    this.isRegistered = false;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Register Samsung Smart TV hardware keys with Tizen TV input device.
   */
  init() {
    if (typeof window === 'undefined') return;

    // Register hardware keys on Samsung Tizen
    if (window.tizen && window.tizen.tvinputdevice) {
      try {
        SAMSUNG_KEY_NAMES.forEach((keyName) => {
          try {
            window.tizen.tvinputdevice.registerKey(keyName);
          } catch (e) {
            // Some models might not support specific keys
          }
        });
        console.log('✔ Samsung TV Remote keys registered successfully.');
      } catch (err) {
        console.warn('Failed to register Samsung TV keys:', err);
      }
    }

    if (!this.isRegistered) {
      window.addEventListener('keydown', this.handleKeyDown, { capture: true });
      this.isRegistered = true;
    }
  }

  destroy() {
    if (typeof window !== 'undefined' && this.isRegistered) {
      window.removeEventListener('keydown', this.handleKeyDown, { capture: true });
      this.isRegistered = false;
    }
  }

  /**
   * Subscribe a callback to receive normalized TV key events.
   * @param {Function} callback (action, originalEvent, digitValue) => void
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Normalize browser / Tizen key event into a standard TV action.
   */
  normalizeKey(event) {
    const code = event.keyCode;
    const key = event.key;

    // D-Pad Navigation
    if (code === 38 || key === 'ArrowUp' || key === 'Up') return { type: TV_KEYS.UP };
    if (code === 40 || key === 'ArrowDown' || key === 'Down') return { type: TV_KEYS.DOWN };
    if (code === 37 || key === 'ArrowLeft' || key === 'Left') return { type: TV_KEYS.LEFT };
    if (code === 39 || key === 'ArrowRight' || key === 'Right') return { type: TV_KEYS.RIGHT };

    // Enter / OK / Select
    if (code === 13 || key === 'Enter') return { type: TV_KEYS.ENTER };

    // Back / Return: 10009 is Samsung TV Return, 461 is LG WebOS back, 27 is Escape, 8 is Backspace
    if (code === 10009 || code === 461 || code === 27 || code === 8 || key === 'Backspace' || key === 'Escape' || key === 'XF86Back') {
      return { type: TV_KEYS.BACK };
    }

    // Channel Switching: 427/33 (ChUp/PageUp), 428/34 (ChDown/PageDown)
    if (code === 427 || code === 33 || key === 'ChannelUp' || key === 'PageUp') {
      return { type: TV_KEYS.CH_UP };
    }
    if (code === 428 || code === 34 || key === 'ChannelDown' || key === 'PageDown') {
      return { type: TV_KEYS.CH_DOWN };
    }

    // Media Playback Controls
    if (code === 415 || key === 'MediaPlay') return { type: TV_KEYS.PLAY };
    if (code === 19 || key === 'MediaPause') return { type: TV_KEYS.PAUSE };
    if (code === 10252 || code === 179 || key === 'MediaPlayPause') return { type: TV_KEYS.PLAY_PAUSE };
    if (code === 413 || key === 'MediaStop') return { type: TV_KEYS.STOP };

    // TV Info & Search
    if (code === 457 || key === 'Info') return { type: TV_KEYS.INFO };
    if (key === 'Search') return { type: TV_KEYS.SEARCH };

    // Favorite shortcuts: Color keys (Red 403, Yellow 405), Info 457, or 'f' key
    if (code === 403 || key === 'ColorF0Red' || code === 405 || key === 'ColorF2Yellow' || key === 'f' || key === 'F') {
      return { type: TV_KEYS.FAVORITE };
    }

    // Digits 0-9 for channel zapping
    if (code >= 48 && code <= 57) {
      return { type: TV_KEYS.DIGIT, digit: code - 48 };
    }
    if (code >= 96 && code <= 105) {
      return { type: TV_KEYS.DIGIT, digit: code - 96 };
    }

    return null;
  }

  handleKeyDown(event) {
    const action = this.normalizeKey(event);
    if (!action) return;

    // Notify all active listeners
    let handled = false;
    for (const listener of this.listeners) {
      const result = listener(action, event);
      if (result === true) {
        handled = true;
        break;
      }
    }

    // Prevent default browser behavior (e.g. page scrolling, back navigation) for handled TV keys
    if (handled || action.type === TV_KEYS.BACK || action.type === TV_KEYS.UP || action.type === TV_KEYS.DOWN || action.type === TV_KEYS.LEFT || action.type === TV_KEYS.RIGHT) {
      event.preventDefault();
    }
  }
}

export const remoteKeyManager = new RemoteKeyManager();
