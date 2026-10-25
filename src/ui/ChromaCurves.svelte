<script lang="ts">
  import Slider from './Slider.svelte';
  import { familyControlColor } from './controlTracks';
  import { curveColor, curvePins, effectiveCurve, requestedChroma, withChromaCurves } from '../engine/chroma-curves';
  import type { BuilderConfig, FamilyConfig, GeneratedSystem } from '../engine/types';

  let { config, system, onChange, checking = false }: {
    config: BuilderConfig;
    system: GeneratedSystem;
    onChange: (config: BuilderConfig) => Promise<boolean | undefined>;
    checking?: boolean;
  } = $props();
  const id = $props.id();
  type Group = 'brand' | 'semantic';
  type CurveField = 'peakLightness' | 'peakChroma' | 'darkBend' | 'lightBend';
  const groups = [{ id: 'brand', label: 'Brand' }, { id: 'semantic', label: 'Semantic colors' }] as const;
  const pins = $derived(curvePins(config));
  const pinnedPeak = $derived(pins.some(pin => pin.l > 0 && pin.l < 1));
  const families = (group: Group) => config.families.filter(family => group === 'brand'
    ? family.id === 'brand' : family.id !== 'brand' && family.id !== 'neutral');
  const ceiling = (group: Group) => Math.max(0.4, effectiveCurve(config, group).peakChroma, ...(group === 'brand' ? pins.map(pin => pin.c) : []));
  const x = (l: number) => 32 + l * 244;
  const y = (c: number, max: number) => 126 - c / max * 110;
  const samples = Array.from({ length: 101 }, (_, index) => index / 100);
  function path(group: Group, family?: FamilyConfig): string {
    const representative = family ?? families(group)[0];
    if (!representative) return '';
    return samples.map((l, index) => `${index ? 'L' : 'M'}${x(l).toFixed(2)},${y(family
      ? curveColor(config, family, l).c : requestedChroma(config, representative.id, l), ceiling(group)).toFixed(2)}`).join(' ');
  }
  function update(group: Group, field: CurveField, value: number) {
    const normalized = withChromaCurves(config);
    return onChange({ ...normalized, chromaCurves: {
      ...normalized.chromaCurves!,
      [group]: { ...normalized.chromaCurves![group], [field]: value },
    } });
  }
</script>

<section class="control-section sidebar-section chroma-shaping" aria-labelledby={`${id}-heading`} aria-busy={checking}>
  <header class="section-heading"><h3 id={`${id}-heading`}>Chroma shaping</h3></header>
  <p class="help">Shape color intensity from black to white. Brand has its own curve; Info, Positive, Negative, and Warning share one curve across both themes.</p>
  {#each groups as group (group.id)}
    {@const curve = effectiveCurve(config, group.id)}
    {@const locked = group.id === 'brand' && pinnedPeak}
    <div class="sidebar-group curve-group" aria-labelledby={`${id}-${group.id}-heading`}>
      <h4 id={`${id}-${group.id}-heading`}>{group.label}</h4>
      <svg class="curve-chart" viewBox="0 0 288 160" role="img" aria-labelledby={`${id}-${group.id}-title`} aria-describedby={`${id}-${group.id}-description`}>
        <title id={`${id}-${group.id}-title`}>{group.label} chroma by lightness</title>
        <desc id={`${id}-${group.id}-description`}>Lightness runs from black at 0 to white at 1. Chroma runs from 0 to {ceiling(group.id).toFixed(3)}. Dashed line: requested curve. Solid lines: resulting chroma after hue-specific sRGB limits. Circles: exact locked Brand colors.</desc>
        {#each [0, 0.5, 1] as fraction}
          <line class="grid-line" x1="32" x2="276" y1={y(fraction * ceiling(group.id), ceiling(group.id))} y2={y(fraction * ceiling(group.id), ceiling(group.id))} />
          <text class="tick-label" x="26" y={y(fraction * ceiling(group.id), ceiling(group.id)) + 3} text-anchor="end">{Number((fraction * ceiling(group.id)).toFixed(3))}</text>
        {/each}
        <path class="axis" d="M32 16V126H276" />
        <path class="requested-curve" d={path(group.id)} />
        {#each families(group.id) as family (family.id)}
          <path class="gamut-curve" stroke={familyControlColor(family)} d={path(group.id, family)} />
        {/each}
        {#if group.id === 'brand'}
          {#each pins as pin}
            <circle class="pin" cx={x(pin.l)} cy={y(pin.c, ceiling(group.id))} r="3.5"><title>Exact lock: L {pin.l.toFixed(3)}, C {pin.c.toFixed(3)}</title></circle>
          {/each}
        {/if}
        <text class="axis-label" x="32" y="145">0 · Black</text>
        <text class="axis-label" x="276" y="145" text-anchor="end">1 · White</text>
        <text class="axis-label" x="32" y="10">Chroma</text>
      </svg>
      <div class="curve-legend" aria-label={`${group.label} curve legend`}>
        <span><i class="requested-key" aria-hidden="true"></i>Requested</span>
        {#each families(group.id) as family (family.id)}
          <span><i style={`--curve-color: ${familyControlColor(family)}`} aria-hidden="true"></i>{family.label}</span>
        {/each}
        {#if group.id === 'brand' && pins.length}<span><i class="pin-key" aria-hidden="true"></i>Exact lock</span>{/if}
      </div>
      {#if locked}
        <p class="help">Exact Brand locks pin the curve. Edit or unlock those colors in Setup to move them; both end shapes remain editable.</p>
        <div class="pinned-values">
          <label>Brand peak chroma<input type="number" aria-label="Brand peak chroma value" readonly value={curve.peakChroma} step="any" /></label>
          <label>Brand peak lightness<input type="number" aria-label="Brand peak lightness value" readonly value={curve.peakLightness} step="any" /></label>
        </div>
      {:else}
        <Slider label={`${group.id === 'brand' ? 'Brand' : 'Semantic'} peak chroma`} value={curve.peakChroma} min={0} max={ceiling(group.id)} pending={checking} onChange={value => update(group.id, 'peakChroma', value)} />
        <Slider label={`${group.id === 'brand' ? 'Brand' : 'Semantic'} peak lightness`} value={curve.peakLightness} min={0.01} max={0.99} pending={checking} onChange={value => update(group.id, 'peakLightness', value)} />
      {/if}
      <Slider label={`${group.id === 'brand' ? 'Brand' : 'Semantic'} dark-end shape`} value={curve.darkBend * 100} min={0} max={100} step={1} unit="%" pending={checking} onChange={value => update(group.id, 'darkBend', value / 100)} />
      <Slider label={`${group.id === 'brand' ? 'Brand' : 'Semantic'} light-end shape`} value={curve.lightBend * 100} min={0} max={100} step={1} unit="%" pending={checking} onChange={value => update(group.id, 'lightBend', value / 100)} />
    </div>
  {/each}
  <p class="help">Dashed curves show requested chroma. Each hue has a different sRGB limit, so solid curves may fall below it. Exact Brand locks stay fixed. Contrast protection checks every edit{system.checks.length ? ' against both themes' : ''}.</p>
</section>

<style>
  .curve-group { min-inline-size: 0; }
  .curve-group + .curve-group { margin-block-start: 24px; }
  .curve-chart { display: block; inline-size: 100%; block-size: auto; overflow: visible; margin-block: 12px 4px; }
  .grid-line { stroke: #ddd; stroke-width: 0.75; }
  .axis { fill: none; stroke: #111; stroke-width: 1; }
  .requested-curve { fill: none; stroke: #111; stroke-width: 1.5; stroke-dasharray: 4 3; }
  .gamut-curve { fill: none; stroke-width: 2; }
  .pin { fill: #fff; stroke: #111; stroke-width: 1.5; }
  .tick-label, .axis-label { fill: #444; font-family: inherit; font-size: 10px; font-variant-numeric: tabular-nums; }
  .curve-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-block-end: 16px; font-size: 11px; color: #444; }
  .curve-legend span { display: inline-flex; align-items: center; gap: 5px; }
  .curve-legend i { inline-size: 13px; border-block-start: 2px solid var(--curve-color, #111); }
  .curve-legend .requested-key { border-block-start-style: dashed; }
  .curve-legend .pin-key { inline-size: 6px; block-size: 6px; border: 1.5px solid #111; border-radius: 50%; }
  .pinned-values { display: grid; gap: 10px; margin-block: 12px 16px; }
  .pinned-values label { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; }
  .pinned-values input { inline-size: 84px; min-inline-size: 0; padding: 4px; border: 1px solid #ccc; background: #f3f3f3; color: #444; font: inherit; font-variant-numeric: tabular-nums; }
</style>
