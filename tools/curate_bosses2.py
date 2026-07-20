"""Rip Spamton NEO + The Roaring Knight battle sprites, head icons and bullets."""
import glob, os, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'NEW RIP', 'Characters', 'Characters', 'Bosses')
OUT = os.path.join(ROOT, 'docs', 'assets')

def find(name):
    g = [x for x in glob.glob(os.path.join(DUMP, '**', name), recursive=True)
         if '_ch' not in x.replace('\\', '/').split('/')[-1]]
    return sorted(g, key=len)[0] if g else None

def load(name):
    p = find(name); return Image.open(p).convert('RGBA') if p else None

def fit(im, h):
    s = h / im.height
    return im.resize((max(1, round(im.width * s)), h), Image.NEAREST)

def gray(im):
    g = im.convert('L').convert('RGBA')
    # keep alpha
    g.putalpha(im.getchannel('A'))
    return g

# ---- battle idle anims ----
anim_dir = os.path.join(OUT, 'anims')
manifest = json.load(open(os.path.join(OUT, 'manifest.json')))
manifest.setdefault('anims', {}); manifest.setdefault('bullets', {}); manifest.setdefault('bullet_cost', {})

# Spamton NEO = body + head composited
body = load('spr_sneo_body_0.png'); head = load('spr_sneo_head_0.png')
sneo = Image.alpha_composite(body, head) if (body and head) else (body or head)
sneo = fit(sneo, 74)
os.makedirs(os.path.join(anim_dir, 'spamton'), exist_ok=True)
sneo.save(os.path.join(anim_dir, 'spamton', 'idle_0.png'))
manifest['anims']['spamton'] = {'idle': {'frames': ['idle_0.png'], 'durs': [400]}}

# Knight = clash silhouette
kn = load('spr_roaring_knight_clash_0.png') or load('spr_roaring_knight_static_0.png')
kn = fit(kn, 78)
os.makedirs(os.path.join(anim_dir, 'knight'), exist_ok=True)
kn.save(os.path.join(anim_dir, 'knight', 'idle_0.png'))
manifest['anims']['knight'] = {'idle': {'frames': ['idle_0.png'], 'durs': [400]}}

# ---- head icons (26x26) ----
def head_icon(im, dst):
    im = im.crop(im.getbbox())
    s = 26 / max(im.width, im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)
    c = Image.new('RGBA', (26, 26), (0, 0, 0, 0))
    c.paste(im, ((26 - im.width) // 2, (26 - im.height) // 2), im)
    c.save(os.path.join(OUT, 'ui', dst))
    gray(c).save(os.path.join(OUT, 'ui', dst.replace('.png', '_gray.png')))

head_icon(load('spr_sneo_head_0.png'), 'head_spamton.png')
head_icon(load('spr_roaring_knight_clash_0.png') or kn, 'head_knight.png')

# ---- bullets ----
BULLETS = {
    'sneoheart': ('spr_neo_heart_bullet_0.png', 1, 18),
    'sneolaser': ('spr_bullet_laser_front_sneo_0.png', 2, 24),
    'knightcross': ('spr_bullet_knightcrescent_0.png', 1, 22),
    'knightstar': ('spr_knight_bullet_star_0.png', 1, 20),
}
added = []
for bid, (name, tier, mx) in BULLETS.items():
    im = load(name)
    if not im: print('MISSING', name); continue
    m = max(im.width, im.height)
    if m > mx:
        s = mx / m; im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)
    im.save(os.path.join(OUT, 'bullets', bid + '.png'))
    manifest['bullets'][bid] = {'f': bid + '.png', 'w': im.width, 'h': im.height}
    manifest['bullet_cost'][bid] = tier
    added.append((bid, im.size))

json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'))
print('spamton idle', sneo.size, '| knight idle', kn.size)
print('bullets', added)
