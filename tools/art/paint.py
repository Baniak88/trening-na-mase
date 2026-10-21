"""Muscle highlight masks from seed points: the enclosed area under each seed, limited to a disk around it."""
import numpy as np, cv2, json, sys
COL = {'p': (61, 106, 255), 's': (150, 185, 255)}  # BGR orange / light orange
def masks(name, seeds, close=3):
    g = cv2.imread('png/' + name + '.png', cv2.IMREAD_GRAYSCALE)
    h, w = g.shape
    line = (g < 160).astype(np.uint8)
    wall = cv2.dilate(line, np.ones((close, close), np.uint8))
    free = (1 - wall).astype(np.uint8)
    from regions import background
    bg = background(line)
    body = (~bg) & (line == 0)
    free = (free.astype(bool) & body).astype(np.uint8)
    n, lab = cv2.connectedComponents(free, connectivity=4)
    S = max(h, w)
    out = {}
    # 'x' seeds mark holes (e.g. the gap between the arms and the bar): not body
    xs_ = [s for s in seeds if s[0] == 'x']
    if xs_:
        wall9 = cv2.dilate(line, np.ones((11, 11), np.uint8))
        f9 = ((1 - wall9).astype(bool) & body).astype(np.uint8)
        n9, l9 = cv2.connectedComponents(f9, connectivity=4)
        for s in xs_:
            px, py = int(s[1] / 100 * w), int(s[2] / 100 * h)
            if l9[py, px] > 0:
                hole = cv2.dilate((l9 == l9[py, px]).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool) & body
                body = body & ~hole; lab = np.where(hole, 0, lab)
    for s in [s for s in seeds if s[0] != 'x']:
        m, x, y = s[0], s[1], s[2]; r = (s[3] if len(s) > 3 else 7) / 100 * S
        px, py = int(x / 100 * w), int(y / 100 * h)
        # nearest free pixel inside the figure
        ys, xs = np.nonzero((lab > 0) & body)
        if not len(xs): continue
        k = np.argmin((xs - px) ** 2 + (ys - py) ** 2); px, py = xs[k], ys[k]
        disk = np.zeros((h, w), np.uint8); cv2.circle(disk, (int(px), int(py)), int(r), 1, -1)
        loc = ((lab == lab[py, px]) & (disk > 0)).astype(np.uint8)
        nn, ll = cv2.connectedComponents(loc, connectivity=4)
        reg = ll == ll[py, px]
        reg = cv2.dilate(reg.astype(np.uint8), np.ones((close + 2, close + 2), np.uint8)) & body  # grow under the closed gap back to the line
        out[m] = (out.get(m, np.zeros((h, w), bool)) | reg.astype(bool))
    return g, line, body, bg, out
def preview(name, seeds, prim, path):
    g, line, body, bg, out = masks(name, seeds)
    im = np.full(g.shape + (3,), 255, np.uint8)
    im[body] = (250, 246, 243)
    for m, mk in out.items():
        im[mk] = COL['p' if m in prim else 's']
    im[line > 0] = (41, 29, 26)
    cv2.imwrite(path, im)
if __name__ == '__main__':
    spec = json.loads(open(sys.argv[1]).read())
    for name, (prim, seeds) in spec.items(): preview(name, seeds, prim, 'paint/' + name + '.png')
