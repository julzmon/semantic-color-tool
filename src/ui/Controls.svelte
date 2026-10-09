<script lang="ts">
  import { tick } from 'svelte';
  import Slider from './Slider.svelte';
  import { mutedChromaScale, mutedDistance, surfaceStep } from '../engine/config';
  import type { BuilderConfig, FamilyId, Mode } from '../engine/types';
  import BrandAnchors from './BrandAnchors.svelte';
  let { config, adjusted = [], checking = false, canUndo = false, onChange, onReset, onUndo }: {
    config: BuilderConfig; adjusted?: string[]; checking?: boolean; canUndo?: boolean;
    onChange: (config: BuilderConfig) => Promise<boolean | undefined>; onReset: () => void; onUndo: () => void;
  } = $props();
  let familyId = $state<FamilyId>('brand');
  let family = $derived(config.families.find(item => item.id === familyId)!);
  let neutral = $derived(config.families.find(item => item.id === 'neutral')!);
  const updateFamily = (id: FamilyId, patch: { hue?: number; chroma?: number }) => onChange({ ...config, families: config.families.map(item => item.id === id ? { ...item, ...patch } : item) });
  const updateStep = (mode: Mode, value: number) => onChange({ ...config, surfaces: { ...config.surfaces, step: { light: surfaceStep(config, 'light'), dark: surfaceStep(config, 'dark'), [mode]: value } } });
  const updateDistance = (mode: Mode, value: number) => onChange({ ...config, muted: { ...config.muted, distance: { light: mutedDistance(config, 'light'), dark: mutedDistance(config, 'dark'), [mode]: value } } });
  const updateChroma = (mode: Mode, value: number) => onChange({ ...config, muted: { ...config.muted, chromaScale: { light: mutedChromaScale(config, 'light'), dark: mutedChromaScale(config, 'dark'), [mode]: value / 100 } } });
</script>

<aside class="controls" aria-label="Color system configuration">
  <div class="controls-heading">
    <div><span class="eyebrow">INPUTS</span><h2>Define the system</h2></div>
    <button class="text-button" onclick={onReset} title="Restore the default configuration">Reset</button>
  </div>
  <div class="protection-summary">
    <details>
      <summary><span class="status-dot"></span>Contrast protection on</summary>
      <dl class="contrast-requirements">
        {#each [['normalText', 'Normal text'], ['largeText', 'Large text'], ['ui', 'UI boundaries']] as const as [key, label]}
          <div class="target-row"><dt>{label}</dt><dd>{config.targets[key]}:1</dd></div>
        {/each}
      </dl>
      <p class="help">Spacing may adjust automatically. Impossible changes are limited or rejected; targets and exact locks stay fixed.</p>
    </details>
    <p class="help control-check-status" role="status">{checking ? 'Checking contrast…' : 'Contrast checks pass.'}</p>
    <button class="text-button" disabled={!canUndo} onclick={onUndo}>Undo last adjusted change</button>
  </div>
  <section class="control-section" aria-labelledby="structure-heading">
    <div class="section-heading"><span class="section-number">01</span><h3 id="structure-heading">System structure</h3></div>
    <fieldset class="surface-count"><legend>Surface count</legend>
      <div class="segmented" aria-label="Surface count">
        {#each [1, 2, 3, 4, 5, 6] as count}<button aria-pressed={config.surfaces.levels === count} aria-label={`${count} ${count === 1 ? 'surface' : 'surfaces'}`} onclick={() => onChange({ ...config, surfaces: { ...config.surfaces, levels: count } })}>{count}</button>{/each}
      </div>
    </fieldset>
    <p class="help">{config.surfaces.levels} {config.surfaces.levels === 1 ? 'surface: base only' : `surfaces: base + ${config.surfaces.levels - 1} ${config.surfaces.levels === 2 ? 'level' : 'levels'}`}.</p>
    <span class="adjustment-note" class:reserved-feedback={!adjusted.includes('surfaces.levels')} aria-hidden={!adjusted.includes('surfaces.levels')}>Surface count automatically adjusted for contrast</span>
    <label class="checkbox-row"><input type="checkbox" checked={config.emphasis.selected} oninput={async event => { const input = event.currentTarget; await onChange({ ...config, emphasis: { ...config.emphasis, selected: input.checked } }); await tick(); input.checked = config.emphasis.selected; }} />Include selected state</label>
    <p class="help">Base, hover and active are always included. Selected adds a state to muted and emphasis fills.</p>
  </section>
  <section class="control-section" aria-labelledby="surfaces-heading">
    <div class="section-heading"><span class="section-number">02</span><h3 id="surfaces-heading">Surfaces &amp; neutrals</h3></div>
    <p class="help">One hue and chroma for all generated gray surfaces, fills, borders, and text in both themes. Exact locks, their state groups, and pure white/black are exceptions. Chroma is reduced where sRGB requires it.</p>
    <Slider label="Neutral hue" min={0} max={360} step={1} unit="°" value={neutral.hue} adjusted={adjusted.includes('families.neutral.hue')} onChange={value => updateFamily('neutral', { hue: value })} />
    <Slider label="Neutral chroma" min={0} max={0.3} value={neutral.chroma} adjusted={adjusted.includes('families.neutral.chroma')} onChange={value => updateFamily('neutral', { chroma: value })} />
    {#each ['light', 'dark'] as const as theme}
      <fieldset class="theme-controls"><legend>{theme === 'light' ? 'Light theme' : 'Dark theme'}</legend>
        <Slider label={theme === 'light' ? 'Light base lightness' : 'Dark base lightness'} min={0} max={1} value={config.surfaces[theme].l} adjusted={adjusted.includes(`surfaces.${theme}.l`)} onChange={l => onChange({ ...config, surfaces: { ...config.surfaces, [theme]: { l } } })} />
        <Slider label={theme === 'light' ? 'Light tonal spacing' : 'Dark tonal spacing'} min={0.001} max={0.2} step={0.001} value={surfaceStep(config, theme)} adjusted={adjusted.includes(`surfaces.${theme}.step`)} onChange={value => updateStep(theme, value)} />
        <p class="help">{theme === 'light' ? 'Each added level is darker than the previous one.' : 'Each added level is lighter than the previous one.'}</p>
      </fieldset>
    {/each}
  </section>
  <section class="control-section" aria-labelledby="semantic-heading">
    <div class="section-heading"><span class="section-number">03</span><h3 id="semantic-heading">Semantic colors</h3></div>
    <div class="segmented family-switch" aria-label="Edit semantic color family">
      {#each config.families.filter(item => item.id !== 'neutral') as item}<button aria-pressed={item.id === familyId} onclick={() => familyId = item.id}>{item.label}</button>{/each}
    </div>
    <Slider label={`${family.label} hue`} min={0} max={360} step={1} unit="°" value={family.hue} adjusted={adjusted.includes(`families.${family.id}.hue`)} onChange={value => updateFamily(familyId, { hue: value })} />
    <Slider label={`${family.label} chroma`} min={0} max={0.3} value={family.chroma} adjusted={adjusted.includes(`families.${family.id}.chroma`)} onChange={value => updateFamily(familyId, { chroma: value })} />
    <p class="help">Role lightness is solved by contrast. Chroma is reduced where sRGB requires it.</p>
    {#if family.id === 'brand'}<details class="advanced-controls"><summary>Brand anchors &amp; exact locks</summary><BrandAnchors brand={family} anchors={config.anchors} onChange={anchors => onChange({ ...config, anchors })} /></details>{/if}
  </section>
  <section class="control-section" aria-labelledby="muted-heading">
    <div class="section-heading"><span class="section-number">04</span><h3 id="muted-heading">Muted fills</h3></div>
    {#each ['light', 'dark'] as const as theme}
      <fieldset class="theme-controls"><legend>{theme === 'light' ? 'Light theme' : 'Dark theme'}</legend>
        <Slider label={theme === 'light' ? 'Light muted distance' : 'Dark muted distance'} min={-0.08} max={theme === 'dark' ? 0.5 : 0.16} step={0.005} value={mutedDistance(config, theme)} adjusted={adjusted.includes(`muted.${theme}.distance`)} onChange={value => updateDistance(theme, value)} />
        <p class="help">{theme === 'light' ? 'Higher distance makes fills darker than the light base.' : 'Higher distance makes fills lighter than the dark base, allowing more color.'}</p>
        <Slider label={theme === 'light' ? 'Light muted chroma' : 'Dark muted chroma'} min={0} max={200} step={1} unit="%" value={mutedChromaScale(config, theme) * 100} adjusted={adjusted.includes(`muted.${theme}.chroma`)} onChange={value => updateChroma(theme, value)} />
      </fieldset>
    {/each}
    <p class="help">Applies to colored families only. Neutral fills and borders use Neutral chroma. 100% uses family chroma; 0% removes it. Higher values request more color within sRGB. Muted borders are decorative; their text is checked.</p>
  </section>
  <section class="control-section" aria-labelledby="states-heading">
    <div class="section-heading"><span class="section-number">05</span><h3 id="states-heading">Interaction states</h3></div>
    <Slider label="Muted state spacing" min={0.005} max={0.07} step={0.005} value={config.muted.separation} adjusted={adjusted.includes('muted.separation')} onChange={separation => onChange({ ...config, muted: { ...config.muted, separation } })} />
    <Slider label="Emphasis state spacing" min={0.01} max={0.1} step={0.005} value={config.emphasis.separation} adjusted={adjusted.includes('emphasis.separation')} onChange={separation => onChange({ ...config, emphasis: { ...config.emphasis, separation } })} />
    <p class="help">Lightness spacing between base, hover, active and optional selected states. Applies to both themes.</p>
    <details class="advanced-controls"><summary>Emphasis color strategy</summary>
      <div class="strategy-options" aria-label="Emphasis color strategy">
        <button aria-pressed={(config.emphasis.strategy ?? 'shared') === 'shared'} onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'shared' } })}>Shared emphasis colors</button>
        <button aria-pressed={config.emphasis.strategy === 'adaptive'} onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'adaptive' } })}>Theme-specific emphasis colors</button>
      </div>
      <p class="help">Shared uses matching emphasis fills and on-emphasis text in both themes. Theme-specific solves each theme independently.</p>
    </details>
  </section>
</aside>
