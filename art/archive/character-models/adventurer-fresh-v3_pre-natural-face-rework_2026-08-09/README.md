# Adventurer Fresh v3 archive

This snapshot preserves the complete active v3 character asset set and the source files that produced and consumed it immediately before the natural-face and eight-direction head rework on 2026-08-09.

- `assets/` contains the five former live race roots.
- `source/` contains the generator, validators, contact-sheet renderers, runtime composition, character-creation UI, and package scripts.

The archive deliberately lives outside `public/`, so the game cannot load or ship these superseded atlases accidentally.
