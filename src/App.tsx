import { useEffect, useMemo, useRef, useState } from 'react';
import { generateSystem } from './engine/generate';
import { configFromReference } from './engine/config';
import { ExportPanel } from './ui/ExportPanel';
import { CONFIGURATION_STORAGE_KEY, loadStoredConfiguration, parseConfigurationJson, saveStoredConfiguration } from './ui/configuration';
import { FAMILY_DEFINITIONS } from './engine/families';
import type { BuilderConfig, FamilyId, FamilyRole, GeneratedSystem, Mode } from './engine/types';
import reference from 'virtual:kds-reference';
import { Controls } from './ui/Controls';
import { ThemePreview } from './ui/ThemePreview';
import { inkFor, roleRows, shortToken, tokenLabel } from './ui/presentation';

const initialConfig = configFromReference(reference);
const tabs = ['Overview', 'Semantic matrix', 'Primitive palette', 'Export'] as const;
type Tab = typeof tabs[number];
type PreviewMode = Mode | 'split';
type Selection = { mode: Mode; family: FamilyId; role: FamilyRole };

function ModeSwitch({ value, onChange }: { value: PreviewMode; onChange: (value: PreviewMode) => void }) {
  return <div className="segmented mode-switch" aria-label="Preview mode">{(['light', 'dark', 'split'] as const).map((mode) => <button key={mode} aria-pressed={value === mode} onClick={() => onChange(mode)}><span aria-hidden="true">{mode === 'light' ? '☀' : mode === 'dark' ? '◐' : '◧'}</span>{mode === 'split' ? 'Split' : mode === 'light' ? 'Light' : 'Dark'}</button>)}</div>;
}

function Inspector({ system, selected }: { system: GeneratedSystem; selected: Selection }) {
  const role = system.modes[selected.mode].families[selected.family].roles[selected.role];
  if (!role) return null;
  const checks = system.checks.filter((check) => check.mode === selected.mode && (check.foreground === role.semantic || check.background === role.semantic));
  const sorted = [...checks].sort((a, b) => Number(a.pass) - Number(b.pass) || a.ratio - b.ratio);
  return <aside className="inspector" aria-label="Selected token details">
    <div className="inspector-swatch" style={{ background: role.color.css, color: inkFor(role.color) }}><span>Aa</span><code>{role.color.hex}</code></div>
    <div className="inspector-body"><span className="eyebrow">TOKEN INSPECTOR · {selected.mode.toUpperCase()}</span><h3>{system.config.families.find((family) => family.id === selected.family)?.label ?? selected.family} / {selected.role.replaceAll('.', ' / ')}</h3>
      <dl><dt>OKLCH</dt><dd><code>{role.color.css}</code></dd><dt>HEX / sRGB approximation</dt><dd><code>{role.color.hex}</code></dd><dt>Generated primitive</dt><dd><code>{role.primitive}</code></dd><dt>Semantic token</dt><dd><code>{role.semantic}</code></dd></dl>
      <span className={`sharing-label ${role.sharedWith.length ? 'shared' : ''}`}>{role.sharedWith.length ? `↗ Shared with ${role.sharedWith.length} role${role.sharedWith.length === 1 ? '' : 's'}` : 'Separate primitive'}</span>
      {role.sharedWith.length > 0 && <ul className="usage-list">{role.sharedWith.map((name) => <li key={name}><code>{shortToken(name)}</code></li>)}</ul>}
      {role.color.gamutMapped && <p className="gamut-note">Chroma reduced to fit sRGB. Lightness and hue are preserved.</p>}
      <h4>Contrast relationships</h4>{sorted.length ? <div className="inspector-checks">{sorted.slice(0, 8).map((check) => <div key={check.id}><span className={check.pass ? 'check-pass' : 'check-fail'}>{check.pass ? 'Pass' : 'Fail'} · {check.ratio.toFixed(3)}:1</span><p>{tokenLabel(check.foreground)} → {tokenLabel(check.background)}</p><small>{check.kind} · target {check.target}:1</small></div>)}{sorted.length > 8 && <p className="help">All {sorted.length} relationships are listed in the accessibility table.</p>}</div> : <p className="help">Decorative role. No boundary contrast target applies.</p>}
    </div>
  </aside>;
}

function Matrix({ system, modes, selected, onSelect }: { system: GeneratedSystem; modes: Mode[]; selected: Selection; onSelect: (selection: Selection) => void }) {
  const columns = modes.flatMap((mode) => system.config.families.map((family) => ({ mode, family })));
  const rows = roleRows.filter((row) => !row.role.endsWith('.selected') || system.config.emphasis.selected);
  return <div className="matrix-layout"><div className="matrix-scroll"><table className="matrix-table"><caption className="sr-only">Generated semantic colors across all configured families. Select a color for its tokens and contrast relationships.</caption><thead><tr><th scope="col">Semantic role</th>{columns.map(({ mode, family }) => <th key={`${mode}-${family.id}`} scope="col">{family.label}<span>{mode}</span></th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className={index === 0 || rows[index - 1].group !== row.group ? 'group-start' : ''} key={row.role}><th scope="row"><span>{index === 0 || rows[index - 1].group !== row.group ? row.group : ''}</span>{row.label}</th>{columns.map(({ mode, family }) => {
    const role = system.modes[mode].families[family.id].roles[row.role];
    return <td key={`${mode}-${family.id}`}>{role && <button className="matrix-cell" aria-label={`${family.label} ${row.group} ${row.label} ${mode}`} aria-pressed={selected.mode === mode && selected.family === family.id && selected.role === row.role} onClick={() => onSelect({ mode, family: family.id, role: row.role })}><span className="cell-swatch" style={{ background: role.color.css, color: inkFor(role.color) }}>Aa{role.sharedWith.length > 0 && <span className="reuse-icon" title="Shared primitive" aria-label="Shared primitive">↗</span>}</span><code>{role.color.hex}</code></button>}</td>;
  })}</tr>)}</tbody></table></div><Inspector system={system} selected={selected} /></div>;
}

function StateOverview({ system, mode, onSelect }: { system: GeneratedSystem; mode: Mode; onSelect: (selection: Selection) => void }) {
  const family = system.modes[mode].families.brand;
  const roles = ['muted.base', 'muted.hover', 'muted.active', 'emphasis.base', 'emphasis.hover', 'emphasis.active'] as const;
  return <section className="state-overview"><div className="subsection-title"><div><span className="eyebrow">RELATIONSHIPS, NOT RAMPS</span><h3>One family. Every role.</h3></div><span className="mini-tag">Brand · {mode}</span></div><div className="state-samples">{roles.map((name) => { const role = family.roles[name]!; return <button key={name} onClick={() => onSelect({ mode, family: 'brand', role: name })}><span style={{ background: role.color.css, color: inkFor(role.color) }}>Aa</span><strong>{name.split('.')[0]}</strong><small>{name.split('.')[1]}</small></button>; })}</div><div className="relationship-summary">{(['foreground.base', 'border.muted.base', 'border.emphasis.base'] as const).map((name) => { const role = family.roles[name]!; const isFg = name.startsWith('foreground'); return <button key={name} onClick={() => onSelect({ mode, family: 'brand', role: name })}><span className={isFg ? 'sample-foreground' : 'sample-border'} style={isFg ? { color: role.color.css, background: system.modes[mode].surfaces[0].color.css } : { borderColor: role.color.css, background: system.modes[mode].surfaces[0].color.css }}>{isFg ? 'Aa' : ''}</span><div><strong>{name === 'foreground.base' ? 'Semantic foreground' : name === 'border.muted.base' ? 'Muted border' : 'Emphasis border'}</strong><small>{name === 'border.muted.base' ? 'Decorative separator' : role.sharedWith.length ? 'Shares a generated primitive' : 'Generated for its constraints'}</small></div><span aria-hidden="true">↗</span></button>; })}</div></section>;
}

function ContrastTable({ system, modes }: { system: GeneratedSystem; modes: Mode[] }) {
  const [failOnly, setFailOnly] = useState(false);
  const [kind, setKind] = useState('all');
  const [limit, setLimit] = useState(12);
  const all = system.checks.filter((check) => modes.includes(check.mode));
  const failures = all.filter((check) => !check.pass).length;
  const filtered = all.filter((check) => (!failOnly || !check.pass) && (kind === 'all' || check.kind === kind)).sort((a, b) => Number(a.pass) - Number(b.pass));
  return <section className="contrast-section" id="contrast"><div className="subsection-title"><div><span className="eyebrow">WCAG CONTRAST</span><h3>Accessibility in context</h3></div><span className={`summary-badge ${failures ? 'has-failures' : ''}`}>{failures ? `${failures} failing` : 'All checks pass'} · {all.length} relationships</span></div><p className="section-description">Text is checked on its intended surfaces and semantic fills. Emphasis borders are checked against every surface.</p><div className="table-toolbar"><label>Relationship <select value={kind} onChange={(event) => { setKind(event.target.value); setLimit(12); }}><option value="all">All types</option><option value="normal-text">Normal text</option><option value="large-text">Large text</option><option value="ui-boundary">UI boundary</option></select></label><label className="checkbox-row"><input type="checkbox" checked={failOnly} onChange={(event) => { setFailOnly(event.target.checked); setLimit(12); }} />Failures only</label></div><div className="contrast-scroll"><table className="contrast-table"><thead><tr><th scope="col">Foreground → background</th><th scope="col">Mode / use</th><th scope="col">Contrast</th><th scope="col">Target</th><th scope="col">Result</th></tr></thead><tbody>{filtered.slice(0, limit).map((check) => <tr key={check.id}><td><div className="contrast-pair"><span className="pair-sample" style={{ background: check.backgroundColor.css, color: check.foregroundColor.css }}>Aa</span><span><code>{shortToken(check.foreground)}</code><small>→ {shortToken(check.background)}</small></span></div></td><td className="mode-cell">{check.mode}<small>{check.kind.replaceAll('-', ' ')}</small></td><td><code>{check.ratio.toFixed(3)}:1</code></td><td>{check.target}:1</td><td><span className={check.pass ? 'check-pass' : 'check-fail'}>{check.pass ? '✓ Pass' : '× Fail'}</span></td></tr>)}</tbody></table></div>{!filtered.length && <p className="empty-state">No relationships match this filter.</p>}<div className="table-footer"><span>Showing {Math.min(filtered.length, limit)} of {filtered.length} relationships · status uses unrounded ratios</span>{filtered.length > limit && <button className="text-button" onClick={() => setLimit((value) => value + 24)}>Show more ↓</button>}</div></section>;
}

function Primitives({ system }: { system: GeneratedSystem }) {
  const [selected, setSelected] = useState<string>('');
  const primitive = system.primitives.find((item) => item.name === selected);
  return <section className="primitive-section"><p className="section-description">Only colors used by the semantic system are collected. Light and dark share this palette. Matching numbers share one lightness across families. Unused positions are omitted; these numbers do not match the original KDS scale.</p>{system.config.families.map((family) => {
    const generated = system.primitives.filter((item) => item.family === family.key);
    const referenceKey = FAMILY_DEFINITIONS.find((item) => item.id === family.id)!.referenceKey;
    const original = Object.entries(reference.primitives).filter(([name]) => name.startsWith(`--kds-key-${referenceKey}-`));
    return <div className="primitive-family" key={family.id}><div className="subsection-title"><h3>{family.label} <span className="muted-text">/ {family.key}</span></h3><span className="mini-tag">{generated.length} generated colors</span></div><div className="primitive-grid">{generated.map((item) => <button aria-pressed={selected === item.name} key={item.name} onClick={() => setSelected(item.name)} title={item.name}><span style={{ background: item.color.css, color: inkFor(item.color) }}>{item.name.replace(`--kds-key-${family.key}-`, '')}</span><code>{item.color.hex}</code></button>)}</div><details className="reference-comparison"><summary>Compare original KDS 100–1200 reference</summary><p className="help">Original values are preserved here. Generated positions above solve the new relationships.</p><div className="primitive-grid reference-grid">{original.map(([name, value]) => <div key={name}><span style={{ background: value, color: inkFor(value) }}>{name.split('-').at(-1)}</span><code>{value}</code></div>)}</div></details></div>;
  })}{primitive && <div className="primitive-detail" aria-live="polite"><div className="detail-dot" style={{ background: primitive.color.css }} /><div><strong>{primitive.name}</strong><code>{primitive.color.css}</code><p>Used by {primitive.usages.length} semantic mappings:</p><ul className="usage-list">{primitive.usages.map((name) => <li key={name}><code>{name}</code></li>)}</ul></div></div>}</section>;
}

function ModelNotes() {
  return <details className="model-notes"><summary>Model decisions & scope <span>Read the assumptions ↗</span></summary><div className="notes-grid"><div><h3>Semantic first</h3><p>Generate surfaces → position muted states → solve shared family lightness → collect primitives. No manually designed lightness ramp. All color math lives in a pure TypeScript engine using Culori.</p></div><div><h3>One palette, two modes</h3><p>Corresponding roles across Neutral, Brand, Info, Positive, Negative, and Warning share lightness. Emphasis fills are shared across themes by default; adaptive emphasis remains available.</p></div><div><h3>Exact Brand constraints</h3><p>Brand anchors default to background emphasis base. An exact lock remains literal, even when it cannot satisfy a contrast relationship; failures stay visible.</p></div><div><h3>Current boundary</h3><p>Opaque sRGB colors, normal/large text, emphasis-fill text, decorative borders, CSS/DTCG exports, and configuration import are included. UI-boundary checks apply to emphasis borders. Transparent overlays and Figma Variables remain outside this builder.</p></div></div></details>;
}

export default function App() {
  const [stored] = useState(() => loadStoredConfiguration(typeof window === 'undefined' ? null : window.localStorage, initialConfig));
  const [config, setConfig] = useState<BuilderConfig>(stored.config);
  const [configurationStatus, setConfigurationStatus] = useState(() => stored.error || (stored.restored ? 'Restored the saved configuration.' : ''));
  const [mode, setMode] = useState<PreviewMode>('split');
  const [tab, setTab] = useState<Tab>('Overview');
  const [selected, setSelected] = useState<Selection>({ mode: 'light', family: 'brand', role: 'emphasis.base' });
  const lastValid = useRef<GeneratedSystem | null>(null);
  const skipPersistence = useRef(false);
  const generated = useMemo(() => {
    try { return { system: generateSystem(config), error: '' }; }
    catch (error) { return { system: null, error: error instanceof Error ? error.message : 'Unable to generate this configuration.' }; }
  }, [config]);
  if (generated.system) lastValid.current = generated.system;
  useEffect(() => {
    if (skipPersistence.current) { skipPersistence.current = false; return; }
    if (!saveStoredConfiguration(typeof window === 'undefined' ? null : window.localStorage, config)) setConfigurationStatus('Changes could not be saved in this browser.');
  }, [config]);
  const system = generated.system ?? lastValid.current;
  const modes: Mode[] = mode === 'split' ? ['light', 'dark'] : [mode];
  const select = (selection: Selection) => { setSelected(selection); setTab('Semantic matrix'); };
  const reset = () => {
    skipPersistence.current = true;
    try { window.localStorage.removeItem(CONFIGURATION_STORAGE_KEY); } catch { /* Browser storage is optional. */ }
    setConfig(structuredClone(initialConfig));
    setConfigurationStatus('Restored KDS defaults and cleared the saved configuration.');
  };
  const importConfiguration = (json: string) => {
    const next = parseConfigurationJson(json, initialConfig);
    setConfig(next);
    setConfigurationStatus('Imported configuration saved for this browser.');
  };
  const failed = system?.checks.filter((check) => !check.pass).length ?? 0;
  const shared = system?.semantics.filter((token) => token.name.startsWith('--kds-fg-') && system.semantics.some((other) => other.name.startsWith('--kds-bg-') && other.light === token.light && other.dark === token.dark)).length ?? 0;
  return <><a className="skip-link" href="#workspace">Skip to workspace</a><header className="app-header"><a className="brand-mark" href="#" aria-label="KDS Color System Builder">K</a><div className="brand-name">KDS <span>/</span> <span>Color System Builder</span></div><span className="prototype-tag">CORE BUILDER</span><div className="header-end"><span className="local-label"><span className="status-dot" />Local workspace</span><button className="primary-button" onClick={() => setTab('Export')}>Export tokens <span aria-hidden="true">↗</span></button></div></header><div className="app-layout"><Controls config={config} onChange={setConfig} onReset={reset} /><main id="workspace" className="workspace"><div className="workspace-title"><div><span className="eyebrow">FOUNDATIONS / COLOR</span><h1>Designed by intent.<br className="mobile-break" /> Resolved by contrast.</h1><p>Build the relationships. Let the system find the colors.</p></div><span className="engine-badge"><span className="engine-icon" aria-hidden="true">◈</span>OKLCH engine<span>v0.2</span></span></div>{configurationStatus && <p className="configuration-status" role="status">{configurationStatus}</p>}{generated.error && <div role="alert" className="error-banner"><strong>Configuration could not be generated.</strong> {generated.error} {system && 'Showing the last valid result; adjust the controls or reset.'}</div>}{system && <><div className="metrics-strip"><div><strong>{system.primitives.length}</strong><span>shared primitives</span></div><div><strong>{system.semantics.length}</strong><span>semantic tokens</span></div><div><strong>{shared}</strong><span>foreground / fill reuses</span></div><div className={failed ? 'metric-fail' : 'metric-pass'}><strong>{failed ? `${failed} failed` : 'Passing'}</strong><span>{system.checks.length} contrast relationships</span></div></div><div className="workspace-toolbar"><nav className="workspace-tabs" aria-label="Workspace sections">{tabs.map((item) => <button key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>{item}</button>)}</nav>{tab !== 'Export' && <ModeSwitch value={mode} onChange={(next) => { setMode(next); if (next !== 'split') setSelected((value) => ({ ...value, mode: next })); }} />}</div>{system.diagnostics.length > 0 && <details className="diagnostics"><summary>{system.diagnostics.length} generation notice{system.diagnostics.length === 1 ? '' : 's'} — review constraints</summary><ul>{system.diagnostics.map((notice, index) => <li key={index}>{notice}</li>)}</ul></details>}{tab === 'Overview' && <><div className={`preview-grid ${mode !== 'split' ? 'single' : ''}`}>{modes.map((previewMode) => <ThemePreview key={previewMode} mode={previewMode} system={system} />)}</div><StateOverview system={system} mode={mode === 'dark' ? 'dark' : 'light'} onSelect={select} /></>}{tab === 'Semantic matrix' && <><div className="view-intro"><h2>Same roles. Different intents.</h2><p>Compare every generated color. Select a cell to inspect its primitive, usage, and contrast.</p></div><Matrix system={system} modes={modes} selected={selected} onSelect={setSelected} /></>}{tab === 'Primitive palette' && <Primitives system={system} />}{tab === 'Export' && <ExportPanel system={system} onImport={importConfiguration} />}{tab !== 'Export' && <ContrastTable system={system} modes={modes} />}<ModelNotes /></>}<footer className="workspace-footer"><span>KDS · Color System Builder</span><span>Reference: tokens.css · Six semantic families</span></footer></main></div></>;
}
