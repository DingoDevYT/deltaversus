"""Pull Berdly + Jevil battle animations + head icons from the dump."""
import os, glob, re, json, shutil
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'NEW RIP')
CC = os.path.join(DUMP, 'Characters', 'Characters')
OUT = os.path.join(ROOT, 'docs', 'assets')
ANIMS = os.path.join(OUT, 'anims')
UI = os.path.join(OUT, 'ui')
DUR = {'idle': 150, 'attack': 90, 'act': 120, 'spell': 100, 'hurt': 120,
       'item': 130, 'victory': 130, 'downed': 200, 'defend': 120}


def save_group(ch, pose, files):
    if not files:
        return None
    d = os.path.join(ANIMS, ch)
    os.makedirs(d, exist_ok=True)
    entry = {'frames': [], 'durs': []}
    for i, f in enumerate(files):
        fn = '%s_%d.png' % (pose, i)
        Image.open(f).convert('RGBA').save(os.path.join(d, fn))
        entry['frames'].append(fn); entry['durs'].append(DUR.get(pose, 120))
    return entry


def g(root, name):
    return sorted(glob.glob(os.path.join(root, '**', name), recursive=True),
                  key=lambda p: (len(p), p))


def num_sorted(root, base):
    pat = re.compile(re.escape(base) + r'_(\d+)\.png$')
    out = []
    for f in glob.glob(os.path.join(root, '**', base + '_*.png'), recursive=True):
        if '/_ch' in f.replace('\\', '/'):
            continue
        m = pat.search(os.path.basename(f))
        if m:
            out.append((int(m.group(1)), f))
    out.sort()
    return [f for _, f in out]


manifest = json.load(open(os.path.join(OUT, 'manifest.json')))
anims = manifest['anims']

# ---- Berdly ----
BROOT = os.path.join(CC, 'NPCs', 'Light World', 'Berdly', 'Ch2')
anims['berdly'] = {}
for pose, tok in [('idle', 'spr_berdlyb_idle'), ('attack', 'spr_berdlyb_attack'),
                  ('act', 'spr_berdlyb_act'), ('spell', 'spr_berdlyb_spell'),
                  ('hurt', 'spr_berdlyb_hurt'), ('item', 'spr_berdlyb_item'),
                  ('defend', 'spr_berdlyb_defend'), ('victory', 'spr_berdlyb_victory'),
                  ('downed', 'spr_berdlyb_defeat')]:
    e = save_group('berdly', pose, num_sorted(BROOT, tok))
    if e:
        anims['berdly'][pose] = e
print('berdly', {k: len(v['frames']) for k, v in anims['berdly'].items()})

# ---- Jevil ----
JROOT = os.path.join(CC, 'Bosses', 'Ch1', 'Jevil')
anims['jevil'] = {}
jmap = [('idle', 'spr_joker_main'), ('spell', 'spr_joker_dance'),
        ('attack', 'spr_joker_dance'), ('act', 'spr_joker_dance'),
        ('hurt', 'spr_joker_tired'), ('downed', 'spr_joker_tired')]
for pose, base in jmap:
    e = save_group('jevil', pose, num_sorted(JROOT, base))
    if e:
        anims['jevil'][pose] = e
print('jevil', {k: len(v['frames']) for k, v in anims['jevil'].items()})


# ---- head icons ----
def make_head(ch, src, top=True):
    im = Image.open(src).convert('RGBA')
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 0)
    if len(xs) == 0:
        return
    x0, x1 = xs.min(), xs.max()
    y0 = ys.min()
    h = min(im.height, y0 + int((x1 - x0) * 0.9))
    crop = im.crop((x0, y0, x1 + 1, h))
    s = min(24 / crop.width, 24 / crop.height)
    crop = crop.resize((max(1, int(crop.width * s)), max(1, int(crop.height * s))), Image.NEAREST)
    canvas = Image.new('RGBA', (26, 26))
    canvas.paste(crop, ((26 - crop.width) // 2, (26 - crop.height) // 2), crop)
    canvas.save(os.path.join(UI, 'head_%s.png' % ch))
    canvas.save(os.path.join(UI, 'head_%s_gray.png' % ch))

bhead = num_sorted(BROOT, 'spr_berdlyb_idle')
if bhead:
    make_head('berdly', bhead[0])
jhead = g(JROOT, 'spr_jokerhead_0.png') or num_sorted(JROOT, 'spr_joker_main')
if jhead:
    make_head('jevil', jhead[0])
print('heads: berdly, jevil')

manifest['anims'] = anims
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'))
