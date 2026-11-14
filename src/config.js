/**
 * TV_Abdul: deployment configuration.
 */

const env = import.meta.env || {};

// HTTPS page that hosts YouTube's embedded player for the app (source: hosted/yt.html).
// YouTube rejects embeds from a packaged app's own origin, so this must be a web address.
export const YT_WRAPPER_URL = env.VITE_YT_WRAPPER_URL || 'https://ahalshehri89-commits.github.io/TV_Abdul/yt.html';

// Generated data (catalog, programme guide), rebuilt by the scheduled GitHub workflow.
export const DATA_BASE_URL =
  env.VITE_DATA_BASE_URL || 'https://raw.githubusercontent.com/ahalshehri89-commits/TV_Abdul/gh-pages/data';

// Football data service key. The service's shared test key works with tight limits;
// put your own in .env.local as VITE_SPORTS_API_KEY.
export const SPORTS_API_KEY = env.VITE_SPORTS_API_KEY || '123';
