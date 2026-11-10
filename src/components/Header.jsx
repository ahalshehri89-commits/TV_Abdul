import React, { useState, useEffect } from 'react';
import { Search, Settings, Heart, Tv, Globe } from 'lucide-react';
import { storageService } from '../services/storageService.js';
import { catalogService } from '../services/catalogService.js';

export function Header({
  activeCountry,
  totalChannels = 0,
  onOpenCountryModal,
  onOpenSearch,
  onOpenSettings,
  onSelectCategory
}) {
  const [timeStr, setTimeStr] = useState('');
  const [favCount, setFavCount] = useState(0);

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

  useEffect(() => {
    setFavCount(storageService.getFavorites().length);
  }, []);

  return (
    <header className="tv-header">
      <div className="tv-logo-area">
        <Tv size={36} color="#38bdf8" />
        <h1 className="tv-brand-title">TV_Abdul</h1>
        <div className="tv-live-pill">
          <span className="tv-live-dot" />
          <span>Live Free TV ({totalChannels.toLocaleString()} Channels)</span>
        </div>
      </div>

      <div className="tv-header-actions">
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
            {activeCountryObj ? `${activeCountryObj.flag} ${activeCountryObj.name}` : '🌐 All Countries'}
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
          <span>Favorites ({favCount})</span>
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
