/**
 * MovieList - Core Application Engine
 * Architecture: Ultra-Fast Glassmorphism SPA with Cinema Suite
 */

(function () {
  'use strict';

  // Application State
  const state = {
    allMovies: [],
    filteredMovies: [],
    carouselMovies: [],
    categories: {},
    activeCategory: 'All',
    searchQuery: '',
    sortBy: 'default',
    currentSlideIdx: 0,
    slideInterval: null,
    watchlist: new Set(),
    history: [],
    activeMovie: null,
    ambilightEnabled: true,
    extSelectedUrl: '',
    extSelectedTitle: '',
    defaultPlayer: localStorage.getItem('movielist_default_player') || '',
    theme: localStorage.getItem('movielist_theme') || 'dark'
  };

  // Safe DOM Sanitizers
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function sanitizeUrl(url) {
    if (!url) return '';
    const clean = String(url).trim();
    if (/^(https?:|\/|\.\/|blob:)/i.test(clean)) {
      return clean;
    }
    return '';
  }

  // Movie Title Cleaning Engine
  function cleanTitle(raw) {
    if (!raw) return { title: 'Unknown Title', year: '', quality: 'HD' };
    let text = String(raw).trim();

    // Extract year
    const yearMatch = text.match(/\b(19\d\d|20\d\d)(?:[–—\-](19\d\d|20\d\d|present))?\b/i);
    const year = yearMatch ? yearMatch[0] : '';

    // Extract quality tag
    let quality = 'HD';
    if (/4k|2160p|uhd/i.test(text)) quality = '4K UHD';
    else if (/1080p/i.test(text)) quality = '1080p HD';
    else if (/720p/i.test(text)) quality = '720p';

    // Remove leading order numbers
    text = text.replace(/^\d{1,4}[\.\s\-–—]+\s*/, '');

    // Remove file extensions
    text = text.replace(/\.(mkv|mp4|avi|webm|mov)$/i, '');

    // Remove release junk tags
    const junkPatterns = [
      /\b\d{3,4}p\b/gi,
      /\b(bluray|bdrip|brrip|web-dl|webrip|web|hdrip|dvdrip|hdtc|camrip|cam)\b/gi,
      /\b(x264|x265|hevc|h264|10bit|8bit|aac|ac3|dd5\.1|dts)\b/gi,
      /\b(dual audio|multi audio|hindi dubbed|english|esub|msubs?)\b/gi,
      /\[.*?\]/g,
      /\(.*?\)/g,
      /[-_.]{2,}/g,
      /-[a-zA-Z0-9]+$/
    ];

    let cleaned = text;
    for (const pattern of junkPatterns) {
      cleaned = cleaned.replace(pattern, ' ');
    }
    cleaned = cleaned.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();

    if (!cleaned && raw) {
      cleaned = String(raw).replace(/\.[^.]+$/, '');
    }

    return {
      title: cleaned || 'Movie',
      year: year,
      quality: quality
    };
  }

  // Local Storage Watchlist Manager
  function loadWatchlist() {
    try {
      const stored = JSON.parse(localStorage.getItem('movielist_watchlist') || '[]');
      state.watchlist = new Set(stored);
      updateWatchlistBadge();
    } catch (e) {
      state.watchlist = new Set();
    }
  }

  function toggleWatchlist(movieUrl, movieTitle, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (state.watchlist.has(movieUrl)) {
      state.watchlist.delete(movieUrl);
      showToast(`Removed "${movieTitle}" from Watchlist`);
    } else {
      state.watchlist.add(movieUrl);
      showToast(`Added "${movieTitle}" to Watchlist`);
    }
    try {
      localStorage.setItem('movielist_watchlist', JSON.stringify([...state.watchlist]));
    } catch (e) {}

    updateWatchlistBadge();
    renderGrid();
    updateModalWatchlistState();
  }

  function updateWatchlistBadge() {
    const badge = document.getElementById('watchlistBadge');
    if (badge) {
      const count = state.watchlist.size;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  // Continue Watching & History Engine
  function loadHistory() {
    try {
      state.history = JSON.parse(localStorage.getItem('movielist_history') || '[]');
    } catch (e) {
      state.history = [];
    }
    renderContinueWatching();
  }

  function saveWatchProgress(movie, currentTime, duration) {
    if (!movie || !currentTime || currentTime < 10) return;
    const progressPercent = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
    
    // Remove if already exists
    state.history = state.history.filter((h) => h.videoUrl !== movie.videoUrl);

    // Prepend to start of history
    state.history.unshift({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.posterUrl,
      videoUrl: movie.videoUrl,
      category: movie.category,
      quality: movie.quality,
      currentTime: currentTime,
      duration: duration || 0,
      progressPercent: progressPercent,
      timestamp: Date.now()
    });

    // Keep maximum 15 items
    if (state.history.length > 15) {
      state.history = state.history.slice(0, 15);
    }

    try {
      localStorage.setItem('movielist_history', JSON.stringify(state.history));
    } catch (e) {}

    renderContinueWatching();
  }

  function removeHistory(videoUrl, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    state.history = state.history.filter((h) => h.videoUrl !== videoUrl);
    try {
      localStorage.setItem('movielist_history', JSON.stringify(state.history));
      localStorage.removeItem(`movielist_resume_${videoUrl}`);
    } catch (e) {}
    showToast('Removed from Continue Watching');
    renderContinueWatching();
  }

  function renderContinueWatching() {
    const section = document.getElementById('continueWatchingSection');
    const slider = document.getElementById('continueWatchingSlider');
    if (!section || !slider) return;

    if (!state.history || state.history.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'flex';
    slider.innerHTML = state.history
      .map((item) => {
        const percent = item.progressPercent || 10;
        return `
          <div class="cw-card" onclick="window.MovieList.playMovie('${escapeQuotes(item.videoUrl)}', '${escapeQuotes(item.title)}')">
            <div class="cw-thumbnail-wrap">
              <img class="cw-thumbnail-img" src="${sanitizeUrl(item.posterUrl)}" alt="${escapeQuotes(item.title)}" loading="lazy" onerror="this.src='icons/icon-512.png'">
              <div class="cw-play-btn">
                <i data-lucide="play" style="width:20px;height:20px;fill:currentColor;"></i>
              </div>
              <button class="cw-remove-btn" onclick="window.MovieList.removeHistory('${escapeQuotes(item.videoUrl)}', event)" title="Remove from list">
                <i data-lucide="x" style="width:14px;height:14px;"></i>
              </button>
            </div>
            <div class="cw-progress-track">
              <div class="cw-progress-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="cw-info">
              <h4 class="cw-card-title">${escapeHtml(item.title)}</h4>
              <div class="cw-card-meta">
                <span>${escapeHtml(item.category || 'Movie')}</span>
                <span>${percent}% watched</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    if (window.lucide) window.lucide.createIcons({ root: slider });
  }

  // Toast Notification System
  function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `
      <i data-lucide="check-circle" style="width:18px;height:18px;color:var(--primary);"></i>
      <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons({ root: toast });

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // Theme Management
  function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const themeIcon = document.getElementById('themeIcon');
    const dockThemeIcon = document.getElementById('dockThemeIcon');
    const iconName = state.theme === 'light' ? 'moon' : 'sun';
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', iconName);
    }
    if (dockThemeIcon) {
      dockThemeIcon.setAttribute('data-lucide', iconName);
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('movielist_theme', state.theme);
    initTheme();
    showToast(`Switched to ${state.theme === 'dark' ? 'Dark' : 'Light'} Mode`);
  }

  // Data Hydration from home_data.json
  async function loadCatalog() {
    try {
      const res = await fetch('./home_data.json?v=' + Date.now());
      if (!res.ok) throw new Error('Failed to load catalog');
      const data = await res.json();
      processCatalogData(data);
    } catch (err) {
      console.error('Catalog load error, using fallback:', err);
      processFallbackData();
    }
  }

  // Category Multi-Row Configuration (CineBox Classical Layout)
  const CATEGORY_ROWS_CONFIG = [
    { key: "Today's Updates", name: "Today's Updates", altKey: "Today" },
    { key: "Top Rated", name: "IMDb Top 250", altKey: "Top Rated" },
    { key: "Hollywood 1080p", name: "Hollywood 1080p", altKey: "Hollywood" },
    { key: "Bollywood", name: "Bollywood (Hindi)", altKey: "Bollywood" },
    { key: "South Action", name: "South Action (Hindi Dubbed)", altKey: "South Action" },
    { key: "TV Series", name: "TV & Web Series", altKey: "TV Series" },
    { key: "K-Drama", name: "Korean Drama", altKey: "K-Drama" },
    { key: "Animation", name: "Animation & Anime", altKey: "Animation" },
    { key: "Bangla", name: "Bangla Cinema", altKey: "Bangla" }
  ];

  const CATEGORY_JSON_MAP = {
    "Today's Updates": './data/today.json',
    "Today": './data/today.json',
    "Top Rated": './data/top_rated.json',
    "Hollywood 1080p": './data/hollywood.json',
    "Bollywood": './data/bollywood.json',
    "South Action": './data/south_action.json',
    "South Original": './data/south_original.json',
    "TV Series": './data/tv_series.json',
    "K-Drama": './data/kdrama.json',
    "Animation": './data/animation.json',
    "Bangla": './data/bangla.json'
  };

  const loadedCategories = new Set();
  const seenCatalogUrls = new Set();

  function mapItem(item, fallbackCategory) {
    const rawTitle = item[0] || '';
    const posterUrl = item[1] || '';
    const videoUrl = item[2] || '';
    const category = item[3] || fallbackCategory || 'Movies';
    const tag = item[4] || '';
    const size = item[5] || '';
    const date = item[6] || '';

    const { title, year, quality } = cleanTitle(rawTitle);

    let rating = '8.2';
    if (/top rated|top-250/i.test(category) || /top rated/i.test(tag)) rating = '8.9';
    else if (/animation/i.test(category)) rating = '8.4';
    else if (/hollywood/i.test(category)) rating = '8.1';
    else if (/k-drama/i.test(category)) rating = '8.5';

    return {
      id: videoUrl || rawTitle,
      rawTitle,
      title,
      year,
      quality,
      rating,
      posterUrl,
      videoUrl,
      category,
      tag,
      size,
      date
    };
  }

  async function ensureCategoryLoaded(catKey) {
    if (!catKey || catKey === 'All' || catKey === 'Watchlist' || loadedCategories.has(catKey)) return;
    const file = CATEGORY_JSON_MAP[catKey];
    if (!file) return;

    try {
      const res = await fetch(file + '?v=' + Date.now());
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        loadedCategories.add(catKey);
        const mapped = data.map((item) => mapItem(item, catKey));
        state.categories[catKey] = mapped;

        mapped.forEach((m) => {
          if (m.videoUrl && !seenCatalogUrls.has(m.videoUrl)) {
            seenCatalogUrls.add(m.videoUrl);
            state.allMovies.push(m);
          }
        });

        if (state.activeCategory === catKey) {
          filterAndRenderGrid();
        }
      }
    } catch (e) {
      console.warn('Background category load error for', catKey, e);
    }
  }

  function processCatalogData(data) {
    const all = [];

    if (Array.isArray(data.carousel)) {
      state.carouselMovies = data.carousel.map((item) => mapItem(item, 'Featured'));
      state.carouselMovies.forEach((m) => {
        if (m.videoUrl && !seenCatalogUrls.has(m.videoUrl)) {
          seenCatalogUrls.add(m.videoUrl);
          all.push(m);
        }
      });
    }

    if (data.categories && typeof data.categories === 'object') {
      state.categories = {};
      for (const [catName, items] of Object.entries(data.categories)) {
        if (Array.isArray(items)) {
          const mapped = items.map((item) => mapItem(item, catName));
          state.categories[catName] = mapped;
          mapped.forEach((m) => {
            if (m.videoUrl && !seenCatalogUrls.has(m.videoUrl)) {
              seenCatalogUrls.add(m.videoUrl);
              all.push(m);
            }
          });
        }
      }
    }

    state.allMovies = all;
    renderHeroCarousel();
    filterAndRenderGrid();
    loadHistory();
  }

  function processFallbackData() {
    const fallbacks = [
      {
        id: '1',
        rawTitle: 'The Shawshank Redemption (1994)',
        title: 'The Shawshank Redemption',
        year: '1994',
        quality: '1080p HD',
        rating: '9.3',
        posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        category: 'Top Rated',
        tag: 'IMDb Top 250',
        size: '2.5 GB',
        date: '2025'
      },
      {
        id: '2',
        rawTitle: 'The Dark Knight (2008)',
        title: 'The Dark Knight',
        year: '2008',
        quality: '4K UHD',
        rating: '9.0',
        posterUrl: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=600&q=80',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        category: 'Top Rated',
        tag: 'Action',
        size: '3.8 GB',
        date: '2025'
      }
    ];
    state.carouselMovies = fallbacks;
    state.allMovies = fallbacks;
    state.categories = { 'Top Rated': fallbacks };
    renderHeroCarousel();
    filterAndRenderGrid();
    loadHistory();
  }

  // Hero Carousel Component
  function renderHeroCarousel() {
    const container = document.getElementById('heroCarouselSlides');
    const indicators = document.getElementById('carouselIndicators');
    if (!container || !state.carouselMovies.length) return;

    container.innerHTML = state.carouselMovies
      .map((movie, idx) => {
        const isWatchlisted = state.watchlist.has(movie.videoUrl);
        return `
          <div class="carousel-slide ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
            <img class="slide-backdrop-img" src="${sanitizeUrl(movie.posterUrl)}" alt="${escapeQuotes(movie.title)}" onerror="this.src='icons/icon-512.png'">
            <div class="slide-glass-gradient-overlay"></div>
            <div class="slide-content-container">
              <div class="slide-badge-row">
                <span class="slide-tag">${escapeHtml(movie.tag || movie.category || 'Featured')}</span>
                <span class="slide-tag">${escapeHtml(movie.quality)}</span>
                <span class="slide-rating">
                  <i data-lucide="star" style="width:13px;height:13px;fill:var(--accent-gold);color:var(--accent-gold);"></i>
                  ${escapeHtml(movie.rating)}
                </span>
              </div>
              <h2 class="slide-title">${escapeHtml(movie.title)}</h2>
              <div class="slide-meta-row">
                ${movie.year ? `<span>${escapeHtml(movie.year)}</span>` : ''}
                <span>${escapeHtml(movie.category)}</span>
                ${movie.size ? `<span>${escapeHtml(movie.size)}</span>` : ''}
              </div>
              <div class="slide-buttons-row">
                <button class="btn-solid-primary" onclick="window.MovieList.playMovie('${escapeQuotes(movie.videoUrl)}', '${escapeQuotes(movie.title)}')">
                  <i data-lucide="play" style="width:16px;height:16px;fill:currentColor;"></i>
                  Watch Now
                </button>
                <button class="btn-glass" onclick="window.MovieList.openTrailer('${escapeQuotes(movie.title)}')">
                  <i data-lucide="film" style="width:16px;height:16px;"></i>
                  Trailer
                </button>
                <button class="btn-glass" onclick="window.MovieList.openDetails('${escapeQuotes(movie.id)}')">
                  <i data-lucide="info" style="width:16px;height:16px;"></i>
                  Details
                </button>
                <button class="icon-action-btn ${isWatchlisted ? 'active' : ''}" onclick="window.MovieList.toggleWatchlist('${escapeQuotes(movie.videoUrl)}', '${escapeQuotes(movie.title)}', event)" title="Watchlist">
                  <i data-lucide="bookmark" style="width:18px;height:18px;${isWatchlisted ? 'fill:var(--accent);color:var(--accent);' : ''}"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    if (indicators) {
      indicators.innerHTML = state.carouselMovies
        .map(
          (_, idx) =>
            `<span class="indicator-dot ${idx === 0 ? 'active' : ''}" onclick="window.MovieList.goToSlide(${idx})"></span>`
        )
        .join('');
    }

    if (window.lucide) window.lucide.createIcons({ root: container });
    startCarouselAuto();
  }

  function showSlide(idx) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.indicator-dot');
    if (!slides.length) return;

    if (idx < 0) idx = slides.length - 1;
    if (idx >= slides.length) idx = 0;

    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    state.currentSlideIdx = idx;
  }

  function nextSlide() {
    showSlide(state.currentSlideIdx + 1);
  }

  function prevSlide() {
    showSlide(state.currentSlideIdx - 1);
  }

  function startCarouselAuto() {
    clearInterval(state.slideInterval);
    state.slideInterval = setInterval(nextSlide, 6500);
  }

  // Mobile Dock & Navigation Helpers
  function scrollToCategories() {
    const el = document.getElementById('categoryPillsRow');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function focusSearch() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const input = document.getElementById('searchInput');
    if (input) {
      setTimeout(() => input.focus(), 250);
    }
  }

  // Filtering, Searching & Sorting
  function setCategory(cat) {
    state.activeCategory = cat;
    document.querySelectorAll('.category-pill').forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.category === cat);
    });
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.category === cat);
    });

    // Update Mobile Bottom Dock Active State
    const dockHome = document.getElementById('dockBtnHome');
    const dockCategories = document.getElementById('dockBtnCategories');
    const dockWatchlist = document.getElementById('dockBtnWatchlist');

    if (dockHome) dockHome.classList.toggle('active', cat === 'All');
    if (dockWatchlist) dockWatchlist.classList.toggle('active', cat === 'Watchlist');
    if (dockCategories) dockCategories.classList.toggle('active', cat !== 'All' && cat !== 'Watchlist');

    if (cat === 'All') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      ensureCategoryLoaded(cat);
    }

    filterAndRenderGrid();
  }

  function setSearch(query) {
    state.searchQuery = (query || '').trim().toLowerCase();
    filterAndRenderGrid();
  }

  function setSort(sortBy) {
    state.sortBy = sortBy;
    filterAndRenderGrid();
  }

  // Shared Movie Card HTML Generator
  function renderMovieCardHtml(m) {
    const isWatchlisted = state.watchlist.has(m.videoUrl);
    return `
      <div class="movie-card" onclick="window.MovieList.openDetails('${escapeQuotes(m.id)}')">
        <div class="card-poster-wrap">
          <span class="card-badge-top-left">${escapeHtml(m.quality)}</span>
          <div class="card-actions-top-right">
            <button class="card-icon-action card-ext-btn" 
                    onclick="window.MovieList.onCardExtClick('${escapeQuotes(m.videoUrl)}', '${escapeQuotes(m.title)}', event)" 
                    title="Play in External App (VLC / MX Player)" 
                    aria-label="Play in External App">
              <i data-lucide="tv" style="width:14px;height:14px;"></i>
            </button>
            <button class="card-icon-action card-watchlist-btn ${isWatchlisted ? 'active' : ''}" 
                    onclick="window.MovieList.toggleWatchlist('${escapeQuotes(m.videoUrl)}', '${escapeQuotes(m.title)}', event)" 
                    title="Save to Watchlist"
                    aria-label="Save to Watchlist">
              <i data-lucide="bookmark" style="width:14px;height:14px;${isWatchlisted ? 'fill:currentColor;' : ''}"></i>
            </button>
          </div>
          <img class="card-poster-img" src="${sanitizeUrl(m.posterUrl)}" alt="${escapeQuotes(m.title)}" loading="lazy" onerror="this.src='icons/icon-512.png'">
          <div class="card-play-overlay">
            <div class="card-play-icon">
              <i data-lucide="play" style="width:20px;height:20px;fill:currentColor;"></i>
            </div>
          </div>
        </div>
        <div class="card-info">
          <h4 class="card-title" title="${escapeQuotes(m.title)}">${escapeHtml(m.title)}</h4>
          <div class="card-meta-row">
            <div class="card-meta-left">
              <span class="card-category-tag">${escapeHtml(m.category)}</span>
              ${m.year ? `<span>• ${escapeHtml(m.year)}</span>` : ''}
            </div>
            <span style="display:inline-flex;align-items:center;gap:3px;font-weight:700;color:var(--accent-gold);">
              <i data-lucide="star" style="width:12px;height:12px;fill:var(--accent-gold);"></i>
              ${escapeHtml(m.rating)}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  // "Show All" Card at End of Category Row
  function renderShowAllCardHtml(catKey, catName, count) {
    return `
      <div class="movie-card show-all-card" onclick="window.MovieList.setCategory('${escapeQuotes(catKey)}')">
        <div class="show-all-card-inner">
          <div class="show-all-glow-orb"></div>
          <div class="show-all-icon-circle">
            <i data-lucide="arrow-right" style="width:20px;height:20px;"></i>
          </div>
          <div class="show-all-card-title">Show All</div>
          <div class="show-all-card-cat">${escapeHtml(catName)}</div>
          ${count && count > 0 ? `<div class="show-all-count">${count.toLocaleString()} Titles</div>` : ''}
        </div>
      </div>
    `;
  }

  // Render Horizontal Category Sliders ("Old Type Category")
  function renderCategoryRows() {
    const container = document.getElementById('categoryRowsContainer');
    if (!container) return;

    let html = '';
    CATEGORY_ROWS_CONFIG.forEach((catConfig, catIdx) => {
      const items = state.categories[catConfig.key] || state.categories[catConfig.altKey] || [];
      if (!items || items.length === 0) return;

      const sliderId = `rowSlider_${catIdx}`;
      const rowCardsHtml = items.map((m) => renderMovieCardHtml(m)).join('');
      const showAllHtml = renderShowAllCardHtml(catConfig.key, catConfig.name, items.length);

      html += `
        <div class="category-row-block">
          <div class="row-header">
            <div class="row-title-wrap" onclick="window.MovieList.setCategory('${escapeQuotes(catConfig.key)}')">
              <h2 class="row-heading">${escapeHtml(catConfig.name)}</h2>
              <span class="row-badge">${items.length} Titles</span>
            </div>
            <div class="row-controls">
              <button class="row-nav-btn prev" onclick="window.MovieList.slideRow('${sliderId}', -1)" aria-label="Previous">
                <i data-lucide="chevron-left" style="width:16px;height:16px;"></i>
              </button>
              <button class="row-nav-btn next" onclick="window.MovieList.slideRow('${sliderId}', 1)" aria-label="Next">
                <i data-lucide="chevron-right" style="width:16px;height:16px;"></i>
              </button>
            </div>
          </div>
          <div class="row-slider" id="${sliderId}">
            ${rowCardsHtml}
            ${showAllHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons({ root: container });
  }

  function slideRow(sliderId, direction) {
    const el = document.getElementById(sliderId);
    if (el) {
      const scrollAmount = Math.max(280, el.clientWidth * 0.75);
      el.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
  }

  function filterAndRenderGrid() {
    const categoryRowsContainer = document.getElementById('categoryRowsContainer');
    const catalogHeaderRow = document.getElementById('catalogHeaderRow');
    const moviesGrid = document.getElementById('moviesGrid');
    const catalogTitleText = document.getElementById('catalogSectionTitleText');

    const isHomeView = state.activeCategory === 'All' && !state.searchQuery;

    if (isHomeView) {
      if (categoryRowsContainer) {
        categoryRowsContainer.style.display = 'flex';
        renderCategoryRows();
      }
      if (catalogHeaderRow) catalogHeaderRow.style.display = 'none';
      if (moviesGrid) moviesGrid.style.display = 'none';
      return;
    }

    // Grid mode for Specific Category / Watchlist / Search
    if (categoryRowsContainer) categoryRowsContainer.style.display = 'none';
    if (catalogHeaderRow) catalogHeaderRow.style.display = 'flex';
    if (moviesGrid) moviesGrid.style.display = 'grid';

    let list = [...state.allMovies];

    if (state.activeCategory === 'Watchlist') {
      list = list.filter((m) => state.watchlist.has(m.videoUrl));
      if (catalogTitleText) catalogTitleText.textContent = 'Saved Watchlist';
    } else if (state.activeCategory !== 'All') {
      if (state.categories[state.activeCategory]) {
        list = state.categories[state.activeCategory];
      } else {
        const catQuery = state.activeCategory.toLowerCase();
        list = list.filter((m) => m.category.toLowerCase().includes(catQuery));
      }
      if (catalogTitleText) catalogTitleText.textContent = state.activeCategory;
    } else {
      if (catalogTitleText) catalogTitleText.textContent = 'Search Results';
    }

    if (state.searchQuery) {
      const q = state.searchQuery;
      list = list.filter((m) => {
        return (
          m.title.toLowerCase().includes(q) ||
          (m.year && m.year.includes(q)) ||
          m.category.toLowerCase().includes(q)
        );
      });
      if (catalogTitleText) catalogTitleText.textContent = `Search: "${state.searchQuery}"`;
    }

    if (state.sortBy === 'rating') {
      list.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
    } else if (state.sortBy === 'year') {
      list.sort((a, b) => parseInt(b.year || 0, 10) - parseInt(a.year || 0, 10));
    } else if (state.sortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    state.filteredMovies = list;
    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('moviesGrid');
    const badge = document.getElementById('catalogCountBadge');
    if (!grid) return;

    if (badge) {
      badge.textContent = `${state.filteredMovies.length} Titles`;
    }

    if (state.filteredMovies.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon">
            <i data-lucide="film" style="width:28px;height:28px;"></i>
          </div>
          <h3 style="font-size:18px;font-weight:700;">No movies found</h3>
          <p style="color:var(--text-secondary);font-size:13.5px;max-width:320px;">
            ${state.activeCategory === 'Watchlist' ? 'Your watchlist is empty. Save movies by clicking the bookmark icon!' : 'Try searching for another movie title or select a different category.'}
          </p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ root: grid });
      return;
    }

    grid.innerHTML = state.filteredMovies.map((m) => renderMovieCardHtml(m)).join('');
    if (window.lucide) window.lucide.createIcons({ root: grid });
  }

  // Movie Details Modal Component
  function openDetails(id) {
    const movie = state.allMovies.find((m) => m.id === id) || state.carouselMovies.find((m) => m.id === id);
    if (!movie) return;

    state.activeMovie = movie;
    const modal = document.getElementById('detailsModal');
    if (!modal) return;

    const isWatchlisted = state.watchlist.has(movie.videoUrl);

    document.getElementById('modalBackdropImg').src = sanitizeUrl(movie.posterUrl);
    document.getElementById('modalPosterImg').src = sanitizeUrl(movie.posterUrl);
    document.getElementById('modalMovieTitle').textContent = movie.title;
    document.getElementById('modalQualityTag').textContent = movie.quality;
    document.getElementById('modalRatingTag').textContent = `${movie.rating} Rating`;
    document.getElementById('modalCategoryTag').textContent = movie.category;
    document.getElementById('modalYearStat').textContent = movie.year || '2025';
    document.getElementById('modalSizeStat').textContent = movie.size || 'HD Stream';
    document.getElementById('modalDateStat').textContent = movie.date ? movie.date.split(' ')[0] : 'Latest';

    const playBtn = document.getElementById('modalPlayBtn');
    if (playBtn) {
      playBtn.onclick = () => {
        closeDetails();
        playMovie(movie.videoUrl, movie.title);
      };
    }

    const trailerBtn = document.getElementById('modalTrailerBtn');
    if (trailerBtn) {
      trailerBtn.onclick = () => {
        openTrailer(movie.title);
      };
    }

    const watchBtn = document.getElementById('modalWatchlistBtn');
    if (watchBtn) {
      watchBtn.innerHTML = `
        <i data-lucide="bookmark" style="width:16px;height:16px;${isWatchlisted ? 'fill:currentColor;' : ''}"></i>
        ${isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}
      `;
      watchBtn.onclick = (e) => {
        toggleWatchlist(movie.videoUrl, movie.title, e);
      };
    }

    // Configure External Player Buttons inside details
    const btnVlc = document.getElementById('extBtnVlc');
    if (btnVlc) btnVlc.onclick = () => launchVLC(movie.videoUrl, movie.title);

    const btnMx = document.getElementById('extBtnMx');
    if (btnMx) btnMx.onclick = () => launchMX(movie.videoUrl, movie.title);

    const btnPot = document.getElementById('extBtnPot');
    if (btnPot) btnPot.onclick = () => launchPotPlayer(movie.videoUrl, movie.title);

    const btnCopy = document.getElementById('extBtnCopy');
    if (btnCopy) btnCopy.onclick = () => copyStreamLink(movie.videoUrl);

    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons({ root: modal });
  }

  function closeDetails() {
    const modal = document.getElementById('detailsModal');
    if (modal) modal.classList.remove('active');
    state.activeMovie = null;
  }

  function updateModalWatchlistState() {
    if (!state.activeMovie) return;
    const isWatchlisted = state.watchlist.has(state.activeMovie.videoUrl);
    const watchBtn = document.getElementById('modalWatchlistBtn');
    if (watchBtn) {
      watchBtn.innerHTML = `
        <i data-lucide="bookmark" style="width:16px;height:16px;${isWatchlisted ? 'fill:currentColor;' : ''}"></i>
        ${isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}
      `;
      if (window.lucide) window.lucide.createIcons({ root: watchBtn });
    }
  }

  // External Player Engine (VLC, MX Player, PotPlayer, M3U Download)
  function getCleanVideoTitle(title) {
    return cleanTitle(title).title || 'Movie';
  }

  function launchVLC(url, title) {
    if (!url) return;
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      const clean = encodeURIComponent(getCleanVideoTitle(title));
      window.location.href = `intent:${url}#Intent;package=org.videolan.vlc;type=video/*;S.title=${clean};end`;
    } else {
      window.location.href = `vlc://${url}`;
    }
    showToast('Dispatching stream to VLC Player...');
  }

  function launchMX(url) {
    if (!url) return;
    const intentUrl = `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;end`;
    window.location.href = intentUrl;
    showToast('Dispatching stream to MX Player...');
  }

  function launchPotPlayer(url) {
    if (!url) return;
    window.location.href = `potplayer://${url}`;
    showToast('Dispatching stream to PotPlayer...');
  }

  function downloadM3u(url, title) {
    if (!url) return;
    const name = getCleanVideoTitle(title);
    const content = `#EXTM3U\n#EXTINF:-1,${name}\n${url}\n`;
    const blob = new Blob([content], { type: 'application/x-mpegurl' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'movie'}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    showToast('Downloaded M3U Playlist file');
  }

  function copyStreamLink(url) {
    if (!url) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showToast('Direct stream link copied to clipboard!');
      }).catch(() => {
        showToast('Stream link: ' + url);
      });
    } else {
      showToast('Stream link: ' + url);
    }
  }

  function openExternalPlayerModal(url, title, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    state.extSelectedUrl = url || '';
    state.extSelectedTitle = title || 'Movie';

    const modal = document.getElementById('externalPlayersModal');
    const titleEl = document.getElementById('extModalMovieTitle');
    const chkDefault = document.getElementById('chkSetDefaultPlayer');
    const btnClear = document.getElementById('btnClearDefaultPlayer');

    if (titleEl) {
      titleEl.textContent = title ? `${title} (HD Stream)` : 'Choose preferred media player';
    }

    if (chkDefault) {
      chkDefault.checked = Boolean(state.defaultPlayer);
    }

    if (btnClear) {
      btnClear.style.display = state.defaultPlayer ? 'inline-block' : 'none';
    }

    // Update Default badges
    ['vlc', 'mx', 'pot'].forEach((p) => {
      const badge = document.getElementById(`badgeDefault${p.charAt(0).toUpperCase() + p.slice(1)}`);
      if (badge) {
        badge.style.display = state.defaultPlayer === p ? 'inline-block' : 'none';
      }
    });

    if (modal) {
      modal.classList.add('active');
      if (window.lucide) window.lucide.createIcons({ root: modal });
    }
  }

  function closeExternalPlayerModal() {
    const modal = document.getElementById('externalPlayersModal');
    if (modal) modal.classList.remove('active');
  }

  function onCardExtClick(url, title, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (state.defaultPlayer) {
      const playerLabels = { vlc: 'VLC Player', mx: 'MX Player', pot: 'PotPlayer' };
      const label = playerLabels[state.defaultPlayer] || state.defaultPlayer.toUpperCase();
      showToast(`Launching in ${label}... (Open details to change)`);
      launchSelectedExternal(state.defaultPlayer, url, title);
    } else {
      openExternalPlayerModal(url, title);
    }
  }

  function launchSelectedExternal(playerType, overrideUrl, overrideTitle) {
    const url = overrideUrl || state.extSelectedUrl;
    const title = overrideTitle || state.extSelectedTitle;
    if (!url) return;

    const chkDefault = document.getElementById('chkSetDefaultPlayer');
    if (chkDefault && chkDefault.checked && playerType !== 'm3u' && playerType !== 'copy') {
      state.defaultPlayer = playerType;
      localStorage.setItem('movielist_default_player', playerType);
    }

    closeExternalPlayerModal();

    if (playerType === 'vlc') {
      launchVLC(url, title);
    } else if (playerType === 'mx') {
      launchMX(url, title);
    } else if (playerType === 'pot') {
      launchPotPlayer(url, title);
    } else if (playerType === 'm3u') {
      downloadM3u(url, title);
    } else if (playerType === 'copy') {
      copyStreamLink(url);
    }
  }

  function clearDefaultPlayer() {
    state.defaultPlayer = '';
    localStorage.removeItem('movielist_default_player');
    const chkDefault = document.getElementById('chkSetDefaultPlayer');
    if (chkDefault) chkDefault.checked = false;
    const btnClear = document.getElementById('btnClearDefaultPlayer');
    if (btnClear) btnClear.style.display = 'none';

    ['vlc', 'mx', 'pot'].forEach((p) => {
      const badge = document.getElementById(`badgeDefault${p.charAt(0).toUpperCase() + p.slice(1)}`);
      if (badge) badge.style.display = 'none';
    });

    showToast('Reset default external player');
  }

  function onDefaultToggle(checked) {
    if (!checked) {
      clearDefaultPlayer();
    }
  }

  function openExternalFromDetails() {
    if (!state.activeMovie) return;
    openExternalPlayerModal(state.activeMovie.videoUrl, state.activeMovie.title);
  }

  function openExternalFromPlayer() {
    const video = document.getElementById('cinemaVideo');
    if (video) video.pause();
    const titleEl = document.getElementById('playerTitle');
    const title = titleEl ? titleEl.textContent : 'Playing Media';
    const url = video ? video.src : '';
    openExternalPlayerModal(url, title);
  }

  // Trailer Preview Modal
  function openTrailer(title) {
    const trailerModal = document.getElementById('trailerModal');
    const iframe = document.getElementById('trailerIframe');
    const trailerTitle = document.getElementById('trailerMovieTitle');
    if (!trailerModal || !iframe) return;

    if (trailerTitle) trailerTitle.textContent = `${title} - Official Trailer`;
    
    // Clean YouTube embed search query without cookies
    const query = encodeURIComponent(`${title} official trailer`);
    iframe.src = `https://www.youtube-nocookie.com/embed?listType=search&list=${query}&autoplay=1`;

    trailerModal.classList.add('active');
    if (window.lucide) window.lucide.createIcons({ root: trailerModal });
  }

  function closeTrailer() {
    const trailerModal = document.getElementById('trailerModal');
    const iframe = document.getElementById('trailerIframe');
    if (iframe) iframe.src = '';
    if (trailerModal) trailerModal.classList.remove('active');
  }

  // Built-in Video Player & Ambilight Engine
  function playMovie(url, title) {
    const playerModal = document.getElementById('playerModal');
    const video = document.getElementById('cinemaVideo');
    const titleEl = document.getElementById('playerTitle');
    if (!playerModal || !video) return;

    if (titleEl) titleEl.textContent = title || 'Playing Media';

    // Find full movie record for progress saving
    const currentMovie = state.allMovies.find((m) => m.videoUrl === url) || {
      id: url,
      title: title,
      posterUrl: '',
      videoUrl: url,
      category: 'Movie',
      quality: 'HD'
    };

    video.src = sanitizeUrl(url);
    video.volume = 1.0;
    video.muted = false;

    playerModal.classList.add('active');

    // Restore saved playback position
    const resumeKey = `movielist_resume_${url}`;
    const savedTime = parseFloat(localStorage.getItem(resumeKey) || '0');
    if (savedTime > 15) {
      video.currentTime = savedTime;
    }

    // Save playback progress on timeupdate & update continue watching
    video.ontimeupdate = () => {
      if (video.currentTime > 5) {
        localStorage.setItem(resumeKey, String(video.currentTime));
      }
      if (video.currentTime > 10) {
        saveWatchProgress(currentMovie, video.currentTime, video.duration);
      }
    };

    video.onplay = () => {
      startAmbilightLoop();
    };

    video.onpause = () => {
      stopAmbilightLoop();
    };

    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
      showToast('Click unmute on player controls to enable sound');
    });
  }

  function closePlayer() {
    const playerModal = document.getElementById('playerModal');
    const video = document.getElementById('cinemaVideo');
    stopAmbilightLoop();
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    if (playerModal) {
      playerModal.classList.remove('active');
    }
  }

  // Dynamic Ambilight Frame Sampler Loop
  function startAmbilightLoop() {
    if (!state.ambilightEnabled) return;
    const canvas = document.getElementById('playerAmbilightCanvas');
    const video = document.getElementById('cinemaVideo');
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    stopAmbilightLoop();

    function renderAmbilight() {
      if (!video.paused && !video.ended && video.readyState >= 2) {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (e) {}
      }
      state.ambilightLoopId = requestAnimationFrame(renderAmbilight);
    }

    state.ambilightLoopId = requestAnimationFrame(renderAmbilight);
  }

  function stopAmbilightLoop() {
    if (state.ambilightLoopId) {
      cancelAnimationFrame(state.ambilightLoopId);
      state.ambilightLoopId = null;
    }
  }

  function toggleAmbilight() {
    state.ambilightEnabled = !state.ambilightEnabled;
    const cinemaBox = document.querySelector('.player-cinema-box');
    const btn = document.getElementById('btnToggleAmbilight');
    if (cinemaBox) {
      cinemaBox.classList.toggle('ambilight-off', !state.ambilightEnabled);
    }
    if (btn) {
      btn.classList.toggle('active', state.ambilightEnabled);
    }
    if (state.ambilightEnabled) {
      startAmbilightLoop();
      showToast('Ambilight glow enabled');
    } else {
      stopAmbilightLoop();
      showToast('Ambilight glow disabled');
    }
  }

  function setPlaybackSpeed(speed) {
    const video = document.getElementById('cinemaVideo');
    if (video) {
      video.playbackRate = parseFloat(speed);
      showToast(`Playback speed set to ${speed}x`);
    }
  }

  // Global Keyboard Navigation
  function setupKeybindings() {
    document.addEventListener('keydown', (e) => {
      const playerModal = document.getElementById('playerModal');
      const detailsModal = document.getElementById('detailsModal');
      const trailerModal = document.getElementById('trailerModal');
      const video = document.getElementById('cinemaVideo');

      if (e.key === 'Escape') {
        const extModal = document.getElementById('externalPlayersModal');
        if (extModal && extModal.classList.contains('active')) {
          closeExternalPlayerModal();
        } else if (trailerModal && trailerModal.classList.contains('active')) {
          closeTrailer();
        } else if (playerModal && playerModal.classList.contains('active')) {
          closePlayer();
        } else if (detailsModal && detailsModal.classList.contains('active')) {
          closeDetails();
        }
      }

      // Player hotkeys
      if (playerModal && playerModal.classList.contains('active') && video) {
        if (e.key === ' ' || e.key === 'k') {
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
        } else if (e.key === 'f') {
          e.preventDefault();
          if (document.fullscreenElement) document.exitFullscreen();
          else video.requestFullscreen().catch(() => {});
        } else if (e.key === 'm') {
          e.preventDefault();
          video.muted = !video.muted;
        } else if (e.key === 'ArrowRight') {
          video.currentTime += 10;
        } else if (e.key === 'ArrowLeft') {
          video.currentTime -= 10;
        }
      }
    });
  }

  // Initialization
  function init() {
    initTheme();
    loadWatchlist();
    loadCatalog();
    setupKeybindings();

    const searchInput = document.getElementById('searchInput');
    let searchDebounce = null;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          setSearch(e.target.value);
        }, 150);
      });
    }

    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
      detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) closeDetails();
      });
    }

    const playerModal = document.getElementById('playerModal');
    if (playerModal) {
      playerModal.addEventListener('click', (e) => {
        if (e.target === playerModal) closePlayer();
      });
    }

    const trailerModal = document.getElementById('trailerModal');
    if (trailerModal) {
      trailerModal.addEventListener('click', (e) => {
        if (e.target === trailerModal) closeTrailer();
      });
    }

    const extModal = document.getElementById('externalPlayersModal');
    if (extModal) {
      extModal.addEventListener('click', (e) => {
        if (e.target === extModal) closeExternalPlayerModal();
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // Public API
  window.MovieList = {
    setCategory,
    setSort,
    nextSlide,
    prevSlide,
    goToSlide: (idx) => {
      showSlide(idx);
      startCarouselAuto();
    },
    slideRow,
    toggleWatchlist,
    removeHistory,
    openDetails,
    closeDetails,
    openTrailer,
    closeTrailer,
    playMovie,
    closePlayer,
    toggleAmbilight,
    setPlaybackSpeed,
    launchVLC,
    launchMX,
    launchPotPlayer,
    downloadM3u,
    copyStreamLink,
    openExternalPlayerModal,
    closeExternalPlayerModal,
    onCardExtClick,
    launchSelectedExternal,
    clearDefaultPlayer,
    onDefaultToggle,
    openExternalFromDetails,
    openExternalFromPlayer,
    scrollToCategories,
    focusSearch,
    toggleTheme
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
