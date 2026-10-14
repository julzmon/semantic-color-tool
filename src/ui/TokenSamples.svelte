<script lang="ts">
  import type { GeneratedSystem, Mode } from '../engine/types';
  import NestedSurfaceCard from './NestedSurfaceCard.svelte';
  import { previewTokens, previewStates, previewSections, type PreviewSection, type PreviewToken } from './previewTokens';
  let { system, mode, section, onInspect = () => {} }: {
    system: GeneratedSystem; mode: Mode; section: PreviewSection;
    onInspect?: (semantic: string) => void;
  } = $props();
  let theme = $derived(system.modes[mode]);
  let tokens = $derived(previewTokens(system, mode));
  let states = $derived(previewStates.filter(item => (item.id !== 'selected' || system.config.emphasis.selected)));
  const sampleStyle = (token: PreviewToken) => {
    const color = `var(${token.role.semantic})`;
    if (token.kind === 'muted') return `background: ${color}; color: ${theme.families[token.family!].roles['foreground.base']!.color.css}`;
    if (token.kind === 'emphasis') return `background: ${color}; color: ${theme.foreground.onEmphasis.color.css}`;
    if (token.kind.startsWith('border-')) return `border-color: ${color}; background: ${theme.surfaces[0].color.css}; color: ${theme.foreground.base.color.css}`;
    return `color: ${color}; background: ${token.role.semantic.endsWith('fg-on-emphasis') ? theme.families.brand.roles['emphasis.base']!.color.css : theme.surfaces[0].color.css}`;
  };
</script>

{#snippet sample(token: PreviewToken, label: string)}
  <button class="token-sample" class:token-border={token.kind.startsWith('border-')} class:token-text={['foreground', 'text', 'link'].includes(token.kind)}
    data-token={token.role.semantic} title={`${token.role.semantic}${token.anchor ? ` · ${token.anchor} anchor` : ''}`}
    aria-label={`Inspect ${token.label} in ${mode} theme`} aria-haspopup="dialog" style={sampleStyle(token)} onclick={() => onInspect(token.role.semantic)}>
    {label}{#if token.anchor === 'locked'}<span class="sample-anchor">Locked</span>{/if}
  </button>
{/snippet}

<section class="token-demo" aria-label={`${mode} ${previewSections.find(item => item.id === section)?.label}`}>
  <h3>{previewSections.find(item => item.id === section)?.label}</h3>
  {#if section === 'surfaces'}
    <div class="token-text-list">
      {#each tokens.filter(token => token.kind === 'text') as token}{@render sample(token, token.label)}{/each}
    </div>
    <NestedSurfaceCard surfaces={theme.surfaces} {onInspect} />
  {:else}
    {#each system.config.families as item}
      <div class="token-family" data-family={item.id}>
        <h4>{item.label}</h4>
        {#if section === 'fills'}
          {#each ['muted', 'emphasis'] as const as kind}
            <div class="token-sample-row" style={`--sample-columns: ${states.length}`}>
              <span class="token-row-label">{kind === 'muted' ? 'Muted' : 'Emphasis'}</span>
              {#each states as entry}{@const token = tokens.find(token => token.family === item.id && token.kind === kind && token.state === entry.id)}
                {#if token}{@render sample(token, entry.label)}{/if}
              {/each}
            </div>
          {/each}
        {:else}
          {#each [['foreground', 'Text'], ['border-muted', 'Muted border'], ['border-emphasis', 'Emphasis border']] as const as [kind, label]}
            <div class="token-sample-row" style="--sample-columns: 2">
              <span class="token-row-label">{label}</span>
              {#each tokens.filter(token => token.family === item.id && token.kind === kind) as token}{@render sample(token, token.state === 'base' ? 'Default' : 'Hover')}{/each}
            </div>
          {/each}
        {/if}
      </div>
    {/each}
    {#if section === 'relationships'}
      <div class="token-family"><h4>Links <span class="token-row-label">Info aliases</span></h4>
        <div class="token-sample-row" style="--sample-columns: 2"><span class="token-row-label">Link text</span>
          {#each tokens.filter(token => token.kind === 'link') as token}{@render sample(token, token.state === 'base' ? 'Default' : 'Hover')}{/each}
        </div>
      </div>
      <p class="token-demo-help">Muted borders are decorative. Emphasis borders meet the configured UI boundary target.</p>
    {/if}
  {/if}
</section>
