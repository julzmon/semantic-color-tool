# Shared emphasis mixing

Approved direction: retain semantic tokens and derive emphasis interaction fills from their base using shared opaque OKLCH mixing recipes. The generator evaluates those recipes before validating contrast; CSS exports the recipes and DTCG materializes identical colors.

- Add optional `emphasis.mixWeights` with base-retention factors for hover, active, and selected. Defaults: 0.92, 0.85, 0.80. Weights must be finite and ordered from 1 down to 0.
- New builder defaults use mixing. Importing older configurations converts their emphasis spacing to proportional weights relative to a reference lightness of 0.5. Direct engine callers omitting the new field retain the legacy additive model for compatibility.
- Mix against opaque black in light mode and matching dark mode. Reversed dark states mix against opaque white. Retain exact base anchors and reject out-of-gamut results rather than silently mapping mixed states differently from CSS.
- Solve emphasis bases using the mixed states. Keep foreground and boundary groups independently solved. Under shared reversed themes, include both dark and light mixed states in the shared-base search.
- Do not shift mixed emphasis groups during gray reuse.
- Replace the builder's emphasis-spacing slider with shared percentage strength controls. Changing a control preserves state ordering; contrast protection may reduce strengths but never weakens targets or exact locks.
- CSS retains every semantic role and adds shared weight/target tokens. Re-declare recipes at theme boundaries so numeric overrides there are effective. Preview styles use the same expressions. Materialize emphasis state colors in DTCG from the serialized base and weights.
- Coordinate shortening must validate the mixed results from the shortened base. Semantic aliases must never create a dependency cycle through a derived state.
- Test engine interpolation against Culori, shared settings, ordering, locks, gamut, migration, limiting, exact CSS/DTCG/preview parity, and browser theme behavior. Historical engine parity fixtures continue covering legacy configurations.

This pass covers emphasis fills. Muted fills, foregrounds, and functional borders retain their existing independent rules.
