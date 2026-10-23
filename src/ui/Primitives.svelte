<script lang="ts">
  import type { GeneratedSystem } from '../engine/types';
  import { inkFor } from './presentation';
  import ColorPopover from './ColorPopover.svelte';
  import ColorInfo from './ColorInfo.svelte';
  import { colorInspection } from './colorInspection';
  let { system }: { system: GeneratedSystem } = $props();
  let selected = $state<string>('');
  let inspection = $derived(selected ? colorInspection(system, { primitive: selected }) : undefined);
  let primitive = $derived(system.primitives.find((item) => item.name === selected));
</script>

<section class="primitive-section">
  <p class="section-description">
    {system.primitives.length} colors used across both themes. Select a color to see where it is used. These are complete color aliases; equal lightness alone does not merge colors. Inspect a preview token for verified sharing opportunities.
  </p>
  {#each system.config.families as family}{@const generated = system.primitives.filter(
      (item) => item.family === family.key,
    )}
    <div class="primitive-family">
      <div class="subsection-title">
        <h3>{family.label} <span class="muted-text">/ {family.key}</span></h3>
        <span class="mini-tag">{generated.length} generated colors</span>
      </div>
      <div class="primitive-grid">
        {#each generated as item}<button
            aria-pressed={selected === item.name} class:color-inspection-anchor={selected === item.name}
            aria-haspopup="dialog" popovertarget="palette-color-details" popovertargetaction="show"
            onclick={() => (selected = item.name)}
            ><span style:background={item.color.css} style:color={inkFor(item.color)}
              >{item.name.replace(`--${system.config.prefix}-key-${family.key}-`, '')}</span
            ><code>{item.color.hex}</code></button
          >{/each}
      </div>
    </div>{/each}
  <ColorPopover id="palette-color-details" title={inspection?.label ?? 'Color information'} anchorName="--palette-color-anchor" onOpenChange={open => { if (!open) selected = ''; }}>
    {#if primitive && inspection}
      <ColorInfo {inspection} />
      <details class="color-inspection-details"><summary>Used in {primitive.usages.length} roles</summary><div class="color-inspection-full">
        <code>{primitive.name}</code><p>Exact source: <code>{primitive.color.css}</code></p>
        <ul class="usage-list">{#each primitive.usages as name}<li><code>{name}</code></li>{/each}</ul>
      </div></details>
    {/if}
  </ColorPopover>
</section>
