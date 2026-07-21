"""Rip Gerson (Hammer/Sound of Justice, Ch4) battle sprites into docs/assets:
  * boss idle animation (14 frames) -> anims/gerson/idle_* + manifest.anims.gerson
  * bullet sprites (shell/hammer/star/cane/chevron/bell/giant hammer/swing-down/shield)
    -> bullets/ + manifest.bullets + bullet_cost
All trimmed to opaque bbox, native size kept (patterns downscale)."""
import os, json, glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = os.path.join(ROOT, 'NEW RIP', 'Characters', 'Characters', 'Bosses', 'Ch4', 'Gerson')
OUT = os.path.join(ROOT, 'docs', 'assets')
BD = os.path.join(OUT, 'bullets')
AD = os.path.join(OUT, 'anims', 'gerson')
os.makedirs(BD, exist_ok=True); os.makedirs(AD, exist_ok=True)

def find(name):
    hits = glob.glob(os.path.join(G, '**', name), recursive=True)
    return hits[0] if hits else None

def trim_save(src, dst):
    im = Image.open(src).convert('RGBA')
    bb = im.getbbox()
    if bb: im = im.crop(bb)
    im.save(dst)
    return im.width, im.height

man = json.load(open(os.path.join(OUT, 'manifest.json')))
man.setdefault('bullets', {}); man.setdefault('bullet_cost', {}); man.setdefault('anims', {})

# ---- bullet sprites: id -> source filename ----
BULLETS = {
    'gshell':    'spr_bounce_shell_idle_0.png',
    'ghammer':   'spr_gerson_hammer_trowable2_0.png',
    'ghammerd':  'spr_gerson_red_hammer_0.png',
    'gstar':     'spr_gerson_star_0.png',
    'gstar7':    'spr_gerson_star7_0.png',
    'gcane':     'spr_gerson_cane_0.png',
    'gchevron':  'spr_gerson_chevron_0.png',
    'gbell':     'spr_gerson_bell_0.png',
    'ggiant':    'spr_giant_hammer_0.png',
    'gswdown':   'spr_gerson_swing_down_0.png',
    'gshield':   'spr_spearblocker_0.png',
}
for bid, fname in BULLETS.items():
    src = find(fname)
    if not src:
        print('MISSING', bid, fname); continue
    w, h = trim_save(src, os.path.join(BD, bid + '.png'))
    man['bullets'][bid] = {'f': bid + '.png', 'w': w, 'h': h}
    man['bullet_cost'][bid] = 1
    print(f'{bid:10} {w}x{h}  <- {fname}')

# ---- boss idle animation (14 frames), cropped to a SHARED union bbox so it doesn't wobble ----
raw = []
for i in range(14):
    src = find(f'spr_gerson_idle_{i}.png')
    if not src: break
    raw.append(Image.open(src).convert('RGBA'))
union = None
for im in raw:
    bb = im.getbbox()
    if not bb: continue
    union = bb if union is None else (min(union[0], bb[0]), min(union[1], bb[1]), max(union[2], bb[2]), max(union[3], bb[3]))
idle_frames, idle_durs = [], []
for i, im in enumerate(raw):
    fn = f'idle_{i}.png'
    im.crop(union).save(os.path.join(AD, fn))
    idle_frames.append(fn); idle_durs.append(90)
print('idle frames:', len(idle_frames), 'union', union)

# reuse idle for every pose the engine may request (boss doesn't do party poses)
pose = {'frames': idle_frames, 'durs': idle_durs}
man['anims']['gerson'] = {p: pose for p in
    ['idle', 'attack', 'spell', 'act', 'defend', 'hurt', 'item', 'victory', 'downed']}

# ---- head icon (26px) for the target menu + HP panel, plus a grayscale (downed) variant ----
UID = os.path.join(OUT, 'ui')
hsrc = find('spr_gerson_headtilt_0.png')
if hsrc:
    im = Image.open(hsrc).convert('RGBA')
    bb = im.getbbox()
    if bb: im = im.crop(bb)
    # fit within 26x26 keeping aspect, bottom-centered
    scale = min(26 / im.width, 26 / im.height, 1.0)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.NEAREST)
    canvas = Image.new('RGBA', (26, 26), (0, 0, 0, 0))
    canvas.paste(im, ((26 - im.width) // 2, (26 - im.height) // 2), im)
    canvas.save(os.path.join(UID, 'head_gerson.png'))
    # grayscale version (desaturate, keep alpha)
    px = canvas.load()
    for y in range(26):
        for x in range(26):
            r, g, b, a = px[x, y]
            l = int(0.3 * r + 0.59 * g + 0.11 * b)
            px[x, y] = (l, l, l, a)
    canvas.save(os.path.join(UID, 'head_gerson_gray.png'))
    print('head_gerson 26x26  <-', os.path.basename(hsrc))

json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=0)
print('done. idle_0 size:', Image.open(os.path.join(AD, 'idle_0.png')).size if idle_frames else 'n/a')
