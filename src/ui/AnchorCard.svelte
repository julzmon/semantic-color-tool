<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { parseLockedColor } from '../engine/color';
  import type { ColorAnchor, Mode, OklchColor } from '../engine/types';
  import { serializeOklch } from './brandAnchor';
  import { inkFor } from './presentation';
  type Draft = Record<keyof OklchColor, string>;
  const anchorRoles: ColorAnchor['role'][] = ['emphasis.base', 'foreground.base'];
  const anchorModes: ColorAnchor['mode'][] = ['light', 'dark', 'both'];
  const formatDraft = (color: OklchColor): Draft => ({
    l: String(Number(color.l.toFixed(6))),
    c: String(Number(color.c.toFixed(6))),
    h: String(Number(color.h.toFixed(6))),
  });
  const overlaps = (one: ColorAnchor['mode'], two: ColorAnchor['mode']) =>
    one === 'both' || two === 'both' || one === two;
  let {
    anchor,
    index,
    allAnchors,
    onChange,
    onRemove,
  }: {
    anchor: ColorAnchor;
    index: number;
    allAnchors: ColorAnchor[];
    onChange: (next: ColorAnchor) => Promise<boolean | undefined>;
    onRemove: () => void;
  } = $props();
  const id = $props.id();
  let source = $derived(parseLockedColor(anchor.color));
  let draft = $state<Draft>(untrack(() => formatDraft(source)));
  let error = $state('');
  $effect(() => {
    draft = formatDraft(parseLockedColor(anchor.color));
    error = '';
  });
  const collides = (next: Pick<ColorAnchor, 'role' | 'mode'>) =>
    allAnchors.some(
      (other, otherIndex) =>
        otherIndex !== index && other.role === next.role && overlaps(other.mode, next.mode),
    );
  const update = async (patch: Partial<ColorAnchor>) => {
    const next = { ...anchor, ...patch };
    if (collides(next)) {
      error = 'That semantic role and mode already have a Brand anchor.';
      return;
    }
    error = '';
    if (await onChange(next) === false) {
      draft = formatDraft(source);
      error = 'This anchor cannot meet the checked contrast requirements. Previous anchor retained.';
    }
  };
  const commit = async () => {
    try {
      const next = serializeOklch({ l: Number(draft.l), c: Number(draft.c), h: Number(draft.h) });
      await update({ color: next });
    } catch (reason) {
      error = reason instanceof Error ? reason.message : 'Enter valid OKLCH coordinates.';
    }
  };
</script>

{#snippet numberField(
  key: keyof OklchColor,
  label: string,
  min: number,
  max?: number,
  step = 0.001,
)}{@const fieldId = `${id}-${key}`}
  <div class="anchor-field">
    <label for={fieldId}>{label}</label><input
      id={fieldId}
      type="number"
      inputmode="decimal"
      {min}
      {...max === undefined ? {} : { max }}
      {step}
      value={draft[key]}
      aria-describedby={error ? `${id}-error` : undefined}
      oninput={(event) => {
        const nextValue = event.currentTarget.value;
        draft = ((value) => ({ ...value, [key]: nextValue }))(draft);
      }}
      onblur={commit}
      onkeydown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  </div>{/snippet}
<fieldset class="brand-anchor">
  <legend>Brand anchor {index + 1}</legend>
  <div class="anchor-grid">
    {@render numberField('l', 'Lightness', 0, 1)}{@render numberField('c', 'Chroma', 0)}{@render numberField(
      'h',
      'Hue',
      0,
      360,
      1,
    )}
  </div>
  <div class="anchor-grid anchor-options">
    <div class="anchor-field">
      <label for={`${id}-role`}>Semantic token</label><select
        id={`${id}-role`}
        value={anchor.role}
        onchange={async (event) => {
          const input = event.currentTarget;
          await update({ role: input.value as ColorAnchor['role'] });
          await tick();
          input.value = anchor.role;
        }}
        >{#each anchorRoles as role}<option value={role} disabled={collides({ role, mode: anchor.mode })}
            >{role === 'emphasis.base' ? 'Background emphasis · base' : 'Foreground · base'}</option
          >{/each}</select
      >
    </div>
    <div class="anchor-field">
      <label for={`${id}-mode`}>Mode</label><select
        id={`${id}-mode`}
        value={anchor.mode}
        onchange={async (event) => {
          const input = event.currentTarget;
          await update({ mode: input.value as ColorAnchor['mode'] });
          await tick();
          input.value = anchor.mode;
        }}
        >{#each anchorModes as mode}<option value={mode} disabled={collides({ role: anchor.role, mode })}
            >{mode === 'both' ? 'Light + dark' : mode[0].toUpperCase() + mode.slice(1)}</option
          >{/each}</select
      >
    </div>
    <label class="checkbox-row anchor-lock"
      ><input
        type="checkbox"
        checked={anchor.locked}
        oninput={async (event) => {
          const input = event.currentTarget;
          await update({ locked: input.checked });
          await tick();
          input.checked = anchor.locked;
        }}
      />Lock exact color</label
    >
  </div>
  <div class="anchor-preview" style:background={source.css} style:color={inkFor(source)}>
    <code>{anchor.color}</code><span
      >{anchor.locked ? 'Exact source preserved' : 'Preferred color; solver may move it'}</span
    >
  </div>
  {#if error}<p id={`${id}-error`} class="field-error" role="alert">{error}</p>{/if}
  <button type="button" class="text-button anchor-remove" onclick={onRemove}>Remove anchor</button>
</fieldset>
