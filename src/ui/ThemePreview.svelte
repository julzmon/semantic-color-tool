<script lang="ts">
  import TokenSamples from './TokenSamples.svelte';
  import { previewSections } from './previewTokens';
  import type { GeneratedSystem, Mode } from '../engine/types';
  import { previewStyle } from './presentation';

  const statuses = [
    { family: 'info', icon: 'i', title: 'You’re all up to date', description: 'Your changes are ready for the team.' },
    { family: 'positive', icon: '✓', title: 'Ready to share', description: 'All required checks have passed.' },
    { family: 'warning', icon: '!', title: 'Review before publishing', description: 'A few choices need your attention.' },
    { family: 'negative', icon: '×', title: 'Needs attention', description: 'Resolve blockers before continuing.' },
  ] as const;

  let {
    system, mode, selectedToken = '', onInspect = () => {},
  }: {
    system: GeneratedSystem;
    selectedToken?: string;
    mode: Mode;
    onInspect?: (semantic: string) => void;
  } = $props();
  let failures = $derived(system.checks.filter(check => check.mode === mode && !check.pass).length);
</script>

<article class="preview-shell" data-mode={mode} style={previewStyle(system)}>
  <header class="preview-heading">
    <span><span aria-hidden="true">{mode === 'light' ? '☀' : '◐'}</span>{mode === 'light' ? 'Light' : 'Dark'} theme</span>
    <span class={`status-label ${failures ? 'fail' : ''}`}>{failures ? `${failures} failed checks` : 'Checks pass'}</span>
  </header>
  <div class="theme-preview" data-mode={mode}>
    <div class="preview-context">
      <section class="preview-statuses" aria-labelledby={`status-updates-${mode}`}>
        <h3 id={`status-updates-${mode}`} class="sr-only">Status updates</h3>
        <div class="preview-status-grid">
          {#each statuses as status}<div class="preview-alert" data-family={status.family}>
            <span class="preview-alert-icon" aria-hidden="true">{status.icon}</span>
            <div><strong>{status.title}</strong><p>{status.description}</p></div>
          </div>{/each}
        </div>
      </section>
    </div>
    {#each previewSections as section}
      <TokenSamples {system} {mode} {selectedToken} section={section.id} {onInspect} />
    {/each}
      <section class="preview-nested" data-mode={mode === 'light' ? 'dark' : 'light'} aria-label={`Nested ${mode === 'light' ? 'dark' : 'light'} region`}>
        <strong>{mode === 'light' ? 'Dark' : 'Light'} within {mode}</strong>
        <p>The same semantic tokens follow this region’s color scheme.</p>
      </section>
  </div>
</article>
