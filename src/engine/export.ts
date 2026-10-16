import type { GeneratedSystem } from './types';
import { configuredFamilyScope, dtcgDocuments, cssTokenModel } from './tokens';
import { tokenName } from './generate';

/** A scoped token subset; intentionally does not replace unrelated KDS tokens. */
export function exportCss(system: GeneratedSystem): string {
  const failures = system.checks.filter((check) => !check.pass).length;
  const scope = configuredFamilyScope(system);
  const prefix = system.config.prefix ?? 'kds';
  const model = cssTokenModel(system);
  const settings = model.settings.map(item => `  ${item.name}: ${item.value};`).join('\n');
  const components = model.components.map(item => `  ${item.name}: ${item.value};`).join('\n');
  const semantic = model.semantics
    .map(item => `  ${item.name}: ${item.value};`).join('\n');
  return `/* Semantic Color System Generator · ${scope.label} tokens.
 * Shared L/C/H components and opaque semantic colors for light and dark.
 * Global settings and recipes; intermediate palette tokens are omitted.
 * Validation: ${failures} failed contrast relationship${failures === 1 ? '' : 's'}.
 */
:root {
  color-scheme: light dark;
${components ? `\n  /* Shared OKLCH components · edit globally on :root */\n${components}` : ''}
${settings ? `\n  /* Shared emphasis mixing settings */\n${settings}` : ''}

  /* Semantic roles · identical color pairs use aliases */
${semantic}
}

[data-mode="light"] { color-scheme: light; }
[data-mode="dark"] { color-scheme: dark; }
[data-mode="auto"] { color-scheme: light dark; }

/* Apply both colors at nested mode boundaries; inherited color is already resolved. */
:where(:root, [data-mode]) {
  background-color: var(${tokenName(prefix, 'bg-surface-base')});
  color: var(${tokenName(prefix, 'fg-base')});
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
    [`${system.config.prefix}.resolver.json`, documents.resolver],
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
