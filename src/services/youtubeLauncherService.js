/**
 * TV_Abdul: YouTube TV Application Launcher Service
 * Launches the native Samsung Smart TV YouTube application (9Ur5IzDKqV.TizenYouTube)
 * with deep linking to specific video IDs or playlist IDs.
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
   * Open a video or playlist in the official Samsung TV YouTube application
   * @param {Object} options
   * @param {string} [options.videoId] - YouTube 11-char Video ID
   * @param {string} [options.playlistId] - YouTube Playlist ID
   * @returns {boolean} Whether launch was initiated
   */
  openInYouTubeApp({ videoId, playlistId }) {
    let targetUrl = '';
    let deepLinkUri = '';

    if (playlistId) {
      targetUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
      deepLinkUri = `vnd.youtube://www.youtube.com/playlist?list=${playlistId}`;
    } else if (videoId) {
      targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
      deepLinkUri = `vnd.youtube://www.youtube.com/watch?v=${videoId}`;
    }

    if (this.isTizenAvailable()) {
      try {
        if (window.tizen.ApplicationControl && (deepLinkUri || targetUrl)) {
          // Attempt 1: Launch via ApplicationControl with deep-link URI
          const uriToUse = deepLinkUri || targetUrl;
          const appControl = new window.tizen.ApplicationControl(
            'http://tizen.org/appcontrol/operation/view',
            uriToUse,
            null,
            null,
            null
          );

          window.tizen.application.launchAppControl(
            appControl,
            YOUTUBE_APP_ID,
            () => {
              console.log('[YouTubeLauncher] Successfully launched YouTube with deep link:', uriToUse);
            },
            (err) => {
              console.warn('[YouTubeLauncher] launchAppControl failed, trying standard launch:', err);
              // Attempt 2: Fallback to standard launch
              try {
                window.tizen.application.launch(
                  YOUTUBE_APP_ID,
                  () => console.log('[YouTubeLauncher] Standard YouTube launch succeeded'),
                  (e) => console.error('[YouTubeLauncher] Standard launch failed:', e)
                );
              } catch (e2) {
                console.error('[YouTubeLauncher] Fallback launch error:', e2);
              }
            }
          );
          return true;
        } else {
          // Direct launch of YouTube app
          window.tizen.application.launch(
            YOUTUBE_APP_ID,
            () => console.log('[YouTubeLauncher] Launched YouTube app'),
            (err) => console.error('[YouTubeLauncher] Launch error:', err)
          );
          return true;
        }
      } catch (err) {
        console.error('[YouTubeLauncher] Tizen launch error:', err);
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
