/**
 * TV_Abdul: Html5Player
 * Standard HTML5 Video + Hls.js fallback player for browser, simulator, and development environments.
 */

import Hls from 'hls.js';
import { BasePlayer, PLAYER_STATES } from './PlayerInterface.js';

export class Html5Player extends BasePlayer {
  constructor(options = {}) {
    super(options);
    this.videoElement = options.videoElement || null;
    this.hls = null;
    this.currentUrl = null;

    this.onWaiting = this.onWaiting.bind(this);
    this.onPlaying = this.onPlaying.bind(this);
    this.onPause = this.onPause.bind(this);
    this.onError = this.onError.bind(this);
    this.onTimeUpdate = this.onTimeUpdate.bind(this);
  }

  attachVideoElement(element) {
    if (this.videoElement) {
      this.detachListeners();
    }
    this.videoElement = element;
    if (this.videoElement) {
      this.attachListeners();
    }
  }

  attachListeners() {
    if (!this.videoElement) return;
    this.videoElement.addEventListener('waiting', this.onWaiting);
    this.videoElement.addEventListener('playing', this.onPlaying);
    this.videoElement.addEventListener('pause', this.onPause);
    this.videoElement.addEventListener('error', this.onError);
    this.videoElement.addEventListener('timeupdate', this.onTimeUpdate);
  }

  detachListeners() {
    if (!this.videoElement) return;
    this.videoElement.removeEventListener('waiting', this.onWaiting);
    this.videoElement.removeEventListener('playing', this.onPlaying);
    this.videoElement.removeEventListener('pause', this.onPause);
    this.videoElement.removeEventListener('error', this.onError);
    this.videoElement.removeEventListener('timeupdate', this.onTimeUpdate);
  }

  onWaiting() {
    this.setState(PLAYER_STATES.BUFFERING);
    this.emit('buffering', { isBuffering: true, percent: 0 });
  }

  onPlaying() {
    this.setState(PLAYER_STATES.PLAYING);
    this.emit('buffering', { isBuffering: false, percent: 100 });
  }

  onPause() {
    if (this.state !== PLAYER_STATES.STOPPED) {
      this.setState(PLAYER_STATES.PAUSED);
    }
  }

  onError(e) {
    console.error('HTML5 video element error:', e);
    const mediaError = this.videoElement ? this.videoElement.error : null;
    const msg = mediaError ? `Video error code: ${mediaError.code}` : 'Unknown video playback error';
    this.setState(PLAYER_STATES.ERROR, { error: msg });
    this.emit('error', { error: msg });
  }

  onTimeUpdate() {
    if (this.videoElement) {
      this.emit('timeupdate', { currentTime: this.videoElement.currentTime });
    }
  }

  async open(url, options = {}) {
    await this.stop();
    this.currentUrl = url;
    this.setState(PLAYER_STATES.CONNECTING, { url });

    if (!this.videoElement) {
      throw new Error('Html5Player requires an attached <video> element.');
    }

    const isHls = url.includes('.m3u8') || url.includes('/hls');

    if (isHls && Hls.isSupported()) {
      return new Promise((resolve, reject) => {
        this.hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
          xhrSetup: (xhr) => {
            if (options.userAgent) {
              // Custom headers if possible
            }
          }
        });

        this.hls.loadSource(url);
        this.hls.attachMedia(this.videoElement);

        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          this.videoElement
            .play()
            .then(() => {
              this.setState(PLAYER_STATES.PLAYING);
              resolve();
            })
            .catch((playErr) => {
              console.warn('Autoplay prevented, retrying muted:', playErr);
              this.videoElement.muted = true;
              this.videoElement
                .play()
                .then(() => {
                  this.setState(PLAYER_STATES.PLAYING);
                  resolve();
                })
                .catch((e) => {
                  this.setState(PLAYER_STATES.ERROR, { error: e.message });
                  reject(e);
                });
            });
        });

        this.hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('Fatal HLS.js error:', data.type, data.details);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                this.hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                this.hls.recoverMediaError();
                break;
              default:
                this.setState(PLAYER_STATES.ERROR, { error: data.details });
                this.emit('error', { error: `Stream failed: ${data.details}` });
                reject(new Error(data.details));
                break;
            }
          }
        });
      });
    } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
      // Native browser HLS (Safari/iOS) or standard MP4/WebM
      this.videoElement.src = url;
      return this.videoElement
        .play()
        .then(() => {
          this.setState(PLAYER_STATES.PLAYING);
        })
        .catch((err) => {
          this.setState(PLAYER_STATES.ERROR, { error: err.message });
          throw err;
        });
    } else {
      throw new Error('HLS playback is not supported in this browser environment.');
    }
  }

  async play() {
    if (this.videoElement) {
      try {
        await this.videoElement.play();
        this.setState(PLAYER_STATES.PLAYING);
      } catch (e) {
        console.warn('Play call failed:', e);
      }
    }
  }

  async pause() {
    if (this.videoElement) {
      this.videoElement.pause();
      this.setState(PLAYER_STATES.PAUSED);
    }
  }

  async stop() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute('src');
      this.videoElement.load();
    }
    this.setState(PLAYER_STATES.STOPPED);
  }

  async destroy() {
    await this.stop();
    this.detachListeners();
    this.videoElement = null;
    this.currentUrl = null;
  }
}
