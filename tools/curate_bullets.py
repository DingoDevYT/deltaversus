"""Bullet sprite library: Landon's ATTACKS sprites (cropped), a few generated
pixel-art bullets, and the best existing rips. -> docs/assets/bullets/ + manifest."""
import os, json
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'ATTACKS')
OUT = os.path.join(ROOT, 'docs', 'assets')
BD = os.path.join(OUT, 'bullets')
os.makedirs(BD, exist_ok=True)

def crop_content(im):
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 0)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

bullets = {}
def put(bid, im):
    im.save(os.path.join(BD, bid + '.png'))
    bullets[bid] = {'f': bid + '.png', 'w': im.width, 'h': im.height}

# --- Landon's sprites ---
LANDON = {'sword': 1, 'axe': 2, 'flame': 3, 'spark': 4,
          'orb_s': 5, 'orb_m': 6, 'orb_l': 7}
for bid, n in LANDON.items():
    im = Image.open(os.path.join(SRC, f'Layer 1_sprite_{n}.png')).convert('RGBA')
    put(bid, crop_content(im))

# --- generated pixel bullets (white, chunky, hand-plotted) ---
W = (255, 255, 255, 255)
def px(im, pts):
    d = im.load()
    for x, y in pts: d[x, y] = W

# diamond 11x11
im = Image.new('RGBA', (11, 11))
pts = []
for y in range(11):
    r = 5 - abs(y - 5)
    for x in range(5 - r, 6 + r): pts.append((x, y))
px(im, pts); put('diamond', im)

# ring 13x13 (2px wall)
im = Image.new('RGBA', (13, 13)); d = ImageDraw.Draw(im)
d.ellipse([0, 0, 12, 12], outline=W, width=2)
put('ring', im)

# dart 15x7 (arrowhead pointing right)
im = Image.new('RGBA', (15, 7))
pts = []
for x in range(15):
    h = 3 if x > 9 else (2 if x > 4 else 1)
    if x > 9: h = 3 - (x - 10) * 0  # solid head
for y in range(7):
    for x in range(15):
        if x < 9 and y == 3: pts.append((x, y))
        if x >= 9 and abs(y - 3) <= (14 - x) // 2: pts.append((x, y))
px(im, pts); put('dart', im)

# shuriken 13x13 (4-point spinner)
im = Image.new('RGBA', (13, 13))
pts = []
for i in range(6):
    pts += [(6, i), (12 - i, 6), (6, 12 - i), (i, 6)]
for i in range(3):
    pts += [(5, i), (7, 12 - i), (i, 7), (12 - i, 5)]
px(im, pts); put('shuriken', im)

# bone 16x6 (undertale homage, white)
im = Image.new('RGBA', (16, 6)); d = ImageDraw.Draw(im)
d.rectangle([2, 2, 13, 3], fill=W)
for cx in (1, 14):
    d.ellipse([cx - 1, 0, cx + 1, 2], fill=W)
    d.ellipse([cx - 1, 3, cx + 1, 5], fill=W)
put('bone', im)

# --- best rips already in docs/assets/chars ---
man = json.load(open(os.path.join(OUT, 'manifest.json')))
RIPS = {
    'spade': ('lancer', 'spade_white', 0),
    'spade_pink': ('lancer', 'spade_pink', 1),
    'icicle': ('noelle', 'icicle', 0),
    'snowflake': ('noelle', 'snowflake', 0),
    'shard': ('noelle', 'shard', 0),
    'arc': ('susie', 'arc', 4),       # purple arc
    'arc_red': ('susie', 'arc', 10),
    'bigslash': ('susie', 'bigslash', 0),
}
for bid, (ch, grp, i) in RIPS.items():
    files = man['chars'][ch][grp]
    im = Image.open(os.path.join(OUT, 'chars', ch, files[min(i, len(files) - 1)]))
    put(bid, im.convert('RGBA'))

man['bullets'] = bullets
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'))
print('bullets:', sorted(bullets))
