<script lang="ts">
  import NestedSurfaceCard from './NestedSurfaceCard.svelte';
  import type { GeneratedRole } from '../engine/types';
  function surfaceLabel(index: number) {
    return index === 0 ? 'Base' : `Level ${index}`;
  }
  let { surfaces, index = 0 }: { surfaces: GeneratedRole[]; index?: number } = $props();
  let surface = $derived(surfaces[index]!);
</script>

<article class="surface-nested-card" data-surface={surface.semantic} style:background={surface.color.css}>
  <span>{surfaceLabel(index)}</span>
  <strong>{index === 0 ? 'Workspace card' : `Nested card ${index}`}</strong>
  {#if index + 1 < surfaces.length}<NestedSurfaceCard {surfaces} index={index + 1} />{:else}<p>
      Content sits on the deepest generated surface.
    </p>{/if}
</article>
