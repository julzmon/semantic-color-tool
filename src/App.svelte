<script lang="ts">
  import type { PreviewMode, Selection } from './ui/types';
  import ModelNotes from './ui/ModelNotes.svelte';
  import ContrastTable from './ui/ContrastTable.svelte';
  import Primitives from './ui/Primitives.svelte';
  import Matrix from './ui/Matrix.svelte';
  import StateOverview from './ui/StateOverview.svelte';
  import ModeSwitch from './ui/ModeSwitch.svelte';
  import { generateSystem } from './engine/generate';
  import { configFromReference } from './engine/config';
  import ExportPanel from './ui/ExportPanel.svelte';
  import {
    CONFIGURATION_STORAGE_KEY,
    loadStoredConfiguration,
    parseConfigurationJson,
    saveStoredConfiguration,
  } from './ui/configuration';
  import type { BuilderConfig, GeneratedSystem, Mode } from './engine/types';
  import reference from 'virtual:kds-reference';
  import Controls from './ui/Controls.svelte';
  import ThemePreview from './ui/ThemePreview.svelte';
  const initialConfig = configFromReference(reference);
  const tabs = ['Overview', 'Semantic matrix', 'Primitive palette', 'Export'] as const;
  type Tab = (typeof tabs)[number];
  const stored = loadStoredConfiguration(
    typeof window === 'undefined' ? null : window.localStorage,
    initialConfig,
  );
  let config = $state.raw<BuilderConfig>(stored.config);
  let configurationStatus = $state(
    stored.error || (stored.restored ? 'Restored the saved configuration.' : ''),
  );
  let mode = $state<PreviewMode>('split');
  let tab = $state<Tab>('Overview');
  let selected = $state<Selection>({ mode: 'light', family: 'brand', role: 'emphasis.base' });
  let lastValid = $state.raw<GeneratedSystem | null>(null);
  let skipPersistence = false;
  let generated = $derived.by(() => {
    try {
      return { system: generateSystem(config), error: '' };
    } catch (error) {
      return {
        system: null,
        error: error instanceof Error ? error.message : 'Unable to generate this configuration.',
      };
    }
  });
  $effect(() => {
    if (generated.system) lastValid = generated.system;
  });
  $effect(() => {
    const currentConfig = config;
    if (skipPersistence) {
      skipPersistence = false;
      return;
    }
    if (!saveStoredConfiguration(typeof window === 'undefined' ? null : window.localStorage, currentConfig))
      configurationStatus = 'Changes could not be saved in this browser.';
  });
  let system = $derived(generated.system ?? lastValid);
  let modes: Mode[] = $derived(mode === 'split' ? ['light', 'dark'] : [mode]);
  const select = (selection: Selection) => {
    selected = selection;
    tab = 'Semantic matrix';
  };
  const reset = () => {
    skipPersistence = true;
    try {
      window.localStorage.removeItem(CONFIGURATION_STORAGE_KEY);
    } catch {
      /* Browser storage is optional. */
    }
    config = structuredClone(initialConfig);
    configurationStatus = 'Restored defaults and cleared the saved configuration.';
  };
  const importConfiguration = (json: string) => {
    const next = parseConfigurationJson(json, initialConfig);
    config = next;
    configurationStatus = 'Imported configuration saved for this browser.';
  };
  let failed = $derived(system?.checks.filter((check) => !check.pass).length ?? 0);
  let shared = $derived(
    system?.semantics.filter(
      (token) =>
        token.name.startsWith(`--${config.prefix}-fg-`) &&
        system.semantics.some(
          (other) =>
            other.name.startsWith(`--${config.prefix}-bg-`) &&
            other.light === token.light &&
            other.dark === token.dark,
        ),
    ).length ?? 0,
  );
</script>

<a class="skip-link" href="#workspace">Skip to workspace</a>
<header class="app-header">
  <a class="brand-mark" href="#workspace" aria-label="Semantic Color System Generator">S</a>
  <div class="brand-name">Semantic <span>/</span> <span>Color System Generator</span></div>
  <span class="prototype-tag">CORE BUILDER</span>
  <div class="header-end">
    <span class="local-label"><span class="status-dot"></span>Local workspace</span><button
      class="primary-button"
      onclick={() => (tab = 'Export')}>Export tokens <span aria-hidden="true">↗</span></button
    >
  </div>
</header>
<div class="app-layout">
  <Controls
    {config}
    onChange={(next) => {
      config = next;
    }}
    onReset={reset}
  />
  <main id="workspace" class="workspace">
    <div class="workspace-title">
      <div>
        <span class="eyebrow">FOUNDATIONS / COLOR</span>
        <h1>Designed by intent.<br class="mobile-break" /> Resolved by contrast.</h1>
        <p>Build the relationships. Let the system find the colors.</p>
      </div>
      <span class="engine-badge"
        ><span class="engine-icon" aria-hidden="true">◈</span>OKLCH engine<span>v0.2</span></span
      >
    </div>
    {#if configurationStatus}<p class="configuration-status" role="status">
        {configurationStatus}
      </p>{/if}{#if generated.error}<div role="alert" class="error-banner">
        <strong>Configuration could not be generated.</strong>
        {generated.error}
        {system && 'Showing the last valid result; adjust the controls or reset.'}
      </div>{/if}{#if system}<div class="metrics-strip">
        <div><strong>{system.primitives.length}</strong><span>shared primitives</span></div>
        <div><strong>{system.semantics.length}</strong><span>semantic tokens</span></div>
        <div><strong>{shared}</strong><span>foreground / fill reuses</span></div>
        <div class={failed ? 'metric-fail' : 'metric-pass'}>
          <strong>{failed ? `${failed} failed` : 'Passing'}</strong><span
            >{system.checks.length} contrast relationships</span
          >
        </div>
      </div>
      <div class="workspace-toolbar">
        <nav class="workspace-tabs" aria-label="Workspace sections">
          {#each tabs as item}<button
              aria-current={tab === item ? 'page' : undefined}
              onclick={() => (tab = item)}>{item}</button
            >{/each}
        </nav>
        {#if tab !== 'Export'}<ModeSwitch
            value={mode}
            onChange={(next) => {
              mode = next;
              if (next !== 'split') selected = ((value) => ({ ...value, mode: next }))(selected);
            }}
          />{/if}
      </div>
      {#if system.diagnostics.length > 0}<details class="diagnostics">
          <summary
            >{system.diagnostics.length} generation notice{system.diagnostics.length === 1 ? '' : 's'} — review
            constraints</summary
          >
          <ul>
            {#each system.diagnostics as notice, index}<li>{notice}</li>{/each}
          </ul>
        </details>{/if}{#if tab === 'Overview'}<div
          class={`preview-grid ${mode !== 'split' ? 'single' : ''}`}
        >
          {#each modes as previewMode (previewMode)}<ThemePreview mode={previewMode} {system} />{/each}
        </div>
        <StateOverview
          {system}
          mode={mode === 'dark' ? 'dark' : 'light'}
          onSelect={select}
        />{/if}{#if tab === 'Semantic matrix'}<div class="view-intro">
          <h2>Same roles. Different intents.</h2>
          <p>Compare every generated color. Select a cell to inspect its primitive, usage, and contrast.</p>
        </div>
        <Matrix
          {system}
          {modes}
          {selected}
          onSelect={(next) => {
            selected = next;
          }}
        />{/if}{#if tab === 'Primitive palette'}<Primitives {system} />{/if}{#if tab === 'Export'}<ExportPanel
          {system}
          onImport={importConfiguration}
        />{/if}{#if tab !== 'Export'}<ContrastTable {system} {modes} />{/if}<ModelNotes />{/if}
    <footer class="workspace-footer">
      <span>Semantic Color System Generator</span><span>Six semantic families</span>
    </footer>
  </main>
</div>
