<script lang="ts">
  import { tick } from 'svelte';
  import { familyControlColor } from './controlTracks';
  import { curveColor, curvePins, effectiveCurve, requestedChroma, withChromaCurves } from '../engine/chroma-curves';
  import type { BuilderConfig, FamilyConfig, GeneratedSystem } from '../engine/types';
  let { config, onChange, checking=false }: {
    config:BuilderConfig; system:GeneratedSystem; onChange:(config:BuilderConfig)=>Promise<boolean|undefined>; checking?:boolean;
  }=$props();
  type Group='brand'|'semantic';
  type Handle='peak'|'dark'|'light';
  const id=$props.id();
  const groups=[{id:'brand',label:'Brand'},{id:'semantic',label:'Semantic colors'}] as const;
  const samples=Array.from({length:101},(_,i)=>i/100);
  let draft=$state.raw<BuilderConfig|null>(null);
  let submitting=$state(false);
  let feedback=$state('');
  let drag=$state.raw<{group:Group;handle:Handle;pointer:number;surface:Element;start:BuilderConfig;accepted:BuilderConfig;scale:number;moved:boolean}|null>(null);
  let submission=0;
  const view=$derived(draft??config);
  const busy=$derived(checking||submitting);
  const pins=$derived(curvePins(view));
  const families=(group:Group)=>view.families.filter(f=>group==='brand'?f.id==='brand':f.id!=='brand'&&f.id!=='neutral');
  const ceiling=(group:Group)=>drag?.group===group?drag.scale:Math.max(.4,effectiveCurve(view,group).peakChroma,...(group==='brand'?pins.map(p=>p.c):[]));
  const x=(l:number)=>32+l*244;
  const y=(c:number,max:number)=>150-c/max*130;
  function path(group:Group,family?:FamilyConfig){
    const representative=family??families(group)[0];
    return samples.map((l,i)=>`${i?'L':'M'}${x(l).toFixed(2)},${y(family?curveColor(view,family,l).c:requestedChroma(view,representative.id,l),ceiling(group)).toFixed(2)}`).join(' ');
  }
  function geometry(group:Group,state=view){
    const curve=effectiveCurve(state,group);
    const interior=group==='brand'?curvePins(state).filter(p=>p.l>0&&p.l<1):[];
    const first=interior[0]??{l:curve.peakLightness,c:curve.peakChroma};
    const last=interior.at(-1)??first;
    return {curve,first,last,
      peak:{l:curve.peakLightness,c:curve.peakChroma},
      dark:{l:first.l*(curve.darkPosition??1/3),c:first.c*curve.darkBend},
      light:{l:last.l+(1-last.l)*(curve.lightPosition??2/3),c:last.c*curve.lightBend},
      locked:group==='brand'&&interior.length>0};
  }
  function clippedFamilies(group:Group){
    return families(group).filter(f=>samples.some(l=>requestedChroma(view,f.id,l)-curveColor(view,f,l).c>.003)).map(f=>f.label);
  }
  const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
  function edit(base:BuilderConfig,group:Group,handle:Handle,l:number,c:number){
    const next=structuredClone(withChromaCurves(base));
    const curve=next.chromaCurves![group];
    const {first,last,locked}=geometry(group);
    if(handle==='peak'){
      if(locked)return next;
      curve.peakLightness=Number(clamp(l,.01,.99).toFixed(6));curve.peakChroma=Number(clamp(c,0,drag?.scale??ceiling(group)).toFixed(6));
    }else if(handle==='dark'){
      curve.darkPosition=clamp(l/first.l,0,2/3);curve.darkBend=first.c>0?clamp(c/first.c,0,1):0;
    }else{
      curve.lightPosition=clamp((l-last.l)/(1-last.l),1/3,1);curve.lightBend=last.c>0?clamp(c/last.c,0,1):0;
    }
    return next;
  }
  async function apply(next:BuilderConfig,announcement='Curve applied.'){
    const revision=++submission;submitting=true;draft=next;feedback='Checking both themes…';
    try{const accepted=await onChange(next);if(revision===submission)feedback=accepted===false?'Change could not pass. Previous curve restored.':accepted===undefined?'Curve edit superseded by another change.':`${announcement} Both themes checked.`;}
    catch{if(revision===submission)feedback='Unable to apply this curve. Previous curve restored.';}
    finally{await tick();if(revision===submission){draft=null;submitting=false;}}
  }
  function start(event:PointerEvent,group:Group,handle:Handle){
    if(busy||event.button!==0||drag)return;
    if(handle==='peak'&&geometry(group).locked)return;
    const button=event.currentTarget as HTMLButtonElement;
    event.preventDefault();button.focus();
    drag={group,handle,pointer:event.pointerId,surface:button.closest('.curve-surface')!,start:structuredClone(config),accepted:config,scale:ceiling(group),moved:false};
    draft=structuredClone(config);feedback='Release to apply. Escape cancels.';
    button.setPointerCapture?.(event.pointerId);
  }
  function move(event:PointerEvent){
    if(!drag||event.pointerId!==drag.pointer)return;
    const rect=drag.surface.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const l=((event.clientX-rect.left)/rect.width*288-32)/244;
    const c=(150-(event.clientY-rect.top)/rect.height*196)/130*drag.scale;
    drag.moved=true;
    draft=edit(drag.start,drag.group,drag.handle,l,c);
  }
  function finish(event:PointerEvent){
    if(!drag||drag.pointer!==event.pointerId)return;
    if(!drag.moved){drag=null;draft=null;feedback='Curve unchanged.';return;}
    move(event);const next=draft;const previous=drag.start;drag=null;
    if(next&&JSON.stringify(next)!==JSON.stringify(previous))void apply(next);
    else {draft=null;feedback='Curve unchanged.';}
  }
  $effect(()=>{const accepted=config;const pending=checking;if(drag&&(drag.accepted!==accepted||pending))cancel();});
  function cancel(){if(drag){drag=null;draft=null;feedback='Curve edit cancelled.';}}
  function keydown(event:KeyboardEvent,group:Group,handle:Handle){
    if(event.key==='Escape'){event.preventDefault();cancel();return;}
    if(busy||drag||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const point=geometry(group)[handle];const step=event.shiftKey?5:1;
    const l=point.l+(event.key==='ArrowRight'?.01*step:event.key==='ArrowLeft'?-.01*step:0);
    const c=point.c+(event.key==='ArrowUp'?.005*step:event.key==='ArrowDown'?-.005*step:0);
    const next=edit(config,group,handle,l,c);
    const position=geometry(group,next)[handle];
    void apply(next,`${group==='brand'?'Brand':'Semantic colors'} ${handle==='peak'?'strongest color':handle+' handle'}: ${Math.round(position.l*100)}% from dark to light, intensity ${position.c.toFixed(3)}.`);
  }
</script>

<section class="control-section sidebar-section chroma-shaping" aria-labelledby={`${id}-heading`} aria-busy={busy}>
  <header class="section-heading"><h3 id={`${id}-heading`}>Chroma shaping</h3></header>
  <p class="help">Drag the round point: up adds color, down softens it; left or right moves the most colorful range. Drag the square handles to bend the dark and light ends.</p>
  {#each groups as group (group.id)}
    {@const graph=geometry(group.id)}
    {@const max=ceiling(group.id)}
    {@const limited=clippedFamilies(group.id)}
    <div class="sidebar-group curve-group" data-group={group.id}>
      <h4>{group.label}</h4>
      <p class="help group-description">{group.id==='brand'?'Only Brand colors.':'Info, Positive, Negative, and Warning together.'} Applies to both themes.</p>
      <div class="curve-surface">
        <svg class="curve-chart" viewBox="0 0 288 196" role="img" aria-labelledby={`${id}-${group.id}-title`}>
          <title id={`${id}-${group.id}-title`}>{group.label}: color intensity by lightness</title>
          {#each [0,.5,1] as fraction}
            <line class="grid-line" x1="32" x2="276" y1={y(fraction*max,max)} y2={y(fraction*max,max)}/>
            <text class="tick-label" x="26" y={y(fraction*max,max)+3} text-anchor="end">{Number((fraction*max).toFixed(3))}</text>
          {/each}
          <path class="axis" d="M32 20V150H276"/>
          <path class="handle-guide" d={`M32 150L${x(graph.dark.l)} ${y(graph.dark.c,max)} M${x(graph.light.l)} ${y(graph.light.c,max)}L276 150`}/>
          <path class="requested-curve" d={path(group.id)}/>
          {#each families(group.id) as family (family.id)}<path class="gamut-curve" stroke={familyControlColor(family)} d={path(group.id,family)}/>{/each}
          {#if group.id==='brand'}{#each pins as pin}<circle class="pin" cx={x(pin.l)} cy={y(pin.c,max)} r="4"><title>Locked color</title></circle>{/each}{/if}
          <text class="axis-label" x="32" y="174">Dark colors</text><text class="axis-label" x="276" y="174" text-anchor="end">Light colors</text>
          <text class="axis-label" x="32" y="12">More color ↑</text>
        </svg>
        {#each ['dark','light','peak'] as handle}
          {@const kind=handle as Handle}
          {@const point=graph[kind]}
          <button type="button" class="curve-handle" class:peak={kind==='peak'} class:locked={kind==='peak'&&graph.locked}
            data-handle={kind} style:left={`${x(point.l)/288*100}%`} style:top={`${y(point.c,max)/196*100}%`}
            disabled={kind==='peak'&&graph.locked} aria-disabled={busy||(kind==='peak'&&graph.locked)}
            aria-label={`${group.label} ${kind==='peak'?(graph.locked?'locked color':'strongest color'):kind==='dark'?'dark curve handle':'light curve handle'}`}
            aria-describedby={`${id}-instructions ${id}-${group.id}-${kind}-position`} title={kind==='peak'&&graph.locked?'Exact Brand lock: edit or unlock in Setup.':'Drag to reshape, or use arrow keys. Shift moves faster.'}
            onpointerdown={event=>start(event,group.id,kind)} onpointermove={move} onpointerup={finish} onpointercancel={cancel} onlostpointercapture={cancel}
            onkeydown={event=>keydown(event,group.id,kind)}><span aria-hidden="true">{#if kind==='peak'&&graph.locked}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 6 0v2M4 7h8v6H4z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>{/if}</span></button>
          <span class="handle-readout" id={`${id}-${group.id}-${kind}-position`}>{kind==='peak'?'Strongest color':kind==='dark'?'Dark handle':'Light handle'}: {Math.round(point.l*100)}% from dark to light; color intensity {point.c.toFixed(3)}.</span>
        {/each}
      </div>
      <div class="curve-legend"><span><i class="requested-key"></i>Requested</span>{#each families(group.id) as family (family.id)}<span><i style={`--curve-color:${familyControlColor(family)}`}></i>{family.label}</span>{/each}</div>
      {#if graph.locked}<p class="help">Brand’s round point is locked. Move its square handles to shape other colors; edit or unlock the exact color in Setup to move the point.</p>{/if}
      {#if limited.length}<p class="help gamut-warning">sRGB limits {limited.join(', ')} below the dotted curve. Raising it further there may not change the colors. Pull it closer to the solid lines to see the effect.</p>{/if}
      <p class="help curve-readout">Maximum requested intensity: {graph.curve.peakChroma.toFixed(3)}, located {Math.round(graph.curve.peakLightness*100)}% from dark to light.</p>
    </div>
  {/each}
  <p id={`${id}-instructions`} class="help">Dotted = requested color; solid = what each hue can display within its gamut. Changes preview while dragging and apply on release. Arrow keys also move points; Shift moves faster. Shared lightness and contrast stay protected.</p>
  <p class="help curve-status" role="status">{feedback|| (checking?'Checking both themes…':'')}</p>
</section>

<style>
  .curve-group {min-inline-size:0;}
  .curve-group + .curve-group {margin-block-start:24px;}
  .group-description {margin-block:4px 8px;}
  .curve-surface {position:relative;inline-size:100%;margin-block:12px 8px;}
  .curve-chart {display:block;inline-size:100%;block-size:auto;overflow:visible;}
  .grid-line {stroke:#ddd;stroke-width:.75;}
  .axis {fill:none;stroke:#444;stroke-width:1;}
  .handle-guide {fill:none;stroke:#888;stroke-width:1;stroke-dasharray:2 2;}
  .requested-curve {fill:none;stroke:#111;stroke-width:1.5;stroke-dasharray:4 3;}
  .gamut-curve {fill:none;stroke-width:2;}
  .pin {fill:#111;stroke:#fff;stroke-width:1;}
  .tick-label,.axis-label {fill:#444;font-family:inherit;font-size:10px;font-variant-numeric:tabular-nums;}
  .curve-handle {position:absolute;transform:translate(-50%,-50%);display:grid;place-items:center;inline-size:28px;block-size:28px;min-block-size:28px;padding:0;border:0;background:transparent;cursor:grab;touch-action:none;}
  .curve-handle span {display:block;inline-size:11px;block-size:11px;background:#fff;border:2px solid #111;box-sizing:border-box;}
  .curve-handle.peak span {display:grid;place-items:center;inline-size:16px;block-size:16px;border-radius:50%;background:#111;color:#fff;font-size:10px;line-height:9px;}
  .curve-handle span svg {inline-size:10px;block-size:10px;}
  .curve-handle:active {cursor:grabbing;}
  .curve-handle:focus-visible {outline:2px solid var(--focus-ring,#006d8f);outline-offset:1px;}
  .curve-handle.locked {cursor:not-allowed;opacity:1;}
  .curve-handle[aria-disabled="true"]:not(.locked) {opacity:.5;cursor:wait;}
  .curve-legend {display:flex;flex-wrap:wrap;gap:6px 12px;margin-block:4px 12px;font-size:11px;color:#444;}
  .curve-legend span {display:inline-flex;align-items:center;gap:5px;}
  .curve-legend i {inline-size:13px;border-block-start:2px solid var(--curve-color,#111);}
  .curve-legend .requested-key {border-block-start-style:dashed;}
  .gamut-warning {padding-block:8px;border-block-start:1px solid #ddd;}
  .curve-readout {font-variant-numeric:tabular-nums;}
  .handle-readout {position:absolute;inline-size:1px;block-size:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;}
  .curve-status:empty {display:none;}
</style>
