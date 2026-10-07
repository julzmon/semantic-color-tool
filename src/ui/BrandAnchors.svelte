<script lang="ts">
  import AnchorCard from './AnchorCard.svelte';
  import type { ColorAnchor, FamilyConfig } from '../engine/types';
  import { createBrandAnchor } from './brandAnchor';
  let {
    brand,
    anchors,
    onChange,
  }: { brand: FamilyConfig; anchors: ColorAnchor[]; onChange: (anchors: ColorAnchor[]) => void } = $props();
  let brandAnchors = $derived(anchors.filter((anchor) => anchor.family === 'brand'));
  const updateAnchor = (anchor: ColorAnchor, next: ColorAnchor) =>
    onChange(anchors.map((item) => (item === anchor ? next : item)));
  const removeAnchor = (anchor: ColorAnchor) => onChange(anchors.filter((item) => item !== anchor));
</script>

<div class="brand-anchor-controls">
  <div class="brand-anchor-heading">
    <div>
      <strong>Brand color lock</strong>
      <p>By default, this anchors the Brand emphasis-base token. Use OKLCH only.</p>
    </div>
    <button type="button" class="text-button" onclick={() => onChange([...anchors, createBrandAnchor(brand)])}
      >Add anchor</button
    >
  </div>
  {#if brandAnchors.length}{#each brandAnchors as anchor, index}<AnchorCard
        {anchor}
        {index}
        allAnchors={brandAnchors}
        onChange={(next) => updateAnchor(anchor, next)}
        onRemove={() => removeAnchor(anchor)}
      />{/each}{:else}<p class="help">
      No Brand color is anchored. Add one to set a preferred or exact emphasis-base color.
    </p>{/if}
</div>
