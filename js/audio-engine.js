/**
 * CineBox - Web Audio DSP & Dual-Audio Channel Routing Engine
 * Architecture: Web Audio API (ChannelSplitter2 -> ChannelMerger2 -> GainNode -> Destination)
 * Supports:
 *  1. Dual-Audio Stereo Channel Splitting (Left channel Hindi / Dub to both ears, Right channel English / Orig to both ears)
 *  2. HTML5 video.audioTracks Discrete Multi-Track Switching (when available)
 *  3. Volume Booster & Dynamic Fallback
 */

(function () {
  'use strict';

  let audioCtx = null;
  let sourceNode = null;
  let splitterNode = null;
  let mergerNode = null;
  let gainNode = null;
  let currentVideoEl = null;
  let isInitialized = false;
  let activeMode = 'stereo'; // 'stereo' | 'left' | 'right' | 'track_X'

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    return audioCtx;
  }

  function init(videoElement) {
    if (!videoElement) return false;

    // If already connected to this video element, just ensure context is running
    if (isInitialized && currentVideoEl === videoElement && sourceNode) {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return true;
    }

    try {
      const ctx = getAudioContext();
      if (!ctx) return false;

      // Note: createMediaElementSource can only be called once per HTMLMediaElement
      if (!sourceNode || currentVideoEl !== videoElement) {
        currentVideoEl = videoElement;
        sourceNode = ctx.createMediaElementSource(videoElement);
        splitterNode = ctx.createChannelSplitter(2);
        mergerNode = ctx.createChannelMerger(2);
        gainNode = ctx.createGain();
        gainNode.gain.value = 1.0;

        // Connect source to splitter
        sourceNode.connect(splitterNode);

        // Default: Stereo connection (0 -> 0, 1 -> 1)
        splitterNode.connect(mergerNode, 0, 0);
        splitterNode.connect(mergerNode, 1, 1);

        // Connect merger to gainNode and destination
        mergerNode.connect(gainNode);
        gainNode.connect(ctx.destination);

        isInitialized = true;
      }

      if (ctx.state === 'suspended') {
        const resumeAudio = () => {
          if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          videoElement.removeEventListener('play', resumeAudio);
        };
        videoElement.addEventListener('play', resumeAudio);
      }

      return true;
    } catch (err) {
      console.warn('CineBox AudioEngine Web Audio init fallback:', err);
      return false;
    }
  }

  function setAudioMode(mode, videoElement) {
    activeMode = mode || 'stereo';

    // 1. Check if discrete track mode (e.g. 'track_0', 'track_1')
    if (mode && mode.startsWith('track_')) {
      const trackIdx = parseInt(mode.replace('track_', ''), 10);
      if (videoElement && videoElement.audioTracks && videoElement.audioTracks.length > trackIdx) {
        for (let i = 0; i < videoElement.audioTracks.length; i++) {
          videoElement.audioTracks[i].enabled = (i === trackIdx);
        }
        const label = videoElement.audioTracks[trackIdx].label || videoElement.audioTracks[trackIdx].language || `Track ${trackIdx + 1}`;
        return { success: true, mode: mode, label: label, type: 'discrete' };
      }
    }

    // 2. Stereo Channel Dual-Audio Routing via Web Audio API
    const ok = init(videoElement);
    if (!ok || !splitterNode || !mergerNode) {
      return { success: false, mode: 'stereo', error: 'Web Audio API not supported in this browser' };
    }

    try {
      // Disconnect previous splitter connections
      splitterNode.disconnect();

      if (mode === 'left') {
        // Route Left Channel (Dub 1 / Hindi) to BOTH Left and Right ears
        splitterNode.connect(mergerNode, 0, 0);
        splitterNode.connect(mergerNode, 0, 1);
        return { success: true, mode: 'left', label: 'Audio 1: Left Channel (Both Ears)', type: 'channel' };
      } else if (mode === 'right') {
        // Route Right Channel (Dub 2 / English) to BOTH Left and Right ears
        splitterNode.connect(mergerNode, 1, 0);
        splitterNode.connect(mergerNode, 1, 1);
        return { success: true, mode: 'right', label: 'Audio 2: Right Channel (Both Ears)', type: 'channel' };
      } else {
        // Standard Stereo Mix: 0 -> 0, 1 -> 1
        splitterNode.connect(mergerNode, 0, 0);
        splitterNode.connect(mergerNode, 1, 1);
        return { success: true, mode: 'stereo', label: 'Original Stereo Mix', type: 'stereo' };
      }
    } catch (err) {
      console.warn('CineBox AudioEngine routing error:', err);
      return { success: false, mode: 'stereo', error: err.message };
    }
  }

  function detectDiscreteTracks(videoElement) {
    const list = [];
    if (videoElement && videoElement.audioTracks && videoElement.audioTracks.length > 1) {
      for (let i = 0; i < videoElement.audioTracks.length; i++) {
        const t = videoElement.audioTracks[i];
        const label = t.label || (t.language ? `Track ${i + 1} (${t.language.toUpperCase()})` : `Track ${i + 1}`);
        list.push({
          id: `track_${i}`,
          index: i,
          label: label,
          language: t.language || '',
          enabled: Boolean(t.enabled)
        });
      }
    }
    return list;
  }

  function setVolumeBooster(multiplier) {
    if (gainNode && typeof multiplier === 'number') {
      gainNode.gain.value = Math.max(0, Math.min(multiplier, 3.0));
    }
  }

  function reset(videoElement) {
    activeMode = 'stereo';
    if (splitterNode && mergerNode) {
      try {
        splitterNode.disconnect();
        splitterNode.connect(mergerNode, 0, 0);
        splitterNode.connect(mergerNode, 1, 1);
      } catch (e) {}
    }
    if (videoElement && videoElement.audioTracks && videoElement.audioTracks.length > 0) {
      try {
        for (let i = 0; i < videoElement.audioTracks.length; i++) {
          videoElement.audioTracks[i].enabled = (i === 0);
        }
      } catch (e) {}
    }
  }

  window.CineBoxAudio = {
    init,
    setAudioMode,
    detectDiscreteTracks,
    setVolumeBooster,
    reset,
    getActiveMode: () => activeMode
  };
})();
