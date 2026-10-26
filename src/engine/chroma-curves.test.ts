import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import { generateSystem } from './generate';
import { toColor } from './color';
import { withMutedStateControls } from './muted';
import { balanceConfiguration } from './balance';
import { cssTokenModel, tokenFoundation } from './tokens';
import { exportJson } from './export';
import { parseConfigurationJson } from '../ui/configuration';
const defaults = () => withMutedStateControls(configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url), 'utf8'))));
const shape = { peakLightness: .5, peakChroma: .1, darkBend: .4, lightBend: .6 };
const curved = () => Object.assign(defaults(), { chromaCurves: { brand: { ...shape }, semantic: { ...shape } } });
const expectedC = (l: number) => {
  if (l <= .5) { const t = l / .5; return .1 * (3 * (1-t)**2*t*.4 + 3*(1-t)*t*t + t**3); }
  const t = (l-.5)/.5; return .1 * ((1-t)**3 + 3*(1-t)**2*t + 3*(1-t)*t*t*.6);
};

it.each([false, true])('samples one profile across semantic bases, borders and states in both themes (reverse=%s)', reverse => {
  const input = curved(); input.emphasis.selected = true; input.emphasis.reverseDarkStates = reverse;
  input.muted.borderStrength = { light: .05, dark: .08 };
  const system = balanceConfiguration(input, input).system;
  for (const mode of ['light','dark'] as const) for (const family of system.config.families.filter(f=>f.id!=='neutral')) {
    for (const role of Object.values(system.modes[mode].families[family.id].roles)) {
      const expected = toColor({ l: role!.color.l, c: expectedC(role!.color.l), h: family.hue });
      expect(role!.color.c, `${mode}:${role!.semantic}`).toBeCloseTo(expected.c, 8);
    }
  }
  expect(system.checks.every(c=>c.pass)).toBe(true);
});

it('serializes all curve-mode states explicitly, including constant-chroma Neutral', () => {
  const system = generateSystem(curved());
  const tokens = cssTokenModel(system).semantics;
  expect(tokens.find(t=>t.name==='--kds-bg-info-emphasis-hover')!.value).not.toContain('color-mix');
  expect(tokens.find(t=>t.name==='--kds-bg-neutral-emphasis-hover')!.value).not.toContain('color-mix');
});

it('round-trips the two curve profiles through configuration export', () => {
  const input = curved();
  expect(parseConfigurationJson(exportJson(generateSystem(input)), defaults())).toHaveProperty('chromaCurves', input.chromaCurves);
});

it('rejects malformed curve values rather than silently accepting them', () => {
  const input = curved(); input.chromaCurves.semantic.darkBend = 2;
  expect(()=>generateSystem(input)).toThrow(/chroma curve/i);
});

it('pins the exact Brand source while leaving semantic shaping independent', async () => {
  const { requestedChroma } = await import('./chroma-curves');
  const input = curved(); input.anchors = [{ family:'brand', role:'emphasis.base', mode:'both', color:'#cc0000', locked:true }];
  const locked = generateSystem(input).modes.light.families.brand.roles['emphasis.base']!.color;
  const semanticBefore = requestedChroma(input,'info',locked.l);
  expect(requestedChroma(input,'brand',locked.l)).toBeCloseTo(locked.c,10);
  const before = requestedChroma(input,'brand',.2);
  input.chromaCurves.brand.darkBend = .9;
  expect(requestedChroma(input,'brand',.2)).not.toBeCloseTo(before,8);
  expect(requestedChroma(input,'brand',locked.l)).toBeCloseTo(locked.c,10);
  expect(requestedChroma(input,'info',locked.l)).toBe(semanticBefore);
  const result = balanceConfiguration(input,input);
  expect(result.system.modes.light.families.brand.roles['emphasis.base']!.color.css).toBe('#cc0000');
});

it('keeps curve endpoints neutral, interpolates pins, and never overshoots between knots', async () => {
  const { requestedChroma } = await import('./chroma-curves');
  const input = curved();
  input.anchors = [
    { family:'brand', role:'emphasis.base', mode:'both', color:'oklch(0.5 0.1 29)', locked:true },
    { family:'brand', role:'foreground.base', mode:'light', color:'oklch(0.3 0.06 29)', locked:true },
  ];
  expect(requestedChroma(input,'brand',.3)).toBeCloseTo(.06,10);
  expect(requestedChroma(input,'brand',.5)).toBeCloseTo(.1,10);
  for (const family of ['brand','info'] as const) {
    expect(requestedChroma(input,family,0)).toBe(0);
    expect(requestedChroma(input,family,1)).toBe(0);
    for(let i=0;i<=100;i++) expect(requestedChroma(input,family,i/100)).toBeGreaterThanOrEqual(0);
  }
  input.anchors[1].color='oklch(0.5 0.06 29)';
  expect(()=>generateSystem(input)).toThrow(/conflicting.*chroma curve pins/i);
});

it('does not change Neutral when only curve profiles change', () => {
  const input=curved(); const before=generateSystem(input);
  input.chromaCurves.brand.peakChroma=.25; input.chromaCurves.semantic.peakChroma=.2;
  const after=generateSystem(input);
  // Neutral chroma is independent even if contrast solving moves shared L positions.
  for(const mode of ['light','dark'] as const) for(const path of ['muted.base','muted.hover','muted.active'] as const)
    expect(after.modes[mode].families.neutral.roles[path]!.color.c).toBe(before.modes[mode].families.neutral.roles[path]!.color.c);
});

it('keeps requested profiles intact through lightness reduction and restoration', async () => {
  const { reduceLightnessStops }=await import('./reduceLightness');
  const input=curved(); const initial=balanceConfiguration(input,input);
  const reduced=reduceLightnessStops(initial.config);
  expect(reduced.config.chromaCurves).toEqual(input.chromaCurves);
  expect(balanceConfiguration(reduced.config,reduced.config).system).toEqual(reduced.system);
});

it.each([false,true])('samples the profile for legacy additive states, including exact bases (reverse=%s)', reverse => {
  const input=curved(); delete input.emphasis.mixWeights;
  input.emphasis.reverseDarkStates=reverse;
  input.anchors=[{family:'brand',role:'emphasis.base',mode:'both',color:'oklch(0.5 0.1 29)',locked:true}];
  const system=generateSystem(input);
  for(const mode of ['light','dark'] as const) for(const path of ['emphasis.hover','emphasis.active'] as const) {
    const actual=system.modes[mode].families.brand.roles[path]!.color;
    const expected=toColor({l:actual.l,c:expectedC(actual.l),h:actual.h});
    expect(actual.c).toBeCloseTo(expected.c,8);
  }
});

it('rejects imported semantic locks that contradict their shared curve', () => {
  const input=curved();
  input.anchors=[{family:'info',role:'emphasis.base',mode:'both',color:'oklch(0.45 0.02 220)',locked:true}];
  expect(()=>balanceConfiguration(input,input)).toThrow(/semantic chroma curve/i);
});

it('rejects exporting stale generated colors after their profile is changed', () => {
  const system=generateSystem(curved());
  system.config.chromaCurves!.semantic.peakChroma=.01;
  expect(()=>exportJson(system)).toThrow(/chroma curve/i);
});

it('retains serialized coordinates between closely spaced exact pins', async () => {
  const { requestedChroma }=await import('./chroma-curves');
  const input=curved();
  input.anchors=[
    {family:'brand',role:'emphasis.base',mode:'both',color:'oklch(0.5 0.1 29)',locked:true},
    {family:'brand',role:'foreground.base',mode:'light',color:'oklch(0.5001 0.2 29)',locked:true},
  ];
  input.surfaces.dark.l=.2; input.muted.distance={light:.055,dark:.30005};
  input.chromaCurves.semantic.peakChroma=.001;
  input.families.find(f=>f.id==='neutral')!.chroma=0;
  const system=balanceConfiguration(input,input).system;
  const role=system.modes.dark.families.brand.roles['muted.base']!;
  expect(role.color.l).toBeCloseTo(.50005,8);
  const foundation=tokenFoundation(system);
  const item=foundation.palette.find(p=>p.primitive.name===role.primitive)!;
  const l=foundation.lightness[item.lightness], c=foundation.chroma[item.chroma], h=foundation.hue[item.hue];
  const expected=toColor({l,c:requestedChroma(system.config,'brand',l),h});
  expect(c).toBeCloseTo(expected.c,8);
  expect(l).toBeCloseTo(role.color.l,9);
});

it('supports horizontal Bézier handle movement without moving the peak or pins', async () => {
  const { requestedChroma }=await import('./chroma-curves');
  const input=curved();
  const before=requestedChroma(input,'info',.15);
  Object.assign(input.chromaCurves.semantic,{darkPosition:.6});
  expect(requestedChroma(input,'info',.15)).not.toBeCloseTo(before,6);
  expect(requestedChroma(input,'info',.5)).toBeCloseTo(.1,9);
  Object.assign(input.chromaCurves.semantic,{darkPosition:.9});
  expect(()=>generateSystem(input)).toThrow(/chroma curve/i);
});

it('samples curves without serializing configuration on each lookup', async () => {
  const {requestedChroma}=await import('./chroma-curves');
  const input=curved();requestedChroma(input,'info',.2);
  const spy=vi.spyOn(JSON,'stringify');
  try{for(let i=0;i<100;i++)requestedChroma(input,'info',i/100);expect(spy).not.toHaveBeenCalled();}
  finally{spy.mockRestore();}
});
it('invalidates sampled values after in-place curve and locked anchor edits', async () => {
  const {requestedChroma}=await import('./chroma-curves');const input=curved();
  const before=requestedChroma(input,'info',.2);
  input.chromaCurves.semantic.darkBend=.9;
  expect(requestedChroma(input,'info',.2)).not.toBe(before);
  input.anchors=[{family:'brand',role:'emphasis.base',mode:'both',color:'oklch(.5 .1 29)',locked:true}];
  expect(requestedChroma(input,'brand',.5)).toBe(.1);
  input.anchors[0].color='oklch(.5 .2 29)';
  expect(requestedChroma(input,'brand',.5)).toBe(.2);
  input.anchors[0].locked=false;
  expect(requestedChroma(input,'brand',.5)).toBe(.1);
});
