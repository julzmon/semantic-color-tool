import { curveColor } from './chroma-curves';
import { colorIdentity, contrast, isSrgb, parseLockedColor, toColor } from './color';
import { emphasisStateColors } from './emphasis';
import type { BuilderConfig, ColorValue, FamilyId, GeneratedRole, GeneratedSystem, Mode, ModeTheme, State } from './types';

type System = Pick<GeneratedSystem, 'config' | 'modes'>;
const modes: Mode[] = ['light', 'dark'];
const states: State[] = ['base', 'hover', 'active', 'selected'];
const dir = (mode: Mode) => mode === 'light' ? -1 : 1;
const sharedBase = (config: BuilderConfig) => config.emphasis.reverseDarkStates || config.emphasis.strategy !== 'adaptive';
const target = (config: BuilderConfig) => Math.max(config.targets.normalText, config.targets.largeText);
const anchor = (system: System, family: FamilyId, mode: Mode, role: 'emphasis.base' | 'foreground.base') => {
  const found = system.config.anchors.find(a => a.locked && a.family === family && a.role === role && (a.mode === mode || a.mode === 'both'));
  return found ? parseLockedColor(found.color) : undefined;
};
const mapped = (system: System, family: FamilyId, l: number, fixed?: ColorValue) => {
  const config = system.config.families.find(f => f.id === family)!;
  return system.config.chromaCurves && family !== 'neutral' ? curveColor(system.config, config, l, fixed?.h ?? config.hue) : toColor({ l: Math.max(0, Math.min(1, l)), c: fixed?.c ?? config.chroma, h: fixed?.h ?? config.hue });
};
export function candidateStates(config: BuilderConfig, base: ColorValue, mode: Mode, family?: FamilyId): ColorValue[] {
  if (config.emphasis.mixWeights) return emphasisStateColors(config, base, mode, config.families.find(f=>f.id===family));
  const stateMode = sharedBase(config) && !config.emphasis.reverseDarkStates ? 'light' : mode;
  return states.slice(0, config.emphasis.selected ? 4 : 3).map((_, i) => i === 0 ? base : toColor({
    l: Math.max(0, Math.min(1, base.l + dir(stateMode) * config.emphasis.separation * i)), c: base.c, h: base.h,
  }));
}

export interface CandidateResult {
  valid: boolean;
  failures: string[];
  relationships: string[];
  emphasis: Partial<Record<Mode, ColorValue[]>>;
  foreground: Partial<Record<Mode, ColorValue[]>>;
}

/** Evaluate a complete base-color proposal, including all derived states and coupled themes. */
export function familyCandidate(system: System, family: FamilyId, l: number, foregroundModes: Mode[], includeEmphasis = true, emphasisMode: Mode = 'light', proposed?: ColorValue): CandidateResult {
  const { config } = system;
  const failures: string[] = [];
  const relationships: string[] = [];
  const emphasis: CandidateResult['emphasis'] = {};
  const foreground: CandidateResult['foreground'] = {};
  const require = (label: string, pass: boolean) => { relationships.push(label); if (!pass) failures.push(label); };
  const emphasisModes = includeEmphasis ? sharedBase(config) ? modes : [emphasisMode] : [];
  const locks = [...emphasisModes.map(mode => anchor(system, family, mode, 'emphasis.base')),
    ...foregroundModes.map(mode => anchor(system, family, mode, 'foreground.base'))].filter((c): c is ColorValue => !!c);
  const base = proposed ?? locks[0] ?? mapped(system, family, l);
  require('Base lightness within 0–1', l >= 0 && l <= 1 && Math.abs(base.l - l) < 1e-8);
  const customRecipe = proposed && colorIdentity(proposed) !== colorIdentity(mapped(system, family, l)) ? proposed : undefined;
  for (const fixed of locks) require(`Exact lock ${fixed.css}`, colorIdentity(base) === colorIdentity(fixed));
  for (const mode of emphasisModes) {
    // Preserve each exact CSS spelling even when two locks describe the same color.
    const fixed = anchor(system, family, mode, 'emphasis.base');
    const recipeBase = fixed ?? base;
    const colors = config.emphasis.mixWeights ? candidateStates(config, recipeBase, mode, family)
      : candidateStates(config, recipeBase, mode, family).map((color, i) => i === 0 ? recipeBase : mapped(system, family, color.l, fixed ?? customRecipe));
    emphasis[mode] = colors;
    const original = states.slice(0, colors.length).map(state => system.modes[mode].families[family].roles[`emphasis.${state}`]!.color);
    colors.forEach((color, index) => {
      const label = `${mode}: on-emphasis text → ${family} emphasis-${states[index]} ≥ ${target(config)}:1`;
      require(label, isSrgb(color) && isSrgb(system.modes[mode].foreground.onEmphasis.color)
        && colorIdentity(color) !== colorIdentity(system.modes[mode].foreground.onEmphasis.color)
        && contrast(color, system.modes[mode].foreground.onEmphasis.color) >= target(config));
      if (index) {
        const before = original[index].l - original[index - 1].l;
        const after = color.l - colors[index - 1].l;
        // Configured recipes determine magnitude; retain every existing nonzero direction.
        require(`${mode}: emphasis-${states[index]} hierarchy and configured recipe`, Math.abs(before) < 1e-9 || before * after > 1e-18);
      }
    });
    if (!config.emphasis.mixWeights) {
      const stateMode = sharedBase(config) && !config.emphasis.reverseDarkStates ? 'light' : mode;
      const end = base.l + dir(stateMode) * config.emphasis.separation * (colors.length - 1);
      require(`${mode}: full emphasis state spacing`, end >= -1e-9 && end <= 1 + 1e-9);
    }
  }
  for (const mode of foregroundModes) {
    const fixed = anchor(system, family, mode, 'foreground.base');
    const hoverL = base.l + dir(mode) * config.emphasis.separation;
    const colors = [fixed ?? base, mapped(system, family, hoverL, fixed ?? customRecipe)];
    foreground[mode] = colors;
    require(`${mode}: foreground hover spacing ${config.emphasis.separation}`, hoverL >= 0 && hoverL <= 1);
    const theme = system.modes[mode];
    const backgrounds = [...theme.surfaces, ...states.flatMap(state => {
      const value = theme.families[family].roles[`muted.${state}`]; return value ? [value] : [];
    })];
    colors.forEach((color, index) => backgrounds.forEach(background => require(
      `${mode}: ${family} foreground-${states[index]} → ${background.semantic} ≥ ${target(config)}:1`,
      isSrgb(color) && isSrgb(background.color) && contrast(color, background.color) >= target(config),
    )));
  }
  return { valid: failures.length === 0, failures, relationships, emphasis, foreground };
}


/** Preserve an inherited anchor recipe; ordinary family recipes still recover chroma where gamut permits. */
function roleFactory(system: System, family: FamilyId, mode: Mode, kind: 'foreground.base' | 'emphasis.base'): (l: number) => ColorValue {
  const current = system.modes[mode].families[family].roles[kind]!.color;
  const ordinary = colorIdentity(current) === colorIdentity(mapped(system, family, current.l));
  return l => Math.abs(current.l - l) < 1e-10 ? current : system.config.chromaCurves && family !== 'neutral' ? curveColor(system.config, system.config.families.find(f=>f.id===family)!, l, current.h) : ordinary ? mapped(system, family, l)
    : toColor({ l: Math.max(0, Math.min(1, l)), c: current.c, h: current.h });
}

export interface SampleRun { first: number; last: number; values: number[] }
export function sampleRuns(samples: number[], step = .001): SampleRun[] {
  const runs: SampleRun[] = [];
  for (const value of samples) {
    const previous = runs.at(-1);
    if (previous && Math.abs(value - previous.last - step) < 1e-9) { previous.last = value; previous.values.push(value); }
    else runs.push({ first: value, last: value, values: [value] });
  }
  return runs;
}
export interface FeasibilityReport {
  chosen: number;
  chosenValid: boolean;
  step: number;
  samples: number[];
  runs: SampleRun[];
  locked: boolean;
  relationships: string[];
  restricting: { relationship: string; rejectedSamples: number }[];
  jointSamples: number[];
  jointRuns: SampleRun[];
  jointRestricting: { relationship: string; rejectedSamples: number }[];
  lightnessOverlaps: { role: string; samples: number[]; runs: SampleRun[] }[];
  sharing: { completeColor: string[]; lightnessOnly: string[] };
  decision: string;
}
export function themeRoles(theme: ModeTheme): GeneratedRole[] {
  return [...theme.surfaces, ...Object.values(theme.foreground), ...Object.values(theme.families).flatMap(f => Object.values(f.roles) as GeneratedRole[])];
}

/** On-demand inspection leaves the generation/balancing hot path unchanged. Runs contain ONLY verified discrete samples. */
export function inspectFeasibility(system: GeneratedSystem, mode: Mode, semantic: string): FeasibilityReport {
  // Link foregrounds are semantic aliases of Info, with identical requirements.
  semantic = semantic.replace(`--${system.config.prefix}-fg-link-`, `--${system.config.prefix}-fg-info-`);
  const selected = themeRoles(system.modes[mode]).find(r => r.semantic === semantic);
  if (!selected) throw new Error(`Unknown semantic role ${semantic}.`);
  const family = system.config.families.find(f => ['foreground.base', 'foreground.hover', 'emphasis.base', 'emphasis.hover', 'emphasis.active', 'emphasis.selected'].some(path => system.modes[mode].families[f.id].roles[path as keyof typeof system.modes.light.families.brand.roles]?.semantic === semantic));
  const familyRoles = family ? system.modes[mode].families[family.id].roles : undefined;
  const path = familyRoles ? Object.entries(familyRoles).find(([, role]) => role?.semantic === semantic)?.[0] : undefined;
  const isForeground = path?.startsWith('foreground.') ?? false;
  const isEmphasis = path?.startsWith('emphasis.') ?? false;
  const grouped = !!family && (isForeground || isEmphasis);
  const baseLightness = (l: number) => {
    if (path === 'foreground.hover') return l - dir(mode) * system.config.emphasis.separation;
    if (isEmphasis && path !== 'emphasis.base') {
      const state = path!.split('.')[1] as Exclude<State, 'base'>;
      if (system.config.emphasis.mixWeights) {
        const weight = system.config.emphasis.mixWeights[state];
        const white = mode === 'dark' && (system.config.emphasis.reverseDarkStates || system.config.emphasis.strategy === 'adaptive');
        return weight > 0 ? (l - (white ? 1 - weight : 0)) / weight : NaN;
      }
      const stateMode = sharedBase(system.config) && !system.config.emphasis.reverseDarkStates ? 'light' : mode;
      return l - dir(stateMode) * system.config.emphasis.separation * states.indexOf(state);
    }
    return l;
  };
  const onEmphasisText = semantic === `--${system.config.prefix}-fg-on-emphasis`;
  const coupledText = onEmphasisText && sharedBase(system.config);
  const groupFactory = grouped ? roleFactory(system, family.id, mode, isForeground ? 'foreground.base' : 'emphasis.base') : undefined;
  const related = system.checks.filter(c => (c.mode === mode || coupledText) && (c.foreground === semantic || c.background === semantic));
  const fixed = selected.color.source ? selected.color : undefined;
  const factory = (l: number) => fixed ?? toColor({ l, c: selected.color.c, h: selected.color.h });
  const evaluate = (l: number): { valid: boolean; failures: string[]; relationships: string[] } => {
    if (grouped) {
      const baseL = baseLightness(l);
      if (!Number.isFinite(baseL)) {
        const base = familyRoles!['emphasis.base']!.color;
        const full = familyCandidate(system, family.id, base.l, [], true, mode, base);
        const relationship = 'State recipe has zero base retention; lightness is fixed by its mix target';
        const fits = Math.abs(l - selected.color.l) < 1e-9;
        return { valid: fits && full.valid, failures: [...full.failures, ...(fits ? [] : [relationship])], relationships: [...full.relationships, relationship] };
      }
      return familyCandidate(system, family.id, baseL, isForeground ? [mode] : [], isEmphasis, mode, groupFactory!(baseL));
    }
    const candidate = factory(l);
    const failures: string[] = isSrgb(candidate) ? [] : ['sRGB gamut membership']; const relationships: string[] = ['sRGB gamut membership'];
    for (const check of related) {
      const fg = check.foreground === semantic ? candidate : check.foregroundColor;
      const bg = check.background === semantic ? candidate : check.backgroundColor;
      const label = `${check.mode}: ${check.foreground} → ${check.background} ≥ ${check.target}:1`;
      relationships.push(label);
      if (!isSrgb(fg) || !isSrgb(bg) || contrast(fg, bg) < check.target || onEmphasisText && colorIdentity(fg) === colorIdentity(bg)) failures.push(label);
    }
    return { valid: failures.length === 0, failures, relationships };
  };
  // A lock can be off-grid. Include the actual chosen value separately, never bridge it into a range.
  const locked = grouped ? system.config.anchors.some(a => a.locked && a.family === family.id && a.role === (isForeground ? 'foreground.base' : 'emphasis.base') && (a.mode === mode || a.mode === 'both' || isEmphasis && sharedBase(system.config))) : !!fixed;
  const candidates = locked ? [selected.color.l] : Array.from({ length: 1001 }, (_, i) => i / 1000);
  const samples: number[] = []; const rejected = new Map<string, number>();
  const relationships = evaluate(selected.color.l).relationships;
  for (const l of candidates) {
    const result = evaluate(l);
    if (result.valid) samples.push(l);
    else for (const label of result.failures) rejected.set(label, (rejected.get(label) ?? 0) + 1);
  }
  const jointCandidates = [...new Set([...Array.from({ length: 1001 }, (_, i) => i / 1000), ...(grouped ? [familyRoles!['emphasis.base']!.color.l, familyRoles!['foreground.base']!.color.l] : [])])].sort((a,b) => a-b);
  const jointRejected = new Map<string, number>();
  const jointFactories = grouped ? [roleFactory(system, family.id, mode, 'foreground.base'), roleFactory(system, family.id, mode, 'emphasis.base')] : [];
  const jointSamples = grouped ? jointCandidates.filter(l => {
    const results = jointFactories.map(factory => familyCandidate(system, family.id, l, [mode], true, mode, factory(l)));
    if (results.some(result => result.valid)) return true;
    for (const label of new Set(results.flatMap(result => result.failures))) jointRejected.set(label, (jointRejected.get(label) ?? 0) + 1);
    return false;
  }) : [];
  const lightnessOverlaps = grouped && (path === 'foreground.base' || path === 'emphasis.base')
    ? system.config.families.filter(peer => peer.id !== family.id).map(peer => {
      const factory = roleFactory(system, peer.id, mode, path);
      const values = samples.filter(l => familyCandidate(system, peer.id, l, isForeground ? [mode] : [], isEmphasis, mode, factory(l)).valid);
      return { role: `${mode}:${system.modes[mode].families[peer.id].roles[path]!.semantic}`, samples: values, runs: sampleRuns(values) };
    }) : [];
  const sharing: FeasibilityReport['sharing'] = { completeColor: [], lightnessOnly: [] };
  for (const peerMode of modes) for (const peer of themeRoles(system.modes[peerMode])) {
    if (peerMode === mode && peer.semantic === semantic) continue;
    const label = `${peerMode}:${peer.semantic}`;
    if (colorIdentity(peer.color) === colorIdentity(selected.color)) sharing.completeColor.push(label);
    else if (Math.abs(peer.color.l - selected.color.l) < 1e-9) sharing.lightnessOnly.push(label);
  }
  const chosenValid = evaluate(selected.color.l).valid;
  const currentlyShared = grouped && colorIdentity(familyRoles!['foreground.base']!.color) === colorIdentity(familyRoles!['emphasis.base']!.color);
  const actual = currentlyShared ? 'Family foreground and emphasis base currently share a complete color. ' : 'Family foreground and emphasis base currently use separate colors. ';
  const decision = grouped ? jointSamples.length
    ? `${actual}Joint foreground/emphasis sharing has ${jointSamples.length} verified candidate${jointSamples.length === 1 ? '' : 's'} in this theme; emphasis requirements include coupled themes. These are family-only samples, not a verified common solution across all families. Generation preserves shared lightness by role.`
    : actual + 'Keep foreground and emphasis separate: no joint solution was verified in this bounded search, including locks and state hierarchy. This does not prove impossibility.'
    : 'Samples check the selected role against its current contrast relationships. Related roles remain fixed; derived states are not independent controls.';
  return { chosen: selected.color.l, chosenValid, step: .001, samples, runs: sampleRuns(samples), locked, relationships,
    restricting: [...rejected].map(([relationship, rejectedSamples]) => ({ relationship, rejectedSamples })).sort((a,b) => b.rejectedSamples - a.rejectedSamples),
    jointSamples, jointRuns: sampleRuns(jointSamples),
    jointRestricting: [...jointRejected].map(([relationship, rejectedSamples]) => ({ relationship, rejectedSamples })).sort((a,b) => b.rejectedSamples - a.rejectedSamples),
    lightnessOverlaps, sharing, decision };
}

/** Exact fill locks may make contrast unsatisfied; their text must still use a distinct color. */
export function separateOnEmphasis(system: System): string[] {
  const notices: string[] = [];
  const groups: Mode[][] = sharedBase(system.config) ? [['light', 'dark']] : [['light'], ['dark']];
  for (const group of groups) {
    const fills = group.flatMap(mode => Object.values(system.modes[mode].families).flatMap(family =>
      states.flatMap(state => { const role = family.roles[`emphasis.${state}`]; return role ? [role.color] : []; })));
    const identities = new Set(fills.map(colorIdentity));
    if (!group.some(mode => identities.has(colorIdentity(system.modes[mode].foreground.onEmphasis.color)))) continue;
    const current = system.modes[group[0]].foreground.onEmphasis.color;
    const candidates = Array.from({ length: 1001 }, (_, i) => toColor({ l: i / 1000, c: 0, h: current.h }))
      .filter(color => !identities.has(colorIdentity(color)))
      .sort((a, b) => Math.abs(a.l - current.l) - Math.abs(b.l - current.l));
    let best = candidates[0]; let bestScore = -Infinity;
    for (const color of candidates) {
      const score = Math.min(...fills.map(fill => isSrgb(fill) ? contrast(color, fill) : 0));
      if (score > bestScore) { best = color; bestScore = score; }
    }
    for (const mode of group) system.modes[mode].foreground.onEmphasis.color = best;
    notices.push(`${group.join('/')} on-emphasis: text moved to a separate color from exact fills. Contrast remains independently checked; no passing contrast solution is implied.`);
  }
  return notices;
}
