<script lang="ts">
  import type { GeneratedSystem } from '../engine/types';
  import { inkFor } from './presentation';
  let { system }: { system: GeneratedSystem } = $props();
  let selected = $state<string>('');
  let primitive = $derived(system.primitives.find((item) => item.name === selected));
</script>

<section class="primitive-section">
  <p class="section-description">
    Only colors used by the semantic system are collected. Light and dark share this palette. Matching numbers
    share one lightness across families.
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
            aria-pressed={selected === item.name}
            onclick={() => (selected = item.name)}
            title={item.name}
            ><span style:background={item.color.css} style:color={inkFor(item.color)}
              >{item.name.replace(`--${system.config.prefix}-key-${family.key}-`, '')}</span
            ><code>{item.color.hex}</code></button
          >{/each}
      </div>
    </div>{/each}{#if primitive}<div class="primitive-detail" aria-live="polite">
      <div class="detail-dot" style:background={primitive.color.css}></div>
      <div>
        <strong>{primitive.name}</strong><code>{primitive.color.css}</code>
        <p>Used by {primitive.usages.length} semantic mappings:</p>
        <ul class="usage-list">
          {#each primitive.usages as name}<li><code>{name}</code></li>{/each}
        </ul>
      </div>
    </div>{/if}
</section>
