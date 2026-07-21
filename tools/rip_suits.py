"""Rip Jevil's REAL suit bullets (spade/heart/club/diamond) from the Suits Bullets folder.
Trims each to its opaque area (so sizes/hitboxes are honest), resizes to a sane max dim,
saves to docs/assets/bullets + updates manifest.json."""
import os, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'NEW RIP', 'Characters', 'Characters', 'Enemies', 'Ch1', '# Suits Bullets')
OUT = os.path.join(ROOT, 'docs', 'assets'); BD = os.path.join(OUT, 'bullets')

# id -> (source file, max dimension)
PICKS = {
    'suitspade':    ('spr_spadebullet_0.png',        20),
    'suitheart':    ('spr_heartbullet_0.png',        18),
    'suitclub':     ('spr_clubsbullet_0.png',        20),
    'suitclubball': ('spr_clubsball_a_0.png',        14),
    'suitdiamond':  ('spr_diamondbullet_0.png',      20),   # wide diamond
    'suitdiamondv': ('spr_diamondbullet_vert_0.png', 24),   # tall diamond (upward shower)
}

manifest = json.load(open(os.path.join(OUT, 'manifest.json')))
manifest.setdefault('bullets', {}); manifest.setdefault('bullet_cost', {})
done = []
for bid, (fn, mx) in PICKS.items():
    im = Image.open(os.path.join(SRC, fn)).convert('RGBA')
    bb = im.getbbox()
    if bb: im = im.crop(bb)                        # trim transparent padding
    m = max(im.width, im.height)
    if m > mx:
        s = mx / m
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)
    im.save(os.path.join(BD, bid + '.png'))
    manifest['bullets'][bid] = {'f': bid + '.png', 'w': im.width, 'h': im.height}
    manifest['bullet_cost'][bid] = 1
    done.append((bid, im.size))

json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=0)
for d in done: print(' ', d)
