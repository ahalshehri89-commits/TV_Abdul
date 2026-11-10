import React, { useEffect, useRef } from 'react';
import { catalogService } from '../services/catalogService.js';
import { remoteKeyManager, TV_KEYS } from '../services/remoteKeyManager.js';
import { spatialNav } from '../services/spatialNav.js';
import { Globe, X, Check } from 'lucide-react';

export function CountryModal({ activeCountry, onSelectCountry, onClose }) {
  const countries = catalogService.getCountries();
  const modalRef = useRef(null);

  useEffect(() => {
    spatialNav.pushScope('.tv-country-modal');

    // Immediately focus active country or first country card
    const timer = setTimeout(() => {
      const activeBtn = document.querySelector(`[data-nav-id="country-${activeCountry}"]`);
      if (activeBtn) {
        spatialNav.focus(`country-${activeCountry}`);
      } else {
        spatialNav.focusFirst();
      }
    }, 60);

    const handleRemote = (action) => {
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
          if (focused && focused.getAttribute('data-nav') === 'true') {
            focused.click();
            return true;
          }
          break;
        }

        default:
          break;
      }
      return false;
    };

    const unsubscribe = remoteKeyManager.subscribe(handleRemote);

    return () => {
      clearTimeout(timer);
      spatialNav.popScope();
      unsubscribe();
    };
  }, [activeCountry, onClose]);

  const handleSelect = (code) => {
    onSelectCountry(code);
    onClose();
  };

  return (
    <div className="tv-modal-backdrop" onClick={onClose}>
      <div
        className="tv-modal-content tv-country-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '960px', maxHeight: '840px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Globe size={32} color="#38bdf8" />
            <div>
              <h2 style={{ fontSize: '28px', color: '#ffffff', fontWeight: 700 }}>Filter by Country / Region</h2>
              <p style={{ color: '#94a3b8', fontSize: '15px' }}>
                Use remote arrows to navigate and press Enter to select a country
              </p>
            </div>
          </div>
          <button
            className="tv-header-btn"
            data-nav="true"
            data-nav-zone="modal"
            data-nav-id="btn-close-country"
            tabIndex={0}
            onClick={onClose}
          >
            <X size={18} />
            <span>Close (Back)</span>
          </button>
        </div>

        <div
          className="tv-country-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px',
            maxHeight: '640px',
            overflowY: 'auto',
            paddingRight: '6px'
          }}
        >
          {countries.map((c) => {
            const isSelected = activeCountry === c.code || (activeCountry === 'all' && c.code === 'all');
            return (
              <button
                key={c.code}
                className={`tv-country-card ${isSelected ? 'tv-country-card-active' : ''}`}
                data-nav="true"
                data-nav-zone="modal"
                data-nav-id={`country-${c.code}`}
                tabIndex={0}
                onClick={() => handleSelect(c.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: isSelected ? 'rgba(14, 165, 233, 0.25)' : 'rgba(30, 41, 59, 0.75)',
                  border: isSelected ? '2px solid #38bdf8' : '2px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span style={{ fontSize: '26px', flexShrink: 0 }}>{c.flag}</span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '17px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {c.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                      {c.count} {c.count === 1 ? 'channel' : 'channels'}
                    </div>
                  </div>
                </div>
                {isSelected && <Check size={22} color="#38bdf8" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
