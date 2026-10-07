# Semantic Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product preview expose all six semantic families through realistic UI components.

**Architecture:** Keep token generation unchanged. `ThemePreview.tsx` will render a small fixed status-card data set and annotate components with family data attributes; `styles.css` will resolve those attributes through the existing semantic variables. A server-render test will assert the intended preview composition without adding a browser-test dependency.

**Tech Stack:** React 19, TypeScript, Vitest, generated CSS custom properties.

---

### Task 1: Specify semantic preview content with a failing render test

**Files:**
- Create: `src/ui/ThemePreview.test.tsx`
- Modify: `src/ui/ThemePreview.tsx`

- [x] **Step 1: Write the failing test**

```tsx
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { generateSystem } from '../engine/generate';
import { configFromReference, parseKdsTokens } from '../engine/reference';
import { ThemePreview } from './ThemePreview';

const source = readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8');
const system = generateSystem(configFromReference(parseKdsTokens(source)));

describe('ThemePreview', () => {
  it('renders Brand as the primary action and every status family', () => {
    const markup = renderToStaticMarkup(<ThemePreview system={system} mode="light" />);
    expect(markup).toContain('data-family="brand"');
    for (const family of ['info', 'positive', 'warning', 'negative']) {
      expect(markup).toContain(`data-family="${family}"`);
    }
  });
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/ui/ThemePreview.test.tsx`

Expected: failure because the existing preview does not render `data-family="brand"` or the four status-family attributes.

- [x] **Step 3: Add the minimal preview structure**

Add this typed collection above `ThemePreview` and use it to render the cards:

```tsx
type PreviewStatusFamily = 'info' | 'positive' | 'warning' | 'negative';

export const previewStatusUpdates: ReadonlyArray<{
  family: PreviewStatusFamily;
  icon: string;
  title: string;
  description: string;
}> = [
  { family: 'info', icon: 'i', title: 'You’re all up to date', description: 'Your changes are ready for the team.' },
  { family: 'positive', icon: '✓', title: 'Ready to share', description: 'The project passed its latest review.' },
  { family: 'warning', icon: '!', title: 'Review needed', description: 'Two comments need attention.' },
  { family: 'negative', icon: '×', title: 'Action required', description: 'A task is blocking this release.' },
];
```

Replace the single alert with:

```tsx
<section className="preview-statuses" aria-labelledby={`status-updates-${mode}`}>
  <span className="preview-overline" id={`status-updates-${mode}`}>STATUS UPDATES</span>
  <div className="preview-status-grid">
    {previewStatusUpdates.map((status) => <div className="preview-alert" data-family={status.family} key={status.family}>
      <span className="info-icon" aria-hidden="true">{status.icon}</span>
      <div><strong>{status.title}</strong><p>{status.description}</p></div>
    </div>)}
  </div>
</section>
```

Set `data-family="brand"` on the existing primary button and retain its saved/reset behavior.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/ui/ThemePreview.test.tsx`

Expected: 1 passing test.

### Task 2: Bind the preview components to generated semantic roles

**Files:**
- Modify: `src/styles.css`

- [x] **Step 1: Style the status group**

Add this base layout, then add the existing narrow-preview media query override for one column:

```css
.preview-statuses { margin-block: 20px; }
.preview-statuses > .preview-overline { display: block; margin-block-end: 8px; }
.preview-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.preview-alert { display: flex; align-items: flex-start; gap: 9px; min-inline-size: 0; margin: 0; padding: 12px; border: 1px solid transparent; border-radius: 5px; }
```

At the existing `620px` narrow-preview breakpoint, set `.preview-status-grid { grid-template-columns: minmax(0, 1fr); }`.

- [x] **Step 2: Map existing tokens directly**

Use these declarations for the Brand primary action:

```css
.preview-primary[data-family="brand"] { background: var(--kds-bg-brand-emphasis-base); color: var(--kds-fg-on-emphasis); }
.preview-primary[data-family="brand"]:hover { background: var(--kds-bg-brand-emphasis-hover); }
.preview-primary[data-family="brand"]:active { background: var(--kds-bg-brand-emphasis-active); }
```

For each status-card family, use the corresponding `--kds-bg-<family>-muted-base`, `--kds-border-<family>-muted-base`, and `--kds-fg-<family>-base` tokens. Do not add hard-coded status colors.

```css
.preview-alert[data-family="info"] { background: var(--kds-bg-info-muted-base); border-color: var(--kds-border-info-muted-base); color: var(--kds-fg-info-base); }
.preview-alert[data-family="positive"] { background: var(--kds-bg-positive-muted-base); border-color: var(--kds-border-positive-muted-base); color: var(--kds-fg-positive-base); }
.preview-alert[data-family="warning"] { background: var(--kds-bg-warning-muted-base); border-color: var(--kds-border-warning-muted-base); color: var(--kds-fg-warning-base); }
.preview-alert[data-family="negative"] { background: var(--kds-bg-negative-muted-base); border-color: var(--kds-border-negative-muted-base); color: var(--kds-fg-negative-base); }
```

- [x] **Step 3: Verify the focused test stays green**

Run: `npm test -- src/ui/ThemePreview.test.tsx`

Expected: 1 passing test.

### Task 3: Validate rendered behavior

**Files:**
- Modify: `docs/superpowers/plans/2026-10-06-semantic-preview.md`

- [x] **Step 1: Run static verification**

Run: `npm test && npm run build`

Expected: every Vitest suite passes and Vite emits a production bundle without TypeScript errors.

- [x] **Step 2: Inspect each preview mode**

Open the existing local Vite application. Inspect Light, Dark, and Split modes; hover the primary action in each mode; confirm all four status cards show their family background, muted border, and readable text.

- [x] **Step 3: Mark completed steps**

Replace the three task checklists with checked items only after the associated evidence is complete.
