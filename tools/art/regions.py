"""Numbered interior regions of a drawing frame (for picking muscles by number)."""
import numpy as np, cv2, json, sys, colorsys
from PIL import Image, ImageDraw, ImageFont
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 12)
def background(line, k=17):
    """Outside of the figure: lines closed with a large kernel so gaps in outlines don't leak."""
    h, w = line.shape
    cl = cv2.morphologyEx(line, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    free = (1 - cl).astype(np.uint8)
    n, lab = cv2.connectedComponents(free, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, list(border))
def regions(name, close=3, minfrac=0.0004):
    g = cv2.imread('png/' + name + '.png', cv2.IMREAD_GRAYSCALE)
    h, w = g.shape
    line = (g < 160).astype(np.uint8)
    bg = background(line)
    wall = cv2.dilate(line, np.ones((close, close), np.uint8))
    free = ((1 - wall) & (~bg)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(free, connectivity=4)
    keep = [i for i in range(1, n) if st[i, 4] >= minfrac * h * w]
    # stable numbering: top to bottom, left to right
    keep.sort(key=lambda i: (round(cen[i][1] / (h / 12)), cen[i][0]))
    return g, line, lab, keep, st, cen
def view(name, out, size=520):
    g, line, lab, keep, st, cen = regions(name)
    h, w = g.shape
    im = np.full((h, w, 3), 255, np.uint8)
    for k, i in enumerate(keep):
        r, gg, b = colorsys.hsv_to_rgb((k * 0.137) % 1, 0.28, 1.0)
        im[lab == i] = (int(r * 255), int(gg * 255), int(b * 255))
    im[line > 0] = (30, 30, 40)
    pil = Image.fromarray(im); sc = size / max(h, w); pil = pil.resize((int(w * sc), int(h * sc)))
    d = ImageDraw.Draw(pil)
    for k, i in enumerate(keep):
        # label at the pixel of the region farthest from its border (inside even for odd shapes)
        mask = (lab == i).astype(np.uint8)
        dist = cv2.distanceTransform(mask, cv2.DIST_L2, 3)
        y, x = np.unravel_index(np.argmax(dist), dist.shape)
        t = str(k + 1); x, y = x * sc, y * sc
        d.text((x - 6, y - 7), t, fill=(200, 0, 0), font=FONT, stroke_width=2, stroke_fill=(255, 255, 255))
    pil.save(out)
    return [int(i) for i in keep]
if __name__ == '__main__':
    view(sys.argv[1], sys.argv[2])
