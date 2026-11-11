import React, { useEffect, useState } from 'react';
import { Play, Star, Clock, Calendar, Film, Info, Sparkles, ExternalLink, ListVideo } from 'lucide-react';
import { vodService, formatDuration } from '../services/vodService.js';
import { youtubeLauncherService } from '../services/youtubeLauncherService.js';
import { spatialNav } from '../services/spatialNav.js';
import { remoteKeyManager, TV_KEYS } from '../services/remoteKeyManager.js';
import { uiLock } from '../services/uiLock.js';

const PAGE_SIZE = 60;

// The home screen unmounts while a title plays; remember the open category for the return.
const memory = { category: 'all' };

export function VODView({ onPlayItem }) {
  const [activeCategory, setActiveCategory] = useState(memory.category);
  const [selectedItem, setSelectedItem] = useState(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [, setCatalogVersion] = useState(0);

  // Show the cached catalog at once and pick up the daily refresh when it arrives.
  useEffect(() => {
    const unsubscribe = vodService.subscribe(() => setCatalogVersion((v) => v + 1));
    vodService.load();
    return unsubscribe;
  }, []);

  const categories = vodService.getCategories();
  const items = vodService.getItems({ category: activeCategory });
  const featuredItem = items.find((item) => item.featured) || null;
  const shown = items.slice(0, limit);

  useEffect(() => {
    return spatialNav.onLoadMore(() => setLimit((prev) => (prev < items.length ? prev + PAGE_SIZE : prev)));
  }, [items.length]);

  // The details dialog takes the remote for itself while it is open.
  useEffect(() => {
    if (!selectedItem) return undefined;
    const returnFocusId = document.activeElement?.getAttribute('data-nav-id');
    const release = uiLock.acquire();
    spatialNav.pushScope('.tv-vod-modal-content');
    const focusTimer = setTimeout(() => spatialNav.focus('btn-modal-play'), 50);
    const unsubscribe = remoteKeyManager.subscribe((action) => {
      switch (action.type) {
        case TV_KEYS.UP:
        case TV_KEYS.DOWN:
        case TV_KEYS.LEFT:
        case TV_KEYS.RIGHT:
          spatialNav.move(action.type);
          return true;
        case TV_KEYS.ENTER:
          if (document.activeElement?.getAttribute('data-nav') === 'true') document.activeElement.click();
          return true;
        case TV_KEYS.BACK:
          setSelectedItem(null);
          return true;
        default:
          return true;
      }
    });
    return () => {
      clearTimeout(focusTimer);
      unsubscribe();
      spatialNav.popScope();
      release();
      if (returnFocusId) setTimeout(() => spatialNav.focus(returnFocusId), 50);
    };
  }, [selectedItem]);

  const selectCategory = (id) => {
    memory.category = id;
    setActiveCategory(id);
    setLimit(PAGE_SIZE);
  };

  const isYouTube = (item) => Boolean(item.youtubeId || item.youtubePlaylistId);

  const getPosterFallback = (title) =>
    `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="%231e293b"/><circle cx="150" cy="180" r="48" fill="%230f172a" stroke="%2338bdf8" stroke-width="2"/><polygon points="142,160 166,180 142,200" fill="%2338bdf8"/><text x="150" y="270" font-family="sans-serif" font-size="18" font-weight="bold" fill="%23ffffff" text-anchor="middle">${encodeURIComponent((title || 'TV Abdul').slice(0, 24))}</text></svg>`;

  return (
    <div className="tv-vod-view">
      {/* VOD Category Bar */}
      <div className="tv-vod-categories" role="tablist">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={isActive}
              className={`tv-category-pill ${isActive ? 'active' : ''}`}
              data-nav="true"
              data-nav-zone="categories"
              data-nav-id={`vod-cat-${cat.id}`}
              onClick={() => selectCategory(cat.id)}
            >
              <span>{cat.nameAr}</span>
              <span className="tv-pill-sub">({cat.name})</span>
            </button>
          );
        })}
      </div>

      {/* Hero Featured Showcase */}
      {featuredItem && (
        <div
          className="tv-vod-hero"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.98) 35%, rgba(15, 23, 42, 0.7) 65%, transparent 100%), url(${featuredItem.backdrop})`
          }}
        >
          <div className="tv-vod-hero-content">
            <div className="tv-vod-hero-badge">
              <Sparkles size={16} color="#f59e0b" />
              <span>FEATURED • عمل مميز</span>
            </div>
            <h2 className="tv-vod-hero-title-ar">{featuredItem.titleAr}</h2>
            <h3 className="tv-vod-hero-title-en">{featuredItem.title}</h3>

            <div className="tv-vod-hero-meta">
              {featuredItem.rating && (
                <span className="tv-vod-rating">
                  <Star size={16} color="#f59e0b" fill="#f59e0b" />
                  <span>{featuredItem.rating}</span>
                </span>
              )}
              <span className="tv-vod-meta-item">
                <Calendar size={15} />
                <span>{featuredItem.year}</span>
              </span>
              <span className="tv-vod-meta-item">
                <Clock size={15} />
                <span>{formatDuration(featuredItem.duration)}</span>
              </span>
              <span className="tv-vod-genre-tag">{featuredItem.genreAr}</span>
            </div>

            <p className="tv-vod-hero-synopsis">{featuredItem.synopsisAr}</p>

            {featuredItem.cast && (
              <div className="tv-vod-hero-cast">
                <strong>بطولة: </strong>
                <span>{featuredItem.cast.join(' • ')}</span>
              </div>
            )}

            <div className="tv-vod-hero-actions">
              <button
                className="tv-btn-primary"
                data-nav="true"
                data-nav-zone="vod_hero"
                data-nav-id="btn-hero-play"
                onClick={() => onPlayItem(featuredItem)}
              >
                <Play size={20} fill="#ffffff" />
                <span>مشاهدة الآن • Watch Now</span>
              </button>
              <button
                className="tv-btn-secondary"
                data-nav="true"
                data-nav-zone="vod_hero"
                data-nav-id="btn-hero-details"
                onClick={() => setSelectedItem(featuredItem)}
              >
                <Info size={18} />
                <span>التفاصيل • Details</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOD Cards Grid */}
      <div className="tv-vod-section">
        <div className="tv-vod-section-header">
          <Film size={22} color="#38bdf8" />
          <h3 className="tv-vod-section-title">
            {categories.find((c) => c.id === activeCategory)?.nameAr || 'المحتوى المتاح'}
          </h3>
          <span className="tv-vod-count">({items.length.toLocaleString()} titles)</span>
        </div>

        {items.length === 0 && (
          <div className="tv-files-empty" style={{ minHeight: '300px' }}>
            <Film size={64} color="#475569" />
            <h3>Nothing here yet</h3>
            <p>This shelf fills up when the daily catalog has been downloaded.</p>
          </div>
        )}

        <div className="tv-vod-grid">
          {shown.map((item, idx) => (
            <div
              key={item.id}
              className="tv-vod-card"
              tabIndex={0}
              data-nav="true"
              data-nav-zone="grid"
              data-nav-id={`vod-${item.id}`}
              data-index={idx}
              onClick={() => onPlayItem(item)}
            >
              <div className="tv-vod-card-poster-wrapper">
                <img
                  src={item.poster || getPosterFallback(item.titleAr || item.title)}
                  alt={item.title}
                  className="tv-vod-card-poster"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getPosterFallback(item.titleAr || item.title);
                  }}
                />
                {item.youtubePlaylistId && (
                  <div className="tv-vod-playlist-badge">
                    <ListVideo size={12} color="#f59e0b" />
                    <span>{item.count ? `${item.count} حلقة` : 'قائمة تشغيل'}</span>
                  </div>
                )}
                {item.rating && (
                  <div className="tv-vod-card-badge">
                    <Star size={13} color="#f59e0b" fill="#f59e0b" />
                    <span>{item.rating}</span>
                  </div>
                )}
                {item.year && <div className="tv-vod-card-type">{item.year}</div>}
                <div className="tv-vod-card-hover-play">
                  <Play size={32} fill="#ffffff" />
                </div>
              </div>

              <div className="tv-vod-card-info">
                <div className="tv-vod-card-title-ar">{item.titleAr || item.title}</div>
                {item.titleAr && <div className="tv-vod-card-title-en">{item.title}</div>}
                <div className="tv-vod-card-sub">
                  <span>{item.genreAr || item.channel || ''}</span>
                  {formatDuration(item.duration) && <span>•</span>}
                  <span>{formatDuration(item.duration)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Item Details Modal */}
      {selectedItem && (
        <div className="tv-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="tv-vod-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="tv-vod-modal-header">
              <h3>{selectedItem.titleAr || selectedItem.title}</h3>
              <button
                className="tv-modal-close-btn"
                data-nav="true"
                data-nav-zone="modal"
                data-nav-id="btn-close-vod-modal"
                onClick={() => setSelectedItem(null)}
              >
                ✕
              </button>
            </div>
            <div className="tv-vod-modal-body">
              <p>{selectedItem.synopsisAr}</p>
              <p className="tv-vod-modal-en">{selectedItem.synopsis}</p>
              <div className="tv-vod-modal-details">
                {selectedItem.director && (
                  <div>
                    <strong>إخراج:</strong> {selectedItem.director}
                  </div>
                )}
                {selectedItem.cast && (
                  <div>
                    <strong>النجوم:</strong> {selectedItem.cast.join('، ')}
                  </div>
                )}
                <div>
                  <strong>المدة:</strong> {formatDuration(selectedItem.duration)}
                </div>
              </div>
            </div>
            <div className="tv-vod-modal-actions">
              <button
                className="tv-btn-primary"
                data-nav="true"
                data-nav-zone="modal"
                data-nav-id="btn-modal-play"
                onClick={() => {
                  const item = selectedItem;
                  setSelectedItem(null);
                  onPlayItem(item);
                }}
              >
                <Play size={20} fill="#ffffff" />
                <span>مشاهدة الآن • Watch Now</span>
              </button>
              {isYouTube(selectedItem) && (
                <button
                  className="tv-btn-secondary"
                  data-nav="true"
                  data-nav-zone="modal"
                  data-nav-id="btn-modal-yt"
                  onClick={() => {
                    youtubeLauncherService.openInYouTubeApp({
                      videoId: selectedItem.youtubeId,
                      playlistId: selectedItem.youtubePlaylistId
                    });
                    setSelectedItem(null);
                  }}
                >
                  <ExternalLink size={18} />
                  <span>فتح في تطبيق YouTube • Open in YouTube</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
