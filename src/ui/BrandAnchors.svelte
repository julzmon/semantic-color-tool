<script lang="ts">
  import { onDestroy, untrack, type Snippet } from 'svelte';
  import AnchorCard from './AnchorCard.svelte';
  import Slider from './Slider.svelte';
  import { parseLockedColor } from '../engine/color';
  import type { ColorAnchor, FamilyConfig, OklchColor } from '../engine/types';
  import { createBrandAnchor, editAnchorColor, displayBrandColor } from './brandAnchor';
  import { exactColorTrackStyle } from './controlTracks';
  let { brand, anchors, color, children, onChange }: {
    brand: FamilyConfig; anchors: ColorAnchor[]; color: string; children?: Snippet;
    onChange: (anchors: ColorAnchor[]) => Promise<boolean | undefined>;
  } = $props();
  const id = $props.id();
  const brandAnchors = $derived(anchors.filter(anchor => anchor.family === 'brand'));
  const primary = $derived(brandAnchors[0]);
  const current = $derived(primary ?? { ...createBrandAnchor(brand), color });
  const source = $derived(parseLockedColor(current.color));
  let format = $state<'hex' | 'oklch'>(untrack(() => current.color.trim().startsWith('#') ? 'hex' : 'oklch'));
  let focused = $state(false);
  const displaySource = (value: string, target: 'hex' | 'oklch') => displayBrandColor(value, target, focused);
  let draft = $state(untrack(() => displaySource(current.color, format)));
  let dirty = $state(false);
  let editing = $state(false);
  let saving = $state(false);
  let error = $state('');
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clearTimer = () => { clearTimeout(timer); timer = undefined; };
  onDestroy(clearTimer);
  $effect(() => {
    const incoming = displaySource(current.color, format);
    if (!dirty) draft = incoming;
  });
  $effect(() => { if (!current.locked) editing = false; });
  const editable = $derived(!current.locked || editing);
  const collides = (patch: Partial<ColorAnchor>) => {
    const next = { ...current, ...patch };
    return brandAnchors.slice(1).some(other => other.role === next.role &&
      (other.mode === 'both' || next.mode === 'both' || other.mode === next.mode));
  };
  const update = async (patch: Partial<ColorAnchor>) => {
    if (collides(patch)) { error = 'That role and theme already have a Brand color. Choose another destination.'; return false; }
    const next = { ...current, ...patch };
    const request = ++revision;
    saving = true; error = '';
    try {
      const accepted = await onChange(primary ? anchors.map(anchor => anchor === primary ? next : anchor) : [...anchors, next]);
      if (request !== revision) return accepted !== false;
      if (accepted === false) {
        dirty = false; draft = displaySource(current.color, format);
        error = 'This color cannot meet the current contrast requirements. Previous color retained.';
        return false;
      }
      return true;
    } catch {
      if (request === revision) { dirty = false; draft = displaySource(current.color, format); error = 'Unable to apply this color. Previous color retained.'; }
      return false;
    } finally { if (request === revision) saving = false; }
  };
  const commit = async (finalize = true) => {
    clearTimer();
    if (!dirty) return true;
    const value = draft.trim();
    try {
      if (format === 'hex' ? !value.startsWith('#') : !/^oklch\(/i.test(value)) throw new Error('format');
      parseLockedColor(value);
    }
    catch { if (finalize) error = `Enter an opaque ${format.toUpperCase()} color.`; return false; }
    const request = revision + 1;
    const accepted = await update({ color: value });
    if (request === revision) dirty = false;
    return accepted;
  };
  const enterColor = (value: string) => {
    draft = value; dirty = true; error = ''; revision++; saving = false;
    clearTimer(); timer = setTimeout(() => { void commit(false); }, 300);
  };
  const toggleLock = async (locked: boolean) => {
    if (!await commit()) return;
    await update({ locked });
  };
  const editCoordinate = async (key: keyof OklchColor, value: number) => {
    if (!await commit()) return false;
    const next = editAnchorColor(current.color, { [key]: String(value) });
    return next === undefined || update({ color: next });
  };
  const updateExtra = (anchor: ColorAnchor, next: ColorAnchor) => onChange(anchors.map(item => item === anchor ? next : item));
</script>

<div class="brand-anchor-controls brand-entry-controls">
  <label for={`${id}-source`}>Brand color</label>
  <div class="brand-color-entry">
    <select aria-label="Brand color format" value={format} onchange={async event => {
      const input = event.currentTarget;
      const next = input.value as 'hex' | 'oklch';
      if (await commit()) { format = next; error = ''; }
      input.value = format;
    }}><option value="hex">HEX</option><option value="oklch">OKLCH</option></select>
    <input type="color" aria-label="Choose Brand color" value={source.hex} disabled={!editable || saving}
      onchange={event => { clearTimer(); revision++; dirty = false; void update({ color: event.currentTarget.value }); }} />
    <input id={`${id}-source`} class="text-input" aria-label="Brand color HEX or OKLCH" type="text" spellcheck="false"
      value={draft} title={current.color} placeholder={format === 'hex' ? '#c02030' : 'oklch(0.55 0.18 25)'} readonly={!editable} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
      onfocus={() => { focused = true; }}
      oninput={event => enterColor(event.currentTarget.value)} onblur={async () => { await commit(); focused = false; }}
      onkeydown={event => {
        if (event.key === 'Enter') { event.preventDefault(); void commit(); }
        if (event.key === 'Escape') { clearTimer(); revision++; saving = false; dirty = false; draft = displaySource(current.color, format); error = ''; }
      }} />
  </div>
  <p id={`${id}-help`} class="help">{current.locked ? 'This exact color stays fixed for the role and theme below.' : 'Choose HEX or OKLCH, then enter a color or use the picker. Lightness can adjust to meet contrast.'}</p>
  {#if !current.locked}
    {#if children}{@render children()}{/if}
  {/if}
  <label class="checkbox-row"><input type="checkbox" checked={current.locked} disabled={saving}
    oninput={async event => { const input = event.currentTarget; await toggleLock(input.checked); input.checked = current.locked; }} />Lock exact color</label>
  {#if current.locked}
    <div class="anchor-grid anchor-options">
      <div class="anchor-field"><label for={`${id}-role`}>Apply to</label>
        <select id={`${id}-role`} value={current.role} disabled={saving} onchange={async event => { const input = event.currentTarget; await update({ role: input.value as ColorAnchor['role'] }); input.value = current.role; }}>
          <option value="emphasis.base" disabled={collides({ role: 'emphasis.base' })}>Emphasis fill</option>
          <option value="foreground.base" disabled={collides({ role: 'foreground.base' })}>Foreground text</option>
        </select>
      </div>
      <div class="anchor-field"><label for={`${id}-mode`}>Theme</label>
        <select id={`${id}-mode`} value={current.mode} disabled={saving} onchange={async event => { const input = event.currentTarget; await update({ mode: input.value as ColorAnchor['mode'] }); input.value = current.mode; }}>
          <option value="light" disabled={collides({ mode: 'light' })}>Light</option>
          <option value="dark" disabled={collides({ mode: 'dark' })}>Dark</option>
          <option value="both" disabled={collides({ mode: 'both' })}>Both</option>
        </select>
      </div>
    </div>
    <button class="text-button" type="button" disabled={saving} onclick={async () => { if (!await commit()) return; editing = !editing; }}>{editing ? 'Done editing' : 'Edit locked color'}</button>
    {#if editing}
      <p class="help">Edits replace the exact locked color. Changes that cannot pass contrast are rejected.</p>
      {#each [['l', 'Lightness', 1, 0.001], ['c', 'Chroma', Math.max(0.4, source.c), 0.001], ['h', 'Hue', 360, 1]] as [key, label, max, step]}
        <Slider label={`Locked color ${String(label).toLowerCase()}`} min={0} max={Number(max)} step={Number(step)} value={source[key as keyof OklchColor]}
          pending={saving} rangeStyle={(min, max) => exactColorTrackStyle(source, key as keyof OklchColor, { min, max })}
          onChange={value => editCoordinate(key as keyof OklchColor, value)} />
      {/each}
    {/if}
  {/if}
  {#if primary}
    <button class="text-button" type="button" disabled={saving} onclick={async () => {
      clearTimer(); revision++; dirty = false; editing = false;
      saving = true;
      try { if (await onChange(anchors.filter(anchor => anchor !== primary)) === false) error = 'Unable to use a generated color. Previous color retained.'; }
      finally { saving = false; }
    }}>Use generated color</button>
  {/if}
  {#if error}<p id={`${id}-error`} class="field-error" role="alert">{error}</p>{/if}
  {#if brandAnchors.length > 1}
    <h4>Additional Brand colors</h4>
    {#each brandAnchors.slice(1) as anchor, index}
      <AnchorCard {anchor} index={index + 1} allAnchors={brandAnchors} onChange={next => updateExtra(anchor, next)} onRemove={() => onChange(anchors.filter(item => item !== anchor))} />
    {/each}
  {/if}
</div>
