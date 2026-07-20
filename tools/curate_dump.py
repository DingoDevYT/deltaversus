"""Rebuild character animations + core battle UI from the NEW RIP dump.
Sprites are perfectly sliced individual frames named by GameMaker id, so we
match by name pattern spr_<prefix>_<pose>_<N>.png (exact token, skip _chN)."""
import os, re, glob, json, shutil
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'NEW RIP')
CC = os.path.join(DUMP, 'Characters', 'Characters')
PLAY = os.path.join(CC, 'Playable Characters')
OUT = os.path.join(ROOT, 'docs', 'assets')
ANIMS = os.path.join(OUT, 'anims')
UI = os.path.join(OUT, 'ui')

# char -> (root folder, battle-sprite prefix, special)
CHARS = {
    'kris':   (os.path.join(PLAY, 'Kris'), 'krisb', None),
    'susie':  (os.path.join(PLAY, 'Susie'), 'susieb', None),
    'ralsei': (os.path.join(PLAY, 'Ralsei'), 'ralseib', None),
    'noelle': (os.path.join(PLAY, 'Noelle'), 'noelleb', None),
    'lancer': (os.path.join(CC, 'NPCs', 'Dark World', 'Ch1', 'Lancer'), 'lancer', 'bike'),
}
# our pose -> GameMaker token(s), first that yields frames wins
POSES = {
    'idle': ['idle'], 'attack': ['attack'], 'act': ['act'], 'defend': ['defend'],
    'hurt': ['hurt'], 'item': ['item'], 'spell': ['spell', 'magic'],
    'victory': ['victory'], 'intro': ['intro'], 'downed': ['defeat', 'down'],
}
DUR = {'idle': 150, 'attack': 90, 'act': 120, 'defend': 120, 'hurt': 120,
       'item': 130, 'spell': 100, 'victory': 130, 'intro': 110, 'downed': 200}
CHAPS = ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5']


def is_ch_variant(path):
    p = path.replace('\\', '/')
    return '/_ch' in p              # skip the chapter-specific _chN subfolders


def match_frames(rootdir, prefix, token):
    pat = re.compile(r'spr_%s_%s_(\d+)\.png$' % (re.escape(prefix), re.escape(token)))
    out = []
    for f in glob.glob(rootdir + '/**/*.png', recursive=True):
        if is_ch_variant(f):
            continue
        m = pat.match(os.path.basename(f))
        if m:
            out.append((int(m.group(1)), f))
    out.sort()
    return [f for _, f in out]


def pick_chapter(charroot, prefix):
    # earliest chapter whose subtree contains this char's battle idle frames
    for ch in CHAPS:
        base = os.path.join(charroot, ch)
        if os.path.isdir(base) and match_frames(base, prefix, 'idle'):
            return base
    return charroot


manifest = json.load(open(os.path.join(OUT, 'manifest.json')))
anims = {}

for ch, (charroot, prefix, special) in CHARS.items():
    d = os.path.join(ANIMS, ch)
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d, exist_ok=True)
    anims[ch] = {}

    if special == 'bike':
        # Lancer: only bike sprites; idle=bike, hurt/downed=bike_hurt
        base = os.path.join(charroot, 'Ch1', 'Battle')
        groups = {
            'idle': sorted(glob.glob(base + '/spr_lancerbike_[0-9].png')),
            'hurt': sorted(glob.glob(base + '/spr_lancerbike_hurt_[0-9].png')),
        }
        groups['downed'] = groups['hurt']
        for pose, files in groups.items():
            if not files:
                continue
            entry = {'frames': [], 'durs': []}
            for i, f in enumerate(files):
                fn = '%s_%d.png' % (pose, i)
                Image.open(f).convert('RGBA').save(os.path.join(d, fn))
                entry['frames'].append(fn); entry['durs'].append(DUR[pose])
            anims[ch][pose] = entry
        print(ch, sorted(anims[ch]), '(bike)')
        continue

    base = pick_chapter(charroot, prefix)
    for pose, tokens in POSES.items():
        files = []
        for tok in tokens:
            files = match_frames(base, prefix, tok)
            if files:
                break
        if not files:
            continue
        entry = {'frames': [], 'durs': []}
        for i, f in enumerate(files):
            fn = '%s_%d.png' % (pose, i)
            Image.open(f).convert('RGBA').save(os.path.join(d, fn))
            entry['frames'].append(fn); entry['durs'].append(DUR[pose])
        anims[ch][pose] = entry
    print(ch, base.replace(DUMP, '...'), '->', {k: len(v['frames']) for k, v in anims[ch].items()})

manifest['anims'] = anims

# ---- core UI: soul + command buttons ----
def firstglob(*pats):
    for p in pats:
        g = sorted(glob.glob(p))
        if g:
            return g[0]
    return None

soul = firstglob(os.path.join(DUMP, '**', 'spr_dodgeheart_0.png'),
                 os.path.join(DUMP, '**', 'spr_board_heart_0.png'))
if soul:
    Image.open(soul).convert('RGBA').save(os.path.join(UI, 'soul.png'))
    print('soul <-', os.path.basename(soul), Image.open(soul).size)

BTN = {'fight': 'btfight', 'act': 'btact', 'item': 'btitem',
       'defend': 'btdefend', 'magic': 'bttech'}
btndir = os.path.join(DUMP, 'UI', 'Battle', 'Buttons', 'Ch1')
for name, gm in BTN.items():
    n0 = firstglob(os.path.join(btndir, 'spr_%s_0.png' % gm))
    n1 = firstglob(os.path.join(btndir, 'spr_%s_1.png' % gm))
    if n0:
        Image.open(n0).convert('RGBA').save(os.path.join(UI, 'btn_%s.png' % name))
    if n1:
        Image.open(n1).convert('RGBA').save(os.path.join(UI, 'btn_%s_sel.png' % name))
print('buttons:', [k for k in BTN])

json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'))
total = sum(len(e['frames']) for c in anims.values() for e in c.values())
print('total anim frames:', total)
