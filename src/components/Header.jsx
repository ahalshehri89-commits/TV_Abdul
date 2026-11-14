import React, { useState, useEffect } from 'react';
import { Search, Settings, Heart, Tv, Globe, Film, Trophy, Grid, Calendar, Usb } from 'lucide-react';
import { storageService } from '../services/storageService.js';
import { catalogService } from '../services/catalogService.js';

export function Header({
  activeView = 'live_tv',
  onSelectView,
  activeCountry,
  totalChannels = 0,
  favoritesCount = 0,
  onOpenMultiView,
  onOpenEPG,
  onOpenCountryModal,
  onOpenSearch,
  onOpenSettings,
  onSelectCategory
}) {
  const [timeStr, setTimeStr] = useState('');

  const countries = catalogService.getCountries();
  const activeCountryObj = countries.find((c) => c.code === activeCountry) || countries[0];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="tv-header">
      <div className="tv-logo-area">
        <Tv size={36} color="#38bdf8" />
        <h1 className="tv-brand-title">TV_Abdul</h1>
        <div className="tv-live-pill">
          <span className="tv-live-dot" />
          <span>v2.1</span>
        </div>
      </div>

      {/* Top Level Platform Navigation Modes */}
      <nav className="tv-platform-nav" role="tablist">
        <button
          className={`tv-platform-tab ${activeView === 'live_tv' ? 'active' : ''}`}
          data-nav="true"
          data-nav-zone="header"
          data-nav-id="tab-live-tv"
          onClick={() => onSelectView && onSelectView('live_tv')}
        >
          <Tv size={17} />
          <span>Live TV</span>
        </button>

        <button
          className={`tv-platform-tab ${activeView === 'vod' ? 'active' : ''}`}
          data-nav="true"
          data-nav-zone="header"
          data-nav-id="tab-vod"
          onClick={() => onSelectView && onSelectView('vod')}
        >
          <Film size={17} />
          <span>Movies &amp; Series</span>
        </button>

        <button
          className={`tv-platform-tab ${activeView === 'sports' ? 'active' : ''}`}
          data-nav="true"
          data-nav-zone="header"
          data-nav-id="tab-sports"
          onClick={() => onSelectView && onSelectView('sports')}
        >
          <Trophy size={17} />
          <span>Sports</span>
        </button>

        <button
          className={`tv-platform-tab ${activeView === 'files' ? 'active' : ''}`}
          data-nav="true"
          data-nav-zone="header"
          data-nav-id="tab-files"
          onClick={() => onSelectView && onSelectView('files')}
        >
          <Usb size={17} />
          <span>My Files</span>
        </button>
      </nav>

      <div className="tv-header-actions">
        {/* Multi-View Quad-Screen Button */}
        <button
          className="tv-header-btn"
          data-nav="true"
          data-nav-zone="header"
          data-nav-id="btn-multiview"
          onClick={onOpenMultiView}
        >
          <Grid size={18} color="#38bdf8" />
          <span>Multi-View</span>
        </button>

        {/* EPG Program Guide Button */}
        <button
          className="tv-header-btn"
          data-nav="true"
          data-nav-zone="header"
          data-nav-id="btn-epg"
          onClick={onOpenEPG}
        >
          <Calendar size={18} color="#94a3b8" />
          <span>Guide</span>
        </button>

        {/* Country / Region Filter Button */}
        <button
          className={`tv-header-btn ${activeCountry !== 'all' ? 'tv-header-btn-active' : ''}`}
          data-nav="true"
          data-nav-zone="header"
          data-nav-id="btn-country"
          onClick={onOpenCountryModal}
        >
          <Globe size={18} color={activeCountry !== 'all' ? '#38bdf8' : '#94a3b8'} />
          <span>
            {activeCountryObj && activeCountryObj.code !== 'all' ? `${activeCountryObj.flag} ${activeCountryObj.name}` : 'Countries'}
          </span>
        </button>

        <button
          className="tv-header-btn"
          data-nav="true"
          data-nav-zone="header"
          data-nav-id="btn-favorites"
          onClick={() => onSelectCategory('favorites')}
        >
          <Heart size={18} color="#f43f5e" fill="#f43f5e" />
          <span>{favoritesCount}</span>
        </button>

        <button
          className="tv-header-btn"
          data-nav="true"
          data-nav-zone="header"
          data-nav-id="btn-search"
          onClick={onOpenSearch}
        >
          <Search size={18} color="#94a3b8" />
          <span>Search</span>
        </button>

        <button
          className="tv-header-btn"
          data-nav="true"
          data-nav-zone="header"
          data-nav-id="btn-settings"
          onClick={onOpenSettings}
        >
          <Settings size={18} color="#94a3b8" />
          <span>Settings</span>
        </button>

        <span className="tv-clock">{timeStr}</span>
      </div>
    </header>
  );
}
