<script lang="ts">
  import type { Selection } from './types';
  import Inspector from './Inspector.svelte';
  import type { GeneratedSystem, Mode } from '../engine/types';
  import { inkFor, roleRows } from './presentation';
  let {
    system,
    modes,
    selected,
    onSelect,
  }: {
    system: GeneratedSystem;
    modes: Mode[];
    selected: Selection;
    onSelect: (selection: Selection) => void;
  } = $props();
  let columns = $derived(modes.flatMap((mode) => system.config.families.map((family) => ({ mode, family }))));
  let rows = $derived(
    roleRows.filter((row) => !row.role.endsWith('.selected') || system.config.emphasis.selected),
  );
</script>

<div class="matrix-layout">
  <div class="matrix-scroll">
    <table class="matrix-table">
      <caption class="sr-only"
        >Generated semantic colors across all configured families. Select a color for its tokens and contrast
        relationships.</caption
      ><thead
        ><tr
          ><th scope="col">Semantic role</th>{#each columns as { mode, family }}<th scope="col"
              >{family.label}<span>{mode}</span></th
            >{/each}</tr
        ></thead
      ><tbody
        >{#each rows as row, index}<tr
            class={index === 0 || rows[index - 1].group !== row.group ? 'group-start' : ''}
            ><th scope="row"
              ><span>{index === 0 || rows[index - 1].group !== row.group ? row.group : ''}</span
              >{row.label}</th
            >{#each columns as { mode, family }}{@const role =
                system.modes[mode].families[family.id].roles[row.role]}<td
                >{#if role}<button
                    class="matrix-cell"
                    aria-label={`${family.label} ${row.group} ${row.label} ${mode}`}
                    aria-pressed={selected.mode === mode &&
                      selected.family === family.id &&
                      selected.role === row.role}
                    onclick={() => onSelect({ mode, family: family.id, role: row.role })}
                    ><span
                      class="cell-swatch"
                      style:background={role.color.css}
                      style:color={inkFor(role.color)}
                      >Aa{#if role.sharedWith.length > 0}<span
                          class="reuse-icon"
                          title="Shared primitive"
                          aria-label="Shared primitive">↗</span
                        >{/if}</span
                    ><code>{role.color.hex}</code></button
                  >{/if}</td
              >{/each}</tr
          >{/each}</tbody
      >
    </table>
  </div>
  <Inspector {system} {selected} />
</div>
