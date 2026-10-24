<script lang="ts">
  import type { ColorValue, GeneratedSystem, Mode } from '../engine/types';
  import { buildNeutralRoleMap, type RoleGroup } from './neutralRoleMap';
  import { inkFor, shortToken } from './presentation';
  import { toColor } from '../engine/color';
  import { describeNeutralRole, groupContrastChecks, groupContrastTables } from './neutralColorDetails';
  import ColorPopover from './ColorPopover.svelte';
  import ColorInfo from './ColorInfo.svelte';
  import { colorInspection } from './colorInspection';
  let { system, modes, checking = false, canUndo = false, reductionFeedback = '', onReduceLightness, onUndo }: {
    system: GeneratedSystem; modes: Mode[]; checking?: boolean; canUndo?: boolean;
    reductionFeedback?: string; onReduceLightness?: () => void; onUndo?: () => void;
  } = $props();
  let lightnessStops = $derived(new Set(system.primitives.map(primitive => primitive.color.l.toFixed(10))).size);
  let model = $derived(buildNeutralRoleMap(system));
  let selected = $state<string>('');
  let selectedMode = $state<Mode>('light');
  function inspectStop(primitive: string, mode: Mode) { selected = primitive; selectedMode = mode; }
  let inspection = $derived(selected ? colorInspection(system, { primitive: selected, mode: selectedMode }) : undefined);
  let selectedStop = $derived(model.stops.find((stop) => stop.primitive === selected) ?? model.stops[0]);
  let related = $derived(groupContrastChecks(selectedStop ? modes.flatMap((mode) => selectedStop!.checks[mode]) : []));
  let contrastTables = $derived(groupContrastTables(related, {
    light: selectedStop ? Object.values(selectedStop.labels.light).flat().map(label => label.semantic) : [],
    dark: selectedStop ? Object.values(selectedStop.labels.dark).flat().map(label => label.semantic) : [],
  }));
  const checkNames = { 'normal-text': 'Normal text', 'large-text': 'Large text', 'ui-boundary': 'UI boundary' };
  const roleName = (semantic: string) => describeNeutralRole(semantic, system.config.prefix);
  let neutral = $derived(system.config.families.find(family => family.id === 'neutral')!);
  let hasNeutralLocks = $derived(system.config.anchors.some(anchor => anchor.family === 'neutral' && anchor.locked));
  const neutralNote = (color: ColorValue) => {
    if (color.source) return 'Exact color lock: preserved independently of Neutral hue and chroma.';
    if (color.l === 0 || color.l === 1) return 'Pure white/black: untinted.';
    if (system.config.muted.mixWeights && modes.some(mode =>
      Object.entries(system.modes[mode].families.neutral.roles).some(([name, role]) =>
        ((name.startsWith('muted.') && name !== 'muted.base') || name.startsWith('border.muted.')) && role?.color.css === color.css))) {
      return 'Derived from the Neutral muted base using shared state strengths and any decorative border adjustment.';
    }
    if (hasNeutralLocks) {
      const global = toColor({ l: color.l, c: neutral.chroma, h: neutral.hue });
      if (Math.abs(color.h - global.h) > 1e-8 || Math.abs(color.c - global.c) > 1e-8) {
        return 'Uses an exact locked neutral state group; global neutral settings do not override it.';
      }
    }
    if (system.config.emphasis.mixWeights && modes.some(mode =>
      Object.entries(system.modes[mode].families.neutral.roles).some(([name, role]) =>
        name.startsWith('emphasis.') && name !== 'emphasis.base' && role?.color.css === color.css))) {
      return 'Mixes the Neutral emphasis base with black or white using a shared state strength.';
    }
    if (color.gamutMapped) return `Chroma limited to fit sRGB: requested ${neutral.chroma.toFixed(4)}, rendered ${color.c.toFixed(4)}. Neutral hue is preserved.`;
    return 'Uses the shared Neutral hue and chroma settings.';
  };
  let modeNames: Record<Mode, string> = { light: 'Light', dark: 'Dark' };
  const groups: { id: RoleGroup; label: string; position: 'above' | 'below' }[] = [
    { id: 'text', label: 'Text', position: 'above' },
    { id: 'border', label: 'Borders', position: 'above' },
    { id: 'surface', label: 'Surfaces', position: 'below' },
    { id: 'fill', label: 'Fills', position: 'below' },
  ];
  const labelsFor = (stop: (typeof model.stops)[number], mode: Mode, group: RoleGroup) => stop.labels[mode][group].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  const surfaceBase = (mode: Mode) => system.modes[mode].surfaces[0]?.color.css ?? (mode === 'light' ? '#ffffff' : '#121718');
  $effect(() => {
    if (selected && !model.stops.some((stop) => stop.primitive === selected)) selected = '';
  });
</script>

<section class="neutral-role-map" aria-labelledby="neutral-role-map-title">
  <div class="subsection-title">
    <div>
      <h3 id="neutral-role-map-title">Role mapping</h3>
    </div>
    <span class="mini-tag">{model.stops.length} colors</span>
  </div>
  <p class="section-description">Select a color to inspect its roles.</p>
  {#if onReduceLightness}
    <div class="lightness-actions">
      <span>{lightnessStops} shared lightness stops across all families and both themes</span>
      <div class="lightness-action-buttons">
        <button class="secondary-button" disabled={checking} aria-describedby="lightness-reduction-help" onclick={onReduceLightness}>Reduce lightness stops</button>
        {#if canUndo && onUndo}<button class="text-button" onclick={onUndo}>Undo last change</button>{/if}
      </div>
    </div>
    <p id="lightness-reduction-help" class="help lightness-help">Find fewer stops with small lightness adjustments. Keeps locked colors, state order, and contrast targets. A minimum is not guaranteed.</p>
    {#if reductionFeedback}<p class="help lightness-feedback">{reductionFeedback}</p>{/if}
  {/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus lets users access the horizontal map scroll region.) -->
  <div class="role-map-scroll" role="region" tabindex="0" aria-label="Neutral role map. Scroll horizontally to view all generated stops.">
    {#each modes as mode (mode)}<div class="role-map-mode" data-mode={mode} style={`--role-map-surface: ${surfaceBase(mode)}; --role-map-label-background: ${system.modes[mode].families.neutral.roles['muted.base']!.color.css}; --role-map-label-foreground: ${system.modes[mode].families.neutral.roles['foreground.base']!.color.css}`} style:color={inkFor(surfaceBase(mode))}>
        <h4>{modeNames[mode]} neutral roles</h4>
        <div class="role-map-grid" style={`--role-map-columns: ${model.stops.length}`}>
          {#each groups.filter((group) => group.position === 'above') as group (group.id)}<div class="role-map-group-label">{group.label}</div>
            {#each model.stops as stop (stop.primitive)}<div class="role-map-annotation" style={`--role-map-slots: ${model.rowSlots[group.id]}`}>
                {#each labelsFor(stop, mode, group.id) as label (label.semantic)}<span title={label.semantic}>{label.label}</span>{/each}
              </div>{/each}{/each}
          <div class="role-map-spacer" aria-hidden="true"></div>
          {#each model.stops as stop (stop.primitive)}<button
              class="role-map-stop"
              class:selected={selected === stop.primitive && selectedMode === mode}
              aria-pressed={selected === stop.primitive && selectedMode === mode}
              aria-haspopup="dialog"
              aria-controls="neutral-color-details" popovertarget="neutral-color-details" popovertargetaction="show"
              class:color-inspection-anchor={selected === stop.primitive && selectedMode === mode}
              title={neutralNote(stop.color)}
              onclick={() => inspectStop(stop.primitive, mode)}
              ><span class="sr-only">{modeNames[mode]} neutral color{' '} </span><span class="role-map-swatch" style:background={stop.color.css}></span><code>{stop.color.hex}{' '}</code><small>{shortToken(stop.primitive)}</small></button
            >{/each}
          {#each groups.filter((group) => group.position === 'below') as group (group.id)}<div class="role-map-group-label">{group.label}</div>
            {#each model.stops as stop (stop.primitive)}<div class="role-map-annotation" style={`--role-map-slots: ${model.rowSlots[group.id]}`}>
                {#each labelsFor(stop, mode, group.id) as label (label.semantic)}<span title={label.semantic}>{label.label}</span>{/each}
              </div>{/each}{/each}
        </div>
      </div>{/each}
  </div>
  <ColorPopover id="neutral-color-details" title={`Neutral color ${selectedStop ? shortToken(selectedStop.primitive) : ''}`} anchorName="--neutral-color-anchor" onOpenChange={open => { if (!open) selected = ''; }}>
    {#if selectedStop}
    {#if inspection}<ColorInfo {inspection} />{/if}
    <details class="color-inspection-details"><summary>All roles and contrast checks</summary><div class="color-inspection-full">
    <div class="role-map-detail">
      <div class="role-map-detail-swatch" style:background={selectedStop.color.css}></div>
      <div>
        <p class="role-map-detail-hex"><span class="sr-only">HEX: </span><code>{selectedStop.color.hex}</code></p>
        <p class="role-map-detail-value"><span>OKLCH</span> <code>{selectedStop.color.css}</code></p>
        <p class="help">{neutralNote(selectedStop.color)}</p>
      </div>
    </div>
    <div class="role-map-detail-body">
      <section aria-labelledby="neutral-assigned-roles-title">
        <h4 id="neutral-assigned-roles-title">Assigned roles</h4>
        <dl class="role-map-assignments">
          {#each modes as mode (mode)}
            {@const roles = Object.values(selectedStop.labels[mode]).flat()}
            <div><dt>{modeNames[mode]} mode</dt><dd class:role-map-unassigned={!roles.length}>{roles.map(label => roleName(label.semantic)).join(', ') || 'No roles assigned to this color.'}</dd></div>
          {/each}
        </dl>
      </section>
      <section class="role-map-detail-section" aria-labelledby="neutral-contrast-title">
        <h4 id="neutral-contrast-title">Contrast checks</h4>
        {#if related.length}
          <p class="help">Each ratio compares a foreground with its background. Column headings show the required contrast.</p>
          {#each contrastTables as table (table.id)}
            {@const kinds = table.category === 'boundary' ? ['ui-boundary'] as const : ['normal-text', 'large-text'] as const}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus allows scrolling the contrast table on narrow screens.) -->
            <div class="role-map-table-scroll" role="region" aria-label={`${modeNames[table.mode]} contrast checks for ${roleName(table.fixedRole)}`} tabindex="0">
              <table class="role-map-contrast-table">
                <caption><span class="role-map-table-mode">{modeNames[table.mode]} mode</span>{table.fixedSide === 'background' ? (table.category === 'text' ? 'Text on' : 'UI boundaries against') : ''} <span title={table.fixedRole}>{roleName(table.fixedRole)}</span>{table.fixedSide === 'foreground' ? ' on backgrounds' : ''}</caption>
                <thead><tr>
                  <th scope="col">{table.fixedSide === 'background' ? 'Foreground' : 'Background'}</th>
                  <th scope="col" class="role-map-ratio">Contrast</th>
                  {#each kinds as kind (kind)}
                    <th scope="col">{checkNames[kind]}<small>≥ {table.relationships[0].checks.find(check => check.kind === kind)?.target}:1</small></th>
                  {/each}
                </tr></thead>
                <tbody>
                  {#each table.relationships as relationship (relationship.id)}
                    {@const counterpart = table.fixedSide === 'background' ? relationship.foreground : relationship.background}
                    <tr>
                      <th scope="row" title={counterpart}>{roleName(counterpart)}</th>
                      <td class="role-map-ratio">{relationship.ratio.toFixed(3)}:1</td>
                      {#each kinds as kind (kind)}
                        {@const check = relationship.checks.find(check => check.kind === kind)}
                        <td>{#if check}<span class={check.pass ? 'check-pass' : 'check-fail'}>{check.pass ? 'Pass' : 'Fail'}</span>{:else}Not checked{/if}</td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/each}
        {:else}<p class="help">No contrast checks involve this color in the displayed modes.</p>{/if}
      </section>
    </div>
    </div></details>{/if}
  </ColorPopover>
</section>
