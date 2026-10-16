<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Selection } from './ui/types';
  import ModelNotes from './ui/ModelNotes.svelte';
  import ContrastTable from './ui/ContrastTable.svelte';
  import NeutralRoleMap from './ui/NeutralRoleMap.svelte';
  import Inspector from './ui/Inspector.svelte';
  import { handleModalKeydown } from './ui/settingsKeyboard';
  import { lightDismiss } from './ui/lightDismiss';
  import { balanceConfiguration } from './engine/balance';
  import { createBalanceClient } from './engine/balance-client';
  import { adjustedControlKeys } from './ui/controlValues';
  import { configFromReference } from './engine/config';
  import {
    CONFIGURATION_STORAGE_KEY,
    browserStorage,
    loadStoredConfiguration,
    parseConfigurationJson,
    saveStoredConfiguration,
  } from './ui/configuration';
  import type { BuilderConfig, GeneratedSystem, Mode } from './engine/types';
  import reference from 'virtual:kds-reference';
  import Controls from './ui/Controls.svelte';
  import PwaStatus from './ui/PwaStatus.svelte';
  import ThemePreview from './ui/ThemePreview.svelte';
  const initialConfig = configFromReference(reference);
  const tabs = ['Overview', 'Color palette', 'Export'] as const;
  type Tab = (typeof tabs)[number];
  let primitivesModule: Promise<typeof import('./ui/Primitives.svelte')> | undefined;
  let exportModule: Promise<typeof import('./ui/ExportPanel.svelte')> | undefined;
  const loadPrimitives = () => primitivesModule ??= import('./ui/Primitives.svelte');
  const loadExport = () => exportModule ??= import('./ui/ExportPanel.svelte');
  const storage = browserStorage();
  const stored = loadStoredConfiguration(storage, initialConfig);
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
    restored.message || stored.error || (stored.restored ? 'Your saved colors are restored.' : ''),
  );
  let tab = $state<Tab>('Overview');
  let previewSelection = $state<Selection | null>(null);
  let previewInspector = $state<HTMLDialogElement>();
  const inspectPreview = async (mode: Mode, token: string) => {
    previewSelection = { mode, token };
    await tick();
    previewInspector?.showModal();
  };
  let settingsOpen = $state(false);
  let settingsToggle = $state<HTMLButtonElement | undefined>(undefined);
  const openSettings = async () => {
    settingsOpen = true;
    await tick();
    document.querySelector<HTMLButtonElement>('#settings-panel .settings-close')?.focus();
  };
  const closeSettings = async () => {
    settingsOpen = false;
    await tick();
    settingsToggle?.focus();
  };
  const handleSettingsKeydown = (event: KeyboardEvent) =>
    handleModalKeydown(event, settingsOpen, () => void closeSettings());
  let skipPersistence = false;
  $effect(() => {
    const currentConfig = config;
    if (skipPersistence) {
      skipPersistence = false;
      return;
    }
    if (!saveStoredConfiguration(storage, currentConfig))
      configurationStatus = 'Changes could not be saved in this browser.';
  });
  const modes: Mode[] = ['light', 'dark'];
  const reset = () => {
    editVersion++;
    checking = false;
    adjusted = [];
    undo = null;
    skipPersistence = true;
    try {
      storage?.removeItem(CONFIGURATION_STORAGE_KEY);
    } catch {
      /* Browser storage is optional. */
    }
    const balanced = balanceConfiguration(initialConfig, initialConfig);
    config = draft = balanced.config;
    system = balanced.system;
    configurationStatus = 'Default colors restored.';
  };
  const importConfiguration = async (json: string) => {
    const next = parseConfigurationJson(json, initialConfig);
    const accepted = await updateConfiguration(next);
    if (accepted === undefined) throw new Error('Import was superseded by a newer edit.');
    if (!accepted) throw new Error('Import was not accepted. Previous configuration retained.');
    configurationStatus ||= 'Imported settings saved.';
  };
  const updateConfiguration = async (next: BuilderConfig) => {
    const version = ++editVersion;
    const previous = { config, system };
    checking = true;
    draft = next;
    configurationStatus = 'Checking contrast… Your previous colors remain available.';
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
    configurationStatus = 'Last change undone. Your previous colors are restored.';
  };
</script>

{#snippet viewLoadError()}
  <div role="alert">
    <p class="help">This view could not load. Reload the application to try again.</p>
    <button class="secondary-button" onclick={() => window.location.reload()}>Reload application</button>
  </div>
{/snippet}

<a class="skip-link" href="#workspace">Skip to workspace</a>
<header class="app-header">
  <div class="brand-name">Semantic Color System Generator</div>
  <div class="header-end">
    <button class="primary-button" onclick={() => (tab = 'Export')}>Export tokens</button>
  </div>
</header>
<div class="workspace-shell">
  {#if system}
    <div class="app-layout">
      {#if settingsOpen}<button class="settings-backdrop" aria-label="Close settings" onclick={() => void closeSettings()}></button>{/if}
      <Controls
        config={draft}
        {system}
        {adjusted}
        {checking}
        canUndo={!!undo}
        settingsOpen={settingsOpen}
        onKeydown={handleSettingsKeydown}
        onClose={() => void closeSettings()}
        onUndo={undoAdjustments}
        onChange={updateConfiguration}
        onReset={reset}
      />
    <main id="workspace" class="workspace" tabindex="-1">
      <nav class="workspace-tabs" aria-label="Workspace sections">
        <button class="settings-toggle" bind:this={settingsToggle} aria-label="Settings" title="Settings" aria-controls="settings-panel" aria-expanded={settingsOpen} onclick={() => void openSettings()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true" focusable="false">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {#each tabs as item}
          <button aria-current={tab === item ? 'page' : undefined} onclick={() => (tab = item)}>{item}</button>
        {/each}
      </nav>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus allows users to scroll long feedback messages.) -->
      <div class="configuration-status" role="region" aria-label="Configuration feedback" tabindex="0">
        <p role="status">{configurationStatus}</p>
      </div>
      {#if system.diagnostics.length > 0}
        <details class="diagnostics">
          <summary>{system.diagnostics.length} generation notice{system.diagnostics.length === 1 ? '' : 's'} — review constraints</summary>
          <ul>{#each system.diagnostics as notice}<li>{notice}</li>{/each}</ul>
        </details>
      {/if}
      {#if tab === 'Overview'}
        <div class="preview-grid">
          {#each modes as previewMode (previewMode)}<ThemePreview mode={previewMode} {system} onInspect={token => void inspectPreview(previewMode, token)} />{/each}
        </div>
        <dialog class="role-map-dialog preview-inspector-dialog" closedby="any" use:lightDismiss bind:this={previewInspector} aria-labelledby="preview-inspector-title">
          <div class="role-map-dialog-heading"><h3 id="preview-inspector-title">Token details</h3><button class="secondary-button" onclick={() => previewInspector?.close()}>Close</button></div>
          {#if previewSelection}<Inspector {system} selected={previewSelection} />{/if}
        </dialog>
      {:else if tab === 'Color palette'}
        {#await loadPrimitives()}
          <p class="help" role="status">Loading color palette…</p>
        {:then { default: Primitives }}
          <Primitives {system} />
        {:catch}
          {@render viewLoadError()}
        {/await}
      {:else if tab === 'Export'}
        {#await loadExport()}
          <p class="help" role="status">Loading export…</p>
        {:then { default: ExportPanel }}
          <ExportPanel
            {system}
            prefix={draft.prefix}
            onPrefixChange={(prefix) => updateConfiguration({ ...draft, prefix })}
            onImport={importConfiguration}
          />
        {:catch}
          {@render viewLoadError()}
        {/await}
      {/if}
      <NeutralRoleMap {system} {modes} />
      {#if tab !== 'Export'}<ContrastTable {system} {modes} />{/if}
      <ModelNotes />
      </main>
    </div>
  {/if}
</div>
<PwaStatus {checking} save={() => {
  try { return saveStoredConfiguration(window.localStorage, config); }
  catch { return false; }
}} />
