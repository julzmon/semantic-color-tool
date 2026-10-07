# Semantic Color System Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product and make generated tokens use a persistent editable prefix while retaining `kds` as the default.

**Architecture:** Add `prefix` to `BuilderConfig`; migration supplies `kds` when it is absent. One name helper supplies the prefix to generation and exports, while the UI edits only valid normalized values.

**Tech Stack:** React, TypeScript, Vite, Vitest, Culori.

---

### Task 1: Add and migrate prefix configuration

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/config.ts`
- Modify: `src/engine/generate.ts`
- Modify: `src/ui/configuration.ts`
- Test: `src/ui/configuration.test.ts`

- [ ] **Step 1: Write a failing migration test**

```ts
it('uses kds when a legacy configuration has no prefix', () => {
  const input = defaults();
  delete (input as Partial<BuilderConfig>).prefix;
  expect(parseConfigurationJson(JSON.stringify(input), defaults()).prefix).toBe('kds');
});
```

- [ ] **Step 2: Run `npm test -- src/ui/configuration.test.ts` and confirm the new test fails.**

- [ ] **Step 3: Add `prefix: string` to `BuilderConfig`, set `prefix: 'kds'` in `configFromReference`, and normalize a missing import prefix to `kds`. Validate `/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/` in `validateConfig`.**

- [ ] **Step 4: Run `npm test -- src/ui/configuration.test.ts` and confirm it passes.**

- [ ] **Step 5: Commit `git add src/engine/types.ts src/engine/config.ts src/engine/generate.ts src/ui/configuration.ts src/ui/configuration.test.ts && git commit -m "Add persistent token prefix configuration"`.**

### Task 2: Generate names from the configured prefix

**Files:**
- Modify: `src/engine/generate.ts`
- Modify: `src/engine/tokens.ts`
- Modify: `src/engine/export.ts`
- Test: `src/engine/generate.test.ts`
- Test: `src/engine/export.test.ts`

- [ ] **Step 1: Write a failing custom-prefix test.**

```ts
const result = generateSystem({ ...config(), prefix: 'acme-ui' });
expect(result.primitives[0].name).toMatch(/^--acme-ui-key-/);
expect(result.semantics.every((token) => token.name.startsWith('--acme-ui-'))).toBe(true);
expect(exportCss(result)).toContain('--acme-ui-bg-surface-base');
```

- [ ] **Step 2: Run `npm test -- src/engine/generate.test.ts src/engine/export.test.ts` and confirm it fails.**

- [ ] **Step 3: Add `tokenName(prefix, suffix)` returning ``--${prefix}-${suffix}``; use it for semantic, primitive, link-alias, surface, CSS component, and nested-mode names. Rename the export banner to `Semantic Color System Generator`.**

- [ ] **Step 4: Run `npm test -- src/engine/generate.test.ts src/engine/export.test.ts` and confirm it passes.**

- [ ] **Step 5: Commit `git add src/engine/generate.ts src/engine/tokens.ts src/engine/export.ts src/engine/generate.test.ts src/engine/export.test.ts && git commit -m "Generate tokens with the configured prefix"`.**

### Task 3: Rename the product and expose the prefix control

**Files:**
- Modify: `src/ui/Controls.tsx`
- Modify: `src/ui/BrandAnchors.tsx`
- Modify: `src/ui/presentation.ts`
- Modify: `src/App.tsx`
- Modify: `index.html`
- Modify: `package.json`
- Modify: `README.md`
- Test: `src/ui/configuration.test.ts`

- [ ] **Step 1: Write a storage round-trip test with `input.prefix = 'acme'` and expect restored `config.prefix` to equal `acme`.**

- [ ] **Step 2: Run `npm test -- src/ui/configuration.test.ts` and confirm the regression test passes after Task 1.**

- [ ] **Step 3: Add a labelled `Token prefix` input with help text `Letters, numbers, and hyphens; exported as --prefix-*.` Update configuration only with a normalized valid value. Rename all public names to `Semantic Color System Generator`; remove public KDS source comparison, reference copy, and resolver filenames.**

- [ ] **Step 4: Run `npm test -- src/ui/configuration.test.ts src/ui/brandAnchor.test.ts`, then verify in Vite that `acme-ui` changes Export token names and Reset restores `kds`.**

- [ ] **Step 5: Commit `git add src/ui/Controls.tsx src/ui/BrandAnchors.tsx src/ui/presentation.ts src/App.tsx index.html package.json README.md src/ui/configuration.test.ts && git commit -m "Rename the semantic color system generator"`.**

### Task 4: Verify and publish

**Files:**
- Verify: all modified files

- [ ] **Step 1: Run `npm test && npm run build`; expect all tests and the production build to pass.**

- [ ] **Step 2: Run `git diff --check`, commit any final corrections, and `git push`; expect a clean worktree and a successful GitHub Pages deployment.**
