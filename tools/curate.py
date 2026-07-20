"""Copy curated sprites from work/ into docs/assets/, bake font atlases,
copy backgrounds, write manifest.json with frame lists."""
import os, json, shutil, glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, 'work')
OUT = os.path.join(ROOT, 'docs', 'assets')

CHARS = {
    'kris': {
        'idle': [19, 20, 21, 22], 'attack': [25, 26, 27, 28, 29],
        'slash': [23, 24], 'prepare': [33, 34], 'hurt': [35], 'downed': [36],
        'act': [38, 42], 'item': [50, 51, 52], 'defend': [61, 62, 63],
        'victory': [66, 67],
    },
    'susie': {
        'idle': [101, 102, 103, 104], 'attack': [115, 116, 171, 172, 173],
        'bigslash': [175, 176], 'hurt': [109], 'downed': [28],
        'act': [128, 129], 'defend': [125, 126, 127],
        'arc': [157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170],
    },
    'ralsei': {
        'idle': [19, 20, 21, 22], 'cast': [10, 11], 'sparkle': [17, 18],
        'act': [36, 37, 38, 39], 'attack': [40, 41, 42, 43], 'slash': [44],
        'scarf': [45, 46, 47], 'defend': [31, 32, 33, 34], 'item': [60, 61],
        'hurt': [69], 'downed': [70], 'sing': [72, 73],
    },
    'noelle': {
        'idle': [84, 85, 86, 87, 88, 89], 'cast': [12, 13, 14, 15],
        'act': [57, 58], 'nervous': [68, 69, 70, 71],
        'icicle': [79, 80, 82], 'shard': [81], 'snowflake': [146],
        'mist': [147], 'orb': [142, 144, 145],
        'sparkle': [131, 136, 137, 138, 148, 149], 'hand': [8],
        'hurt': [98], 'downed': [99, 100], 'item': [72, 73],
    },
    'lancer': {
        'idle': [0, 41], 'laugh': [29, 31, 33, 35], 'throw': [39],
        'hurt': [60], 'spin': [62, 63, 64, 65, 66, 67],
        'bike': [74, 77, 87], 'spade_white': [70, 72, 86],
        'spade_pink': [78, 79, 80], 'hood': [57, 58],
    },
}
BTN = {'btn_y': ([0, 1, 2, 3, 5, 6], ''), 'btn_o': ([0, 1, 2, 4, 5, 6], '_sel')}
BTN_NAMES = ['fight', 'act', 'item', 'spare', 'defend', 'magic']
FONTS = {
    'main': 'main (8bitoperator JVE)',
    'big': 'mainbig (8bitoperator JVE)',
}
FDIR = os.path.join(ROOT, 'assets',
    'PC _ Computer - Deltarune - User Interface - Fonts', 'Deltarune', 'Fonts', 'English')
BGDIR = os.path.join(ROOT, 'assets',
    'PC _ Computer - Deltarune - User Interface - Battle Background')

manifest = {'chars': {}, 'fonts': {}, 'bg_frames': 0}

for ch, groups in CHARS.items():
    d = os.path.join(OUT, 'chars', ch)
    os.makedirs(d, exist_ok=True)
    manifest['chars'][ch] = {}
    for g, idxs in groups.items():
        names = []
        for n, i in enumerate(idxs):
            src = os.path.join(W, ch, f'{i:03d}.png')
            dst = f'{g}{n}.png'
            shutil.copy(src, os.path.join(d, dst))
            names.append(dst)
        manifest['chars'][ch][g] = names

ud = os.path.join(OUT, 'ui')
os.makedirs(ud, exist_ok=True)
for wd, (idxs, suf) in BTN.items():
    for n, i in enumerate(idxs):
        shutil.copy(os.path.join(W, wd, f'{i:03d}.png'),
                    os.path.join(ud, f'btn_{BTN_NAMES[n]}{suf}.png'))
shutil.copy(os.path.join(W, 'soul', '001.png'), os.path.join(ud, 'soul.png'))

# font atlases
for key, folder in FONTS.items():
    gd = os.path.join(FDIR, folder)
    glyphs = {}
    ims = {}
    h = 0
    for f in sorted(glob.glob(os.path.join(gd, '*.png'))):
        cp = int(os.path.basename(f)[:5])
        im = Image.open(f).convert('RGBA')
        ims[cp] = im
        h = max(h, im.height)
    x = 0
    total_w = sum(im.width + 1 for im in ims.values())
    atlas = Image.new('RGBA', (total_w, h))
    for cp, im in sorted(ims.items()):
        atlas.paste(im, (x, 0))
        glyphs[cp] = {'x': x, 'w': im.width}
        x += im.width + 1
    atlas.save(os.path.join(ud, f'font_{key}.png'))
    manifest['fonts'][key] = {'h': h, 'glyphs': glyphs}

# battle background frames (all BBS_n.png, natural order)
bd = os.path.join(OUT, 'bg')
os.makedirs(bd, exist_ok=True)
n = 0
while True:
    src = os.path.join(BGDIR, f'BBS_{n + 1}.png')
    if not os.path.exists(src):
        break
    shutil.copy(src, os.path.join(bd, f'{n}.png'))
    n += 1
manifest['bg_frames'] = n

json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'))
sizes = {}
print('done:', sum(len(v) for v in manifest['chars'].values()), 'char groups,',
      n, 'bg frames, fonts:', {k: len(v['glyphs']) for k, v in manifest['fonts'].items()})
