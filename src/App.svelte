<script lang="ts">
  import { onMount } from 'svelte';
  import type { PreviewMode, Selection } from './ui/types';
  import ModelNotes from './ui/ModelNotes.svelte';
  import ContrastTable from './ui/ContrastTable.svelte';
  import NeutralRoleMap from './ui/NeutralRoleMap.svelte';
  import Primitives from './ui/Primitives.svelte';
  import Matrix from './ui/Matrix.svelte';
  import StateOverview from './ui/StateOverview.svelte';
  import ModeSwitch from './ui/ModeSwitch.svelte';
  import { balanceConfiguration } from './engine/balance';
  import { createBalanceClient } from './engine/balance-client';
  import { adjustedControlKeys } from './ui/controlValues';
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
  const restored = (() => {
    try {
      return balanceConfiguration(initialConfig, stored.config);
    } catch (error) {
      return {
        ...balanceConfiguration(initialConfig, initialConfig),
        message: `Saved configuration could not meet contrast requirements; restored defaults. ${error instanceof Error ? error.message : ''}`,
      };
    }
  })();
  let config = $state.raw<BuilderConfig>(restored.config);
  let draft = $state.raw<BuilderConfig>(restored.config);
  let system = $state.raw<GeneratedSystem>(restored.system);
  let adjusted = $state<string[]>(adjustedControlKeys(stored.config, restored.config));
  let checking = $state(false);
  let undo = $state.raw<{ config: BuilderConfig; system: GeneratedSystem } | null>(null);
  let balancer: ReturnType<typeof createBalanceClient> | undefined;
  let editVersion = 0;
  onMount(() => {
    balancer = createBalanceClient(new Worker(new URL('./engine/balance.worker.ts', import.meta.url), { type: 'module' }));
    return () => balancer?.dispose();
  });
  let configurationStatus = $state(
    restored.message || stored.error || (stored.restored ? 'Restored the saved configuration.' : ''),
  );
  let mode = $state<PreviewMode>('split');
  let tab = $state<Tab>('Overview');
  let selected = $state<Selection>({ mode: 'light', family: 'brand', role: 'emphasis.base' });
  let skipPersistence = false;
  $effect(() => {
    const currentConfig = config;
    if (skipPersistence) {
      skipPersistence = false;
      return;
    }
    if (!saveStoredConfiguration(typeof window === 'undefined' ? null : window.localStorage, currentConfig))
      configurationStatus = 'Changes could not be saved in this browser.';
  });
  let modes: Mode[] = $derived(mode === 'split' ? ['light', 'dark'] : [mode]);
  const select = (selection: Selection) => {
    selected = selection;
    tab = 'Semantic matrix';
  };
  const reset = () => {
    editVersion++;
    checking = false;
    adjusted = [];
    undo = null;
    skipPersistence = true;
    try {
      window.localStorage.removeItem(CONFIGURATION_STORAGE_KEY);
    } catch {
      /* Browser storage is optional. */
    }
    const balanced = balanceConfiguration(initialConfig, initialConfig);
    config = draft = balanced.config;
    system = balanced.system;
    configurationStatus = 'Restored defaults and cleared the saved configuration.';
  };
  const importConfiguration = async (json: string) => {
    const next = parseConfigurationJson(json, initialConfig);
    const accepted = await updateConfiguration(next);
    if (accepted === undefined) throw new Error('Import was superseded by a newer edit.');
    if (!accepted) throw new Error('Import was not accepted. Previous configuration retained.');
    configurationStatus ||= 'Imported configuration saved for this browser.';
  };
  const updateConfiguration = async (next: BuilderConfig) => {
    const version = ++editVersion;
    const previous = { config, system };
    checking = true;
    draft = next;
    configurationStatus = 'Checking contrast… Preview and exports retain the last verified result.';
    try {
      if (!balancer) throw new Error('Contrast checker is not ready. Previous settings retained.');
      const balanced = await balancer.balance(config, next);
      if (!balanced || version !== editVersion) return undefined;
      adjusted = adjustedControlKeys(next, balanced.config);
      undo = adjusted.length ? previous : null;
      checking = false;
      config = draft = balanced.config;
      system = balanced.system;
      configurationStatus = balanced.message;
      return true;
    } catch (error) {
      if (version !== editVersion) return undefined;
      checking = false;
      draft = config;
      configurationStatus = error instanceof Error ? error.message : 'Unable to keep all checked contrast relationships passing. Previous settings retained.';
      return false;
    }
  };
  const undoAdjustments = () => {
    if (!undo) return;
    editVersion++;
    config = draft = undo.config;
    system = undo.system;
    undo = null;
    adjusted = [];
    checking = false;
    configurationStatus = 'Undid the last change and its automatic adjustments. Restored the previous verified colors.';
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
    config={draft}
    {adjusted}
    {checking}
    canUndo={!!undo}
    onUndo={undoAdjustments}
    onChange={updateConfiguration}
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
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus allows users to scroll long feedback messages.) -->
    <div class="configuration-status" role="region" aria-label="Configuration feedback" tabindex="0">
      <p role="status">
        {configurationStatus}
      </p>
    </div>{#if system}<div class="metrics-strip">
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
          prefix={draft.prefix}
          onPrefixChange={(prefix) => updateConfiguration({ ...draft, prefix })}
          onImport={importConfiguration}
        />{/if}{#if tab !== 'Export'}<NeutralRoleMap {system} {modes} /><ContrastTable {system} {modes} />{/if}<ModelNotes />{/if}
    <footer class="workspace-footer">
      <span>Semantic Color System Generator</span><span>Six semantic families</span>
    </footer>
  </main>
</div>
