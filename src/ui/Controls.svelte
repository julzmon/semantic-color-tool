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
    <div><h2>Adjust colors</h2></div>
    <button class="text-button" onclick={onReset} title="Restore the default configuration">Reset</button>
  </div>
  <div class="protection-summary">
    <p class="help control-check-status" role="status">{checking ? 'Checking contrast…' : 'Contrast checks pass.'}</p>
    <button class="text-button" disabled={!canUndo} onclick={onUndo}>Undo last change</button>
  </div>
  <section class="control-section" aria-labelledby="structure-heading">
    <div class="section-heading"><span class="section-number">01</span><h3 id="structure-heading">Surfaces &amp; states</h3></div>
    <fieldset class="surface-count"><legend>Surface count</legend>
      <div class="segmented" aria-label="Surface count">
        {#each [1, 2, 3, 4, 5, 6] as count}<button aria-pressed={config.surfaces.levels === count} aria-label={`${count} ${count === 1 ? 'surface' : 'surfaces'}`} onclick={() => onChange({ ...config, surfaces: { ...config.surfaces, levels: count } })}>{count}</button>{/each}
      </div>
    </fieldset>
    <p class="help">{config.surfaces.levels} {config.surfaces.levels === 1 ? 'surface: base only' : `surfaces: base + ${config.surfaces.levels - 1} ${config.surfaces.levels === 2 ? 'level' : 'levels'}`}.</p>
    <span class="adjustment-note" class:reserved-feedback={!adjusted.includes('surfaces.levels')} aria-hidden={!adjusted.includes('surfaces.levels')}>Surface count automatically adjusted for contrast</span>
    <label class="checkbox-row"><input type="checkbox" checked={config.emphasis.selected} oninput={async event => { const input = event.currentTarget; await onChange({ ...config, emphasis: { ...config.emphasis, selected: input.checked } }); await tick(); input.checked = config.emphasis.selected; }} />Include selected state</label>
    <p class="help">Add colors for selected buttons and items.</p>
  </section>
  <section class="control-section" aria-labelledby="surfaces-heading">
    <div class="section-heading"><span class="section-number">02</span><h3 id="surfaces-heading">Surfaces &amp; neutrals</h3></div>
    <p class="help">Hue and chroma apply to neutral colors in both themes. Chroma controls color intensity.</p>
    <details class="advanced-controls"><summary>Neutral color limits</summary><p class="help">Exact color locks and their related states keep their own colors. Pure white and black have no tint. Chroma is reduced when needed to fit the sRGB color range.</p></details>
    <Slider label="Neutral hue" min={0} max={360} step={1} unit="°" value={neutral.hue} adjusted={adjusted.includes('families.neutral.hue')} onChange={value => updateFamily('neutral', { hue: value })} />
    <Slider label="Neutral chroma" min={0} max={0.3} value={neutral.chroma} adjusted={adjusted.includes('families.neutral.chroma')} onChange={value => updateFamily('neutral', { chroma: value })} />
    {#each ['light', 'dark'] as const as theme}
      <fieldset class="theme-controls"><legend>{theme === 'light' ? 'Light theme' : 'Dark theme'}</legend>
        <Slider label="Base lightness" min={0} max={1} value={config.surfaces[theme].l} adjusted={adjusted.includes(`surfaces.${theme}.l`)} onChange={l => onChange({ ...config, surfaces: { ...config.surfaces, [theme]: { l } } })} />
        <Slider label="Level spacing" min={0.001} max={0.2} step={0.001} value={surfaceStep(config, theme)} adjusted={adjusted.includes(`surfaces.${theme}.step`)} onChange={value => updateStep(theme, value)} />
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
    <p class="help">Chroma controls color intensity. Lightness adjusts to meet contrast requirements.</p>
    {#if family.id === 'brand'}<details class="advanced-controls"><summary>Lock a brand color</summary><BrandAnchors brand={family} anchors={config.anchors} onChange={anchors => onChange({ ...config, anchors })} /></details>{/if}
  </section>
  <section class="control-section" aria-labelledby="muted-heading">
    <div class="section-heading"><span class="section-number">04</span><h3 id="muted-heading">Muted fills</h3></div>
    {#each ['light', 'dark'] as const as theme}
      <fieldset class="theme-controls"><legend>{theme === 'light' ? 'Light theme' : 'Dark theme'}</legend>
        <Slider label="Muted distance" min={-0.08} max={theme === 'dark' ? 0.5 : 0.16} step={0.005} value={mutedDistance(config, theme)} adjusted={adjusted.includes(`muted.${theme}.distance`)} onChange={value => updateDistance(theme, value)} />
        <p class="help">{theme === 'light' ? 'Higher values make muted fills darker.' : 'Higher values make muted fills lighter.'}</p>
        <Slider label="Muted chroma" min={0} max={200} step={1} unit="%" value={mutedChromaScale(config, theme) * 100} adjusted={adjusted.includes(`muted.${theme}.chroma`)} onChange={value => updateChroma(theme, value)} />
      </fieldset>
    {/each}
    <details class="advanced-controls"><summary>Muted color limits</summary><p class="help">100% uses the family chroma; 0% removes color. Higher values add color where the sRGB range allows it. Muted borders are decorative; their text is checked for contrast.</p></details>
    <p class="help">Muted chroma controls color intensity for colored families. Neutral colors use Neutral chroma.</p>
  </section>
  <section class="control-section" aria-labelledby="states-heading">
    <div class="section-heading"><span class="section-number">05</span><h3 id="states-heading">Interaction states</h3></div>
    <Slider label="Muted state spacing" min={0.005} max={0.07} step={0.005} value={config.muted.separation} adjusted={adjusted.includes('muted.separation')} onChange={separation => onChange({ ...config, muted: { ...config.muted, separation } })} />
    <Slider label="Emphasis state spacing" min={0.01} max={0.1} step={0.005} value={config.emphasis.separation} adjusted={adjusted.includes('emphasis.separation')} onChange={separation => onChange({ ...config, emphasis: { ...config.emphasis, separation } })} />
    <p class="help">Controls how much colors change on hover, press, and selection in both themes.</p>
    <details class="advanced-controls"><summary>Emphasis across themes</summary>
      <div class="strategy-options" aria-label="Emphasis across themes">
        <button aria-pressed={(config.emphasis.strategy ?? 'shared') === 'shared'} onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'shared' } })}>Same colors</button>
        <button aria-pressed={config.emphasis.strategy === 'adaptive'} onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'adaptive' } })}>Different colors</button>
      </div>
      <p class="help">Use the same emphasis fills and text in both themes, or let each theme use its own colors.</p>
    </details>
  </section>
  <div class="protection-summary">
    <details>
      <summary>Contrast protection</summary>
      <p class="help">Settings adjust automatically to keep contrast checks passing. Locked colors stay fixed; changes that cannot pass are limited or rejected.</p>
      <dl class="contrast-requirements">
        {#each [['normalText', 'Normal text'], ['largeText', 'Large text'], ['ui', 'Emphasis borders']] as const as [key, label]}
          <div class="target-row"><dt>{label}</dt><dd>{config.targets[key]}:1</dd></div>
        {/each}
      </dl>
    </details>
  </div>
</aside>
