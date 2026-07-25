/**
 * gml_audio.js — sound playback for the GML runtime. Load AFTER gml_runtime.js
 * (it overrides the silent stubs) and after gml_sounds.js (the manifest).
 *
 * Design point: Deltarune's snd_play / snd_play_x / snd_play_pitch / snd_volume
 * / snd_pitch are GlobalScripts we already compile, and they all bottom out in
 * audio_play_sound(sound, priority, loop) plus gain/pitch calls on the returned
 * HANDLE. So the natives here implement the audio_* layer (accepting either a
 * sound name or a handle), and the compiled game scripts drive it exactly as
 * the game does. Direct snd_* fallbacks are installed too for code paths where
 * the script table isn't loaded.
 *
 * Pitch maps to HTMLAudio playbackRate (pitch and speed change together — the
 * same trade GameMaker's HTML5 export makes).
 */
(function (global) {
  'use strict';

  const MAN = () => global.GML_SOUND_MANIFEST || {};
  const HAVE_AUDIO = typeof Audio !== 'undefined';
  const warned = new Set();

  let master = (() => {
    try {
      const v = localStorage.getItem('dv_studio_vol');
      return v == null ? 0.6 : Math.max(0, Math.min(1, parseFloat(v)));
    } catch (e) { return 0.6; }
  })();

  /** Live handles: { $audio, $sndName, baseVol, vol, pitch }. */
  const live = new Set();

  function isHandle(v) { return !!(v && typeof v === 'object' && v.$sndName); }

  function resolveName(v) {
    if (v == null) return null;
    if (isHandle(v)) return v.$sndName;
    const s = String(v);
    return MAN()[s] ? s : null;
  }

  function applyVolume(h) {
    if (h.$audio) h.$audio.volume = Math.max(0, Math.min(1, master * h.baseVol * h.vol));
  }

  function start(name, loop) {
    const m = MAN()[name];
    if (!m) return null;
    const h = { $sndName: name, $audio: null, baseVol: m.volume == null ? 1 : m.volume, vol: 1, pitch: 1 };
    if (HAVE_AUDIO) {
      const a = new Audio('sounds/' + m.file);
      a.loop = !!loop;
      h.$audio = a;
      applyVolume(h);
      a.addEventListener('ended', () => { if (!a.loop) live.delete(h); });
      // Autoplay policy: rejected until the user has interacted with the page.
      // The studio's own controls count as interaction, so this self-heals.
      a.play().catch(() => { live.delete(h); });
    }
    live.add(h);
    return h;
  }

  function each(v, fn) {
    if (isHandle(v)) { fn(v); return; }
    const n = resolveName(v);
    if (!n) return;
    for (const h of [...live]) if (h.$sndName === n) fn(h);
  }

  const AudioSys = {
    play(name, loop) {
      const n = resolveName(name);
      if (!n) {
        const key = String(name);
        if (!warned.has(key)) { warned.add(key); console.warn(`[gml] no sound file for ${key}`); }
        return -1;
      }
      return start(n, loop) || -1;
    },
    stop(v) {
      each(v, h => {
        if (h.$audio) { h.$audio.pause(); try { h.$audio.currentTime = 0; } catch (e) {} }
        live.delete(h);
      });
    },
    stopAll() {
      for (const h of [...live]) if (h.$audio) h.$audio.pause();
      live.clear();
    },
    gain(v, vol) {
      each(v, h => { h.vol = Math.max(0, Number(vol) || 0); applyVolume(h); });
    },
    pitch(v, p) {
      each(v, h => {
        h.pitch = Number(p) || 1;
        if (h.$audio) { try { h.$audio.playbackRate = Math.max(0.25, Math.min(4, h.pitch)); } catch (e) {} }
      });
    },
    isPlaying(v) {
      let f = false;
      each(v, h => { if (h.$audio && !h.$audio.paused) f = true; });
      return f;
    },
    setMaster(v) {
      master = Math.max(0, Math.min(1, v));
      try { localStorage.setItem('dv_studio_vol', String(master)); } catch (e) {}
      for (const h of live) applyVolume(h);
    },
    getMaster() { return master; },
    liveCount() { return live.size; },
  };
  global.GML_AUDIO = AudioSys;

  // ── the natives the compiled game scripts bottom out in ──────────────────
  global.audio_play_sound = (snd, priority, loop) => AudioSys.play(snd, !!(loop === true || Number(loop)));
  global.audio_play_sound_at = snd => AudioSys.play(snd, false);
  global.audio_stop_sound = v => AudioSys.stop(v);
  global.audio_stop_all = () => AudioSys.stopAll();
  global.audio_pause_sound = v => each(v, h => { if (h.$audio) h.$audio.pause(); });
  global.audio_resume_sound = v => each(v, h => { if (h.$audio) h.$audio.play().catch(() => {}); });
  global.audio_sound_gain = (v, vol, time) => AudioSys.gain(v, vol);
  global.audio_sound_pitch = (v, p) => AudioSys.pitch(v, p);
  global.audio_is_playing = v => AudioSys.isPlaying(v);
  global.audio_sound_get_gain = v => { let g = 1; each(v, h => { g = h.vol; }); return g; };
  global.audio_sound_get_pitch = v => { let p = 1; each(v, h => { p = h.pitch; }); return p; };
  global.audio_exists = v => resolveName(v) !== null;

  // Playback POSITION. Deltarune syncs visuals to the music with these — Pink's
  // lipsync walks a 343-note chart against the track position, and several
  // attacks seek the music. Returning 0 forever makes those run their no-audio
  // fallback (or stall), so report the real element time.
  global.audio_sound_length = v => {
    let len = 0;
    each(v, h => { if (h.$audio && isFinite(h.$audio.duration)) len = h.$audio.duration; });
    return len;
  };
  global.audio_sound_get_track_position = v => {
    let pos = 0;
    each(v, h => { if (h.$audio) pos = h.$audio.currentTime || 0; });
    return pos;
  };
  global.audio_sound_set_track_position = (v, t) => {
    each(v, h => {
      if (!h.$audio) return;
      try { h.$audio.currentTime = Math.max(0, Number(t) || 0); } catch (e) { /* not seekable yet */ }
    });
  };

  // ── snd_* fallbacks, matching the GlobalScript signatures ────────────────
  // Used when a chapter's compiled script table doesn't carry them.
  global.snd_play = snd => AudioSys.play(snd, false);
  global.snd_play_x = (snd, vol, p) => { const h = AudioSys.play(snd, false); AudioSys.gain(h, vol); AudioSys.pitch(h, p); return h; };
  global.snd_play_pitch = (snd, p) => { const h = AudioSys.play(snd, false); AudioSys.pitch(h, p); return h; };
  global.snd_loop = snd => AudioSys.play(snd, true);
  global.snd_stop = v => AudioSys.stop(v);
  global.snd_volume = (v, vol, time) => AudioSys.gain(v, vol);
  global.snd_pitch = (v, p) => AudioSys.pitch(v, p);
  global.snd_is_playing = v => AudioSys.isPlaying(v);
  global.snd_free = () => {};
  global.snd_pause = v => global.audio_pause_sound(v);
  global.snd_pitch_time = (v, p) => AudioSys.pitch(v, p);
  global.mus_loop = snd => AudioSys.play(snd, true);
  global.mus_play = snd => AudioSys.play(snd, false);
  global.mus_stop = v => AudioSys.stop(v);
  global.mus_volume = (v, vol) => AudioSys.gain(v, vol);

})(typeof window !== 'undefined' ? window : globalThis);
