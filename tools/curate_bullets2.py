"""Add a curated set of authentic bullet sprites from the NEW RIP dump to the
creator's projectile library. Oversized sprites are normalized to bullet scale."""
import os, glob, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'NEW RIP')
OUT = os.path.join(ROOT, 'docs', 'assets')
BD = os.path.join(OUT, 'bullets')

# id -> (gm sprite base name, cost tier)
PICKS = {
    'dice':      ('bullet_dice', 1),
    'umbrella':  ('bullet_umbrella', 2),
    'scissors':  ('scissor_bullet', 2),
    'gflame':    ('bullet_green_flame', 2),
    'ghostfire': ('bullet_ghostfire', 2),
    'egg':       ('bullet_green_egg', 1),
    'carrot':    ('carrotbullet', 1),
    'knife':     ('bullet_knife_break', 1),
    'yarn':      ('yarnbullet', 1),
    'catface':   ('bullet_catface', 1),
    'toebean':   ('bullet_toebean', 0),
    'kdiamond':  ('knight_diamondbullet_m', 1),
    'kstar':     ('knight_bullet_star', 1),
    'ktriangle': ('knight_triangle_bullet', 1),
    'redring':   ('bullet_red_ring', 1),
    'lightning': ('board_lightningbullet_straight', 2),
    'bell':      ('bullet_bellwave', 1),
    'dice4':     ('bullet_dice4pip', 1),
    'umbrella2': ('bullet_yellow_hat', 1),
    'trash':     ('bullet_trash', 1),
    'lamp':      ('lamp_bullet', 1),
    'ring2':     ('bullet_ring', 1),
    'flame_m':   ('incense_fire_bullet', 2),
}

def find_sprite(base):
    for pat in ('spr_%s_0.png', 'spr_%s.png', 'spr_%s_1.png'):
        g = glob.glob(os.path.join(DUMP, '**', pat % base), recursive=True)
        g = [x for x in g if '/_ch' not in x.replace('\\', '/')]
        if g:
            return sorted(g)[0]
    # looser: any frame
    g = glob.glob(os.path.join(DUMP, '**', 'spr_%s_*.png' % base), recursive=True)
    g = [x for x in g if '/_ch' not in x.replace('\\', '/')]
    return sorted(g)[0] if g else None

manifest = json.load(open(os.path.join(OUT, 'manifest.json')))
manifest.setdefault('bullets', {})
added, missing = [], []
MAX = 22
for bid, (base, tier) in PICKS.items():
    f = find_sprite(base)
    if not f:
        missing.append(base); continue
    im = Image.open(f).convert('RGBA')
    m = max(im.width, im.height)
    if m > MAX:
        s = MAX / m
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)
    im.save(os.path.join(BD, bid + '.png'))
    manifest['bullets'][bid] = {'f': bid + '.png', 'w': im.width, 'h': im.height}
    manifest.setdefault('bullet_cost', {})[bid] = tier
    added.append((bid, im.size))

json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'))
print('added', len(added), 'bullets')
for a in added: print('  ', a)
if missing: print('MISSING:', missing)
