# Global CSS settings and shared components

Approved scope: global settings, restored useful L/C/H tokens, no theme-boundary recipe redeclarations.

All custom properties are declared once on `:root`. Explicit mode selectors change only `color-scheme`; a shared boundary rule applies surface and foreground colors. Unregistered `light-dark()` expressions continue to adapt in nested modes.

Reuse the verified foundation's lightness positions and family hue keys. Emit only components referenced by direct semantic colors. Deduplicate equal chroma values within each family; preserve distinct gamut-limited values and exact source literals. Do not emit the intermediate primitive palette. Keep public semantic names, identical-color aliases, and emphasis mixes. CSS and preview share this component model; DTCG and generation remain unchanged.

Numeric customization is global: edit variables on `:root`. Nested scalar changes do not recompute inherited recipes. Foundation ordinals can change when regenerating; application consumers should use semantic names. Export counts include components, roles, and settings.

Verification: independent CSS/DTCG parity for default, reversed/selected, muted controls, custom prefixes, and locks; assert every custom property is root-only; check shared component reuse, preview parity, full tests, typecheck/build, and nested theme browser behavior.
