<script lang="ts">
  import NestedSurfaceCard from './NestedSurfaceCard.svelte';
  import type { GeneratedRole } from '../engine/types';
  function surfaceLabel(index: number) {
    return index === 0 ? 'Base' : `Level ${index}`;
  }
  let { surfaces, index = 0, selectedToken = '', onInspect }: { surfaces: GeneratedRole[]; index?: number; selectedToken?: string; onInspect: (semantic: string) => void } = $props();
  let surface = $derived(surfaces[index]!);
</script>

<article class="surface-nested-card" data-surface={surface.semantic} style:background={`var(${surface.semantic})`}>
  <button class="surface-inspect" class:color-inspection-anchor={selectedToken === surface.semantic} popovertarget="preview-color-info" popovertargetaction="show" data-token={surface.semantic} aria-label={`Inspect ${surfaceLabel(index)} surface`} aria-haspopup="dialog" onclick={() => onInspect(surface.semantic)}>{surfaceLabel(index)} surface</button>
  <strong>{index === 0 ? 'Workspace card' : `Nested card ${index}`}</strong>
  {#if index + 1 < surfaces.length}<NestedSurfaceCard {surfaces} index={index + 1} {selectedToken} {onInspect} />{:else}<p>
      Content sits on the deepest generated surface.
    </p>{/if}
</article>
