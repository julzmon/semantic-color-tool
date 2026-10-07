import { colorIdentity, contrast, isSrgb, parseLockedColor, toColor } from './color';
import { mutedChromaScale, mutedDistance, surfaceStep } from './config';
import { FAMILY_DEFINITIONS, FAMILY_IDS, PALETTE_KEYS } from './families';
import { reuseGrayPositions } from './reuse';
import type {
  BuilderConfig, ColorAnchor, ColorValue, ContrastCheck, FamilyConfig, FamilyId, FamilyRole,
  GeneratedFamily, GeneratedRole, GeneratedSystem, Mode, ModeTheme, OklchColor, Primitive, SemanticToken, State,
} from './types';

const modes: Mode[] = ['light', 'dark'];
const familyIds: FamilyId[] = [...FAMILY_IDS];
const allStates: State[] = ['base', 'hover', 'active', 'selected'];
const direction = (mode: Mode) => mode === 'light' ? -1 : 1;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const textTarget = (config: BuilderConfig) => Math.max(config.targets.normalText, config.targets.largeText);
const emphasisStrategy = (config: BuilderConfig) => config.emphasis.strategy ?? 'shared';
type ColorFactory = (lightness: number) => ColorValue;
type Constraint = { background: ColorValue; target: number };
interface ColorGroup { colors: ColorValue[]; diagnostics: string[] }
interface SolvedGroup extends ColorGroup { feasible: boolean; score: number }

function finite(value: number, name: string, minimum = 0): void {
  if (!Number.isFinite(value) || value < minimum) throw new Error(`${name} must be finite and at least ${minimum}.`);
}

/** Runtime validation also protects imported JSON and direct API consumers. */
export function validateConfig(config: BuilderConfig): void {
  if (!config || config.version !== 2) throw new Error('Unsupported builder configuration version. Import version 1 configurations through the configuration importer first.');
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(config.prefix ?? '')) throw new Error('Token prefix must use lowercase letters, numbers, and hyphens.');
  for (const mode of modes) {
    finite(config.surfaces?.[mode]?.l, `${mode} surface lightness`);
    if (config.surfaces[mode].l > 1 + 1e-8) throw new Error('Surface lightness must be within 0–1.');
  }
  if (!Number.isInteger(config.surfaces.levels) || config.surfaces.levels < 1 || config.surfaces.levels > 32) throw new Error('Surface count must be an integer from 1 to 32.');
  for (const mode of modes) finite(surfaceStep(config, mode), `${mode} surface step`);
  for (const mode of modes) {
    const scale = mutedChromaScale(config, mode);
    finite(scale, `${mode} muted chroma scale`);
    if (scale > 2) throw new Error(`${mode} muted chroma scale must be within 0–2.`);
    if (!Number.isFinite(mutedDistance(config, mode))) throw new Error(`${mode} muted distance must be finite.`);
  }
  finite(config.muted?.separation, 'Muted separation');
  finite(config.emphasis?.separation, 'Emphasis separation');
  if (typeof config.emphasis.selected !== 'boolean') throw new Error('Selected-state configuration must be a boolean.');
  if (config.emphasis.strategy !== undefined && config.emphasis.strategy !== 'shared' && config.emphasis.strategy !== 'adaptive') throw new Error('Emphasis strategy must be shared or adaptive.');
  for (const [name, target] of Object.entries(config.targets ?? {})) finite(target, name, 1);
  for (const name of ['normalText', 'largeText', 'ui'] as const) finite(config.targets?.[name], name, 1);
  if (!Array.isArray(config.families) || config.families.length !== familyIds.length || familyIds.some((id) => config.families.filter((family) => family.id === id).length !== 1)) {
    throw new Error('Exactly one configuration is required for each KDS semantic family.');
  }
  for (const family of config.families) {
    const definition = FAMILY_DEFINITIONS.find((item) => item.id === family.id);
    if (!definition || family.key !== definition.key || family.label !== definition.label) throw new Error(`${family.id} must use the ${definition?.key ?? 'configured'} primitive namespace.`);
    if (!Number.isFinite(family.hue)) throw new Error('Family hue must be finite.');
    finite(family.chroma, 'Family chroma');
  }
  if (!Array.isArray(config.anchors)) throw new Error('Anchors must be an array.');
  const occupied = new Set<string>();
  for (const anchor of config.anchors) {
    if (!familyIds.includes(anchor.family) || !['light', 'dark', 'both'].includes(anchor.mode) || !['emphasis.base', 'foreground.base'].includes(anchor.role) || typeof anchor.locked !== 'boolean') {
      throw new Error('Invalid brand anchor.');
    }
    parseLockedColor(anchor.color);
    for (const mode of anchor.mode === 'both' ? modes : [anchor.mode]) {
      const key = `${mode}:${anchor.family}:${anchor.role}`;
      if (occupied.has(key)) throw new Error(`Overlapping anchors for ${key}.`);
      occupied.add(key);
    }
  }
}

/** Resolve per-mode and both-mode anchors without mutating configuration. */
export function brandAnchoring(config: BuilderConfig, mode: Mode, family: FamilyId, role: ColorAnchor['role']): { color: ColorValue; locked: boolean } | undefined {
  const anchor = config.anchors.find((item) => item.family === family && item.role === role && (item.mode === mode || item.mode === 'both'));
  return anchor ? { color: anchor.locked ? parseLockedColor(anchor.color) : toColor(anchor.color), locked: anchor.locked } : undefined;
}

export function surfaceGeneration(config: BuilderConfig, mode: Mode): ColorGroup {
  const neutral = config.families.find((family) => family.id === 'neutral')!;
  const base = { l: config.surfaces[mode].l, c: neutral.chroma, h: neutral.hue };
  const diagnostics: string[] = [];
  const last = base.l + direction(mode) * surfaceStep(config, mode) * (config.surfaces.levels - 1);
  if (last < 0 || last > 1) diagnostics.push(`${mode}: surface spacing is infeasible within OKLCH lightness 0–1; the base is retained and overflowing levels are clamped.`);
  return {
    colors: Array.from({ length: config.surfaces.levels }, (_, index) => toColor({ ...base, l: clamp(base.l + direction(mode) * surfaceStep(config, mode) * index) })),
    diagnostics,
  };
}

/** The complete state group moves together; clamping is only an infeasible fallback. */
export function generateStates(base: ColorValue, mode: Mode, separation: number, count = 3): ColorGroup {
  const last = base.l + direction(mode) * separation * (count - 1);
  return {
    colors: Array.from({ length: count }, (_, index) => index === 0 ? base : toColor({ ...base, l: clamp(base.l + direction(mode) * separation * index) })),
    diagnostics: last < -1e-9 || last > 1 + 1e-9 ? [`${mode}: requested state separation is infeasible at this base; one or more states reach the lightness boundary.`] : [],
  };
}

export function mutedGeneration(config: BuilderConfig, mode: Mode, family: FamilyConfig): ColorGroup {
  const count = config.emphasis.selected ? 4 : 3;
  const span = config.muted.separation * (count - 1);
  const desired = config.surfaces[mode].l + direction(mode) * mutedDistance(config, mode);
  const bounded = mode === 'light' ? Math.max(span, desired) : Math.min(1 - span, desired);
  const chroma = family.chroma * mutedChromaScale(config, mode);
  const base = toColor({ l: clamp(bounded), c: chroma, h: family.hue });
  const result = generateStates(base, mode, config.muted.separation, count);
  // Gamut-map each position from the scaled family chroma, not the clipped base.
  result.colors = result.colors.map((color) => toColor({ l: color.l, c: chroma, h: family.hue }));
  if (Math.abs(desired - bounded) > 1e-9 || desired < 0 || desired > 1) {
    result.diagnostics.unshift(`${mode} ${family.id}: muted distance and full state separation are infeasible together; the group shifts toward the available range.`);
  }
  return result;
}

function createFactory(family: FamilyConfig): ColorFactory {
  const cache = new Map<string, ColorValue>();
  return (lightness) => {
    const l = clamp(lightness);
    const key = l.toFixed(10);
    let color = cache.get(key);
    if (!color) {
      color = toColor({ l, c: family.chroma, h: family.hue });
      cache.set(key, color);
    }
    return color;
  };
}

function contrastScore(color: ColorValue, constraints: Constraint[]): number {
  if (!isSrgb(color)) return 0;
  return Math.min(...constraints.map(({ background, target }) => isSrgb(background) ? contrast(color, background) / target : 0), Infinity);
}

function solveGroup(factory: ColorFactory, mode: Mode, separation: number, count: number, constraints: Constraint[], fixed?: ColorValue, preference?: ColorValue): SolvedGroup {
  const span = separation * (count - 1);
  const stateFactory: ColorFactory = fixed ? (lightness) => toColor({ l: clamp(lightness), h: fixed.h, c: fixed.c }) : factory;
  const evaluate = (base: ColorValue): SolvedGroup => {
    const colors = Array.from({ length: count }, (_, index) => index === 0 ? base : stateFactory(base.l + direction(mode) * separation * index));
    const fits = mode === 'light' ? base.l >= span - 1e-9 : base.l <= 1 - span + 1e-9;
    const score = Math.min(...colors.map((color) => contrastScore(color, constraints)));
    return { colors, feasible: fits && score >= 1, score, diagnostics: fits ? [] : [`${mode}: requested state separation is infeasible at this base; one or more states reach the lightness boundary.`] };
  };
  if (fixed) return evaluate(fixed);
  const candidateLs = Array.from({ length: 1001 }, (_, index) => mode === 'light' ? 1 - index / 1000 : index / 1000);
  if (preference) {
    candidateLs.push(preference.l);
    candidateLs.sort((a, b) => Math.abs(a - preference.l) - Math.abs(b - preference.l));
  }
  let best: SolvedGroup | undefined;
  for (const l of candidateLs) {
    if (span <= 1 && (mode === 'light' ? l < span - 1e-9 : l > 1 - span + 1e-9)) continue;
    const candidate = evaluate(factory(l));
    if (candidate.feasible) return candidate;
    if (!best || candidate.score > best.score) best = candidate;
  }
  // A finite candidate always exists, including configurations with an impossible span.
  return best ?? evaluate(factory(mode === 'light' ? 1 : 0));
}

interface EmphasisInput {
  config: BuilderConfig;
  mode: Mode;
  family: FamilyConfig;
  surfaces: ColorValue[];
  muted: ColorValue[];
  onEmphasis: ColorValue;
  factory?: ColorFactory;
}
interface EmphasisResult extends SolvedGroup { foreground: ColorValue[]; shared: boolean }

interface JointMember { factory: ColorFactory; constraints: Constraint[]; fixed?: ColorValue; preference?: ColorValue }

/** Search one lightness for every family, with gamut mapping confined to chroma. */
function solveJointGroup(members: JointMember[], mode: Mode, separation: number, count: number): SolvedGroup[] {
  const locks = members.flatMap((member) => member.fixed ? [member.fixed] : []);
  const conflicting = locks.some((color) => Math.abs(color.l - locks[0].l) > 1e-9);
  const preference = members.find((member) => member.preference)?.preference;
  const candidates = locks.length ? [locks[0].l] : Array.from({ length: 1001 }, (_, index) => mode === 'light' ? 1 - index / 1000 : index / 1000);
  if (!locks.length && preference) {
    candidates.push(preference.l);
    candidates.sort((a, b) => Math.abs(a - preference.l) - Math.abs(b - preference.l));
  }
  const factories = members.map((member): ColorFactory => member.fixed
    ? (lightness) => toColor({ l: clamp(lightness), h: member.fixed!.h, c: member.fixed!.c })
    : member.factory);
  let best: SolvedGroup[] | undefined;
  let bestScore = -Infinity;
  for (const lightness of candidates) {
    const span = separation * (count - 1);
    if (!locks.length && span <= 1 && (mode === 'light' ? lightness < span - 1e-9 : lightness > 1 - span + 1e-9)) continue;
    const groups = members.map((member, index) => {
      const base = member.fixed ?? factories[index](lightness);
      const colors = Array.from({ length: count }, (_, state) => state === 0 ? base : factories[index](base.l + direction(mode) * separation * state));
      const fits = mode === 'light' ? base.l >= span - 1e-9 : base.l <= 1 - span + 1e-9;
      const score = Math.min(...colors.map((color) => contrastScore(color, member.constraints)));
      return { colors, score, feasible: fits && score >= 1 && !conflicting, diagnostics: [
        ...(conflicting ? [`${mode}: locked colors require different lightness values at the same role. Exact locks are preserved; the shared-lightness constraint is unsatisfied.`] : []),
        ...(!fits ? [`${mode}: requested state separation is infeasible at this base; one or more states reach the lightness boundary.`] : []),
      ] };
    });
    if (groups.every((group) => group.feasible)) return groups;
    const score = Math.min(...groups.map((group) => group.score));
    if (!best || score > bestScore) { best = groups; bestScore = score; }
  }
  return best!;
}

function solveFamilies(inputs: EmphasisInput[]): EmphasisResult[] {
  const { config, mode } = inputs[0];
  const count = config.emphasis.selected ? 4 : 3;
  const emphasis = inputs.map((input): JointMember => {
    const anchor = brandAnchoring(config, mode, input.family.id, 'emphasis.base');
    return { factory: input.factory ?? createFactory(input.family), fixed: anchor?.locked ? anchor.color : undefined, preference: anchor?.color,
      constraints: [{ background: input.onEmphasis, target: textTarget(config) }] };
  });
  const foreground = inputs.map((input): JointMember => {
    const anchor = brandAnchoring(config, mode, input.family.id, 'foreground.base');
    return { factory: input.factory ?? createFactory(input.family), fixed: anchor?.locked ? anchor.color : undefined, preference: anchor?.color,
      constraints: [...input.surfaces, ...input.muted].map((background) => ({ background, target: textTarget(config) })) };
  });
  const compatible = emphasis.every((member, i) => !member.fixed || !foreground[i].fixed || colorIdentity(member.fixed) === colorIdentity(foreground[i].fixed!));
  const shared = solveJointGroup(emphasis.map((member, i) => ({ ...member, fixed: member.fixed ?? foreground[i].fixed, preference: member.preference ?? foreground[i].preference,
    constraints: [...member.constraints, ...foreground[i].constraints] })), mode, config.emphasis.separation, count);
  if (compatible && shared.every((group) => group.feasible)) return shared.map((group, i) => ({ ...group,
    foreground: [foreground[i].fixed ?? group.colors[0], group.colors[1]], shared: true }));
  const backgrounds = solveJointGroup(emphasis, mode, config.emphasis.separation, count);
  const text = solveJointGroup(foreground, mode, config.emphasis.separation, 2);
  return backgrounds.map((group, i) => ({ ...group, foreground: text[i].colors, shared: false, diagnostics: [...group.diagnostics, ...text[i].diagnostics] }));
}

/** Prefer one color for emphasis and text, then split if their constraints conflict. */
export function solveEmphasis(input: EmphasisInput): EmphasisResult {
  const { config, mode, family, surfaces, muted, onEmphasis } = input;
  const factory = input.factory ?? createFactory(family);
  const count = config.emphasis.selected ? 4 : 3;
  const emphasisAnchor = brandAnchoring(config, mode, family.id, 'emphasis.base');
  const foregroundAnchor = brandAnchoring(config, mode, family.id, 'foreground.base');
  const emphasisConstraints = [
    ...surfaces.map((background) => ({ background, target: config.targets.ui })),
    { background: onEmphasis, target: textTarget(config) },
  ];
  const foregroundConstraints = [...surfaces, ...muted].map((background) => ({ background, target: textTarget(config) }));
  const sameLocks = !emphasisAnchor?.locked || !foregroundAnchor?.locked || colorIdentity(emphasisAnchor.color) === colorIdentity(foregroundAnchor.color);
  const sharedLock = emphasisAnchor?.locked ? emphasisAnchor.color : foregroundAnchor?.locked ? foregroundAnchor.color : undefined;
  const shared = solveGroup(factory, mode, config.emphasis.separation, count, [...emphasisConstraints, ...foregroundConstraints], sharedLock, emphasisAnchor?.color ?? foregroundAnchor?.color);
  if (sameLocks && shared.feasible) {
    // Retain each exact source even when equal-color locks use different CSS spellings.
    const foreground = shared.colors.slice(0, 2);
    if (foregroundAnchor?.locked) foreground[0] = foregroundAnchor.color;
    return { ...shared, foreground, shared: true };
  }
  const emphasis = solveGroup(factory, mode, config.emphasis.separation, count, emphasisConstraints, emphasisAnchor?.locked ? emphasisAnchor.color : undefined, emphasisAnchor?.color);
  const foreground = solveGroup(factory, mode, config.emphasis.separation, 2, foregroundConstraints, foregroundAnchor?.locked ? foregroundAnchor.color : undefined, foregroundAnchor?.color);
  return {
    ...emphasis,
    foreground: foreground.colors,
    shared: false,
    diagnostics: [...emphasis.diagnostics, ...foreground.diagnostics],
  };
}

function role(color: ColorValue, semantic: string): GeneratedRole {
  return { color, semantic, primitive: '', sharedWith: [] };
}

export const tokenName = (prefix: string, suffix: string) => `--${prefix}-${suffix}`;

function semanticName(prefix: string, family: FamilyId, path: FamilyRole): string {
  const [group, ...parts] = path.split('.');
  return group === 'foreground' ? tokenName(prefix, `fg-${family}-${parts.join('-')}`) : group === 'border' ? tokenName(prefix, `border-${family}-${parts.join('-')}`) : tokenName(prefix, `bg-${family}-${path.replaceAll('.', '-')}`);
}

function allRoles(theme: ModeTheme): { key: Primitive['family']; role: GeneratedRole }[] {
  return [
    ...theme.surfaces.map((item) => ({ key: 'gray' as const, role: item })),
    ...Object.values(theme.foreground).map((item) => ({ key: 'gray' as const, role: item })),
    ...familyIds.flatMap((id) => {
      const family = theme.families[id];
      return Object.values(family.roles).map((item) => ({ key: family.key, role: item! }));
    }),
  ];
}

/** Union both modes by actual color within each palette, then assign descending-L names. */
export function deduplication(input: Record<Mode, ModeTheme>, prefix = 'kds'): { modes: Record<Mode, ModeTheme>; primitives: Primitive[] } {
  const themes = structuredClone(input);
  const primitives: Primitive[] = [];
  const lightnesses = [...new Set(modes.flatMap((mode) => allRoles(themes[mode]).map((entry) => entry.role.color.l.toFixed(10))))].sort((a, b) => Number(b) - Number(a));
  const toneNames = new Map(lightnesses.map((value, index) => [value, String((index + 1) * 100)]));
  for (const key of PALETTE_KEYS) {
    const union = new Map<string, { color: ColorValue; entries: { mode: Mode; role: GeneratedRole }[] }>();
    const exactSources = new Map<string, Set<string>>();
    for (const mode of modes) for (const entry of allRoles(themes[mode]).filter((entry) => entry.key === key)) {
      if (!entry.role.color.source) continue;
      const identity = colorIdentity(entry.role.color);
      const sources = exactSources.get(identity) ?? new Set<string>();
      sources.add(entry.role.color.source);
      exactSources.set(identity, sources);
    }
    for (const mode of modes) {
      for (const entry of allRoles(themes[mode]).filter((entry) => entry.key === key)) {
        const colorKey = colorIdentity(entry.role.color);
        const sources = [...(exactSources.get(colorKey) ?? [])].sort();
        // The only deduplication exception is two explicit spellings of an
        // equal color: a single CSS declaration cannot preserve both sources.
        const identity = sources.length > 1 ? `${colorKey}:source:${entry.role.color.source ?? sources[0]}` : colorKey;
        let group = union.get(identity);
        if (!group) {
          group = { color: entry.role.color, entries: [] };
          union.set(identity, group);
        }
        if (entry.role.color.source) group.color = entry.role.color;
        group.entries.push({ mode, role: entry.role });
      }
    }
    const ordered = [...union.values()].sort((a, b) => b.color.l - a.color.l || a.color.c - b.color.c || a.color.h - b.color.h || a.color.css.localeCompare(b.color.css));
    const variants = new Map<string, number>();
    ordered.forEach((group) => {
      const tone = toneNames.get(group.color.l.toFixed(10))!;
      const variant = (variants.get(tone) ?? 0) + 1;
      variants.set(tone, variant);
      const name = tokenName(prefix, `key-${key}-${tone}${variant > 1 ? `-${variant}` : ''}`);
      const names = (mode: Mode) => [...new Set(group.entries.filter((entry) => entry.mode === mode).flatMap((entry) => {
        const state = entry.role.semantic.match(new RegExp(`^--${prefix}-fg-info-(base|hover)$`))?.[1];
        return state ? [entry.role.semantic, tokenName(prefix, `fg-link-${state}`)] : [entry.role.semantic];
      }))].sort();
      const usages = modes.flatMap((mode) => names(mode).map((semantic) => `${mode}:${semantic}`)).sort();
      for (const entry of group.entries) {
        entry.role.primitive = name;
        entry.role.sharedWith = names(entry.mode).filter((semantic) => semantic !== entry.role.semantic);
      }
      primitives.push({ name, family: key, color: group.color, usages });
    });
  }
  return { modes: themes, primitives };
}

export function semanticMapping(themes: Record<Mode, ModeTheme>, prefix = 'kds'): SemanticToken[] {
  const tokens = new Map<string, SemanticToken>();
  for (const mode of modes) for (const { role: item } of allRoles(themes[mode])) {
    const token = tokens.get(item.semantic) ?? { name: item.semantic, light: '', dark: '' };
    token[mode] = item.primitive;
    tokens.set(item.semantic, token);
  }
  for (const state of ['base', 'hover']) {
    const name = tokenName(prefix, `fg-link-${state}`);
    tokens.set(name, { name, light: tokenName(prefix, `fg-info-${state}`), dark: tokenName(prefix, `fg-info-${state}`) });
  }
  return [...tokens.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function contextualChecks(config: BuilderConfig, themes: Record<Mode, ModeTheme>): ContrastCheck[] {
  const checks: ContrastCheck[] = [];
  const add = (mode: Mode, foreground: GeneratedRole, background: GeneratedRole, kind: ContrastCheck['kind'], family?: FamilyId) => {
    const target = kind === 'normal-text' ? config.targets.normalText : kind === 'large-text' ? config.targets.largeText : config.targets.ui;
    const ratio = contrast(foreground.color, background.color);
    checks.push({
      id: `${mode}:${kind}:${foreground.semantic}:${background.semantic}`,
      mode, ...(family ? { family } : {}), foreground: foreground.semantic, background: background.semantic,
      foregroundColor: foreground.color, backgroundColor: background.color, ratio, target,
      pass: ratio >= target && isSrgb(foreground.color) && isSrgb(background.color), kind,
    });
  };
  const text = (mode: Mode, foreground: GeneratedRole, backgrounds: GeneratedRole[], family?: FamilyId) => {
    for (const background of backgrounds) for (const kind of ['normal-text', 'large-text'] as const) add(mode, foreground, background, kind, family);
  };
  for (const mode of modes) {
    const theme = themes[mode];
    const allMuted = familyIds.flatMap((id) => Object.entries(theme.families[id].roles).filter(([name]) => name.startsWith('muted.')).map(([, value]) => value!));
    for (const foreground of [theme.foreground.base, theme.foreground.muted]) text(mode, foreground, [...theme.surfaces, ...allMuted]);
    for (const id of familyIds) {
      const family = theme.families[id];
      const muted = Object.entries(family.roles).filter(([name]) => name.startsWith('muted.')).map(([, value]) => value!);
      const emphasis = Object.entries(family.roles).filter(([name]) => name.startsWith('emphasis.')).map(([, value]) => value!);
      for (const state of ['base', 'hover'] as const) {
        text(mode, family.roles[`foreground.${state}`]!, [...theme.surfaces, ...muted], id);
        if (id === 'info') text(mode, { ...family.roles[`foreground.${state}`]!, semantic: tokenName(config.prefix, `fg-link-${state}`) }, [...theme.surfaces, ...muted], id);
      }
      text(mode, theme.foreground.onEmphasis, emphasis, id);
      for (const foreground of [family.roles['border.emphasis.base']!, family.roles['border.emphasis.hover']!]) {
        for (const background of theme.surfaces) add(mode, foreground, background, 'ui-boundary', id);
      }
    }
  }
  return checks;
}

export function generateSystem(input: BuilderConfig): GeneratedSystem {
  validateConfig(input);
  const config = structuredClone(input);
  config.surfaces.step = { light: surfaceStep(input, 'light'), dark: surfaceStep(input, 'dark') };
  config.muted.distance = { light: mutedDistance(input, 'light'), dark: mutedDistance(input, 'dark') };
  config.muted.chromaScale = { light: mutedChromaScale(input, 'light'), dark: mutedChromaScale(input, 'dark') };
  config.emphasis.strategy = emphasisStrategy(input);
  // Older version-1 configurations may contain independent surface C/H; discard them.
  for (const mode of modes) config.surfaces[mode] = { l: config.surfaces[mode].l };
  const diagnostics: string[] = [];
  const themes = {} as Record<Mode, ModeTheme>;
  const families = familyIds.map((id) => config.families.find((family) => family.id === id)!);
  const factories = Object.fromEntries(families.map((family) => [family.id, createFactory(family)])) as Record<FamilyId, ColorFactory>;
  for (const mode of modes) {
    const surfaces = surfaceGeneration(config, mode);
    diagnostics.push(...surfaces.diagnostics);
    const muted = Object.fromEntries(families.map((family) => {
      const result = mutedGeneration(config, mode, family);
      diagnostics.push(...result.diagnostics);
      return [family.id, result.colors];
    })) as Record<FamilyId, ColorValue[]>;
    const solveMode = (foreground: ColorValue) => solveFamilies(families.map((family) => ({ config, mode, family, surfaces: surfaces.colors, muted: muted[family.id], onEmphasis: foreground, factory: factories[family.id] })));
    const achromatic = (l: number) => toColor({ l, c: 0, h: families[0].hue });
    let onEmphasis = achromatic(mode === 'light' ? 1 : 0);
    let solutions = solveMode(onEmphasis);
    if (solutions.some((solution) => !solution.feasible)) {
      const alternate = achromatic(mode === 'light' ? 0 : 1);
      const alternateSolutions = solveMode(alternate);
      const ranking = (items: EmphasisResult[]) => items.filter((item) => item.feasible).length * 100 + Math.min(...items.map((item) => item.score));
      if (ranking(alternateSolutions) > ranking(solutions)) {
        onEmphasis = alternate;
        solutions = alternateSolutions;
      }
      if (solutions.some((solution) => !solution.feasible)) {
        const gray = createFactory({ id: 'neutral', key: 'gray', label: 'On emphasis', hue: families[0].hue, chroma: 0 });
        const common = solveGroup(gray, mode, 0, 1, solutions.flatMap((solution) => solution.colors.map((background) => ({ background, target: textTarget(config) }))));
        if (common.feasible) {
          const intermediateSolutions = solveMode(common.colors[0]);
          if (ranking(intermediateSolutions) > ranking(solutions)) {
            onEmphasis = common.colors[0];
            solutions = intermediateSolutions;
          }
        }
      }
    }
    const uiConstraints = surfaces.colors.map((background) => ({ background, target: config.targets.ui }));
    const sharedBorders = solutions.every((solution) => solution.colors.slice(0, 2).every((color) => contrastScore(color, uiConstraints) >= 1))
      ? solutions.map((solution) => solution.colors.slice(0, 2))
      : solveJointGroup(families.map((family) => ({ factory: factories[family.id], constraints: uiConstraints })), mode, config.emphasis.separation, 2).map((group) => group.colors);
    const generatedFamilies = {} as Record<FamilyId, GeneratedFamily>;
    families.forEach((family, index) => {
      const solution = solutions[index];
      diagnostics.push(...solution.diagnostics.map((message) => `${family.id}: ${message}`));
      if (!solution.shared) diagnostics.push(`${mode} ${family.id}: emphasis and foreground use separate colors because their combined constraints cannot be satisfied by one state group.`);
      const roles: GeneratedFamily['roles'] = {};
      const put = (path: FamilyRole, color: ColorValue) => { roles[path] = role(color, semanticName(config.prefix, family.id, path)); };
      muted[family.id].forEach((color, state) => put(`muted.${allStates[state]}`, color));
      solution.colors.forEach((color, state) => put(`emphasis.${allStates[state]}`, color));
      put('foreground.base', solution.foreground[0]);
      put('foreground.hover', solution.foreground[1]);
      put('border.muted.base', muted[family.id][1]);
      put('border.muted.hover', muted[family.id][2]);
      const borders = sharedBorders[index];
      put('border.emphasis.base', borders[0]);
      put('border.emphasis.hover', borders[1]);
      generatedFamilies[family.id] = { id: family.id, key: family.key, roles };
    });
    const globalConstraints = [...surfaces.colors, ...familyIds.flatMap((id) => muted[id])].map((background) => ({ background, target: textTarget(config) }));
    const mutedForeground = solveGroup(factories.neutral, mode, 0, 1, globalConstraints).colors[0];
    const desiredBase = factories.neutral(mode === 'light' ? Math.min(0.2, mutedForeground.l) : Math.max(0.94, mutedForeground.l));
    const baseForeground = contrastScore(desiredBase, globalConstraints) >= 1 ? desiredBase : mutedForeground;
    themes[mode] = {
      surfaces: surfaces.colors.map((color, index) => role(color, tokenName(config.prefix, index === 0 ? 'bg-surface-base' : `bg-surface-level-${index}`))),
      foreground: { base: role(baseForeground, tokenName(config.prefix, 'fg-base')), muted: role(mutedForeground, tokenName(config.prefix, 'fg-muted')), onEmphasis: role(onEmphasis, tokenName(config.prefix, 'fg-on-emphasis')) },
      families: generatedFamilies,
    };
  }
  if (emphasisStrategy(config) === 'shared') {
    const count = config.emphasis.selected ? 4 : 3;
    for (const family of families) {
      const lightFamily = themes.light.families[family.id];
      const darkFamily = themes.dark.families[family.id];
      const lightAnchor = brandAnchoring(config, 'light', family.id, 'emphasis.base');
      const darkAnchor = brandAnchoring(config, 'dark', family.id, 'emphasis.base');
      if (lightAnchor?.locked && darkAnchor?.locked && colorIdentity(lightAnchor.color) !== colorIdentity(darkAnchor.color)) {
        diagnostics.push(`${family.id}: shared emphasis cannot reconcile distinct light and dark exact locks; each locked base is preserved.`);
        continue;
      }
      const locked = lightAnchor?.locked ? lightAnchor.color : darkAnchor?.locked ? darkAnchor.color : undefined;
      const states = locked ? generateStates(locked, 'light', config.emphasis.separation, count).colors : allStates.slice(0, count).map((state) => lightFamily.roles[`emphasis.${state}` as FamilyRole]!.color);
      allStates.slice(0, count).forEach((state, index) => {
        const path = `emphasis.${state}` as FamilyRole;
        lightFamily.roles[path] = role(states[index], semanticName(config.prefix, family.id, path));
        darkFamily.roles[path] = role(states[index], semanticName(config.prefix, family.id, path));
      });
    }
    themes.dark.foreground.onEmphasis = role(themes.light.foreground.onEmphasis.color, tokenName(config.prefix, 'fg-on-emphasis'));
  }
  for (const anchor of config.anchors.filter((anchor) => anchor.locked)) {
    if (!isSrgb(anchor.color)) diagnostics.push(`${anchor.mode} ${anchor.family} ${anchor.role}: locked color is outside the sRGB gamut and is preserved exactly. Ratios use a clipped-sRGB estimate; these checks cannot be certified and remain failed.`);
  }
  const originalChecks = contextualChecks(config, themes);
  const reused = reuseGrayPositions(config, themes, (candidate) => contextualChecks(config, candidate)
    .every((check, index) => check.pass === originalChecks[index].pass));
  const deduplicated = deduplication(reused, config.prefix);
  const checks = contextualChecks(config, deduplicated.modes);
  for (const mode of modes) {
    const failed = checks.filter((check) => check.mode === mode && !check.pass);
    if (failed.length) diagnostics.push(`${mode}: ${failed.length} contextual contrast checks fail. No complete solution was found for these surfaces, targets, and brand locks in the bounded 0.001-lightness search; failed checks retain their measured ratios.`);
  }
  return { config, ...deduplicated, semantics: semanticMapping(deduplicated.modes, config.prefix), checks, diagnostics: [...new Set(diagnostics)] };
}
