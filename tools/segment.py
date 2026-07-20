"""Sprite sheet segmenter: finds sprites against solid bg colors, outputs
numbered crops + an annotated contact image + boxes.json for naming."""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw
from collections import Counter

def segment(path, out_dir, region=None, extra_bg=(), gap=2, min_size=5, n_bg=2):
    im = Image.open(path).convert('RGBA')
    if region:
        im = im.crop(region)
    a = np.array(im)  # H,W,4
    h, w = a.shape[:2]
    flat = a.reshape(-1, 4)
    # most common colors = backgrounds (plus explicit extras, plus transparent)
    cnt = Counter(map(tuple, flat[::7]))
    bgs = [c for c, _ in cnt.most_common(n_bg)] if n_bg > 0 else []
    bgs += [tuple(c) + (255,) if len(c) == 3 else tuple(c) for c in extra_bg]
    mask = np.zeros((h, w), bool)
    for bg in bgs:
        mask |= (a == np.array(bg, np.uint8)).all(axis=2)
    mask |= a[:, :, 3] == 0
    fg = ~mask
    # connected components with gap tolerance via dilation
    from scipy import ndimage as ndi  # try scipy first
    st = np.ones((gap * 2 + 1, gap * 2 + 1), bool)
    lbl, n = ndi.label(ndi.binary_dilation(fg, st))
    boxes = []
    sl = ndi.find_objects(lbl)
    for i, s in enumerate(sl):
        if s is None: continue
        sub = fg[s]
        if not sub.any(): continue
        ys, xs = np.where(sub)
        y0, y1 = s[0].start + ys.min(), s[0].start + ys.max() + 1
        x0, x1 = s[1].start + xs.min(), s[1].start + xs.max() + 1
        if (y1 - y0) < min_size and (x1 - x0) < min_size: continue
        boxes.append((int(x0), int(y0), int(x1), int(y1)))
    # sort into rows (band by y center)
    boxes.sort(key=lambda b: (b[1] // 40, b[0]))
    os.makedirs(out_dir, exist_ok=True)
    ann = im.convert('RGB').copy()
    d = ImageDraw.Draw(ann)
    out = []
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        spr = im.crop((x0, y0, x1, y1))
        # re-key: make bg colors transparent inside the crop
        sa = np.array(spr)
        m = np.zeros(sa.shape[:2], bool)
        for bg in bgs:
            m |= (sa == np.array(bg, np.uint8)).all(axis=2)
        sa[m] = 0
        Image.fromarray(sa).save(f'{out_dir}/{i:03d}.png')
        d.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(255, 0, 0))
        d.text((x0 + 1, max(0, y0 - 11)), str(i), fill=(255, 255, 0))
        out.append({'i': i, 'box': [x0, y0, x1, y1]})
    ann.save(f'{out_dir}/_annotated.png')
    json.dump({'bgs': [[int(v) for v in b] for b in bgs], 'boxes': out},
              open(f'{out_dir}/boxes.json', 'w'), indent=0)
    print(f'{len(out)} sprites -> {out_dir}  (bgs={bgs[:n_bg]})')

if __name__ == '__main__':
    p = json.loads(sys.argv[1])
    segment(**p)
