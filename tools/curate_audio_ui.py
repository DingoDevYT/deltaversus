"""Second-pass curation: head icons, SFX picks, music (slugified), manifest update."""
import os, json, shutil, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'assets')
OUT = os.path.join(ROOT, 'docs', 'assets')
MENU_SHEET = os.path.join(A, 'PC _ Computer - Deltarune - User Interface - Battle Menu.png')

# --- head icons (colored col of the head grid) + gray variants ---
HEADS = {
    'kris':   [(1216, 357, 1242, 383), (1182, 357, 1209, 383)],
    'ralsei': [(1216, 384, 1242, 411), (1182, 384, 1209, 411)],
    'susie':  [(1216, 412, 1242, 438), (1182, 412, 1209, 438)],
    'noelle': [(1216, 438, 1242, 464), (1182, 438, 1209, 464)],
}
sheet = Image.open(MENU_SHEET).convert('RGBA')
ud = os.path.join(OUT, 'ui')
import numpy as np
def key_blue(im):
    a = np.array(im)
    for bg in [(0, 38, 255, 255), (0, 148, 255, 255)]:
        a[(a == np.array(bg, np.uint8)).all(axis=2)] = 0
    return Image.fromarray(a)
for ch, (cbox, gbox) in HEADS.items():
    key_blue(sheet.crop(cbox)).save(os.path.join(ud, f'head_{ch}.png'))
    key_blue(sheet.crop(gbox)).save(os.path.join(ud, f'head_{ch}_gray.png'))
# lancer head from his idle battle sprite
lan = Image.open(os.path.join(ROOT, 'work', 'lancer', '000.png')).convert('RGBA')
head = lan.crop((0, 0, lan.width, min(20, lan.height)))
canvas = Image.new('RGBA', (26, 26))
canvas.paste(head, ((26 - head.width) // 2, max(0, (26 - head.height) // 2)), head)
canvas.save(os.path.join(ud, 'head_lancer.png'))
canvas.save(os.path.join(ud, 'head_lancer_gray.png'))

# --- sfx picks ---
S = os.path.join(A, 'SFX', 'sound')
COMMON = os.path.join(S, 'PC _ Computer - Deltarune - Miscellaneous - Common Sound Effects', 'Sound Effects (Common)')
CH2 = os.path.join(S, 'PC _ Computer - Deltarune - Miscellaneous - Sound Effects (Chapter 2)', 'Sound Effects (Chapter 2)')
SFX = {
    'menumove': (COMMON, 'snd_menumove.wav'),
    'select': (COMMON, 'snd_select.wav'),
    'cantselect': (COMMON, 'snd_cantselect.wav'),
    'damage': (COMMON, 'snd_damage.wav'),
    'hurt': (COMMON, 'snd_hurt1.wav'),
    'graze': (COMMON, 'snd_graze.wav'),
    'swing': (COMMON, 'snd_swing.wav'),
    'smallswing': (COMMON, 'snd_smallswing.wav'),
    'heavyswing': (COMMON, 'snd_heavyswing.wav'),
    'criticalswing': (COMMON, 'snd_criticalswing.wav'),
    'bell': (COMMON, 'snd_bell.wav'),
    'spellcast': (COMMON, 'snd_spellcast.wav'),
    'rudebuster': (COMMON, 'snd_rudebuster_swing.wav'),
    'icespell': (CH2, 'snd_icespell.ogg'),
    'snowgrave': (CH2, 'snd_snowgrave.ogg'),
    'pacify': (CH2, 'snd_spell_pacify.ogg'),
    'cure': (CH2, 'snd_spell_cure_slight_smaller.wav'),
    'won': (COMMON, 'snd_won.wav'),
    'hit': (COMMON, 'snd_hit.wav'),
    'laz': (COMMON, 'snd_laz_c.wav'),
}
sd = os.path.join(OUT, 'audio', 'sfx')
os.makedirs(sd, exist_ok=True)
sfx_man = {}
for k, (d, f) in SFX.items():
    src = os.path.join(d, f)
    ext = os.path.splitext(f)[1]
    shutil.copy(src, os.path.join(sd, k + ext))
    sfx_man[k] = k + ext

# --- music, slugified ---
M = os.path.join(A, 'SFX', 'music')
md = os.path.join(OUT, 'audio', 'music')
os.makedirs(md, exist_ok=True)
music_man = {}
for f in os.listdir(M):
    if not f.lower().endswith('.mp3'):
        continue
    slug = re.sub(r'[^a-z0-9]+', '_', f[:-4].lower()).strip('_')
    shutil.copy(os.path.join(M, f), os.path.join(md, slug + '.mp3'))
    music_man[slug] = slug + '.mp3'

man = json.load(open(os.path.join(OUT, 'manifest.json')))
man['sfx'] = sfx_man
man['music'] = music_man
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'))
print('heads: 5+gray, sfx:', len(sfx_man), 'music:', sorted(music_man))
