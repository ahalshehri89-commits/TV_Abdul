/**
 * TV_Abdul: Player Interface
 * Abstract contract for streaming media engines.
 */

export const PLAYER_STATES = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  BUFFERING: 'BUFFERING',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  ERROR: 'ERROR'
};

export class BasePlayer {
  constructor(options = {}) {
    this.options = options;
    this.state = PLAYER_STATES.IDLE;
    this.listeners = {
      stateChange: new Set(),
      buffering: new Set(),
      error: new Set(),
      timeupdate: new Set(),
      subtitle: new Set(),
      completed: new Set()
    };
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].add(callback);
    }
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in player listener for ${event}:`, err);
        }
      });
    }
  }

  setState(newState, payload = {}) {
    this.state = newState;
    this.emit('stateChange', { state: newState, ...payload });
  }

  getState() {
    return this.state;
  }

  // Abstract methods to override
  async open(url, options = {}) {
    throw new Error('Method open() must be implemented.');
  }

  async play() {
    throw new Error('Method play() must be implemented.');
  }

  async pause() {
    throw new Error('Method pause() must be implemented.');
  }

  async stop() {
    throw new Error('Method stop() must be implemented.');
  }

  async destroy() {
    throw new Error('Method destroy() must be implemented.');
  }

  setDisplayRect(x, y, width, height) {
    // Default no-op
  }

  // Seekable-media support (files and on-demand video). Times are in seconds.
  async seekTo(seconds) {}

  getDuration() {
    return 0;
  }

  getCurrentTime() {
    return 0;
  }

  /** @returns {{audio: Array, text: Array}} selectable tracks, each { index, label } */
  getTracks() {
    return { audio: [], text: [] };
  }

  selectTrack(type, index) {}

  setEmbeddedSubtitlesEnabled(enabled) {}
}
