import { useState } from 'react';
import type { JSX } from 'react';
import type { FamilyId, GeneratedRole, GeneratedSystem, Mode } from '../engine/types';
import { previewStyle } from './presentation';

type PreviewStatus = Readonly<{
  family: Extract<FamilyId, 'info' | 'positive' | 'warning' | 'negative'>;
  icon: string;
  title: string;
  description: string;
}>;

export const PREVIEW_STATUSES: readonly PreviewStatus[] = [
  { family: 'info', icon: 'i', title: 'You’re all up to date', description: 'Your changes are ready for the team.' },
  { family: 'positive', icon: '✓', title: 'Ready to share', description: 'All required checks have passed.' },
  { family: 'warning', icon: '!', title: 'Review before publishing', description: 'A few choices need your attention.' },
  { family: 'negative', icon: '×', title: 'Needs attention', description: 'Resolve blockers before continuing.' },
];

function surfaceLabel(index: number): string {
  return index === 0 ? 'Base' : `Level ${index}`;
}

function NestedSurfaceCard({ surfaces, index = 0 }: { surfaces: GeneratedRole[]; index?: number }): JSX.Element {
  const surface = surfaces[index]!;
  return <article className="surface-nested-card" data-surface={surface.semantic} style={{ background: surface.color.css }}>
    <span>{surfaceLabel(index)}</span>
    <strong>{index === 0 ? 'Workspace card' : `Nested card ${index}`}</strong>
    {index + 1 < surfaces.length ? <NestedSurfaceCard surfaces={surfaces} index={index + 1} /> : <p>Content sits on the deepest generated surface.</p>}
  </article>;
}

export function ThemePreview({ system, mode }: { system: GeneratedSystem; mode: Mode }) {
  const [name, setName] = useState('Design foundations');
  const [saved, setSaved] = useState(false);
  const theme = system.modes[mode];
  const checks = system.checks.filter((check) => check.mode === mode);
  const failures = checks.filter((check) => !check.pass).length;
  return <article className="preview-shell">
    <header className="preview-heading"><span><span aria-hidden="true">{mode === 'light' ? '☀' : '◐'}</span> {mode === 'light' ? 'Light' : 'Dark'} theme</span><span className={`status-label ${failures ? 'fail' : ''}`}>{failures ? `${failures} failed checks` : 'Checks pass'}</span></header>
    <div className="theme-preview" data-mode={mode} style={previewStyle(system)}>
      <div className="preview-product-heading"><div className="preview-logo" aria-hidden="true">K</div><span>Workspace</span><span className="preview-avatar">JD</span></div>
      <div className="preview-product-body">
        <span className="preview-overline">PROJECT OVERVIEW</span>
        <h3>A place for good work.</h3>
        <p className="preview-description">Bring your team, ideas, and next steps together.</p>
        <section className="preview-statuses" aria-labelledby={`status-updates-${mode}`}>
          <h4 id={`status-updates-${mode}`} className="preview-overline">STATUS UPDATES</h4>
          <div className="preview-status-grid">
            {PREVIEW_STATUSES.map((status) => <div key={status.family} className="preview-alert" data-family={status.family}>
              <span className="preview-alert-icon" aria-hidden="true">{status.icon}</span>
              <div><strong>{status.title}</strong><p>{status.description}</p></div>
            </div>)}
          </div>
        </section>
        <div className="preview-field"><label htmlFor={`project-${mode}`}>Project name</label><input id={`project-${mode}`} value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} /><span>Interactive sample · changes stay in this preview.</span></div>
        <div className="preview-actions"><button className="preview-primary" data-family="brand" onClick={() => setSaved(true)}>{saved ? 'Saved in preview ✓' : 'Save changes ↗'}</button><button className="preview-secondary" onClick={() => { setName('Design foundations'); setSaved(false); }}>Reset project</button></div>
        <a className="preview-link" href="#contrast">View accessibility relationships <span aria-hidden="true">↗</span></a>
        <section className="preview-nested" data-mode={mode === 'light' ? 'dark' : 'light'} aria-label={`Nested ${mode === 'light' ? 'dark' : 'light'} region`}>
          <strong>{mode === 'light' ? 'Dark' : 'Light'} within {mode}</strong>
          <p>The same semantic tokens follow this region’s color scheme.</p>
        </section>
        <section className="surface-demo" aria-label={`${mode === 'light' ? 'Light' : 'Dark'} surface-level cards`}>
          <div className="surface-demo-heading"><div><span className="preview-overline">SURFACE LEVELS</span><h4>Cards at each level</h4></div><span>Generated backgrounds</span></div>
          <div className="surface-level-cards">{theme.surfaces.map((surface, index) => <article key={surface.semantic} className="surface-level-card" data-surface={surface.semantic} style={{ background: surface.color.css }}><span>{surfaceLabel(index)}</span><strong>{index === 0 ? 'Project summary' : `Card on ${surfaceLabel(index).toLowerCase()}`}</strong><p>Use this level for grouped content.</p></article>)}</div>
        </section>
        <section className="surface-demo surface-nesting-demo" aria-label={`${mode === 'light' ? 'Light' : 'Dark'} nested surface cards`}>
          <div className="surface-demo-heading"><div><span className="preview-overline">NESTED SURFACES</span><h4>Cards within cards</h4></div><span>Every level in context</span></div>
          <NestedSurfaceCard surfaces={theme.surfaces} />
        </section>
      </div>
      <div className="surface-strip" aria-label={`${mode} generated surfaces`}>{theme.surfaces.map((surface, index) => <div key={surface.semantic} style={{ background: surface.color.css }}><span>{index === 0 ? 'Base' : `Level ${index}`}</span><code>{surface.color.hex}</code></div>)}</div>
    </div>
  </article>;
}
