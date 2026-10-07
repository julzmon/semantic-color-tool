# Muted chroma adjustment

Approved design: separate Light muted chroma and Dark muted chroma sliders from 0–200%, default 100%. Each scales every family's requested muted chroma before per-state sRGB gamut mapping. Derived muted borders follow their matching fills. Surfaces and emphasis continue to use family chroma; text and boundary relationships continue to be solved and validated.

Store optional `muted.chromaScale: { light: number; dark: number }` factors from 0 to 2. Omitted values in older configurations mean 1 in both modes. Explicit malformed, incomplete, negative, nonfinite, or above-2 values are rejected. Imports, storage, generated configuration exports, and gray reuse preserve these settings. Gray reuse must regenerate muted candidate colors using the same scale rather than restoring family chroma.

Verify backward-compatible default output, independent modes, zero and doubled chroma, sRGB mapping, derived borders, validation, configuration round-trip, UI keyboard controls, and reload persistence.
