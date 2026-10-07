import type { GeneratedSystem, Mode, Primitive } from './types';
import { contrast, isSrgb } from './color';

export interface FoundationColor {
  primitive: Primitive;
  step: string;
  lightness: string;
  hue: string;
  chroma: string;
}

/** Labels and IDs are derived from the active configuration, not a fixed prototype subset. */
export function configuredFamilyScope(system: GeneratedSystem): { ids: string[]; label: string } {
  const families = system.config.families.map((family) => ({
    id: family.id || family.key,
    label: family.label || family.id || family.key,
  }));
  return { ids: families.map((family) => family.id), label: families.map((family) => family.label).join(' + ') || 'Color' };
}

/** One component model feeds CSS and DTCG without recalculating colors. */
export function tokenFoundation(system: GeneratedSystem) {
  const prefix = system.config.prefix ?? 'kds';
  const lightness: Record<string, number> = {};
  const hue: Record<string, number> = {};
  const chroma: Record<string, number> = {};
  for (const family of system.config.families) hue[family.key] = Number((((family.hue % 360) + 360) % 360).toFixed(10));
  const palette: FoundationColor[] = system.primitives.map((primitive) => {
    const step = primitive.name.replace(`--${prefix}-key-${primitive.family}-`, '');
    const tone = step.split('-')[0];
    // Locks may carry more precision than generated values; preserve that precision.
    if (!(tone in lightness) || primitive.color.source) lightness[tone] = primitive.color.l;
    const hueKey = Math.abs(hue[primitive.family] - primitive.color.h) < 1e-9 ? primitive.family : `${primitive.family}-${step}`;
    hue[hueKey] = primitive.color.h;
    const chromaKey = `${primitive.family}-${step}`;
    chroma[chromaKey] = primitive.color.c;
    return { primitive, step, lightness: tone, hue: hueKey, chroma: chromaKey };
  });
  const semantic = new Map(system.semantics.map((token) => [token.name, token]));
  const valid = () => {
    const colors = new Map(palette.map((item) => {
      const original = item.primitive.color;
      const l = lightness[item.lightness], c = chroma[item.chroma], h = hue[item.hue];
      return [item.primitive.name, original.source ? original : { ...original, l, c, h, css: `oklch(${l} ${c} ${h})` }];
    }));
    if (palette.some((item) => isSrgb(item.primitive.color) && !isSrgb(colors.get(item.primitive.name)!))) return false;
    const resolve = (name: string, mode: Mode): typeof palette[number]['primitive']['color'] | undefined => {
      const color = colors.get(name);
      if (color) return color;
      const token = semantic.get(name);
      return token ? resolve(token[mode], mode) : undefined;
    };
    return system.checks.every((check) => {
      const foreground = resolve(check.foreground, check.mode), background = resolve(check.background, check.mode);
      if (!foreground || !background) return true;
      const pass = isSrgb(foreground) && isSrgb(background) && contrast(foreground, background) >= check.target;
      return pass === check.pass;
    });
  };
  // Round shared components together. Never alter a component referenced by an exact lock.
  for (const [component, values, minimum] of [['chroma', chroma, 5], ['lightness', lightness, 4], ['hue', hue, 2]] as const) {
    for (const [key, original] of Object.entries(values)) {
      if (palette.some((item) => item[component] === key && item.primitive.color.source)) continue;
      for (let digits = minimum; digits <= 10; digits++) {
        // Lowering chroma avoids pushing gamut-boundary colors outside sRGB.
        values[key] = component === 'chroma' ? Number((Math.floor(original * 10 ** digits) / 10 ** digits).toFixed(digits)) : Number(original.toFixed(digits));
        if (valid()) break;
        values[key] = original;
      }
    }
  }
  return { lightness, hue, chroma, palette };
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };
const number = (value: number): JsonObject => ({ $type: 'number', $value: value });
const reference = (path: string): JsonObject => ({ $ref: `#/${path}/$value` });

export function tokenPath(cssName: string, prefix = 'kds'): string[] {
  const name = cssName.replace(`--${prefix}-`, '');
  const primitive = name.match(/^key-([a-z][a-z0-9-]*)-(.+)$/);
  if (primitive) return ['color', 'palette', primitive[1], primitive[2]];
  const [group, ...parts] = name.split('-');
  if (group === 'fg' && parts.join('-') === 'on-emphasis') return ['color', 'foreground', 'on-emphasis'];
  if (group === 'bg' && parts[0] === 'surface') return ['color', 'background', 'surface', parts.slice(1).join('-')];
  return ['color', group === 'bg' ? 'background' : group === 'fg' ? 'foreground' : group, ...parts];
}

function setToken(root: JsonObject, path: string[], token: JsonObject): void {
  let group = root;
  for (const segment of path.slice(0, -1)) {
    group[segment] ??= {};
    group = group[segment] as JsonObject;
  }
  group[path.at(-1)!] = token;
}

/** Materialize scalar pointers for consumers that only support whole-token aliases. */
function materializeComponents(value: Json, source: JsonObject): Json {
  if (Array.isArray(value)) return value.map((child) => materializeComponents(child, source));
  if (value && typeof value === 'object') {
    if (typeof value.$ref === 'string' && value.$ref.startsWith('#/color/')) {
      return value.$ref.slice(2).split('/').reduce<Json>((current, key) => (current as JsonObject)[key], source);
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, materializeComponents(child, source)]));
  }
  return value;
}

export function dtcgDocuments(system: GeneratedSystem) {
  const prefix = system.config.prefix ?? 'kds';
  const foundation = tokenFoundation(system);
  const scope = configuredFamilyScope(system);
  const colors: JsonObject = {
    $description: `Semantic Color System Generator ${scope.label} foundation. Shared lightness; family hue and gamut-mapped chroma. Generated ordinals may change when constraints change.`,
    color: {
      lightness: Object.fromEntries(Object.entries(foundation.lightness).map(([key, value]) => [key, number(value)])),
      hue: Object.fromEntries(Object.entries(foundation.hue).map(([key, value]) => [key, number(value)])),
      chroma: {}, palette: {},
    },
  };
  for (const item of foundation.palette) {
    const { primitive, step } = item;
    setToken(colors, ['color', 'chroma', primitive.family, step], number(foundation.chroma[item.chroma]));
    setToken(colors, tokenPath(primitive.name, prefix), {
      $type: 'color',
      $value: { colorSpace: 'oklch', components: [reference(`color/lightness/${item.lightness}`), reference(`color/chroma/${primitive.family}/${step}`), reference(`color/hue/${item.hue}`)], alpha: 1 },
      ...(primitive.color.source ? { $description: `Exact source anchor: ${primitive.color.source}` } : {}),
    });
  }
  const semantic = (mode: Mode): JsonObject => {
    const document: JsonObject = { $description: `${mode} semantic context. Merge with the shared foundation through ${prefix}.resolver.json.` };
    for (const token of system.semantics) setToken(document, tokenPath(token.name, prefix), { $type: 'color', $value: `{${tokenPath(token[mode], prefix).join('.')}}` });
    return document;
  };
  const light = semantic('light');
  const dark = semantic('dark');
  const resolver = (inline: boolean): JsonObject => ({
    $schema: 'https://www.designtokens.org/schemas/2025.10/resolver.json',
    name: `Semantic Color System Generator ${scope.label}`, version: '2025.10',
    description: `Shared OKLCH foundation for ${scope.label} with light/dark semantic contexts.`,
    sets: { foundation: { sources: [inline ? materializeComponents(colors, colors) : { $ref: 'foundation/colors.tokens.json' }] } },
    modifiers: { mode: { description: 'Color mode', contexts: {
      light: [inline ? light : { $ref: 'semantic/light.tokens.json' }],
      dark: [inline ? dark : { $ref: 'semantic/dark.tokens.json' }],
    }, default: 'light' } },
    resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/mode' }],
  });
  return { colors, light, dark, resolver: resolver(false), bundle: resolver(true) };
}
