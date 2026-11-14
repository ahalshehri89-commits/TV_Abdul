import React, { useState, useEffect, useRef } from 'react';
import { catalogService } from '../services/catalogService.js';
import { vodService, formatDuration } from '../services/vodService.js';
import { remoteKeyManager, TV_KEYS } from '../services/remoteKeyManager.js';
import { spatialNav } from '../services/spatialNav.js';
import { Search, X, Play, Film } from 'lucide-react';

export function SearchModal({ onClose, onPlayChannel, onPlayVodItem }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [vodResults, setVodResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    spatialNav.pushScope('.tv-modal-content');
    vodService.load();
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const unsubscribe = remoteKeyManager.subscribe((action) => {
      switch (action.type) {
        case TV_KEYS.BACK:
          onClose();
          return true;
        case TV_KEYS.UP:
          spatialNav.move('UP');
          return true;
        case TV_KEYS.DOWN:
          spatialNav.move('DOWN');
          return true;
        case TV_KEYS.LEFT:
          spatialNav.move('LEFT');
          return true;
        case TV_KEYS.RIGHT:
          spatialNav.move('RIGHT');
          return true;
        case TV_KEYS.ENTER: {
          const focused = document.activeElement;
          if (focused && focused.getAttribute('data-nav') === 'true' && focused.tagName !== 'INPUT') {
            focused.click();
            return true;
          }
          break;
        }
        default:
          break;
      }
      return false;
    });

    return () => {
      spatialNav.popScope();
      unsubscribe();
    };
  }, [onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setVodResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const data = await catalogService.getChannels({ q: query, limit: 8 });
      setResults(data.items || []);
      setVodResults(vodService.getItems({ q: query }).slice(0, 8));
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="tv-modal-backdrop" onClick={onClose}>
      <div className="tv-modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Search size={28} color="#38bdf8" />
            <h2 style={{ fontSize: '28px', color: '#ffffff' }}>Search Channels, Movies &amp; Series</h2>
          </div>
          <button
            className="tv-header-btn"
            data-nav="true"
            data-nav-id="btn-close-search"
            onClick={onClose}
          >
            <X size={18} />
            <span>Close (Back)</span>
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          className="tv-search-input"
          placeholder="Type a channel, country, movie, play or series..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-nav="true"
          data-nav-id="search-input-field"
        />

        <div style={{ flex: 1, overflowY: 'auto', minHeight: '300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
              Searching channels...
            </div>
          )}

          {!loading && results.length === 0 && vodResults.length === 0 && query.trim() && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
              Nothing found matching "{query}".
            </div>
          )}

          {results.map((channel) => (
            <div
              key={channel.id}
              className="tv-header-btn"
              style={{
                width: '100%',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'rgba(30, 41, 59, 0.7)'
              }}
              data-nav="true"
              data-nav-id={`search-item-${channel.id}`}
              onClick={() => onPlayChannel(channel)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>#{channel.number}</span>
                <span style={{ fontSize: '20px', fontWeight: 600 }}>{channel.name}</span>
                <span style={{ fontSize: '14px', color: '#94a3b8' }}>
                  {channel.flag} {channel.countryName}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="tv-quality-badge">{channel.bestQuality || 'HD'}</span>
                <Play size={18} color="#38bdf8" fill="#38bdf8" />
              </div>
            </div>
          ))}

          {vodResults.map((item) => (
            <div
              key={item.id}
              className="tv-header-btn"
              style={{
                width: '100%',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'rgba(30, 41, 59, 0.7)'
              }}
              data-nav="true"
              data-nav-id={`search-vod-${item.id}`}
              onClick={() => onPlayVodItem && onPlayVodItem(item)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                <Film size={20} color="#f59e0b" />
                <span style={{ fontSize: '20px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.titleAr || item.title}
                </span>
                <span style={{ fontSize: '14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {item.channel || item.genreAr || ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="tv-quality-badge">{formatDuration(item.duration) || 'VOD'}</span>
                <Play size={18} color="#f59e0b" fill="#f59e0b" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
