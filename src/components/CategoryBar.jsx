import React from 'react';
import { PRIMARY_CATEGORIES } from '../services/catalogService.js';

export function CategoryBar({ activeCategory, onSelectCategory }) {
  return (
    <nav className="tv-category-bar" role="tablist">
      {PRIMARY_CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            role="tab"
            aria-selected={isActive}
            className={`tv-category-pill ${isActive ? 'active' : ''}`}
            data-nav="true"
            data-nav-zone="categories"
            data-nav-id={`cat-${cat.id}`}
            onClick={() => onSelectCategory(cat.id)}
          >
            {cat.name}
          </button>
        );
      })}
    </nav>
  );
}
