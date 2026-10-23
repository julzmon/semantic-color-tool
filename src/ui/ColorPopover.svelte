<script lang="ts">
  import type { Snippet } from 'svelte';
  let { id, title, anchorName, children, onOpenChange }: { id: string; title: string; anchorName: string; children: Snippet; onOpenChange?: (open: boolean) => void } = $props();
</script>

<div {id} class="color-popover" popover="auto" role="dialog" aria-label={title} style:position-anchor={anchorName} onbeforetoggle={event => onOpenChange?.((event as ToggleEvent).newState === 'open')}>
  <header class="color-popover-heading">
    <h3>{title}</h3>
    <button type="button" class="color-popover-close" aria-label="Close color information" popovertarget={id} popovertargetaction="hide">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
  </header>
  {@render children()}
</div>
