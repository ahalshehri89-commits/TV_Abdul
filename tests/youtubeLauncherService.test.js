import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { youtubeLauncherService, YOUTUBE_APP_ID } from '../src/services/youtubeLauncherService.js';

describe('YouTubeLauncherService', () => {
  beforeEach(() => {
    global.window = {
      tizen: {
        ApplicationControl: vi.fn().mockImplementation((op, uri) => ({ operation: op, uri })),
        application: {
          launch: vi.fn((appId, success) => success && success()),
          launchAppControl: vi.fn((appControl, appId, success) => success && success())
        }
      },
      open: vi.fn()
    };
  });

  afterEach(() => {
    delete global.window;
  });

  it('should detect Tizen availability', () => {
    expect(youtubeLauncherService.isTizenAvailable()).toBe(true);
  });

  it('should launch official YouTube app on Tizen for a video', () => {
    const res = youtubeLauncherService.openInYouTubeApp({ videoId: '-xieo900Smg' });
    expect(res).toBe(true);
    expect(global.window.tizen.application.launchAppControl).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'vnd.youtube://www.youtube.com/watch?v=-xieo900Smg' }),
      YOUTUBE_APP_ID,
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('should launch official YouTube app on Tizen for a playlist', () => {
    const res = youtubeLauncherService.openInYouTubeApp({ playlistId: 'PL0FoLi-_XKV7aEm-ADraZtqSIktofcIIi' });
    expect(res).toBe(true);
    expect(global.window.tizen.application.launchAppControl).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'vnd.youtube://www.youtube.com/playlist?list=PL0FoLi-_XKV7aEm-ADraZtqSIktofcIIi' }),
      YOUTUBE_APP_ID,
      expect.any(Function),
      expect.any(Function)
    );
  });
});
