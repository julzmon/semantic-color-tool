<script lang="ts">
  import type { Selection } from './types';
  import type { GeneratedSystem, Mode } from '../engine/types';
  import { inkFor } from './presentation';
  let {
    system,
    mode,
    onSelect,
  }: { system: GeneratedSystem; mode: Mode; onSelect: (selection: Selection) => void } = $props();
  let family = $derived(system.modes[mode].families.brand);
  let roles = $derived([
    'muted.base',
    'muted.hover',
    'muted.active',
    'emphasis.base',
    'emphasis.hover',
    'emphasis.active',
  ] as const);
</script>

<section class="state-overview">
  <div class="subsection-title">
    <div>
      <span class="eyebrow">RELATIONSHIPS, NOT RAMPS</span>
      <h3>One family. Every role.</h3>
    </div>
    <span class="mini-tag">Brand · {mode}</span>
  </div>
  <div class="state-samples">
    {#each roles as name}{@const role = family.roles[name]!}<button
        onclick={() => onSelect({ mode, family: 'brand', role: name })}
        ><span style:background={role.color.css} style:color={inkFor(role.color)}>Aa</span><strong
          >{name.split('.')[0]}</strong
        ><small>{name.split('.')[1]}</small></button
      >{/each}
  </div>
  <div class="relationship-summary">
    {#each ['foreground.base', 'border.muted.base', 'border.emphasis.base'] as const as name}{@const role =
        family.roles[name]!}{@const isFg = name.startsWith('foreground')}<button
        onclick={() => onSelect({ mode, family: 'brand', role: name })}
        ><span
          class={isFg ? 'sample-foreground' : 'sample-border'}
          style:color={isFg ? role.color.css : undefined}
          style:border-color={isFg ? undefined : role.color.css}
          style:background={system.modes[mode].surfaces[0].color.css}>{isFg ? 'Aa' : ''}</span
        >
        <div>
          <strong
            >{name === 'foreground.base'
              ? 'Semantic foreground'
              : name === 'border.muted.base'
                ? 'Muted border'
                : 'Emphasis border'}</strong
          ><small
            >{name === 'border.muted.base'
              ? 'Decorative separator'
              : role.sharedWith.length
                ? 'Shares a generated primitive'
                : 'Generated for its constraints'}</small
          >
        </div>
        <span aria-hidden="true">↗</span></button
      >{/each}
  </div>
</section>
