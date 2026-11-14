/**
 * TV_Abdul: YouTube TV Application Launcher Service
 * Hands a video or playlist off to the TV's own YouTube application.
 *
 * Three routes are tried in order, most specific first:
 *   1. App control with Samsung's deep-link payload ({"values": "v=<id>"} under the PAYLOAD key),
 *      the format the TV itself uses when another surface deep-links into an app.
 *   2. The TV's local DIAL service, which launches YouTube with the same parameters.
 *   3. A plain launch of the YouTube app (lands on its home screen).
 */

export const YOUTUBE_APP_ID = '9Ur5IzDKqV.TizenYouTube';
const DEEP_LINK_OPERATION = 'http://tizen.org/appcontrol/operation/default';

/** Build the "v=...&list=..." parameter string YouTube's TV app understands. */
export function buildYouTubeParams({ videoId, playlistId }) {
  const parts = [];
  if (videoId) parts.push(`v=${encodeURIComponent(videoId)}`);
  if (playlistId) parts.push(`list=${encodeURIComponent(playlistId)}`);
  return parts.join('&');
}

export const youtubeLauncherService = {
  /**
   * Check if running on Samsung Smart TV with Tizen Application API
   */
  isTizenAvailable() {
    return typeof window !== 'undefined' && Boolean(window.tizen && window.tizen.application);
  },

  /**
   * Launch YouTube through app control carrying the deep-link payload.
   * @returns {Promise<boolean>} true when the TV accepted the launch
   */
  launchWithPayload(params) {
    return new Promise((resolve) => {
      try {
        const { tizen } = window;
        const appControl = new tizen.ApplicationControl(DEEP_LINK_OPERATION, null, null, null, [
          new tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: params })])
        ]);
        tizen.application.launchAppControl(
          appControl,
          YOUTUBE_APP_ID,
          () => {
            console.log('[YouTubeLauncher] deep-link launch accepted:', params);
            resolve(true);
          },
          (err) => {
            console.warn('[YouTubeLauncher] deep-link launch rejected:', err && err.message);
            resolve(false);
          }
        );
      } catch (e) {
        console.warn('[YouTubeLauncher] deep-link launch threw:', e && e.message);
        resolve(false);
      }
    });
  },

  /**
   * Send DIAL protocol POST to TV's local REST service to launch specific YouTube video/playlist
   * @returns {Promise<boolean>}
   */
  async sendDialLaunch({ videoId, playlistId }) {
    const body = buildYouTubeParams({ videoId, playlistId });
    if (!body) return false;

    const endpoints = ['http://127.0.0.1:8080/ws/apps/YouTube', 'http://localhost:8080/ws/apps/YouTube'];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body
        });
        if (res.ok) {
          console.log('[YouTubeLauncher] DIAL launch succeeded via', endpoint);
          return true;
        }
      } catch (err) {
        // try next endpoint
      }
    }
    return false;
  },

  launchPlain() {
    return new Promise((resolve) => {
      try {
        window.tizen.application.launch(YOUTUBE_APP_ID, () => resolve(true), () => resolve(false));
      } catch (e) {
        resolve(false);
      }
    });
  },

  /**
   * Open a video or playlist in the TV's YouTube application.
   * @param {Object} options
   * @param {string} [options.videoId] - YouTube 11-char Video ID
   * @param {string} [options.playlistId] - YouTube Playlist ID
   * @returns {Promise<boolean>} Whether a launch was initiated
   */
  async openInYouTubeApp({ videoId, playlistId }) {
    const params = buildYouTubeParams({ videoId, playlistId });
    if (!params) return false;

    if (this.isTizenAvailable()) {
      if (await this.launchWithPayload(params)) return true;
      if (await this.sendDialLaunch({ videoId, playlistId })) return true;
      return this.launchPlain();
    }

    // Web / Desktop / Simulator fallback: Open in browser tab
    if (typeof window !== 'undefined' && window.open) {
      const targetUrl = videoId
        ? `https://www.youtube.com/watch?v=${videoId}${playlistId ? `&list=${playlistId}` : ''}`
        : `https://www.youtube.com/playlist?list=${playlistId}`;
      window.open(targetUrl, '_blank');
      return true;
    }
    return false;
  }
};
