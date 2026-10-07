# Svelte migration design

Approved scope: migrate the existing application to the latest stable Svelte release while retaining Vite, TypeScript, all current styles, and all user-facing behavior.

The pure TypeScript engine and configuration utilities remain unchanged. Convert React components into Svelte 5 components using typed props, reactive state, derived values, and callback props. Extract the existing internal UI components into individual files without redesigning them. Preserve local configuration persistence, reset semantics, last-valid-result recovery, preview interactions, Brand anchors, semantic inspection, filters, and exports.

Use the Svelte Vite plugin and svelte-check in the production build. Preserve relative asset paths and GitHub Pages deployment. Remove React runtime, types, JSX configuration, and entry point. Port static preview assertions to Svelte server rendering and verify interactive behavior in the browser.

Completion requires passing existing engine tests, migrated UI tests, Svelte/TypeScript checks, and the production build, plus browser checks of controls, tabs, persistence, and exports.
