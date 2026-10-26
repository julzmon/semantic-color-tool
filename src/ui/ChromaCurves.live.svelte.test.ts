// @vitest-environment happy-dom
import { flushSync, mount, tick, unmount } from 'svelte';
import { expect, it, vi } from 'vitest';
import reference from 'virtual:kds-reference';
import { configFromReference } from '../engine/config';
import { generateSystem } from '../engine/generate';
import { withChromaCurves } from '../engine/chroma-curves';
import type { BuilderConfig } from '../engine/types';
import ChromaCurves from './ChromaCurves.svelte';

it('continues dragging through parent config changes and restores the starting curve on Escape',async()=>{
  const initial=withChromaCurves(configFromReference(reference));
  let config=$state.raw(initial);
  let checking=$state(false);
  let resolve!:(accepted:boolean)=>void;
  const onChange=vi.fn((next:BuilderConfig)=>{
    config=next;checking=true;
    return new Promise<boolean>(done=>{resolve=(accepted)=>{checking=false;done(accepted);};});
  });
  const component=mount(ChromaCurves,{target:document.body,props:{get config(){return config;},system:generateSystem(initial),get checking(){return checking;},onChange}});
  try{
    flushSync();
    const point=document.querySelector<HTMLButtonElement>('[data-group="semantic"] [data-handle="peak"]')!;
    const surface=point.closest('.curve-surface')!;
    vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:288,height:196,right:288,bottom:196,x:0,y:0,toJSON(){}});
    const pointer=(type:string,x:number,y:number)=>new PointerEvent(type,{bubbles:true,button:0,pointerId:1,clientX:x,clientY:y});
    point.dispatchEvent(pointer('pointerdown',150,75));
    point.dispatchEvent(pointer('pointermove',178.4,95));flushSync();
    expect(onChange).toHaveBeenCalledTimes(1);
    point.dispatchEvent(pointer('pointermove',202.8,101.25));flushSync();
    expect(parseFloat(point.style.left)).toBeCloseTo(202.8/288*100,4);
    resolve(true);await tick();await tick();await tick();flushSync();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(config.chromaCurves!.semantic.peakLightness).toBeCloseTo(.7,5);
    point.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));flushSync();
    resolve(true);await tick();await tick();await tick();flushSync();
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(config.chromaCurves).toEqual(initial.chromaCurves);
    resolve(true);await tick();await tick();
  }finally{await unmount(component);document.body.replaceChildren();vi.restoreAllMocks();}
});
