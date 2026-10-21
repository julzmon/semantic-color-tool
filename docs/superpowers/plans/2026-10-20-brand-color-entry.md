# Brand color entry

Approved flow: one picker, explicit HEX/OKLCH format dropdown, and matching entry field; unlocked hue/chroma controls; exact lock hides family sliders and reveals role/theme selectors. Edit locked color explicitly reveals exact lightness/chroma/hue sliders and re-enables source entry. Preserve exact source strings unless deliberately edited; changing the format only converts the display. Preserve additional imported anchors.

Implementation:
- Replace BrandAnchors presentation with the primary color flow, accepting existing family sliders as a Svelte snippet. Seed an absent anchor from the accepted Brand emphasis fill, rather than a fixed unrelated lightness.
- Synchronize edits to an unlocked primary preference with family hue/chroma in Controls; family slider edits update that preference's corresponding coordinate. Locked edits retain exact source strings and use existing contrast acceptance.
- Keep imported additional anchors editable through the existing AnchorCard path. Do not modify the engine or persistence schema.
- Verify source round-trip, lock/unlock display transitions, deliberate exact editing, rejected changes, primary-family synchronization, imported-anchor retention, and existing live slider behavior. Run the full suite and production build.
