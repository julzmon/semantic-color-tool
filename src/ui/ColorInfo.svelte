<script lang="ts">
  import type { ColorInspection } from './colorInspection';
  import { contrastGrade } from './colorInspection';
  import { displayBrandColor } from './brandAnchor';
  let { inspection }: { inspection: ColorInspection } = $props();
  const compact = (css: string) => displayBrandColor(css, 'oklch');
  const kindNames = { 'normal-text': 'Normal text', 'large-text': 'Large text', 'ui-boundary': 'UI boundary' };
  const marginText = (margin: number) => Math.abs(margin) < .001 && margin !== 0
    ? `${margin < 0 ? '−' : '+'}<0.001:1` : `${margin < 0 ? '−' : '+'}${Math.abs(margin).toFixed(Math.abs(margin) < .01 ? 3 : 2)}:1`;
  let check = $derived(inspection.relationship);
</script>

<div class="color-info-selected">
  <span class="color-info-dot" style:background={inspection.color.css} aria-hidden="true"></span>
  <code>{inspection.color.hex}</code>
  <code title={inspection.color.css}>{compact(inspection.color.css)}</code>
</div>
<code class="color-info-token">{inspection.name}</code>
{#if check}
  <div class="color-info-comparison-heading">
    <p>Tightest contrast check <span>{check.mode === 'light' ? 'Light' : 'Dark'} theme · {kindNames[check.kind]}</span></p>
    <span class="color-info-ratio" class:color-info-fail={!check.pass}>
      <strong>{check.ratio.toFixed(Math.abs(check.ratio - check.target) < .005 ? 3 : 2)}:1</strong>
      <span>{contrastGrade(check)}</span>
    </span>
  </div>
  <dl class="color-info-pair">
    <div><dt>{check.kind === 'ui-boundary' ? 'Boundary' : 'Foreground'}</dt><dd>
      <span class="color-info-dot" style:background={check.foregroundColor.css} aria-hidden="true"></span>
      <code title={check.foregroundColor.css}>{compact(check.foregroundColor.css)}</code>
      <code class="color-info-role">{check.foreground}</code>
    </dd></div>
    <div><dt>Background</dt><dd>
      <span class="color-info-dot" style:background={check.backgroundColor.css} aria-hidden="true"></span>
      <code title={check.backgroundColor.css}>{compact(check.backgroundColor.css)}</code>
      <code class="color-info-role">{check.background}</code>
    </dd></div>
  </dl>
  <footer class="color-info-requirement"><span>Target <strong>{check.target}:1</strong></span>
    <span class:color-info-fail={!check.pass}>{!check.pass && check.ratio >= check.target ? 'Not certified' : `${marginText(check.ratio - check.target)} ${check.pass ? 'headroom' : 'below target'}`}</span>
  </footer>
{:else}
  <p class="color-info-note">No contrast requirement applies to this color in the selected view. Decorative colors do not receive a text or boundary rating.</p>
{/if}
