# TV_Abdul: Project Context, Memory & Architecture Guide

This document preserves the comprehensive architecture, hardware findings, and implementation rules for **TV_Abdul** for future development sessions and **v2.0**.

---

## 1. Project Overview & Identity
* **Application Name:** `TV_Abdul`
* **Application ID:** `Abdul00101.TVAbdul`
* **Package ID:** `Abdul00101`
* **Target Hardware:** Samsung Q60CA 65" (`QA65Q60CAUXSA`, 2023 QLED, Tizen 7.0 / Platform 9.0)
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
# 1. Run unit tests (19 tests)
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

## 6. Roadmap for Version 2.0 (v2.0)
When resuming work for v2.0, the prioritized feature roadmap includes:

### Core Player & Streaming Enhancements
1. **VLC Stream Compatibility Engine (MPEG-TS Demuxer & Header Spoofing):**
   * Integrate client-side `mpegts.js` remuxing to convert raw `.ts` streams into `fMP4` via MSE in memory.
   * Add AVPlay HTTP header spoofing (`USERAGENT`, `Referer`, cookies) to unlock the 137 VLC-dependent channels (e.g., OSN Movies Action, Cartoon Network Arabic, Arryadia, Canal+ Sport).
2. **Instant Channel Zapping (Pre-Buffering Pipeline):**
   * Preload adjacent stream manifests (`idx + 1` / `idx - 1`) in memory when highlighting cards, cutting channel change time from ~2.5s down to ~0.3s.
3. **Electronic Program Guide (EPG):**
   * Full interactive schedule grid parsing XMLTV feeds for live TV channels ("Now Playing" & "Coming Up Next").
4. **Custom Playlist & Xtream Codes Loader:**
   * Settings UI allowing users to input private M3U/M3U8 URLs or Xtream Codes credentials (server, user, pass) with category auto-grouping.

### UI & Remote Control Features
5. **Numeric Keypad Quick Zapping:**
   * Direct channel number input using remote digits 0–9 with a mini-overlay HUD (e.g. typing `1` jumps to channel #1).
6. **Picture-in-Picture (PiP) Browsing:**
   * Downsize the active AVPlay video to a 480x270 thumbnail in the bottom corner while browsing the channel grid.
7. **Favorites Custom Sorting & Numbering:**
   * Allow users to reorder favorite channels and assign custom quick-dial numbers (e.g. #1 for Saudi TV, #2 for Al Arabiya).
8. **Audio & Subtitle Track Selector:**
   * In-player HUD menu allowing users to switch audio commentary (Arabic/English) or toggle DVB subtitles.
9. **Screen-Off / Audio-Only Mode:**
   * Mode for news and radio stations (Quran, Rotana FM) turning off the QLED panel while keeping audio playing to conserve power.
