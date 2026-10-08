import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Session } from 'node:inspector';
import { it } from 'vitest';
import { configFromReference, parseKdsTokens } from './reference';
import { generateSystem } from './generate';
import { balanceConfiguration } from './balance';
// Opt-in profiling keeps timing and filesystem output out of ordinary tests.
it.skipIf(!process.env.COLOR_BENCHMARK)('profiles color calculations', async () => {
 const base=configFromReference(parseKdsTokens(readFileSync(new URL('../reference/kds-tokens.css',import.meta.url),'utf8')));
 const cases = [
  ['defaults', base],
  ['neutral-hue', {...base,families:base.families.map(f=>f.id==='neutral'?{...f,hue:210}:f)}],
  ['brand-hue', {...base,families:base.families.map(f=>f.id==='brand'?{...f,hue:240}:f)}],
  ['muted', {...base,muted:{...base.muted,distance:{light:.07,dark:.3}}}],
  ['six-surfaces', {...base,surfaces:{...base.surfaces,levels:6}}],
  ['selected', {...base,emphasis:{...base.emphasis,selected:true}}],
  ['exact-lock', {...base,anchors:[{family:'brand',mode:'light',role:'emphasis.base',color:'#006b75',locked:true}]}],
  ['wide-lock', {...base,anchors:[{family:'brand',mode:'light',role:'emphasis.base',color:'oklch(0.6 0.4 29)',locked:true}]}],
 ] as const;
 const report=[];
 const inspector=new Session(); inspector.connect();
 const post=(method:string)=>new Promise<any>((resolve,reject)=>inspector.post(method,(err,result)=>err?reject(err):resolve(result)));
 await post('Profiler.enable'); await post('Profiler.start');
 for(const [name,input] of cases){
  const config=structuredClone(input) as typeof base;
  const start=performance.now();let system=generateSystem(config);const cold=performance.now()-start;
  const times=[];
  for(let n=0;n<3;n++){const time=performance.now();system=generateSystem(config);times.push(performance.now()-time);}
  report.push({name,cold:Math.round(cold),median:Math.round(times.sort((a,b)=>a-b)[1]),hash:createHash('sha256').update(JSON.stringify(system)).digest('hex')});
 }
 const requested=structuredClone(base);requested.muted.distance={light:.055,dark:.8};
 const start=performance.now();const balanced=balanceConfiguration(base,requested);
 report.push({name:'limited-muted',cold:Math.round(performance.now()-start),hash:createHash('sha256').update(JSON.stringify(balanced)).digest('hex')});
 const profile=await post('Profiler.stop');inspector.disconnect();
 writeFileSync('/tmp/color-calculation-profile.json',JSON.stringify(profile.profile));
 writeFileSync('/tmp/color-calculation-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
});
