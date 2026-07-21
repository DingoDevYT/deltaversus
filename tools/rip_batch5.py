"""Rip the new sprites for the big attack-feedback batch.
Groups sharing an animation are scaled by a SHARED factor so frames don't jitter.
Writes docs/assets/bullets/*.png + updates manifest.json (bullets + bullet_cost).
Also fixes the Knight IDLE anim to the correct single frame."""
import os, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'NEW RIP')
OUT  = os.path.join(ROOT, 'docs', 'assets')
BD   = os.path.join(OUT, 'bullets')
AN   = os.path.join(OUT, 'anims')

C = os.path.join(DUMP, 'Characters', 'Characters')
KB  = os.path.join(C, 'Bosses', 'Ch3', 'The Roaring Knight', 'Ch3', 'Battle')
KBA = os.path.join(KB, 'Attacks')
JV  = os.path.join(C, 'Bosses', 'Ch1', 'Jevil', 'Attacks')
BER = os.path.join(C, 'NPCs', 'Light World', 'Berdly', 'Ch2', 'Dark World', 'Battle', 'Attacks')
LAN = os.path.join(C, 'NPCs', 'Dark World', 'Ch1', 'Lancer', 'Ch1', 'Battle')

# group = (list[(bid, srcfile)], maxdim, cost)
GROUPS = [
    # Knight FINAL ROAR front family (one shared scale so the animation reads smoothly)
    ([('knightflourish%d' % i, os.path.join(KB, 'spr_roaringknight_front_flourish_%d.png' % i)) for i in range(7)]
     + [('knightroar%d' % i, os.path.join(KB, 'spr_roaringknight_front_roar_%d.png' % i)) for i in range(2)]
     + [('knightslashf%d' % i, os.path.join(KB, 'spr_roaringknight_front_slash_%d.png' % i)) for i in range(6)],
     132, 1),
    # Knight directional-sword outline
    ([('knightswordol', os.path.join(KBA, 'spr_roaringknight_sword_ol_0.png'))], 46, 1),
    # Break-the-Board split flames (normal / big / edge) - each its own shared-scale group
    ([('rkflame%d' % i, os.path.join(KBA, 'spr_rk_split_flame_%d.png' % i)) for i in range(6)], 56, 1),
    ([('rkflamebig%d' % i, os.path.join(KBA, 'spr_rk_split_flame_big_%d.png' % i)) for i in range(6)], 72, 1),
    ([('rkflameedge%d' % i, os.path.join(KBA, 'spr_rk_split_flame_edge_%d.png' % i)) for i in range(5)], 44, 1),
    # Jevil real battle spade (suit-bomb spade, NOT a Lancer card)
    ([('jspade', os.path.join(JV, 'spr_bomb_spade_0.png'))], 18, 1),
    # Jevil carousel horse-duck (3 ride frames)
    ([('carousel%d' % i, os.path.join(JV, 'spr_carousel_%d.png' % i)) for i in range(3)], 40, 2),
    # Berdly A+ paper flyer (chirashi) - 4 tumble frames
    ([('aplus%d' % i, os.path.join(BER, 'spr_chirashi_bullet_%d.png' % i)) for i in range(4)], 20, 1),
    # Lancer riding his bike (left-facing, 6 frames)
    ([('lancerbike%d' % i, os.path.join(LAN, 'spr_lancerbike_l_%d.png' % i)) for i in range(6)], 54, 1),
]

manifest = json.load(open(os.path.join(OUT, 'manifest.json')))
manifest.setdefault('bullets', {})
manifest.setdefault('bullet_cost', {})
added, missing = [], []

for frames, maxdim, cost in GROUPS:
    imgs = []
    ok = True
    for bid, src in frames:
        if not os.path.exists(src):
            missing.append((bid, src)); ok = False; continue
        imgs.append((bid, Image.open(src).convert('RGBA')))
    if not imgs:
        continue
    big = max(max(im.width, im.height) for _, im in imgs)
    scale = maxdim / big if big > maxdim else 1.0
    for bid, im in imgs:
        if scale < 1.0:
            im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.NEAREST)
        im.save(os.path.join(BD, bid + '.png'))
        manifest['bullets'][bid] = {'f': bid + '.png', 'w': im.width, 'h': im.height}
        manifest['bullet_cost'][bid] = cost
        added.append((bid, im.size))

# --- fix the Knight on-field IDLE anim: correct sprite is spr_roaringknight_idle_0 (single frame) ---
idle_src = os.path.join(KB, 'spr_roaringknight_idle_0.png')
if os.path.exists(idle_src):
    os.makedirs(os.path.join(AN, 'knight'), exist_ok=True)
    Image.open(idle_src).convert('RGBA').save(os.path.join(AN, 'knight', 'idle_0.png'))
    manifest.setdefault('anims', {}).setdefault('knight', {})['idle'] = {'frames': ['idle_0.png'], 'durs': [150]}
    added.append(('knight/idle_0 (anim)', Image.open(idle_src).size))
else:
    missing.append(('knight idle', idle_src))

json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=0)
print('added', len(added))
for a in added: print('  ', a)
if missing:
    print('MISSING', len(missing))
    for m in missing: print('  !!', m)
