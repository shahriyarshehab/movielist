/**
 * CineBox - Dual & Multi-Audio Track Manager Engine
 * Supports:
 *  1. Discrete multi-audio track switching via HTML5 video.audioTracks (Safari / iOS / supported browsers)
 *  2. HLS.js adaptive audio track switching
 *  3. Automatic language detection from movie titles & server filenames (e.g. Hindi, English, Tamil, Telugu)
 *  4. Clean audio track selector integration
 */

(function () {
  'use strict';

  let currentVideoEl = null;
  let currentTracks = [];
  let selectedTrackIndex = 0;

  const KNOWN_LANGUAGES = [
    'Hindi', 'English', 'Tamil', 'Telugu', 'Malayalam', 'Kannada',
    'Bengali', 'Marathi', 'Punjabi', 'Gujarati', 'Urdu', 'Korean',
    'Japanese', 'Spanish', 'French', 'German', 'Italian', 'Russian', 'Chinese'
  ];

  /**
   * Parse audio track languages from media title and decoded URL
   * Example: "[Dual Audio][Hindi 5.1+English 5.1]" -> ["Hindi Audio", "English Audio"]
   */
  function parseAudioTracksFromMedia(rawTitle, videoUrl) {
    let decodedUrl = '';
    try {
      decodedUrl = decodeURIComponent(videoUrl || '');
    } catch (e) {
      decodedUrl = videoUrl || '';
    }

    const text = (rawTitle || '') + ' ' + decodedUrl;
    const tracks = [];

    // Pattern 1: [Dual Audio][Hindi 5.1+English 5.1] or [Multi Audio][Hindi (Clean)+Tamil+Telugu CAM]
    const bracketMatch = text.match(/\[(?:Dual|Multi)\s+Audio\]\s*\[([^\]]+)\]/i) ||
                         text.match(/\[([^\]]*?(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Bengali|Marathi|Punjabi|Korean|Japanese)[^\]]*?)\]/i);

    if (bracketMatch && bracketMatch[1]) {
      const rawLangs = bracketMatch[1].split(/\+/);
      rawLangs.forEach((l, idx) => {
        let clean = l.replace(/\b(5\.1|2\.0|7\.1|CAM|Clean|HQ|Line|Dub|Original|DD5\.1|AAC|ESub|MSubs)\b/gi, '')
                     .replace(/[\(\)]/g, '')
                     .trim();
        if (clean) {
          tracks.push({
            index: idx,
            id: `track_${idx}`,
            label: `Track ${idx + 1}: ${clean} Audio`,
            language: clean,
            enabled: (idx === 0)
          });
        }
      });
    }

    // Pattern 2: [Dual Audio] tag without secondary bracket -> Hindi + English default
    if (tracks.length === 0) {
      if (/\[Dual Audio\]|Dual[- ]Audio/i.test(text)) {
        tracks.push({
          index: 0,
          id: 'track_0',
          label: 'Track 1: Hindi Audio (Default)',
          language: 'Hindi',
          enabled: true
        });
        tracks.push({
          index: 1,
          id: 'track_1',
          label: 'Track 2: English Audio',
          language: 'English',
          enabled: false
        });
      } else {
        // Pattern 3: Single language mention
        const langRegex = new RegExp(`\\b(${KNOWN_LANGUAGES.join('|')})\\b`, 'i');
        const singleMatch = text.match(langRegex);
        if (singleMatch) {
          tracks.push({
            index: 0,
            id: 'track_0',
            label: `Track 1: ${singleMatch[1]} Audio (Default)`,
            language: singleMatch[1],
            enabled: true
          });
        } else {
          tracks.push({
            index: 0,
            id: 'track_0',
            label: 'Track 1: Default Audio',
            language: 'Default',
            enabled: true
          });
        }
      }
    }

    return tracks;
  }

  /**
   * Detect discrete native tracks via HTMLMediaElement.audioTracks
   */
  function detectNativeAudioTracks(videoElement) {
    if (!videoElement || !videoElement.audioTracks || videoElement.audioTracks.length <= 1) {
      return null;
    }

    const nativeTracks = [];
    for (let i = 0; i < videoElement.audioTracks.length; i++) {
      const t = videoElement.audioTracks[i];
      let lang = t.language || '';
      let label = t.label || '';

      if (!label && lang) {
        label = `Track ${i + 1}: ${lang.toUpperCase()} Audio`;
      } else if (!label) {
        label = `Track ${i + 1}: Audio Track`;
      }

      nativeTracks.push({
        index: i,
        id: `track_${i}`,
        label: label,
        language: lang,
        enabled: Boolean(t.enabled)
      });
    }
    return nativeTracks;
  }

  /**
   * Initialize audio track list for current media item
   */
  function setupMediaTracks(videoElement, rawTitle, videoUrl) {
    currentVideoEl = videoElement;
    selectedTrackIndex = 0;

    const native = detectNativeAudioTracks(videoElement);
    if (native && native.length > 1) {
      currentTracks = native;
    } else {
      currentTracks = parseAudioTracksFromMedia(rawTitle, videoUrl);
    }
    return currentTracks;
  }

  /**
   * Switch active audio track by index
   */
  function setAudioTrack(trackIndex, videoElement) {
    const el = videoElement || currentVideoEl;
    const idx = parseInt(trackIndex, 10) || 0;
    selectedTrackIndex = idx;

    const track = currentTracks.find((t) => t.index === idx) || currentTracks[idx] || { label: `Track ${idx + 1}: Audio` };

    let nativeSwitched = false;

    // 1. Native HTML5 audioTracks API switching (Safari, iOS, Chrome with flags)
    if (el && el.audioTracks && el.audioTracks.length > idx) {
      try {
        for (let i = 0; i < el.audioTracks.length; i++) {
          el.audioTracks[i].enabled = (i === idx);
        }
        nativeSwitched = true;
      } catch (e) {
        console.warn('Native audioTracks switch error:', e);
      }
    }

    // 2. HLS.js adaptive audio track switching
    if (window.hls && typeof window.hls.audioTrack !== 'undefined') {
      try {
        window.hls.audioTrack = idx;
        nativeSwitched = true;
      } catch (e) {}
    }

    return {
      success: true,
      index: idx,
      label: track.label,
      language: track.language || '',
      native: nativeSwitched
    };
  }

  function reset() {
    selectedTrackIndex = 0;
    currentTracks = [];
    currentVideoEl = null;
  }

  window.CineBoxAudio = {
    setupMediaTracks,
    parseAudioTracksFromMedia,
    detectNativeAudioTracks,
    setAudioTrack,
    reset,
    getTracks: () => currentTracks,
    getSelectedTrackIndex: () => selectedTrackIndex
  };
})();
