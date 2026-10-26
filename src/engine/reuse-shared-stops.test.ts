import { expect, it } from 'vitest';
import reference from 'virtual:kds-reference';
import { defaultConfiguration } from '../ui/defaultConfiguration';
import { generateSystem } from './generate';
import { curveColor } from './chroma-curves';
import { parseLockedColor } from './color';
import { reuseSharedStops } from './reuse-shared-stops';

function fixture(){
 const config=defaultConfiguration(reference),themes=generateSystem(config).modes;
 const target=themes.dark.families.neutral.roles['muted.active']!.color.l;
 for(const family of config.families)themes.light.families[family.id].roles['foreground.hover']!.color=curveColor(config,family,target+.005);
 return {config,themes,target};
}
it('reuses a nearby stop across every family while preserving input and state order',()=>{
 const {config,themes,target}=fixture(),before=structuredClone(themes);
 const result=reuseSharedStops(config,themes,()=>true);
 for(const family of config.families){
  const roles=result.light.families[family.id].roles;
  expect(roles['foreground.hover']!.color.l).toBeCloseTo(target,9);
  expect(roles['foreground.hover']!.color.l).toBeLessThan(roles['foreground.base']!.color.l);
 }
 expect(themes).toEqual(before);
});
it('rejects every stop alignment if the protected contrast validator rejects it',()=>{
 const {config,themes}=fixture();
 expect(reuseSharedStops(config,themes,()=>false)).toEqual(themes);
});
it('pins corresponding roles across all families when one family has an exact source',()=>{
 const {config,themes}=fixture();const role=themes.light.families.brand.roles['foreground.hover']!;
 role.color=parseLockedColor(role.color.css);
 const result=reuseSharedStops(config,themes,()=>true);
 for(const family of config.families)expect(result.light.families[family.id].roles['foreground.hover']!.color).toEqual(themes.light.families[family.id].roles['foreground.hover']!.color);
});
