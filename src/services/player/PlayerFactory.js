/**
 * TV_Abdul: PlayerFactory & Stream Failover Controller
 * Selects appropriate player engine (Samsung AVPlay vs HTML5) and manages stream fallback.
 */

import { SamsungAVPlayer } from './SamsungAVPlayer.js';
import { Html5Player } from './Html5Player.js';
import { storageService } from '../storageService.js';

class PlayerController {
  constructor() {
    this.player = null;
    this.isSamsungAVPlay = typeof window !== 'undefined' && Boolean(window.webapis && window.webapis.avplay);
    this.currentChannel = null;
    this.currentStreamIndex = 0;
    this.listeners = new Set();
    this.init();
  }

  init(options = {}) {
    const hasAVPlay = typeof window !== 'undefined' && Boolean(window.webapis && window.webapis.avplay);

    if (hasAVPlay) {
      console.log('✔ Initializing native Samsung AVPlay hardware engine.');
      this.player = new SamsungAVPlayer(options);
      this.isSamsungAVPlay = true;
    } else {
      console.log('ℹ Initializing HTML5 / Hls.js streaming player engine.');
      this.player = new Html5Player(options);
      this.isSamsungAVPlay = false;
    }

    // Forward events
    this.player.on('stateChange', (data) => this.notify('stateChange', data));
    this.player.on('buffering', (data) => this.notify('buffering', data));
    this.player.on('error', (data) => this.handleStreamError(data));
    this.player.on('timeupdate', (data) => this.notify('timeupdate', data));
    this.player.on('subtitle', (data) => this.notify('subtitle', data));
    this.player.on('completed', (data) => this.notify('completed', data));
  }

  attachVideoElement(videoEl) {
    if (this.player && !this.isSamsungAVPlay && this.player.attachVideoElement) {
      this.player.attachVideoElement(videoEl);
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event, payload) {
    this.listeners.forEach((fn) => {
      try {
        fn(event, payload);
      } catch (e) {
        console.error('Error in player controller subscriber:', e);
      }
    });
  }

  /**
   * Play a channel, initiating from primary or preferred stream
   */
  async playChannel(channel, streamIndex = 0, playOptions = {}) {
    if (!this.player) {
      this.init();
    }

    this.currentChannel = channel;
    this.currentStreamIndex = streamIndex;
    this.currentPlayOptions = playOptions;

    const streams = channel.streams || [];
    if (streams.length === 0) {
      this.notify('error', { error: `No active streams available for ${channel.name}` });
      return;
    }

    // Ensure valid index
    const activeIndex = Math.min(Math.max(0, streamIndex), streams.length - 1);
    this.currentStreamIndex = activeIndex;
    const stream = streams[activeIndex];

    this.notify('channelStarted', {
      channel,
      streamIndex: activeIndex,
      stream,
      totalStreams: streams.length
    });

    // Record in history & last channel (live channels only, not files or on-demand titles)
    if (!playOptions.isFile) {
      storageService.addRecentChannel(channel);
      storageService.setLastChannelId(channel.id);
    }

    try {
      console.log(`▶ Playing "${channel.name}" on stream [${activeIndex + 1}/${streams.length}]: ${stream.url}`);
      await this.player.open(stream.url, {
        userAgent: stream.userAgent,
        referrer: stream.referrer,
        isFile: Boolean(playOptions.isFile),
        startPosition: playOptions.startPosition || 0
      });
    } catch (err) {
      console.warn(`Stream [${activeIndex}] failed:`, err);
      this.handleStreamError({ error: err.message });
    }
  }

  /**
   * Handle error by attempting automatic fallback to the next available stream
   */
  async handleStreamError(errorPayload) {
    if (!this.currentChannel || !this.currentChannel.streams) {
      this.notify('error', errorPayload);
      return;
    }

    const streams = this.currentChannel.streams;
    const nextIndex = this.currentStreamIndex + 1;

    if (nextIndex < streams.length) {
      console.log(`🔄 Stream ${this.currentStreamIndex + 1} failed. Automatic failover to stream ${nextIndex + 1}/${streams.length}...`);
      this.notify('failover', {
        channel: this.currentChannel,
        failedIndex: this.currentStreamIndex,
        nextIndex,
        totalStreams: streams.length
      });
      // Try next stream after short pause
      setTimeout(() => {
        this.playChannel(this.currentChannel, nextIndex, this.currentPlayOptions || {});
      }, 1000);
    } else {
      console.error(`❌ All ${streams.length} streams failed for ${this.currentChannel.name}.`);
      this.notify('allStreamsFailed', {
        channel: this.currentChannel,
        error: errorPayload.error || 'All stream sources are currently unavailable.'
      });
    }
  }

  async retryCurrent() {
    if (this.currentChannel) {
      await this.playChannel(this.currentChannel, this.currentStreamIndex, this.currentPlayOptions || {});
    }
  }

  /**
   * Play a single seekable source (a local file or a direct on-demand URL).
   * @param {{id: string, name: string, url: string}} file
   * @param {{startPosition?: number}} options startPosition in seconds
   */
  async playFile(file, options = {}) {
    await this.playChannel(
      { id: file.id, name: file.name, streams: [{ url: file.url, quality: '' }] },
      0,
      { isFile: true, startPosition: options.startPosition || 0 }
    );
  }

  async seekTo(seconds) {
    if (this.player) await this.player.seekTo(seconds);
  }

  async seekBy(deltaSeconds) {
    if (!this.player) return 0;
    const duration = this.player.getDuration();
    let target = this.player.getCurrentTime() + deltaSeconds;
    if (duration > 0) target = Math.min(target, Math.max(0, duration - 2));
    target = Math.max(0, target);
    await this.player.seekTo(target);
    return target;
  }

  getDuration() {
    return this.player ? this.player.getDuration() : 0;
  }

  getCurrentTime() {
    return this.player ? this.player.getCurrentTime() : 0;
  }

  getTracks() {
    return this.player ? this.player.getTracks() : { audio: [], text: [] };
  }

  selectTrack(type, index) {
    if (this.player) this.player.selectTrack(type, index);
  }

  setEmbeddedSubtitlesEnabled(enabled) {
    if (this.player) this.player.setEmbeddedSubtitlesEnabled(enabled);
  }

  async playNextStream() {
    if (this.currentChannel && this.currentChannel.streams) {
      const next = (this.currentStreamIndex + 1) % this.currentChannel.streams.length;
      await this.playChannel(this.currentChannel, next);
    }
  }

  async playPreviousStream() {
    if (this.currentChannel && this.currentChannel.streams) {
      const prev = (this.currentStreamIndex - 1 + this.currentChannel.streams.length) % this.currentChannel.streams.length;
      await this.playChannel(this.currentChannel, prev);
    }
  }

  async playStreamIndex(index) {
    if (this.currentChannel && this.currentChannel.streams) {
      if (index >= 0 && index < this.currentChannel.streams.length) {
        await this.playChannel(this.currentChannel, index);
      }
    }
  }

  async play() {
    if (this.player) await this.player.play();
  }

  async pause() {
    if (this.player) await this.player.pause();
  }

  async stop() {
    if (this.player) await this.player.stop();
  }

  async destroy() {
    if (this.player) await this.player.destroy();
    this.currentChannel = null;
  }

  getState() {
    return this.player ? this.player.getState() : 'IDLE';
  }

  getCurrentChannel() {
    return this.currentChannel;
  }

  getCurrentStream() {
    if (this.currentChannel && this.currentChannel.streams) {
      return this.currentChannel.streams[this.currentStreamIndex];
    }
    return null;
  }
}

export const playerController = new PlayerController();
