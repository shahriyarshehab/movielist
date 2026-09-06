/**
 * MovieList - Core Application Engine
 * Architecture: Ultra-Fast Glassmorphism SPA
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
    activeMovie: null,
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

    // Remove leading order numbers (e.g. "001. ")
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
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', state.theme === 'light' ? 'moon' : 'sun');
      if (window.lucide) window.lucide.createIcons();
    }
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

  function processCatalogData(data) {
    const all = [];
    const seenUrls = new Set();

    // Helper to map array format [rawTitle, posterUrl, videoUrl, category, tag, size, date]
    function mapItem(item, fallbackCategory) {
      const rawTitle = item[0] || '';
      const posterUrl = item[1] || '';
      const videoUrl = item[2] || '';
      const category = item[3] || fallbackCategory || 'Movies';
      const tag = item[4] || '';
      const size = item[5] || '';
      const date = item[6] || '';

      const { title, year, quality } = cleanTitle(rawTitle);

      // Estimate rating based on category
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

    // Process Carousel
    if (Array.isArray(data.carousel)) {
      state.carouselMovies = data.carousel.map((item) => mapItem(item, 'Featured'));
      state.carouselMovies.forEach((m) => {
        if (m.videoUrl && !seenUrls.has(m.videoUrl)) {
          seenUrls.add(m.videoUrl);
          all.push(m);
        }
      });
    }

    // Process Categories
    if (data.categories && typeof data.categories === 'object') {
      state.categories = {};
      for (const [catName, items] of Object.entries(data.categories)) {
        if (Array.isArray(items)) {
          const mapped = items.map((item) => mapItem(item, catName));
          state.categories[catName] = mapped;
          mapped.forEach((m) => {
            if (m.videoUrl && !seenUrls.has(m.videoUrl)) {
              seenUrls.add(m.videoUrl);
              all.push(m);
            }
          });
        }
      }
    }

    state.allMovies = all;
    renderHeroCarousel();
    filterAndRenderGrid();
  }

  function processFallbackData() {
    // Graceful fallback movies if home_data.json is missing
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

  function stopCarouselAuto() {
    clearInterval(state.slideInterval);
  }

  // Filtering, Searching & Sorting
  function setCategory(cat) {
    state.activeCategory = cat;
    document.querySelectorAll('.category-pill').forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.category === cat);
    });
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

  function filterAndRenderGrid() {
    let list = [...state.allMovies];

    // Filter by Watchlist view
    if (state.activeCategory === 'Watchlist') {
      list = list.filter((m) => state.watchlist.has(m.videoUrl));
    } else if (state.activeCategory !== 'All') {
      if (state.categories[state.activeCategory]) {
        list = state.categories[state.activeCategory];
      } else {
        const catQuery = state.activeCategory.toLowerCase();
        list = list.filter((m) => m.category.toLowerCase().includes(catQuery));
      }
    }

    // Filter by search query
    if (state.searchQuery) {
      const q = state.searchQuery;
      list = list.filter((m) => {
        return (
          m.title.toLowerCase().includes(q) ||
          (m.year && m.year.includes(q)) ||
          m.category.toLowerCase().includes(q)
        );
      });
    }

    // Apply Sorting
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

  // Grid Rendering Component
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

    grid.innerHTML = state.filteredMovies
      .map((m) => {
        const isWatchlisted = state.watchlist.has(m.videoUrl);
        return `
          <div class="movie-card" onclick="window.MovieList.openDetails('${escapeQuotes(m.id)}')">
            <div class="card-poster-wrap">
              <span class="card-badge-top-left">${escapeHtml(m.quality)}</span>
              <button class="card-watchlist-btn ${isWatchlisted ? 'active' : ''}" 
                      onclick="window.MovieList.toggleWatchlist('${escapeQuotes(m.videoUrl)}', '${escapeQuotes(m.title)}', event)" 
                      title="Save to Watchlist">
                <i data-lucide="bookmark" style="width:16px;height:16px;${isWatchlisted ? 'fill:currentColor;' : ''}"></i>
              </button>
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
      })
      .join('');

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

  // Built-in Video Player Modal Component
  function playMovie(url, title) {
    const playerModal = document.getElementById('playerModal');
    const video = document.getElementById('cinemaVideo');
    const titleEl = document.getElementById('playerTitle');
    if (!playerModal || !video) return;

    if (titleEl) titleEl.textContent = title || 'Playing Media';

    // Direct HTML5 video assignment with sound enabled by default!
    video.src = sanitizeUrl(url);
    video.volume = 1.0;
    video.muted = false;

    playerModal.classList.add('active');

    // Restore saved playback position if available
    const resumeKey = `movielist_resume_${url}`;
    const savedTime = parseFloat(localStorage.getItem(resumeKey) || '0');
    if (savedTime > 15) {
      video.currentTime = savedTime;
    }

    // Save playback progress on timeupdate
    video.ontimeupdate = () => {
      if (video.currentTime > 5) {
        localStorage.setItem(resumeKey, String(video.currentTime));
      }
    };

    video.play().catch(() => {
      // If browser blocks unmuted autoplay, mute once and prompt
      video.muted = true;
      video.play().catch(() => {});
      showToast('Click unmute on player controls to enable sound');
    });
  }

  function closePlayer() {
    const playerModal = document.getElementById('playerModal');
    const video = document.getElementById('cinemaVideo');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    if (playerModal) {
      playerModal.classList.remove('active');
    }
  }

  // Global Keyboard Navigation
  function setupKeybindings() {
    document.addEventListener('keydown', (e) => {
      const playerModal = document.getElementById('playerModal');
      const detailsModal = document.getElementById('detailsModal');
      const video = document.getElementById('cinemaVideo');

      if (e.key === 'Escape') {
        if (playerModal && playerModal.classList.contains('active')) {
          closePlayer();
        } else if (detailsModal && detailsModal.classList.contains('active')) {
          closeDetails();
        }
      }

      // In Player Controls
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

  // Initialization Routine
  function init() {
    initTheme();
    loadWatchlist();
    loadCatalog();
    setupKeybindings();

    // Search Input Listener with Debounce
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

    // Close Modals on Backdrop Click
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

    if (window.lucide) window.lucide.createIcons();
  }

  // Public Interface for Inline Event Handlers
  window.MovieList = {
    setCategory,
    setSort,
    nextSlide,
    prevSlide,
    goToSlide: (idx) => {
      showSlide(idx);
      startCarouselAuto();
    },
    toggleWatchlist,
    openDetails,
    closeDetails,
    playMovie,
    closePlayer,
    toggleTheme
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
