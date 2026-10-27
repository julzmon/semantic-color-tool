<script lang="ts">
  import type { GeneratedRole, Mode } from '../engine/types';
  let { surface, nextSurface, mode, index, showStates=false }: {
    surface:GeneratedRole;nextSurface?:GeneratedRole;mode:Mode;index:number;showStates?:boolean;
  }=$props();
  let name=$state('Design foundations');
  let checked=$state(false);
  const states=[{id:'hover',label:'Hover'},{id:'active',label:'Pressed'},{id:'checked',label:'Checked'},{id:'focus',label:'Focus'}] as const;
  const inputId=$derived(index===0?`project-${mode}`:`project-${mode}-${index}`);
</script>

<div class="surface-examples" style={`--example-surface:var(${surface.semantic})`}>
  <div class="example-cards">
    {#each [{surface,label:'Same surface',kind:'same-surface-card'},...(nextSurface?[{surface:nextSurface,label:'Next level',kind:'next-surface-card'}]:[])] as card}
      <div class="example-card-sample" data-example={card.kind}>
        <span class="example-caption">{card.label}</span>
        <article class="example-card" style:background={`var(${card.surface.semantic})`}>
          <h4>Design foundations</h4>
          <p>Colors and components for the team.</p>
        </article>
      </div>
    {/each}
  </div>
  <div class="example-field">
    <label for={inputId}>Project name</label>
    <input class="example-input" id={inputId} type="text" bind:value={name} placeholder="Enter a project name" aria-describedby={`${inputId}-help`} />
    <p id={`${inputId}-help`}>Visible to everyone on your team.</p>
  </div>
  {#if showStates}
    <div class="example-state-grid" aria-label="Input state comparison">
      {#each states.filter(s=>s.id!=='checked') as state}
        <div><span class="example-caption">{state.label}</span><div class="example-input" data-example-state={state.id} role="img" aria-label={`Project name input, ${state.label.toLowerCase()} example`}>Design foundations</div></div>
      {/each}
    </div>
  {/if}
  <div class="example-list">
    <span class="example-caption">Selectable row</span>
    <label class="example-selectable-row" data-checked={checked}>
      <span class="example-checkbox-wrap">
        <input class="example-checkbox" type="checkbox" bind:checked aria-label={`Include color guidelines, ${mode} ${index===0?'base':`level ${index}`}`} />
        <svg class="example-checkmark" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>
      </span>
      <span>Include color guidelines</span>
    </label>
  </div>
  {#if showStates}
    <div class="example-state-grid" aria-label="Selectable row state comparison">
      {#each states as state}
        <div><span class="example-caption">{state.label}</span>
          <div class="example-selectable-row" data-example-state={state.id} data-checked={state.id==='checked'} role="img" aria-label={`Selectable row, ${state.label.toLowerCase()} example`}>
            <span class="example-checkbox-wrap"><span class="example-checkbox" data-checked={state.id==='checked'}></span>
              {#if state.id==='checked'}<svg class="example-checkmark static-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>{/if}
            </span><span>Include color guidelines</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .surface-examples {display:grid;gap:16px;margin-block:14px 20px;min-inline-size:0;color:var(--kds-fg-base);}
  .example-cards,.example-state-grid {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:10px;min-inline-size:0;}
  .example-caption {display:block;margin-block-end:6px;font-size:11px;line-height:1.5;color:var(--kds-fg-muted);}
  .example-card {border:1px solid var(--kds-border-neutral-muted-base);border-radius:8px;padding:14px;min-inline-size:0;}
  .example-card h4 {margin:0;font-size:13px;line-height:1.5;color:var(--kds-fg-base);font-weight:600;}
  .example-card p,.example-field p {margin:4px 0 0;font-size:12px;line-height:1.5;color:var(--kds-fg-muted);}
  .example-field label {display:block;margin-block-end:6px;font-size:12px;font-weight:550;line-height:1.5;}
  .example-input {display:block;box-sizing:border-box;inline-size:100%;min-inline-size:0;min-block-size:40px;padding:9px 10px;border:1px solid var(--kds-border-neutral-emphasis-base);border-radius:5px;background:var(--example-surface);color:var(--kds-fg-base);font:inherit;font-size:12px;line-height:1.5;overflow-wrap:anywhere;caret-color:var(--kds-fg-base);}
  .example-input::placeholder {color:var(--kds-fg-muted);opacity:1;}
  input.example-input:hover,.example-input[data-example-state="hover"] {border-color:var(--kds-border-neutral-emphasis-hover);}
  input.example-input:active,.example-input[data-example-state="active"] {border-color:var(--kds-border-brand-emphasis-base);}
  .example-input:focus-visible,.example-input[data-example-state="focus"],.example-selectable-row:has(input:focus-visible),.example-selectable-row[data-example-state="focus"] {outline:2px solid var(--kds-border-brand-emphasis-base);outline-offset:2px;}
  .example-selectable-row {display:flex;align-items:center;gap:10px;min-inline-size:0;min-block-size:44px;box-sizing:border-box;padding:10px;border-radius:5px;color:var(--kds-fg-base);font-size:12px;line-height:1.5;overflow-wrap:anywhere;cursor:pointer;}
  .example-selectable-row[data-checked="true"] {background:var(--kds-bg-neutral-muted-selected,var(--kds-bg-neutral-muted-base));}
  label.example-selectable-row:hover,.example-selectable-row[data-example-state="hover"] {background:var(--kds-bg-neutral-muted-hover);}
  label.example-selectable-row:active,.example-selectable-row[data-example-state="active"] {background:var(--kds-bg-neutral-muted-active);}
  .example-selectable-row[role="img"] {cursor:default;}
  .example-selectable-row[role="img"]:not([data-example-state="hover"]):not([data-example-state="active"]):not([data-checked="true"]) {background:var(--example-surface);}
  .example-checkbox-wrap {position:relative;display:block;flex:0 0 18px;inline-size:18px;block-size:18px;}
  .example-checkbox {appearance:none;position:absolute;inset:0;box-sizing:border-box;inline-size:18px;block-size:18px;min-block-size:0;margin:0;padding:0;border:1px solid var(--kds-border-neutral-emphasis-base);border-radius:3px;background:var(--example-surface);cursor:inherit;}
  .example-checkbox:checked,.example-checkbox[data-checked="true"] {border-color:var(--kds-border-brand-emphasis-base);background:var(--kds-bg-brand-emphasis-base);}
  .example-checkbox:focus-visible {outline:none;}
  .example-checkmark {position:absolute;inset:1px;inline-size:16px;block-size:16px;pointer-events:none;fill:none;stroke:var(--kds-fg-on-emphasis);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:0;}
  .example-checkbox:checked + .example-checkmark,.static-check {opacity:1;}
</style>
