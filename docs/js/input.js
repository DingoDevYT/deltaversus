// Keyboard input. Z/Enter = confirm, X/Esc = cancel, arrows/WASD = move.
const Input = {
  down: {},   // currently held
  hit: {},    // pressed this frame
};
const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  z: 'ok', Enter: 'ok', ' ': 'ok',
  x: 'cancel', Escape: 'cancel', Shift: 'cancel',
};
window.addEventListener('keydown', e => {
  const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
  if (!k) return;
  // In text-entry mode (typing a room code), single-character keys are letters
  // being typed - don't let z/x/etc. double as OK/CANCEL. Multi-char keys
  // (Enter, Escape, Arrows) still work so you can confirm/cancel.
  if (Input.textMode && e.key.length === 1) { e.preventDefault(); return; }
  e.preventDefault();
  if (!Input.down[k]) Input.hit[k] = true;
  Input.down[k] = true;
});
window.addEventListener('keyup', e => {
  const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
  if (!k) return;
  Input.down[k] = false;
});
window.addEventListener('blur', () => { Input.down = {}; });
Input.flush = () => { Input.hit = {}; };
