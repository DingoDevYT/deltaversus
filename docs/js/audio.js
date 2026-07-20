// Music + SFX. Browsers block audio until a user gesture, so the first
// keypress unlocks and starts whatever music was requested.
const Snd = {
  muted: localStorage.getItem('dv_muted') === '1',
  master: (() => { const v = parseFloat(localStorage.getItem('dv_vol')); return isNaN(v) ? 0.6 : v; })(),
  unlocked: false,
  music: null, musicKey: null, pendingMusic: null,
  cache: {},
  MVOL: 0.45, SVOL: 0.55,
};

Snd.setMaster = function (v) {
  Snd.master = Math.min(1, Math.max(0, v));
  localStorage.setItem('dv_vol', '' + Snd.master);
  if (Snd.music) Snd.music.volume = Snd.MVOL * Snd.master;
};

// which track plays while FIGHTING this character (opponent's theme)
Snd.THEME = {
  kris: 'rude_buster_general',
  susie: 'vs_susie_susie',
  ralsei: 'from_now_on_ralsei',
  noelle: 'vs_noelle_noelle',
  lancer: 'vs_lancer_lancer',
  berdly: 'smart_race_berdly',
  jevil: 'the_world_revolving_jevil',
  spamton: 'big_shot_spamton_neo',
  knight: 'black_knife_the_roaring_knight',
};

Snd.sfxPath = k => 'assets/audio/sfx/' + A.manifest.sfx[k];
Snd.musPath = k => 'assets/audio/music/' + A.manifest.music[k];

Snd.play = function (k, vol) {
  if (Snd.muted || !Snd.unlocked || !A.manifest || !A.manifest.sfx[k]) return;
  let base = Snd.cache[k];
  if (!base) { base = Snd.cache[k] = new Audio(Snd.sfxPath(k)); }
  const a = base.cloneNode();
  a.volume = (vol != null ? vol : Snd.SVOL) * Snd.master;
  a.play().catch(() => {});
};

Snd.playMusic = function (key) {
  if (!A.manifest || !A.manifest.music[key]) return;
  if (Snd.musicKey === key && Snd.music && !Snd.music.paused) return;
  Snd.pendingMusic = key;
  if (!Snd.unlocked) return;
  Snd._startMusic(key);
};

Snd._startMusic = function (key) {
  if (Snd.music) { Snd.music.pause(); Snd.music = null; }
  Snd.musicKey = key;
  if (Snd.muted) return;
  const m = new Audio(Snd.musPath(key));
  m.loop = true;
  m.volume = Snd.MVOL * Snd.master;
  m.play().catch(() => {});
  Snd.music = m;
};

Snd.stopMusic = function () {
  Snd.pendingMusic = null; Snd.musicKey = null;
  if (Snd.music) { Snd.music.pause(); Snd.music = null; }
};

Snd.unlock = function () {
  if (Snd.unlocked) return;
  Snd.unlocked = true;
  if (Snd.pendingMusic) Snd._startMusic(Snd.pendingMusic);
};

Snd.toggleMute = function () {
  Snd.muted = !Snd.muted;
  localStorage.setItem('dv_muted', Snd.muted ? '1' : '0');
  if (Snd.muted) { if (Snd.music) Snd.music.pause(); }
  else if (Snd.musicKey) Snd._startMusic(Snd.musicKey);
  else if (Snd.pendingMusic) Snd._startMusic(Snd.pendingMusic);
};

window.addEventListener('keydown', () => Snd.unlock(), { once: false });
window.addEventListener('keydown', e => {
  if (typeof G !== 'undefined' && (G.screen === 'join' || G.screen === 'ccname')) return;
  if (e.key === 'm' || e.key === 'M') Snd.toggleMute();
  if (e.key === '+' || e.key === '=') { Snd.setMaster(Snd.master + 0.1); Snd.play('menumove'); }
  if (e.key === '-' || e.key === '_') { Snd.setMaster(Snd.master - 0.1); Snd.play('menumove'); }
});
