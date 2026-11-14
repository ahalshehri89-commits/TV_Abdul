import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { youtubeLauncherService, buildYouTubeParams, YOUTUBE_APP_ID } from '../src/services/youtubeLauncherService.js';

describe('YouTubeLauncherService', () => {
  let launchAppControl;
  let launch;

  beforeEach(() => {
    launchAppControl = vi.fn((appControl, appId, success) => success && success());
    launch = vi.fn((appId, success) => success && success());
    global.window = {
      tizen: {
        ApplicationControl: vi.fn().mockImplementation(function (operation, uri, mime, category, data) {
          return { operation, uri, data };
        }),
        ApplicationControlData: vi.fn().mockImplementation(function (key, value) {
          return { key, value };
        }),
        application: { launch, launchAppControl }
      },
      open: vi.fn()
    };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.window;
    delete global.fetch;
    vi.restoreAllMocks();
  });

  it('builds parameter strings for videos, playlists and both', () => {
    expect(buildYouTubeParams({ videoId: '-xieo900Smg' })).toBe('v=-xieo900Smg');
    expect(buildYouTubeParams({ playlistId: 'PL123' })).toBe('list=PL123');
    expect(buildYouTubeParams({ videoId: 'abc', playlistId: 'PL123' })).toBe('v=abc&list=PL123');
    expect(buildYouTubeParams({})).toBe('');
  });

  it('launches YouTube with the deep-link payload first', async () => {
    const ok = await youtubeLauncherService.openInYouTubeApp({ videoId: '-xieo900Smg' });
    expect(ok).toBe(true);
    const [appControl, appId] = launchAppControl.mock.calls[0];
    expect(appId).toBe(YOUTUBE_APP_ID);
    expect(appControl.data[0].key).toBe('PAYLOAD');
    expect(JSON.parse(appControl.data[0].value[0])).toEqual({ values: 'v=-xieo900Smg' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(launch).not.toHaveBeenCalled();
  });

  it('falls back to DIAL when the deep-link launch is rejected', async () => {
    launchAppControl.mockImplementation((appControl, appId, success, error) => error({ message: 'NotFoundError' }));
    const ok = await youtubeLauncherService.openInYouTubeApp({ playlistId: 'PL123' });
    expect(ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ws/apps/YouTube'),
      expect.objectContaining({ method: 'POST', body: 'list=PL123' })
    );
    expect(launch).not.toHaveBeenCalled();
  });

  it('falls back to a plain launch when deep link and DIAL both fail', async () => {
    launchAppControl.mockImplementation((appControl, appId, success, error) => error({ message: 'x' }));
    global.fetch = vi.fn().mockRejectedValue(new Error('refused'));
    const ok = await youtubeLauncherService.openInYouTubeApp({ videoId: 'abc' });
    expect(ok).toBe(true);
    expect(launch).toHaveBeenCalledWith(YOUTUBE_APP_ID, expect.any(Function), expect.any(Function));
  });

  it('does nothing without a video or playlist', async () => {
    expect(await youtubeLauncherService.openInYouTubeApp({})).toBe(false);
    expect(launchAppControl).not.toHaveBeenCalled();
  });

  it('opens a browser tab off the TV', async () => {
    delete global.window.tizen;
    const ok = await youtubeLauncherService.openInYouTubeApp({ videoId: 'abc', playlistId: 'PL1' });
    expect(ok).toBe(true);
    expect(global.window.open).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc&list=PL1', '_blank');
  });
});
