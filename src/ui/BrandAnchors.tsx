import { useEffect, useId, useState } from 'react';
import { parseLockedColor } from '../engine/color';
import type { ColorAnchor, FamilyConfig, Mode, OklchColor } from '../engine/types';
import { createBrandAnchor, serializeOklch } from './brandAnchor';
import { inkFor } from './presentation';

type Draft = Record<keyof OklchColor, string>;
const anchorRoles: ColorAnchor['role'][] = ['emphasis.base', 'foreground.base'];
const anchorModes: ColorAnchor['mode'][] = ['light', 'dark', 'both'];

const formatDraft = (color: OklchColor): Draft => ({ l: String(Number(color.l.toFixed(6))), c: String(Number(color.c.toFixed(6))), h: String(Number(color.h.toFixed(6))) });
const overlaps = (one: ColorAnchor['mode'], two: ColorAnchor['mode']) => one === 'both' || two === 'both' || one === two;

function AnchorCard({ anchor, index, allAnchors, onChange, onRemove }: {
  anchor: ColorAnchor;
  index: number;
  allAnchors: ColorAnchor[];
  onChange: (next: ColorAnchor) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const source = parseLockedColor(anchor.color);
  const [draft, setDraft] = useState<Draft>(() => formatDraft(source));
  const [error, setError] = useState('');
  useEffect(() => { setDraft(formatDraft(parseLockedColor(anchor.color))); setError(''); }, [anchor.color]);
  const collides = (next: Pick<ColorAnchor, 'role' | 'mode'>) => allAnchors.some((other, otherIndex) => otherIndex !== index && other.role === next.role && overlaps(other.mode, next.mode));
  const update = (patch: Partial<ColorAnchor>) => {
    const next = { ...anchor, ...patch };
    if (collides(next)) { setError('That semantic role and mode already have a Brand anchor.'); return; }
    setError(''); onChange(next);
  };
  const commit = () => {
    try {
      const next = serializeOklch({ l: Number(draft.l), c: Number(draft.c), h: Number(draft.h) });
      update({ color: next });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Enter valid OKLCH coordinates.'); }
  };
  const numberField = (key: keyof OklchColor, label: string, min: number, max?: number, step = 0.001) => {
    const fieldId = `${id}-${key}`;
    return <div className="anchor-field"><label htmlFor={fieldId}>{label}</label><input id={fieldId} type="number" inputMode="decimal" min={min} {...(max === undefined ? {} : { max })} step={step} value={draft[key]} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => {
      const nextValue = event.currentTarget.value;
      setDraft((value) => ({ ...value, [key]: nextValue }));
    }} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></div>;
  };
  return <fieldset className="brand-anchor"><legend>Brand anchor {index + 1}</legend>
    <div className="anchor-grid">{numberField('l', 'Lightness', 0, 1)}{numberField('c', 'Chroma', 0)}{numberField('h', 'Hue', 0, 360, 1)}</div>
    <div className="anchor-grid anchor-options"><div className="anchor-field"><label htmlFor={`${id}-role`}>Semantic token</label><select id={`${id}-role`} value={anchor.role} onChange={(event) => update({ role: event.currentTarget.value as ColorAnchor['role'] })}>{anchorRoles.map((role) => <option key={role} value={role} disabled={collides({ role, mode: anchor.mode })}>{role === 'emphasis.base' ? 'Background emphasis · base' : 'Foreground · base'}</option>)}</select></div>
      <div className="anchor-field"><label htmlFor={`${id}-mode`}>Mode</label><select id={`${id}-mode`} value={anchor.mode} onChange={(event) => update({ mode: event.currentTarget.value as ColorAnchor['mode'] })}>{anchorModes.map((mode) => <option key={mode} value={mode} disabled={collides({ role: anchor.role, mode })}>{mode === 'both' ? 'Light + dark' : mode[0].toUpperCase() + mode.slice(1)}</option>)}</select></div>
      <label className="checkbox-row anchor-lock"><input type="checkbox" checked={anchor.locked} onChange={(event) => update({ locked: event.currentTarget.checked })} />Lock exact color</label></div>
    <div className="anchor-preview" style={{ background: source.css, color: inkFor(source) }}><code>{anchor.color}</code><span>{anchor.locked ? 'Exact source preserved' : 'Preferred color; solver may move it'}</span></div>
    {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
    <button type="button" className="text-button anchor-remove" onClick={onRemove}>Remove anchor</button>
  </fieldset>;
}

export function BrandAnchors({ brand, anchors, onChange }: { brand: FamilyConfig; anchors: ColorAnchor[]; onChange: (anchors: ColorAnchor[]) => void }) {
  const brandAnchors = anchors.filter((anchor) => anchor.family === 'brand');
  const updateAnchor = (anchor: ColorAnchor, next: ColorAnchor) => onChange(anchors.map((item) => item === anchor ? next : item));
  const removeAnchor = (anchor: ColorAnchor) => onChange(anchors.filter((item) => item !== anchor));
  return <div className="brand-anchor-controls"><div className="brand-anchor-heading"><div><strong>Brand color lock</strong><p>By default, this anchors <code>--kds-bg-brand-emphasis-base</code>. Use OKLCH only.</p></div><button type="button" className="text-button" onClick={() => onChange([...anchors, createBrandAnchor(brand)])}>Add anchor</button></div>
    {brandAnchors.length ? brandAnchors.map((anchor, index) => <AnchorCard key={`${anchor.role}-${anchor.mode}-${index}`} anchor={anchor} index={index} allAnchors={brandAnchors} onChange={(next) => updateAnchor(anchor, next)} onRemove={() => removeAnchor(anchor)} />) : <p className="help">No Brand color is anchored. Add one to set a preferred or exact emphasis-base color.</p>}
  </div>;
}
