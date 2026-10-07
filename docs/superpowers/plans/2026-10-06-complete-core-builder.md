# Complete KDS color-system builder implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the core builder by generating all six KDS semantic families, adding an OKLCH-only Brand lock editor, and allowing configurations to persist and be restored.

**Architecture:** Generalize the existing shared-lightness constraint solver from two family IDs to metadata-driven semantic families. Neutral owns the gray surface palette. Brand is seeded from the KDS red reference but owns an independent generated `brand` namespace, while Negative retains the generated `red` namespace. Brand anchors remain exact constraints. Persist validated configurations in browser storage, and let the Configuration export be re-imported after validation.

**Tech Stack:** TypeScript, React, Vite, Culori, PostCSS, Vitest, native File API and `localStorage`.

---

### Task 1: Generalize the pure color engine

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/config.ts`, `src/engine/generate.ts`, `src/engine/reuse.ts`
- Test: `src/engine/generate.test.ts`, `src/engine/reuse.test.ts`, `src/engine/reference.test.ts`

- [x] Write failing tests that reference Brand, Positive, Negative, and Warning, verify shared corresponding lightness, all semantic names, and an exact Brand anchor.
- [x] Run the focused tests and confirm the current two-family contract rejects the six-family config.
- [x] Replace two-family unions with metadata-driven `FamilyId` and palette-key collections; derive defaults from reference gray/red/blue/green/yellow colors.
- [x] Preserve public Brand/Positive/Negative/Warning semantic names and use the common solver for all families. Do not change muted-state spacing or exact-anchor behavior.
- [x] Give Brand its own generated `brand` primitive namespace, seeded from KDS red, while Negative retains `red` primitives.
- [x] Run the focused engine tests.

### Task 2: Generalize CSS and DTCG output

**Files:**
- Modify: `src/engine/tokens.ts`, `src/engine/export.ts`
- Test: `src/engine/export.test.ts`, `src/engine/tokens.test.ts`, `src/engine/terrazzo.test.ts`

- [x] Write failing export tests for all semantic families and a divergent Brand/Negative palette.
- [x] Generalize primitive paths and component hue bookkeeping so variants retain their own hue/chroma values.
- [x] Derive export titles and configuration scope from `system.config.families`.
- [x] Run output and Terrazzo tests.

### Task 3: Add Brand control and configuration lifecycle

**Files:**
- Create: `src/ui/BrandAnchors.tsx`, `src/ui/configuration.ts`
- Modify: `src/ui/Controls.tsx`, `src/ui/ExportPanel.tsx`, `src/App.tsx`, `src/styles.css`
- Test: `src/ui/configuration.test.ts`

- [x] Write failing tests for accepting direct configuration JSON and exported configuration documents, rejecting malformed/incompatible input, and preserving exact OKLCH Brand anchors.
- [x] Add an accessible Brand-only control section with labeled L/C/H number inputs, semantic role and mode selects, lock toggle, and deletion. Color source stays `oklch(L C H)`; no HEX conversion field is introduced.
- [x] Add browser persistence after a valid change and restore it at startup. Reset clears stored configuration and restores KDS defaults.
- [x] Add Configuration import from a local JSON file. Validate with the engine before replacing live state; expose a status message for success or parsing/validation failure.
- [x] Update family-dependent app headings, matrix captions, palette display, inspector labels, and export descriptions.

### Task 4: Finish and verify

**Files:**
- Modify: `README.md`, `docs/examples/*`, `docs/superpowers/plans/2026-10-06-complete-core-builder.md`

- [x] Update scope and architecture documentation for all family generators, Brand locks, persistence, and import.
- [x] Regenerate export examples with `node scripts/export-example.mjs`.
- [x] Run `npm test`, `npm run build`, inspect default browser output, create a Brand anchor, reload, import its export, and inspect a nested mode preview.
