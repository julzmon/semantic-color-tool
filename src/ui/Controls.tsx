import { mutedDistance, surfaceStep } from '../engine/config';
import { useId, useState } from 'react';
import type { BuilderConfig, FamilyId, Mode } from '../engine/types';
import { BrandAnchors } from './BrandAnchors';

function Slider({ label, value, min, max, step = 0.001, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void;
}) {
  const id = useId();
  return <div className="slider-control">
    <div className="control-label"><label htmlFor={id}>{label}</label><output htmlFor={id}>{Number(value.toFixed(3))}{unit}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.currentTarget.valueAsNumber)} />
  </div>;
}

export function Controls({ config, onChange, onReset }: { config: BuilderConfig; onChange: (config: BuilderConfig) => void; onReset: () => void }) {
  const [familyId, setFamilyId] = useState<FamilyId>('neutral');
  const family = config.families.find((item) => item.id === familyId)!;
  const updateFamily = (patch: Partial<typeof family>) => onChange({ ...config, families: config.families.map((item) => item.id === familyId ? { ...item, ...patch } : item) });
  const updateMutedDistance = (mode: Mode, distance: number) => onChange({
    ...config,
    muted: {
      ...config.muted,
      distance: { light: mutedDistance(config, 'light'), dark: mutedDistance(config, 'dark'), [mode]: distance },
    },
  });
  return <aside className="controls" aria-label="Color system configuration">
    <div className="controls-heading"><div><span className="eyebrow">INPUTS</span><h2>Define the system</h2></div><button className="text-button" onClick={onReset} title="Restore the default configuration">Reset</button></div>
    <section className="control-section">
      <div className="section-heading"><span className="section-number">01</span><h3>Token namespace</h3></div>
      <label className="text-input" htmlFor="token-prefix">Token prefix<input id="token-prefix" value={config.prefix} onChange={(event) => { const prefix = event.currentTarget.value.trim().toLowerCase(); if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(prefix)) onChange({ ...config, prefix }); }} aria-describedby="token-prefix-help" /></label>
      <p id="token-prefix-help" className="help">Letters, numbers, and hyphens. Exported as <code>--{config.prefix}-*</code>.</p>
    </section>
    <section className="control-section">
      <div className="section-heading"><span className="section-number">02</span><h3>Surfaces</h3><span className="mini-tag">Neutral</span></div>
      <p className="help">Surfaces use the gray palette. Adjust their lightness here; Neutral hue and chroma below affect every gray role.</p>
      <Slider label="Light base lightness" min={0} max={1} value={config.surfaces.light.l} onChange={(l) => onChange({ ...config, surfaces: { ...config.surfaces, light: { l } } })} />
      <Slider label="Dark base lightness" min={0} max={1} value={config.surfaces.dark.l} onChange={(l) => onChange({ ...config, surfaces: { ...config.surfaces, dark: { l } } })} />
      <Slider label="Surface levels · includes base" min={1} max={6} step={1} value={config.surfaces.levels} onChange={(levels) => onChange({ ...config, surfaces: { ...config.surfaces, levels } })} />
      {(['light', 'dark'] as const).map((mode) => <Slider key={mode} label={mode === 'light' ? 'Light tonal step' : 'Dark tonal step'} min={0.01} max={0.2} step={0.005} value={surfaceStep(config, mode)} onChange={(value) => onChange({ ...config, surfaces: { ...config.surfaces, step: { light: surfaceStep(config, 'light'), dark: surfaceStep(config, 'dark'), [mode]: value } } })} />)}
      <p className="help">Light levels get darker; dark levels get lighter. Set each mode’s spacing independently.</p>
    </section>
    <section className="control-section">
      <div className="section-heading"><span className="section-number">03</span><h3>Families</h3><span className="mini-tag">{config.families.length} active</span></div>
      <div className="segmented family-switch" aria-label="Edit color family">{config.families.map((item) => <button key={item.id} aria-pressed={item.id === familyId} onClick={() => setFamilyId(item.id)}>{item.label}</button>)}</div>
      <div className="family-origin"><span className={`family-dot ${family.id}`} />{family.label}<span>← {family.key}</span></div>
      <Slider label={`${family.label} hue`} min={0} max={360} step={1} unit="°" value={family.hue} onChange={(hue) => updateFamily({ hue })} />
      <Slider label={`${family.label} chroma`} min={0} max={0.3} value={family.chroma} onChange={(chroma) => updateFamily({ chroma })} />
      <p className="help">Lightness is solved from semantic roles. Chroma is reduced where sRGB requires it.</p>
      {family.id === 'brand' && <BrandAnchors brand={family} anchors={config.anchors} onChange={(anchors) => onChange({ ...config, anchors })} />}
    </section>
    <section className="control-section">
      <div className="section-heading"><span className="section-number">03</span><h3>Muted</h3></div>
      {(['light', 'dark'] as const).map((mode) => <Slider key={mode} label={mode === 'light' ? 'Light muted distance' : 'Dark muted distance'} min={-0.08} max={mode === 'dark' ? 0.25 : 0.16} step={0.005} value={mutedDistance(config, mode)} onChange={(distance) => updateMutedDistance(mode, distance)} />)}
      <p className="help">Increasing the dark distance lifts muted semantic fills above the dark surface, which can retain more chroma in sRGB. States may shift together by up to 0.01 lightness to reuse an existing gray while preserving contrast and state separation.</p>
      <Slider label="State separation" min={0.005} max={0.07} step={0.005} value={config.muted.separation} onChange={(separation) => onChange({ ...config, muted: { ...config.muted, separation } })} />
      <p className="help">Positive distance moves inward. Muted fills and borders are decorative; their text is validated.</p>
    </section>
    <section className="control-section">
      <div className="section-heading"><span className="section-number">04</span><h3>Emphasis</h3><span className="mini-tag">Solved</span></div>
      <div className="segmented" aria-label="Emphasis theme strategy">
        <button aria-pressed={(config.emphasis.strategy ?? 'shared') === 'shared'} onClick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'shared' } })}>Shared across themes</button>
        <button aria-pressed={config.emphasis.strategy === 'adaptive'} onClick={() => onChange({ ...config, emphasis: { ...config.emphasis, strategy: 'adaptive' } })}>Adaptive by theme</button>
      </div>
      <Slider label="Emphasis state separation" min={0.01} max={0.1} step={0.005} value={config.emphasis.separation} onChange={(separation) => onChange({ ...config, emphasis: { ...config.emphasis, separation } })} />
      <label className="checkbox-row"><input type="checkbox" checked={config.emphasis.selected} onChange={(event) => onChange({ ...config, emphasis: { ...config.emphasis, selected: event.target.checked } })} />Include selected state</label>
      <p className="help">Shared uses one emphasis set and one on-emphasis foreground in both themes. Adaptive solves each theme independently. Base, hover, and active are always included.</p>
    </section>
    <section className="control-section">
      <div className="section-heading"><span className="section-number">05</span><h3>Contrast requirements</h3><span className="mini-tag">Fixed</span></div>
      <dl className="contrast-requirements">
        {([['normalText', 'Normal text'], ['largeText', 'Large text'], ['ui', 'UI boundaries']] as const).map(([key, label]) => <div className="target-row" key={key}><dt>{label}</dt><dd>{config.targets[key]}:1</dd></div>)}
      </dl>
      <p className="help">Fixed minimum ratios used for generation and validation.</p>
    </section>
    <div className="scope-note"><span className="status-dot" /><div><strong>Core builder</strong><p>Six semantic families, exact Brand anchors, opaque sRGB output, and contextual contrast validation.</p></div></div>
  </aside>;
}
