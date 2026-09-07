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
    moviesMap: new Map(),
    activeCategory: 'All',
    searchQuery: '',
    searchActiveDropdownIdx: -1,
    currentDropdownItems: [],
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
    theme: localStorage.getItem('movielist_theme') || 'dark',
    allCatalogLoaded: false,
    tvCatalog: null,
    currentTvEntry: null,
    currentSeasonEpisodes: [],
    currentSeasonName: '',
    currentSelectedSeasonIdx: 0,
    currentPlayingEpisodeIdx: -1,
    episodeFilterQuery: '',
    gridRenderLimit: 48,
    lastBrowseScrollY: 0,
    playerControlsTimeout: null,
    isScrubbing: false,
    activeAudioTrackIndex: 0
  };

  let movieSequenceId = 0;

  function registerMovie(m) {
    if (!m) return;
    if (!state.moviesMap) state.moviesMap = new Map();
    if (m.uid) state.moviesMap.set(m.uid, m);
    if (m.id) state.moviesMap.set(String(m.id), m);
    if (m.videoUrl) state.moviesMap.set(String(m.videoUrl), m);
    if (m.rawTitle) state.moviesMap.set(String(m.rawTitle), m);
  }

  function findMovieById(id) {
    if (!id) return null;
    const key = String(id).trim();

    // 1. Direct Map lookup
    if (state.moviesMap && state.moviesMap.has(key)) {
      return state.moviesMap.get(key);
    }

    // 2. Try URI decoding
    try {
      const decoded = decodeURIComponent(key);
      if (state.moviesMap && state.moviesMap.has(decoded)) {
        return state.moviesMap.get(decoded);
      }
    } catch (e) {}

    // 3. Check filtered movies (currently on screen in grid)
    if (Array.isArray(state.filteredMovies)) {
      const m = state.filteredMovies.find(
        (it) => it.uid === key || String(it.id) === key || it.videoUrl === key || it.rawTitle === key || it.title === key
      );
      if (m) return m;
    }

    // 4. Check all movies
    if (Array.isArray(state.allMovies)) {
      const m = state.allMovies.find(
        (it) => it.uid === key || String(it.id) === key || it.videoUrl === key || it.rawTitle === key || it.title === key
      );
      if (m) return m;
    }

    // 5. Check carousel movies
    if (Array.isArray(state.carouselMovies)) {
      const m = state.carouselMovies.find(
        (it) => it.uid === key || String(it.id) === key || it.videoUrl === key || it.rawTitle === key || it.title === key
      );
      if (m) return m;
    }

    // 6. Check all categories
    if (state.categories && typeof state.categories === 'object') {
      for (const catList of Object.values(state.categories)) {
        if (Array.isArray(catList)) {
          const m = catList.find(
            (it) => it.uid === key || String(it.id) === key || it.videoUrl === key || it.rawTitle === key || it.title === key
          );
          if (m) return m;
        }
      }
    }

    // 7. Case-insensitive title match fallback
    const lower = key.toLowerCase();
    const allPool = [
      ...(state.filteredMovies || []),
      ...(state.allMovies || []),
      ...(state.carouselMovies || [])
    ];
    return (
      allPool.find(
        (m) =>
          (m.title && m.title.toLowerCase() === lower) ||
          (m.rawTitle && m.rawTitle.toLowerCase() === lower)
      ) || null
    );
  }

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

  function toggleWatchlist(movieUrlOrUid, movieTitle, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    let url = movieUrlOrUid;
    let title = movieTitle || '';

    if (!url || !url.startsWith('http')) {
      const movie = findMovieById(movieUrlOrUid);
      if (movie) {
        url = movie.videoUrl;
        title = movie.title;
      }
    }

    if (!url) return;

    if (state.watchlist.has(url)) {
      state.watchlist.delete(url);
      showToast(`Removed "${title || 'Movie'}" from Watchlist`);
    } else {
      state.watchlist.add(url);
      showToast(`Added "${title || 'Movie'}" to Watchlist`);
    }
    try {
      localStorage.setItem('movielist_watchlist', JSON.stringify([...state.watchlist]));
    } catch (e) {}

    updateWatchlistBadge();
    renderGrid();
    updateModalWatchlistState();
  }

  function toggleWatchlistFromCard(uid, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const movie = findMovieById(uid);
    if (!movie) return;
    toggleWatchlist(movie.videoUrl, movie.title, event);
  }

  function updateWatchlistBadge() {
    const badge = document.getElementById('watchlistBadge');
    const dockBadge = document.getElementById('dockWatchlistBadge');
    const count = state.watchlist.size;
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    if (dockBadge) {
      dockBadge.textContent = count;
      dockBadge.style.display = count > 0 ? 'flex' : 'none';
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
    updateThemeControls();
    if (window.lucide) window.lucide.createIcons();
  }

  function setTheme(theme) {
    if (state.theme === theme) return;
    state.theme = theme;
    localStorage.setItem('movielist_theme', state.theme);
    initTheme();
    showToast(`Switched to ${state.theme === 'dark' ? 'Dark' : 'Light'} Mode`);
  }

  function toggleTheme() {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  function updateThemeControls() {
    const darkBtn = document.getElementById('themeSegmentDark');
    const lightBtn = document.getElementById('themeSegmentLight');
    if (darkBtn) darkBtn.classList.toggle('active', state.theme === 'dark');
    if (lightBtn) lightBtn.classList.toggle('active', state.theme === 'light');
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

  const SEPARATED_CATEGORIES = [
    { key: "Today's Updates", file: './data/categories/today.json' },
    { key: "Top Rated", file: './data/categories/top_rated.json' },
    { key: "Hollywood 1080p", file: './data/categories/hollywood.json' },
    { key: "Bollywood", file: './data/categories/bollywood.json' },
    { key: "South Action", file: './data/categories/south_action.json' },
    { key: "TV Series", file: './data/categories/tv_series.json' },
    { key: "K-Drama", file: './data/categories/kdrama.json' },
    { key: "Animation", file: './data/categories/animation.json' },
    { key: "Bangla", file: './data/categories/bangla.json' }
  ];

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
    else if (/game of thrones/i.test(rawTitle)) rating = '9.2';
    else if (/breaking bad/i.test(rawTitle)) rating = '9.5';

    const uid = `mov_${++movieSequenceId}`;
    const movieObj = {
      uid,
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
    registerMovie(movieObj);
    return movieObj;
  }

  // Ultra-Fast Parallel Separated Category Loader for Instant Home Render
  async function loadSeparatedCategories() {
    let loadedAny = false;
    await Promise.allSettled(
      SEPARATED_CATEGORIES.map(async ({ key, file }) => {
        try {
          const res = await fetch(file + '?v=' + Date.now());
          if (!res.ok) return;
          const items = await res.json();
          if (Array.isArray(items) && items.length > 0) {
            const mapped = items.map((item) => mapItem(item, key));
            state.categories[key] = mapped;
            mapped.forEach((m) => {
              registerMovie(m);
              const trackKey = m.videoUrl || m.id || m.rawTitle;
              if (trackKey && !seenCatalogUrls.has(trackKey)) {
                seenCatalogUrls.add(trackKey);
                state.allMovies.push(m);
              }
            });
            loadedAny = true;
          }
        } catch (e) {
          // ignore individual category error
        }
      })
    );

    if (loadedAny) {
      if (!state.carouselMovies.length) {
        const heroPool =
          state.categories["Today's Updates"] ||
          state.categories['Top Rated'] ||
          state.categories['TV Series'] ||
          state.allMovies;
        state.carouselMovies = heroPool.slice(0, 6);
        renderHeroCarousel();
      }
      filterAndRenderGrid();
      loadHistory();
    }
    return loadedAny;
  }

  // Full Library Background Loader (Includes all TV Series like Game of Thrones & all movies)
  let fullLibraryLoadingPromise = null;
  let bgRenderDebounceTimer = null;

  function scheduleBackgroundFilterRender() {
    clearTimeout(bgRenderDebounceTimer);
    bgRenderDebounceTimer = setTimeout(() => {
      if (state.searchQuery || state.activeCategory !== 'All') {
        filterAndRenderGrid(false);
      }
    }, 280);
  }

  function loadFullLibraryInBackground() {
    if (state.allCatalogLoaded || fullLibraryLoadingPromise) {
      return fullLibraryLoadingPromise || Promise.resolve();
    }

    fullLibraryLoadingPromise = (async () => {
      const allFiles = [
        { key: 'TV Series', file: './data/tv_series.json' },
        { key: 'Top Rated', file: './data/top_rated.json' },
        { key: 'Hollywood 1080p', file: './data/hollywood.json' },
        { key: 'Bollywood', file: './data/bollywood.json' },
        { key: 'K-Drama', file: './data/kdrama.json' },
        { key: 'Animation', file: './data/animation.json' },
        { key: 'Bangla', file: './data/bangla.json' },
        { key: 'South Action', file: './data/south_action.json' },
        { key: 'South Original', file: './data/south_original.json' }
      ];

      for (const item of allFiles) {
        try {
          const res = await fetch(item.file + '?v=' + Date.now());
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
              loadedCategories.add(item.key);
              const mapped = list.map((entry) => mapItem(entry, item.key));
              state.categories[item.key] = mapped;
              mapped.forEach((m) => {
                registerMovie(m);
                const trackKey = m.videoUrl || m.id || m.rawTitle;
                if (trackKey && !seenCatalogUrls.has(trackKey)) {
                  seenCatalogUrls.add(trackKey);
                  state.allMovies.push(m);
                }
              });
              scheduleBackgroundFilterRender();
            }
          }
        } catch (e) {
          // ignore
        }
      }
      state.allCatalogLoaded = true;
      scheduleBackgroundFilterRender();
      if (window.location.hash.startsWith('#media=') && !state.activeMovie) {
        checkInitialHash();
      }
    })();

    return fullLibraryLoadingPromise;
  }

  // Data Hydration from Separated JSONs and Background Catalogs
  async function loadCatalog() {
    const separatedSuccess = await loadSeparatedCategories();

    try {
      const res = await fetch('./home_data.json?v=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        processCatalogData(data);
      } else if (!separatedSuccess) {
        processFallbackData();
      }
    } catch (err) {
      if (!separatedSuccess) {
        console.error('Catalog load error, using fallback:', err);
        processFallbackData();
      }
    }

    // Trigger full library loading in background so search finds Game of Thrones & all movies
    setTimeout(() => {
      loadFullLibraryInBackground();
    }, 120);
  }

  async function ensureCategoryLoaded(catKey) {
    if (!catKey || catKey === 'All' || catKey === 'Watchlist') return;
    if (loadedCategories.has(catKey)) {
      if (state.activeCategory === catKey) {
        filterAndRenderGrid();
      }
      return;
    }
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
          registerMovie(m);
          const trackKey = m.videoUrl || m.id || m.rawTitle;
          if (trackKey && !seenCatalogUrls.has(trackKey)) {
            seenCatalogUrls.add(trackKey);
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
    if (!state.categories) state.categories = {};

    if (Array.isArray(data.carousel) && data.carousel.length > 0) {
      state.carouselMovies = data.carousel.map((item) => mapItem(item, 'Featured'));
      state.carouselMovies.forEach((m) => {
        registerMovie(m);
        const trackKey = m.videoUrl || m.id || m.rawTitle;
        if (trackKey && !seenCatalogUrls.has(trackKey)) {
          seenCatalogUrls.add(trackKey);
          state.allMovies.push(m);
        }
      });
    }

    if (data.categories && typeof data.categories === 'object') {
      for (const [catName, items] of Object.entries(data.categories)) {
        if (Array.isArray(items) && items.length > 0) {
          const mapped = items.map((item) => mapItem(item, catName));
          mapped.forEach((m) => {
            registerMovie(m);
            const trackKey = m.videoUrl || m.id || m.rawTitle;
            if (trackKey && !seenCatalogUrls.has(trackKey)) {
              seenCatalogUrls.add(trackKey);
              state.allMovies.push(m);
            }
          });
          // Do not overwrite category if already populated with separated category items
          if (!state.categories[catName] || state.categories[catName].length === 0) {
            state.categories[catName] = mapped;
          }
        }
      }
    }

    renderHeroCarousel();
    filterAndRenderGrid();
    loadHistory();
    checkInitialHash();
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
                <button class="btn-glass" onclick="window.MovieList.openDetails('${movie.uid}')">
                  <i data-lucide="info" style="width:16px;height:16px;"></i>
                  Details
                </button>
                <button class="icon-action-btn ${isWatchlisted ? 'active' : ''}" onclick="window.MovieList.toggleWatchlistFromCard('${movie.uid}', event)" title="Watchlist">
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

  // Mobile Dock, Category Drawer & Navigation Helpers
  function openCategoryDrawer() {
    const drawer = document.getElementById('categoryDrawerOverlay');
    if (drawer) {
      drawer.style.display = 'flex';
      void drawer.offsetHeight; // Force reflow for smooth animation
      drawer.classList.add('active');
      document.body.style.overflow = 'hidden';
      if (window.lucide) window.lucide.createIcons({ root: drawer });
    }
  }

  function closeCategoryDrawer() {
    const drawer = document.getElementById('categoryDrawerOverlay');
    if (drawer) {
      drawer.classList.remove('active');
      document.body.style.overflow = '';
      setTimeout(() => {
        if (!drawer.classList.contains('active')) {
          drawer.style.display = 'none';
        }
      }, 320);
    }
  }

  function selectCategoryFromDrawer(cat) {
    closeCategoryDrawer();
    setCategory(cat);
  }

  // Settings & Preferences Drawer Management
  function openSettingsDrawer() {
    const drawer = document.getElementById('settingsDrawerOverlay');
    if (drawer) {
      drawer.style.display = 'flex';
      void drawer.offsetHeight; // Force reflow
      drawer.classList.add('active');
      document.body.style.overflow = 'hidden';
      updateThemeControls();
      loadSettingsState();
      if (window.lucide) window.lucide.createIcons({ root: drawer });
    }
  }

  function closeSettingsDrawer() {
    const drawer = document.getElementById('settingsDrawerOverlay');
    if (drawer) {
      drawer.classList.remove('active');
      document.body.style.overflow = '';
      setTimeout(() => {
        if (!drawer.classList.contains('active')) {
          drawer.style.display = 'none';
        }
      }, 320);
    }
  }

  function loadSettingsState() {
    const boosterSwitch = document.getElementById('settingVolumeBooster');
    const resumeSwitch = document.getElementById('settingAutoResume');
    if (boosterSwitch) {
      boosterSwitch.checked = localStorage.getItem('movielist_booster_enabled') === 'true';
    }
    if (resumeSwitch) {
      const savedResume = localStorage.getItem('movielist_auto_resume');
      resumeSwitch.checked = savedResume === null ? true : savedResume === 'true';
    }
  }

  function toggleSetting(key, value) {
    if (key === 'volumeBooster') {
      localStorage.setItem('movielist_booster_enabled', value ? 'true' : 'false');
      if (window.AudioEngine && typeof window.AudioEngine.setBooster === 'function') {
        window.AudioEngine.setBooster(value ? 2.5 : 1.0);
      }
      showToast(value ? 'Volume Booster enabled' : 'Volume Booster disabled');
    } else if (key === 'autoResume') {
      localStorage.setItem('movielist_auto_resume', value ? 'true' : 'false');
      showToast(value ? 'Auto-Resume enabled' : 'Auto-Resume disabled');
    }
  }

  function clearContinueWatching() {
    try {
      localStorage.removeItem('movielist_history');
      state.history = [];
      renderContinueWatching();
      showToast('Playback history cleared');
    } catch (e) {
      showToast('Failed to clear history');
    }
  }

  function clearSearchHistory() {
    try {
      localStorage.removeItem('movielist_recent_searches');
      showToast('Search history cleared');
    } catch (e) {
      showToast('Failed to clear search history');
    }
  }

  function toggleMobileSearch(forceState) {
    const bar = document.getElementById('mobileSearchBar');
    const input = document.getElementById('mobileSearchInput');
    if (!bar) return;
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !bar.classList.contains('active');
    bar.classList.toggle('active', shouldOpen);
    bar.style.display = shouldOpen ? 'block' : 'none';
    if (shouldOpen) {
      if (input) {
        setTimeout(() => {
          input.focus();
          const val = (input.value || '').trim();
          if (val.length >= 2) {
            renderLiveSearchResults(val);
          } else {
            showRecentOrPopularDropdown();
          }
        }, 150);
      }
    } else {
      if (input) input.blur();
      hideSearchDropdown();
    }
  }

  function clearMobileSearch() {
    const mobileInput = document.getElementById('mobileSearchInput');
    const searchInput = document.getElementById('searchInput');
    if (mobileInput) mobileInput.value = '';
    if (searchInput) searchInput.value = '';
    setSearch('');
    showRecentOrPopularDropdown();
  }

  // Live Search Suggestions & Auto-Complete Engine
  const POPULAR_SEARCH_TERMS = [
    'Game of Thrones',
    'Breaking Bad',
    'The Dark Knight',
    'Stranger Things',
    'Chernobyl',
    'Top Rated',
    'Animation',
    '4K UHD'
  ];

  const RECENT_SEARCHES_KEY = 'movielist_recent_searches';
  const MAX_RECENT_SEARCHES = 8;

  function getRecentSearches() {
    try {
      const data = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveRecentSearch(rawQuery) {
    if (!rawQuery) return;
    const term = String(rawQuery).trim();
    if (!term || term.length < 2) return;

    try {
      let list = getRecentSearches();
      list = list.filter((item) => item.toLowerCase() !== term.toLowerCase());
      list.unshift(term);
      if (list.length > MAX_RECENT_SEARCHES) {
        list = list.slice(0, MAX_RECENT_SEARCHES);
      }
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
    } catch (e) {
      // ignore storage errors
    }
  }

  function removeRecentSearch(term, e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      let list = getRecentSearches();
      list = list.filter((item) => item.toLowerCase() !== String(term).toLowerCase());
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
      showRecentOrPopularDropdown();
    } catch (err) {
      // ignore
    }
  }

  function clearRecentSearches(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
      showRecentOrPopularDropdown();
    } catch (err) {
      // ignore
    }
  }

  function scoreSearchMatches(rawQuery, sourceList) {
    if (!rawQuery || !sourceList || !sourceList.length) return [];
    const rawQ = String(rawQuery).trim().toLowerCase();
    if (!rawQ) return [];

    const tokens = rawQ.split(/[\s_.-]+/).filter(Boolean);

    if (rawQ.length === 1) {
      return sourceList.filter((m) => m && m.title && m.title.toLowerCase().startsWith(rawQ));
    }

    if (tokens.length === 0) return [];

    const scored = [];
    const len = sourceList.length;
    for (let i = 0; i < len; i++) {
      const m = sourceList[i];
      if (!m || !m.title) continue;
      const t = m.title.toLowerCase();
      let score = 0;

      if (t === rawQ) {
        score = 1000;
      } else if (t.startsWith(rawQ)) {
        score = 800 - Math.min(200, t.length - rawQ.length);
      } else if (t.includes(rawQ)) {
        score = 600 - Math.min(200, t.indexOf(rawQ));
      } else {
        let matches = 0;
        for (let j = 0; j < tokens.length; j++) {
          if (t.includes(tokens[j])) matches++;
        }
        if (matches === tokens.length) {
          score = 400 + matches * 20;
        } else if (tokens.length > 1 && matches >= 1) {
          score = 200 + matches * 20;
        }
      }

      if (score > 0) {
        scored.push({ movie: m, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.movie);
  }

  function getActiveDropdownContainers() {
    return {
      desktopDropdown: document.getElementById('searchLiveDropdown'),
      mobileDropdown: document.getElementById('mobileSearchLiveDropdown')
    };
  }

  function renderToActiveDropdown(html) {
    const isMobile = window.innerWidth <= 768;
    const { desktopDropdown, mobileDropdown } = getActiveDropdownContainers();
    const target = isMobile ? mobileDropdown : desktopDropdown;
    const other = isMobile ? desktopDropdown : mobileDropdown;
    if (other) {
      other.style.display = 'none';
      other.innerHTML = '';
    }
    if (target) {
      target.innerHTML = html;
      target.style.display = 'block';
    }
  }

  function hideSearchDropdown() {
    state.searchActiveDropdownIdx = -1;
    state.currentDropdownItems = [];
    const { desktopDropdown, mobileDropdown } = getActiveDropdownContainers();
    if (desktopDropdown) {
      desktopDropdown.style.display = 'none';
      desktopDropdown.innerHTML = '';
    }
    if (mobileDropdown) {
      mobileDropdown.style.display = 'none';
      mobileDropdown.innerHTML = '';
    }
  }

  function showRecentOrPopularDropdown() {
    const recent = getRecentSearches();
    state.searchActiveDropdownIdx = -1;
    state.currentDropdownItems = [];

    let html = '';

    if (recent.length > 0) {
      html += `
        <div class="search-dropdown-header">
          <span>Recent Searches</span>
          <button class="search-dropdown-clear-btn" onclick="window.MovieList.clearRecentSearches(event)">Clear</button>
        </div>
        <div class="search-tags-container">
          ${recent
            .map(
              (term) => `
            <span class="search-tag-chip" onclick="window.MovieList.fillAndSearch('${escapeQuotes(term)}')">
              <span>${escapeHtml(term)}</span>
              <span class="search-tag-chip-remove" onclick="window.MovieList.removeRecentSearch('${escapeQuotes(term)}', event)" title="Remove">&times;</span>
            </span>
          `
            )
            .join('')}
        </div>
      `;
    }

    html += `
      <div class="search-dropdown-header">
        <span>Popular Suggestions</span>
      </div>
      <div class="search-tags-container">
        ${POPULAR_SEARCH_TERMS.map(
          (term) => `
          <span class="search-tag-chip" onclick="window.MovieList.fillAndSearch('${escapeQuotes(term)}')">
            <span>${escapeHtml(term)}</span>
          </span>
        `
        ).join('')}
      </div>
    `;

    renderToActiveDropdown(html);
  }

  function renderLiveSearchResults(rawQuery) {
    const trimmed = (rawQuery || '').trim();
    if (trimmed.length < 2) {
      showRecentOrPopularDropdown();
      return;
    }

    if (!state.allCatalogLoaded) {
      loadFullLibraryInBackground();
    }

    const matched = scoreSearchMatches(trimmed, state.allMovies);
    const totalMatches = matched.length;
    const topMatches = matched.slice(0, 7);

    state.currentDropdownItems = topMatches;
    state.searchActiveDropdownIdx = -1;

    if (totalMatches === 0) {
      renderToActiveDropdown(`
        <div class="search-dropdown-empty">
          No matches found for "${escapeHtml(trimmed)}"
        </div>
      `);
      return;
    }

    const starSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="var(--accent-gold)" stroke="var(--accent-gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    const playSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;

    const itemsHtml = topMatches
      .map((m, idx) => {
        return `
          <div class="search-dropdown-item" 
               data-dropdown-idx="${idx}"
               onclick="window.MovieList.selectSearchItem('${escapeQuotes(m.id)}', '${escapeQuotes(trimmed)}')">
            <img class="search-dropdown-poster" 
                 src="${sanitizeUrl(m.posterUrl)}" 
                 alt="${escapeQuotes(m.title)}" 
                 loading="lazy" 
                 onerror="this.src='icons/icon-512.png'">
            <div class="search-dropdown-info">
              <div class="search-dropdown-title">${escapeHtml(m.title)}</div>
              <div class="search-dropdown-meta">
                <span class="search-dropdown-quality">${escapeHtml(m.quality)}</span>
                <span>${escapeHtml(m.category)}</span>
                ${m.year ? `<span>• ${escapeHtml(m.year)}</span>` : ''}
                <span class="search-dropdown-rating">${starSvg} ${escapeHtml(m.rating)}</span>
              </div>
            </div>
            <div class="search-dropdown-actions">
              <button class="search-dropdown-play-btn" 
                      title="Play Now" 
                      aria-label="Play Now"
                      onclick="window.MovieList.selectPlaySearchItem('${escapeQuotes(m.videoUrl)}', '${escapeQuotes(m.title)}', '${escapeQuotes(trimmed)}', event)">
                ${playSvg}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    const footerHtml = `
      <div class="search-dropdown-footer" onclick="window.MovieList.viewAllSearchResults('${escapeQuotes(trimmed)}')">
        <span>View all ${totalMatches.toLocaleString()} results in catalog</span>
        <span>&rarr;</span>
      </div>
    `;

    renderToActiveDropdown(`
      <div class="search-dropdown-header">
        <span>Matching Titles (${totalMatches.toLocaleString()})</span>
      </div>
      <div class="search-dropdown-list">
        ${itemsHtml}
      </div>
      ${footerHtml}
    `);
  }

  function selectSearchItem(id, query) {
    saveRecentSearch(query);
    hideSearchDropdown();
    if (window.innerWidth <= 768) {
      toggleMobileSearch(false);
    }
    openDetails(id);
  }

  function selectPlaySearchItem(url, title, query, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    saveRecentSearch(query);
    hideSearchDropdown();
    if (window.innerWidth <= 768) {
      toggleMobileSearch(false);
    }
    playMovie(url, title);
  }

  function scrollToCatalog() {
    const target = document.getElementById('catalogHeaderRow') || document.getElementById('moviesGrid');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function viewAllSearchResults(query) {
    const term = (query || '').trim();
    if (!term) return;
    saveRecentSearch(term);
    hideSearchDropdown();
    if (window.innerWidth <= 768) {
      toggleMobileSearch(false);
    }
    setSearch(term);
    scrollToCatalog();
  }

  function fillAndSearch(term) {
    const mainInput = document.getElementById('searchInput');
    const mobileInput = document.getElementById('mobileSearchInput');
    if (mainInput) mainInput.value = term;
    if (mobileInput) mobileInput.value = term;
    viewAllSearchResults(term);
  }

  function handleDropdownKeyNav(e, inputEl) {
    const isMobile = window.innerWidth <= 768;
    const { desktopDropdown, mobileDropdown } = getActiveDropdownContainers();
    const targetDropdown = isMobile ? mobileDropdown : desktopDropdown;

    if (!targetDropdown || targetDropdown.style.display === 'none') {
      if (e.key === 'Enter') {
        const val = (inputEl.value || '').trim();
        if (val) {
          viewAllSearchResults(val);
        }
      }
      return;
    }

    const items = targetDropdown.querySelectorAll('.search-dropdown-item');
    const count = items.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (count === 0) return;
      state.searchActiveDropdownIdx = (state.searchActiveDropdownIdx + 1) % count;
      updateDropdownSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (count === 0) return;
      state.searchActiveDropdownIdx = (state.searchActiveDropdownIdx - 1 + count) % count;
      updateDropdownSelection(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (state.searchActiveDropdownIdx >= 0 && state.searchActiveDropdownIdx < state.currentDropdownItems.length) {
        const selected = state.currentDropdownItems[state.searchActiveDropdownIdx];
        selectSearchItem(selected.id, inputEl.value);
      } else {
        const val = (inputEl.value || '').trim();
        if (val) {
          viewAllSearchResults(val);
        } else {
          hideSearchDropdown();
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideSearchDropdown();
    }
  }

  function updateDropdownSelection(items) {
    items.forEach((item, idx) => {
      const isSelected = idx === state.searchActiveDropdownIdx;
      item.classList.toggle('selected', isSelected);
      if (isSelected) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  function scrollToCategories() {
    const el = document.getElementById('categoryPillsRow');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function focusSearch() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      toggleMobileSearch(true);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const input = document.getElementById('searchInput');
      if (input) {
        setTimeout(() => input.focus(), 250);
      }
    }
  }

  // Filtering, Searching & Sorting
  function setCategory(cat) {
    if (document.body.classList.contains('details-open')) {
      closeDetails(false);
    }
    closeCategoryDrawer();
    toggleMobileSearch(false);

    state.activeCategory = cat || 'All';
    document.querySelectorAll('.category-pill').forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.category === cat);
    });
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.category === cat);
    });

    // Update Google App Bottom Navigation Active State
    const dockHome = document.getElementById('dockBtnHome');
    const dockMovies = document.getElementById('dockBtnMovies');
    const dockSeries = document.getElementById('dockBtnSeries');
    const dockCategories = document.getElementById('dockBtnCategories');
    const dockWatchlist = document.getElementById('dockBtnWatchlist');

    const isMovies = ['Hollywood 1080p', 'Bollywood', 'South Action', 'Bangla'].includes(cat);
    const isSeries = ['TV Series', 'K-Drama', 'Animation'].includes(cat);

    if (dockHome) dockHome.classList.toggle('active', cat === 'All');
    if (dockMovies) dockMovies.classList.toggle('active', isMovies);
    if (dockSeries) dockSeries.classList.toggle('active', isSeries);
    if (dockWatchlist) dockWatchlist.classList.toggle('active', cat === 'Watchlist');
    if (dockCategories) dockCategories.classList.toggle('active', cat !== 'All' && !isMovies && !isSeries && cat !== 'Watchlist');

    if (cat === 'All') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      ensureCategoryLoaded(cat);
    }

    filterAndRenderGrid();
  }

  const GRID_PAGE_SIZE = 48;

  function setSearch(query) {
    const prev = state.searchQuery;
    state.searchQuery = (query || '').trim().toLowerCase();

    // Ensure full library is being loaded so Game of Thrones and all titles are matched
    if (state.searchQuery && !state.allCatalogLoaded) {
      loadFullLibraryInBackground();
    }

    // Sync search input values
    const mainInput = document.getElementById('searchInput');
    const mobileInput = document.getElementById('mobileSearchInput');
    if (mainInput && mainInput.value !== (query || '')) mainInput.value = query || '';
    if (mobileInput && mobileInput.value !== (query || '')) mobileInput.value = query || '';

    const clearBtn = document.getElementById('mobileSearchClearBtn');
    if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';

    if (prev !== state.searchQuery) {
      filterAndRenderGrid(true);
    }
  }

  function setSort(sortBy) {
    state.sortBy = sortBy;
    filterAndRenderGrid(true);
  }

  // Shared Movie Card HTML Generator with Inline Clean SVGs (Superfast 0ms rendering)
  function renderMovieCardHtml(m) {
    registerMovie(m);
    const isWatchlisted = state.watchlist.has(m.videoUrl);
    const safeUid = m.uid || `mov_${m.id}`;
    const tvSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`;
    const bookmarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${isWatchlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`;
    const playSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
    const starSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="var(--accent-gold)" stroke="var(--accent-gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    return `
      <div class="movie-card" data-movie-uid="${safeUid}" onclick="window.MovieList.openDetails('${safeUid}')">
        <div class="card-poster-wrap">
          <span class="card-badge-top-left">${escapeHtml(m.quality)}</span>
          <div class="card-actions-top-right">
            <button class="card-icon-action card-ext-btn" 
                    data-movie-uid="${safeUid}"
                    onclick="window.MovieList.onCardExtClick('${safeUid}', event)" 
                    title="Play in External App (VLC / MX Player)" 
                    aria-label="Play in External App">
              ${tvSvg}
            </button>
            <button class="card-icon-action card-watchlist-btn ${isWatchlisted ? 'active' : ''}" 
                    data-movie-uid="${safeUid}"
                    onclick="window.MovieList.toggleWatchlistFromCard('${safeUid}', event)" 
                    title="Save to Watchlist" 
                    aria-label="Save to Watchlist">
              ${bookmarkSvg}
            </button>
          </div>
          <img class="card-poster-img" src="${sanitizeUrl(m.posterUrl)}" alt="${escapeQuotes(m.title)}" loading="lazy" onerror="this.src='icons/icon-512.png'">
          <div class="card-play-overlay">
            <div class="card-play-icon">
              ${playSvg}
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
              ${starSvg}
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
      <div class="movie-card show-all-card" data-category="${escapeQuotes(catKey)}" onclick="window.MovieList.setCategory(this.dataset.category)">
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
      // Display top 24 in horizontal slider to prevent DOM explosion and keep fluid 60fps
      const displayItems = items.slice(0, 24);
      const rowCardsHtml = displayItems.map((m) => renderMovieCardHtml(m)).join('');
      const showAllHtml = renderShowAllCardHtml(catConfig.key, catConfig.name, items.length);

      html += `
        <div class="category-row-block">
          <div class="row-header">
            <div class="row-title-wrap" data-category="${escapeQuotes(catConfig.key)}" onclick="window.MovieList.setCategory(this.dataset.category)">
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

  function filterAndRenderGrid(resetLimit = true) {
    if (resetLimit) {
      state.gridRenderLimit = GRID_PAGE_SIZE;
    }

    const categoryRowsContainer = document.getElementById('categoryRowsContainer');
    const catalogHeaderRow = document.getElementById('catalogHeaderRow');
    const moviesGrid = document.getElementById('moviesGrid');
    const catalogTitleText = document.getElementById('catalogSectionTitleText');
    const paginationWrapper = document.getElementById('gridPaginationWrapper');

    const isHomeView = state.activeCategory === 'All' && !state.searchQuery;

    if (isHomeView) {
      if (categoryRowsContainer) {
        categoryRowsContainer.style.display = 'flex';
        renderCategoryRows();
      }
      if (catalogHeaderRow) catalogHeaderRow.style.display = 'none';
      if (moviesGrid) moviesGrid.style.display = 'none';
      if (paginationWrapper) paginationWrapper.style.display = 'none';
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
      list = scoreSearchMatches(state.searchQuery, list);
      if (catalogTitleText) {
        catalogTitleText.textContent = `Search: "${state.searchQuery}"`;
      }
    }

    if (!state.searchQuery) {
      if (state.sortBy === 'rating') {
        list.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
      } else if (state.sortBy === 'year') {
        list.sort((a, b) => parseInt(b.year || 0, 10) - parseInt(a.year || 0, 10));
      } else if (state.sortBy === 'title') {
        list.sort((a, b) => a.title.localeCompare(b.title));
      }
    }

    state.filteredMovies = list;
    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('moviesGrid');
    const badge = document.getElementById('catalogCountBadge');
    const paginationWrapper = document.getElementById('gridPaginationWrapper');
    const paginationStatus = document.getElementById('gridPaginationStatus');
    const btnLoadMore = document.getElementById('btnLoadMore');
    if (!grid) return;

    const total = state.filteredMovies.length;
    if (badge) {
      badge.textContent = `${total.toLocaleString()} Titles`;
    }

    if (total === 0) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon">
            <i data-lucide="film" style="width:28px;height:28px;"></i>
          </div>
          <h3 style="font-size:18px;font-weight:700;">No movies found</h3>
          <p style="color:var(--text-secondary);font-size:13.5px;max-width:320px;">
            ${state.activeCategory === 'Watchlist' ? 'Your watchlist is empty. Save movies by clicking the bookmark icon!' : 'Try searching with fewer words or another keyword.'}
          </p>
        </div>
      `;
      if (paginationWrapper) paginationWrapper.style.display = 'none';
      if (window.lucide) window.lucide.createIcons({ root: grid });
      return;
    }

    const countToShow = Math.min(total, state.gridRenderLimit || GRID_PAGE_SIZE);
    const visibleMovies = state.filteredMovies.slice(0, countToShow);

    grid.innerHTML = visibleMovies.map((m) => renderMovieCardHtml(m)).join('');

    if (paginationWrapper) {
      if (total > countToShow) {
        paginationWrapper.style.display = 'flex';
        if (paginationStatus) {
          paginationStatus.textContent = `Showing ${countToShow} of ${total.toLocaleString()} Titles`;
        }
        if (btnLoadMore) {
          btnLoadMore.style.display = 'inline-flex';
        }
      } else {
        if (total > GRID_PAGE_SIZE && paginationStatus) {
          paginationWrapper.style.display = 'flex';
          paginationStatus.textContent = `All ${total.toLocaleString()} Titles Loaded`;
          if (btnLoadMore) btnLoadMore.style.display = 'none';
        } else {
          paginationWrapper.style.display = 'none';
        }
      }
    }
  }

  function loadMoreGrid() {
    if (!state.filteredMovies || state.gridRenderLimit >= state.filteredMovies.length) return;
    state.gridRenderLimit = (state.gridRenderLimit || GRID_PAGE_SIZE) + GRID_PAGE_SIZE;
    renderGrid();
  }

  // Movie Details Full Page Component
  function openDetails(id, pushHistory = true) {
    const movie = findMovieById(id);
    if (!movie) return;

    state.activeMovie = movie;
    const modal = document.getElementById('detailsModal');
    if (!modal) return;

    if (!document.body.classList.contains('details-open')) {
      state.lastBrowseScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    }

    // Sticky Top Bar Header
    const headerTitle = document.getElementById('pageHeaderTitle');
    if (headerTitle) headerTitle.textContent = movie.title;

    const qualityBadge = document.getElementById('posterQualityBadge');
    if (qualityBadge) qualityBadge.textContent = movie.quality || 'HD';

    // Cinematic Hero & Ambient Backdrop Elements
    document.getElementById('modalBackdropImg').src = sanitizeUrl(movie.posterUrl);
    const ambientBg = document.getElementById('modalAmbientBg');
    if (ambientBg) ambientBg.src = sanitizeUrl(movie.posterUrl);
    document.getElementById('modalPosterImg').src = sanitizeUrl(movie.posterUrl);
    document.getElementById('modalMovieTitle').textContent = movie.title;
    document.getElementById('modalQualityTag').textContent = movie.quality;
    document.getElementById('modalRatingTag').textContent = `${movie.rating} Rating`;
    document.getElementById('modalCategoryTag').textContent = movie.category;
    document.getElementById('modalYearStat').textContent = movie.year || '2025';
    document.getElementById('modalSizeStat').textContent = movie.size || 'HD Stream';
    document.getElementById('modalDateStat').textContent = movie.date ? movie.date.split(' ')[0] : 'Latest';

    const modalPlayBtnText = document.getElementById('modalPlayBtnText');
    if (modalPlayBtnText) {
      modalPlayBtnText.textContent = 'Play Movie';
    }

    const playBtn = document.getElementById('modalPlayBtn');
    if (playBtn) {
      playBtn.onclick = () => {
        closeDetails(false);
        playMovie(movie.videoUrl, movie.title);
      };
    }

    const trailerBtn = document.getElementById('modalTrailerBtn');
    if (trailerBtn) {
      trailerBtn.onclick = () => {
        openTrailer(movie.title);
      };
    }

    // Direct Download Button
    const downloadBtn = document.getElementById('modalDownloadBtn');
    if (downloadBtn) {
      downloadBtn.href = sanitizeUrl(movie.videoUrl);
      downloadBtn.setAttribute('download', (movie.title || 'media') + '.mp4');
      const dlText = document.getElementById('modalDownloadBtnText');
      if (dlText) dlText.textContent = isTvSeries(movie) ? 'Download' : 'Download Movie';
    }

    updateModalWatchlistState();

    // Reset Synopsis & Technical Info to base scraped state
    const synText = document.getElementById('detailsSynopsisText');
    const synMore = document.getElementById('btnSynopsisMore');
    if (synText) {
      synText.textContent = 'Stream and download high-speed 1080p HD media with zero buffering on BDIX networks.';
      synText.classList.remove('expanded');
    }
    if (synMore) {
      synMore.style.display = 'none';
      synMore.textContent = 'More';
    }

    const castSection = document.getElementById('detailsCastSection');
    const castGrid = document.getElementById('detailsCastGrid');
    const dirHeadline = document.getElementById('detailsDirectorHeadline');
    if (castSection) castSection.style.display = 'none';
    if (castGrid) castGrid.innerHTML = '';
    if (dirHeadline) dirHeadline.textContent = 'Leading performers';

    const setTech = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '—';
    };
    setTech('techReleaseVal', movie.date ? movie.date.split(' ')[0] : (movie.year || '2025'));
    setTech('techDirectorVal', '—');
    setTech('techQualityVal', movie.quality || '1080p Full HD');
    setTech('techAudioVal', 'Dual Audio / Original');
    setTech('techSizeVal', movie.size || 'HD Stream');

    const wWriter = document.getElementById('techWriterItem');
    if (wWriter) wWriter.style.display = 'none';
    const wBox = document.getElementById('techBoxOfficeItem');
    if (wBox) wBox.style.display = 'none';
    const wCountry = document.getElementById('techCountryItem');
    if (wCountry) wCountry.style.display = 'none';
    const wAwards = document.getElementById('techAwardsItem');
    if (wAwards) wAwards.style.display = 'none';

    // Configure External Player Buttons inside details
    const btnVlc = document.getElementById('extBtnVlc');
    if (btnVlc) btnVlc.onclick = () => launchVLC(movie.videoUrl, movie.title);

    const btnMx = document.getElementById('extBtnMx');
    if (btnMx) btnMx.onclick = () => launchMX(movie.videoUrl, movie.title);

    const btnPot = document.getElementById('extBtnPot');
    if (btnPot) btnPot.onclick = () => launchPotPlayer(movie.videoUrl, movie.title);

    const btnCopy = document.getElementById('extBtnCopy');
    if (btnCopy) btnCopy.onclick = () => copyStreamLink(movie.videoUrl);

    // Hydrate rich metadata (Plot, Cast, Director, Box Office, Awards)
    loadAndApplyOnlineMetadata(movie);

    // Check if TV Series / Episodic Media
    if (isTvSeries(movie)) {
      loadTvSeriesSeasons(movie.videoUrl, movie.rawTitle || movie.title);
    } else {
      const epSection = document.getElementById('seriesEpisodesSection');
      if (epSection) epSection.style.display = 'none';
      state.currentTvEntry = null;
      state.currentSeasonEpisodes = [];
      state.currentPlayingEpisodeIdx = -1;
    }

    // Display Full Page View
    modal.style.display = 'block';
    modal.scrollTop = 0;
    document.body.classList.add('details-open');
    requestAnimationFrame(() => {
      modal.classList.add('active');
    });

    // History state navigation for native back button
    if (pushHistory) {
      const targetHash = `#media=${encodeURIComponent(movie.id)}`;
      if (window.location.hash !== targetHash) {
        history.pushState({ view: 'details', id: movie.id }, '', targetHash);
      }
    }

    if (window.lucide) window.lucide.createIcons({ root: modal });
  }

  function closeDetails(shouldPopHistory = true) {
    const modal = document.getElementById('detailsModal');
    if (!modal) return;
    const isVisible = modal.classList.contains('active') || modal.style.display === 'block';
    if (!isVisible) return;

    modal.classList.remove('active');
    setTimeout(() => {
      if (!modal.classList.contains('active')) {
        modal.style.display = 'none';
      }
    }, 220);
    document.body.classList.remove('details-open');

    if (typeof state.lastBrowseScrollY === 'number') {
      window.scrollTo({ top: state.lastBrowseScrollY, behavior: 'instant' });
    }

    const epSection = document.getElementById('seriesEpisodesSection');
    if (epSection) epSection.style.display = 'none';
    state.activeMovie = null;
    state.currentTvEntry = null;

    if (shouldPopHistory) {
      if (window.location.hash.startsWith('#media=')) {
        if (window.history.state && window.history.state.view === 'details') {
          window.history.back();
        } else {
          try {
            history.replaceState('', document.title, window.location.pathname + window.location.search);
          } catch (e) {
            window.location.hash = '';
          }
        }
      }
    }
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
      watchBtn.onclick = (e) => {
        toggleWatchlist(state.activeMovie.videoUrl, state.activeMovie.title, e);
      };
      if (window.lucide) window.lucide.createIcons({ root: watchBtn });
    }

    const pageNavBtn = document.getElementById('pageNavWatchlistBtn');
    if (pageNavBtn) {
      pageNavBtn.innerHTML = `<i data-lucide="bookmark" style="width:18px;height:18px;${isWatchlisted ? 'fill:currentColor;color:var(--primary);' : ''}"></i>`;
      if (window.lucide) window.lucide.createIcons({ root: pageNavBtn });
    }
  }

  function toggleWatchlistFromPage(event) {
    if (!state.activeMovie) return;
    toggleWatchlist(state.activeMovie.videoUrl, state.activeMovie.title, event);
  }

  function shareMedia() {
    if (!state.activeMovie) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#media=${encodeURIComponent(state.activeMovie.id)}`;
    const shareData = {
      title: state.activeMovie.title,
      text: `Watch ${state.activeMovie.title} on CineBox`,
      url: shareUrl
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Media link copied to clipboard!');
      }).catch(() => {
        showToast('Link: ' + shareUrl);
      });
    } else {
      showToast('Link: ' + shareUrl);
    }
  }

  function checkInitialHash() {
    if (window.location.hash.startsWith('#media=')) {
      const id = decodeURIComponent(window.location.hash.replace('#media=', ''));
      if (id) {
        openDetails(id, false);
      }
    }
  }

  // Synopsis expand/collapse toggle
  function toggleSynopsis() {
    const synText = document.getElementById('detailsSynopsisText');
    const synMore = document.getElementById('btnSynopsisMore');
    if (!synText) return;
    const isExpanded = synText.classList.toggle('expanded');
    if (synMore) {
      synMore.textContent = isExpanded ? 'Less' : 'More';
    }
  }

  // Media Info Title Cleaner
  function parseCleanMediaInfo(rawTitle) {
    if (!rawTitle) return { cleanName: '', year: '', isSeries: false };
    const title = rawTitle.trim().replace(/^\d+\.\s*/, '');
    const isSeries = /TV\s*(Series|Mini\s*Series)?/i.test(title);
    const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : '';

    const cleanName = title
      .replace(/\(TV\s*(Series|Mini\s*Series)?[^)]*\)/gi, '')
      .replace(/\((19\d{2}|20\d{2})[^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(
        /\b(1080p|720p|480p|576p|2160p|4K|WEB-?DL|BluRay|HD|HDRip|DVDRip|Dual\s*Audio|Multi\s*Audio|Hindi\s*Dubbed|UNCUT|REM|HEVC|x265|x264|AAC|ESub|DDR|AMZN|DSNP|NF)\b/gi,
        ''
      )
      .replace(/[._]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { cleanName, year, isSeries };
  }

  const OMDB_API_KEYS = ['trilogy', 'b7da8d63', 'd63a8a37', 'a8c17b8f'];
  let preloadedMetaCache = null;

  async function getPreloadedMetaCache() {
    if (preloadedMetaCache) return preloadedMetaCache;
    try {
      const res = await fetch('./metadata_cache.json?v=' + Date.now());
      if (res.ok) {
        preloadedMetaCache = await res.json();
        return preloadedMetaCache;
      }
    } catch (e) {}
    return {};
  }

  async function fetchOnlineMetadata(rawTitle, fallbackCategory = '') {
    const { cleanName, year, isSeries } = parseCleanMediaInfo(rawTitle);
    if (!cleanName) return null;

    // 1. Check preloaded static dictionary (0ms instantaneous lookup)
    const preloaded = await getPreloadedMetaCache();
    if (preloaded && preloaded[cleanName.toLowerCase()]) {
      return preloaded[cleanName.toLowerCase()];
    }

    const cacheKey = `movielist_meta_${cleanName.toLowerCase()}_${year || ''}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed._cachedAt < 1000 * 60 * 60 * 24 * 14) {
          return parsed.data;
        }
      }
    } catch (e) {}

    let meta = null;

    // 2. Try OMDb API with rotating failover keys
    for (const key of OMDB_API_KEYS) {
      try {
        const url = `https://www.omdbapi.com/?t=${encodeURIComponent(cleanName)}${year ? '&y=' + year : ''}&plot=full&apikey=${key}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.Response === 'True') {
            const ratings = data.Ratings || [];
            const imdbObj = ratings.find((r) => r.Source && (r.Source.includes('Internet Movie') || r.Source.includes('IMDb')));

            meta = {
              title: data.Title,
              year: data.Year,
              releaseDate: data.Released && data.Released !== 'N/A' ? data.Released : null,
              runtime: data.Runtime && data.Runtime !== 'N/A' ? data.Runtime : null,
              rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : null,
              genres: data.Genre && data.Genre !== 'N/A' ? data.Genre.split(',').map((g) => g.trim()) : [],
              director: data.Director && data.Director !== 'N/A' ? data.Director : null,
              writer: data.Writer && data.Writer !== 'N/A' ? data.Writer : null,
              actors: data.Actors && data.Actors !== 'N/A' ? data.Actors.split(',').map((a) => a.trim()) : [],
              synopsis: data.Plot && data.Plot !== 'N/A' ? data.Plot : null,
              awards: data.Awards && data.Awards !== 'N/A' ? data.Awards : null,
              boxOffice: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
              country: data.Country && data.Country !== 'N/A' ? data.Country : null,
              language: data.Language && data.Language !== 'N/A' ? data.Language : null,
              imdbRating:
                data.imdbRating && data.imdbRating !== 'N/A'
                  ? data.imdbRating
                  : imdbObj
                    ? imdbObj.Value.split('/')[0]
                    : null,
              poster: data.Poster && data.Poster !== 'N/A' ? data.Poster : null
            };
            break;
          }
        }
      } catch (e) {}
    }

    // 3. Fallback to TVMaze if TV Series
    if (
      !meta &&
      (isSeries ||
        fallbackCategory.includes('TV') ||
        fallbackCategory.includes('Drama') ||
        fallbackCategory.includes('Series'))
    ) {
      try {
        const res = await fetch(
          `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanName)}&embed=cast`
        );
        if (res.ok) {
          const data = await res.json();
          const summary = (data.summary || '').replace(/<[^>]*>/g, '').trim();
          const embeddedCast =
            data._embedded && Array.isArray(data._embedded.cast)
              ? data._embedded.cast
                  .slice(0, 10)
                  .map((c) => ({
                    name: c.person ? c.person.name : '',
                    character: c.character ? c.character.name : 'Cast',
                    image: c.person && c.person.image ? c.person.image.medium || c.person.image.original : null
                  }))
                  .filter((c) => c.name)
              : [];

          meta = {
            title: data.name,
            year: data.premiered ? data.premiered.slice(0, 4) : year,
            releaseDate: data.premiered || null,
            imdbRating: data.rating && data.rating.average ? data.rating.average.toString() : null,
            runtime: data.averageRuntime ? `${data.averageRuntime} min` : null,
            genres: data.genres || [],
            actors: embeddedCast,
            synopsis: summary,
            poster: data.image ? data.image.original || data.image.medium : null,
            backdrop: data.image ? data.image.original : null
          };
        }
      } catch (e) {}
    }

    // 4. Fallback to Wikipedia REST API
    if (!meta) {
      try {
        const wikiRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName.replace(/\s+/g, '_'))}`
        );
        if (wikiRes.ok) {
          const wiki = await wikiRes.json();
          if (wiki.extract && !wiki.title.toLowerCase().includes('disambiguation')) {
            meta = {
              title: wiki.title,
              year: year,
              synopsis: wiki.extract,
              backdrop: wiki.originalimage ? wiki.originalimage.source : wiki.thumbnail ? wiki.thumbnail.source : null
            };
          }
        }
      } catch (e) {}
    }

    if (meta) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ _cachedAt: Date.now(), data: meta }));
      } catch (e) {}
    }

    return meta;
  }

  async function getActorPortraitPhoto(actorName) {
    if (!actorName) return null;
    const cacheKey = `movielist_actor_${actorName.toLowerCase().replace(/\s+/g, '_')}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;
    } catch (e) {}
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(actorName.replace(/\s+/g, '_'))}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.thumbnail && data.thumbnail.source) {
          try {
            localStorage.setItem(cacheKey, data.thumbnail.source);
          } catch (e) {}
          return data.thumbnail.source;
        }
      }
    } catch (e) {}
    return null;
  }

  async function loadAndApplyOnlineMetadata(movie) {
    if (!movie || !movie.title) return;
    const currentId = movie.id;
    try {
      const meta = await fetchOnlineMetadata(movie.rawTitle || movie.title, movie.category || '');
      if (!meta || !state.activeMovie || state.activeMovie.id !== currentId) return;

      // 1. Plot Synopsis Description
      if (meta.synopsis) {
        const synEl = document.getElementById('detailsSynopsisText');
        const moreBtn = document.getElementById('btnSynopsisMore');
        if (synEl) {
          synEl.textContent = meta.synopsis;
          if (moreBtn) {
            moreBtn.style.display = meta.synopsis.length > 160 ? 'inline-flex' : 'none';
          }
        }
      }

      // 2. IMDb Rating
      if (meta.imdbRating && meta.imdbRating !== 'N/A') {
        const ratingTag = document.getElementById('modalRatingTag');
        if (ratingTag) {
          ratingTag.textContent = `${meta.imdbRating} Rating`;
        }
      }

      // 3. Technical Specs
      if (meta.releaseDate) {
        const relVal = document.getElementById('techReleaseVal');
        if (relVal) relVal.textContent = meta.releaseDate;
      }

      if (meta.director) {
        const dirVal = document.getElementById('techDirectorVal');
        if (dirVal) dirVal.textContent = meta.director;
        const dirHeadline = document.getElementById('detailsDirectorHeadline');
        if (dirHeadline) dirHeadline.textContent = `Directed by ${meta.director}`;
      }

      if (meta.writer) {
        const wItem = document.getElementById('techWriterItem');
        const wVal = document.getElementById('techWriterVal');
        if (wItem && wVal) {
          wVal.textContent = meta.writer;
          wItem.style.display = 'flex';
        }
      }

      if (meta.boxOffice) {
        const bItem = document.getElementById('techBoxOfficeItem');
        const bVal = document.getElementById('techBoxOfficeVal');
        if (bItem && bVal) {
          bVal.textContent = `${meta.boxOffice} (Worldwide)`;
          bItem.style.display = 'flex';
        }
      }

      if (meta.country || meta.language) {
        const cItem = document.getElementById('techCountryItem');
        const cVal = document.getElementById('techCountryVal');
        if (cItem && cVal) {
          cVal.textContent = [meta.country, meta.language].filter(Boolean).join(' • ');
          cItem.style.display = 'flex';
        }
      }

      if (meta.awards) {
        const aItem = document.getElementById('techAwardsItem');
        const aVal = document.getElementById('techAwardsVal');
        if (aItem && aVal) {
          aVal.textContent = meta.awards;
          aItem.style.display = 'flex';
        }
      }

      // 4. Top Cast & Characters Section
      let rawActors = meta.actors;
      let actorsList = [];
      if (Array.isArray(rawActors)) {
        actorsList = rawActors.map((a) => (typeof a === 'string' ? { name: a, character: 'Cast', image: null } : a));
      } else if (typeof rawActors === 'string') {
        actorsList = rawActors
          .split(',')
          .map((a) => ({ name: a.trim(), character: 'Cast', image: null }))
          .filter((a) => a.name);
      }

      if (actorsList.length > 0) {
        const castSection = document.getElementById('detailsCastSection');
        const castGrid = document.getElementById('detailsCastGrid');

        if (castSection && castGrid) {
          castGrid.innerHTML = actorsList
            .map((actor, idx) => {
              const initials = actor.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const roleLabel = actor.character && actor.character !== 'Cast' ? actor.character : 'Cast Member';

              return `
                <a class="cast-card" href="https://www.google.com/search?q=${encodeURIComponent(actor.name + ' actor')}" target="_blank" rel="noopener" title="Search ${escapeQuotes(actor.name)}">
                  <div class="cast-avatar" id="castAvatar-${idx}">
                    ${actor.image ? `<img src="${sanitizeUrl(actor.image)}" alt="${escapeQuotes(actor.name)}" />` : initials}
                  </div>
                  <div class="cast-info">
                    <span class="cast-name">${escapeHtml(actor.name)}</span>
                    <span class="cast-role">${escapeHtml(roleLabel)}</span>
                  </div>
                </a>
              `;
            })
            .join('');

          castSection.style.display = 'block';

          // Asynchronously hydrate actor photos from Wikipedia if missing
          actorsList.forEach((actor, idx) => {
            if (!actor.image) {
              getActorPortraitPhoto(actor.name)
                .then((photoUrl) => {
                  if (photoUrl && state.activeMovie && state.activeMovie.id === currentId) {
                    const avatarEl = document.getElementById(`castAvatar-${idx}`);
                    if (avatarEl) {
                      avatarEl.innerHTML = `<img src="${sanitizeUrl(photoUrl)}" alt="${escapeQuotes(actor.name)}" />`;
                    }
                  }
                })
                .catch(() => {});
            }
          });
        }
      }

      // 5. Cinematic Backdrop upgrade if available
      if (meta.backdrop) {
        const bgImg = document.getElementById('modalBackdropImg');
        if (bgImg) {
          bgImg.src = sanitizeUrl(meta.backdrop);
        }
        const ambBg = document.getElementById('modalAmbientBg');
        if (ambBg) {
          ambBg.src = sanitizeUrl(meta.backdrop);
        }
      }
    } catch (e) {
      console.warn('Metadata hydration:', e);
    }
  }



  // TV Series Seasons & Episodes Engine
  function isTvSeries(m) {
    if (!m) return false;
    const cat = (m.category || '').toLowerCase();
    const tag = (m.tag || '').toLowerCase();
    const title = (m.title || m.rawTitle || '').toLowerCase();
    const url = (m.videoUrl || '').toLowerCase();

    return (
      cat.includes('tv') ||
      cat.includes('series') ||
      cat.includes('k-drama') ||
      cat.includes('drama') ||
      cat.includes('anime') ||
      cat.includes('animation') ||
      tag.includes('tv') ||
      tag.includes('series') ||
      tag.includes('k-drama') ||
      title.includes('(tv series') ||
      title.includes('(tv mini series') ||
      title.includes('season') ||
      title.includes('episode') ||
      url.endsWith('/')
    );
  }

  function cleanEpisodeTitle(raw) {
    if (!raw) return 'Episode';
    let text = String(raw).replace(/\.(mkv|mp4|avi|webm)$/i, '');
    text = text.replace(/[._]/g, ' ');
    const junkPatterns = [
      /\b\d{3,4}p\b/gi,
      /\b(bluray|bdrip|brrip|web-dl|webrip|web|hdrip|dvdrip|hdtv|hdtc|camrip)\b/gi,
      /\b(x264|x265|hevc|h264|10bit|8bit|aac|ac3|dd5\.1|dts)\b/gi,
      /\b(dual audio|multi audio|hindi|english|esub|msubs?)\b/gi,
      /\[.*?\]/g,
      /-[a-zA-Z0-9]+$/
    ];
    junkPatterns.forEach((p) => {
      text = text.replace(p, ' ');
    });
    text = text.replace(/\s+/g, ' ').trim();
    return text || raw;
  }

  async function loadTvSeriesSeasons(seriesUrl, seriesTitle) {
    const section = document.getElementById('seriesEpisodesSection');
    const tabsRow = document.getElementById('seasonTabsRow');
    const epContainer = document.getElementById('episodeListContainer');
    const countBadge = document.getElementById('seasonCountBadge');

    if (!section) return;
    section.style.display = 'block';
    if (countBadge) countBadge.textContent = 'Loading seasons & episodes...';
    if (tabsRow) tabsRow.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">Loading season directory...</div>';
    if (epContainer) epContainer.innerHTML = '';

    // Ensure tvCatalog is loaded
    if (!state.tvCatalog) {
      try {
        const res = await fetch('./tv_index.json?v=' + Date.now());
        if (res.ok) {
          state.tvCatalog = await res.json();
        }
      } catch (e) {
        console.warn('Could not load tv_index.json:', e);
      }
    }

    const tvCatalog = state.tvCatalog || {};

    let matchedData = null;

    // 1. Direct title lookup
    if (tvCatalog[seriesTitle]) {
      matchedData = tvCatalog[seriesTitle];
    }

    // 2. Directory URL lookup
    if (!matchedData && seriesUrl) {
      const normTargetUrl = decodeURI(seriesUrl).replace(/\/+$/, '').toLowerCase();
      for (const [k, v] of Object.entries(tvCatalog)) {
        if (v && v[0]) {
          const normEntryUrl = decodeURI(v[0]).replace(/\/+$/, '').toLowerCase();
          if (normEntryUrl === normTargetUrl || normTargetUrl.startsWith(normEntryUrl) || normEntryUrl.startsWith(normTargetUrl)) {
            matchedData = v;
            break;
          }
        }
      }
    }

    // 3. Normalized alphanumeric title lookup (e.g. Game of Thrones)
    if (!matchedData && seriesTitle) {
      const normTarget = seriesTitle.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      for (const [k, v] of Object.entries(tvCatalog)) {
        const normK = k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (
          normK === normTarget ||
          (normK.length > 5 && normTarget.includes(normK)) ||
          (normTarget.length > 5 && normK.includes(normTarget))
        ) {
          matchedData = v;
          break;
        }
      }
    }

    if (matchedData) {
      state.currentTvEntry = matchedData;
      renderIndexedTvData(matchedData, seriesTitle);
      return;
    }

    // Fallback: If not indexed, direct stream option
    if (countBadge) countBadge.textContent = 'Single Stream Media';
    if (tabsRow) tabsRow.innerHTML = '';
    if (epContainer) {
      epContainer.innerHTML = `
        <div style="font-size:12px;color:var(--text-muted);padding:12px 4px;">
          Direct stream is available. Click Play above to begin playback.
        </div>
      `;
    }
  }

  function renderIndexedTvData(tvData, seriesTitle) {
    const tabsRow = document.getElementById('seasonTabsRow');
    const epContainer = document.getElementById('episodeListContainer');
    const countBadge = document.getElementById('seasonCountBadge');

    const folderUrl = tvData[0] || '';
    const seasons = tvData[1] || [];
    const specials = tvData[2] || [];

    let totalEpisodes = 0;
    seasons.forEach((s) => {
      if (Array.isArray(s[2])) totalEpisodes += s[2].length;
    });

    const badgeStr = `${seasons.length} Seasons • ${totalEpisodes} Episodes ${specials.length > 0 ? `+ ${specials.length} Specials` : ''}`;
    if (countBadge) countBadge.textContent = badgeStr;

    if (seasons.length > 0) {
      let tabsHtml = seasons
        .map((s, idx) => {
          const sName = s[0];
          return `
            <button class="season-pill-btn ${idx === 0 ? 'active' : ''}" data-season-idx="${idx}" data-season-name="${escapeQuotes(sName)}" onclick="window.MovieList.selectIndexedSeason(${idx}, this.dataset.seasonName)">
              ${escapeHtml(sName)}
            </button>
          `;
        })
        .join('');

      if (specials.length > 0) {
        tabsHtml += `
          <button class="season-pill-btn specials-pill" onclick="window.MovieList.selectSpecialsTab()" style="display:inline-flex;align-items:center;gap:5px;">
            <i data-lucide="star" style="width:12px;height:12px;fill:currentColor;"></i>
            <span>Specials (${specials.length})</span>
          </button>
        `;
      }

      if (tabsRow) tabsRow.innerHTML = tabsHtml;
      if (window.lucide) window.lucide.createIcons({ root: tabsRow });

      state.currentSelectedSeasonIdx = 0;
      loadIndexedSeasonEpisodes(0, seasons[0][0]);
    } else {
      if (countBadge) countBadge.textContent = 'Directory Media';
      if (epContainer) {
        epContainer.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:10px 4px;">Direct media stream available.</div>';
      }
    }
  }

  function selectIndexedSeason(seasonIdx, seasonName) {
    document.querySelectorAll('.season-pill-btn').forEach((b, idx) => {
      b.classList.toggle('active', idx === seasonIdx);
    });

    loadIndexedSeasonEpisodes(seasonIdx, seasonName);
  }

  function selectSpecialsTab() {
    document.querySelectorAll('.season-pill-btn').forEach((b) => b.classList.remove('active'));
    const specialsBtn = document.querySelector('.season-pill-btn.specials-pill');
    if (specialsBtn) specialsBtn.classList.add('active');

    if (!state.currentTvEntry || !state.currentTvEntry[2]) return;
    const folderUrl = state.currentTvEntry[0] || '';
    const specials = state.currentTvEntry[2] || [];

    state.currentSeasonName = 'Specials';
    state.currentSelectedSeasonIdx = -1;
    state.currentPlayingEpisodeIdx = -1;

    const episodes = specials.map((name) => {
      const cleanUrl = folderUrl.endsWith('/') ? folderUrl + encodeURI(name) : folderUrl + '/' + encodeURI(name);
      return { name, url: cleanUrl };
    });

    state.currentSeasonEpisodes = episodes;
    renderEpisodeListHtml(episodes);
  }

  function loadIndexedSeasonEpisodes(seasonIdx, seasonName) {
    if (!state.currentTvEntry || !state.currentTvEntry[1] || !state.currentTvEntry[1][seasonIdx]) return;

    state.currentSeasonName = seasonName;
    state.currentSelectedSeasonIdx = seasonIdx;
    state.episodeFilterQuery = '';

    const filterInput = document.getElementById('episodeFilterInput');
    if (filterInput) filterInput.value = '';

    const seasonData = state.currentTvEntry[1][seasonIdx];
    const sUrl = seasonData[1];
    const epNames = seasonData[2] || [];

    const episodes = epNames.map((name) => {
      const cleanUrl = sUrl.endsWith('/') ? sUrl + encodeURI(name) : sUrl + '/' + encodeURI(name);
      return {
        name,
        url: cleanUrl
      };
    });

    state.currentSeasonEpisodes = episodes;
    renderEpisodeListHtml(episodes);
  }

  function renderEpisodeListHtml(episodes) {
    const epContainer = document.getElementById('episodeListContainer');
    const filterBox = document.getElementById('episodeFilterBox');
    if (!epContainer) return;

    if (!episodes || episodes.length === 0) {
      epContainer.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:14px;text-align:center;">No episodes found in this season.</div>';
      return;
    }

    if (filterBox) {
      filterBox.style.display = episodes.length > 6 ? 'flex' : 'none';
    }

    const filtered = state.episodeFilterQuery
      ? episodes.filter((e) => e.name.toLowerCase().includes(state.episodeFilterQuery))
      : episodes;

    epContainer.innerHTML = filtered
      .map((ep) => {
        const originalIdx = episodes.indexOf(ep);
        const isPlaying = originalIdx === state.currentPlayingEpisodeIdx;
        const cleanName = cleanEpisodeTitle(ep.name);

        return `
          <div class="ep-card ${isPlaying ? 'playing' : ''}" onclick="window.MovieList.playSpecificEpisode(${originalIdx})">
            <div class="ep-left-wrap">
              <div class="ep-index-badge">
                ${isPlaying ? '<i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i>' : `E${(originalIdx + 1) < 10 ? '0' : ''}${originalIdx + 1}`}
              </div>
              <div class="ep-info-wrap">
                <span class="ep-title-text" title="${escapeQuotes(ep.name)}">${escapeHtml(cleanName)}</span>
                <div class="ep-meta-sub">
                  <span style="color:${isPlaying ? 'var(--primary)' : 'var(--text-muted)'};font-weight:700;">${isPlaying ? 'NOW PLAYING' : escapeHtml(state.currentSeasonName)}</span>
                  <span>•</span>
                  <span>1080p HD</span>
                </div>
              </div>
            </div>
            <div class="ep-action-btns" onclick="event.stopPropagation();">
              <button class="ep-icon-btn ep-btn-stream" onclick="window.MovieList.playSpecificEpisode(${originalIdx})" title="Stream Episode">
                <i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i>
              </button>
              <button class="ep-icon-btn ep-btn-ext" onclick="window.MovieList.openExternalPlayerFromEpisode(${originalIdx}, event)" title="Play in VLC / MX Player">
                <i data-lucide="tv" style="width:14px;height:14px;"></i>
              </button>
              <a class="ep-icon-btn ep-btn-download" href="${sanitizeUrl(ep.url)}" download title="Direct Download" target="_blank" rel="noopener">
                <i data-lucide="download" style="width:14px;height:14px;"></i>
              </a>
            </div>
          </div>
        `;
      })
      .join('');

    if (window.lucide) window.lucide.createIcons({ root: epContainer });
  }

  function openExternalPlayerFromEpisode(epIdx, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const ep = state.currentSeasonEpisodes && state.currentSeasonEpisodes[epIdx];
    if (!ep) return;
    const cleanName = cleanEpisodeTitle(ep.name);
    const title = (state.currentSeasonName ? state.currentSeasonName + ' - ' : '') + cleanName;
    openExternalPlayerModal(ep.url, title, event);
  }

  function filterEpisodes(query) {
    state.episodeFilterQuery = (query || '').trim().toLowerCase();
    const clearBtn = document.getElementById('btnEpFilterClear');
    if (clearBtn) clearBtn.style.display = state.episodeFilterQuery ? 'flex' : 'none';
    renderEpisodeListHtml(state.currentSeasonEpisodes);
  }

  function clearEpisodeFilter() {
    state.episodeFilterQuery = '';
    const input = document.getElementById('episodeFilterInput');
    const clearBtn = document.getElementById('btnEpFilterClear');
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    renderEpisodeListHtml(state.currentSeasonEpisodes);
  }

  function playSpecificEpisode(idx) {
    if (!state.currentSeasonEpisodes || !state.currentSeasonEpisodes[idx]) return;
    state.currentPlayingEpisodeIdx = idx;
    const ep = state.currentSeasonEpisodes[idx];
    const seriesTitle = (state.activeMovie && state.activeMovie.title) || 'TV Series';
    const cleanEp = cleanEpisodeTitle(ep.name);
    const fullTitle = `${seriesTitle} • ${state.currentSeasonName || 'Season'} Episode ${idx + 1}: ${cleanEp}`;
    closeDetails();
    playMovie(ep.url, fullTitle);

    const nav = document.getElementById('playerSeriesNav');
    if (nav) nav.style.display = 'inline-flex';

    updatePlayerEpisodeDrawer();
    renderEpisodeListHtml(state.currentSeasonEpisodes);
  }

  function playNextEpisode() {
    if (state.currentSeasonEpisodes && state.currentPlayingEpisodeIdx + 1 < state.currentSeasonEpisodes.length) {
      showToast('Playing next episode...');
      playSpecificEpisode(state.currentPlayingEpisodeIdx + 1);
    } else {
      showToast('End of this season');
    }
  }

  function playPrevEpisode() {
    if (state.currentSeasonEpisodes && state.currentPlayingEpisodeIdx > 0) {
      showToast('Playing previous episode...');
      playSpecificEpisode(state.currentPlayingEpisodeIdx - 1);
    } else {
      showToast('First episode of this season');
    }
  }

  function togglePlayerEpDrawer(forceState) {
    const drawer = document.getElementById('playerEpDrawer');
    if (!drawer) return;
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !drawer.classList.contains('active');
    drawer.classList.toggle('active', shouldOpen);
    if (shouldOpen) {
      updatePlayerEpisodeDrawer();
    }
  }

  function updatePlayerEpisodeDrawer() {
    const titleEl = document.getElementById('playerDrawerSeasonTitle');
    const listEl = document.getElementById('playerDrawerEpList');
    if (!listEl) return;

    if (titleEl) {
      titleEl.textContent = `${state.currentSeasonName || 'Season'} Episodes`;
    }

    if (!state.currentSeasonEpisodes || !state.currentSeasonEpisodes.length) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:10px;">No episodes loaded</div>';
      return;
    }

    listEl.innerHTML = state.currentSeasonEpisodes
      .map((ep, idx) => {
        const isPlaying = idx === state.currentPlayingEpisodeIdx;
        const cleanName = cleanEpisodeTitle(ep.name);
        return `
          <div class="player-drawer-ep-item ${isPlaying ? 'playing' : ''}" onclick="window.MovieList.playSpecificEpisode(${idx})">
            <span class="item-ep-badge">${isPlaying ? '▶' : `E${(idx + 1) < 10 ? '0' : ''}${idx + 1}`}</span>
            <span class="item-ep-title" title="${escapeQuotes(ep.name)}">${escapeHtml(cleanName)}</span>
          </div>
        `;
      })
      .join('');
  }

  function downloadSeasonM3u() {
    if (!state.currentSeasonEpisodes || state.currentSeasonEpisodes.length === 0) {
      showToast('No episodes in this season');
      return;
    }
    const seriesTitle = (state.activeMovie && state.activeMovie.title) || 'Series';
    let m3u = `#EXTM3U\n#PLAYLIST:${seriesTitle} - ${state.currentSeasonName}\n\n`;
    state.currentSeasonEpisodes.forEach((ep) => {
      m3u += `#EXTINF:-1,${seriesTitle} - ${ep.name}\n${ep.url}\n\n`;
    });

    const cleanFileName = `${seriesTitle}_${state.currentSeasonName || 'Season'}`.replace(/[/\\?%*:|"<>]/g, '_');
    const blob = new Blob([m3u], { type: 'application/x-mpegurl' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${cleanFileName}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    showToast(`Exported ${state.currentSeasonName} Playlist (.m3u)`);
  }

  function exportSeasonLinksTxt() {
    if (!state.currentSeasonEpisodes || state.currentSeasonEpisodes.length === 0) {
      showToast('No episodes in this season');
      return;
    }
    const seriesTitle = (state.activeMovie && state.activeMovie.title) || 'Series';
    let text = `# CineBox Links Export: ${seriesTitle} - ${state.currentSeasonName}\n# Direct download URLs for IDM / 1DM / JDownloader\n\n`;
    state.currentSeasonEpisodes.forEach((ep) => {
      text += `${ep.url}\n`;
    });

    const cleanFileName = `${seriesTitle}_${state.currentSeasonName || 'Season'}_links`.replace(/[/\\?%*:|"<>]/g, '_');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${cleanFileName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    showToast(`Exported ${state.currentSeasonName} links (.txt)`);
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
    let targetUrl = url;
    if (!targetUrl) {
      const video = document.getElementById('cinemaVideo');
      targetUrl = (video && video.src) || (state.activeMovie && state.activeMovie.videoUrl) || state.extSelectedUrl || '';
    }
    if (!targetUrl) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(targetUrl).then(() => {
        showToast('Direct stream link copied to clipboard!');
      }).catch(() => {
        showToast('Stream link: ' + targetUrl);
      });
    } else {
      showToast('Stream link: ' + targetUrl);
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

  function onCardExtClick(targetOrUrl, titleOrEvent, maybeEvent) {
    let url = '';
    let title = '';
    let event = null;

    if (titleOrEvent && typeof titleOrEvent === 'object' && titleOrEvent.preventDefault) {
      event = titleOrEvent;
      const movie = findMovieById(targetOrUrl);
      url = movie ? movie.videoUrl : targetOrUrl;
      title = movie ? movie.title : '';
    } else {
      url = targetOrUrl;
      title = typeof titleOrEvent === 'string' ? titleOrEvent : '';
      event = maybeEvent;
    }

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!url || !url.startsWith('http')) {
      const movie = findMovieById(targetOrUrl);
      if (movie) {
        url = movie.videoUrl;
        title = movie.title;
      }
    }

    if (!url) return;

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

  // Helper: Format seconds to HH:MM:SS or MM:SS
  function formatTime(sec) {
    if (!sec || isNaN(sec) || sec < 0) return '00:00';
    const totalSec = Math.floor(sec);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const mStr = String(mins).padStart(2, '0');
    const sStr = String(secs).padStart(2, '0');
    if (hrs > 0) {
      return `${hrs}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  }

  // Trigger Center Pulse Indicator (Play or Pause)
  function triggerCenterPulse(isPlay) {
    const pulse = document.getElementById('playerCenterPulse');
    const icon = document.getElementById('centerPulseIcon');
    if (!pulse) return;
    if (icon) {
      icon.setAttribute('data-lucide', isPlay ? 'play' : 'pause');
      if (window.lucide) window.lucide.createIcons({ root: pulse });
    }
    pulse.classList.add('pulse-active');
    setTimeout(() => {
      pulse.classList.remove('pulse-active');
    }, 380);
  }

  // Trigger Gesture Ripple on left/right double click (-10s / +10s)
  function triggerGestureRipple(side) {
    const ripple = document.getElementById(side === 'left' ? 'rippleLeft' : 'rippleRight');
    if (!ripple) return;
    ripple.classList.add('active');
    setTimeout(() => {
      ripple.classList.remove('active');
    }, 450);
  }

  // Reset Auto-Hide Controls Timer
  function resetPlayerAutoHideTimer() {
    const cinemaBox = document.getElementById('playerCinemaBox');
    const video = document.getElementById('cinemaVideo');
    if (!cinemaBox) return;

    cinemaBox.classList.add('controls-active');

    if (state.playerControlsTimeout) {
      clearTimeout(state.playerControlsTimeout);
      state.playerControlsTimeout = null;
    }

    if (video && !video.paused && !video.ended) {
      state.playerControlsTimeout = setTimeout(() => {
        const audioPopup = document.getElementById('playerAudioPopup');
        const speedPopup = document.getElementById('playerSpeedPopup');
        const audioDialog = document.getElementById('playerAudioDialog');
        const epDrawer = document.getElementById('playerEpDrawer');

        const hasActivePopup = (audioPopup && audioPopup.classList.contains('active')) ||
                               (speedPopup && speedPopup.classList.contains('active')) ||
                               (audioDialog && audioDialog.style.display === 'block') ||
                               (epDrawer && epDrawer.classList.contains('active'));

        if (!hasActivePopup && video && !video.paused) {
          cinemaBox.classList.remove('controls-active');
        }
      }, 3500);
    }
  }

  // Render Audio Track Popup Menu Items
  function renderAudioTrackMenuItems(tracks, activeIndex) {
    const list = document.getElementById('playerAudioMenuList');
    if (!list) return;
    list.innerHTML = '';

    if (!tracks || tracks.length === 0) {
      const emptyBtn = document.createElement('button');
      emptyBtn.className = 'popup-item active';
      emptyBtn.textContent = 'Default Audio';
      list.appendChild(emptyBtn);
      return;
    }

    tracks.forEach((t) => {
      const btn = document.createElement('button');
      btn.className = `popup-item ${t.index === activeIndex ? 'active' : ''}`;
      btn.onclick = () => selectAudioTrack(t.index);

      const titleSpan = document.createElement('span');
      titleSpan.textContent = t.label;
      btn.appendChild(titleSpan);

      if (t.index === activeIndex) {
        const check = document.createElement('span');
        check.style.color = 'var(--primary)';
        check.style.fontSize = '12px';
        check.textContent = 'Active';
        btn.appendChild(check);
      }

      list.appendChild(btn);
    });
  }

  function toggleAudioMenu(forceState) {
    const popup = document.getElementById('playerAudioPopup');
    const speedPopup = document.getElementById('playerSpeedPopup');
    if (speedPopup) speedPopup.classList.remove('active');
    if (!popup) return;
    if (typeof forceState === 'boolean') {
      popup.classList.toggle('active', forceState);
    } else {
      popup.classList.toggle('active');
    }
    resetPlayerAutoHideTimer();
  }

  function selectAudioTrack(idx) {
    const video = document.getElementById('cinemaVideo');
    if (!video || !window.CineBoxAudio) return;

    const trackIndex = parseInt(idx, 10) || 0;
    state.activeAudioTrackIndex = trackIndex;
    const res = window.CineBoxAudio.setAudioTrack(trackIndex, video);

    const tracks = window.CineBoxAudio.getTracks();
    renderAudioTrackMenuItems(tracks, trackIndex);
    toggleAudioMenu(false);

    const btnLabel = document.getElementById('playerAudioBtnLabel');
    if (btnLabel && res && res.label) {
      btnLabel.textContent = res.language ? `Audio (${res.language})` : res.label;
    }

    if (res && res.native) {
      showToast(`Switched to ${res.label}`);
    } else if (tracks && tracks.length > 1 && trackIndex > 0) {
      openAudioDialog(res.label, res.language);
    } else {
      showToast(`Audio Track: ${res.label}`);
    }
  }

  function openAudioDialog(trackLabel, lang) {
    const dialog = document.getElementById('playerAudioDialog');
    const titleEl = document.getElementById('audioDialogTrackName');
    const langEl = document.getElementById('audioDialogLangName');
    if (!dialog) return;
    if (titleEl) titleEl.textContent = `${trackLabel} Selected`;
    if (langEl) langEl.textContent = lang ? `${lang} Audio` : trackLabel;
    dialog.style.display = 'block';
    if (window.lucide) window.lucide.createIcons({ root: dialog });
  }

  function closeAudioDialog() {
    const dialog = document.getElementById('playerAudioDialog');
    if (dialog) dialog.style.display = 'none';
  }

  function toggleSpeedMenu(forceState) {
    const popup = document.getElementById('playerSpeedPopup');
    const audioPopup = document.getElementById('playerAudioPopup');
    if (audioPopup) audioPopup.classList.remove('active');
    if (!popup) return;
    if (typeof forceState === 'boolean') {
      popup.classList.toggle('active', forceState);
    } else {
      popup.classList.toggle('active');
    }
    resetPlayerAutoHideTimer();
  }

  function setPlaybackSpeed(speed) {
    const video = document.getElementById('cinemaVideo');
    const num = parseFloat(speed);
    if (video && !isNaN(num)) {
      video.playbackRate = num;
      const label = document.getElementById('playerSpeedBtnLabel');
      if (label) label.textContent = `${num}x`;

      const speedPopup = document.getElementById('playerSpeedPopup');
      if (speedPopup) {
        speedPopup.querySelectorAll('.popup-item').forEach((it) => {
          it.classList.toggle('active', it.textContent.startsWith(String(num)));
        });
      }
      toggleSpeedMenu(false);
      showToast(`Playback speed set to ${num}x`);
    }
  }

  function togglePlayPause() {
    const video = document.getElementById('cinemaVideo');
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      triggerCenterPulse(true);
    } else {
      video.pause();
      triggerCenterPulse(false);
    }
    resetPlayerAutoHideTimer();
  }

  function seekDelta(seconds) {
    const video = document.getElementById('cinemaVideo');
    if (!video) return;
    const dur = video.duration || 0;
    const newTime = Math.max(0, Math.min(video.currentTime + seconds, dur));
    video.currentTime = newTime;
    triggerGestureRipple(seconds < 0 ? 'left' : 'right');
    resetPlayerAutoHideTimer();
  }

  function toggleMute() {
    const video = document.getElementById('cinemaVideo');
    if (!video) return;
    video.muted = !video.muted;
    updateVolumeUI(video.muted ? 0 : video.volume);
    resetPlayerAutoHideTimer();
  }

  function setVolume(val) {
    const video = document.getElementById('cinemaVideo');
    if (!video) return;
    const vol = parseFloat(val);
    video.volume = vol;
    video.muted = (vol === 0);
    updateVolumeUI(vol);
    resetPlayerAutoHideTimer();
  }

  function updateVolumeUI(vol) {
    const slider = document.getElementById('playerVolumeSlider');
    const icon = document.getElementById('iconPlayerVolume');
    if (slider) slider.value = vol;
    if (icon) {
      let iconName = 'volume-2';
      if (vol === 0) iconName = 'volume-x';
      else if (vol < 0.5) iconName = 'volume-1';
      icon.setAttribute('data-lucide', iconName);
      if (window.lucide) {
        const wrap = document.getElementById('btnPlayerMute');
        if (wrap) window.lucide.createIcons({ root: wrap });
      }
    }
  }

  function togglePiP() {
    const video = document.getElementById('cinemaVideo');
    if (!video) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else if (document.pictureInPictureEnabled) {
      video.requestPictureInPicture().catch(() => {});
    }
  }

  function toggleFullscreen() {
    const cinemaBox = document.getElementById('playerCinemaBox');
    const icon = document.getElementById('iconPlayerFullscreen');
    if (!cinemaBox) return;
    if (!document.fullscreenElement) {
      if (cinemaBox.requestFullscreen) {
        cinemaBox.requestFullscreen().catch(() => {});
      } else if (cinemaBox.webkitRequestFullscreen) {
        cinemaBox.webkitRequestFullscreen();
      }
      if (icon) icon.setAttribute('data-lucide', 'minimize');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      if (icon) icon.setAttribute('data-lucide', 'maximize');
    }
    if (window.lucide) {
      const btn = document.getElementById('btnPlayerFullscreen');
      if (btn) window.lucide.createIcons({ root: btn });
    }
  }

  function setupScrubberEvents() {
    const container = document.getElementById('playerTimelineContainer');
    const played = document.getElementById('playerTimelinePlayed');
    const thumb = document.getElementById('playerTimelineThumb');
    const preview = document.getElementById('playerTimelinePreview');
    const video = document.getElementById('cinemaVideo');

    if (!container || container.dataset.bound) return;
    container.dataset.bound = 'true';

    function getRatio(e) {
      const rect = container.getBoundingClientRect();
      const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return x / (rect.width || 1);
    }

    container.addEventListener('mousemove', (e) => {
      if (!video || !video.duration) return;
      const ratio = getRatio(e);
      const hoverTime = ratio * video.duration;
      if (preview) {
        preview.textContent = formatTime(hoverTime);
        const rect = container.getBoundingClientRect();
        preview.style.left = `${ratio * rect.width}px`;
        preview.classList.add('visible');
      }
    });

    container.addEventListener('mouseleave', () => {
      if (preview) preview.classList.remove('visible');
    });

    container.addEventListener('mousedown', (e) => {
      if (!video || !video.duration) return;
      state.isScrubbing = true;
      const ratio = getRatio(e);
      video.currentTime = ratio * video.duration;
      if (played) played.style.width = `${ratio * 100}%`;
      if (thumb) thumb.style.left = `${ratio * 100}%`;
      resetPlayerAutoHideTimer();
    });

    document.addEventListener('mousemove', (e) => {
      if (!state.isScrubbing || !video || !video.duration) return;
      const ratio = getRatio(e);
      video.currentTime = ratio * video.duration;
      if (played) played.style.width = `${ratio * 100}%`;
      if (thumb) thumb.style.left = `${ratio * 100}%`;
      const curEl = document.getElementById('playerCurrentTime');
      if (curEl) curEl.textContent = formatTime(video.currentTime);
    });

    document.addEventListener('mouseup', () => {
      if (state.isScrubbing) {
        state.isScrubbing = false;
        resetPlayerAutoHideTimer();
      }
    });
  }

  function setupViewportGestureEvents() {
    const viewport = document.getElementById('playerVideoViewport');
    const leftZone = document.getElementById('playerZoneLeft');
    const rightZone = document.getElementById('playerZoneRight');
    if (!viewport || viewport.dataset.bound) return;
    viewport.dataset.bound = 'true';

    viewport.addEventListener('click', (e) => {
      if (e.target.closest('.player-gesture-zone') || e.target.closest('.player-audio-dialog')) return;
      togglePlayPause();
    });

    if (leftZone) {
      leftZone.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        seekDelta(-10);
      });
    }

    if (rightZone) {
      rightZone.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        seekDelta(10);
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#playerAudioAnchor')) {
        const p = document.getElementById('playerAudioPopup');
        if (p) p.classList.remove('active');
      }
      if (!e.target.closest('#playerSpeedAnchor')) {
        const p = document.getElementById('playerSpeedPopup');
        if (p) p.classList.remove('active');
      }
    });
  }

  // Built-in Video Player & Ambilight Engine
  function playMovie(url, title) {
    const playerModal = document.getElementById('playerModal');
    const cinemaBox = document.getElementById('playerCinemaBox');
    const video = document.getElementById('cinemaVideo');
    const titleEl = document.getElementById('playerTitle');
    const qualityPill = document.getElementById('playerQualityPill');
    const played = document.getElementById('playerTimelinePlayed');
    const thumb = document.getElementById('playerTimelineThumb');
    const buffered = document.getElementById('playerTimelineBuffered');
    const currentTimeEl = document.getElementById('playerCurrentTime');
    const durationEl = document.getElementById('playerDuration');
    const spinner = document.getElementById('playerBufferingSpinner');
    const playPauseIcon = document.getElementById('iconPlayerPlayPause');

    if (!playerModal || !video) return;

    if (titleEl) titleEl.textContent = title || 'Playing Media';

    // Toggle player series navigation if series episodes are loaded
    const seriesNav = document.getElementById('playerSeriesNav');
    if (seriesNav) {
      seriesNav.style.display = (state.currentSeasonEpisodes && state.currentSeasonEpisodes.length > 0) ? 'inline-flex' : 'none';
    }

    // Find full movie record for progress saving
    const currentMovie = state.allMovies.find((m) => m.videoUrl === url) || {
      id: url,
      title: title,
      posterUrl: '',
      videoUrl: url,
      category: 'Movie',
      quality: 'HD'
    };

    if (qualityPill) {
      qualityPill.textContent = currentMovie.quality || 'HD';
    }

    video.src = sanitizeUrl(url);
    video.volume = 1.0;
    video.muted = false;

    // Reset UI states
    if (played) played.style.width = '0%';
    if (thumb) thumb.style.left = '0%';
    if (buffered) buffered.style.width = '0%';
    if (currentTimeEl) currentTimeEl.textContent = '00:00';
    if (durationEl) durationEl.textContent = '00:00';
    if (playPauseIcon) {
      playPauseIcon.setAttribute('data-lucide', 'play');
      const btn = document.getElementById('btnPlayerPlayPause');
      if (btn && window.lucide) window.lucide.createIcons({ root: btn });
    }

    playerModal.classList.add('active');
    if (cinemaBox) cinemaBox.classList.add('controls-active');

    // Populate audio track selector from detected multi-audio tracks
    if (window.CineBoxAudio) {
      const tracks = window.CineBoxAudio.setupMediaTracks(video, currentMovie.rawTitle || title, url);
      state.activeAudioTrackIndex = 0;
      renderAudioTrackMenuItems(tracks, 0);
      const btnLabel = document.getElementById('playerAudioBtnLabel');
      if (btnLabel && tracks && tracks.length > 0) {
        btnLabel.textContent = tracks[0].language ? `Audio (${tracks[0].language})` : tracks[0].label;
      }
    }

    // Restore saved playback position
    const resumeKey = `movielist_resume_${url}`;
    const savedTime = parseFloat(localStorage.getItem(resumeKey) || '0');
    if (savedTime > 15) {
      video.currentTime = savedTime;
    }

    // Save playback progress on timeupdate & update scrubber
    video.ontimeupdate = () => {
      const dur = video.duration || 1;
      const cur = video.currentTime || 0;

      if (!state.isScrubbing) {
        const pct = (cur / dur) * 100;
        if (played) played.style.width = `${pct}%`;
        if (thumb) thumb.style.left = `${pct}%`;
        if (currentTimeEl) currentTimeEl.textContent = formatTime(cur);
      }

      if (cur > 5) {
        localStorage.setItem(resumeKey, String(cur));
      }
      if (cur > 10) {
        saveWatchProgress(currentMovie, cur, dur);
      }
    };

    video.onprogress = () => {
      if (buffered && video.duration && video.buffered.length > 0) {
        const lastIdx = video.buffered.length - 1;
        const end = video.buffered.end(lastIdx);
        buffered.style.width = `${(end / video.duration) * 100}%`;
      }
    };

    video.onloadedmetadata = () => {
      if (durationEl) durationEl.textContent = formatTime(video.duration);

      // Auto-detect discrete multi-audio tracks when supported natively by browser
      if (window.CineBoxAudio) {
        const native = window.CineBoxAudio.detectNativeAudioTracks(video);
        if (native && native.length > 1) {
          renderAudioTrackMenuItems(native, state.activeAudioTrackIndex);
        }
      }
    };

    video.onwaiting = () => {
      if (spinner) spinner.style.display = 'flex';
    };

    video.onseeking = () => {
      if (spinner) spinner.style.display = 'flex';
    };

    video.onplaying = () => {
      if (spinner) spinner.style.display = 'none';
    };

    video.onseeked = () => {
      if (spinner) spinner.style.display = 'none';
    };

    video.oncanplay = () => {
      if (spinner) spinner.style.display = 'none';
    };

    video.onplay = () => {
      if (playPauseIcon) {
        playPauseIcon.setAttribute('data-lucide', 'pause');
        const btn = document.getElementById('btnPlayerPlayPause');
        if (btn && window.lucide) window.lucide.createIcons({ root: btn });
      }
      startAmbilightLoop();
      resetPlayerAutoHideTimer();
    };

    video.onpause = () => {
      if (playPauseIcon) {
        playPauseIcon.setAttribute('data-lucide', 'play');
        const btn = document.getElementById('btnPlayerPlayPause');
        if (btn && window.lucide) window.lucide.createIcons({ root: btn });
      }
      stopAmbilightLoop();
      if (cinemaBox) cinemaBox.classList.add('controls-active');
    };

    video.onended = () => {
      if (state.currentSeasonEpisodes && state.currentSeasonEpisodes.length > 0 && state.currentPlayingEpisodeIdx >= 0) {
        playNextEpisode();
      }
    };

    // Auto-hide listeners
    if (cinemaBox && !cinemaBox.dataset.autohideBound) {
      cinemaBox.dataset.autohideBound = 'true';
      cinemaBox.addEventListener('mousemove', resetPlayerAutoHideTimer);
      cinemaBox.addEventListener('touchstart', resetPlayerAutoHideTimer, { passive: true });
    }

    // Scrubber click & drag listeners
    setupScrubberEvents();

    // Gestures and Viewport Click
    setupViewportGestureEvents();

    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
      showToast('Click unmute on player controls to enable sound');
    });

    if (window.lucide) window.lucide.createIcons({ root: playerModal });
  }

  function closePlayer() {
    const playerModal = document.getElementById('playerModal');
    const cinemaBox = document.getElementById('playerCinemaBox');
    const video = document.getElementById('cinemaVideo');
    stopAmbilightLoop();

    if (state.playerControlsTimeout) {
      clearTimeout(state.playerControlsTimeout);
      state.playerControlsTimeout = null;
    }

    if (window.CineBoxAudio) {
      window.CineBoxAudio.reset();
    }
    closeAudioDialog();
    toggleAudioMenu(false);
    toggleSpeedMenu(false);

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    const seriesNav = document.getElementById('playerSeriesNav');
    if (seriesNav) seriesNav.style.display = 'none';
    const epDrawer = document.getElementById('playerEpDrawer');
    if (epDrawer) epDrawer.classList.remove('active');

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
        if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          togglePlayPause();
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          toggleFullscreen();
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          toggleMute();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          seekDelta(10);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          seekDelta(-10);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setVolume(Math.min(1, Math.round(((video.volume || 1) + 0.05) * 100) / 100));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setVolume(Math.max(0, Math.round(((video.volume || 1) - 0.05) * 100) / 100));
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          playNextEpisode();
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          playPrevEpisode();
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          togglePlayerEpDrawer();
        }
      }
    });
  }

  let gridScrollDebounce = null;
  function setupInfiniteScroll() {
    window.addEventListener(
      'scroll',
      () => {
        const isHomeView = state.activeCategory === 'All' && !state.searchQuery;
        if (isHomeView) return;
        if (gridScrollDebounce) return;

        gridScrollDebounce = setTimeout(() => {
          gridScrollDebounce = null;
          if (!state.filteredMovies || state.gridRenderLimit >= state.filteredMovies.length) return;

          const scrollHeight = document.documentElement.scrollHeight;
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const clientHeight = window.innerHeight || document.documentElement.clientHeight;

          if (scrollTop + clientHeight >= scrollHeight - 600) {
            loadMoreGrid();
          }
        }, 120);
      },
      { passive: true }
    );
  }

  // Initialization
  function init() {
    initTheme();
    loadWatchlist();
    loadCatalog();
    setupKeybindings();
    try {
      localStorage.removeItem('movielist_vlc_desktop');
      localStorage.removeItem('movielist_vlc_desktop_auto');
      if (localStorage.getItem('movielist_default_player') === 'vlc') {
        localStorage.removeItem('movielist_default_player');
        state.defaultPlayer = '';
      }
    } catch (e) {}
    setupInfiniteScroll();

    const setupSearchInput = (inputEl) => {
      if (!inputEl) return;
      let debounce = null;
      let gridDebounce = null;

      inputEl.addEventListener('focus', () => {
        const val = (inputEl.value || '').trim();
        if (val.length >= 2) {
          renderLiveSearchResults(val);
        } else {
          showRecentOrPopularDropdown();
        }
      });

      inputEl.addEventListener('input', (e) => {
        clearTimeout(debounce);
        clearTimeout(gridDebounce);
        const val = e.target.value;

        // Sync other search input if present
        const otherInput =
          inputEl.id === 'searchInput'
            ? document.getElementById('mobileSearchInput')
            : document.getElementById('searchInput');
        if (otherInput && otherInput.value !== val) {
          otherInput.value = val;
        }

        const clearBtn = document.getElementById('mobileSearchClearBtn');
        if (clearBtn) clearBtn.style.display = val ? 'flex' : 'none';

        if (!val) {
          setSearch('');
          showRecentOrPopularDropdown();
          return;
        }

        if (val.trim().length >= 2) {
          debounce = setTimeout(() => {
            renderLiveSearchResults(val);
          }, 110);

          gridDebounce = setTimeout(() => {
            setSearch(val);
          }, 260);
        } else {
          showRecentOrPopularDropdown();
          if (state.searchQuery) {
            setSearch('');
          }
        }
      });

      inputEl.addEventListener('keydown', (e) => {
        handleDropdownKeyNav(e, inputEl);
      });
    };

    setupSearchInput(document.getElementById('searchInput'));
    setupSearchInput(document.getElementById('mobileSearchInput'));

    document.addEventListener('pointerdown', (e) => {
      const desktopWrap = document.getElementById('desktopSearchWrap');
      const mobileWrap = document.getElementById('mobileSearchBar');
      const isInsideDesktop = desktopWrap && desktopWrap.contains(e.target);
      const isInsideMobile = mobileWrap && mobileWrap.contains(e.target);
      if (!isInsideDesktop && !isInsideMobile) {
        hideSearchDropdown();
      }
    });

    const drawerOverlay = document.getElementById('categoryDrawerOverlay');
    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) closeCategoryDrawer();
      });
    }

    const epDrawer = document.getElementById('playerEpDrawer');
    if (epDrawer) {
      epDrawer.addEventListener('click', (e) => {
        if (e.target === epDrawer) togglePlayerEpDrawer(false);
      });
    }

    // Browser / Phone Back navigation support for full-page details
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.view === 'details' && e.state.id) {
        openDetails(e.state.id, false);
      } else if (window.location.hash.startsWith('#media=')) {
        const mediaId = decodeURIComponent(window.location.hash.replace('#media=', ''));
        if (mediaId) {
          openDetails(mediaId, false);
        }
      } else {
        const detailsModalEl = document.getElementById('detailsModal');
        if (detailsModalEl && (detailsModalEl.classList.contains('active') || detailsModalEl.style.display === 'block')) {
          closeDetails(false);
        }
      }
    });

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

    // Touch Swipe Gesture for Hero Carousel
    const heroEl = document.getElementById('heroCarousel');
    if (heroEl) {
      let touchStartX = 0;
      let touchStartY = 0;
      heroEl.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });

      heroEl.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches.length > 0) {
          const diffX = e.changedTouches[0].clientX - touchStartX;
          const diffY = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < 0) nextSlide();
            else prevSlide();
          }
        }
      }, { passive: true });
    }

    // Touch Swipe-Right Gesture to Close Settings Drawer
    const settingsPanel = document.getElementById('settingsDrawerPanel');
    if (settingsPanel) {
      let panelStartX = 0;
      settingsPanel.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
          panelStartX = e.touches[0].clientX;
        }
      }, { passive: true });

      settingsPanel.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches.length > 0) {
          const diffX = e.changedTouches[0].clientX - panelStartX;
          if (diffX > 60) {
            closeSettingsDrawer();
          }
        }
      }, { passive: true });
    }

    // Keyboard ESC key dismissal for drawers and modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSettingsDrawer();
        closeCategoryDrawer();
      }
    });

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
    toggleWatchlistFromCard,
    openExternalPlayerFromEpisode,
    findMovieById,
    removeHistory,
    openDetails,
    closeDetails,
    shareMedia,
    toggleWatchlistFromPage,
    toggleSynopsis,
    openTrailer,
    closeTrailer,
    playMovie,
    closePlayer,
    toggleAmbilight,
    togglePlayPause,
    seekDelta,
    toggleMute,
    setVolume,
    toggleAudioMenu,
    selectAudioTrack,
    closeAudioDialog,
    toggleSpeedMenu,
    setPlaybackSpeed,
    togglePiP,
    toggleFullscreen,
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
    toggleTheme,
    setTheme,
    openSettingsDrawer,
    closeSettingsDrawer,
    toggleSetting,
    clearContinueWatching,
    clearSearchHistory,
    openCategoryDrawer,
    closeCategoryDrawer,
    selectCategoryFromDrawer,
    toggleMobileSearch,
    clearMobileSearch,
    selectIndexedSeason,
    selectSpecialsTab,
    filterEpisodes,
    clearEpisodeFilter,
    playSpecificEpisode,
    playNextEpisode,
    playPrevEpisode,
    togglePlayerEpDrawer,
    downloadSeasonM3u,
    exportSeasonLinksTxt,
    selectSearchItem,
    selectPlaySearchItem,
    viewAllSearchResults,
    fillAndSearch,
    removeRecentSearch,
    clearRecentSearches,
    hideSearchDropdown,
    scrollToCatalog,
    loadMoreGrid
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
