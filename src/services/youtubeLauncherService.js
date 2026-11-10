/**
 * TV_Abdul: YouTube TV Application Launcher Service
 * Launches the native Samsung Smart TV YouTube application (9Ur5IzDKqV.TizenYouTube)
 * and uses Samsung DIAL protocol to deep-link directly into the specific video ID or playlist ID.
 */

export const YOUTUBE_APP_ID = '9Ur5IzDKqV.TizenYouTube';

export const youtubeLauncherService = {
  /**
   * Check if running on Samsung Smart TV with Tizen Application API
   */
  isTizenAvailable() {
    return typeof window !== 'undefined' && Boolean(window.tizen && window.tizen.application);
  },

  /**
   * Get TV local IP address if available via Samsung webapis
   */
  getTVIP() {
    try {
      if (typeof window !== 'undefined' && window.webapis && window.webapis.network) {
        return window.webapis.network.getIP();
      }
    } catch (e) {}
    return null;
  },

  /**
   * Send DIAL protocol POST to TV's local REST service to launch specific YouTube video/playlist
   * @param {Object} options
   * @param {string} [options.videoId]
   * @param {string} [options.playlistId]
   * @returns {Promise<boolean>}
   */
  async sendDialLaunch({ videoId, playlistId }) {
    let body = '';
    if (videoId && playlistId) {
      body = `v=${encodeURIComponent(videoId)}&list=${encodeURIComponent(playlistId)}`;
    } else if (playlistId) {
      body = `list=${encodeURIComponent(playlistId)}`;
    } else if (videoId) {
      body = `v=${encodeURIComponent(videoId)}`;
    }

    if (!body) return false;

    const tvIp = this.getTVIP();
    const endpoints = [
      'http://127.0.0.1:8080/ws/apps/YouTube',
      'http://localhost:8080/ws/apps/YouTube'
    ];
    if (tvIp) {
      endpoints.unshift(`http://${tvIp}:8080/ws/apps/YouTube`);
    }

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body
        });
        if (res.ok || res.status === 200 || res.status === 201) {
          console.log('[YouTubeLauncher] DIAL launch succeeded via', endpoint);
          return true;
        }
      } catch (err) {
        // try next endpoint
      }
    }
    return false;
  },

  /**
   * Open a video or playlist in the official Samsung TV YouTube application
   * @param {Object} options
   * @param {string} [options.videoId] - YouTube 11-char Video ID
   * @param {string} [options.playlistId] - YouTube Playlist ID
   * @returns {Promise<boolean>} Whether launch was initiated
   */
  async openInYouTubeApp({ videoId, playlistId }) {
    let targetUrl = '';
    if (playlistId) {
      targetUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    } else if (videoId) {
      targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }

    // 1. Send DIAL request which instructs YouTube to play the specific video/playlist
    try {
      await this.sendDialLaunch({ videoId, playlistId });
    } catch (e) {
      console.warn('[YouTubeLauncher] DIAL launch attempt warning:', e);
    }

    // 2. Ensure YouTube app is brought to foreground on Tizen
    if (this.isTizenAvailable()) {
      try {
        if (window.tizen.ApplicationControl && targetUrl) {
          const appControl = new window.tizen.ApplicationControl(
            'http://tizen.org/appcontrol/operation/view',
            targetUrl,
            null,
            null,
            [
              new window.tizen.ApplicationControlData('payload', [`v=${videoId || ''}`]),
              new window.tizen.ApplicationControlData('url', [targetUrl])
            ]
          );
          window.tizen.application.launchAppControl(
            appControl,
            YOUTUBE_APP_ID,
            () => console.log('[YouTubeLauncher] launchAppControl completed'),
            () => {
              try {
                window.tizen.application.launch(YOUTUBE_APP_ID);
              } catch (e) {}
            }
          );
        } else {
          window.tizen.application.launch(YOUTUBE_APP_ID);
        }
        return true;
      } catch (err) {
        console.error('[YouTubeLauncher] Tizen app launch error:', err);
      }
    }

    // Web / Desktop / Simulator fallback: Open in browser tab
    if (targetUrl && typeof window !== 'undefined') {
      window.open(targetUrl, '_blank');
      return true;
    }

    return false;
  }
};
