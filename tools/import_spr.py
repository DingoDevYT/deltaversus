# Import DELTARUNE sprites from the full export into the game's bullet atlas + manifest.
# Usage: python import_spr.py <spr_name>[:key][:trim0] ...
#   spr_name  full sprite name in the export (e.g. spr_pink_sing)
#   key       manifest key prefix (default: spr_name minus 'spr_'); frames become key0, key1, ...
#   :notrim   append to skip alpha-trim (keep original canvas + origin)
# Frames are copied to docs/assets/bullets/<key><i>.png and registered under manifest.bullets.
import sys, os, json
from PIL import Image

EXPORT = r"C:\Users\lando\Desktop\DELTARUNE - EXPORT\DELTARUNE Chapter 5 - EXPORT\sprites"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BULLETS = os.path.join(ROOT, "docs", "assets", "bullets")
MANIFEST = os.path.join(ROOT, "docs", "assets", "manifest.json")

man = json.load(open(MANIFEST))
man.setdefault("bullets", {})

for arg in sys.argv[1:]:
    parts = arg.split(":")
    name = parts[0]
    key = None
    trim = True
    for p in parts[1:]:
        if p == "notrim":
            trim = False
        else:
            key = p
    if key is None:
        key = name[4:] if name.startswith("spr_") else name
    i = 0
    got = 0
    while True:
        src = os.path.join(EXPORT, f"{name}_{i}.png")
        if not os.path.exists(src):
            break
        im = Image.open(src).convert("RGBA")
        ow, oh = im.width, im.height
        offx, offy = 0, 0
        if trim:
            bb = im.getbbox()
            if bb:
                offx, offy = bb[0], bb[1]
                im = im.crop(bb)
        outkey = f"{key}{i}"
        im.save(os.path.join(BULLETS, outkey + ".png"))
        man["bullets"][outkey] = {"f": outkey + ".png", "w": im.width, "h": im.height,
                                  "ow": ow, "oh": oh, "ox": offx, "oy": offy}
        got += 1
        i += 1
    print(f"{name} -> {key}: {got} frame(s)")

json.dump(man, open(MANIFEST, "w"), indent=2)
print("manifest updated")
