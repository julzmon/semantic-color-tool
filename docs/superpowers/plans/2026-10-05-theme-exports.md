# CSS theming and DTCG implementation plan

> **Historical implementation note.** This plan introduced the shared-lightness and DTCG foundation before the six-family expansion. Current family scope and Brand behavior are documented in [the completed builder plan](2026-10-06-complete-core-builder.md).

**Goal:** Implement the shared discussion's common lightness structure and portable DTCG 2025.10 exports.

**Architecture:** Solve corresponding family roles at common lightness positions, preserving exact anchors and reporting incompatible locks. Export a foundation of number tokens (L/C/H), composed OKLCH colors, and light/dark semantic aliases. Keep CSS light-dark() in the CSS target only; DTCG uses resolver contexts.

**Reference:** https://chatgpt.com/share/6ac306ac-7990-83ea-9e56-6c8f9b955475

- [x] Add generation regressions for common role lightness and global primitive numbering; retain contrast/lock coverage.
- [x] Add a joint family constraint solver in src/engine/generate.ts; share tone ordinals across palette families.
- [x] Test DTCG component references, semantic aliases, resolver contexts, and CSS parity using real generated output.
- [x] Add src/engine/tokens.ts for the shared token foundation and DTCG document generation. Extend src/engine/export.ts with CSS decomposition and DTCG serializers. Preserve configuration JSON separately.
- [x] Update src/App.tsx export controls with individual foundation/context/resolver files and one portable bundled resolver. Document nested mode boundaries and keep native light-dark without fallbacks.
- [x] Run npm test and npm run build; verify exports and nested mode behavior in browser. Update README and model notes.

Resolver default light is a build-time default. CSS color-scheme: light dark follows the system preference. Explicit local light/dark mode boundaries must apply both foreground and background to avoid inherited resolved colors. Alternative brand themes would change foundation/mappings, not add unsupported CSS color-scheme names.

## Verification

39 tests pass, including actual Terrazzo 2.7.1 ingestion of both modes. Build passes. Numeric component JSON Pointers are retained in source documents; the portable resolver materializes their values because the current Terrazzo resolver crashes on numeric pointer targets. Browser nested-region computed colors match the opposite mode.
