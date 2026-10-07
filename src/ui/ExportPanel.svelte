<script lang="ts">
  import { exportCss, exportDtcg, exportDtcgFiles, exportJson } from '../engine/export';
  import type { GeneratedSystem } from '../engine/types';
  type Format = 'css' | 'dtcg' | 'json';
  let { system, onImport }: { system: GeneratedSystem; onImport: (json: string) => void | Promise<void> } = $props();
  let format = $state<Format>('css');
  let selectedFile = $state('');
  let message = $state('');
  let files = $derived.by(() => ({
    [`${system.config.prefix}.bundle.resolver.json`]: exportDtcg(system),
    ...exportDtcgFiles(system),
  }));
  let file = $derived(selectedFile in files ? selectedFile : `${system.config.prefix}.bundle.resolver.json`);
  let output = $derived.by(() =>
    format === 'css' ? exportCss(system) : format === 'dtcg' ? files[file] : exportJson(system),
  );
  let filename = $derived(
    format === 'css'
      ? `${system.config.prefix}-color-system.css`
      : format === 'dtcg'
        ? file.split('/').at(-1)!
        : `${system.config.prefix}-generator.config.json`,
  );
  let familyNames = $derived(system.config.families.map((family) => family.label).join(', '));
  let textarea: HTMLTextAreaElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      message = `${filename} copied to clipboard.`;
    } catch {
      textarea?.focus();
      textarea?.select();
      message = 'Clipboard unavailable. Output selected; press ⌘C or Ctrl+C.';
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([output], { type: format === 'css' ? 'text/css' : 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    message = `${filename} download started.`;
  };
  const importConfiguration = async (event: Event & { currentTarget: HTMLInputElement }) => {
    const source = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!source) return;
    try {
      await onImport(await source.text());
      message = `${source.name} imported.`;
    } catch (error) {
      message = error instanceof Error ? error.message : 'Configuration could not be imported.';
    }
  };
</script>

<section class="export-panel">
  <div class="export-note">
    <span aria-hidden="true">↗</span>
    <div>
      <strong>Shared foundations. Two semantic contexts.</strong>
      <p>
        {familyNames} tokens share corresponding lightness while retaining family hue and chroma. CSS uses the
        <code>--{system.config.prefix}-*</code> namespace.
      </p>
    </div>
  </div>
  <div class="export-toolbar">
    <div class="segmented">
      {#each [['css', 'CSS tokens'], ['dtcg', 'DTCG JSON'], ['json', 'Configuration']] as const as [value, label]}<button
          aria-pressed={format === value}
          onclick={() => {
            format = value;
            message = '';
          }}>{label}</button
        >{/each}
    </div>
    <div class="export-actions">
      {#if format === 'json'}<input
          bind:this={fileInput}
          class="sr-only"
          type="file"
          accept="application/json,.json"
          aria-label="Import configuration JSON"
          onchange={importConfiguration}
        /><button class="secondary-button" onclick={() => fileInput?.click()}>↑ Import</button>{/if}<button
        class="secondary-button"
        onclick={download}>↓ Download</button
      ><button class="primary-button" onclick={copy}>Copy {format === 'css' ? 'CSS' : 'JSON'}</button>
    </div>
  </div>
  {#if format === 'dtcg'}<div class="export-file-picker">
      <label for="dtcg-file">DTCG 2025.10 document</label><select
        id="dtcg-file"
        value={file}
        onchange={(event) => {
          selectedFile = event.currentTarget.value;
          message = '';
        }}
        >{#each Object.keys(files) as path}<option value={path}>{path}</option>{/each}</select
      >
      <p>
        {file === `${system.config.prefix}.bundle.resolver.json`
          ? 'Portable resolver for Terrazzo: both modes, semantic aliases, and numeric OKLCH components.'
          : `Source files preserve L/C/H component references. Keep foundation/ and semantic/ beside ${system.config.prefix}.resolver.json; use the portable bundle with Terrazzo.`}
        The resolver’s light default is for builds; CSS follows the system preference unless a region sets its mode.
      </p>
    </div>{/if}
  <textarea
    bind:this={textarea}
    aria-label={`Generated ${format.toUpperCase()} output`}
    class="code-output"
    spellcheck={false}
    readonly
    value={output}></textarea>
  <p class="export-status" role="status">
    {message ||
      `${system.primitives.length} primitives · ${system.semantics.length} semantic mappings · both modes`}
  </p>
</section>
