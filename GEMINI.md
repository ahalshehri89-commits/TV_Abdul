# TV_Abdul: Project Context, Memory & Architecture Guide

This document preserves the comprehensive architecture, hardware findings, and implementation rules for **TV_Abdul** for future development sessions and **v2.0**.

---

## 1. Project Overview & Identity
* **Application Name:** `TV_Abdul`
* **Application ID:** `Abdul00101.TVAbdul`
* **Package ID:** `Abdul00101`
* **Target Hardware:** Samsung Q60CA 65" (`QA65Q60CAUXSA`, 2023 QLED; the TV reports Tizen 9.0 with a Chromium 120 web engine as of November 2026)
* **Resolution:** 1920x1080 (1080p Full HD UI canvas with hardware upscaling)
* **GitHub Repository:** [https://github.com/ahalshehri89-commits/TV_Abdul](https://github.com/ahalshehri89-commits/TV_Abdul)

---

## 2. Samsung Smart TV Critical Engineering Rules

### A. AVPlay Hardware Video Acceleration (`webapis.avplay`)
1. **Underlying Video Plane:** AVPlay outputs video onto a native hardware graphics plane positioned *behind* the WebKit web layout.
2. **Transparency Requirement:** During video playback, `html`, `body`, `#root`, and `.tv-player-view` **must** have:
   ```css
   background: transparent !important;
   background-color: transparent !important;
   ```
   Any opaque background element will cause **audio-only playback with a black screen**.
3. **Display Rectangle & Aspect Ratio:**
   * **Do NOT use:** `PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO` on Tizen 7.0 (it can collapse the display rectangle to 0x0 or 1x1 pixels).
   * **Always use:**
     ```javascript
     webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
     webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
     ```
4. **Permissions:** Both `config.xml` and `public/config.xml` must declare:
   ```xml
   <tizen:privilege name="http://developer.samsung.com/privilege/avplay"/>
   <tizen:privilege name="http://developer.samsung.com/privilege/network.public"/>
   <tizen:privilege name="http://tizen.org/privilege/internet"/>
   <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
   <tizen:privilege name="http://tizen.org/privilege/tv.window"/>
   ```
5. **DOM Object Surface:** The native player surface `<object id="av-player" type="application/avplayer">` must be mounted in the DOM with `isAVPlay` evaluated synchronously from `Boolean(window.webapis && window.webapis.avplay)`.

---

## 3. Remote Control Navigation Architecture (`spatialNav.js`)
* **TV Layout Zones:**
  * `header`: Country filter button, Favorites, Search, Settings.
  * `categories`: Category pills (All Channels, Arabic, Favorites, News, Sports, etc.).
  * `grid`: 5-column channel grid.
  * `modal`: Country modal (3-column grid) & Search/Settings modals.
* **Deterministic D-Pad Movement:**
  * `RIGHT`: `idx + 1` (strictly next channel card).
  * `LEFT`: `idx - 1` (strictly previous channel card).
  * `DOWN`: `idx + 5` (next row down). Approaching bottom emits `onLoadMore` to append 60 cards.
  * `UP`: `idx - 5` (row above). Transitions to Category pills **only** if on the top row (`idx < 5`).
* **In-Player Remote Controls:**
  * `◄` / `►` (Left/Right): Switches between multi-stream sources (e.g. `Source 1 of 4` to `Source 2 of 4`).
  * `▲` / `▼` (Up/Down / ChUp/ChDown): Changes to next/previous channel.
  * `OK` / `Enter`: If OSD is open, toggles Favorite.
  * `Info` / `Color Keys` (Red/Yellow): Toggles Favorite at any time.
  * `Back`: Returns to channel guide.

---

## 4. Catalog & Streaming Architecture
* **Total Channels:** 4,314 verified global channels across 153 countries in `src/data/seedChannels.json`.
* **Arabic Focus:** 274 Arabic channels across Saudi Arabia (48), UAE (32), Lebanon (30), Egypt (14), Qatar, Kuwait, etc.
* **Infinite Batching:** Initial render is 60 cards. Increments by 60 on scroll, keeping DOM node count under ~600 elements for constant 60fps on TV hardware.
* **Cloud Sync (`channelSyncService.js`):**
  * Auto-syncs in the background 5 seconds after TV boot from IPTV-org CDN.
  * Persists updates to IndexedDB (`TV_Abdul_Cache`).
  * Manual sync trigger available in Settings modal.

---

## 5. Build, Package & Deployment Workflow

```bash
# 1. Run unit tests (97 tests across 16 test files)
npm test

# 2. Compile Vite production bundle
npm run build

# 3. Package signed Tizen WGT with profile TV_Abdul
cd dist && ../tools/data/tools/ide/bin/tizen.sh package -t wgt -s TV_Abdul -- /Users/abdullahalshehri/Desktop/TV_Abdul/dist

# 4. Connect TV over local Wi-Fi / Ethernet
./tools/data/tools/sdb connect <TV_IP>:26101

# 5. Install WGT to Samsung TV
cd dist && ../tools/data/tools/ide/bin/tizen.sh install -s <TV_IP>:26101 -n TV_Abdul.wgt -- /Users/abdullahalshehri/Desktop/TV_Abdul/dist

# 6. Launch on TV
./tools/data/tools/sdb -s <TV_IP>:26101 shell 0 execute Abdul00101.TVAbdul
```

---

## 6. What Is Real In v2.1 (state on 12 November 2026)

Everything below was either measured on the TV or is covered by unit tests; items that are
not yet proven on the TV say so.

### Works, checked on the TV
* **Live TV:** 4,300+ channels, AVPlay playback, favourites, country filter, background sync.
* **In-app YouTube playback:** videos and playlists play inside the app at up to 1080p, through
  the hosted page `hosted/yt.html` (served by GitHub Pages from the `gh-pages` branch).
  YouTube rejects embeds from the packaged app's own `file://` origin with error 153, which is
  why the hosted page exists. Playlists must be embedded through `embed/videoseries`; an empty
  player never becomes ready on the TV.
* **Hand-off to the YouTube app:** automatic when a title cannot be embedded (errors 101/150,
  page unreachable, no start in 12 s) and manual with the Red key. The TV accepts the deep-link
  launch (`PAYLOAD` = `{"values":"v=<id>"}`); whether YouTube lands on the video still has to be
  confirmed by eye.
* **Direct-file playback:** Internet Archive films play through AVPlay with a known duration.
* **Data downloads:** catalog (386 public-domain films), programme guide (94 channels) and
  football fixtures all load on the TV.

### Built and unit-tested, not yet proven on the TV
* **My Files (USB):** folder browser, video playback with seek/resume, `.srt` subtitles
  (UTF-8, UTF-16, Windows-1256), embedded subtitle/audio track switching, picture viewer.
  The TV accepted the `filesystem.read` and `externalstorage` privileges and lists its
  storages, but no USB drive was connected during development.
* **M3U playlist loader:** Settings -> My Playlists. A playlist is only saved after it downloads
  and contains channels; its channels appear under the "My Playlists" category.
* **Quad view:** unchanged from v2.0 and never tested on the TV. It decodes in software.

### Data pipeline
* `.github/workflows/data.yml` runs daily (from the default branch only) and publishes
  `data/catalog.json` and `data/epg.json` to the `gh-pages` branch.
* `scripts/catalog/` builds the catalog: Internet Archive (no key) and the approved YouTube
  owner channels in `scripts/catalog/channels.json` (needs the `YOUTUBE_API_KEY` repository
  secret; without it only the Internet Archive part is built).
* `scripts/epg/` builds the guide from public XMLTV feeds (`scripts/epg/feeds.json`). Channels
  are matched to the app's list by exact normalised name; unmatched channels get no guide.
* Sports fixtures come straight from TheSportsDB on the TV. The shared test key works with
  tight limits; set `VITE_SPORTS_API_KEY` in `.env.local` for your own key.

### Known gaps
* The featured shelf (`src/data/seedVOD.json`) is mostly uploads from non-owner YouTube
  channels. Dead links were removed and the world classics now come from Internet Archive,
  but the Arabic titles still need replacing with owner-channel uploads.
* The network-folder source for My Files is not built.
* Match cards are information only; `match.watch` is reserved for a channel link.

### Development aids (`scripts/dev/`)
* `deploy-tv.sh <TV_IP> [debug]` builds, signs, installs and launches the app.
* `tv-log-server.js <file>` collects console output from a debug build (one-way; it never
  sends anything to the TV). `sdb shell 0 debug` does not work on this TV.
