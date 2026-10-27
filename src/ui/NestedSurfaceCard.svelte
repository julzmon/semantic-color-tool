<script lang="ts">
  import NestedSurfaceCard from './NestedSurfaceCard.svelte';
  import SurfaceExamples from './SurfaceExamples.svelte';
  import type { GeneratedRole, Mode } from '../engine/types';
  function surfaceLabel(index: number) {
    return index === 0 ? 'Base' : `Level ${index}`;
  }
  let { surfaces, mode = 'light', index = 0, selectedToken = '', showStates=false, onInspect }: {
    surfaces: GeneratedRole[]; mode?: Mode; index?: number; selectedToken?: string; showStates?: boolean; onInspect: (semantic: string) => void;
  } = $props();
  let surface = $derived(surfaces[index]!);
</script>

<article class="surface-nested-card" data-surface={surface.semantic} style:background={`var(${surface.semantic})`}>
  <button class="surface-inspect" class:color-inspection-anchor={selectedToken === surface.semantic} popovertarget="preview-color-info" popovertargetaction="show" data-token={surface.semantic} aria-label={`Inspect ${surfaceLabel(index)} surface`} aria-haspopup="dialog" onclick={() => onInspect(surface.semantic)}>{surfaceLabel(index)} surface</button>
  <SurfaceExamples {surface} nextSurface={surfaces[index+1]} {mode} {index} {showStates} />
  {#if index + 1 < surfaces.length}<NestedSurfaceCard {surfaces} {mode} index={index + 1} {selectedToken} {showStates} {onInspect} />{:else}<p>
      Content sits on the deepest generated surface.
    </p>{/if}
</article>
