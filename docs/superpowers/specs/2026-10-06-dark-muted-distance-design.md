# Dark Muted Distance Design

## Goal

Allow light and dark modes to place muted semantic fills at different distances from their respective surfaces, so dark alerts can retain more sRGB chroma without changing light mode.

## Decision

Split the existing `muted.distance` setting into `light` and `dark` values. New defaults use `0.055` in light mode and `0.160` in dark mode. A legacy numeric value remains valid and maps to that value for both modes, so saved configurations retain their current appearance until changed.

The control changes lightness only. Family hue and requested chroma remain shared, preserving the system's shared-family structure. The existing per-role sRGB gamut mapping continues to cap chroma when necessary.

## User interface

Replace **Distance from surface** with:

- **Light muted distance**
- **Dark muted distance**

The light control keeps the existing range (`-0.08` through `0.16`). The dark control extends to `0.25`, with both using a `0.005` step. The supporting text explains that increasing the dark value lifts muted fills above the dark surface and can preserve more visible chroma.

## Configuration and compatibility

`BuilderConfig.muted.distance` accepts either the legacy number or a `{ light, dark }` record. The generator and configuration importer normalize legacy numbers to equal light and dark values. New defaults, persisted configurations, and exported configurations use the record form.

The configuration version remains `2` because the importer accepts the prior version-2 numeric shape and normalizes it deterministically.

## Generation

`mutedGeneration` reads the distance for the active mode. It retains the existing shared muted-state lightness across families, state separation, gamut mapping, contrast validation, and gray-reuse pass.

The resolved light-mode colors remain unchanged when only the dark setting changes. Primitive ordinal names are assigned from the combined light and dark palette, so a dark-only adjustment can still rename exported light primitive references without changing their resolved colors.

## Validation

Tests cover:

- legacy numeric distances producing the same result as equal mode-specific values;
- changing dark distance moving only dark muted roles;
- importer normalization of existing saved/exported configurations;
- default configuration shape, regenerated examples, and full test/build checks.
