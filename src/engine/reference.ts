import { CssSyntaxError, parse } from 'postcss';
import type { KdsReference, Mode } from './types';

const numericPrimitive = /^--kds-key-[a-z]+-\d+$/;
const semanticToken = /^--kds-(?:bg-|fg-|border-[a-z]+-(?:muted|emphasis)-)/;
const colorToken = /^--kds-(?:color-|key-)/;
const exactAlias = /^var\(\s*(--[\w-]+)\s*\)$/;

/** Imports the root/light declarations and partial dark overrides used by KDS. */
export function parseKdsTokens(css: string): KdsReference {
  let tree;
  try {
    tree = parse(css);
  } catch (error) {
    if (error instanceof CssSyntaxError) {
      throw new Error(`Invalid KDS token CSS at line ${error.line ?? '?'}: ${error.reason}`);
    }
    throw new Error(`Invalid KDS token CSS: ${error instanceof Error ? error.message : String(error)}`);
  }

  const warnings = new Set<string>();
  const declarations: Record<'root' | Mode, Record<string, string>> = { root: {}, light: {}, dark: {} };

  for (const node of tree.nodes) {
    if (node.type === 'comment') continue;
    if (node.type !== 'rule') {
      warnings.add(`Skipped unsupported KDS token structure ${node.type === 'atrule' ? `@${node.name}` : node.type}.`);
      continue;
    }

    const scopes = new Set<'root' | Mode>();
    for (const selector of node.selectors) {
      if (selector.trim() === ':root') {
        scopes.add('root');
        continue;
      }
      const mode = selector.trim().match(/^\[data-mode\s*=\s*["']?(light|dark)["']?\s*\]$/)?.[1];
      if (mode === 'light' || mode === 'dark') scopes.add(mode);
      else warnings.add(`Skipped unsupported KDS token selector ${selector}.`);
    }

    for (const child of node.nodes) {
      if (child.type === 'comment') continue;
      if (child.type !== 'decl') {
        warnings.add(`Skipped nested KDS token structure in ${node.selector}.`);
        continue;
      }
      if (!child.prop.startsWith('--')) continue;
      if (child.important) warnings.add(`The KDS reference importer does not model !important priority for ${child.prop}.`);
      for (const scope of scopes) declarations[scope][child.prop] = child.value.trim();
    }
  }

  const reference: KdsReference = {
    primitives: {},
    semantics: { light: {}, dark: {} },
    resolved: { light: {}, dark: {} },
    warnings: [],
  };

  for (const mode of ['light', 'dark'] as const) {
    // The source dark block intentionally overrides only a subset of root values.
    const effective = { ...declarations.root, ...declarations[mode] };
    const cache = new Map<string, string | undefined>();

    const resolve = (name: string, path: string[] = []): string | undefined => {
      if (cache.has(name)) return cache.get(name);
      if (path.includes(name)) {
        warnings.add(`${mode}: cyclic KDS token alias ${[...path, name].join(' → ')}.`);
        return undefined;
      }
      const value = effective[name];
      if (value === undefined) {
        warnings.add(`${mode}: unresolved KDS token ${name}${path.length ? ` referenced by ${path[path.length - 1]}` : ''}.`);
        return undefined;
      }
      const alias = value.match(exactAlias)?.[1];
      let result: string | undefined;
      if (alias) result = resolve(alias, [...path, name]);
      else if (value.includes('var(')) {
        warnings.add(`${mode}: unsupported variable expression for ${name}: ${value}.`);
      } else result = value;
      cache.set(name, result);
      return result;
    };

    for (const [name, value] of Object.entries(effective)) {
      if (semanticToken.test(name)) reference.semantics[mode][name] = value;
      if (semanticToken.test(name) || colorToken.test(name)) {
        const resolved = resolve(name);
        if (resolved !== undefined) reference.resolved[mode][name] = resolved;
      }
      if (numericPrimitive.test(name)) {
        if (mode === 'light' || !(name in reference.primitives)) reference.primitives[name] = value;
        else if (value !== reference.primitives[name]) {
          warnings.add(`Primitive ${name} has a dark override; its reference palette entry preserves the light declaration.`);
        }
      }
    }
  }

  reference.warnings = [...warnings];
  return reference;
}

export { configFromReference } from './config';
