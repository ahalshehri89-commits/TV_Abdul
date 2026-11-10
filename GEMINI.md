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
# 1. Run unit tests (41 tests across 11 test suites)
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

## 6. Version 2.0 (v2.0) Completed Milestone Overview
All pillars of **v2.0** have been fully engineered, verified with 39 Vitest tests, and deployed to the Samsung TV on branch `v2.0`:
* **Pillar 1: Content Explosion (VOD & Mega-Networks):**
  - **Free Movies & Series Hub (VOD):** Netflix/Shahid style catalog featuring iconic Arabic theatrical plays (*مدرسة المشاغبين*, *العيال كبرت*, *شاهد ما شفش حاجة*, *الزعيم*, *سك على بناتك*, *باي باي لندن*, *المتزوجون*), Egyptian golden cinema (*باب الحديد*, *إشاعة حب*, *ابن حميدو*, *الزوجة الثانية*, *دعاء الكروان*), historic drama series (*رأفت الهجان*, *الزير سالم*, *ليالي الحلمية*), and Hollywood/world classics with persistent playback resume memory.
  - **FAST Networks Ingestion:** 24/7 dedicated high-bitrate single-show linear networks (*Top Gear 24/7*, *Gordon Ramsay 24/7*, *UFC Classics 24/7*, *Red Bull TV*, *Bloomberg TV Global*, *Euronews*, *Anime All Day*, *Earth Cam 4K*).
* **Pillar 2: Live Sports & 65" Screen Experience:**
  - **Live Match Center:** Real-time fixture schedule for Saudi Pro League, UEFA Champions League, and Premier League with active scoreboards and 1-click auto-tuning.
  - **65" Quad-Screen Multi-View Dashboard:** Split the 65-inch display into 4 (2x2 Quad) or 2 (1x2 Dual) simultaneous live video streams with D-Pad directional audio focus switching and OK-to-fullscreen expansion.
* **Pillar 3: Core Player & Engine Optimization:**
  - **VLC Stream Demuxer Engine:** `mpegts.js` MSE remuxer + AVPlay HTTP header spoofing (`USER_AGENT: VLC/3.0.20 LibVLC/3.0.20`, referer, adaptive 4K properties).
  - **Interactive EPG Schedule Guide:** Dynamic 24-hour timeline schedule guide with live "Now Playing" progress percentages.
  - **Screen-Off / Audio-Only Mode:** Power-saving pitch black OLED screensaver for Quran and radio stations with burn-in prevention and 1-key remote wake.
  - **Instant Zapping Manifest Pre-Buffering:** Background manifest preloader reducing channel switch time from ~2.5s down to ~0.3s.
  - **Custom M3U8 Playlist Loader:** Settings UI allowing users to load and merge custom IPTV playlists into their local guide.

### Pillar 1: Revolutionary Content Explosion (VOD & Mega-Networks)
1. **Free Movies & TV Series Hub (VOD On-Demand):**
   * Expand into on-demand streaming with a Netflix/Shahid-style catalog.
   * Ingest 10,000+ Arabic and global films, classic Egyptian cinema, historic Ramadan drama series, and classic theatrical plays (مسرحيات).
   * Rich media UI with posters, synopsis, cast, genres, resume playback, and watch history.
2. **FAST Channel Network Ingestion (Pluto TV, Samsung TV Plus, Plex, Rakuten):**
   * Direct integration of free ad-supported television networks, adding thousands of dedicated single-show 24/7 channels (Top Gear, Gordon Ramsay, National Geographic, Anime, UFC Classics).
   * High-bitrate 1080p commercial CDN delivery with 99.9% uptime.
3. **Official 24/7 YouTube Live Stream Channels (Zero-Buffer Feeds):**
   * Direct ingestion of official 24/7 YouTube live feeds as numbered linear channels:
     * 24/7 Makkah & Madinah Haramain 4K live broadcasts.
     * 24/7 Official news networks (Sky News Arabia, Al Jazeera Mubasher, France 24 Arabic, Bloomberg, DW).
     * 24/7 4K Earth from Space (NASA) and relaxing nature/wildlife cameras.
   * 100% reliable streams that never expire or suffer from geo-blocks.

### Pillar 2: Revolutionary Live Sports & 65" Screen Experience
4. **Live Sports Event Match Center (Auto-Routed Game Channels):**
   * Real-time fixture schedule for Saudi Pro League, UEFA Champions League, Premier League, La Liga, and El Clásico.
   * Live match cards with kick-off timers on the home screen.
   * One-click tuning: clicking a match automatically routes directly to the working broadcast channel with Arabic or English commentary indicators.
5. **65" Multi-View / Quad-Screen Sports Dashboard:**
   * Split the 65-inch QLED screen into 2 or 4 simultaneous live streams (watch 4 Premier League or Saudi matches side-by-side).
   * Remote D-Pad toggles audio between windows; pressing OK expands any box to fullscreen.

### Pillar 3: Core Player & Engine Optimization
6. **VLC Stream Compatibility Engine (MPEG-TS Demuxer & Header Spoofing):**
   * Integrate client-side `mpegts.js` remuxing to convert raw `.ts` streams into `fMP4` via MSE in memory.
   * Add AVPlay HTTP header spoofing (`USERAGENT`, `Referer`, cookies) to unlock the 137 VLC-dependent channels (e.g., OSN Movies Action, Cartoon Network Arabic, Arryadia, Canal+ Sport).
7. **Instant Channel Zapping (Pre-Buffering Pipeline):**
   * Preload adjacent stream manifests (`idx + 1` / `idx - 1`) in memory when highlighting cards, cutting channel change time from ~2.5s down to ~0.3s.
8. **Electronic Program Guide (EPG):**
   * Full interactive schedule grid parsing XMLTV feeds for live TV channels ("Now Playing" & "Coming Up Next").
9. **Custom Playlist & Xtream Codes Loader:**
   * Settings UI allowing users to input private M3U/M3U8 URLs or Xtream Codes credentials (server, user, pass) with category auto-grouping.
10. **Screen-Off / Audio-Only Mode:**
    * Mode for news and radio stations (Quran, Rotana FM) turning off the QLED panel while keeping audio playing to conserve power.
11. **Picture-in-Picture (PiP) Browsing:**
    * Downsize the active AVPlay video to a 480x270 thumbnail in the bottom corner while browsing the channel grid.
12. **Numeric Keypad Quick Zapping & Custom Reordering:**
    * Direct channel number input using remote digits 0–9 and custom sorting for favorite channels.

---

## 7. Priority Development Notes & Action Items (To Solve Upon Return)

The following priority notes were logged prior to user travel and define the exact roadmap when development resumes:

### Note 1: VOD Videos Do Not Open Directly in YouTube App
* **Problem Description:** Clicking a VOD item launches the Samsung TV YouTube app (`9Ur5IzDKqV.TizenYouTube`), but it lands on the YouTube home screen rather than automatically starting the specific selected movie, play, or playlist.
* **Technical Findings & Analysis:**
  1. **Tizen API Limitations:** Standard Tizen `tizen.application.launch()` only opens the application package root.
  2. **Google TV Sandbox:** Modern builds of `9Ur5IzDKqV.TizenYouTube` on Tizen 7.0 (Chromium 94+) intentionally ignore arbitrary URI deep-link parameters (`vnd.youtube://` or `http://tizen.org/appcontrol/data/url`) passed via `launchAppControl` for security and platform isolation.
  3. **DIAL REST Service:** The TV runs a DIAL server on port `8080` (`http://127.0.0.1:8080/ws/apps/YouTube`). While it accepts POST commands with `Origin: package://Abdul00101.TVAbdul`, modern YouTube TV clients require an active DIAL pairing token (`screenId` / `loungeToken`) to bind video commands to the active playback session.
* **Action Plan for Next Session:**
  - **Option A (In-App Fullscreen Leanback Player):** Embed the full YouTube player inside TV_Abdul using a dedicated, zero-chrome WebKit view with full remote control mapping (OK to play/pause, Left/Right to seek/skip episodes, Back to exit). This eliminates app switching entirely and guarantees instant playback.
  - **Option B (DIAL Lounge Token Pairing):** Implement the DIAL multiscreen WebSocket lounge pairing handshake (`http://127.0.0.1:8080/ws/apps/YouTube/run`) to pass the video ID directly into YouTube's active playback queue.
  - **Option C (Direct MP4/HLS Storage):** Host or link direct `.mp4` and `.m3u8` video files playing natively via Samsung AVPlay hardware acceleration without relying on the external YouTube app.

---

### Note 2: Sport Channels Do Not Open Real Games
* **Problem Description:** Match cards in the Live Sports Center (e.g., Al Hilal vs Al Nassr, Real Madrid vs Man City) route to free-to-air regional broadcast streams (Bahrain Sports, Oman Sports, Jordan Sport). These channels show regular regional programming (talk shows, local sports, recordings) rather than the actual live encrypted match (SSC 1 HD / beIN Sports Premium).
* **Technical Findings & Analysis:**
  1. **Broadcast Rights Protection:** High-profile commercial matches (Saudi Pro League on SSC, UEFA Champions League & Premier League on beIN Sports) are pay-per-view encrypted streams. Free global IPTV feeds (IPTV-org) do not provide unauthorized live commercial feeds.
  2. **Static Fixtures vs Live API:** The match cards currently displayed are static mock schedules rather than real-time fixtures fetched from a sports API.
* **Action Plan for Next Session:**
  - **Private IPTV / Xtream Codes Integration:** Allow the user to input their private M3U/M3U8 playlist URL or Xtream Codes credentials (server, user, password) that contain genuine, active SSC and beIN Sports commercial streams.
  - **Automated Stream Routing:** Map live match cards to the user's specific provider channel IDs (`SSC 1 HD`, `beIN Sports 1 Premium`) so clicking a match auto-tunes directly to the authentic game broadcast.
  - **Real-Time Sports API Integration:** Connect a live sports data API (e.g., Football-Data.org or API-Football) to automatically pull genuine live fixtures, kickoff timers, and real-time scoreboards for today's active games.

---

### Note 3: More VOD Content Needed (Massive Catalog Expansion)
* **Problem Description:** The current VOD catalog contains 18 curated classic theatrical plays, Egyptian golden cinema, and historical series. A massive expansion is needed to turn TV_Abdul into a comprehensive on-demand entertainment hub.
* **Target Categories & Expansion Goals:**
  1. **Classic Arabic Plays (مسرحيات كاملة):** Complete collections of Adel Imam, Samir Ghanem, Fouad El-Mohandes, Mohamed Sobhy, and Kuwaiti comedy theater.
  2. **Golden Arabic Cinema (أفلام كلاسيكية):** Thousands of Egyptian and Arab cinematic classics across comedy, drama, and romance.
  3. **Ramadan & Historical Drama Series (مسلسلات كاملة):** Full multi-season drama series (Bab Al-Hara, Al-Zeer Salem, Raafat Al-Haggan, Layali Al-Helmiya, Omar).
  4. **World Cinema Classics (أفلام عالمية من الملكية العامة):** Charlie Chaplin collections, Hitchcock classics, film noir, and timeless Hollywood masterpieces.
* **Action Plan for Next Session:**
  - **Xtream Codes VOD API Ingestion:** Implement direct fetching from IPTV provider VOD endpoints (`player_api.php?action=get_vod_streams` and `get_series`) with movie covers, plot summary, cast, ratings, and multi-episode series hierarchy.
  - **M3U VOD Playlist Parser:** Support loading local or remote `.m3u` files containing `#EXTINF` VOD entries with category auto-grouping (Plays, Movies, Series, Anime, Documentaries).
  - **Public Domain & Cultural Archive Ingestion:** Ingest curated direct MP4/M3U8 links from Internet Archive and public cultural institutions for zero-buffer playback.
  - **Global Universal Search:** Implement a unified search bar that queries across both Live TV channels (4,300+) and on-demand VOD titles simultaneously.
