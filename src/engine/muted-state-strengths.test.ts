import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import { generateSystem } from './generate';
import { balanceConfiguration } from './balance';
import { mixEmphasis } from './emphasis';
import { exportJson } from './export';
import { parseConfigurationJson } from '../ui/configuration';
const defaults = () => configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css', import.meta.url),'utf8')));
it('generates independently controlled muted states in each theme direction', () => {
  const config = defaults(); config.emphasis.selected = true;
  Object.assign(config.muted,{mixWeights:{hover:.98,active:.95,selected:.92}});
  const before = structuredClone(config);
  const system = generateSystem(config);
  for (const mode of ['light','dark'] as const) for (const family of config.families) {
    const roles = system.modes[mode].families[family.id].roles;
    const base = roles['muted.base']!.color;
    for (const [state,weight] of Object.entries({hover:.98,active:.95,selected:.92})) {
      expect(roles[`muted.${state}` as 'muted.hover']!.color).toEqual(mixEmphasis(base,weight,mode==='light'?'black':'white'));
    }
  }
  expect(config).toEqual(before);
});
it('validates muted strength ordering and finite weights', () => {
  for(const mixWeights of [{hover:.8,active:.9,selected:.7},{hover:NaN,active:.9,selected:.8},{hover:1.1,active:.9,selected:.8}]) {
    const config=defaults(); Object.assign(config.muted,{mixWeights});
    expect(()=>generateSystem(config)).toThrow(/muted.*weight/i);
  }
});
it('retains independent weights through configuration export/import and acceptance', () => {
  const previous=defaults(); Object.assign(previous.muted,{mixWeights:{hover:.98,active:.95,selected:.92}});
  const result=balanceConfiguration(previous,previous);
  const parsed=parseConfigurationJson(exportJson(result.system),defaults());
  expect(parsed.muted).toEqual(result.config.muted);
  expect(result.system.checks.every(check=>check.pass)).toBe(true);
});
it('migrates old spacing when accepting a legacy configuration into the new app model', () => {
  const previous=defaults(); Object.assign(previous.muted,{mixWeights:{hover:.95,active:.9,selected:.85}});
  const legacy=defaults(); legacy.muted.separation=.02;
  const result=balanceConfiguration(previous,legacy);
  expect((result.config.muted as any).mixWeights).toBeDefined();
  expect(result.system.checks.every(check=>check.pass)).toBe(true);
});
it('changes a pressed muted recipe without moving its base, hover, or emphasis strengths', () => {
  const config=defaults(); config.muted.mixWeights={hover:.98,active:.95,selected:.92}; config.emphasis.selected=true;
  const previous=balanceConfiguration(config,config);
  const requested=structuredClone(previous.config); requested.muted.mixWeights!.active=.94;
  const accepted=balanceConfiguration(previous.config,requested);
  expect(accepted.config.muted.mixWeights!.hover).toBe(previous.config.muted.mixWeights!.hover);
  expect(accepted.config.muted.mixWeights!.selected).toBe(previous.config.muted.mixWeights!.selected);
  expect(accepted.config.emphasis.mixWeights).toEqual(previous.config.emphasis.mixWeights);
  for(const mode of ['light','dark'] as const) for(const family of config.families) {
    const before=previous.system.modes[mode].families[family.id].roles;
    const after=accepted.system.modes[mode].families[family.id].roles;
    expect(after['muted.base']!.color).toEqual(before['muted.base']!.color);
    expect(after['muted.hover']!.color).toEqual(before['muted.hover']!.color);
    expect(after['muted.active']!.color).not.toEqual(before['muted.active']!.color);
  }
  expect(accepted.system.checks.every(check=>check.pass)).toBe(true);
});
it('caps both state groups while preserving exact brand anchors and contrast targets', () => {
  const config=defaults(); config.emphasis.selected=true;
  config.muted.mixWeights={hover:.2,active:.1,selected:0};
  config.emphasis.mixWeights={hover:.2,active:.1,selected:0};
  config.anchors=[{family:'brand',mode:'both',role:'emphasis.base',color:'oklch(0.45 0.12 29)',locked:true}];
  const accepted=balanceConfiguration(defaults(),config);
  expect(accepted.config.anchors).toEqual(config.anchors); expect(accepted.config.targets).toEqual(config.targets);
  for(const mode of ['light','dark'] as const) for(const family of config.families) for(const group of ['muted','emphasis'] as const) {
    const roles=accepted.system.modes[mode].families[family.id].roles;
    const base=roles[`${group}.base`]!.color;
    for(const state of ['hover','active','selected'] as const) {
      const color=roles[`${group}.${state}`]!.color;
      expect(Math.abs(color.l-base.l)).toBeLessThanOrEqual(.12+1e-9);
      expect(1-accepted.config[group].mixWeights![state]).toBeLessThanOrEqual(.25+1e-9);
    }
  }
  expect(accepted.system.checks.every(check=>check.pass)).toBe(true);
},15000);
it('preserves state chroma when strengthening borders derived from mixed muted states', () => {
  const config=defaults(); config.muted.mixWeights={hover:.98,active:.95,selected:.92};
  const before=generateSystem(config);
  const requested=structuredClone(config); requested.muted.borderStrength={light:.01,dark:.01};
  const after=generateSystem(requested);
  for(const mode of ['light','dark'] as const) for(const family of config.families) for(const state of ['base','hover'] as const) {
    const old=before.modes[mode].families[family.id].roles[`border.muted.${state}`]!.color;
    const next=after.modes[mode].families[family.id].roles[`border.muted.${state}`]!.color;
    expect(next.c).toBeLessThanOrEqual(old.c+1e-9);
    if(family.id==='neutral') expect(next.c).toBeCloseTo(old.c,9);
  }
});
