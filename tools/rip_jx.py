"""Re-rip Jevil new-set bullets at NATIVE resolution (trim only) so patterns can downscale
cleanly to Gemini's exact display sizes. Also rips the devilsknife scythes as jx-only ids."""
import os, json, glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'NEW RIP')
SUITS = os.path.join(DUMP, 'Characters', 'Characters', 'Enemies', 'Ch1', '# Suits Bullets')
OUT = os.path.join(ROOT, 'docs', 'assets'); BD = os.path.join(OUT, 'bullets')

def find(name):
    for f in glob.glob(os.path.join(DUMP, '**', name), recursive=True):
        if '_ch' not in os.path.basename(f): return f
    return None

# id -> source path (trim to opaque, keep native size)
PICKS = {
    'suitspade':    os.path.join(SUITS, 'spr_spadebullet_0.png'),
    'suitheart':    os.path.join(SUITS, 'spr_heartbullet_0.png'),
    'suitclub':     os.path.join(SUITS, 'spr_clubsbullet_0.png'),
    'suitclubball': os.path.join(SUITS, 'spr_clubsball_a_0.png'),
    'suitdiamondv': os.path.join(SUITS, 'spr_diamondbullet_vert_0.png'),
    'jdevil':       find('spr_joker_scythebody_0.png'),
    'jdevilgiant':  find('spr_jokerscythe_big_0.png'),
}

man = json.load(open(os.path.join(OUT, 'manifest.json')))
man.setdefault('bullets', {}); man.setdefault('bullet_cost', {})
for bid, src in PICKS.items():
    im = Image.open(src).convert('RGBA')
    bb = im.getbbox()
    if bb: im = im.crop(bb)
    im.save(os.path.join(BD, bid + '.png'))
    man['bullets'][bid] = {'f': bid + '.png', 'w': im.width, 'h': im.height}
    man['bullet_cost'][bid] = 1
    print(bid, im.size)

json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=0)
