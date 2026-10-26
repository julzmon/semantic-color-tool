import { curveColor } from './chroma-curves';
import { colorIdentity } from './color';
import type { BuilderConfig, FamilyRole, GeneratedRole, Mode, ModeTheme } from './types';

type Themes = Record<Mode, ModeTheme>;
const modes = ['light','dark'] as const;
const paths: FamilyRole[] = ['foreground.base','foreground.hover','border.emphasis.base','border.emphasis.hover'];
const roles = (themes: Themes): GeneratedRole[] => modes.flatMap(mode => [
  ...themes[mode].surfaces, ...Object.values(themes[mode].foreground),
  ...Object.values(themes[mode].families).flatMap(f=>Object.values(f.roles).filter((r):r is GeneratedRole=>!!r)),
]);
const size = (themes: Themes) => {
  const all=roles(themes);
  return { stops: new Set(all.map(r=>r.color.l.toFixed(10))).size,
    colors: new Set(all.map(r=>colorIdentity(r.color))).size };
};

/** Reuse nearby text/boundary positions atomically across all families.
 * Fill recipes, surfaces and exact sources stay fixed. Legacy solving is unchanged. */
export function reuseSharedStops(config: BuilderConfig, input: Themes, valid: (themes: Themes)=>boolean): Themes {
  if (!config.chromaCurves) return input;
  const themes=structuredClone(input);
  let best=size(themes);
  const ordered = () => modes.every(mode=>config.families.every(f=>
    ['foreground','border.emphasis'].every(group=>{
      const before=input[mode].families[f.id].roles;
      const after=themes[mode].families[f.id].roles;
      const base=`${group}.base` as FamilyRole, hover=`${group}.hover` as FamilyRole;
      const delta=before[hover]!.color.l-before[base]!.color.l;
      const next=after[hover]!.color.l-after[base]!.color.l;
      return Math.abs(delta)<=1e-10 ? Math.abs(next)<=1e-10 : delta*next>0;
    })));
  for(const mode of modes)for(const path of paths){
    const entries=config.families.map(f=>({family:f,role:themes[mode].families[f.id].roles[path]!}));
    if(entries.some(e=>e.role.color.source))continue;
    const original=entries.map(e=>e.role.color);
    const l=original[0].l;
    const targets=[...new Set(roles(themes).map(r=>r.color.l))]
      .filter(target=>Math.abs(target-l)>1e-9&&Math.abs(target-l)<=.01)
      .sort((a,b)=>Math.abs(a-l)-Math.abs(b-l)||a-b).slice(0,8);
    let selected: typeof original | undefined;
    for(const target of targets){
      const colors=entries.map(({family},i)=>curveColor(config,family,target,original[i].h));
      entries.forEach((e,i)=>{e.role.color=colors[i];});
      const next=size(themes);
      if((next.stops<best.stops||(next.stops===best.stops&&next.colors<best.colors))&&ordered()&&valid(themes)){
        best=next;selected=colors;
      }
      entries.forEach((e,i)=>{e.role.color=original[i];});
    }
    if(selected)entries.forEach((e,i)=>{e.role.color=selected![i];});
  }
  return themes;
}
