import { BoundedCache } from './bounded-cache';
import { conflictingLightnessLocks } from './shared-lightness';
import { parseLockedColor, toColor } from './color';
import type { BuilderConfig, ChromaCurve, ColorValue, FamilyConfig, FamilyId, GeneratedSystem } from './types';

export type CurveGroup = 'brand' | 'semantic';
export interface CurvePoint { l: number; c: number }

/** App migration only: direct engine callers may retain the legacy model. */
export function withChromaCurves(input: BuilderConfig): BuilderConfig {
  if (input.chromaCurves) return input;
  const config = structuredClone(input);
  const source = config.anchors.find(a => a.family === 'brand');
  const brand = source ? parseLockedColor(source.color) : undefined;
  const profile: ChromaCurve = { peakLightness: Math.max(.01, Math.min(.99, brand?.l ?? .55)),
    peakChroma: brand?.c ?? config.families.find(f => f.id === 'brand')!.chroma, darkBend: .5, lightBend: .5 };
  config.chromaCurves = { brand: { ...profile }, semantic: { ...profile } };
  return config;
}

export function curvePins(config: BuilderConfig): CurvePoint[] {
  const pins = config.anchors.filter(a => a.family === 'brand' && a.locked).map(a => {
    const { l, c } = parseLockedColor(a.color); return { l, c };
  }).sort((a,b) => a.l-b.l || a.c-b.c);
  return pins.filter((p,i) => !i || Math.abs(p.l-pins[i-1].l)>1e-9 || Math.abs(p.c-pins[i-1].c)>1e-9);
}

export function effectiveCurve(config: BuilderConfig, group: CurveGroup): ChromaCurve {
  const curve = config.chromaCurves![group];
  const pin = group === 'brand' ? curvePins(config).filter(p => p.l>0 && p.l<1).sort((a,b)=>b.c-a.c)[0] : undefined;
  return pin ? { ...curve, peakLightness: pin.l, peakChroma: pin.c } : curve;
}

export function validateChromaCurves(config: BuilderConfig): void {
  if (config.chromaCurves === undefined) return;
  for (const group of ['brand','semantic'] as const) {
    const curve = config.chromaCurves?.[group];
    if (!curve || !Number.isFinite(curve.peakLightness) || curve.peakLightness<.01 || curve.peakLightness>.99 ||
      !Number.isFinite(curve.peakChroma) || curve.peakChroma<0 || curve.peakChroma>1 ||
      !Number.isFinite(curve.darkBend) || curve.darkBend<0 || curve.darkBend>1 ||
      !Number.isFinite(curve.lightBend) || curve.lightBend<0 || curve.lightBend>1 ||
      (curve.darkPosition !== undefined && (!Number.isFinite(curve.darkPosition) || curve.darkPosition<0 || curve.darkPosition>2/3)) ||
      (curve.lightPosition !== undefined && (!Number.isFinite(curve.lightPosition) || curve.lightPosition<1/3 || curve.lightPosition>1)))
      throw new Error(`Invalid ${group} chroma curve: peak lightness must be 0.01–0.99, chroma 0–1, and shape handles 0–1.`);
  }
  const conflicts = conflictingLightnessLocks(config);
  if (conflicts.length) return; // Shared-lightness validation reports the primary hard-lock conflict.
  for (const anchor of config.anchors.filter(a=>a.locked && a.family !== 'brand' && a.family !== 'neutral')) {
    const source = parseLockedColor(anchor.color);
    const family = config.families.find(f=>f.id===anchor.family)!;
    const expected = curveColor(config,family,source.l,source.h);
    if (Math.abs(expected.c-source.c)>1e-9) throw new Error(`Exact ${anchor.family} color conflicts with the shared semantic chroma curve. Adjust the curve or remove that exact lock.`);
  }
  const pins = curvePins(config);
  if (pins.some((p,i) => i && Math.abs(p.l-pins[i-1].l)<1e-9 && Math.abs(p.c-pins[i-1].c)>1e-9))
    throw new Error('Conflicting Brand chroma curve pins require different chroma at the same lightness.');
}

interface CurveCache {
  curves: { brand: ChromaCurve; semantic: ChromaCurve };
  anchors: { family: FamilyId; locked: boolean; color: string }[];
  brand: CurvePoint[]; semantic: CurvePoint[];
  values: { brand: BoundedCache<number, number>; semantic: BoundedCache<number, number> };
}
const curveFields = ['peakLightness','peakChroma','darkBend','lightBend','darkPosition','lightPosition'] as const;
const nodeCache = new WeakMap<BuilderConfig, CurveCache>();
function unchanged(config: BuilderConfig, cached: CurveCache): boolean {
  for (const group of ['brand','semantic'] as const)
    for (const field of curveFields) if (config.chromaCurves![group][field] !== cached.curves[group][field]) return false;
  return config.anchors.length === cached.anchors.length && config.anchors.every((a,i) =>
    a.family === cached.anchors[i].family && a.locked === cached.anchors[i].locked && a.color === cached.anchors[i].color);
}
function nodes(config: BuilderConfig): CurveCache {
  let cached = nodeCache.get(config);
  if (!cached || !unchanged(config,cached)) {
    const make = (kind: CurveGroup) => {
      const curve = effectiveCurve(config, kind);
      const pins = kind === 'brand' ? curvePins(config).filter(p=>p.l>0 && p.l<1) : [];
      const peak = { l: curve.peakLightness, c: curve.peakChroma };
      const interior = pins.length ? pins : [peak];
      return [{ l:0,c:0 }, ...interior, { l:1,c:0 }];
    };
    cached = { curves: { brand: { ...config.chromaCurves!.brand }, semantic: { ...config.chromaCurves!.semantic } },
      anchors: config.anchors.map(a=>({family:a.family,locked:a.locked,color:a.color})),
      brand: make('brand'), semantic: make('semantic'),
      values: { brand: new BoundedCache(2048), semantic: new BoundedCache(2048) } };
    nodeCache.set(config,cached);
  }
  return cached;
}

/** Ordered cubic Bézier segments: one C for each L, no overshoot or loops.
 * Adjacent interior segments have horizontal tangents, including exact pins. */
export function requestedChroma(config: BuilderConfig, family: FamilyId, lightness: number): number {
  const familyConfig = config.families.find(f=>f.id===family)!;
  if (!config.chromaCurves || family==='neutral') return familyConfig.chroma;
  const group = family==='brand' ? 'brand' : 'semantic';
  const curve = config.chromaCurves[group];
  const cached = nodes(config);
  const points = cached[group];
  const l = Math.max(0,Math.min(1,lightness));
  const known = cached.values[group].get(l);
  if (known !== undefined) return known;
  const index = Math.max(0,points.findIndex((_,i)=>i<points.length-1 && l<=points[i+1].l));
  const a=points[index], b=points[index+1];
  const fraction=(l-a.l)/(b.l-a.l);
  const x1=index===0 ? curve.darkPosition ?? 1/3 : 1/3;
  const x2=index===points.length-2 ? curve.lightPosition ?? 2/3 : 2/3;
  let t=fraction;
  if (fraction>0 && fraction<1 && (Math.abs(x1-1/3)>1e-12 || Math.abs(x2-2/3)>1e-12)) {
    let low=0,high=1;
    for(let iteration=0;iteration<36;iteration++) {
      t=(low+high)/2; const u=1-t;
      const position=3*u*u*t*x1+3*u*t*t*x2+t*t*t;
      if(position<fraction)low=t;else high=t;
    }
    t=(low+high)/2;
  }
  const u=1-t;
  const p1=index===0 ? a.c+(b.c-a.c)*curve.darkBend : a.c;
  const p2=index===points.length-2 ? b.c+(a.c-b.c)*curve.lightBend : b.c;
  const value = u*u*u*a.c+3*u*u*t*p1+3*u*t*t*p2+t*t*t*b.c;
  cached.values[group].set(l,value);
  return value;
}

export function curveColor(config: BuilderConfig, family: FamilyConfig, l: number, hue=family.hue): ColorValue {
  return toColor({ l: Math.max(0,Math.min(1,l)), c: requestedChroma(config,family.id,l), h:hue });
}

/** Verify actual role colors against their stored curve, not cached contrast facts. */
export function chromaCurveIssues(system: Pick<GeneratedSystem,'config'|'modes'>): string[] {
  if (!system.config.chromaCurves) return [];
  const issues: string[] = [];
  for (const mode of ['light','dark'] as const) for (const family of system.config.families.filter(f=>f.id!=='neutral')) {
    for (const role of Object.values(system.modes[mode].families[family.id].roles)) {
      if (!role) continue;
      const expected = curveColor(system.config,family,role.color.l,role.color.h);
      if (Math.abs(expected.c-role.color.c)>1e-9) issues.push(`${mode} ${role.semantic}: color does not match its chroma curve.`);
    }
  }
  return issues;
}

export function assertChromaCurves(system: Pick<GeneratedSystem,'config'|'modes'>): void {
  const issues=chromaCurveIssues(system);
  if (issues.length) throw new Error(`Chroma curve requirements failed: ${issues.join(' ')}`);
}
