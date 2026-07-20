"""Build docs/assets/anims/ from wiki battle sprites (GIF frames + durations).
Falls back to legacy segmented sprites (upscaled 2x) for missing poses."""
import os, json, glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIKI = os.path.join(ROOT, 'assets', 'wiki')
OUT = os.path.join(ROOT, 'docs', 'assets')
ANIMS = os.path.join(OUT, 'anims')

# pose -> wiki filename (no extension logic; exact names)
POSES = {
    'kris': {
        'idle': 'Kris battle idle.gif', 'attack': 'Kris battle attack.gif',
        'hurt': 'Kris battle hurt.png', 'act': 'Kris battle act.gif',
        'item': 'Kris battle item.gif', 'guard': 'Kris battle guard.gif',
        'victory': 'Kris battle victory.gif', 'intro': 'Kris battle intro.gif',
        'spell': 'Kris battle attack.gif',
    },
    'susie': {
        'idle': 'Susie battle idle.gif', 'attack': 'Susie battle attack.gif',
        'hurt': 'Susie battle hurt.png', 'downed': 'Susie battle defeat.png',
        'act': 'Susie battle act.gif', 'item': 'Susie battle item.gif',
        'guard': 'Susie battle guard.gif', 'spell': 'Susie battle spell.gif',
        'rudebuster': 'Susie battle rudebuster.gif',
        'victory': 'Susie battle victory.gif',
    },
    'ralsei': {
        'idle': 'Ralsei battle idle.gif', 'attack': 'Ralsei battle attack.gif',
        'hurt': 'Ralsei battle shocked.png', 'downed': 'Ralsei battle down.png',
        'act': 'Ralsei battle clapping.gif', 'item': 'Ralsei battle item.gif',
        'guard': 'Ralsei battle guard.gif', 'spell': 'Ralsei battle spell.gif',
        'pacify': 'Ralsei battle pacify.gif',
        'victory': 'Ralsei battle victory.gif',
    },
    'noelle': {
        'idle': 'Noelle battle idle.gif', 'attack': 'Noelle battle attack.gif',
        'hurt': 'Noelle battle hurt.png', 'downed': 'Noelle battle down.png',
        'act': 'Noelle battle act.gif', 'item': 'Noelle battle item.gif',
        'guard': 'Noelle battle defend.png', 'spell': 'Noelle battle spell.gif',
        'snowgrave': 'Noelle battle SnowGrave.gif',
        'victory': 'Noelle battle victory.gif', 'scared': 'Noelle battle scared.png',
    },
    'lancer': {
        'idle': 'Lancer battle idle.png', 'hurt': 'Lancer battle hurt.png',
        'bike': 'Lancer battle bike.gif',
    },
}
# legacy fallbacks: pose -> (workdir group frames)  [drawn from docs/assets/chars]
LEGACY = {
    'kris':   {'downed': 'downed'},
    'lancer': {'attack': 'spin', 'act': 'laugh', 'guard': 'hood',
               'downed': 'hurt', 'spell': 'throw', 'item': 'idle',
               'victory': 'laugh'},
    'ralsei': {},
    'susie':  {},
    'noelle': {},
}

man_path = os.path.join(OUT, 'manifest.json')
man = json.load(open(man_path))
anims = {}

def gif_frames(path):
    im = Image.open(path)
    n = getattr(im, 'n_frames', 1)
    frames = []
    for i in range(n):
        im.seek(i)
        dur = im.info.get('duration', 100) or 100
        frames.append((im.convert('RGBA'), int(dur)))
    return frames

for ch, poses in POSES.items():
    d = os.path.join(ANIMS, ch)
    os.makedirs(d, exist_ok=True)
    anims[ch] = {}
    for pose, fname in poses.items():
        src = os.path.join(WIKI, fname)
        if not os.path.exists(src):
            print('MISSING', ch, pose, fname); continue
        frames = gif_frames(src)
        entry = {'frames': [], 'durs': []}
        for i, (im, dur) in enumerate(frames):
            fn = f'{pose}_{i}.png'
            im.save(os.path.join(d, fn))
            entry['frames'].append(fn)
            entry['durs'].append(dur)
        anims[ch][pose] = entry
    # legacy fallbacks, upscaled 2x so everything draws at scale 1
    for pose, group in LEGACY.get(ch, {}).items():
        if pose in anims[ch]: continue
        srcs = man['chars'][ch].get(group, [])
        entry = {'frames': [], 'durs': []}
        for i, f in enumerate(srcs):
            im = Image.open(os.path.join(OUT, 'chars', ch, f)).convert('RGBA')
            im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
            fn = f'{pose}_{i}.png'
            im.save(os.path.join(d, fn))
            entry['frames'].append(fn)
            entry['durs'].append(140)
        if entry['frames']:
            anims[ch][pose] = entry
    print(ch, ':', sorted(anims[ch]))

man['anims'] = anims
json.dump(man, open(man_path, 'w'))
total = sum(len(e['frames']) for c in anims.values() for e in c.values())
print('total frames:', total)
