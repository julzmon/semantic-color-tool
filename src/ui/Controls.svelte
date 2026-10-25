<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import Slider from './Slider.svelte';
  import { controlDescriptor, setControlValue, type ControlAvailabilityView } from './controlAvailability';
  import { createControlAvailabilityClient } from './controlAvailability-client';
  import { MAX_MUTED_BORDER_STRENGTH, mutedBorderStrength, mutedChromaScale, mutedDistance, surfaceStep } from '../engine/config';
  import type { BuilderConfig, FamilyId, GeneratedSystem, Mode } from '../engine/types';
  import { familyControlColor, familyTrackStyle, mutedBorderTrackStyle, mutedTrackStyle, mutedStateTrackStyle, stateTrackStyle, surfaceTrackStyle } from './controlTracks';
  import BrandAnchors from './BrandAnchors.svelte';
  import { applyBrandAnchors } from './brandAnchor';
  import { legacyMutedWeights } from '../engine/muted';
  import { emphasisStrengthLimit, mutedStrengthLimit } from '../engine/emphasis-limits';
  import { emphasisStates, legacyEmphasisWeights } from '../engine/emphasis';
  let { config, system, adjusted = [], checking = false, canUndo = false, settingsOpen = false, onCompactChange, onKeydown, onClose, onChange, onReset, onUndo }: {
    config: BuilderConfig; system: GeneratedSystem; adjusted?: string[]; checking?: boolean; canUndo?: boolean; settingsOpen?: boolean;
    onCompactChange?: (compact: boolean) => void;
    onKeydown: (event: KeyboardEvent) => void; onClose: () => void;
    onChange: (config: BuilderConfig) => Promise<boolean | undefined>; onReset: () => void; onUndo: () => void;
  } = $props();
  let activeControl = $state('');
  let compact = $state(false);
  const modal = $derived(compact && settingsOpen);
  onMount(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => { compact = media.matches; onCompactChange?.(compact); };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
  let availability = $state.raw<ControlAvailabilityView | undefined>();
  let probeClient: ReturnType<typeof createControlAvailabilityClient> | undefined;
  let probeRevision = 0;
  let completedConfig: BuilderConfig | undefined;
  let completedReport: ControlAvailabilityView | undefined;
  const activate = (key: string) => {
    if (!probeClient) {
      try { probeClient = createControlAvailabilityClient(new Worker(new URL('./controlAvailability.worker.ts', import.meta.url), { type: 'module' })); }
      catch { availability = { descriptor: controlDescriptor(system.config, key), status: 'error', samples: [], error: 'Safe-value checking is unavailable. Edits still use contrast protection.' }; }
    }
    activeControl = key;
  };
  onDestroy(() => probeClient?.dispose());
  $effect(() => {
    const current = system.config;
    const key = activeControl;
    const busy = checking;
    const visible = !compact || settingsOpen;
    const revision = ++probeRevision;
    const hiddenBrandControl = key.startsWith('families.brand.') && config.anchors.find(anchor => anchor.family === 'brand')?.locked;
    if (!key || !visible || hiddenBrandControl) { probeClient?.cancel(); availability = undefined; return; }
    if (!probeClient) return;
    const descriptor = controlDescriptor(current, key);
    const retained = completedConfig === current && completedReport?.descriptor.key === key ? completedReport : undefined;
    availability = retained ? { ...retained, status: 'checking', retained: true } : { descriptor, status: 'checking', samples: [] };
    if (busy) { probeClient.cancel(); return; }
    void probeClient.probe(current, key).then(result => {
      if (revision === probeRevision && result) {
        completedConfig = current;
        completedReport = { descriptor, status: 'ready', samples: result.samples };
        availability = completedReport;
      }
    }).catch(error => {
      if (revision === probeRevision) availability = { descriptor, status: 'error', samples: [], error: error instanceof Error ? error.message : 'Unable to check safe values.' };
    });
    return () => { probeRevision++; probeClient?.cancel(); };
  });
  const liveControl = (key: string) => ({
    pending: checking,
    onActivate: () => activate(key),
    availability: activeControl === key ? availability : undefined,
  });
  const unavailableOption = (key: string, value: number) => {
    if (activeControl !== key || !availability || (availability.status !== 'ready' && !availability.retained)) return false;
    const sample = availability.samples.find(item => item.value === value);
    return !!sample && (!sample.safe || (sample.acceptedValue ?? sample.value) !== value);
  };
  const mutedCeiling = $derived(Number((mutedStrengthLimit(system) * 100).toFixed(3)));
  const mutedWeights = $derived(config.muted.mixWeights ?? legacyMutedWeights(config.muted.separation));
  const emphasisCeiling = $derived(Number((emphasisStrengthLimit(system) * 100).toFixed(3)));
  const strengthLabels = { hover: 'Hover', active: 'Pressed', selected: 'Selected' };
  let weights = $derived(config.emphasis.mixWeights ?? legacyEmphasisWeights(config.emphasis.separation));
  const updateMutedStrength = (state: keyof typeof mutedWeights, strength: number) => onChange(setControlValue(config, `muted.${state}`, strength));
  const updateStrength = (state: keyof typeof weights, strength: number) => onChange(setControlValue(config, `emphasis.${state}`, strength));
  const updateFamily = (id: FamilyId, patch: { hue?: number; chroma?: number }) => onChange(setControlValue(config,
    `families.${id}.${patch.hue !== undefined ? 'hue' : 'chroma'}`, patch.hue ?? patch.chroma!));
  const updateBrandAnchors = (anchors: BuilderConfig['anchors']) => onChange(applyBrandAnchors(config, anchors));
  const updateStep = (mode: Mode, value: number) => onChange(setControlValue(config, `surfaces.${mode}.step`, value));
  const updateDistance = (mode: Mode, value: number) => onChange(setControlValue(config, `muted.${mode}.distance`, value));
  const updateChroma = (mode: Mode, value: number) => onChange(setControlValue(config, `muted.${mode}.chroma`, value));
  const updateBorder = (mode: Mode, value: number) => onChange(setControlValue(config, `muted.${mode}.border`, value));

</script>

<aside id="settings-panel" class="controls settings-sidebar" class:settings-open={settingsOpen} role={modal ? 'dialog' : undefined} aria-modal={modal ? 'true' : undefined} aria-label="Color system configuration" onkeydown={event => { if (modal) onKeydown(event); }}>
  <div class="controls-heading">
    <h2>Adjust colors</h2>
    <div class="controls-heading-actions">
      {#if canUndo}<button class="text-button" onclick={onUndo}>Undo</button>{/if}
      <button class="text-button" onclick={onReset} title="Restore the default configuration">Reset</button>
      <button class="settings-close" type="button" onclick={onClose}>Close settings</button>
    </div>
  </div>
  <p class="help live-controls-help">Each slider spans its currently available range. Edits check live and rebalance related settings to preserve contrast.</p>

  <section class="control-section sidebar-section" aria-labelledby="structure-heading">
    <header class="section-heading"><h3 id="structure-heading">Setup</h3></header>
    <p class="help">Choose your brand color and the structure of your color system. Chroma controls intensity; lightness adjusts to meet contrast requirements.</p>
    <div class="family-adjustments">
      {#each config.families.filter(family => family.id === 'brand') as family (family.id)}
        <div class="sidebar-group family-group">
          <BrandAnchors brand={family} anchors={config.anchors} color={system.modes.light.families.brand.roles['emphasis.base']!.color.css} onChange={updateBrandAnchors}>
          <Slider {...liveControl(`families.${family.id}.hue`)} label={`${family.label} hue`} min={0} max={360} step={1} unit="°" value={family.hue} adjusted={adjusted.includes(`families.${family.id}.hue`)} rangeClass="hue-range" rangeStyle={(min, max) => familyTrackStyle(family, 'hue', { min, max })} onChange={value => updateFamily(family.id, { hue: value })} />
          <Slider {...liveControl(`families.${family.id}.chroma`)} label={`${family.label} chroma`} min={0} max={Math.max(0.3, family.chroma)} value={family.chroma} adjusted={adjusted.includes(`families.${family.id}.chroma`)} rangeClass="chroma-range" rangeStyle={(min, max) => familyTrackStyle(family, 'chroma', { min, max })} onChange={value => updateFamily(family.id, { chroma: value })} />
          </BrandAnchors>
        </div>
      {/each}
    </div>
    <p class="help">Choose how many surface levels to generate. Optionally add colors for selected buttons and items.</p>
    <fieldset class="surface-count"><legend>Surface count</legend>
      <div class="segmented" aria-label="Surface count">
        {#each [1, 2, 3, 4, 5, 6] as count}<button disabled={unavailableOption('surfaces.levels', count)} title={unavailableOption('surfaces.levels', count) ? 'Unavailable with current contrast settings' : undefined} aria-pressed={config.surfaces.levels === count} aria-label={`${count} ${count === 1 ? 'surface' : 'surfaces'}`} onfocus={() => activate('surfaces.levels')} onclick={() => onChange(setControlValue(config, 'surfaces.levels', count))}>{count}</button>{/each}
      </div>
    </fieldset>
    <p class="help">{config.surfaces.levels} {config.surfaces.levels === 1 ? 'surface: base only' : `surfaces: base + ${config.surfaces.levels - 1} ${config.surfaces.levels === 2 ? 'level' : 'levels'}`}.</p>
    <label class="checkbox-row"><input type="checkbox" disabled={unavailableOption('emphasis.includeSelected', Number(!config.emphasis.selected))} title={unavailableOption('emphasis.includeSelected', Number(!config.emphasis.selected)) ? 'Unavailable with current contrast settings' : undefined} onfocus={() => activate('emphasis.includeSelected')} checked={config.emphasis.selected} oninput={async event => { const input = event.currentTarget; await onChange(setControlValue(config, 'emphasis.includeSelected', Number(input.checked))); await tick(); input.checked = config.emphasis.selected; }} />Include selected state</label>
  </section>



  <section class="control-section sidebar-section" aria-labelledby="surface-heading">
    <header class="section-heading"><h3 id="surface-heading">Surface appearance</h3></header>
    {#each ['light', 'dark'] as const as theme}
      <fieldset class="theme-controls"><legend>{theme === 'light' ? 'Light theme' : 'Dark theme'}</legend>
        <p class="help">{theme === 'light' ? 'Each added level is darker than the previous one.' : 'Each added level is lighter than the previous one.'}</p>
        <Slider {...liveControl(`surfaces.${theme}.l`)} label="Base lightness" min={0} max={1} value={config.surfaces[theme].l} adjusted={adjusted.includes(`surfaces.${theme}.l`)} rangeClass="lightness-range" rangeStyle={(min, max) => surfaceTrackStyle(config, theme, 'lightness', { min, max })} onChange={l => onChange(setControlValue(config, `surfaces.${theme}.l`, l))} />
        <Slider {...liveControl(`surfaces.${theme}.step`)} label="Level spacing" min={0.001} max={0.2} step={0.001} value={surfaceStep(config, theme)} adjusted={adjusted.includes(`surfaces.${theme}.step`)} rangeClass="surface-step-range" rangeStyle={(min, max) => surfaceTrackStyle(config, theme, 'spacing', { min, max })} onChange={value => updateStep(theme, value)} />
      </fieldset>
    {/each}
    <p class="help">Level spacing tracks preview the deepest surface at the current surface count.</p>
  </section>

  <section class="control-section sidebar-section" aria-labelledby="muted-heading">
    <header class="section-heading"><h3 id="muted-heading">Muted fills</h3></header>
    <p class="help">Muted chroma controls color intensity for colored families. Neutral colors use Neutral chroma.</p>
    {#each ['light', 'dark'] as const as theme}
      <fieldset class="theme-controls"><legend>{theme === 'light' ? 'Light theme' : 'Dark theme'}</legend>
        <p class="help">{theme === 'light' ? 'Higher values make muted fills darker.' : 'Higher values make muted fills lighter.'}</p>
        <Slider {...liveControl(`muted.${theme}.distance`)} label="Muted distance" min={-0.08} max={theme === 'dark' ? 0.5 : 0.16} step={0.005} value={mutedDistance(config, theme)} adjusted={adjusted.includes(`muted.${theme}.distance`)} rangeClass="muted-distance-range" rangeStyle={(min, max) => mutedTrackStyle(config, theme, 'distance', { min, max })} onChange={value => updateDistance(theme, value)} />
        <Slider {...liveControl(`muted.${theme}.chroma`)} label="Muted chroma" min={0} max={200} step={1} unit="%" value={mutedChromaScale(config, theme) * 100} adjusted={adjusted.includes(`muted.${theme}.chroma`)} rangeClass="muted-chroma-range" rangeStyle={(min, max) => mutedTrackStyle(config, theme, 'chroma', { min, max })} onChange={value => updateChroma(theme, value)} />
        <Slider {...liveControl(`muted.${theme}.border`)} label="Muted border strength" min={0} max={100} step={1} unit="%" value={mutedBorderStrength(config, theme) / MAX_MUTED_BORDER_STRENGTH * 100} adjusted={adjusted.includes(`muted.${theme}.border`)} rangeStyle={(min, max) => mutedBorderTrackStyle(config, theme, { min, max })} onChange={value => updateBorder(theme, value)} />
        <p class="help">Subtle → Strong. {theme === 'light' ? 'Stronger borders are darker.' : 'Stronger borders are lighter.'} Fills and text stay the same.</p>
      </fieldset>
    {/each}
    <p class="help">Tracks preview Brand muted fills and borders in each theme.</p>
    <div class="advanced-controls"><strong>Muted color limits</strong><p class="help">100% uses the family chroma; 0% removes color. Higher values add color where the sRGB range allows it. Muted borders are decorative; their text is checked for contrast.</p></div>
  </section>

  <section class="control-section sidebar-section" aria-labelledby="states-heading">
    <header class="section-heading"><h3 id="states-heading">Interaction states</h3></header>
    <p class="help">Controls how much colors change on hover, press, and selection in both themes.</p>
    <p class="help">Tracks show Brand colors: light theme above, dark below. Emphasis strengths mix each family’s base with black, or white for reversed dark states. Higher percentages make a stronger change.</p>
    <h4>Muted</h4>
    <p class="help">Strength changes the default muted fill: darker in light mode, lighter in dark mode. Muted distance positions the default fill.</p>
    {#each emphasisStates.filter(state => state !== 'selected' || config.emphasis.selected) as state}
      <Slider {...liveControl(`muted.${state}`)} ceiling={mutedCeiling} limitReason="State changes stay within 0.12 OKLCH lightness and 25% mix strength across all families and both themes." label={`${strengthLabels[state]} muted strength`} min={0} max={100} step={0.1} unit="%" value={Number(((1 - mutedWeights[state]) * 100).toFixed(6))} adjusted={adjusted.includes(`muted.${state}`)} rangeClass="state-spacing-range" rangeStyle={(min,max) => mutedStateTrackStyle(system, { min,max })} onChange={value => updateMutedStrength(state,value)} />
    {/each}
    <h4>Emphasis</h4>
    {#each emphasisStates.filter(state => state !== 'selected' || config.emphasis.selected) as state}
      <Slider {...liveControl(`emphasis.${state}`)} ceiling={emphasisCeiling} limitReason="State changes stay within 0.12 OKLCH lightness and 25% mix strength across all families and both themes." label={`${strengthLabels[state]} emphasis strength`} min={0} max={100} step={0.1} unit="%" value={Number(((1 - weights[state]) * 100).toFixed(6))} adjusted={adjusted.includes(`emphasis.${state}`)} rangeClass="state-spacing-range" rangeStyle={(min, max) => stateTrackStyle({ ...config, emphasis: { ...config.emphasis, mixWeights: weights } }, system, 'emphasis', { min, max })} onChange={value => updateStrength(state, value)} />
    {/each}
    <p class="help">Within each group, strengths are shared across all color families. Hover stays weaker than pressed and selected; neighboring strengths move together if needed. State changes stay within 0.12 OKLCH lightness and 25% mix strength. The most restrictive family or theme sets the shared limit; contrast checks can limit it further.</p>
    <fieldset class="emphasis-state-options">
      <legend>Emphasis states in dark mode</legend>
      <div class="strategy-options">
        <button type="button" aria-pressed={!config.emphasis.reverseDarkStates} onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'shared', reverseDarkStates: false } })}>Match light mode</button>
        <button type="button" aria-pressed={config.emphasis.reverseDarkStates ?? false} onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'shared', reverseDarkStates: true } })}>Reverse direction</button>
      </div>
      <p class="help">Match uses identical colors for every state. Reverse makes dark hover, pressed, and selected fills lighter. Both themes share the default emphasis fill. Changing direction may adjust that fill in both themes to preserve text contrast.</p>
    </fieldset>
  </section>

  <section class="control-section sidebar-section" aria-labelledby="families-heading">
    <header class="section-heading"><h3 id="families-heading">Color adjustments</h3></header>
    <p class="help">Chroma controls intensity. Lightness adjusts to meet contrast requirements.</p>
    <div class="family-adjustments">
      {#each config.families.filter(family => family.id !== 'brand') as family (family.id)}
        <div class="sidebar-group family-group">
          <h4 class="family-heading"><span class="family-color-swatch" aria-hidden="true" style={`--swatch-color: ${familyControlColor(family)}`}></span>{family.label}</h4>
          <Slider {...liveControl(`families.${family.id}.hue`)} label={`${family.label} hue`} min={0} max={360} step={1} unit="°" value={family.hue} adjusted={adjusted.includes(`families.${family.id}.hue`)} rangeClass="hue-range" rangeStyle={(min, max) => familyTrackStyle(family, 'hue', { min, max })} onChange={value => updateFamily(family.id, { hue: value })} />
          <Slider {...liveControl(`families.${family.id}.chroma`)} label={`${family.label} chroma`} min={0} max={0.3} value={family.chroma} adjusted={adjusted.includes(`families.${family.id}.chroma`)} rangeClass="chroma-range" rangeStyle={(min, max) => familyTrackStyle(family, 'chroma', { min, max })} onChange={value => updateFamily(family.id, { chroma: value })} />
          {#if family.id === 'neutral'}<div class="advanced-controls"><strong>Neutral color limits</strong><p class="help">Exact color locks and related states keep their own colors. Pure white and black have no tint. Chroma is reduced when needed to fit the sRGB color range.</p></div>{/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="control-section sidebar-section protection-section">
    <header class="section-heading"><h3>Contrast protection</h3></header>
    <p class="help">Settings adjust automatically to keep contrast checks passing. Locked colors stay fixed; changes that cannot pass are limited or rejected.</p>
    <p class="help">Corresponding roles share lightness across all color families. Hue and chroma provide color differences. Reuse preserves this structure.</p>
    <dl class="contrast-requirements">
      {#each [['normalText', 'Normal text'], ['largeText', 'Large text'], ['ui', 'Emphasis borders']] as const as [key, label]}
        <div class="target-row"><dt>{label}</dt><dd>{config.targets[key]}:1</dd></div>
      {/each}
    </dl>
  </section>
</aside>
