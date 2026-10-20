<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { controlLimits, type ControlAvailabilityView } from './controlAvailability';
  import { normalizeNumericControl } from './controlValues';
  let { label, value, min, max, step = 0.001, unit = '', adjusted = false, rangeClass = '', rangeStyle = '', availability, ceiling, limitReason = '', pending = false, onActivate, onChange }: {
    label: string; value: number; min: number; max: number; step?: number; unit?: string;
    adjusted?: boolean; rangeClass?: string; rangeStyle?: string | ((min: number, max: number) => string); availability?: ControlAvailabilityView; ceiling?: number; limitReason?: string; pending?: boolean; onActivate?: () => void; onChange: (value: number) => void | Promise<unknown>;
  } = $props();
  const id = $props.id();
  const limits = $derived(controlLimits(availability));
  const lower = $derived(Math.max(min, limits?.min ?? min));
  const upper = $derived(Math.max(lower, Math.min(max, ceiling ?? max, limits?.max ?? max)));
  const constrain = (next: number) => Math.max(lower, Math.min(upper, next));
  const normalizeRequest = (next: number) => !Number.isFinite(next) ? undefined : next <= lower ? lower : next >= upper ? upper : constrain(normalizeNumericControl(next, min, max, step)!);
  const trackStyle = $derived(typeof rangeStyle === 'function' ? rangeStyle(lower, upper) : rangeStyle);
  let editing = $state(false);
  let editRevision = 0;
  let dirty = false;
  let text = $state('');
  let error = $state('');
  $effect(() => { if (!editing) text = String(Number(constrain(value).toFixed(3))); });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let checking = $state(false);
  let submission = 0;
  let rangeRevision = 0;
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  onDestroy(clearTimer);
  const commit = async (input: HTMLInputElement, finalize = true) => {
    clearTimer();
    const revision = editRevision;
    const next = normalizeRequest(input.valueAsNumber);
    if (finalize) editing = false;
    if (!dirty) return;
    if (!finalize && next === undefined) return; // Leave incomplete numbers alone while typing.
    dirty = false;
    if (next === undefined) error = `Enter a number between ${min} and ${max}.`;
    else {
      const request = ++submission;
      checking = true;
      error = '';
      try { await onChange(constrain(next)); }
      catch (cause) { if (revision === editRevision) error = cause instanceof Error ? cause.message : 'Unable to verify this value.'; }
      finally { if (request === submission) checking = false; }
    }
    await tick();
    if (revision === editRevision) {
      text = String(Number(value.toFixed(3)));
      input.value = text;
    }
  };
  const changeRange = async (input: HTMLInputElement | undefined, next: number) => {
    const revision = ++rangeRevision;
    clearTimer(); dirty = false; editing = false; editRevision++;
    error = '';
    const requested = normalizeRequest(next) ?? constrain(value);
    if (input) input.value = String(requested);
    try { await onChange(requested); }
    catch (cause) { if (revision === rangeRevision) error = cause instanceof Error ? cause.message : 'Unable to verify this value.'; }
    await tick();
    if (input && revision === rangeRevision) input.value = String(constrain(value));
  };
  let lastLimitRequest = '';
  $effect(() => {
    const next = constrain(value);
    if (next === value) { lastLimitRequest = ''; return; }
    if (pending || checking || editing) return;
    const signature = `${value}:${lower}:${upper}`;
    if (lastLimitRequest === signature) return;
    lastLimitRequest = signature;
    void changeRange(undefined, value > upper ? max : min);
  });

</script>

<div class="slider-control" class:automatically-adjusted={adjusted}>
  <div class="control-label">
    <label for={id}>{label}</label>
    <span class="numeric-value">
      <input type="number" aria-label={`${label} value`} aria-invalid={error ? 'true' : undefined}
        aria-busy={checking ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        title={limitReason || undefined}
        {min} {max} {step} aria-valuemin={lower} aria-valuemax={upper} value={text}
        onfocus={() => { editing = true; editRevision++; onActivate?.(); }}
        oninput={(event) => { editRevision++; dirty = true; text = event.currentTarget.value; error = ''; clearTimer(); const input = event.currentTarget; timer = setTimeout(() => { void commit(input, false); }, 300); }}
        onblur={(event) => commit(event.currentTarget)}
        onkeydown={(event) => {
          if (event.key === 'Escape') { clearTimer(); editRevision++; dirty = false; error = ''; editing = false; text = String(Number(value.toFixed(3))); event.currentTarget.value = text; event.currentTarget.blur(); }
          if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        }} />
      {#if unit}<span>{unit}</span>{/if}
    </span>
  </div>
  <input {id} type="range" class={rangeClass} style={trackStyle} min={lower} max={upper} step="any" value={constrain(value)} disabled={lower === upper}
    onfocus={() => onActivate?.()} onpointerdown={() => onActivate?.()}
    aria-valuemin={lower} aria-valuemax={upper}
    aria-describedby={error ? `${id}-error` : undefined}
    aria-busy={availability?.status === 'checking' ? 'true' : undefined}
    title={limitReason || undefined}
    oninput={(event) => changeRange(event.currentTarget, event.currentTarget.valueAsNumber)}
    onkeydown={(event) => {
      const delta = ['ArrowUp', 'ArrowRight'].includes(event.key) ? step : ['ArrowDown', 'ArrowLeft'].includes(event.key) ? -step : event.key === 'PageUp' ? step * 10 : event.key === 'PageDown' ? -step * 10 : 0;
      if (delta || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        void changeRange(event.currentTarget, event.key === 'Home' ? min : event.key === 'End' ? max : event.currentTarget.valueAsNumber + delta);
      }
    }} />
  {#if error}<span id={`${id}-error`} class="field-error" role="status">{error}</span>{/if}
</div>
