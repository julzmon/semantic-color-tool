<script lang="ts">
  import { tick } from 'svelte';
  import Slider from './Slider.svelte';
  import { mutedChromaScale, mutedDistance, surfaceStep } from '../engine/config';
  import type { BuilderConfig, FamilyId, Mode } from '../engine/types';
  import BrandAnchors from './BrandAnchors.svelte';
  let { config, adjusted = [], checking = false, canUndo = false, settingsOpen = false, onKeydown, onClose, onChange, onReset, onUndo }: {
    config: BuilderConfig; adjusted?: string[]; checking?: boolean; canUndo?: boolean; settingsOpen?: boolean;
    onKeydown: (event: KeyboardEvent) => void; onClose: () => void;
    onChange: (config: BuilderConfig) => Promise<boolean | undefined>; onReset: () => void; onUndo: () => void;
  } = $props();
  const paletteTrackStyle = (families: BuilderConfig['families']) => `--family-spectrum: linear-gradient(90deg, #dedede, ${families.map(family => `oklch(.68 ${Math.min(family.chroma, .2)} ${family.hue})`).join(', ')})`;
  const updateFamily = (id: FamilyId, patch: { hue?: number; chroma?: number }) => onChange({ ...config, families: config.families.map(item => item.id === id ? { ...item, ...patch } : item) });
  const updateStep = (mode: Mode, value: number) => onChange({ ...config, surfaces: { ...config.surfaces, step: { light: surfaceStep(config, 'light'), dark: surfaceStep(config, 'dark'), [mode]: value } } });
  const updateDistance = (mode: Mode, value: number) => onChange({ ...config, muted: { ...config.muted, distance: { light: mutedDistance(config, 'light'), dark: mutedDistance(config, 'dark'), [mode]: value } } });
  const updateChroma = (mode: Mode, value: number) => onChange({ ...config, muted: { ...config.muted, chromaScale: { light: mutedChromaScale(config, 'light'), dark: mutedChromaScale(config, 'dark'), [mode]: value / 100 } } });
</script>

<aside id="settings-panel" class="controls settings-sidebar" class:settings-open={settingsOpen} role={settingsOpen ? 'dialog' : undefined} aria-modal={settingsOpen ? 'true' : undefined} aria-label="Color system configuration" onkeydown={onKeydown}>
  <div class="controls-heading">
    <h2>Adjust colors</h2>
    <div class="controls-heading-actions">
      {#if canUndo}<button class="text-button" onclick={onUndo}>Undo</button>{/if}
      <button class="text-button" onclick={onReset} title="Restore the default configuration">Reset</button>
      <button class="settings-close" type="button" onclick={onClose}>Close settings</button>
    </div>
  </div>
  <p class="help control-check-status" role="status">{checking ? 'Checking contrast…' : 'Contrast checks pass.'}</p>

  <details class="control-section sidebar-section" aria-labelledby="structure-heading">
    <summary class="section-heading"><h3 id="structure-heading">Surface structure</h3></summary>
    <p class="help">Add colors for selected buttons and items.</p>
    <fieldset class="surface-count"><legend>Surface count</legend>
      <div class="segmented" aria-label="Surface count">
        {#each [1, 2, 3, 4, 5, 6] as count}<button aria-pressed={config.surfaces.levels === count} aria-label={`${count} ${count === 1 ? 'surface' : 'surfaces'}`} onclick={() => onChange({ ...config, surfaces: { ...config.surfaces, levels: count } })}>{count}</button>{/each}
      </div>
    </fieldset>
    <p class="help">{config.surfaces.levels} {config.surfaces.levels === 1 ? 'surface: base only' : `surfaces: base + ${config.surfaces.levels - 1} ${config.surfaces.levels === 2 ? 'level' : 'levels'}`}.</p>
    <span class="adjustment-note" class:reserved-feedback={!adjusted.includes('surfaces.levels')} aria-hidden={!adjusted.includes('surfaces.levels')}>Surface count automatically adjusted for contrast</span>
    <label class="checkbox-row"><input type="checkbox" checked={config.emphasis.selected} oninput={async event => { const input = event.currentTarget; await onChange({ ...config, emphasis: { ...config.emphasis, selected: input.checked } }); await tick(); input.checked = config.emphasis.selected; }} />Include selected state</label>
  </details>

  <details class="control-section sidebar-section" aria-labelledby="families-heading" open>
    <summary class="section-heading"><h3 id="families-heading">Color adjustments</h3></summary>
    <div class="family-adjustments">
      {#each config.families as family (family.id)}
        <details class="sidebar-group family-group" open={family.id === 'brand'} style={`--family-color: oklch(.62 ${family.chroma} ${family.hue})`}>
          <summary><span class="family-color-swatch" aria-hidden="true" style={`--swatch-color: oklch(.62 ${family.chroma} ${family.hue})`}></span>{family.label}</summary>
          {#if family.id !== 'neutral'}<p class="help">Chroma controls intensity. Lightness adjusts to meet contrast requirements.</p>{/if}
          <Slider label={`${family.label} hue`} min={0} max={360} step={1} unit="°" value={family.hue} adjusted={adjusted.includes(`families.${family.id}.hue`)} rangeClass="hue-range" onChange={value => updateFamily(family.id, { hue: value })} />
          <Slider label={`${family.label} chroma`} min={0} max={0.3} value={family.chroma} adjusted={adjusted.includes(`families.${family.id}.chroma`)} rangeClass="chroma-range" rangeStyle={`--family-color: oklch(.62 ${family.chroma} ${family.hue})`} onChange={value => updateFamily(family.id, { chroma: value })} />
          {#if family.id === 'brand'}<details class="advanced-controls"><summary>Lock a brand color</summary><BrandAnchors brand={family} anchors={config.anchors} onChange={anchors => onChange({ ...config, anchors })} /></details>{/if}
          {#if family.id === 'neutral'}<details class="advanced-controls"><summary>Neutral color limits</summary><p class="help">Exact color locks and related states keep their own colors. Pure white and black have no tint. Chroma is reduced when needed to fit the sRGB color range.</p></details>{/if}
        </details>
      {/each}
    </div>
  </details>

  <details class="control-section sidebar-section" aria-labelledby="surface-heading">
    <summary class="section-heading"><h3 id="surface-heading">Surface appearance</h3></summary>
    {#each ['light', 'dark'] as const as theme}
      <fieldset class="theme-controls"><legend>{theme === 'light' ? 'Light theme' : 'Dark theme'}</legend>
        <p class="help">{theme === 'light' ? 'Each added level is darker than the previous one.' : 'Each added level is lighter than the previous one.'}</p>
        <Slider label="Base lightness" min={0} max={1} value={config.surfaces[theme].l} adjusted={adjusted.includes(`surfaces.${theme}.l`)} rangeClass="lightness-range" onChange={l => onChange({ ...config, surfaces: { ...config.surfaces, [theme]: { l } } })} />
        <Slider label="Level spacing" min={0.001} max={0.2} step={0.001} value={surfaceStep(config, theme)} adjusted={adjusted.includes(`surfaces.${theme}.step`)} rangeClass="surface-step-range" onChange={value => updateStep(theme, value)} />
      </fieldset>
    {/each}
  </details>

  <details class="control-section sidebar-section" aria-labelledby="muted-heading">
    <summary class="section-heading"><h3 id="muted-heading">Muted fills</h3></summary>
    <p class="help">Muted chroma controls color intensity for colored families. Neutral colors use Neutral chroma.</p>
    {#each ['light', 'dark'] as const as theme}
      <fieldset class="theme-controls"><legend>{theme === 'light' ? 'Light theme' : 'Dark theme'}</legend>
        <p class="help">{theme === 'light' ? 'Higher values make muted fills darker.' : 'Higher values make muted fills lighter.'}</p>
        <Slider label="Muted distance" min={-0.08} max={theme === 'dark' ? 0.5 : 0.16} step={0.005} value={mutedDistance(config, theme)} adjusted={adjusted.includes(`muted.${theme}.distance`)} rangeClass={`muted-distance-range ${theme}-theme-range`} onChange={value => updateDistance(theme, value)} />
        <Slider label="Muted chroma" min={0} max={200} step={1} unit="%" value={mutedChromaScale(config, theme) * 100} adjusted={adjusted.includes(`muted.${theme}.chroma`)} rangeClass="muted-chroma-range" rangeStyle={paletteTrackStyle(config.families)} onChange={value => updateChroma(theme, value)} />
      </fieldset>
    {/each}
    <details class="advanced-controls"><summary>Muted color limits</summary><p class="help">100% uses the family chroma; 0% removes color. Higher values add color where the sRGB range allows it. Muted borders are decorative; their text is checked for contrast.</p></details>
  </details>

  <details class="control-section sidebar-section" aria-labelledby="states-heading">
    <summary class="section-heading"><h3 id="states-heading">Interaction states</h3></summary>
    <p class="help">Controls how much colors change on hover, press, and selection in both themes.</p>
    <Slider label="Muted state spacing" min={0.005} max={0.07} step={0.005} value={config.muted.separation} adjusted={adjusted.includes('muted.separation')} rangeClass="state-spacing-range" rangeStyle={paletteTrackStyle(config.families)} onChange={separation => onChange({ ...config, muted: { ...config.muted, separation } })} />
    <Slider label="Emphasis state spacing" min={0.01} max={0.1} step={0.005} value={config.emphasis.separation} adjusted={adjusted.includes('emphasis.separation')} rangeClass="state-spacing-range" rangeStyle={paletteTrackStyle(config.families)} onChange={separation => onChange({ ...config, emphasis: { ...config.emphasis, separation } })} />
    <details class="advanced-controls"><summary>Emphasis across themes</summary>
      <div class="strategy-options" aria-label="Emphasis across themes">
        <button aria-pressed={(config.emphasis.strategy ?? 'shared') === 'shared'} onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'shared' } })}>Same colors</button>
        <button aria-pressed={config.emphasis.strategy === 'adaptive'} onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'adaptive' } })}>Different colors</button>
      </div>
      <p class="help">Use the same emphasis fills and text in both themes, or let each theme use its own colors.</p>
    </details>
  </details>

  <details class="control-section sidebar-section protection-section">
    <summary class="section-heading"><h3>Contrast protection</h3></summary>
    <p class="help">Settings adjust automatically to keep contrast checks passing. Locked colors stay fixed; changes that cannot pass are limited or rejected.</p>
    <dl class="contrast-requirements">
      {#each [['normalText', 'Normal text'], ['largeText', 'Large text'], ['ui', 'Emphasis borders']] as const as [key, label]}
        <div class="target-row"><dt>{label}</dt><dd>{config.targets[key]}:1</dd></div>
      {/each}
    </dl>
  </details>
</aside>
