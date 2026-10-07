<script lang="ts">
  import { tick } from 'svelte';
  import { normalizeNumericControl } from './controlValues';
  let { label, value, min, max, step = 0.001, unit = '', adjusted = false, onChange }: {
    label: string; value: number; min: number; max: number; step?: number; unit?: string;
    adjusted?: boolean; onChange: (value: number) => void | Promise<unknown>;
  } = $props();
  const id = $props.id();
  let editing = $state(false);
  let editRevision = 0;
  let dirty = false;
  let text = $state('');
  let error = $state('');
  $effect(() => { if (!editing) text = String(Number(value.toFixed(3))); });
  const commit = async (input: HTMLInputElement) => {
    const revision = editRevision;
    const next = normalizeNumericControl(input.valueAsNumber, min, max, step);
    editing = false;
    if (!dirty) return;
    dirty = false;
    if (next === undefined) error = `Enter a number between ${min} and ${max}.`;
    else {
      error = '';
      await onChange(next);
    }
    await tick();
    if (!editing && revision === editRevision) text = String(Number(value.toFixed(3)));
  };
</script>

<div class="slider-control" class:automatically-adjusted={adjusted}>
  <div class="control-label">
    <label for={id}>{label}</label>
    <span class="numeric-value">
      <input type="number" aria-label={`${label} value`} aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : adjusted ? `${id}-adjusted` : undefined}
        {min} {max} {step} value={text}
        onfocus={() => { editing = true; editRevision++; }}
        oninput={(event) => { editRevision++; dirty = true; text = event.currentTarget.value; error = ''; }}
        onblur={(event) => commit(event.currentTarget)}
        onkeydown={(event) => {
          if (event.key === 'Escape') { dirty = false; error = ''; editing = false; text = String(Number(value.toFixed(3))); event.currentTarget.value = text; event.currentTarget.blur(); }
          if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        }} />
      {#if unit}<span>{unit}</span>{/if}
    </span>
  </div>
  <input {id} type="range" {min} {max} {step} {value}
    aria-describedby={adjusted ? `${id}-adjusted` : undefined}
    oninput={async (event) => {
      const input = event.currentTarget;
      error = '';
      await onChange(input.valueAsNumber);
      await tick();
      input.value = String(value);
    }} />
  {#if adjusted}<span id={`${id}-adjusted`} class="adjustment-note">Automatically adjusted for contrast</span>{/if}
  {#if error}<span id={`${id}-error`} class="field-error" role="status">{error}</span>{/if}
</div>
