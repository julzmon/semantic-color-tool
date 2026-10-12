# Semantic Color System Generator

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Designers and frontend developers building design systems. Their job is to configure, inspect, validate, and export a coherent semantic color system for light and dark interfaces.

## Product Purpose

Generate semantic color tokens from adjustable OKLCH parameters, with previews and contrast validation. Success means exporting a usable color system whose modeled foreground/background and boundary relationships pass the documented contrast requirements.

## Positioning

The builder uses shared semantic lightness positions across families, checks contextual contrast independently, and balances edits within verified constraints. Exact color anchors can preserve literal OKLCH sources. Brand has its own primitive namespace, independent of Negative, even though both begin from red KDS references.

## Operating Context

An interactive Svelte 5 and TypeScript browser application. Users adjust system structure, surfaces and neutrals, semantic colors, muted fills, and interaction states; compare light, dark, and split previews; inspect roles and primitives; then export tokens or configurations for downstream use.

Calculations and configuration import/export run locally. Valid configurations persist in browser storage for the current origin. Production builds support installation and offline use after caching; development builds do not run a service worker. Configuration files provide portable backups across origins.

## Capabilities and Constraints

- Generate six semantic families: Neutral, Brand, Info, Positive, Negative, and Warning.
- Preserve the documented contrast targets: normal text 4.5:1, large text 3:1, and UI boundaries 3:1. These checks cover modeled color relationships, not the accessibility of an entire interface.
- Keep contrast protection enabled. Balance edits without weakening targets or exact locks; reject infeasible hard constraints and retain the previous verified configuration.
- Support independent light/dark surfaces, tonal spacing, muted distance and chroma, interaction states, foregrounds, and borders.
- Share emphasis fills across themes by default, with adaptive per-theme emphasis available.
- Support OKLCH Brand anchors, including exact locks. Out-of-gamut exact sources remain uncertified for sRGB contrast.
- Generate opaque sRGB colors; gamut-map unlocked colors by reducing chroma while retaining requested hue and lightness.
- Use a bounded solver and primitive-reuse search. Failure does not prove mathematical infeasibility, and reuse does not prove a globally minimal palette.
- Export CSS, DTCG tokens/resolvers, and importable configuration JSON. Preserve documented migration and validation behavior.
- Export native CSS `light-dark()` without a legacy fallback. Browser support follows modern Baseline Widely Available features, with this explicit exported-CSS requirement.
- Preserve the configurable token prefix and KDS reference defaults. Generated primitive ordinals may change with configuration changes and are not stable semantic identifiers.
- Scope the product to generated color tokens. Non-color tokens and transparent overlays are outside the builder; it does not replace the full KDS API.

## Brand Commitments

The existing product name is Semantic Color System Generator. Preserve established semantic family terminology and the distinction between semantic roles and generated primitives. No additional voice or visual identity commitments were established during initialization.

## Evidence on Hand

- `README.md`: confirmed product scope, workflows, contrast contracts, export formats, and limitations.
- `src/reference/kds-tokens.css`: KDS reference token source.
- `src/engine/`: generation, balancing, validation, gamut handling, and export implementation.
- `src/ui/` and `src/App.svelte`: implemented controls, previews, inspection, persistence, and export workflows.
- `docs/examples/`: checked-in export examples.
- `docs/superpowers/specs/` and `docs/superpowers/plans/`: implementation decisions and historical plans; distinguish historical proposals from current behavior.

No customer, testimonial, pricing, licensing, or performance claims were confirmed in this initialization. Future work must not invent them.

## Product Principles

1. Preserve verified contrast and exact constraints before accepting configuration changes.
2. Make semantic relationships and light/dark behavior inspectable before export.
3. Keep configuration portable and local workflows usable offline after production caching.
4. State solver, gamut, browser-support, and accessibility limits accurately.
5. Preserve a coherent family structure while allowing controlled customization.

## Open Decisions

No additional audience segments, commercial positioning, product-specific accessibility standard, or binding visual direction were established. Use the documented requirements until explicitly revised.
