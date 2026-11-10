import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { youtubeLauncherService, YOUTUBE_APP_ID } from '../src/services/youtubeLauncherService.js';

describe('YouTubeLauncherService', () => {
  beforeEach(() => {
    global.window = {
      tizen: {
        ApplicationControl: vi.fn().mockImplementation((op, uri) => ({ operation: op, uri })),
        ApplicationControlData: vi.fn().mockImplementation((key, val) => ({ key, value: val })),
        application: {
          launch: vi.fn((appId, success) => success && success()),
          launchAppControl: vi.fn((appControl, appId, success) => success && success())
        }
      },
      open: vi.fn()
    };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    delete global.window;
    delete global.fetch;
  });

  it('should detect Tizen availability', () => {
    expect(youtubeLauncherService.isTizenAvailable()).toBe(true);
  });

  it('should send DIAL POST request to TV local service', async () => {
    const res = await youtubeLauncherService.sendDialLaunch({ videoId: '-xieo900Smg' });
    expect(res).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ws/apps/YouTube'),
      expect.objectContaining({
        method: 'POST',
        body: 'v=-xieo900Smg'
      })
    );
  });

  it('should launch official YouTube app on Tizen for a video with DIAL', async () => {
    const res = await youtubeLauncherService.openInYouTubeApp({ videoId: '-xieo900Smg' });
    expect(res).toBe(true);
    expect(global.window.tizen.application.launchAppControl).toHaveBeenCalled();
  });

  it('should launch official YouTube app on Tizen for a playlist', async () => {
    const res = await youtubeLauncherService.openInYouTubeApp({ playlistId: 'PL0FoLi-_XKV7aEm-ADraZtqSIktofcIIi' });
    expect(res).toBe(true);
    expect(global.window.tizen.application.launchAppControl).toHaveBeenCalled();
  });
});
