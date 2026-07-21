"""Rip PINK (Ch5 boss) battle sprites into docs/assets:
 * boss idle animation -> anims/pink/idle_* + manifest.anims.pink
 * bullet sprites (cat/doki/bomb/lane/bell/explosion) -> bullets/ + manifest
 * head icon 26px (+gray)."""
import os, json, glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'NEW RIP', 'Characters', 'Characters', 'Bosses', 'Ch5', 'Pink')
OUT = os.path.join(ROOT, 'docs', 'assets'); BD = os.path.join(OUT, 'bullets'); AD = os.path.join(OUT, 'anims', 'pink'); UID = os.path.join(OUT, 'ui')
os.makedirs(BD, exist_ok=True); os.makedirs(AD, exist_ok=True)

def find(name):
    hits = glob.glob(os.path.join(P, '**', name), recursive=True)
    return hits[0] if hits else None

def trim_save(src, dst):
    im = Image.open(src).convert('RGBA'); bb = im.getbbox()
    if bb: im = im.crop(bb)
    im.save(dst); return im.width, im.height

man = json.load(open(os.path.join(OUT, 'manifest.json')))
man.setdefault('bullets', {}); man.setdefault('bullet_cost', {}); man.setdefault('anims', {})

BULLETS = {
    'pcat':   'spr_bullet_catface_0.png',
    'pdoki':  'spr_dokiheart_0.png',
    'pbomb':  'spr_fusebomb_0.png',
    'plane':  'spr_pinklanebullet_animation_0.png',
    'planeb': 'spr_pinklanebullet_lane_0.png',
    'pbell':  'spr_bullet_roundbell_0.png',
    'pboom':  'spr_fusebomb_explosion_2_0.png',
}
for bid, fn in BULLETS.items():
    src = find(fn)
    if not src: print('MISSING', bid, fn); continue
    w, h = trim_save(src, os.path.join(BD, bid + '.png'))
    man['bullets'][bid] = {'f': bid + '.png', 'w': w, 'h': h}; man['bullet_cost'][bid] = 1
    print(f'{bid:8} {w}x{h}  <- {fn}')

# idle animation (shared union bbox)
raw = []
for i in range(8):
    src = find(f'spr_pink_idle_{i}.png')
    if not src: break
    raw.append(Image.open(src).convert('RGBA'))
union = None
for im in raw:
    bb = im.getbbox()
    if bb: union = bb if union is None else (min(union[0],bb[0]),min(union[1],bb[1]),max(union[2],bb[2]),max(union[3],bb[3]))
frames, durs = [], []
for i, im in enumerate(raw):
    fn = f'idle_{i}.png'; im.crop(union).save(os.path.join(AD, fn)); frames.append(fn); durs.append(120)
pose = {'frames': frames, 'durs': durs}
man['anims']['pink'] = {p: pose for p in ['idle','attack','spell','act','defend','hurt','item','victory','downed']}
print('idle frames:', len(frames), 'union', union)

# head icon
hsrc = find('spr_pink_idle_0.png')
if hsrc:
    im = Image.open(hsrc).convert('RGBA'); bb = im.getbbox()
    if bb: im = im.crop(bb)
    # crop head region (top ~45%), fit 26x26
    im = im.crop((0, 0, im.width, max(1, int(im.height*0.45))))
    sc = min(26/im.width, 26/im.height, 1.0)
    im = im.resize((max(1,round(im.width*sc)), max(1,round(im.height*sc))), Image.NEAREST)
    cv = Image.new('RGBA', (26,26), (0,0,0,0)); cv.paste(im, ((26-im.width)//2,(26-im.height)//2), im)
    cv.save(os.path.join(UID,'head_pink.png'))
    px = cv.load()
    for y in range(26):
        for x in range(26):
            r,g,b,a = px[x,y]; l=int(0.3*r+0.59*g+0.11*b); px[x,y]=(l,l,l,a)
    cv.save(os.path.join(UID,'head_pink_gray.png')); print('head_pink 26x26')

json.dump(man, open(os.path.join(OUT,'manifest.json'),'w'), indent=0)
print('done')
