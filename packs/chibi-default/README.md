# Chibi Default — Endenza character pack

Cute chibi character starter pack composed from the **Gray Matter Studios
Character Generator 2.0** piece library (Kevin's personal copy lives in
`~/Downloads/Character Generator 2.0 Linux Build.zip`).

## What ships

Three pre-composed starter characters, each a single 48×96 idle PNG:

- `characters/chibi_alex.png` — body 01 + hairstyle 01_03 + outfit 05_03 + eyes 01
- `characters/chibi_jules.png` — body 05 + hairstyle 03_02 + outfit 12_03 + eyes 03
- `characters/chibi_sage.png` — body 09 + hairstyle 05_07 + outfit 20_03 + eyes 05

Each is ~600 bytes. Total pack < 2 KB.

The character has chibi proportions (large head, small body), so a
single-cell preview reads as "head-prominent" — that's correct, not a
crop bug.

## Sheet layout reference (for future v2 walk-cycle integration)

The source body sheet (`Body_NN.png`, 2688×1920) uses **48-wide × 96-tall
cells** in a 56 × 20 grid (1120 cells total). The first three rows
(in 96-tall units) of column 0-3 contain the directional idle / walk
frames:

- **Row 0 (96-tall)**: one cell per direction — `col 0 = west`,
  `col 1 = south`, `col 2 = east`, `col 3 = south alt` (slight pose
  variation).
- **Row 1 (96-tall)**: north-facing walk cycle (cells 0-7).
- **Row 2 (96-tall)**: south-facing walk cycle.
- Lower rows hold attack / sit / climb / swim / fish / fall / emote
  poses — undocumented by the artist; mapping is a manual exercise
  (see `bin/sprite-frame-picker.html` for the picker tool).

For v1 we ship just the south-facing idle cell `(col=1, row=0)`. Walk
cycles + directional support can come in v2 when the action-row
mapping is locked.

## Integration TODO

To render chibi sprites in walk mode:

1. **Sprite descriptor shape** — extend descriptor with
   `render_mode: "static_pose"` and `asset_url: "packs/chibi-default/characters/<id>.png"`.
2. **`sprite_engine.py`** — branch on `descriptor.render_mode`:
   - `static_pose` → load + draw the single PNG at the sprite's foot
     anchor (no atlas, no row/col math).
   - existing default → continue the Mana Seed paper-doll composite.
3. **Cell dimensions** — chibi cells are 48×96, not 64×64. If we ever
   need atlas-style rendering, the engine should read `cell_w` /
   `cell_h` from the pack manifest.
4. **`character_creator`** — add a "Style" picker chip ahead of the
   options column: **Mana Seed** (mature pixel art) / **Chibi**
   (cute, expressive). Picking Chibi swaps the body/hair/outfit
   pickers for a 3-card character carousel.

## Source attribution

Chibi pieces by **Gray Matter Studios — Character Generator 2.0**.
Composed locally via `bin/scripts/build_chibi_pack.py`. Re-run that
script to regenerate the pack from source pieces (e.g. when adding
new starter characters).

## Re-build

```bash
python3 bin/scripts/build_chibi_pack.py
```
