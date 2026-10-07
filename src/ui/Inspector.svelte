<script lang="ts">
  import type { Selection } from './types';
  import type { GeneratedSystem } from '../engine/types';
  import { inkFor, shortToken, tokenLabel } from './presentation';
  let { system, selected }: { system: GeneratedSystem; selected: Selection } = $props();
  let role = $derived(system.modes[selected.mode].families[selected.family].roles[selected.role]);
  let checks = $derived(
    system.checks.filter(
      (check) =>
        check.mode === selected.mode &&
        (check.foreground === role?.semantic || check.background === role?.semantic),
    ),
  );
  let sorted = $derived([...checks].sort((a, b) => Number(a.pass) - Number(b.pass) || a.ratio - b.ratio));
</script>

{#if role}<aside class="inspector" aria-label="Selected token details">
    <div class="inspector-swatch" style:background={role.color.css} style:color={inkFor(role.color)}>
      <span>Aa</span><code>{role.color.hex}</code>
    </div>
    <div class="inspector-body">
      <span class="eyebrow">TOKEN INSPECTOR · {selected.mode.toUpperCase()}</span>
      <h3>
        {system.config.families.find((family) => family.id === selected.family)?.label ?? selected.family} / {selected.role.replaceAll(
          '.',
          ' / ',
        )}
      </h3>
      <dl>
        <dt>OKLCH</dt>
        <dd><code>{role.color.css}</code></dd>
        <dt>HEX / sRGB approximation</dt>
        <dd><code>{role.color.hex}</code></dd>
        <dt>Generated primitive</dt>
        <dd><code>{role.primitive}</code></dd>
        <dt>Semantic token</dt>
        <dd><code>{role.semantic}</code></dd>
      </dl>
      <span class={`sharing-label ${role.sharedWith.length ? 'shared' : ''}`}
        >{role.sharedWith.length
          ? `↗ Shared with ${role.sharedWith.length} role${role.sharedWith.length === 1 ? '' : 's'}`
          : 'Separate primitive'}</span
      >
      {#if role.sharedWith.length > 0}<ul class="usage-list">
          {#each role.sharedWith as name}<li><code>{shortToken(name)}</code></li>{/each}
        </ul>{/if}
      {#if role.color.gamutMapped}<p class="gamut-note">
          Chroma reduced to fit sRGB. Lightness and hue are preserved.
        </p>{/if}
      <h4>Contrast relationships</h4>
      {#if sorted.length}<div class="inspector-checks">
          {#each sorted.slice(0, 8) as check}<div>
              <span class={check.pass ? 'check-pass' : 'check-fail'}
                >{check.pass ? 'Pass' : 'Fail'} · {check.ratio.toFixed(3)}:1</span
              >
              <p>{tokenLabel(check.foreground)} → {tokenLabel(check.background)}</p>
              <small>{check.kind} · target {check.target}:1</small>
            </div>{/each}{#if sorted.length > 8}<p class="help">
              All {sorted.length} relationships are listed in the accessibility table.
            </p>{/if}
        </div>{:else}<p class="help">Decorative role. No boundary contrast target applies.</p>{/if}
    </div>
  </aside>{/if}
