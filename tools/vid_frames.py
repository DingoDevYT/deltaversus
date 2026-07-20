"""Extract reference frames from a gameplay video.

Usage:
  py tools/vid_frames.py <video> scan              -> contact sheets, 1 frame / 2s
  py tools/vid_frames.py <video> clip <t0> <t1>    -> 10-frame montage of [t0,t1] seconds
"""
import sys, os
import cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'ref', 'vidframes')
os.makedirs(OUT, exist_ok=True)

def grab(cap, t):
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, fr = cap.read()
    if not ok: return None
    fr = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(fr)

def montage(frames, labels, path, cols=5, w=252):
    tiles = []
    for f, lb in zip(frames, labels):
        s = w / f.width
        tiles.append((f.resize((w, int(f.height * s))), lb))
    th = tiles[0][0].height
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (w + 4) + 4, rows * (th + 16) + 4), (18, 18, 28))
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for i, (im, lb) in enumerate(tiles):
        x = 4 + (i % cols) * (w + 4); y = 4 + (i // cols) * (th + 16)
        sheet.paste(im, (x, y))
        d.text((x + 2, y + th + 2), lb, fill=(255, 255, 120))
    sheet.save(path)
    return path

video = sys.argv[1]; mode = sys.argv[2]
cap = cv2.VideoCapture(video)
dur = cap.get(cv2.CAP_PROP_FRAME_COUNT) / max(1, cap.get(cv2.CAP_PROP_FPS))
print('duration %.1fs' % dur)

if mode == 'scan':
    ts = [t for t in range(0, int(dur), 2)]
    per = 25   # frames per sheet
    for si in range(0, len(ts), per):
        chunk = ts[si:si + per]
        frames, labels = [], []
        for t in chunk:
            f = grab(cap, t)
            if f: frames.append(f); labels.append('%ds' % t)
        if frames:
            p = montage(frames, labels, os.path.join(OUT, 'scan_%03d.png' % (si // per)))
            print('sheet', p, 'covers %ds-%ds' % (chunk[0], chunk[-1]))
elif mode == 'clip':
    t0, t1 = float(sys.argv[3]), float(sys.argv[4])
    n = 10
    frames, labels = [], []
    for i in range(n):
        t = t0 + (t1 - t0) * i / (n - 1)
        f = grab(cap, t)
        if f: frames.append(f); labels.append('%.1fs' % t)
    p = montage(frames, labels, os.path.join(OUT, 'clip_%d_%d.png' % (int(t0), int(t1))))
    print('clip sheet', p)
