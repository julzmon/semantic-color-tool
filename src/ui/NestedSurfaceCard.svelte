<script lang="ts">
  import NestedSurfaceCard from './NestedSurfaceCard.svelte';
  import type { GeneratedRole, Mode } from '../engine/types';
  function surfaceLabel(index: number) {
    return index === 0 ? 'Base' : `Level ${index}`;
  }
  let { surfaces, mode = 'light', index = 0, selectedToken = '', onInspect }: {
    surfaces: GeneratedRole[]; mode?: Mode; index?: number; selectedToken?: string; onInspect: (semantic: string) => void;
  } = $props();
  let surface = $derived(surfaces[index]!);
  let name = $state('Design foundations');
  let inputId = $derived(index === 0 ? `project-${mode}` : `project-${mode}-${index}`);
</script>

<article class="surface-nested-card" data-surface={surface.semantic} style:background={`var(${surface.semantic})`}>
  <button class="surface-inspect" class:color-inspection-anchor={selectedToken === surface.semantic} popovertarget="preview-color-info" popovertargetaction="show" data-token={surface.semantic} aria-label={`Inspect ${surfaceLabel(index)} surface`} aria-haspopup="dialog" onclick={() => onInspect(surface.semantic)}>{surfaceLabel(index)} surface</button>
  <div class="preview-field">
    <label for={inputId}>Project name</label>
    <input id={inputId} bind:value={name} />
  </div>
  {#if index + 1 < surfaces.length}<NestedSurfaceCard {surfaces} {mode} index={index + 1} {selectedToken} {onInspect} />{:else}<p>
      Content sits on the deepest generated surface.
    </p>{/if}
</article>
