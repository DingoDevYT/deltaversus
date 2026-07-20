"""Build a labeled contact sheet from a segmented work dir."""
import sys, glob, os, re
from PIL import Image, ImageDraw

def contact(work_dir, cell=72, cols=12, scale_to=56):
    files = sorted(glob.glob(f'{work_dir}/[0-9][0-9][0-9].png'))
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell, rows * (cell + 14)), (34, 32, 52))
    d = ImageDraw.Draw(sheet)
    for n, f in enumerate(files):
        i = int(os.path.basename(f)[:3])
        im = Image.open(f)
        s = min(scale_to / im.width, scale_to / im.height, 2.0)
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.NEAREST)
        cx, cy = (n % cols) * cell, (n // cols) * (cell + 14)
        sheet.paste(im, (cx + (cell - im.width) // 2, cy + (cell - im.height) // 2), im)
        d.text((cx + 2, cy + cell), str(i), fill=(255, 255, 0))
        d.rectangle([cx, cy, cx + cell - 1, cy + cell + 13], outline=(60, 56, 80))
    out = f'{work_dir}/_contact.png'
    sheet.save(out)
    print(out, f'{len(files)} sprites, {rows} rows')

if __name__ == '__main__':
    contact(sys.argv[1])
