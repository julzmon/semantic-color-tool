# Quality cleanup plan

Approved scope: implement the seven findings in the code quality assessment, without changing the color strategy.

- [x] Add regressions for untouched/partially edited anchor precision, denied storage getters, ordinary versus modal keyboard navigation, and per-mode exact sources.
- [x] Fix UI input commits, acquire storage safely once, and scope keyboard trapping to the opened drawer with visible focus candidates.
- [x] Preserve each mode's exact base source during shared reconciliation; remove the unused duplicate solver and obsolete engine metadata.
- [x] Remove orphan CSS selectors while preserving active grouped branches.
- [x] Run focused/full tests, production build/PWA checks, browser behavior checks, and review the final changes.

Completed: 240 tests passed, 1 skipped; build, type check, PWA verification, eight browser behavior checks, and follow-up review passed. CSS class scan has zero unmatched runtime class names.
