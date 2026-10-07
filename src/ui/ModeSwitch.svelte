<script lang="ts">
  import type { PreviewMode } from './types';
  let { value, onChange }: { value: PreviewMode; onChange: (value: PreviewMode) => void } = $props();
</script>

<div class="segmented mode-switch" aria-label="Preview mode">
  {#each ['light', 'dark', 'split'] as const as mode}<button
      aria-pressed={value === mode}
      onclick={() => onChange(mode)}
      ><span aria-hidden="true">{mode === 'light' ? '☀' : mode === 'dark' ? '◐' : '◧'}</span>{mode === 'split'
        ? 'Split'
        : mode === 'light'
          ? 'Light'
          : 'Dark'}</button
    >{/each}
</div>
