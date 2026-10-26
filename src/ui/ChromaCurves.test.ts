// @vitest-environment happy-dom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { configFromReference } from '../engine/config';
import { generateSystem } from '../engine/generate';
import { withChromaCurves } from '../engine/chroma-curves';
import type { BuilderConfig } from '../engine/types';
import reference from 'virtual:kds-reference';
import ChromaCurves from './ChromaCurves.svelte';
const mounted: ReturnType<typeof mount>[]=[];
afterEach(async()=>{for(const c of mounted.splice(0))await unmount(c);document.body.replaceChildren();vi.restoreAllMocks();});
function setup(config=withChromaCurves(configFromReference(reference)),checking=false){
  const onChange=vi.fn(async(_next:BuilderConfig)=>true);
  mounted.push(mount(ChromaCurves,{target:document.body,props:{config,system:generateSystem(config),onChange,checking}}));flushSync();
  return {config,onChange};
}
const handle=(group:string,kind:string)=>document.querySelector<HTMLButtonElement>(`[data-group="${group}"] [data-handle="${kind}"]`)!;
const pointer=(type:string,x:number,y:number)=>new PointerEvent(type,{bubbles:true,button:0,pointerId:1,clientX:x,clientY:y});

it('offers direct curve points instead of the unexplained slider stack',()=>{
  setup();expect(document.querySelectorAll('svg[role="img"]')).toHaveLength(2);
  expect(document.querySelectorAll('[data-handle]')).toHaveLength(6);
  expect(document.querySelector('input[type="range"]')).toBeNull();
  expect(document.body.textContent).toContain('Drag the round point');
  expect(document.body.textContent).toContain('gamut');
});
it('updates the palette during dragging without waiting for release',async()=>{
  const {config,onChange}=setup(); const surface=handle('semantic','peak').closest('.curve-surface')!;
  vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:288,height:196,right:288,bottom:196,x:0,y:0,toJSON(){}});
  const before=surface.querySelector('.requested-curve')!.getAttribute('d');
  const target=handle('semantic','peak');
  target.dispatchEvent(pointer('pointerdown',150,75));target.dispatchEvent(pointer('pointermove',202.8,101.25));flushSync();
  expect(surface.querySelector('.requested-curve')!.getAttribute('d')).not.toBe(before);
  expect(onChange).toHaveBeenCalledTimes(1);
  target.dispatchEvent(pointer('pointerup',202.8,101.25));await tick();flushSync();
  expect(onChange).toHaveBeenCalledTimes(1);
  const next=onChange.mock.calls[0][0];
  expect(next.chromaCurves!.semantic.peakLightness).toBeCloseTo(.7,5);
  expect(next.chromaCurves!.semantic.peakChroma).toBeCloseTo(.15,5);
  expect(next.chromaCurves!.brand).toEqual(config.chromaCurves!.brand);
});
it('allows keyboard handle movement but keeps locked Brand points fixed',async()=>{
  const config=withChromaCurves(configFromReference(reference));
  config.anchors=[{family:'brand',mode:'both',role:'emphasis.base',color:'oklch(.6 .18 25)',locked:true}];
  const {onChange}=setup(config);
  expect(handle('brand','peak').disabled).toBe(true);
  handle('brand','dark').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await tick();
  expect(onChange.mock.calls[0][0].chromaCurves!.brand.darkPosition).toBeGreaterThan(1/3);
  expect(onChange.mock.calls[0][0].anchors).toEqual(config.anchors);
});
it('cancels interrupted drags and disables edits during verification',()=>{
  const {onChange}=setup();
  handle('semantic','peak').dispatchEvent(pointer('pointerdown',100,100));
  handle('semantic','peak').dispatchEvent(pointer('pointercancel',120,80));flushSync();
  expect(onChange).not.toHaveBeenCalled();
});
it('shows the gamut warning when requested chroma cannot render',()=>{
  const config=withChromaCurves(configFromReference(reference));config.chromaCurves!.semantic.peakChroma=.4;
  setup(config,true);expect(handle('semantic','peak').getAttribute('aria-disabled')).toBe('true');
  expect(handle('semantic','peak').disabled).toBe(false);
  expect(document.querySelector('[data-group="semantic"] .gamut-warning')?.textContent).toContain('sRGB');
});

it('does not submit a new curve when a point is clicked without dragging',()=>{
  const {onChange}=setup();const point=handle('semantic','peak');
  point.dispatchEvent(pointer('pointerdown',100,100));point.dispatchEvent(pointer('pointerup',100,100));flushSync();
  expect(onChange).not.toHaveBeenCalled();
});

it('keeps keyboard focus during verification and exposes each handle position',async()=>{
  const {onChange}=setup();let resolve!: (accepted:boolean)=>void;
  onChange.mockImplementationOnce(()=>new Promise<boolean>(done=>{resolve=done;}));
  const target=handle('semantic','dark');target.focus();
  const description=target.getAttribute('aria-describedby')!.split(' ').map(id=>document.getElementById(id)?.textContent).join(' ');
  expect(description).toContain('color intensity');
  target.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await tick();flushSync();
  expect(document.activeElement).toBe(target);
  expect(target.disabled).toBe(false);
  expect(target.getAttribute('aria-disabled')).toBe('true');
  resolve(true);await tick();await tick();flushSync();
  expect(document.querySelector('.curve-status')?.textContent).toContain('intensity');
});

it('keeps the graph scale fixed while dragging a high-chroma imported profile',()=>{
  const config=withChromaCurves(configFromReference(reference));config.chromaCurves!.semantic.peakChroma=.8;
  setup(config);const point=handle('semantic','peak');const surface=point.closest('.curve-surface')!;
  vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:288,height:196,right:288,bottom:196,x:0,y:0,toJSON(){}});
  point.dispatchEvent(pointer('pointerdown',166,20));point.dispatchEvent(pointer('pointermove',166,46));flushSync();
  expect(parseFloat(point.style.top)).toBeCloseTo(46/196*100,4);
  point.dispatchEvent(pointer('pointercancel',166,46));
});

it('keeps the latest drag position queued while a live check is running',async()=>{
  const {onChange}=setup();let resolve!:(accepted:boolean)=>void;
  onChange.mockImplementationOnce(()=>new Promise<boolean>(done=>{resolve=done;}));
  const target=handle('semantic','peak');const surface=target.closest('.curve-surface')!;
  vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:288,height:196,right:288,bottom:196,x:0,y:0,toJSON(){}});
  target.dispatchEvent(pointer('pointerdown',150,75));
  target.dispatchEvent(pointer('pointermove',154,90));flushSync();
  expect(onChange).toHaveBeenCalledTimes(1);
  target.dispatchEvent(pointer('pointermove',178.4,95));
  target.dispatchEvent(pointer('pointermove',202.8,101.25));flushSync();
  expect(onChange).toHaveBeenCalledTimes(1);
  resolve(true);await tick();await tick();await tick();flushSync();
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(onChange.mock.calls[1][0].chromaCurves!.semantic.peakLightness).toBeCloseTo(.7,5);
  target.dispatchEvent(pointer('pointerup',202.8,101.25));await tick();flushSync();
  expect(onChange).toHaveBeenCalledTimes(2);
});
