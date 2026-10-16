import type { ColorValue, GeneratedSystem, Mode, Primitive } from './types';
import { contrast, isSrgb } from './color';
import { emphasisRecipe, emphasisStates, emphasisTarget, mixEmphasis } from './emphasis';

interface FoundationColor {
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

/** Resolve serialized state recipes from serialized bases, never independently rounded stops. */
function semanticResolver(system: GeneratedSystem, colors: Map<string, ColorValue>) {
  const roles = new Map(system.semantics.map(token => [token.name, token]));
  const resolve = (name: string, mode: Mode, seen = new Set<string>()): ColorValue | undefined => {
    if (!name) return;
    if (seen.has(name)) throw new Error(`Circular color alias: ${name}.`);
    seen.add(name);
    const recipe = emphasisRecipe(system, name);
    if (recipe) {
      const base = resolve(recipe.base, mode, seen);
      return base ? mixEmphasis(base, system.config.emphasis.mixWeights![recipe.state], emphasisTarget(system.config, mode)) : undefined;
    }
    const color = colors.get(name);
    if (color) return color;
    const token = roles.get(name);
    return token ? resolve(token[mode], mode, seen) : undefined;
  };
  return resolve;
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
  const valid = () => {
    const colors = new Map(palette.map((item) => {
      const original = item.primitive.color;
      const l = lightness[item.lightness], c = chroma[item.chroma], h = hue[item.hue];
      return [item.primitive.name, original.source ? original : { ...original, l, c, h, css: `oklch(${l} ${c} ${h})` }];
    }));
    if (palette.some((item) => isSrgb(item.primitive.color) && !isSrgb(colors.get(item.primitive.name)!))) return false;
    const resolve = semanticResolver(system, colors);
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

/** Reconstruct the shared foundation after verified coordinate shortening. */
function foundationColors(foundation: ReturnType<typeof tokenFoundation>): Map<string, ColorValue> {
  return new Map(foundation.palette.map(({ primitive, lightness, chroma, hue }) => {
    const l = foundation.lightness[lightness], c = foundation.chroma[chroma], h = foundation.hue[hue];
    return [primitive.name, primitive.color.source ? primitive.color
      : { ...primitive.color, l, c, h, css: `oklch(${l} ${c} ${h})` }];
  }));
}

function buildCssTokenModel(system: GeneratedSystem) {
  const foundation = tokenFoundation(system);
  const colors = foundationColors(foundation);
  const resolve = semanticResolver(system, colors);
  const prefix = system.config.prefix ?? 'kds';
  const weights = system.config.emphasis?.mixWeights;
  const settings = weights ? [
    ...emphasisStates.slice(0, system.config.emphasis.selected ? 3 : 2).map(state => ({
      name: `--${prefix}-emphasis-${state}-weight`, value: `${weights[state] * 100}%`,
    })),
    { name: `--${prefix}-emphasis-state-target`, value: emphasisTarget(system.config, 'dark') === 'white'
      ? 'light-dark(oklch(0 0 none), oklch(1 0 none))' : 'oklch(0 0 none)' },
  ] : [];
  const components = new Map<string, string>();
  const chromaNames = new Map<string, string>();
  const palette = new Map(foundation.palette.map(item => [item.primitive.name, item]));
  const roles = new Map(system.semantics.map(token => [token.name, token]));
  const component = (kind: string, key: string, value: number) => {
    const name = `--${prefix}-${kind}-${key}`;
    components.set(name, String(value));
    return `var(${name})`;
  };
  const expression = (name: string, mode: Mode): string => {
    const item = palette.get(name);
    if (!item) {
      const role = roles.get(name);
      if (!role) throw new Error(`Missing color for CSS role ${name}.`);
      return expression(role[mode], mode);
    }
    // Exact anchors retain their original source syntax and precision.
    if (item.primitive.color.source) return item.primitive.color.css;
    const l = component('lightness', item.lightness, foundation.lightness[item.lightness]);
    const chroma = foundation.chroma[item.chroma];
    const chromaIdentity = `${item.primitive.family}:${chroma}`;
    const chromaKey = chromaNames.get(chromaIdentity) ?? item.chroma;
    chromaNames.set(chromaIdentity, chromaKey);
    const c = component('chroma', chromaKey, chroma);
    const h = component('hue', item.hue, foundation.hue[item.hue]);
    return `oklch(${l} ${c} ${h})`;
  };
  const canonical = new Map<string, string>();
  let aliases = 0;
  const semantics = system.semantics.map(token => {
    const recipe = emphasisRecipe(system, token.name);
    if (recipe) return { name: token.name,
      value: `color-mix(in oklch, var(${recipe.base}) var(--${prefix}-emphasis-${recipe.state}-weight), var(--${prefix}-emphasis-state-target))` };
    const light = resolve(token.name, 'light'), dark = resolve(token.name, 'dark');
    if (!light || !dark) throw new Error(`Missing color for CSS role ${token.name}.`);
    // Equal rendered colors do not make an exact lock an editable component recipe.
    const identity = JSON.stringify([light.css, dark.css, light.source ?? null, dark.source ?? null]);
    const shared = light.css === dark.css && light.source === dark.source;
    const existing = canonical.get(identity);
    if (existing) {
      aliases++;
      return { name: token.name, value: `var(${existing})` };
    }
    canonical.set(identity, token.name);
    const lightExpression = expression(token.light, 'light');
    const darkExpression = shared ? lightExpression : expression(token.dark, 'dark');
    return { name: token.name, value: shared ? lightExpression
      : `light-dark(${lightExpression}, ${darkExpression})` };
  });
  const recipes = semantics.filter(token => emphasisRecipe(system, token.name));
  return Object.freeze({
    components: Object.freeze([...components].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([name, value]) => Object.freeze({ name, value }))),
    settings: Object.freeze(settings.map(item => Object.freeze(item))),
    semantics: Object.freeze(semantics.map(item => Object.freeze(item))),
    stats: Object.freeze({
      tokens: semantics.length + settings.length + components.size,
      components: components.size,
      roles: semantics.length,
      derivedStates: recipes.length,
      settings: settings.length,
      aliases,
      omittedFoundationTokens: foundation.palette.length + Object.keys(foundation.lightness).length
        + Object.keys(foundation.chroma).length + Object.keys(foundation.hue).length - components.size,
    }),
  });
}

const cssModels = new WeakMap<GeneratedSystem, { signature: string; model: ReturnType<typeof buildCssTokenModel> }>();

/** Share expensive verified serialization across previews and exports; tolerate mutable API inputs. */
export function cssTokenModel(system: GeneratedSystem) {
  const signature = JSON.stringify([system.config, system.primitives, system.semantics,
    system.checks.map(check => [check.mode, check.foreground, check.background, check.target, check.pass])]);
  const cached = cssModels.get(system);
  if (cached?.signature === signature) return cached.model;
  const model = buildCssTokenModel(system);
  cssModels.set(system, { signature, model });
  return model;
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
  const resolve = semanticResolver(system, foundationColors(foundation));
  const semantic = (mode: Mode): JsonObject => {
    const document: JsonObject = { $description: `${mode} semantic context. Merge with the shared foundation through ${prefix}.resolver.json.` };
    for (const token of system.semantics) {
      const color = emphasisRecipe(system, token.name) ? resolve(token.name, mode) : undefined;
      setToken(document, tokenPath(token.name, prefix), { $type: 'color', $value: color
        ? { colorSpace: 'oklch', components: [color.l, color.c, color.h], alpha: 1 }
        : `{${tokenPath(token[mode], prefix).join('.')}}` });
    }
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
