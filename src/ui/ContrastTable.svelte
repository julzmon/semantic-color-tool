<script lang="ts">
  import { onMount } from 'svelte';
  import type { GeneratedSystem, Mode } from '../engine/types';
  import { shortToken } from './presentation';
  let { system, modes }: { system: GeneratedSystem; modes: Mode[] } = $props();
  let failOnly = $state(false);
  let kind = $state('all');
  let limit = $state(12);
  let open = $state(false);
  onMount(() => {
    const openFromHash = () => {
      if (window.location.hash === '#contrast') open = true;
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  });
  let all = $derived(system.checks.filter((check) => modes.includes(check.mode)));
  let failures = $derived(all.filter((check) => !check.pass).length);
  let filtered = $derived(
    all
      .filter((check) => (!failOnly || !check.pass) && (kind === 'all' || check.kind === kind))
      .sort((a, b) => Number(a.pass) - Number(b.pass)),
  );
</script>

<section class="contrast-section" id="contrast">
  <div class="subsection-title">
    <div>
      <span class="eyebrow">WCAG CONTRAST</span>
      <h3>Contrast checks</h3>
    </div>
    <span class={`summary-badge ${failures ? 'has-failures' : ''}`}
      >{failures ? `${failures} failing` : 'All checks pass'} · {all.length} relationships</span
    >
  </div>
  <p class="section-description">
    Text is checked on its intended surfaces and semantic fills. Emphasis borders are checked against every
    surface.
  </p>
  <details class="contrast-details" bind:open>
    <summary>View contrast checks</summary>
  <div class="table-toolbar">
    <label
      >Relationship <select
        value={kind}
        onchange={(event) => {
          kind = event.currentTarget.value;
          limit = 12;
        }}
        ><option value="all">All types</option><option value="normal-text">Normal text</option><option
          value="large-text">Large text</option
        ><option value="ui-boundary">UI boundary</option></select
      ></label
    ><label class="checkbox-row"
      ><input
        type="checkbox"
        checked={failOnly}
        oninput={(event) => {
          failOnly = event.currentTarget.checked;
          limit = 12;
        }}
      />Failures only</label
    >
  </div>
  <div class="contrast-scroll">
    <table class="contrast-table">
      <thead
        ><tr
          ><th scope="col">Foreground → background</th><th scope="col">Mode / use</th><th scope="col"
            >Contrast</th
          ><th scope="col">Target</th><th scope="col">Result</th></tr
        ></thead
      ><tbody
        >{#each filtered.slice(0, limit) as check}<tr
            ><td
              ><div class="contrast-pair">
                <span
                  class="pair-sample"
                  style:background={check.backgroundColor.css}
                  style:color={check.foregroundColor.css}>Aa</span
                ><span
                  ><code>{shortToken(check.foreground)}</code><small>→ {shortToken(check.background)}</small
                  ></span
                >
              </div></td
            ><td class="mode-cell">{check.mode}<small>{check.kind.replaceAll('-', ' ')}</small></td><td
              ><code>{check.ratio.toFixed(3)}:1</code></td
            ><td>{check.target}:1</td><td
              ><span class={check.pass ? 'check-pass' : 'check-fail'}>{check.pass ? '✓ Pass' : '× Fail'}</span
              ></td
            ></tr
          >{/each}</tbody
      >
    </table>
  </div>
  {#if !filtered.length}<p class="empty-state">No relationships match this filter.</p>{/if}
  <div class="table-footer">
    <span
      >Showing {Math.min(filtered.length, limit)} of {filtered.length} relationships · status uses unrounded ratios</span
    >{#if filtered.length > limit}<button
        class="text-button"
        onclick={() => (limit = ((value) => value + 24)(limit))}>Show more ↓</button
      >{/if}
  </div>
  </details>
</section>
