# Svelte Migration Implementation Plan

> Execution: inline in the current checkout to retain the user's existing Svelte dependency additions.

**Goal:** Replace React with the latest stable Svelte while preserving the color builder.

**Architecture:** Pure TypeScript engine and global stylesheet stay intact. Typed Svelte components replace React render functions; state uses runes and callback props.

**Tech Stack:** Svelte 5, TypeScript, Vite, Vitest, svelte-check, pnpm.

- [x] Verify latest stable packages from npm and run baseline tests.
- [x] Port ThemePreview assertions to `render(ThemePreview, { props: { system, mode } }).body` from `svelte/server`; verify failure before adding components.
- [x] Convert App and its internal components, Controls and Slider, BrandAnchors and AnchorCard, ThemePreview and nested cards, and ExportPanel. Keep current DOM classes, labels, styles, callbacks, and error handling.
- [x] Replace entry point with `mount(App, { target })`, enable `svelte()` in Vite, remove JSX configuration and React packages, add `svelte-check --tsconfig ./tsconfig.json` to the build, and refresh the lockfile.
- [x] Run `pnpm test` and `pnpm run build`; resolve compiler/type failures before proceeding.
- [x] Inspect browser interactions for controls, previews, matrices, anchors, exports, persistence, reset, and invalid import handling.
- [x] Update README component paths and validation instructions, review diff, and report verification evidence.

## Verification

- npm registry latest stable Svelte: 5.57.2. Vite 7 uses compatible Svelte plugin 6.2.4.
- `pnpm test`: 75 tests pass across 12 suites.
- `pnpm run build`: Svelte checking reports zero errors and warnings; production output builds successfully.
- `pnpm install --frozen-lockfile --offline`: lockfile is current and installation succeeds.
- `git diff --check`: no whitespace errors. React dependencies and source imports are removed.
- Browser checks: preview edit/save, surface controls, reload persistence, anchors/edit/lock/removal, semantic inspector, contrast filters, theme switching, primitive palette, CSS and DTCG output, dynamic export namespace, download status, invalid import rejection, valid configuration import, reset followed by edits and reload, and invalid/uppercase token prefix normalization.
- Code review found a controlled-input restoration difference in the prefix field. Reproduced in the browser, fixed by restoring accepted text, and verified with invalid and uppercase/whitespace input.
- Original browser configuration restored after interactive checks; no console errors or warnings observed.
