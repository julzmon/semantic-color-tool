# Global CSS components implementation plan

**Goal:** Restore useful shared component tokens with globally declared settings and recipes.

**Architecture:** Extend the existing cached CSS model with a minimal component list derived from its verified foundation. Keep generation and DTCG unchanged.

- [x] Update export tests to require shared component references and root-only declarations; run to establish expected failures.
- [x] Add only referenced L/C/H components to `cssTokenModel`, deduplicate chroma within families, preserve locked literals and semantic aliases. Include components in preview and export statistics.
- [x] Place every custom property in `:root`; retain color-scheme selectors and surface/foreground boundary paints.
- [x] Run CSS/DTCG/preview parity tests, full tests and build. Verify nested schemes and root numeric overrides in a browser.
- [x] Update README and example CSS, report counts and global override behavior.

Verification: 230 tests passed, 1 skipped; Svelte check reported 0 errors/warnings; production build and PWA verification passed. Browser compared 2,541 colors across six configurations, nested modes, and global component/weight overrides with no failures.

Review caught an equal-color exact-lock alias issue; source-aware aliases and mode collapsing now preserve locks. Both-mode and dark-only regression tests pass; follow-up review has no remaining findings.
