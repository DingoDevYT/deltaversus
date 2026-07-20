"""Pull authentic attack/projectile sprites from NEW RIP for the party + bosses.
id -> (glob basename, cost tier, max px)"""
import os, glob, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'NEW RIP')
OUT = os.path.join(ROOT, 'docs', 'assets')
BD = os.path.join(OUT, 'bullets')

PICKS = {
    'knife':    ('spr_dkris_dr_knife', 1, 22),        # Kris
    'sparkle':  ('spr_sparkle_shoujo', 0, 14),        # Ralsei
    'healspark':('spr_healsparkle', 0, 14),           # Ralsei
    'bspade':   ('spr_bomb_spade', 1, 22),            # Jevil
    'bdiamond': ('spr_bomb_diamond', 1, 22),
    'bheart':   ('spr_bomb_heart', 1, 22),
    'bclub':    ('spr_bomb_club', 1, 22),
    'scythe':   ('spr_joker_scythebody', 2, 30),      # Jevil ult
    'feather':  ('spr_blue_feather', 1, 20),          # Berdly
    'icehex':   ('spr_icespell_hexagon', 1, 20),      # Noelle / Berdly ice
    'icesnow':  ('spr_icespell_snowflake', 1, 22),
    'tornado':  ('spr_tornado_bullet', 2, 26),        # Berdly
    'spear':    ('spr_spearblast_bullet', 2, 26),     # Berdly laser
    'rudebeam': ('spr_rudebuster_beam', 2, 30),       # Susie
}

def find(base):
    g = [x for x in glob.glob(os.path.join(DUMP, '**', base + '_0.png'), recursive=True) if '/_ch' not in x.replace('\\', '/')]
    if not g:
        g = [x for x in glob.glob(os.path.join(DUMP, '**', base + '.png'), recursive=True) if '/_ch' not in x.replace('\\', '/')]
    if not g:
        g = [x for x in glob.glob(os.path.join(DUMP, '**', base + '_*.png'), recursive=True) if '/_ch' not in x.replace('\\', '/')]
    return sorted(g, key=len)[0] if g else None

manifest = json.load(open(os.path.join(OUT, 'manifest.json')))
manifest.setdefault('bullets', {})
manifest.setdefault('bullet_cost', {})
added, missing = [], []
for bid, (base, tier, mx) in PICKS.items():
    f = find(base)
    if not f:
        missing.append(base); continue
    im = Image.open(f).convert('RGBA')
    m = max(im.width, im.height)
    if m > mx:
        s = mx / m
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)
    im.save(os.path.join(BD, bid + '.png'))
    manifest['bullets'][bid] = {'f': bid + '.png', 'w': im.width, 'h': im.height}
    manifest['bullet_cost'][bid] = tier
    added.append((bid, im.size))

json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'))
print('added', len(added))
for a in added: print('  ', a)
if missing: print('MISSING', missing)
