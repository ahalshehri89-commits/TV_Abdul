/**
 * TV_Abdul: SamsungAVPlayer
 * Hardware-accelerated streaming video player for Samsung Smart TV (Tizen OS)
 * utilizing window.webapis.avplay.
 */

import { BasePlayer, PLAYER_STATES } from './PlayerInterface.js';

export class SamsungAVPlayer extends BasePlayer {
  constructor(options = {}) {
    super(options);
    this.avplay = window.webapis && window.webapis.avplay ? window.webapis.avplay : null;
    this.currentUrl = null;
    this.displayRect = { x: 0, y: 0, width: 1920, height: 1080 };
  }

  isAvailable() {
    return Boolean(this.avplay);
  }

  setDisplayRect(x = 0, y = 0, width = 1920, height = 1080) {
    this.displayRect = { x, y, width, height };
    if (!this.avplay) return;
    try {
      this.avplay.setDisplayRect(x, y, width, height);
    } catch (e) {
      console.warn('AVPlay setDisplayRect error:', e);
    }
  }

  async open(url, options = {}) {
    if (!this.avplay) {
      throw new Error('Samsung AVPlay API is not available on this device.');
    }

    // Safely reset any previous session
    await this.stop();

    this.currentUrl = url;
    this.setState(PLAYER_STATES.CONNECTING, { url });

    try {
      this.avplay.open(url);

      // Set display rectangle and aspect ratio (Always letterbox / 1920x1080 Full HD)
      const { x, y, width, height } = this.displayRect;
      this.avplay.setDisplayRect(x, y, width, height);
      try {
        this.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
      } catch (err) {}

      // Configure streaming properties (VLC compatibility header spoofing)
      const userAgent = options.userAgent || 'VLC/3.0.20 LibVLC/3.0.20 (TV_Abdul v2.0)';
      try {
        this.avplay.setStreamingProperty('USER_AGENT', userAgent);
      } catch (e) {
        try {
          this.avplay.setStreamingProperty('USERAGENT', userAgent);
        } catch (e2) {}
      }

      if (options.referer) {
        try {
          this.avplay.setStreamingProperty('CUSTOM_MESSAGE', `Referer: ${options.referer}`);
        } catch (e) {}
      }

      if (options.cookie) {
        try {
          this.avplay.setStreamingProperty('COOKIE', options.cookie);
        } catch (e) {}
      }

      // Configure adaptive bitrate & 4K decoding if supported
      try {
        this.avplay.setStreamingProperty('ADAPTIVE_INFO', 'STARTBITRATE=HIGHEST');
      } catch (e) {}

      // Set hardware event listeners
      this.avplay.setListener({
        onbufferingstart: () => {
          this.setState(PLAYER_STATES.BUFFERING);
          this.emit('buffering', { isBuffering: true, percent: 0 });
        },
        onbufferingprogress: (percent) => {
          this.emit('buffering', { isBuffering: true, percent });
        },
        onbufferingcomplete: () => {
          try {
            this.avplay.setDisplayRect(this.displayRect.x, this.displayRect.y, this.displayRect.width, this.displayRect.height);
          } catch (e) {}
          this.setState(PLAYER_STATES.PLAYING);
          this.emit('buffering', { isBuffering: false, percent: 100 });
        },
        oncurrentplaytime: (time) => {
          this.emit('timeupdate', { currentTime: time / 1000 });
        },
        onevent: (eventType, eventData) => {
          console.log(`AVPlay event: ${eventType}`, eventData);
        },
        onerror: (eventType) => {
          console.error(`AVPlay hardware error: ${eventType}`);
          this.setState(PLAYER_STATES.ERROR, { error: eventType });
          this.emit('error', { error: `Playback error: ${eventType}` });
        },
        onstreamcompleted: () => {
          console.log('Stream completed.');
          this.setState(PLAYER_STATES.STOPPED);
        }
      });

      // Prepare asynchronously
      return new Promise((resolve, reject) => {
        this.avplay.prepareAsync(
          () => {
            try {
              const { x, y, width, height } = this.displayRect;
              this.avplay.setDisplayRect(x, y, width, height);
              this.avplay.play();
              this.setState(PLAYER_STATES.PLAYING);
              resolve();
            } catch (playErr) {
              this.setState(PLAYER_STATES.ERROR, { error: playErr.message });
              reject(playErr);
            }
          },
          (prepErr) => {
            console.error('AVPlay prepareAsync error:', prepErr);
            this.setState(PLAYER_STATES.ERROR, { error: prepErr });
            this.emit('error', { error: `Failed to prepare stream: ${prepErr}` });
            reject(new Error(`AVPlay prepare error: ${prepErr}`));
          }
        );
      });
    } catch (err) {
      console.error('AVPlay open failed:', err);
      this.setState(PLAYER_STATES.ERROR, { error: err.message });
      throw err;
    }
  }

  async play() {
    if (!this.avplay) return;
    try {
      this.avplay.play();
      this.setState(PLAYER_STATES.PLAYING);
    } catch (e) {
      console.warn('AVPlay play failed:', e);
    }
  }

  async pause() {
    if (!this.avplay) return;
    try {
      this.avplay.pause();
      this.setState(PLAYER_STATES.PAUSED);
    } catch (e) {
      console.warn('AVPlay pause failed:', e);
    }
  }

  async stop() {
    if (!this.avplay) return;
    try {
      const state = this.avplay.getState();
      if (state !== 'NONE' && state !== 'IDLE') {
        this.avplay.stop();
      }
      this.avplay.close();
    } catch (e) {
      // Ignore cleanup errors during teardown
    } finally {
      this.setState(PLAYER_STATES.STOPPED);
    }
  }

  async destroy() {
    await this.stop();
    this.currentUrl = null;
  }
}
