# Independent muted border strength

Approved design: per-theme Muted border strength sliders under Muted fills, from 0–100%. Zero preserves the existing generated borders. Full strength requests an extra 0.3 OKLCH lightness toward dark in light mode and toward light in dark mode. Both border states move together, limited by the available lightness range so their spacing stays intact.

## Implementation

- [x] Test unchanged legacy output, per-mode isolation, preserved fills/text/checks, gamut, state spacing at limits, validation, and export/storage round trips.
- [x] Add optional `muted.borderStrength` per-mode settings with zero fallback and 0–0.3 validation. Preserve the legacy serialized configuration when the setting is absent.
- [x] Apply the adjustment after palette reuse and before final deduplication; preserve family hue and configured muted chroma subject to gamut mapping. This prevents border settings from influencing other generated roles.
- [x] Preserve the setting through import/export, balancing fallback, and adjustment reporting. It is decorative and does not introduce or weaken contrast targets.
- [x] Add labeled percentage sliders and engine-derived Brand gradient tracks for Light and Dark within Muted fills.
- [x] Verify focused and full tests, unchanged calculation fingerprints, type/unused checks, production/PWA build, code review, and browser interaction.

Publishing is a separate action unless requested.
