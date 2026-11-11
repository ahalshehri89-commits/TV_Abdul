/**
 * TV_Abdul: SamsungAVPlayer
 * Hardware-accelerated streaming video player for Samsung Smart TV (Tizen OS)
 * utilizing window.webapis.avplay.
 *
 * Handles both live streams and seekable media (local files, direct on-demand URLs).
 * Public time values are in seconds; AVPlay itself works in milliseconds.
 */

import { BasePlayer, PLAYER_STATES } from './PlayerInterface.js';

/**
 * Build a readable label for an AVPlay track from its extra_info JSON.
 */
export function describeTrack(track, position) {
  let info = {};
  try {
    info = typeof track.extra_info === 'string' ? JSON.parse(track.extra_info) : track.extra_info || {};
  } catch (e) {
    info = {};
  }
  const language = info.language || info.track_lang || info.subtitle_lang || '';
  const parts = [`${position}`];
  if (language && language !== 'und') parts.push(String(language).toUpperCase());
  if (info.fourCC) parts.push(String(info.fourCC).toUpperCase());
  if (info.channels) parts.push(`${info.channels}ch`);
  return parts.join(' · ');
}

export class SamsungAVPlayer extends BasePlayer {
  constructor(options = {}) {
    super(options);
    this.avplay = window.webapis && window.webapis.avplay ? window.webapis.avplay : null;
    this.currentUrl = null;
    this.displayRect = { x: 0, y: 0, width: 1920, height: 1080 };
    this.lastTimeMs = 0;
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
    this.lastTimeMs = 0;
    this.setState(PLAYER_STATES.CONNECTING, { url });

    try {
      this.avplay.open(url);

      // Set display rectangle and aspect ratio (Always letterbox / 1920x1080 Full HD)
      const { x, y, width, height } = this.displayRect;
      this.avplay.setDisplayRect(x, y, width, height);
      try {
        this.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
      } catch (err) {}

      if (options.isFile) {
        // Local files and direct on-demand video: allow UHD decoding, no stream header spoofing.
        try {
          this.avplay.setStreamingProperty('SET_MODE_4K', 'TRUE');
        } catch (e) {}
      } else {
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
      }

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
          this.setState(this.isPausedByUser ? PLAYER_STATES.PAUSED : PLAYER_STATES.PLAYING);
          this.emit('buffering', { isBuffering: false, percent: 100 });
        },
        oncurrentplaytime: (time) => {
          this.lastTimeMs = time;
          this.emit('timeupdate', { currentTime: time / 1000 });
        },
        onsubtitlechange: (duration, text) => {
          this.emit('subtitle', { text: String(text || ''), durationMs: Number(duration) || 0 });
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
          this.emit('completed', {});
        }
      });

      this.isPausedByUser = false;
      const startMs = Math.max(0, Math.floor((options.startPosition || 0) * 1000));

      // Prepare asynchronously
      return new Promise((resolve, reject) => {
        this.avplay.prepareAsync(
          () => {
            const begin = () => {
              try {
                const rect = this.displayRect;
                this.avplay.setDisplayRect(rect.x, rect.y, rect.width, rect.height);
                this.avplay.play();
                this.setState(PLAYER_STATES.PLAYING);
                resolve();
              } catch (playErr) {
                this.setState(PLAYER_STATES.ERROR, { error: playErr.message });
                reject(playErr);
              }
            };
            if (startMs > 0) {
              try {
                // Resume: seek while READY, then start. A failed seek still plays from the start.
                this.avplay.seekTo(startMs, begin, begin);
              } catch (seekErr) {
                begin();
              }
            } else {
              begin();
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
      this.isPausedByUser = false;
      this.setState(PLAYER_STATES.PLAYING);
    } catch (e) {
      console.warn('AVPlay play failed:', e);
    }
  }

  async pause() {
    if (!this.avplay) return;
    try {
      this.avplay.pause();
      this.isPausedByUser = true;
      this.setState(PLAYER_STATES.PAUSED);
    } catch (e) {
      console.warn('AVPlay pause failed:', e);
    }
  }

  seekTo(seconds) {
    if (!this.avplay || !isFinite(seconds)) return Promise.resolve();
    const targetMs = Math.max(0, Math.floor(seconds * 1000));
    return new Promise((resolve) => {
      try {
        this.avplay.seekTo(
          targetMs,
          () => {
            this.lastTimeMs = targetMs;
            this.emit('timeupdate', { currentTime: targetMs / 1000 });
            resolve();
          },
          (err) => {
            console.warn('AVPlay seek failed:', err);
            resolve();
          }
        );
      } catch (e) {
        console.warn('AVPlay seek threw:', e);
        resolve();
      }
    });
  }

  getDuration() {
    if (!this.avplay) return 0;
    try {
      return (this.avplay.getDuration() || 0) / 1000;
    } catch (e) {
      return 0;
    }
  }

  getCurrentTime() {
    if (!this.avplay) return 0;
    try {
      return (this.avplay.getCurrentTime() || 0) / 1000;
    } catch (e) {
      return this.lastTimeMs / 1000;
    }
  }

  getTracks() {
    const result = { audio: [], text: [] };
    if (!this.avplay) return result;
    try {
      const tracks = this.avplay.getTotalTrackInfo() || [];
      tracks.forEach((track) => {
        if (track.type === 'AUDIO') {
          result.audio.push({ index: track.index, label: describeTrack(track, result.audio.length + 1) });
        } else if (track.type === 'TEXT') {
          result.text.push({ index: track.index, label: describeTrack(track, result.text.length + 1) });
        }
      });
    } catch (e) {
      console.warn('AVPlay getTotalTrackInfo failed:', e);
    }
    return result;
  }

  selectTrack(type, index) {
    if (!this.avplay) return;
    try {
      this.avplay.setSelectTrack(type === 'text' ? 'TEXT' : 'AUDIO', index);
    } catch (e) {
      console.warn('AVPlay setSelectTrack failed:', e);
    }
  }

  setEmbeddedSubtitlesEnabled(enabled) {
    if (!this.avplay) return;
    try {
      this.avplay.setSilentSubtitle(!enabled);
    } catch (e) {}
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
