import React from 'react';
import { Trophy, Play, Radio, Clock, Shield, Volume2, Tv } from 'lucide-react';
import { sportsService } from '../services/sportsService.js';

const LIVE_SPORTS_CHANNELS = [
  {
    id: 'live-ch-bahrain-1',
    name: 'Bahrain Sports 1 HD',
    nameAr: 'البحرين الرياضية 1',
    flag: '🇧🇭',
    url: 'https://5c7b683162943.streamlock.net/live/ngrp:sportsone_all/playlist.m3u8'
  },
  {
    id: 'live-ch-oman-sports',
    name: 'Oman Sports HD',
    nameAr: 'عُمان الرياضية',
    flag: '🇴🇲',
    url: 'https://partneta.cdn.mgmlcdn.com/omsport/smil:omsport.stream.smil/chunklist.m3u8'
  },
  {
    id: 'live-ch-jordan-sport',
    name: 'Jordan Sport HD',
    nameAr: 'الأردن الرياضية',
    flag: '🇯🇴',
    url: 'https://jrtv-live.ercdn.net/jordansporthd/jordansporthd.m3u8'
  },
  {
    id: 'live-ch-bahrain-2',
    name: 'Bahrain Sports 2 HD',
    nameAr: 'البحرين الرياضية 2',
    flag: '🇧🇭',
    url: 'https://5c7b683162943.streamlock.net/live/ngrp:bahrainsportstwo_all/playlist.m3u8'
  },
  {
    id: 'live-ch-ktv-sport',
    name: 'KTV Sport Plus HD',
    nameAr: 'كويت سبورت بلس',
    flag: '🇰🇼',
    url: 'https://kwtsplta.cdn.mangomolo.com/spl/smil:spl.stream.smil/chunklist.m3u8'
  },
  {
    id: 'live-ch-iraqia-sport',
    name: 'Al Iraqia Sport HD',
    nameAr: 'العراقية الرياضية',
    flag: '🇮🇶',
    url: 'https://imn-live.esite-lab.com/hls/iraqia-sports-1.m3u8'
  },
  {
    id: 'live-ch-bein-news',
    name: 'beIN SPORTS News HD',
    nameAr: 'بي إن سبورتس الإخبارية',
    flag: '🇶🇦',
    youtubeId: '2lJZPT6OljI',
    url: 'https://partneta.cdn.mgmlcdn.com/omsport/smil:omsport.stream.smil/chunklist.m3u8'
  },
  {
    id: 'live-ch-redbull-tv',
    name: 'Red Bull TV Sports',
    nameAr: 'ريد بول للرياضات العالمية',
    flag: '🔴',
    url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8'
  }
];

export function SportsMatchCenter({ onTuneChannel }) {
  const matches = sportsService.getMatches();
  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcomingMatches = matches.filter((m) => m.status === 'upcoming');

  const handleTuneMatch = (match) => {
    onTuneChannel({
      id: match.id,
      number: 1,
      name: `${match.homeTeam.nameAr} ضد ${match.awayTeam.nameAr} (${match.broadcastChannelName})`,
      logo: match.homeTeam.logo,
      streams: match.backupStreams || [{ url: match.targetStreamUrl, quality: '1080p' }],
      country: 'SA',
      categories: ['sports']
    });
  };

  const handleTuneSportsChannel = (ch) => {
    onTuneChannel({
      id: ch.id,
      number: 1,
      name: `${ch.nameAr} (${ch.name})`,
      logo: 'logos/al-hilal.svg',
      streams: [{ url: ch.url, quality: '1080p Full HD' }],
      youtubeId: ch.youtubeId,
      country: 'SA',
      categories: ['sports']
    });
  };

  const getTeamLogoFallback = (nameAr) =>
    `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="%231e293b" stroke="%2338bdf8" stroke-width="2"/><text x="32" y="38" font-family="sans-serif" font-size="14" font-weight="bold" fill="%2338bdf8" text-anchor="middle">${encodeURIComponent(nameAr?.slice(0, 3) || 'FC')}</text></svg>`;

  return (
    <div className="tv-sports-center">
      <div className="tv-sports-header">
        <div className="tv-sports-header-title">
          <Trophy size={28} color="#eab308" />
          <h2>مركز المباريات والرياضة المباشرة • Live Match Center</h2>
        </div>
        <div className="tv-sports-header-sub">
          جدول مباريات دوري روشن السعودي، دوري أبطال أوروبا والدوريات الكبرى مع البث الرياضي المباشر الفوري
        </div>
      </div>

      {/* 24/7 Live Sports Dedicated Channels Bar */}
      <div className="tv-sports-channels-section">
        <div className="tv-sports-channels-header">
          <Tv size={20} color="#38bdf8" />
          <span>القنوات الرياضية الفضائية المباشرة (24/7 Live Sports Channels):</span>
        </div>
        <div className="tv-sports-channels-bar" role="tablist">
          {LIVE_SPORTS_CHANNELS.map((ch) => (
            <button
              key={ch.id}
              className="tv-sports-channel-pill"
              data-nav="true"
              data-nav-zone="categories"
              data-nav-id={`pill-${ch.id}`}
              onClick={() => handleTuneSportsChannel(ch)}
            >
              <span className="tv-sports-pill-flag">{ch.flag}</span>
              <span className="tv-sports-pill-name">{ch.nameAr}</span>
              <span className="tv-sports-pill-badge">مباشر HD</span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Matches Section */}
      {liveMatches.length > 0 && (
        <div className="tv-sports-section">
          <div className="tv-sports-section-title-wrap">
            <span className="tv-live-dot pulse" />
            <h3 className="tv-sports-section-title">مباريات جارية الآن • LIVE NOW</h3>
          </div>

          <div className="tv-sports-grid">
            {liveMatches.map((match) => (
              <div
                key={match.id}
                className="tv-match-card tv-match-card-live"
                tabIndex={0}
                data-nav="true"
                data-nav-zone="grid"
                data-nav-id={`match-${match.id}`}
                onClick={() => handleTuneMatch(match)}
              >
                <div className="tv-match-card-top">
                  <span className="tv-match-league">{match.leagueAr} • {match.round}</span>
                  <span className="tv-match-live-tag">
                    <Radio size={14} />
                    <span>مباشر {match.minute}</span>
                  </span>
                </div>

                <div className="tv-match-scoreboard">
                  {/* Home Team */}
                  <div className="tv-match-team">
                    <img
                      src={match.homeTeam.logo}
                      alt={match.homeTeam.name}
                      className="tv-match-logo"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getTeamLogoFallback(match.homeTeam.nameAr);
                      }}
                    />
                    <span className="tv-match-team-name">{match.homeTeam.nameAr}</span>
                    <span className="tv-match-team-en">{match.homeTeam.name}</span>
                  </div>

                  {/* Score */}
                  <div className="tv-match-score-box">
                    <div className="tv-match-score">{match.score}</div>
                    <div className="tv-match-status-label">{match.minute}</div>
                  </div>

                  {/* Away Team */}
                  <div className="tv-match-team">
                    <img
                      src={match.awayTeam.logo}
                      alt={match.awayTeam.name}
                      className="tv-match-logo"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getTeamLogoFallback(match.awayTeam.nameAr);
                      }}
                    />
                    <span className="tv-match-team-name">{match.awayTeam.nameAr}</span>
                    <span className="tv-match-team-en">{match.awayTeam.name}</span>
                  </div>
                </div>

                <div className="tv-match-card-footer">
                  <div className="tv-match-channel-info">
                    <Volume2 size={15} color="#38bdf8" />
                    <span>{match.commentary}</span>
                  </div>
                  <div className="tv-match-tune-btn">
                    <Play size={16} fill="#ffffff" />
                    <span>مشاهدة البث • {match.broadcastChannelName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Fixtures Section */}
      <div className="tv-sports-section">
        <div className="tv-sports-section-title-wrap">
          <Clock size={20} color="#94a3b8" />
          <h3 className="tv-sports-section-title">المباريات القادمة • UPCOMING FIXTURES</h3>
        </div>

        <div className="tv-sports-grid">
          {upcomingMatches.map((match) => (
            <div
              key={match.id}
              className="tv-match-card"
              tabIndex={0}
              data-nav="true"
              data-nav-zone="grid"
              data-nav-id={`match-${match.id}`}
              onClick={() => handleTuneMatch(match)}
            >
              <div className="tv-match-card-top">
                <span className="tv-match-league">{match.leagueAr} • {match.round}</span>
                <span className="tv-match-time-tag">
                  <Clock size={13} />
                  <span>{match.time}</span>
                </span>
              </div>

              <div className="tv-match-scoreboard">
                <div className="tv-match-team">
                  <img
                    src={match.homeTeam.logo}
                    alt={match.homeTeam.name}
                    className="tv-match-logo"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getTeamLogoFallback(match.homeTeam.nameAr);
                    }}
                  />
                  <span className="tv-match-team-name">{match.homeTeam.nameAr}</span>
                  <span className="tv-match-team-en">{match.homeTeam.name}</span>
                </div>

                <div className="tv-match-vs-box">
                  <span className="tv-match-vs">VS</span>
                  <span className="tv-match-kickoff">{match.time}</span>
                </div>

                <div className="tv-match-team">
                  <img
                    src={match.awayTeam.logo}
                    alt={match.awayTeam.name}
                    className="tv-match-logo"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getTeamLogoFallback(match.awayTeam.nameAr);
                    }}
                  />
                  <span className="tv-match-team-name">{match.awayTeam.nameAr}</span>
                  <span className="tv-match-team-en">{match.awayTeam.name}</span>
                </div>
              </div>

              <div className="tv-match-card-footer">
                <div className="tv-match-channel-info">
                  <Shield size={14} color="#94a3b8" />
                  <span>{match.broadcastChannelName} ({match.commentary})</span>
                </div>
                <div className="tv-match-tune-btn tv-match-tune-upcoming">
                  <Play size={14} />
                  <span>انتقل للقناة الناقلة</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
