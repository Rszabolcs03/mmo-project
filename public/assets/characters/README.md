# Character asset structure

Character artwork is organized by ownership so shared layers are not copied for every race/class combination.

- `human_fresh/`, `elf_fresh/`, `dwarf_fresh/`, `orc_fresh/`, and
  `undead_fresh/` are the live adventurer-fresh-v6 runtime sets. Every original 864x768 atlas
  uses 96px frames, eight direction rows, one idle pose, four walk poses, and
  four attack poses. Bodies, faces, hair, beards, capes, class outfits, and
  class weapons are independent layers drawn on one shared skeleton. Each race
  also owns three optional heritage-detail layers.
- `bases/<race>/<gender>.png` contains reusable nonhuman race and gender body layers.
- `classes/<class>/shared/outfits/<variant>.png` contains class outfits shared by races.
- `classes/<class>/shared/weapons/<variant>.png` contains class weapons shared by races.
- `cosmetics/` contains shared four-direction nonhuman hair, beard, and cape layers.

Nonhuman class variants continue to resolve to `classes/<class>/shared/`.
Current runtime IDs use the `<race>-fresh-` prefix and resolve only inside the
matching race root; old saved appearance choices are normalized onto v5.
