import React, { useState } from 'react';
import { Play, Star, Clock, Calendar, Film, Info, Sparkles } from 'lucide-react';
import { vodService, VOD_CATEGORIES } from '../services/vodService.js';

export function VODView({ onPlayItem }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);

  const categories = vodService.getCategories();
  const items = vodService.getItems({ category: activeCategory });
  const featuredItem = items[0] || vodService.getItems()[0];

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
              onClick={() => setActiveCategory(cat.id)}
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
              <span>FEATURED MASTERPIECE • عمل مميز</span>
            </div>
            <h2 className="tv-vod-hero-title-ar">{featuredItem.titleAr}</h2>
            <h3 className="tv-vod-hero-title-en">{featuredItem.title}</h3>

            <div className="tv-vod-hero-meta">
              <span className="tv-vod-rating">
                <Star size={16} color="#f59e0b" fill="#f59e0b" />
                <span>{featuredItem.rating}</span>
              </span>
              <span className="tv-vod-meta-item">
                <Calendar size={15} />
                <span>{featuredItem.year}</span>
              </span>
              <span className="tv-vod-meta-item">
                <Clock size={15} />
                <span>{featuredItem.duration}</span>
              </span>
              <span className="tv-vod-genre-tag">{featuredItem.genreAr}</span>
            </div>

            <p className="tv-vod-hero-synopsis">{featuredItem.synopsisAr}</p>

            <div className="tv-vod-hero-cast">
              <strong>بطولة: </strong>
              <span>{featuredItem.cast.join(' • ')}</span>
            </div>

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
          <span className="tv-vod-count">({items.length} أعمال متوفرة)</span>
        </div>

        <div className="tv-vod-grid">
          {items.map((item, idx) => (
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
                  src={item.poster}
                  alt={item.title}
                  className="tv-vod-card-poster"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="tv-vod-card-badge">
                  <Star size={13} color="#f59e0b" fill="#f59e0b" />
                  <span>{item.rating}</span>
                </div>
                <div className="tv-vod-card-type">{item.year}</div>
                <div className="tv-vod-card-hover-play">
                  <Play size={32} fill="#ffffff" />
                </div>
              </div>

              <div className="tv-vod-card-info">
                <div className="tv-vod-card-title-ar">{item.titleAr}</div>
                <div className="tv-vod-card-title-en">{item.title}</div>
                <div className="tv-vod-card-sub">
                  <span>{item.genreAr}</span>
                  <span>•</span>
                  <span>{item.duration}</span>
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
              <h3>{selectedItem.titleAr}</h3>
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
                <div><strong>إخراج:</strong> {selectedItem.director}</div>
                <div><strong>النجوم:</strong> {selectedItem.cast.join('، ')}</div>
                <div><strong>المدة:</strong> {selectedItem.duration}</div>
              </div>
            </div>
            <div className="tv-vod-modal-actions">
              <button
                className="tv-btn-primary"
                data-nav="true"
                data-nav-zone="modal"
                data-nav-id="btn-modal-play"
                onClick={() => {
                  setSelectedItem(null);
                  onPlayItem(selectedItem);
                }}
              >
                <Play size={20} fill="#ffffff" />
                <span>تشغيل الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
