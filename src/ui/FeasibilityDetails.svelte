<script lang="ts">
  import { inspectFeasibility, type SampleRun } from '../engine/feasibility';
  import type { GeneratedSystem, Mode } from '../engine/types';
  let { system, mode, token, expanded = false }: { system: GeneratedSystem; mode: Mode; token: string; expanded?: boolean } = $props();
  let open = $state(false);
  let report = $derived((open || expanded) ? inspectFeasibility(system, mode, token) : undefined);
  const format = (value: number) => Number(value.toFixed(6)).toString();
  const runs = (values: SampleRun[]) => values.length ? values.map(run => run.first === run.last ? format(run.first) : `${format(run.first)} … ${format(run.last)} (${run.values.length} samples)`).join('; ') : 'No verified samples';
  const short = (value: string) => value.replaceAll(`--${system.config.prefix}-`, '');
</script>

<details class="feasibility-details" open={open || expanded} ontoggle={event => { open = event.currentTarget.open; }}>
  <summary>Allowed lightness and sharing</summary>
  {#if report}
    <p class="help">Verified discrete samples at 0.001 lightness increments, with chroma reduced to fit sRGB. Values between samples are unverified. {report.locked ? 'Exact locks restrict the candidate values.' : ''}</p>
    <dl>
      <dt>Chosen lightness</dt><dd>{format(report.chosen)} · {report.chosenValid ? 'verified' : 'unresolved constraints'}</dd>
      <dt>Allowed samples</dt><dd>{runs(report.runs)}</dd>
      {#if report.jointSamples.length}<dt>Joint base samples</dt><dd>{runs(report.jointRuns)}</dd>{/if}
    </dl>
    <p class="help">{report.decision}</p>
    <details><summary>Restricting relationships ({report.relationships.length})</summary>
      <p class="help">Rejection counts describe the sampled search. All applicable relationships must pass together.</p>
      <ul class="usage-list">{#each report.restricting as item}<li>{short(item.relationship)} · rejects {item.rejectedSamples} samples</li>{/each}</ul>
      <details><summary>All requirements</summary><ul class="usage-list">{#each report.relationships as relationship}<li>{short(relationship)}</li>{/each}</ul></details>
    </details>
    {#if report.jointRestricting.length}<details><summary>Joint sharing restrictions</summary>
      <ul class="usage-list">{#each report.jointRestricting as item}<li>{short(item.relationship)} · rejects {item.rejectedSamples} joint base samples</li>{/each}</ul>
    </details>{/if}
    {#if report.lightnessOverlaps.length}<details><summary>Lightness overlap across families</summary>
      <p class="help">Each row intersects this role’s verified samples with another family’s requirements. It describes shared L values, not shared complete colors.</p>
      <ul class="usage-list">{#each report.lightnessOverlaps as overlap}<li>{short(overlap.role)} · {runs(overlap.runs)}</li>{/each}</ul>
    </details>{/if}
    <details><summary>Shared complete color ({report.sharing.completeColor.length})</summary>
      <ul class="usage-list">{#each report.sharing.completeColor as name}<li><code>{short(name)}</code></li>{/each}</ul>
    </details>
    <details><summary>Shared lightness only ({report.sharing.lightnessOnly.length})</summary>
      <p class="help">These roles have the same L value but different complete colors.</p>
      <ul class="usage-list">{#each report.sharing.lightnessOnly as name}<li><code>{short(name)}</code></li>{/each}</ul>
    </details>
    <p class="help">Visual hierarchy is separate from contrast. Joint solving retains foreground spacing and emphasis recipes; unresolved equal text or interaction lightness is reported in diagnostics. No perceptual threshold is certified.</p>
  {/if}
</details>

<style>
  .feasibility-details { margin-block: 1rem; }
  summary { cursor: pointer; }
  dd, li { overflow-wrap: anywhere; }
  details details { margin-block: .75rem; }
  ul { max-block-size: 16rem; overflow: auto; }
</style>
