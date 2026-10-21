"""Coloured drawings: body fill, muscle layers (from annotated seed points) and the original lines, as one SVG per frame.
Also renders small per-exercise thumbnails (light and dark) with that exercise's muscles."""
import json, sys, os, re, numpy as np, cv2, potrace
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from paint import masks
EK = '/home/claude/trening-na-mase/img/ek/'
SRC = 'src_svg/'           # original line drawings (copied once)
META = json.load(open('meta.json'))
RAD = {'back': 10, 'chest': 8, 'quads': 8, 'hams': 8, 'glutes': 7, 'abs': 7, 'delts': 5, 'biceps': 4, 'triceps': 4, 'forearms': 5, 'calves': 5}
f1 = lambda v: str(int(round(v)))
def trace(mask):
    if not mask.any(): return ''
    m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.2) > 0.5
    path = potrace.Bitmap(~m).trace(turdsize=30, alphamax=1.2, opticurve=True, opttolerance=1.0)
    d = []
    for c in path:
        s = c.start_point; d.append('M%s %s' % (f1(s.x), f1(s.y)))
        for seg in c.segments:
            if seg.is_corner: d.append('L%s %s L%s %s' % (f1(seg.c.x), f1(seg.c.y), f1(seg.end_point.x), f1(seg.end_point.y)))
            else: d.append('C%s %s %s %s %s %s' % tuple(f1(v) for v in (seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, seg.end_point.x, seg.end_point.y)))
        d.append('Z')
    return ''.join(d)
P_COL, S_COL, BODY, LINE = '#FF6A3D', '#FFB59A', '#D5DEEA', '#1E2433'
def frame(name, seeds, levels):
    sd = [[m, p[0], p[1], p[2] if len(p) > 2 else RAD.get(m, 6)] for m, pts in seeds.items() for p in pts]
    g, line, body, bg, mus = masks(name, sd)
    me = META[name]; vb = me['vb']; k = me['k']
    src = open(SRC + name + '.svg').read()
    inner = re.sub(r'^<svg[^>]*>|</svg>$', '', src.strip()).replace('#252A36', LINE)
    tf = 'translate(%s %s) scale(%s)' % (f1(vb[0]), f1(vb[1]), '%.5f' % (1 / k))
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" class="ekd">' % ' '.join(f1(v) for v in vb)]
    solid = cv2.morphologyEx(body.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)).astype(bool) & ~bg
    parts.append('<g transform="%s"><path class="b" fill="%s" d="%s"/>' % (tf, BODY, trace(solid)))
    order = sorted(mus, key=lambda m: levels.get(m) == 'p')  # primary on top
    for m in order:
        if m not in levels: continue
        parts.append('<path class="m m-%s" fill="%s" d="%s"/>' % (m, P_COL if levels[m] == 'p' else S_COL, trace(cv2.morphologyEx(mus[m].astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)).astype(bool) & solid)))
    parts.append('</g><g class="l">' + inner + '</g></svg>')
    return ''.join(parts), (g, line, body, mus)
if __name__ == '__main__':
    ann = json.load(open(sys.argv[1]))
    need = json.load(open('need.json'))
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    only = sys.argv[3].split(',') if len(sys.argv) > 3 else None
    for did, frames in ann.items():
        if only and did not in only: continue
        for fi in ('0', '1'):
            seeds = {m: p for m, p in frames.get(fi, {}).items() if m != 'x'}
            if 'x' in frames.get(fi, {}): seeds['x'] = frames[fi]['x']
            svg, _ = frame(did + '-' + fi, seeds, need[did]['m'])
            open(out + '/' + did + '-' + fi + '.svg', 'w').write(svg)
    print('ok', len(ann))
