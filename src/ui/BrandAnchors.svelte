<script lang="ts">
  import AnchorCard from './AnchorCard.svelte';
  import type { ColorAnchor, FamilyConfig } from '../engine/types';
  import { createBrandAnchor } from './brandAnchor';
  let {
    brand,
    anchors,
    onChange,
  }: { brand: FamilyConfig; anchors: ColorAnchor[]; onChange: (anchors: ColorAnchor[]) => Promise<boolean | undefined> } = $props();
  let brandAnchors = $derived(anchors.filter((anchor) => anchor.family === 'brand'));
  const updateAnchor = (anchor: ColorAnchor, next: ColorAnchor) =>
    onChange(anchors.map((item) => (item === anchor ? next : item)));
  const removeAnchor = (anchor: ColorAnchor) => onChange(anchors.filter((item) => item !== anchor));
</script>

<div class="brand-anchor-controls">
  <div class="brand-anchor-heading">
    <div>
      <strong>Brand color lock</strong>
      <p>Set a preferred or exact brand color in OKLCH. Defaults to the emphasis base fill.</p>
    </div>
    <button type="button" class="text-button" onclick={() => onChange([...anchors, createBrandAnchor(brand)])}
      >Add color</button
    >
  </div>
  {#if brandAnchors.length}{#each brandAnchors as anchor, index}<AnchorCard
        {anchor}
        {index}
        allAnchors={brandAnchors}
        onChange={(next) => updateAnchor(anchor, next)}
        onRemove={() => removeAnchor(anchor)}
      />{/each}{:else}<p class="help">
      Add a brand color to set a preference or keep an exact color.
    </p>{/if}
</div>
