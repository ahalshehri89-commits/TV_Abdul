/**
 * TV_Abdul v2.0: MultiViewService
 * Manages 65-inch Quad-Screen (2x2) and Dual-Screen live multi-view streaming.
 * Handles slot assignment, audio focus switching, and fullscreen toggle.
 */

export const MULTIVIEW_MODES = {
  QUAD: 'quad',       // 2x2 grid (4 streams)
  DUAL: 'dual',       // 1x2 side-by-side (2 streams)
  TRIPLE: 'triple'    // 1 large + 2 small
};

class MultiViewService {
  constructor() {
    this.mode = MULTIVIEW_MODES.QUAD;
    this.focusedSlotIndex = 0; // The slot receiving audio and D-Pad focus
    this.slots = [
      { id: 'slot-0', channel: null, isMuted: false },
      { id: 'slot-1', channel: null, isMuted: true },
      { id: 'slot-2', channel: null, isMuted: true },
      { id: 'slot-3', channel: null, isMuted: true }
    ];
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => fn(this.getState()));
  }

  getState() {
    return {
      mode: this.mode,
      focusedSlotIndex: this.focusedSlotIndex,
      slots: [...this.slots]
    };
  }

  setMode(mode) {
    if (Object.values(MULTIVIEW_MODES).includes(mode)) {
      this.mode = mode;
      this.notify();
    }
  }

  setSlotChannel(index, channel) {
    if (index >= 0 && index < this.slots.length) {
      this.slots[index] = {
        ...this.slots[index],
        channel: channel
      };
      this.notify();
    }
  }

  setInitialChannels(channels = []) {
    for (let i = 0; i < this.slots.length; i++) {
      if (channels[i]) {
        this.slots[i].channel = channels[i];
      }
    }
    this.notify();
  }

  setAudioFocus(index) {
    if (index >= 0 && index < this.slots.length) {
      this.focusedSlotIndex = index;
      this.slots = this.slots.map((slot, i) => ({
        ...slot,
        isMuted: i !== index
      }));
      this.notify();
    }
  }

  navigate(direction) {
    // 0: Top-Left, 1: Top-Right, 2: Bottom-Left, 3: Bottom-Right
    let cur = this.focusedSlotIndex;
    if (this.mode === MULTIVIEW_MODES.DUAL) {
      if (direction === 'LEFT' || direction === 'RIGHT') {
        cur = cur === 0 ? 1 : 0;
      }
    } else {
      switch (direction) {
        case 'RIGHT':
          if (cur === 0) cur = 1;
          else if (cur === 2) cur = 3;
          break;
        case 'LEFT':
          if (cur === 1) cur = 0;
          else if (cur === 3) cur = 2;
          break;
        case 'DOWN':
          if (cur === 0) cur = 2;
          else if (cur === 1) cur = 3;
          break;
        case 'UP':
          if (cur === 2) cur = 0;
          else if (cur === 3) cur = 1;
          break;
      }
    }
    this.setAudioFocus(cur);
    return cur;
  }
}

export const multiViewService = new MultiViewService();
