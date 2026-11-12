# TV_Abdul: Samsung Smart TV Application

**TV_Abdul** is a dedicated, remote-controlled native Samsung Smart TV application running on **Tizen OS**. It provides a 10-foot television interface for free, publicly available live TV channels, on-demand films and series from official sources, football fixtures, and your own files on a USB drive.

---

## Screenshots

Captured from the v2.1 build at the TV's 1920x1080 resolution.

| Live TV | Movies & Series |
| :---: | :---: |
| ![Live TV channel guide](screenshots/01_live_tv.png) | ![Movies and series catalog](screenshots/02_movies_and_series.png) |
| **Match Centre** | **My Files** |
| ![Match centre with real fixtures](screenshots/03_match_centre.png) | ![My Files USB browser](screenshots/04_my_files.png) |

My Files is shown as it appears in a desktop browser; on the TV it lists the connected USB drive.

---

## Key Features

- **Live TV:** more than 4,300 free, publicly available channels from 150+ countries, with favourites, a country filter, search, automatic failover between a channel's sources, and a daily background refresh of the channel list.
- **Movies & Series:** about 6,100 on-demand titles: series, plays, films, classic TV, documentaries and kids' programmes from official YouTube owner channels (played inside the app, with a hand-off to the TV's YouTube app when a title cannot be embedded), plus public-domain world cinema from Internet Archive played directly by the TV.
- **Match Centre:** real fixtures and results for the Saudi Pro League, Premier League, Champions League and La Liga.
- **My Files:** browse a USB drive connected to the TV and play videos with seek, resume, `.srt` and embedded subtitles and audio-track switching, or view pictures.
- **Programme guide:** real schedules for the channels that publish one.
- **My Playlists:** add your own M3U playlist address in Settings and its channels join the guide.
- **Samsung AVPlay engine (`webapis.avplay`):** hardware-accelerated playback on the TV, with an HTML5 + `Hls.js` fallback for development in a desktop browser.
- **Remote-first interface:** a spatial navigation engine for the D-pad, Back, channel and media keys, with a 1920x1080 ten-foot layout.

How it is built, the Samsung TV rules it relies on, and what has been verified on the TV are described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Samsung TV Remote Control Mapping

| Remote Button | Key Code | Action in Application |
| :--- | :--- | :--- |
| **D-Pad Up / Down / Left / Right** | `38, 40, 37, 39` | Directional spatial navigation between cards and tabs |
| **Enter / OK / Select** | `13` | Launch selected channel or toggle OSD |
| **Return / Back** | `10009` *(or `27`, `8`)* | Return from video player to guide; close dialogs; exit app |
| **Channel Up / Channel Down** | `427, 428` *(or `33, 34`)* | Instant channel zapping during playback |
| **Media Play / Pause** | `415, 19, 10252, 179` | Toggle video stream play and pause |
| **Left / Right (in Player)** | `37, 39` | Live TV: switch between a channel's sources. Films and files: seek |
| **Red** | `403` | In the YouTube player: open the title in the TV's YouTube app |
| **Search Button** | `Search` | Open TV search modal with instant query filtering |

---

## Project Structure

```text
TV_Abdul/
├── config.xml              # Samsung Tizen application manifest
├── index.html              # Application entry point
├── hosted/yt.html          # HTTPS page that hosts YouTube's embedded player for the app
├── src/
│   ├── App.jsx             # View coordinator and remote-key router
│   ├── config.js           # Hosted-page and data addresses, sports key
│   ├── components/         # Screens: channel grid, players, VOD, sports, My Files, guide, settings
│   ├── services/           # Catalog, players (AVPlay / HTML5), navigation, storage, guide, sports, playlists
│   └── data/               # Bundled channel list and featured on-demand shelf
├── scripts/
│   ├── catalog/            # Builds the on-demand catalog (YouTube owner channels, Internet Archive)
│   ├── epg/                # Builds the programme guide from public XMLTV feeds
│   ├── dev/                # Deploy-to-TV script and debug log collector
│   └── package-wgt.js      # Packages dist/ into TV_Abdul.wgt
├── tests/                  # Vitest unit tests
├── docs/ARCHITECTURE.md    # Engineering notes
└── .github/workflows/      # Daily job that refreshes the catalog and guide
```

The daily job publishes its output to the `gh-pages` branch, which the TV reads. It needs a `YOUTUBE_API_KEY` repository secret for the YouTube part of the catalog.

---

## Development & Build Commands

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite
npm test

# 3. Start local development server (with HTML5/Hls.js preview)
npm run dev

# 4. Compile production distribution
npm run build

# 5. Build Samsung Tizen package (TV_Abdul.wgt)
npm run package
```

---

## Installation on Samsung Smart TV

For complete step-by-step instructions on enabling Developer Mode, connecting via SDB / Tizen Studio, creating Samsung certificates, and sideloading `TV_Abdul.wgt` from a Windows PC, refer to:

👉 **[INSTALLATION.md](INSTALLATION.md)**
