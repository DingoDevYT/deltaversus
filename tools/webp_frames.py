"""Extract N evenly-spaced frames from an animated WebP/GIF into a labeled montage.
Usage: py tools/webp_frames.py <file> <n> [cols]
"""
import sys, os
from PIL import Image, ImageDraw, ImageSequence

f = sys.argv[1]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 12
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
im = Image.open(f)
frames = [fr.convert('RGBA') for fr in ImageSequence.Iterator(im)]
total = len(frames)
idx = [round(i * (total - 1) / (n - 1)) for i in range(n)] if total > 1 else [0]
pick = [(i, frames[i]) for i in idx]
w = pick[0][1].width
tw = 300
sc = tw / w
th = int(pick[0][1].height * sc)
rows = (len(pick) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 4) + 4, rows * (th + 16) + 4), (18, 18, 28))
d = ImageDraw.Draw(sheet)
for j, (fi, fr) in enumerate(pick):
    t = fr.resize((tw, th), Image.NEAREST)
    x = 4 + (j % cols) * (tw + 4); y = 4 + (j // cols) * (th + 16)
    bg = Image.new('RGB', t.size, (18, 18, 28)); bg.paste(t, (0, 0), t)
    sheet.paste(bg, (x, y))
    d.text((x + 2, y + th + 2), 'f%d/%d' % (fi, total), fill=(255, 255, 120))
out = os.path.join('ref', 'vidframes', os.path.splitext(os.path.basename(f))[0].replace(' ', '_') + '_grid.png')
sheet.save(out)
print(out, 'frames', total)
