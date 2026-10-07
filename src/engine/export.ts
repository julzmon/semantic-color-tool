import type { GeneratedSystem } from './types';
import { configuredFamilyScope, dtcgDocuments, tokenFoundation } from './tokens';

/** A scoped token subset; intentionally does not replace unrelated KDS tokens. */
export function exportCss(system: GeneratedSystem): string {
  const failures = system.checks.filter((check) => !check.pass).length;
  const foundation = tokenFoundation(system);
  const scope = configuredFamilyScope(system);
  const components = [
    ...Object.entries(foundation.lightness).map(([key, value]) => `  --kds-lightness-${key}: ${value};`),
    '', '  /* Family hue · only exact anchors may override the family hue */',
    ...Object.entries(foundation.hue).map(([key, value]) => `  --kds-hue-${key}: ${value};`),
    '', '  /* Chroma per tone · already mapped to the target gamut */',
    ...Object.entries(foundation.chroma).map(([key, value]) => `  --kds-chroma-${key}: ${value};`),
  ].join('\n');
  const primitives = foundation.palette.map(({ primitive, lightness, hue, chroma }) =>
    `  ${primitive.name}: ${primitive.color.source ?? `oklch(var(--kds-lightness-${lightness}) var(--kds-chroma-${chroma}) var(--kds-hue-${hue}))`};`).join('\n');
  const semantic = system.semantics.map((item) => `  ${item.name}: light-dark(var(${item.light}), var(${item.dark}));`).join('\n');
  return `/* KDS Color System Builder · ${scope.label} tokens.
 * One generated primitive palette, shared by light and dark.
 * Validation: ${failures} failed contrast relationship${failures === 1 ? '' : 's'}.
 * Generated ordinal primitives differ from the original KDS reference.
 */
:root {
  color-scheme: light dark;

  /* Shared lightness positions */
${components}

  /* Primitives · OKLCH */
${primitives}

  /* Semantic mappings */
${semantic}
}

[data-mode="light"] { color-scheme: light; }
[data-mode="dark"] { color-scheme: dark; }
[data-mode="auto"] { color-scheme: light dark; }

/* Apply both colors at nested mode boundaries; inherited color is already resolved. */
:where(:root, [data-mode]) {
  background-color: var(--kds-bg-surface-base);
  color: var(--kds-fg-base);
}
`;
}

/** A portable DTCG resolver with its token sources inlined. */
export function exportDtcg(system: GeneratedSystem): string {
  return JSON.stringify(dtcgDocuments(system).bundle, null, 2);
}

export function exportDtcgFiles(system: GeneratedSystem): Record<string, string> {
  const documents = dtcgDocuments(system);
  return Object.fromEntries([
    ['foundation/colors.tokens.json', documents.colors],
    ['semantic/light.tokens.json', documents.light],
    ['semantic/dark.tokens.json', documents.dark],
    ['kds.resolver.json', documents.resolver],
  ].map(([path, document]) => [path, JSON.stringify(document, null, 2)]));
}

export function exportJson(system: GeneratedSystem): string {
  const scope = configuredFamilyScope(system);
  return JSON.stringify({
    formatVersion: 1,
    scope: scope.ids,
    config: system.config,
    primitives: system.primitives,
    semantics: system.semantics,
    validation: { checks: system.checks, diagnostics: system.diagnostics },
  }, null, 2);
}
