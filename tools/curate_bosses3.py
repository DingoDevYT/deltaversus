"""Accurate rebuild: layered animated Spamton NEO puppet, Knight slosh idle,
and the REAL attack bullet sprites for both."""
import glob, os, json, shutil
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

def fit(im, mx):
    m = max(im.width, im.height)
    if m <= mx: return im
    s = mx / m
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)

def gray(im):
    g = im.convert('L').convert('RGBA'); g.putalpha(im.getchannel('A')); return g

manifest = json.load(open(os.path.join(OUT, 'manifest.json')))
manifest.setdefault('anims', {}); manifest.setdefault('bullets', {}); manifest.setdefault('bullet_cost', {})
anim_dir = os.path.join(OUT, 'anims')

# ---------- SPAMTON NEO: layered marionette (parts share an 82x89 canvas) ----------
parts = {n: load('spr_sneo_' + n + '.png') for n in ['body_0', 'armr_0', 'legl_0', 'legr_0', 'wingl_0', 'wingr_0']}
arml = [load('spr_sneo_arml_%d.png' % i) for i in range(5)]
head = [load('spr_sneo_head_%d.png' % i) for i in range(4)]
sp_dir = os.path.join(anim_dir, 'spamton'); shutil.rmtree(sp_dir, ignore_errors=True); os.makedirs(sp_dir)
def layer(base, im):
    return Image.alpha_composite(base, im) if im else base
sp_frames = []
for i in range(5):
    c = Image.new('RGBA', (82, 89), (0, 0, 0, 0))
    for n in ['wingl_0', 'wingr_0', 'legl_0', 'legr_0', 'body_0', 'armr_0']:
        c = layer(c, parts[n])
    c = layer(c, arml[i % len(arml)])
    c = layer(c, head[i % len(head)])
    c = c.crop(c.getbbox()); c = fit(c, 78)
    c.save(os.path.join(sp_dir, 'idle_%d.png' % i)); sp_frames.append('idle_%d.png' % i)
manifest['anims']['spamton'] = {'idle': {'frames': sp_frames, 'durs': [90] * len(sp_frames)}}

# ---------- ROARING KNIGHT: 12-frame slosh idle (bobbing) ----------
kn_dir = os.path.join(anim_dir, 'knight'); shutil.rmtree(kn_dir, ignore_errors=True); os.makedirs(kn_dir)
kn_frames = []
for i in range(12):
    im = load('spr_roaringknight_slosh_%d.png' % i)
    if not im: break
    im = fit(im, 92)
    im.save(os.path.join(kn_dir, 'idle_%d.png' % i)); kn_frames.append('idle_%d.png' % i)
manifest['anims']['knight'] = {'idle': {'frames': kn_frames, 'durs': [70] * len(kn_frames)}}

# ---------- head icons ----------
def head_icon(im, dst):
    im = im.crop(im.getbbox()); s = 26 / max(im.width, im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)
    c = Image.new('RGBA', (26, 26), (0, 0, 0, 0)); c.paste(im, ((26 - im.width) // 2, (26 - im.height) // 2), im)
    c.save(os.path.join(OUT, 'ui', dst)); gray(c).save(os.path.join(OUT, 'ui', dst.replace('.png', '_gray.png')))
head_icon(load('spr_sneo_head_0.png'), 'head_spamton.png')
head_icon(load('spr_roaringknight_slosh_0.png'), 'head_knight.png')

# ---------- REAL attack bullet sprites ----------
BULLETS = {
    'sneohead':  ('spr_sneo_head_0.png', 1, 22),          # Flying Heads
    'sneowire':  ('spr_sneo_wireheart_0.png', 2, 30),     # Heart Attack container
    'sneomail':  ('spr_sneo_mail_0.png', 1, 20),          # Spam Mail
    'sneosound': ('spr_sneo_soundbullet_0.png', 1, 22),   # Word/soundwave bullets
    'sneobig':   ('spr_sneo_bullet1_0.png', 2, 28),       # Big Shot arm-cannon bullet
    'knightsword': ('spr_knight_diamondswordbullet_0.png', 1, 24),  # Sword Corridor
    'knighttri':   ('spr_knight_triangle_bullet_0.png', 1, 16),     # triangle shards
    'knightstar':  ('spr_knight_bullet_star_0.png', 1, 22),         # Star Barrage
}
added = []
for bid, (name, tier, mx) in BULLETS.items():
    im = load(name)
    if not im: print('MISSING', name); continue
    im = fit(im, mx)
    im.save(os.path.join(OUT, 'bullets', bid + '.png'))
    manifest['bullets'][bid] = {'f': bid + '.png', 'w': im.width, 'h': im.height}
    manifest['bullet_cost'][bid] = tier
    added.append((bid, im.size))

json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'))
print('spamton frames', len(sp_frames), '| knight frames', len(kn_frames))
print('bullets', added)
