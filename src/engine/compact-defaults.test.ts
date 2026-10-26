import { expect, it } from 'vitest';
import reference from 'virtual:kds-reference';
import { defaultConfiguration } from '../ui/defaultConfiguration';
import { balanceConfiguration } from './balance';
import { generateSystem } from './generate';
import { sharedLightnessIssues } from './shared-lightness';
import { toColor } from './color';
import { cssTokenModel } from './tokens';

it('uses global Neutral chroma for all unlocked state roles by default',()=>{
 const c=defaultConfiguration(reference);const result=balanceConfiguration(c,c).system;
 const neutral=c.families.find(f=>f.id==='neutral')!;
 for(const mode of ['light','dark'] as const)for(const role of Object.values(result.modes[mode].families.neutral.roles)){
  if(!role||role.color.source)continue;
  expect(role.color.c,role.semantic).toBe(toColor({l:role.color.l,c:neutral.chroma,h:neutral.hue}).c);
 }
 expect(result.checks.every(c=>c.pass)).toBe(true);
 expect(sharedLightnessIssues(result)).toEqual([]);
 const tokens=cssTokenModel(result).semantics;
 expect(tokens.find(t=>t.name==='--kds-bg-neutral-emphasis-hover')!.value).not.toContain('color-mix');
});
it('generates a compact palette deterministically without changing the input or locks',()=>{
 const c=defaultConfiguration(reference);const before=structuredClone(c);
 const result=balanceConfiguration(c,c).system;
 expect(result.primitives.filter(p=>p.family==='gray').length).toBeLessThan(24);
 expect(result.primitives.length).toBeLessThan(109);
 expect(c).toEqual(before);
 expect(generateSystem(result.config)).toEqual(result);
 c.anchors[0].locked=true;
 const locked=balanceConfiguration(c,c).system;
 expect(locked.modes.light.families.brand.roles['emphasis.base']!.color.css).toBe(c.anchors[0].color);
 expect(sharedLightnessIssues(locked)).toEqual([]);
 expect(locked.checks.every(c=>c.pass)).toBe(true);
});
