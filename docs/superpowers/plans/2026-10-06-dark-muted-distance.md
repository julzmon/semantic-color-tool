# Dark Muted Distance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the builder independent light and dark muted-distance controls while retaining compatibility with saved version-2 configurations that use one numeric distance.

**Architecture:** Store new settings as a `{ light, dark }` record and expose a mode resolver alongside the existing surface-step resolver. Normalize old numeric values at configuration boundaries and before generation. The generator reads the active mode's value; the UI emits the normalized record.

**Tech Stack:** React 19, TypeScript, Vitest, Vite.

---

### Task 1: Specify and test mode-specific muted distance

**Files:**
- Modify: `src/engine/generate.test.ts`
- Modify: `src/ui/configuration.test.ts`
- Modify: `src/engine/reference.test.ts`

- [ ] **Step 1: Write failing engine tests**

Add a test that supplies `muted.distance: { light: 0.07, dark: 0.16 }`, then asserts the light muted role matches a legacy numeric `0.07` configuration while the dark muted role is lighter than the legacy configuration. Assert every generated role for each family still has equal lightness within its mode and all checks pass.

- [ ] **Step 2: Run the targeted engine test**

Run: `npm test -- src/engine/generate.test.ts`

Expected: fail because `muted.distance` only accepts a number and generation reads the shared scalar.

- [ ] **Step 3: Write failing configuration tests**

Add a configuration-import test for an existing numeric `muted.distance` value. Assert that parsing returns `{ light: value, dark: value }`. Update the reference-default expectation to the same record shape.

- [ ] **Step 4: Run the targeted configuration tests**

Run: `npm test -- src/ui/configuration.test.ts src/engine/reference.test.ts`

Expected: fail because imported and default configurations still expose a numeric distance.

### Task 2: Normalize and use distances by mode

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/config.ts`
- Modify: `src/engine/generate.ts`
- Modify: `src/ui/configuration.ts`

- [ ] **Step 1: Add the mode-aware configuration contract**

Change `BuilderConfig.muted.distance` to `number | Record<Mode, number>`. Add a `mutedDistance(config, mode)` helper that returns the legacy scalar for either mode or the selected record value.

- [ ] **Step 2: Normalize defaults and imported configurations**

Set the new default muted distance to `{ light: 0.055, dark: 0.16 }`. Update configuration normalization to convert a numeric imported value into equal light and dark values, and reject malformed records through existing runtime validation.

- [ ] **Step 3: Use the active-mode distance during generation**

Validate both resolved distances, use `mutedDistance(config, mode)` in muted generation, and normalize cloned generator output to the record shape. Do not change state separation, gamut mapping, contrast, or reuse behavior.

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- src/engine/generate.test.ts src/ui/configuration.test.ts src/engine/reference.test.ts`

Expected: all targeted tests pass.

### Task 3: Expose the two controls

**Files:**
- Modify: `src/ui/Controls.tsx`

- [ ] **Step 1: Replace the shared slider with mode-specific sliders**

Use `mutedDistance(config, mode)` for the displayed value. On change, preserve the other mode's resolved value and write `{ light, dark }`. Use the labels **Light muted distance** and **Dark muted distance**. Keep the light range at `-0.08..0.16`, and use `-0.08..0.25` for dark, with a `0.005` step.

- [ ] **Step 2: Update the control guidance**

Explain that increasing the dark distance lifts muted semantic fills above the dark surface and can retain more chroma in sRGB.

- [ ] **Step 3: Run the build**

Run: `npm run build`

Expected: TypeScript and Vite complete without errors.

### Task 4: Verify complete behavior

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the independent mode values**

Update the builder-scope description to state that muted distance is independently adjustable by mode, dark defaults to `0.16`, and legacy saved values apply to both modes.

- [ ] **Step 2: Regenerate checked-in default examples**

Run: `node scripts/export-example.mjs`

Expected: generated CSS and DTCG examples reflect the new default dark muted colors.

- [ ] **Step 3: Run the full suite and production build**

Run: `npm test && npm run build`

Expected: every test passes and the production bundle builds.

- [ ] **Step 4: Check the running preview**

Set **Dark muted distance** to `0.16` with the default configuration. Confirm dark preview alerts visibly gain saturation, the light preview remains unchanged, and no error banner appears.
