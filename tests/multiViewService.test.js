import { describe, it, expect } from 'vitest';
import { multiViewService, MULTIVIEW_MODES } from '../src/services/multiViewService.js';

describe('MultiViewService', () => {
  it('should initialize with quad mode and 4 slots', () => {
    const state = multiViewService.getState();
    expect(state.mode).toBe(MULTIVIEW_MODES.QUAD);
    expect(state.slots.length).toBe(4);
    expect(state.slots[0].isMuted).toBe(false);
    expect(state.slots[1].isMuted).toBe(true);
  });

  it('should switch audio focus properly', () => {
    multiViewService.setAudioFocus(2);
    const state = multiViewService.getState();
    expect(state.focusedSlotIndex).toBe(2);
    expect(state.slots[2].isMuted).toBe(false);
    expect(state.slots[0].isMuted).toBe(true);
    expect(state.slots[1].isMuted).toBe(true);
  });

  it('should navigate directional audio focus using D-Pad', () => {
    multiViewService.setAudioFocus(0);
    // Move RIGHT: 0 -> 1
    const next1 = multiViewService.navigate('RIGHT');
    expect(next1).toBe(1);

    // Move DOWN: 1 -> 3
    const next2 = multiViewService.navigate('DOWN');
    expect(next2).toBe(3);

    // Move LEFT: 3 -> 2
    const next3 = multiViewService.navigate('LEFT');
    expect(next3).toBe(2);

    // Move UP: 2 -> 0
    const next4 = multiViewService.navigate('UP');
    expect(next4).toBe(0);
  });

  it('should switch between QUAD and DUAL mode', () => {
    multiViewService.setMode(MULTIVIEW_MODES.DUAL);
    expect(multiViewService.getState().mode).toBe(MULTIVIEW_MODES.DUAL);

    multiViewService.setMode(MULTIVIEW_MODES.QUAD);
    expect(multiViewService.getState().mode).toBe(MULTIVIEW_MODES.QUAD);
  });
});
