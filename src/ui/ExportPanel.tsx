import { useMemo, useRef, useState } from 'react';
import { exportCss, exportDtcg, exportDtcgFiles, exportJson } from '../engine/export';
import type { GeneratedSystem } from '../engine/types';

type Format = 'css' | 'dtcg' | 'json';

export function ExportPanel({ system, onImport }: { system: GeneratedSystem; onImport: (json: string) => void }) {
  const [format, setFormat] = useState<Format>('css');
  const [file, setFile] = useState('kds.bundle.resolver.json');
  const [message, setMessage] = useState('');
  const files = useMemo<Record<string, string>>(() => ({ 'kds.bundle.resolver.json': exportDtcg(system), ...exportDtcgFiles(system) }), [system]);
  const output = useMemo(() => format === 'css' ? exportCss(system) : format === 'dtcg' ? files[file] : exportJson(system), [format, file, files, system]);
  const filename = format === 'css' ? 'kds-color-system.css' : format === 'dtcg' ? file.split('/').at(-1)! : 'kds-builder.config.json';
  const familyNames = system.config.families.map((family) => family.label).join(', ');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(output); setMessage(`${filename} copied to clipboard.`); }
    catch { textarea.current?.focus(); textarea.current?.select(); setMessage('Clipboard unavailable. Output selected; press ⌘C or Ctrl+C.'); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([output], { type: format === 'css' ? 'text/css' : 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage(`${filename} download started.`);
  };
  const importConfiguration = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const source = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!source) return;
    try {
      onImport(await source.text());
      setMessage(`${source.name} imported.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Configuration could not be imported.');
    }
  };
  return <section className="export-panel">
    <div className="export-note"><span aria-hidden="true">↗</span><div><strong>Shared foundations. Two semantic contexts.</strong><p>{familyNames} tokens share corresponding lightness while retaining family hue and chroma. Existing KDS semantic names are preserved in CSS.</p></div></div>
    <div className="export-toolbar">
      <div className="segmented">{([['css', 'CSS tokens'], ['dtcg', 'DTCG JSON'], ['json', 'Configuration']] as const).map(([value, label]) => <button key={value} aria-pressed={format === value} onClick={() => { setFormat(value); setMessage(''); }}>{label}</button>)}</div>
      <div className="export-actions">{format === 'json' && <><input ref={fileInput} className="sr-only" type="file" accept="application/json,.json" aria-label="Import configuration JSON" onChange={importConfiguration} /><button className="secondary-button" onClick={() => fileInput.current?.click()}>↑ Import</button></>}<button className="secondary-button" onClick={download}>↓ Download</button><button className="primary-button" onClick={copy}>Copy {format === 'css' ? 'CSS' : 'JSON'}</button></div>
    </div>
    {format === 'dtcg' && <div className="export-file-picker"><label htmlFor="dtcg-file">DTCG 2025.10 document</label><select id="dtcg-file" value={file} onChange={(event) => { setFile(event.target.value); setMessage(''); }}>{Object.keys(files).map((path) => <option key={path} value={path}>{path}</option>)}</select><p>{file === 'kds.bundle.resolver.json' ? 'Portable resolver for Terrazzo: both modes, semantic aliases, and numeric OKLCH components.' : 'Source files preserve L/C/H component references. Keep foundation/ and semantic/ beside kds.resolver.json; use the portable bundle with Terrazzo.'} The resolver’s light default is for builds; CSS follows the system preference unless a region sets its mode.</p></div>}
    <textarea ref={textarea} aria-label={`Generated ${format.toUpperCase()} output`} className="code-output" spellCheck={false} readOnly value={output} />
    <p className="export-status" role="status">{message || `${system.primitives.length} primitives · ${system.semantics.length} semantic mappings · both modes`}</p>
  </section>;
}
