# App code and performance review — 2026-10-22

## Resolution — 2026-10-23

All six confirmed findings below are addressed. Import validation rejects duplicate IDs before migration; desktop settings lose modal semantics/keyboard containment and App clears stale open state at the breakpoint. Initialization and Reset use the balance worker, with loading, retry, saved-state preservation and stale-result handling covered by mounted tests. Verified token foundations/CSS models are prepared in that worker and adopted before UI updates; DTCG shares the verified foundation and caches documents. Shared cache data is protected from mutation while public systems and Svelte proxy callers remain supported. Full diagnostics unmount when the popup/details close or the user leaves Overview.

Also fixed variant DTCG palette paths and floating-point boundary noise that triggered unsolicited slider edits. Deployment now requires tests, build and PWA checks. Default test concurrency is one worker to avoid the reproduced CPU-contention timeout without changing solver assertions or timeouts.

**Final verification:** 358 tests passed, one opt-in profiling test skipped, zero failures across 49 test files. Production build passed with zero Svelte errors/warnings. PWA verification and `git diff --check` passed. Browser checks covered worker startup, Reset completion, popup/details/feasibility rendering, keyboard close-button access, Escape focus restoration, and CSS/DTCG export loading. Breakpoint transitions have mounted matchMedia regression coverage; a physical mobile/cross-browser run and a persistent automated real-browser test suite remain outside this change.

**Local before/after probe:** preparing the verified model takes about 46.36 ms in the worker; UI cache adoption takes 0.41 ms and first preview-style use 0.27 ms, compared with about 50 ms previously on the UI thread. DTCG bundle plus source files take 2.22 ms initially and 0.49 ms cached, compared with about 87 ms previously. These Node probes exclude worker transfer and browser rendering. Main JavaScript decreased from 250.19 kB / 85.37 kB gzip to 230.15 kB / 79.04 kB gzip; the balance worker increased from 78.60 kB to 83.55 kB.

The original findings and measurements are retained below as review history. No deployment or commit was performed.

## Assessment

The architecture remains appropriate: pure generation and balancing modules, workers for interactive solving, bounded caches, shared verified CSS serialization, and lazy palette/export views. A rewrite is not justified by this review.

Two functional defects were confirmed: settings retain modal behavior after a mobile-to-desktop resize, and duplicate family IDs in current-version imports can silently replace a missing family with defaults. The primary performance opportunities are synchronous startup and verified serialization on the UI thread, plus duplicate DTCG work.

This is a source review with targeted runtime probes and local calculation benchmarks. It is not a complete browser performance profile, WCAG certification, security audit, or cross-browser/device test.

## Scope and verification

Reviewed startup and state updates; controls and asynchronous edits; generation, balancing, feasibility, color caches and primitive reuse; previews, inspection and contrast tables; configuration persistence/import; CSS/DTCG/configuration export; worker protocols; PWA updates; production bundling and deployment checks.

- Production build: passed; Svelte check reported zero errors and zero warnings.
- PWA build verification: passed; 14 cached assets, calculation worker, relative scope and icon dimensions verified.
- Default parallel test run: 336 passed, one skipped, one failed by exceeding the five-second timeout in `feasibility.test.ts:200`. The same timeout occurred in the earlier popup review; that test passed in isolation.
- Single-worker full-suite run (`npx vitest run --maxWorkers=1 --minWorkers=1`): 337 passed, one skipped, zero failures; 39.08 seconds total. The previously timed-out case completed in 3.52 seconds. This supports a load-sensitive timeout; it does not establish deterministic failure of the solver assertions.
- Prior focused browser checks in this session passed for native popup opening, Tab access to the close button, Escape dismissal with focus restoration, and outside-click dismissal.
- No application source changes were made during this review.

## Findings, in recommended order

### 1. P2 — Settings retain modal behavior after resizing to desktop

**Locations:** [Controls.svelte:23](/Users/juliankovalsky/Projects/color-tool/src/ui/Controls.svelte:23), [Controls.svelte:91](/Users/juliankovalsky/Projects/color-tool/src/ui/Controls.svelte:91), [App.svelte:78](/Users/juliankovalsky/Projects/color-tool/src/App.svelte:78), [settingsKeyboard.ts:17](/Users/juliankovalsky/Projects/color-tool/src/ui/settingsKeyboard.ts:17).

**Trigger:** Open settings at a viewport width of 760px or less, then widen above 760px.

**Impact:** The media-query listener updates only the Controls component's `compact` state. App's `settingsOpen` remains true, preserving `aria-modal="true"` and Tab wrapping in the desktop sidebar. Desktop CSS hides the close button, backdrop and settings toggle. Escape still provides a workaround, so this is not an inescapable keyboard trap.

**Evidence:** Source control flow plus a targeted runtime probe of the actual keyboard handler confirmed that persistent `open=true` prevents Tab at the last control and wraps focus to the first. The viewport transition itself was established from source, not exercised in a browser during this whole-app pass.

**Recommendation:** Share the compact-layout state with App and derive modal behavior from `compact && settingsOpen`, or close the drawer when leaving compact layout. Restore focus to a visible target. Add a resize regression test covering role, modal state and keyboard traversal.

### 2. P2 — Duplicate family IDs silently alter imported settings

**Location:** [configuration.ts:119](/Users/juliankovalsky/Projects/color-tool/src/ui/configuration.ts:119).

**Trigger:** Import a current-version configuration with six entries containing duplicate Neutral and no Brand: `neutral, neutral, info, positive, negative, warning`.

**Impact:** The length and supported-ID checks pass. Building a Map collapses the duplicate, and normalization fills the missing Brand from defaults before engine validation. Import can report success despite losing the missing family's settings.

**Evidence:** A runtime probe accepted that input and returned six unique IDs with Brand hue/chroma restored from defaults. Engine validation correctly checks unique families, but normalization removes the evidence before it runs.

**Recommendation:** Validate imported ID uniqueness and current-version required IDs before normalization. Preserve explicitly intended older-version migrations. Add a regression test with a correct-length array containing duplicate IDs.

### 3. P2 — Verified serialization blocks UI rendering after worker results

**Locations:** [presentation.ts:10](/Users/juliankovalsky/Projects/color-tool/src/ui/presentation.ts:10), [tokens.ts:60](/Users/juliankovalsky/Projects/color-tool/src/engine/tokens.ts:60), [tokens.ts:182](/Users/juliankovalsky/Projects/color-tool/src/engine/tokens.ts:182).

**Trigger:** An accepted edit produces a new GeneratedSystem and the preview requests its first CSS model.

**Impact:** Balancing happens in a worker, but the first `cssTokenModel()` call still runs verified coordinate shortening synchronously in the UI rendering path. For each candidate rounded component it reconstructs palette colors and rechecks contrast relationships. The cache helps repeated use of one system, but every accepted edit creates a new system.

**Evidence:** Default-system `previewStyle()` took 50.48 ms for the first model, then 0.18–0.22 ms for repeated calls on that system. Independent probes measured 310–338 ms for valid imported 32-surface configurations with 0.001 spacing. These are Node timings, not browser frame or INP measurements.

**Recommendation:** Prepare the verified model in the calculation worker and return it with the accepted system, or render previews from verified generated colors while deferring compact serialization. Preserve contrast/recipe parity and exact sources. If shortening remains synchronous, index validation by affected components rather than rechecking the entire system for each candidate.

### 4. P2 — DTCG export repeats identical foundation validation

**Locations:** [ExportPanel.svelte:37](/Users/juliankovalsky/Projects/color-tool/src/ui/ExportPanel.svelte:37), [export.ts:42](/Users/juliankovalsky/Projects/color-tool/src/engine/export.ts:42), [tokens.ts:228](/Users/juliankovalsky/Projects/color-tool/src/engine/tokens.ts:228).

**Trigger:** Display DTCG output for a new accepted system.

**Impact:** `exportDtcg()` and `exportDtcgFiles()` each invoke `dtcgDocuments()` independently. Each rebuilds the same verified foundation. The UI needs both the bundle and file list, so it incurs both costs.

**Evidence:** Default-system calls took approximately 43–46 ms each, or about 87 ms combined, excluding rendering. The engine probe measured approximately 309 ms per call for a valid 32-surface import. CSS-model caching does not cache the DTCG foundation.

**Recommendation:** Build the foundation/documents once per system and reuse both representations. Preserve mutable-input invalidation behavior already tested for the CSS model, or explicitly use immutable accepted systems internally.

### 5. P2 — Startup and Reset still balance synchronously

**Locations:** [App.svelte:37](/Users/juliankovalsky/Projects/color-tool/src/App.svelte:37), [App.svelte:102](/Users/juliankovalsky/Projects/color-tool/src/App.svelte:102).

**Trigger:** Initial mount, restoring saved settings, or Reset.

**Impact:** The component runs balancing before it can render; the interactive balance worker is created later in `onMount`. A saved configuration using Prefer shared colors can delay the initial interface. Reset also performs this work on the UI thread.

**Evidence:** Default balancing took 128.37 ms on its first measured call and 44.65–46.61 ms on subsequent calls. Restoring the default configuration with Prefer shared colors took 527.12 ms first and 380.95–410.11 ms subsequently. These measurements exclude module/network loading and DOM rendering.

**Recommendation:** Render a lightweight initialization state, then initialize/restore through the worker. Reuse a verified default result for Reset where appropriate. Keep restoration errors and saved-state handling explicit.

### 6. P2 — Expanded diagnostics remain computationally active after dismissal

**Locations:** [FeasibilityDetails.svelte:6](/Users/juliankovalsky/Projects/color-tool/src/ui/FeasibilityDetails.svelte:6), [App.svelte:210](/Users/juliankovalsky/Projects/color-tool/src/App.svelte:210).

**Trigger:** Expand Allowed lightness and sharing, then close the popup or its containing details and change selection/configuration.

**Impact:** The mounted component retains its own open state. Ancestor dismissal does not gate the derived feasibility calculation, so subsequent changes can recompute a report the user cannot see.

**Evidence:** The feasibility derived expression depends on its local open flag and input properties, not ancestor visibility. Earlier default Brand-foreground probes in this session took 25–50 ms per calculation.

**Recommendation:** Gate computation on popup and ancestor-detail visibility, or unmount expensive diagnostic content when closed. Cache reports per system/selection if repeated reopening is common.

## Verification and lower-priority gaps

- **Deployment does not gate on tests or PWA verification.** [deploy-pages.yml:29](/Users/juliankovalsky/Projects/color-tool/.github/workflows/deploy-pages.yml:29) runs the build, then uploads/deploys. Add the test suite and `verify:pwa` before upload. Investigate the timeout under parallel load; do not simply remove the expensive correctness case or raise its timeout without understanding its runtime.
- **Browser regression coverage is missing.** Most layout/popup checks assert server-rendered markup or use happy-dom. Add a small real-browser suite for responsive settings, anchor changes, popup collision placement, native dismissal and worker-driven edits. PWA helper tests do not exercise the component's registration/reload callbacks.
- **DTCG variant namespace inconsistency:** [tokens.ts:199](/Users/juliankovalsky/Projects/color-tool/src/engine/tokens.ts:199) parses `--kds-key-gray-2000-2` as `palette["gray-2000"]["2"]`, rather than `palette.gray["2000-2"]`. Reproduced using neutral exact locks with equal lightness and different chroma. References remain internally resolvable; this is a lower-priority structural inconsistency, not broken token resolution. Add a variant fixture before changing it.
- **Do not prioritize slider gradient optimization without a browser profile.** The current aggregate track probe measured 4.31 ms first and 0.52–0.72 ms warm, substantially below serialization and startup costs.

## Measured baseline

Local Node/Vite SSR probes on this machine. First measured calls are distinguished from subsequent calls; module loading is excluded. Results are indicative and are not performance budgets or guarantees on user devices.

| Operation | First measured call | Subsequent calls |
| --- | ---: | ---: |
| Default startup balancing | 128.37 ms | 44.65–46.61 ms |
| Prefer shared startup balancing | 527.12 ms | 380.95–410.11 ms |
| Preview CSS model/style | 50.48 ms | 0.18–0.22 ms, same system |
| DTCG bundle | 45.91 ms | 43.33–43.80 ms |
| DTCG source files | 43.83 ms | 43.57–46.31 ms |
| Configuration JSON serialization | 0.81 ms | 0.66–0.74 ms |
| Aggregate representative control tracks | 4.31 ms | 0.52–0.72 ms |

Production assets: main JavaScript 250.19 kB / 85.37 kB gzip; CSS 47.23 kB / 9.48 kB gzip; balance worker 78.60 kB; availability worker 82.62 kB. Palette and export views are separately chunked. These sizes alone do not establish a performance defect.

## Limits and next work

Prioritize the two functional defects, then share/offload verified serialization and move startup/Reset off the UI thread. Add targeted regressions and deployment gates alongside those fixes. Preserve numerical parity, exact locks, full contrast checks, bounded searches and existing stale-result handling.

Before claiming UI performance improvements, capture production-browser startup and edit-to-paint traces on desktop and a representative mobile device, including six surfaces, selected states, Prefer shared colors, exact anchors and expanded diagnostics. This review did not measure browser LCP, INP, heap growth or touch gestures. It did not run an automated dependency vulnerability or unused-code scanner. The optional UI context/detector launcher was not executable; the modern web guidance package was not available in the offline npm cache. Neither limitation affected source inspection, builds, tests or local runtime probes.
