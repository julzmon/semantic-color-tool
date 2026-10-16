<script lang="ts">
  import { tick } from 'svelte';
  import { exportCss, exportDtcg, exportDtcgFiles, exportJson } from '../engine/export';
  import { cssTokenModel } from '../engine/tokens';
  import type { GeneratedSystem } from '../engine/types';
  type Format = 'css' | 'dtcg' | 'json';
  let { system, prefix, onPrefixChange, onImport }: {
    system: GeneratedSystem; prefix: string; onPrefixChange: (prefix: string) => Promise<boolean | undefined>;
    onImport: (json: string) => void | Promise<void>;
  } = $props();
  let prefixDraft = $state('');
  let editingPrefix = $state(false);
  let prefixRevision = 0;
  let prefixError = $state('');
  let pendingPrefix: Promise<boolean | undefined> | undefined;
  $effect(() => { if (!editingPrefix) prefixDraft = prefix; });
  const commitPrefix = async (input: HTMLInputElement) => {
    const revision = prefixRevision;
    const next = input.value.trim().toLowerCase();
    editingPrefix = false;
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(next)) prefixError = 'Start with a letter; use letters, numbers and single hyphens.';
    else {
      prefixError = '';
      if (next !== prefix) {
        const request = onPrefixChange(next).catch(() => false);
        pendingPrefix = request;
        await request;
        if (pendingPrefix === request) pendingPrefix = undefined;
      }
    }
    await tick();
    if (!editingPrefix && revision === prefixRevision) prefixDraft = prefix;
  };
  let format = $state<Format>('css');
  let selectedFile = $state('');
  let message = $state('');
  let files = $derived.by(() => ({
    [`${system.config.prefix}.bundle.resolver.json`]: exportDtcg(system),
    ...exportDtcgFiles(system),
  }));
  let file = $derived(selectedFile in files ? selectedFile : `${system.config.prefix}.bundle.resolver.json`);
  let cssStats = $derived.by(() => cssTokenModel(system).stats);
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
  let textarea: HTMLTextAreaElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();
  const exportReady = async () => {
    while (pendingPrefix) {
      if (await pendingPrefix !== true) {
        message = 'Prefix change was not accepted. Review the settings before exporting.';
        return false;
      }
    }
    await tick();
    return true;
  };
  const copy = async () => {
    if (!await exportReady()) return;
    const exportedName = filename;
    try {
      await navigator.clipboard.writeText(output);
      message = `${exportedName} copied to clipboard.`;
    } catch {
      textarea?.focus();
      textarea?.select();
      message = 'Clipboard unavailable. Output selected; press ⌘C or Ctrl+C.';
    }
  };
  const download = async () => {
    if (!await exportReady()) return;
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
  <div class="export-settings">
    <h2>Export settings</h2>
    <label class="text-input" for="token-prefix">Token prefix
      <input id="token-prefix" value={prefixDraft} aria-describedby="token-prefix-help"
        aria-invalid={prefixError ? 'true' : undefined}
        onfocus={() => { editingPrefix = true; prefixRevision++; }}
        oninput={event => { prefixRevision++; prefixDraft = event.currentTarget.value; prefixError = ''; }}
        onblur={event => commitPrefix(event.currentTarget)}
        onkeydown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { prefixDraft = prefix; prefixError = ''; event.currentTarget.value = prefix; event.currentTarget.blur(); } }} />
    </label>
    <p class="help" id="token-prefix-help">{prefixError || `Letters, numbers and hyphens. Exported as --${system.config.prefix}-*. Applies to CSS, tokens and filenames.`}</p>
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
  <p class="section-description">{format === 'css' ? 'Global lightness, chroma, hue, and mix settings compose every semantic color role. Light and dark themes use the same token names.' : format === 'dtcg' ? 'Design tokens in DTCG JSON format for compatible tools.' : 'Save your settings as JSON, or import a saved configuration.'}</p>
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
      (format === 'css'
        ? `${cssStats.roles} color roles · ${cssStats.derivedStates} mixed states · ${cssStats.components} L/C/H tokens · ${cssStats.settings} mix settings · both themes`
        : `${system.primitives.length} palette colors · ${system.semantics.length} color roles · both themes`)}
  </p>
</section>
