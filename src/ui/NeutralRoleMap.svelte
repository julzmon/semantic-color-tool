<script lang="ts">
  import type { GeneratedSystem, Mode } from '../engine/types';
  import { buildNeutralRoleMap, type RoleGroup } from './neutralRoleMap';
  import { inkFor, shortToken } from './presentation';
  let { system, modes }: { system: GeneratedSystem; modes: Mode[] } = $props();
  let model = $derived(buildNeutralRoleMap(system));
  let selected = $state<string>('');
  let selectedStop = $derived(model.stops.find((stop) => stop.primitive === selected) ?? model.stops[0]);
  let related = $derived(selectedStop ? [...new Map(modes.flatMap((mode) => selectedStop!.checks[mode]).map((check) => [check.id, check])).values()] : []);
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
    if (!selected || !model.stops.some((stop) => stop.primitive === selected)) selected = model.stops[0]?.primitive ?? '';
  });
</script>

<section class="neutral-role-map" aria-labelledby="neutral-role-map-title">
  <div class="subsection-title">
    <div>
      <span class="eyebrow">NEUTRAL ROLE MAP</span>
      <h3 id="neutral-role-map-title">Semantic roles across the neutral ramp</h3>
    </div>
    <span class="mini-tag">{model.stops.length} generated stops</span>
  </div>
  <p class="section-description">Text, borders, surfaces, and fills are placed on their exact generated stop. Shared roles stack in the same column.</p>
  <p class="role-map-note">Generated stops, ordered light to dark. Spacing does not represent equal lightness steps.</p>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus lets users access the horizontal map scroll region.) -->
  <div class="role-map-scroll" role="region" tabindex="0" aria-label="Neutral role map. Scroll horizontally to view all generated stops.">
    {#each modes as mode (mode)}<div class="role-map-mode" data-mode={mode} style:background={surfaceBase(mode)} style:color={mode === 'light' ? inkFor(surfaceBase(mode)) : '#f3f7f6'}>
        <h4>{modeNames[mode]} neutral roles</h4>
        <div class="role-map-grid" style={`--role-map-columns: ${model.stops.length}`}>
          {#each groups.filter((group) => group.position === 'above') as group (group.id)}<div class="role-map-group-label">{group.label}</div>
            {#each model.stops as stop (stop.primitive)}<div class="role-map-annotation" style={`--role-map-slots: ${model.rowSlots[group.id]}`}>
                {#each labelsFor(stop, mode, group.id) as label (label.semantic)}<span title={label.semantic}>{label.label}</span>{/each}
              </div>{/each}{/each}
          <div class="role-map-spacer" aria-hidden="true"></div>
          {#each model.stops as stop (stop.primitive)}<button
              class="role-map-stop"
              class:selected={selected === stop.primitive || (!selected && stop.primitive === model.stops[0]?.primitive)}
              aria-pressed={selected === stop.primitive || (!selected && stop.primitive === model.stops[0]?.primitive)}
              aria-label={`${modeNames[mode]} ${shortToken(stop.primitive)} ${stop.color.hex}`}
              onclick={() => (selected = stop.primitive)}
              ><span class="role-map-swatch" style:background={stop.color.css}></span><code>{stop.color.hex}</code><small>{shortToken(stop.primitive)}</small></button
            >{/each}
          {#each groups.filter((group) => group.position === 'below') as group (group.id)}<div class="role-map-group-label">{group.label}</div>
            {#each model.stops as stop (stop.primitive)}<div class="role-map-annotation" style={`--role-map-slots: ${model.rowSlots[group.id]}`}>
                {#each labelsFor(stop, mode, group.id) as label (label.semantic)}<span title={label.semantic}>{label.label}</span>{/each}
              </div>{/each}{/each}
        </div>
      </div>{/each}
  </div>
  {#if selectedStop}<div class="role-map-detail" aria-live="polite">
      <div class="role-map-detail-swatch" style:background={selectedStop.color.css}></div>
      <div><span class="eyebrow">SELECTED STOP</span><h4>{shortToken(selectedStop.primitive)}</h4><code>{selectedStop.color.hex} · {selectedStop.color.css}</code>
        {#each modes as mode (mode)}<p><strong>{modeNames[mode]}</strong>: {Object.values(selectedStop.labels[mode]).flat().map((label) => label.label).join(', ') || 'Unused in this mode.'}</p>{/each}
        {#if related.length}<ul class="role-map-checks">{#each related.slice(0, 6) as check (check.id)}<li><span class={check.pass ? 'check-pass' : 'check-fail'}>{check.pass ? 'Pass' : 'Fail'} · {check.ratio.toFixed(3)}:1</span> <span>{shortToken(check.foreground)} → {shortToken(check.background)}</span></li>{/each}</ul>{:else}<p class="help">No checked contrast relationship is attached to this stop.</p>{/if}
      </div>
    </div>{/if}
</section>
