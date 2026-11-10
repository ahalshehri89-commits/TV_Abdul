import { describe, it, expect } from 'vitest';
import { remoteKeyManager, TV_KEYS } from '../src/services/remoteKeyManager.js';

describe('RemoteKeyManager', () => {
  it('should normalize Samsung Tizen Back key (keyCode 10009)', () => {
    const action = remoteKeyManager.normalizeKey({ keyCode: 10009, key: '' });
    expect(action).toEqual({ type: TV_KEYS.BACK });
  });

  it('should normalize Samsung Channel Up and Down keys (427, 428)', () => {
    const chUp = remoteKeyManager.normalizeKey({ keyCode: 427, key: 'ChannelUp' });
    expect(chUp).toEqual({ type: TV_KEYS.CH_UP });

    const chDown = remoteKeyManager.normalizeKey({ keyCode: 428, key: 'ChannelDown' });
    expect(chDown).toEqual({ type: TV_KEYS.CH_DOWN });
  });

  it('should normalize D-Pad arrow keys and Enter', () => {
    expect(remoteKeyManager.normalizeKey({ keyCode: 38, key: 'ArrowUp' })).toEqual({ type: TV_KEYS.UP });
    expect(remoteKeyManager.normalizeKey({ keyCode: 40, key: 'ArrowDown' })).toEqual({ type: TV_KEYS.DOWN });
    expect(remoteKeyManager.normalizeKey({ keyCode: 37, key: 'ArrowLeft' })).toEqual({ type: TV_KEYS.LEFT });
    expect(remoteKeyManager.normalizeKey({ keyCode: 39, key: 'ArrowRight' })).toEqual({ type: TV_KEYS.RIGHT });
    expect(remoteKeyManager.normalizeKey({ keyCode: 13, key: 'Enter' })).toEqual({ type: TV_KEYS.ENTER });
  });

  it('should normalize media control keys', () => {
    expect(remoteKeyManager.normalizeKey({ keyCode: 415, key: 'MediaPlay' })).toEqual({ type: TV_KEYS.PLAY });
    expect(remoteKeyManager.normalizeKey({ keyCode: 19, key: 'MediaPause' })).toEqual({ type: TV_KEYS.PAUSE });
    expect(remoteKeyManager.normalizeKey({ keyCode: 10252, key: 'MediaPlayPause' })).toEqual({ type: TV_KEYS.PLAY_PAUSE });
  });

  it('should normalize Info and Favorite shortcuts', () => {
    expect(remoteKeyManager.normalizeKey({ keyCode: 457, key: 'Info' })).toEqual({ type: TV_KEYS.INFO });
    expect(remoteKeyManager.normalizeKey({ keyCode: 403, key: 'ColorF0Red' })).toEqual({ type: TV_KEYS.FAVORITE });
    expect(remoteKeyManager.normalizeKey({ keyCode: 405, key: 'ColorF2Yellow' })).toEqual({ type: TV_KEYS.FAVORITE });
    expect(remoteKeyManager.normalizeKey({ keyCode: 70, key: 'f' })).toEqual({ type: TV_KEYS.FAVORITE });
  });
});
