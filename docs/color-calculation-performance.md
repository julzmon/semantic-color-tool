# Color calculation performance

The optimizations retain the published generator's candidate order, precision, exact locks, contextual checks, output tokens and accepted settings. No new Brand-sharing search is included.

## Measured calculation time

Local Node 24 measurements, with the same profiler and three repeated runs per generator case. The repeated median measures warm-cache calculation work; it excludes DOM rendering, worker messaging and device differences.

| Configuration | Published median | Refined median |
| --- | ---: | ---: |
| Default | 67 ms | 26 ms |
| Neutral hue change | 67 ms | 22 ms |
| Brand hue change | 63 ms | 25 ms |
| Muted distance change | 82 ms | 38 ms |
| Six surfaces | 89 ms | 48 ms |
| Selected states | 72 ms | 30 ms |
| Exact Brand lock | 68 ms | 22 ms |
| Wide-gamut lock | 75 ms | 30 ms |

A single constrained muted-distance balance request dropped from 1,132 ms to 502 ms. First default generation, before warming the caches, was roughly unchanged: 88 ms versus 86 ms. Measurements are representative, not a guarantee for every input.

## Changes

- Cache generated OKLCH conversions by full-precision normalized coordinates. Return independent color objects so callers cannot mutate the retained cache value.
- Share RGB conversion, gamut status and luminance by exact CSS string, including across cloned objects. Compute color identity only when requested.
- Bound each persistent cache to 16,384 entries with FIFO eviction.
- Avoid temporary constraint arrays in the hot contrast-scoring loop.
- Reuse identical generated candidates within one balance request, including candidates that fail checks. The cache is discarded after that request.

## Repeat profiling

```sh
COLOR_BENCHMARK=1 pnpm exec vitest run src/engine/calculation-profile.test.ts --pool=forks
```

The command writes timing/fingerprint data to `/tmp/color-calculation-report.json` and a V8 CPU profile to `/tmp/color-calculation-profile.json`. The profiler is skipped during ordinary tests. `calculation-parity.test.ts` compares complete output fingerprints captured from published commit `a4bd1af`, including failed wide-gamut checks and a limited request.
