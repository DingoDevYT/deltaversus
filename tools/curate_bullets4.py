"""Re-rip attack bullets from the EXACT folders Landon specified + accurate boss
projectiles. id -> (glob basename, cost tier, max px, path-substring filter)."""
import os, glob, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'NEW RIP')
OUT = os.path.join(ROOT, 'docs', 'assets')
BD = os.path.join(OUT, 'bullets')

PICKS = {
    # --- party (exact folders Landon gave) ---
    'knife':     ('spr_stolen_knife', 1, 24, 'Aqua'),            # Kris (Aqua Ch5)
    'knifefan':  ('spr_attack_knifefan', 1, 26, 'Aqua'),
    'axe':       ('spr_axebullet_b', 1, 26, 'Susie'),            # Susie Ch1 Dark World
    'ralseidot': ('spr_smallbullet', 0, 12, 'Ralsei'),          # Ralsei Ch1
    # --- Jevil (accurate) ---
    'scythe':    ('spr_joker_scythebody', 2, 30, 'Jevil'),      # orbiting scythe
    'scythebig': ('spr_jokerscythe_big', 3, 46, 'Jevil'),       # giant Final Chaos scythe
    'carousel':  ('spr_carousel', 2, 32, 'Jevil'),              # carousel horse/duck
    # --- Berdly (accurate) ---
    'tornado':   ('spr_berdlyb_tornado', 2, 28, 'Berdly'),      # battle tornado
    'plug':      ('spr_berdlyb_plug', 1, 22, 'Berdly'),         # Werewire plug
}

def find(base, filt):
    pats = [base + '_0.png', base + '.png', base + '_*.png']
    for pat in pats:
        g = [x for x in glob.glob(os.path.join(DUMP, '**', pat), recursive=True)
             if '_ch' not in x.replace('\\', '/').split('/')[-1]
             and (not filt or filt.lower() in x.replace('\\', '/').lower())]
        if g:
            return sorted(g, key=len)[0]
    return None

manifest = json.load(open(os.path.join(OUT, 'manifest.json')))
manifest.setdefault('bullets', {})
manifest.setdefault('bullet_cost', {})
added, missing = [], []
for bid, (base, tier, mx, filt) in PICKS.items():
    f = find(base, filt)
    if not f:
        missing.append((bid, base)); continue
    im = Image.open(f).convert('RGBA')
    m = max(im.width, im.height)
    if m > mx:
        s = mx / m
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)
    im.save(os.path.join(BD, bid + '.png'))
    manifest['bullets'][bid] = {'f': bid + '.png', 'w': im.width, 'h': im.height}
    manifest['bullet_cost'][bid] = tier
    added.append((bid, os.path.basename(f), im.size))

json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'))
print('added', len(added))
for a in added: print('  ', a)
if missing: print('MISSING', missing)
