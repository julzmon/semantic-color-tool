<script lang="ts">
  import { tick } from 'svelte';
  import Slider from './Slider.svelte';
  import { MAX_MUTED_BORDER_STRENGTH, mutedBorderStrength, mutedChromaScale, mutedDistance, surfaceStep } from '../engine/config';
  import type { BuilderConfig, FamilyId, GeneratedSystem, Mode } from '../engine/types';
  import { familyControlColor, familyTrackStyle, mutedBorderTrackStyle, mutedTrackStyle, stateTrackStyle, surfaceTrackStyle } from './controlTracks';
  import BrandAnchors from './BrandAnchors.svelte';
  import { emphasisStates, legacyEmphasisWeights } from '../engine/emphasis';
  import { setEmphasisWeight } from './controlValues';
  let { config, system, adjusted = [], checking = false, canUndo = false, settingsOpen = false, onKeydown, onClose, onChange, onReset, onUndo }: {
    config: BuilderConfig; system: GeneratedSystem; adjusted?: string[]; checking?: boolean; canUndo?: boolean; settingsOpen?: boolean;
    onKeydown: (event: KeyboardEvent) => void; onClose: () => void;
    onChange: (config: BuilderConfig) => Promise<boolean | undefined>; onReset: () => void; onUndo: () => void;
  } = $props();
  const strengthLabels = { hover: 'Hover', active: 'Pressed', selected: 'Selected' };
  let weights = $derived(config.emphasis.mixWeights ?? legacyEmphasisWeights(config.emphasis.separation));
  const updateStrength = (state: keyof typeof weights, strength: number) => onChange({ ...config,
    emphasis: { ...config.emphasis, mixWeights: setEmphasisWeight(weights, state, Number((1 - strength / 100).toFixed(6))) },
  });
  const updateFamily = (id: FamilyId, patch: { hue?: number; chroma?: number }) => onChange({ ...config, families: config.families.map(item => item.id === id ? { ...item, ...patch } : item) });
  const updateStep = (mode: Mode, value: number) => onChange({ ...config, surfaces: { ...config.surfaces, step: { light: surfaceStep(config, 'light'), dark: surfaceStep(config, 'dark'), [mode]: value } } });
  const updateDistance = (mode: Mode, value: number) => onChange({ ...config, muted: { ...config.muted, distance: { light: mutedDistance(config, 'light'), dark: mutedDistance(config, 'dark'), [mode]: value } } });
  const updateChroma = (mode: Mode, value: number) => onChange({ ...config, muted: { ...config.muted, chromaScale: { light: mutedChromaScale(config, 'light'), dark: mutedChromaScale(config, 'dark'), [mode]: value / 100 } } });
  const updateBorder = (mode: Mode, value: number) => onChange({ ...config, muted: { ...config.muted, borderStrength: {
    light: mutedBorderStrength(config, 'light'), dark: mutedBorderStrength(config, 'dark'), [mode]: Number((value / 100 * MAX_MUTED_BORDER_STRENGTH).toFixed(6)),
  } } });
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
    <p class="help">Chroma controls intensity. Lightness adjusts to meet contrast requirements.</p>
    <div class="family-adjustments">
      {#each config.families as family (family.id)}
        <div class="sidebar-group family-group">
          <h4 class="family-heading"><span class="family-color-swatch" aria-hidden="true" style={`--swatch-color: ${familyControlColor(family)}`}></span>{family.label}</h4>
          <Slider label={`${family.label} hue`} min={0} max={360} step={1} unit="°" value={family.hue} adjusted={adjusted.includes(`families.${family.id}.hue`)} rangeClass="hue-range" rangeStyle={familyTrackStyle(family, 'hue')} onChange={value => updateFamily(family.id, { hue: value })} />
          <Slider label={`${family.label} chroma`} min={0} max={0.3} value={family.chroma} adjusted={adjusted.includes(`families.${family.id}.chroma`)} rangeClass="chroma-range" rangeStyle={familyTrackStyle(family, 'chroma')} onChange={value => updateFamily(family.id, { chroma: value })} />
          {#if family.id === 'brand'}<div class="advanced-controls"><BrandAnchors brand={family} anchors={config.anchors} onChange={anchors => onChange({ ...config, anchors })} /></div>{/if}
          {#if family.id === 'neutral'}<div class="advanced-controls"><strong>Neutral color limits</strong><p class="help">Exact color locks and related states keep their own colors. Pure white and black have no tint. Chroma is reduced when needed to fit the sRGB color range.</p></div>{/if}
        </div>
      {/each}
    </div>
  </details>

  <details class="control-section sidebar-section" aria-labelledby="surface-heading">
    <summary class="section-heading"><h3 id="surface-heading">Surface appearance</h3></summary>
    {#each ['light', 'dark'] as const as theme}
      <fieldset class="theme-controls"><legend>{theme === 'light' ? 'Light theme' : 'Dark theme'}</legend>
        <p class="help">{theme === 'light' ? 'Each added level is darker than the previous one.' : 'Each added level is lighter than the previous one.'}</p>
        <Slider label="Base lightness" min={0} max={1} value={config.surfaces[theme].l} adjusted={adjusted.includes(`surfaces.${theme}.l`)} rangeClass="lightness-range" rangeStyle={surfaceTrackStyle(config, theme, 'lightness')} onChange={l => onChange({ ...config, surfaces: { ...config.surfaces, [theme]: { l } } })} />
        <Slider label="Level spacing" min={0.001} max={0.2} step={0.001} value={surfaceStep(config, theme)} adjusted={adjusted.includes(`surfaces.${theme}.step`)} rangeClass="surface-step-range" rangeStyle={surfaceTrackStyle(config, theme, 'spacing')} onChange={value => updateStep(theme, value)} />
      </fieldset>
    {/each}
    <p class="help">Level spacing tracks preview the deepest surface at the current surface count.</p>
  </details>

  <details class="control-section sidebar-section" aria-labelledby="muted-heading">
    <summary class="section-heading"><h3 id="muted-heading">Muted fills</h3></summary>
    <p class="help">Muted chroma controls color intensity for colored families. Neutral colors use Neutral chroma.</p>
    {#each ['light', 'dark'] as const as theme}
      <fieldset class="theme-controls"><legend>{theme === 'light' ? 'Light theme' : 'Dark theme'}</legend>
        <p class="help">{theme === 'light' ? 'Higher values make muted fills darker.' : 'Higher values make muted fills lighter.'}</p>
        <Slider label="Muted distance" min={-0.08} max={theme === 'dark' ? 0.5 : 0.16} step={0.005} value={mutedDistance(config, theme)} adjusted={adjusted.includes(`muted.${theme}.distance`)} rangeClass="muted-distance-range" rangeStyle={mutedTrackStyle(config, theme, 'distance')} onChange={value => updateDistance(theme, value)} />
        <Slider label="Muted chroma" min={0} max={200} step={1} unit="%" value={mutedChromaScale(config, theme) * 100} adjusted={adjusted.includes(`muted.${theme}.chroma`)} rangeClass="muted-chroma-range" rangeStyle={mutedTrackStyle(config, theme, 'chroma')} onChange={value => updateChroma(theme, value)} />
        <Slider label="Muted border strength" min={0} max={100} step={1} unit="%" value={mutedBorderStrength(config, theme) / MAX_MUTED_BORDER_STRENGTH * 100} adjusted={adjusted.includes(`muted.${theme}.border`)} rangeStyle={mutedBorderTrackStyle(config, theme)} onChange={value => updateBorder(theme, value)} />
        <p class="help">Subtle → Strong. {theme === 'light' ? 'Stronger borders are darker.' : 'Stronger borders are lighter.'} Fills and text stay the same.</p>
      </fieldset>
    {/each}
    <p class="help">Tracks preview Brand muted fills and borders in each theme.</p>
    <div class="advanced-controls"><strong>Muted color limits</strong><p class="help">100% uses the family chroma; 0% removes color. Higher values add color where the sRGB range allows it. Muted borders are decorative; their text is checked for contrast.</p></div>
  </details>

  <details class="control-section sidebar-section" aria-labelledby="states-heading">
    <summary class="section-heading"><h3 id="states-heading">Interaction states</h3></summary>
    <p class="help">Controls how much colors change on hover, press, and selection in both themes.</p>
    <p class="help">Tracks show Brand colors: light theme above, dark below. Emphasis strengths mix each family’s base with black, or white for reversed dark states. Higher percentages make a stronger change.</p>
    <Slider label="Muted state spacing" min={0.005} max={0.07} step={0.005} value={config.muted.separation} adjusted={adjusted.includes('muted.separation')} rangeClass="state-spacing-range" rangeStyle={stateTrackStyle(config, system, 'muted')} onChange={separation => onChange({ ...config, muted: { ...config.muted, separation } })} />
    {#each emphasisStates.filter(state => state !== 'selected' || config.emphasis.selected) as state}
      <Slider label={`${strengthLabels[state]} emphasis strength`} min={0} max={100} step={1} unit="%" value={Number(((1 - weights[state]) * 100).toFixed(6))} adjusted={adjusted.includes(`emphasis.${state}`)} rangeClass="state-spacing-range" rangeStyle={stateTrackStyle({ ...config, emphasis: { ...config.emphasis, mixWeights: weights } }, system, 'emphasis')} onChange={value => updateStrength(state, value)} />
    {/each}
    <p class="help">Shared across all color families. Hover stays weaker than pressed and selected; neighboring strengths move together if needed. Contrast protection may limit a strength or adjust the base colors.</p>
    <fieldset class="emphasis-state-options">
      <legend>Emphasis states in dark mode</legend>
      <div class="strategy-options">
        <button type="button" aria-pressed={!config.emphasis.reverseDarkStates} onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'shared', reverseDarkStates: false } })}>Match light mode</button>
        <button type="button" aria-pressed={config.emphasis.reverseDarkStates ?? false} onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'shared', reverseDarkStates: true } })}>Reverse direction</button>
      </div>
      <p class="help">Match uses identical colors for every state. Reverse makes dark hover, pressed, and selected fills lighter. The default emphasis fill stays the same in both themes.</p>
    </fieldset>
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
