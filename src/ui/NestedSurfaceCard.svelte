<script lang="ts">
  import NestedSurfaceCard from './NestedSurfaceCard.svelte';
  import type { GeneratedRole } from '../engine/types';
  function surfaceLabel(index: number) {
    return index === 0 ? 'Base' : `Level ${index}`;
  }
  let { surfaces, index = 0, onInspect }: { surfaces: GeneratedRole[]; index?: number; onInspect: (semantic: string) => void } = $props();
  let surface = $derived(surfaces[index]!);
</script>

<article class="surface-nested-card" data-surface={surface.semantic} style:background={surface.color.css}>
  <button class="surface-inspect" data-token={surface.semantic} aria-label={`Inspect ${surfaceLabel(index)} surface`} aria-haspopup="dialog" onclick={() => onInspect(surface.semantic)}>{surfaceLabel(index)} surface</button>
  <strong>{index === 0 ? 'Workspace card' : `Nested card ${index}`}</strong>
  {#if index + 1 < surfaces.length}<NestedSurfaceCard {surfaces} index={index + 1} {onInspect} />{:else}<p>
      Content sits on the deepest generated surface.
    </p>{/if}
</article>
