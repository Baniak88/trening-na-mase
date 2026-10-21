# Coloured exercise drawings

`ann.json`: muscle seed points per drawing and frame (`{"0042": {"0": {"chest": [[x%, y%, radius%?]], "x": [[...]]}}}`; `x` marks holes that are not body).
Pipeline (Python with numpy, opencv-python, potracer; Node with Playwright):
1. `node render.js <original svg dir> png 720` rasterises the original line drawings.
2. `python3 build_color.py ann.json <out>` writes coloured SVGs (body fill, primary/secondary muscle layers, original lines) into `img/ek/`.
3. `node thumbs.js <out> <png dir>` renders list thumbnails, saved as WebP in `img/ekt/`.
Primary (orange) vs secondary (light orange) comes from the exercises that use each drawing.
