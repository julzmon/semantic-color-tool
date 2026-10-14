# Complete token previews implementation plan

**Goal:** Show every generated semantic token in Overview and remove redundant navigation and code.

**Architecture:** A typed preview catalog maps generated roles to demonstrations and resolves exact semantic selections for the existing inspector. ThemePreview renders contextual alerts/input and all three token sections. No generation behavior changes.

**Tech stack:** Svelte 5, TypeScript, CSS, Vitest.

## Completed tasks

- [x] Catalog tests cover exact semantics in both modes, custom prefixes, link aliases, selected-state inclusion, anchor status, and one/six surfaces.
- [x] Render all family fills, states, foregrounds, solid borders, global text, link aliases, and nested surfaces together in each theme.
- [x] Preserve contextual alerts and editable input. Remove sample action buttons, helper text, coverage toolbar, all preview filters, and flat surfaces.
- [x] Reuse the inspector in a dismissible native dialog with exact semantic selection and full contrast labels.
- [x] Remove Color roles, Matrix, StateOverview, ModeSwitch, obsolete selection fields/helpers, and unused CSS. Clean unused imports and enforce noUnusedLocals/noUnusedParameters.
- [x] Verify 176 passing tests (one opt-in profile skipped), zero Svelte diagnostics, production build, 13 PWA assets, no unreferenced UI components, diff checks, code review, and browser navigation/inspection.
- [ ] Publish through the existing main-branch GitHub Pages workflow and verify the live version.
