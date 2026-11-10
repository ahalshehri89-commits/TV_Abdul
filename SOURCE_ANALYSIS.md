# Source Website Analysis: FreeTV

**Source Target:** [https://freetv.fuckyouthisismywebsite.com/](https://freetv.fuckyouthisismywebsite.com/)  
**Analysis Date:** November 2026  
**Audience:** TV_Abdul Engineering & Deployment Team  

---

## 1. Executive Summary

`https://freetv.fuckyouthisismywebsite.com/` is a modern, high-performance web catalog and player for publicly available, free-to-air live television streams. The site is a React/Vite Single Page Application (SPA) backed by an active, self-hosted API and health-checking engine.

Crucially for our Samsung Smart TV application:
- **No authentication or session cookies** are required to access channel lists or video streams.
- **Direct stream URLs (HLS `.m3u8` and DASH `.mpd`)** are exposed directly in channel metadata and via bulk M3U endpoints.
- Channels utilize standard broadcast formats: **H.264 (AVC) video** and **AAC audio** across 1080p, 720p, and 576p resolutions, with high compatibility for Samsung Tizen OS hardware decoders.
- The service actively monitors stream health (`health.online: 11,941` working streams out of 16,519 probed), allowing our application to filter for reliable, verified online channels.
- An application **does not need to load or embed the website in a WebView**. The native TV app can consume the REST API directly or operate from bundled seed data and M3U playlists.

---

## 2. API Endpoints & Data Architecture

The platform provides a comprehensive REST API:

### 2.1 Meta & Service Health
- **Endpoint:** `GET /api/meta`
- **Output:**
  ```json
  {
    "channels": 31797,
    "streams": 16519,
    "channelsWithStreams": 10386,
    "lastIngest": 1794294114,
    "proxyEnabled": false,
    "hideNsfwDefault": true,
    "version": "0.1.0",
    "health": {
      "probed": 16513,
      "online": 11941,
      "lastProbe": 1794297661
    }
  }
  ```
- **Insight:** Over 10,380 channels have mapped streams, with ~11,940 streams actively verified online.

### 2.2 Category Catalog
- **Endpoint:** `GET /api/categories?withStreams=true`
- **Structure:** Array of 30 categories with channel counts, including `news` (2,304), `sports` (2,401), `entertainment` (2,233), `movies` (1,823), `kids` (987), `documentary` (501), `music` (1,952), `animation` (309), and `education` (814).

### 2.3 Channel Search & Pagination
- **Endpoint:** `GET /api/channels?category={cat}&online={bool}&q={query}&country={code}&language={lang}&page={num}&limit={count}`
- **Sample Query:** `GET /api/channels?category=news&online=true&limit=10`
- **Response Format:**
  ```json
  {
    "total": 832,
    "page": 1,
    "limit": 10,
    "items": [
      {
        "id": "10TV.in",
        "number": 14,
        "name": "10 TV",
        "country": "IN",
        "countryName": "India",
        "flag": "🇮🇳",
        "categories": ["news"],
        "languages": ["tel"],
        "network": null,
        "isNsfw": false,
        "logo": "/logo/10TV.in",
        "streamCount": 3,
        "bestQuality": "720p",
        "online": true,
        "browserPlayable": true,
        "hasGuide": true
      }
    ]
  }
  ```

### 2.4 Channel Details & Multi-Stream Failover
- **Endpoint:** `GET /api/channels/{channelId}`
- **Sample Response:**
  ```json
  {
    "id": "PlusMaisUm.br",
    "name": "+MaisUm",
    "country": "BR",
    "flag": "🇧🇷",
    "categories": [{"id": "general", "name": "General"}, {"id": "movies", "name": "Movies"}],
    "logo": "/logo/PlusMaisUm.br",
    "streams": [
      {
        "index": 0,
        "url": "https://stream.ichibansys.com:3230/hybrid/play.m3u8",
        "title": "+MaisUm",
        "quality": "720p",
        "online": true,
        "relayOnly": false,
        "browserPlayable": true
      }
    ]
  }
  ```

### 2.5 Bulk M3U Export
- **Endpoint:** `GET /api/playlist.m3u`
- **Output:** 2.9 MB standard `#EXTM3U` playlist with `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`, and stream URLs.
- **Utility:** Enables offline importing, backup catalog loading, and standard IPTV interoperability.

### 2.6 Logo Proxy
- **Endpoint:** `GET /logo/{channelId}` (e.g., `https://freetv.fuckyouthisismywebsite.com/logo/BloombergTV.us`)
- **Output:** Returns cached PNG/JPEG images directly with HTTP 200 and long caching headers (`max-age=604800`), eliminating broken external image hosting links.

---

## 3. Streaming Implementation & Codec Verification

### 3.1 Representative Streams Inspected

We conducted `ffprobe` stream inspections on live channels from various regions:

| Channel Name | Channel ID | Category | Stream URL | Codecs Verified | Resolution |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **+MaisUm** | `PlusMaisUm.br` | General / Movies | `https://stream.ichibansys.com:3230/hybrid/play.m3u8` | Video: H.264 (avc1)<br>Audio: AAC | 1280x720 (720p) |
| **Al Jazeera** | `AlJazeera.qa` | News | `https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8` | Video: H.264 (avc1)<br>Audio: AAC | 1920x1080 (1080p) |
| **Sky News** | `SkyNews.ie` | News | `https://dash4.antik.sk/live/test_skynews/playlist.m3u8` | Video: H.264 (avc1)<br>Audio: AAC | 720x576 (SD) |
| **Bloomberg TV** | `BloombergTV.us` | Business / News | `https://bloomberg.com/media-manifest/streams/phoenix-us.m3u8` | Video: H.264 (avc1)<br>Audio: AAC | 1920x1080 (1080p) |

### 3.2 CORS & Mixed Content
- **CORS Headers:** Nearly all major FAST and broadcast CDNs return `Access-Control-Allow-Origin: *`.
- **Mixed Content:** In standard web browsers, HTTP streams cannot be loaded on an HTTPS website. However, on Samsung Smart TVs, **Samsung AVPlay (`webapis.avplay`)** operates at the native OS media pipeline level and plays both `http://` and `https://` streams with full network access when privileged with `<tizen:privilege name="http://tizen.org/privilege/internet"/>` and `<access origin="*" subdomains="true"/>`.

### 3.3 DRM & Authentication
- The FreeTV service curates publicly available FTA (Free-To-Air) and FAST (Free Ad-supported Streaming TV) broadcasts.
- Streams do **not** use Widevine or PlayReady DRM encryption.
- No personal user credentials or private tokens are needed.

---

## 4. Architectural Implications for TV_Abdul

Based on these findings, we established the following architectural decisions:

1. **Native Client Application**: Build a standalone Tizen Web Application using modern React and Vite. Do not embed the original site in a WebView.
2. **Dual Player Pipeline**:
   - Primary: Samsung AVPlay API (`webapis.avplay`) for hardware decoding, 1080p rendering, and TV remote compatibility.
   - Fallback: HTML5 video + Hls.js for browser testing, simulator preview, and desktop development.
3. **Resilient Catalog Layer**:
   - Provide a bundled local seed catalog of ~100 verified top channels across all major categories.
   - Synchronize dynamically with FreeTV's `/api/channels` when network is connected.
   - Support M3U import if the user wishes to supply their own playlist.
4. **Spatial TV Remote Navigation**:
   - Full 10-foot TV user experience with D-pad navigation, visible focus states, channel zapping (Up/Down / Ch+/Ch-), and hardware Back key handling (`10009`).
