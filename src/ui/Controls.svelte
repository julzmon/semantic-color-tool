<script lang="ts">
  import { tick } from 'svelte';
  import Slider from './Slider.svelte';
  import { mutedChromaScale, mutedDistance, surfaceStep } from '../engine/config';
  import type { BuilderConfig, FamilyId, Mode } from '../engine/types';
  import BrandAnchors from './BrandAnchors.svelte';
  let {
    config,
    onChange,
    onReset,
  }: { config: BuilderConfig; onChange: (config: BuilderConfig) => Promise<boolean | undefined>; onReset: () => void } = $props();
  let familyId = $state<FamilyId>('neutral');
  let family = $derived(config.families.find((item) => item.id === familyId)!);
  const updateFamily = (patch: Partial<typeof family>) =>
    onChange({
      ...config,
      families: config.families.map((item) => (item.id === familyId ? { ...item, ...patch } : item)),
    });
  const updateMutedDistance = (mode: Mode, distance: number) =>
    onChange({
      ...config,
      muted: {
        ...config.muted,
        distance: {
          light: mutedDistance(config, 'light'),
          dark: mutedDistance(config, 'dark'),
          [mode]: distance,
        },
      },
    });
</script>

<aside class="controls" aria-label="Color system configuration">
  <div class="controls-heading">
    <div>
      <span class="eyebrow">INPUTS</span>
      <h2>Define the system</h2>
    </div>
    <button class="text-button" onclick={onReset} title="Restore the default configuration">Reset</button>
  </div>
  <section class="control-section">
    <div class="section-heading">
      <span class="section-number">01</span>
      <h3>Token namespace</h3>
    </div>
    <label class="text-input" for="token-prefix"
      >Token prefix<input
        id="token-prefix"
        value={config.prefix}
        oninput={async (event) => {
          const input = event.currentTarget;
          const prefix = input.value.trim().toLowerCase();
          if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(prefix)) {
            input.value = prefix;
            await onChange({ ...config, prefix });
            await tick();
            input.value = config.prefix;
          } else {
            input.value = config.prefix;
          }
        }}
        aria-describedby="token-prefix-help"
      /></label
    >
    <p id="token-prefix-help" class="help">
      Letters, numbers, and hyphens. Exported as <code>--{config.prefix}-*</code>.
    </p>
  </section>
  <section class="control-section">
    <div class="section-heading">
      <span class="section-number">02</span>
      <h3>Surfaces</h3>
      <span class="mini-tag">Neutral</span>
    </div>
    <p class="help">
      Surfaces use the gray palette. Adjust their lightness here; Neutral hue and chroma below affect every
      gray role.
    </p>
    <Slider
      label="Light base lightness"
      min={0}
      max={1}
      value={config.surfaces.light.l}
      onChange={(l) => onChange({ ...config, surfaces: { ...config.surfaces, light: { l } } })}
    />
    <Slider
      label="Dark base lightness"
      min={0}
      max={1}
      value={config.surfaces.dark.l}
      onChange={(l) => onChange({ ...config, surfaces: { ...config.surfaces, dark: { l } } })}
    />
    <Slider
      label="Surface levels · includes base"
      min={1}
      max={6}
      step={1}
      value={config.surfaces.levels}
      onChange={(levels) => onChange({ ...config, surfaces: { ...config.surfaces, levels } })}
    />
    {#each ['light', 'dark'] as const as mode}<Slider
        label={mode === 'light' ? 'Light tonal step' : 'Dark tonal step'}
        min={0.001}
        max={0.2}
        step={0.001}
        value={surfaceStep(config, mode)}
        onChange={(value) =>
          onChange({
            ...config,
            surfaces: {
              ...config.surfaces,
              step: { light: surfaceStep(config, 'light'), dark: surfaceStep(config, 'dark'), [mode]: value },
            },
          })}
      />{/each}
    <p class="help">
      Light levels get darker; dark levels get lighter. Set each mode’s spacing independently.
    </p>
  </section>
  <section class="control-section">
    <div class="section-heading">
      <span class="section-number">03</span>
      <h3>Families</h3>
      <span class="mini-tag">{config.families.length} active</span>
    </div>
    <div class="segmented family-switch" aria-label="Edit color family">
      {#each config.families as item}<button
          aria-pressed={item.id === familyId}
          onclick={() => (familyId = item.id)}>{item.label}</button
        >{/each}
    </div>
    <div class="family-origin">
      <span class={`family-dot ${family.id}`}></span>{family.label}<span>← {family.key}</span>
    </div>
    <Slider
      label={`${family.label} hue`}
      min={0}
      max={360}
      step={1}
      unit="°"
      value={family.hue}
      onChange={(hue) => updateFamily({ hue })}
    />
    <Slider
      label={`${family.label} chroma`}
      min={0}
      max={0.3}
      value={family.chroma}
      onChange={(chroma) => updateFamily({ chroma })}
    />
    <p class="help">Lightness is solved from semantic roles. Chroma is reduced where sRGB requires it.</p>
    {#if family.id === 'brand'}<BrandAnchors
        brand={family}
        anchors={config.anchors}
        onChange={(anchors) => onChange({ ...config, anchors })}
      />{/if}
  </section>
  <section class="control-section">
    <div class="section-heading">
      <span class="section-number">03</span>
      <h3>Muted</h3>
    </div>
    {#each ['light', 'dark'] as const as mode}<Slider
        label={mode === 'light' ? 'Light muted distance' : 'Dark muted distance'}
        min={-0.08}
        max={mode === 'dark' ? 0.5 : 0.16}
        step={0.005}
        value={mutedDistance(config, mode)}
        onChange={(distance) => updateMutedDistance(mode, distance)}
      />{/each}
    <p class="help">
      Increasing the dark distance lifts muted semantic fills above the dark surface, which can retain more
      chroma in sRGB. States may shift together by up to 0.01 lightness to reuse an existing gray while
      preserving contrast and state separation.
    </p>
    {#each ['light', 'dark'] as const as mode}
      <Slider
        label={mode === 'light' ? 'Light muted chroma' : 'Dark muted chroma'}
        min={0}
        max={200}
        step={1}
        unit="%"
        value={mutedChromaScale(config, mode) * 100}
        onChange={(percent) =>
          onChange({
            ...config,
            muted: {
              ...config.muted,
              chromaScale: {
                light: mutedChromaScale(config, 'light'),
                dark: mutedChromaScale(config, 'dark'),
                [mode]: percent / 100,
              },
            },
          })}
      />
    {/each}
    <p class="help">
      100% uses each family’s chroma; 0% removes it from muted fills and their borders. Higher values request
      more chroma, limited by sRGB gamut mapping.
    </p>
    <Slider
      label="State separation"
      min={0.005}
      max={0.07}
      step={0.005}
      value={config.muted.separation}
      onChange={(separation) => onChange({ ...config, muted: { ...config.muted, separation } })}
    />
    <p class="help">
      Positive distance moves inward. Muted fills and borders are decorative; their text is validated.
    </p>
  </section>
  <section class="control-section">
    <div class="section-heading">
      <span class="section-number">04</span>
      <h3>Emphasis</h3>
      <span class="mini-tag">Solved</span>
    </div>
    <div class="segmented" aria-label="Emphasis theme strategy">
      <button
        aria-pressed={(config.emphasis.strategy ?? 'shared') === 'shared'}
        onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'shared' } })}
        >Shared across themes</button
      >
      <button
        aria-pressed={config.emphasis.strategy === 'adaptive'}
        onclick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'adaptive' } })}
        >Adaptive by theme</button
      >
    </div>
    <Slider
      label="Emphasis state separation"
      min={0.01}
      max={0.1}
      step={0.005}
      value={config.emphasis.separation}
      onChange={(separation) => onChange({ ...config, emphasis: { ...config.emphasis, separation } })}
    />
    <label class="checkbox-row"
      ><input
        type="checkbox"
        checked={config.emphasis.selected}
        oninput={async (event) => {
          const input = event.currentTarget;
          await onChange({ ...config, emphasis: { ...config.emphasis, selected: input.checked } });
          await tick();
          input.checked = config.emphasis.selected;
        }}
      />Include selected state</label
    >
    <p class="help">
      Shared uses one emphasis set and one on-emphasis foreground in both themes. Adaptive solves each theme
      independently. Base, hover, and active are always included.
    </p>
  </section>
  <section class="control-section">
    <div class="section-heading">
      <span class="section-number">05</span>
      <h3>Contrast requirements</h3>
      <span class="mini-tag">Fixed</span>
    </div>
    <dl class="contrast-requirements">
      {#each [['normalText', 'Normal text'], ['largeText', 'Large text'], ['ui', 'UI boundaries']] as const as [key, label]}<div
          class="target-row"
        >
          <dt>{label}</dt>
          <dd>{config.targets[key]}:1</dd>
        </div>{/each}
    </dl>
    <p class="help">Contrast protection is always on. Other spacing settings may adjust automatically;
      changes that cannot pass are limited or rejected. Contrast targets and exact locks stay fixed.</p>
  </section>
  <div class="scope-note">
    <span class="status-dot"></span>
    <div>
      <strong>Core builder</strong>
      <p>
        Six semantic families, exact Brand anchors, opaque sRGB output, and contextual contrast validation.
      </p>
    </div>
  </div>
</aside>
