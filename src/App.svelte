<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Selection } from './ui/types';
  import ModelNotes from './ui/ModelNotes.svelte';
  import ContrastTable from './ui/ContrastTable.svelte';
  import NeutralRoleMap from './ui/NeutralRoleMap.svelte';
  import Inspector from './ui/Inspector.svelte';
  import { handleModalKeydown } from './ui/settingsKeyboard';
  import ColorPopover from './ui/ColorPopover.svelte';
  import ColorInfo from './ui/ColorInfo.svelte';
  import { colorInspection } from './ui/colorInspection';
  import { createBalanceClient } from './engine/balance-client';
  import { adjustedControlKeys } from './ui/controlValues';
  import { defaultConfiguration } from './ui/defaultConfiguration';
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
  const initialConfig = defaultConfiguration(reference);
  const tabs = ['Overview', 'Color palette', 'Export'] as const;
  type Tab = (typeof tabs)[number];
  let primitivesModule: Promise<typeof import('./ui/Primitives.svelte')> | undefined;
  let exportModule: Promise<typeof import('./ui/ExportPanel.svelte')> | undefined;
  const loadPrimitives = () => primitivesModule ??= import('./ui/Primitives.svelte');
  const loadExport = () => exportModule ??= import('./ui/ExportPanel.svelte');
  const storage = browserStorage();
  const stored = loadStoredConfiguration(storage, initialConfig);
  let config = $state.raw<BuilderConfig>(stored.config);
  let draft = $state.raw<BuilderConfig>(stored.config);
  let system = $state.raw<GeneratedSystem | null>(null);
  let adjusted = $state<string[]>([]);
  let checking = $state(true);
  let initializing = $state(true);
  let initializationError = $state('');
  let undo = $state.raw<{ config: BuilderConfig; system: GeneratedSystem } | null>(null);
  let balancer: ReturnType<typeof createBalanceClient> | undefined;
  let editVersion = 0;
  let configurationStatus = $state('Loading your color system…');
  const initialize = async () => {
    const version = ++editVersion;
    initializing = checking = true;
    initializationError = '';
    try {
      balancer?.dispose();
      balancer = createBalanceClient(new Worker(new URL('./engine/balance.worker.ts', import.meta.url), { type: 'module' }));
      let balanced;
      let restoreError = '';
      try {
        balanced = await balancer.balance(initialConfig, stored.config);
      } catch (error) {
        if (version !== editVersion) return;
        restoreError = `Saved configuration could not meet contrast requirements; restored defaults. ${error instanceof Error ? error.message : ''}`;
        balanced = await balancer.balance(initialConfig, initialConfig);
      }
      if (version !== editVersion || !balanced) return;
      config = draft = balanced.config;
      system = balanced.system;
      adjusted = adjustedControlKeys(stored.config, balanced.config);
      configurationStatus = restoreError || balanced.message || stored.error || (stored.restored ? 'Your saved colors are restored.' : '');
    } catch (error) {
      if (version !== editVersion) return;
      initializationError = error instanceof Error ? error.message : 'Unable to load the color system.';
    } finally {
      if (version === editVersion) initializing = checking = false;
    }
  };
  onMount(() => {
    void initialize();
    return () => { editVersion++; balancer?.dispose(); };
  });
  let tab = $state<Tab>('Overview');
  let previewSelection = $state<Selection | null>(null);
  let previewInfo = $derived(system && previewSelection ? colorInspection(system, previewSelection) : undefined);
  let previewPopoverOpen = $state(false);
  let previewDetailsOpen = $state(false);
  const selectTab = (next: Tab) => {
    previewPopoverOpen = false;
    previewDetailsOpen = false;
    tab = next;
  };
  const inspectPreview = (mode: Mode, token: string) => { previewSelection = { mode, token }; };
  let settingsOpen = $state(false);
  let settingsCompact = $state(false);
  const settingsLayoutChanged = (compact: boolean) => {
    settingsCompact = compact;
    if (!compact) {
      settingsOpen = false;
      // The mobile close button disappears at this breakpoint.
      if (document.activeElement?.classList.contains('settings-close')) {
        document.querySelector<HTMLButtonElement>('#settings-panel button:not(.settings-close)')?.focus();
      }
    }
  };
  let settingsToggle = $state<HTMLButtonElement | undefined>(undefined);
  const openSettings = async () => {
    settingsOpen = true;
    await tick();
    document.querySelector<HTMLButtonElement>('#settings-panel .settings-close')?.focus();
  };
  const closeSettings = async () => {
    settingsOpen = false;
    await tick();
    if (settingsCompact) settingsToggle?.focus();
  };
  const handleSettingsKeydown = (event: KeyboardEvent) =>
    handleModalKeydown(event, settingsOpen, () => void closeSettings());
  let skipPersistence = false;
  $effect(() => {
    const currentConfig = config;
    if (!system || initializing) return;
    if (skipPersistence) {
      skipPersistence = false;
      return;
    }
    if (!saveStoredConfiguration(storage, currentConfig))
      configurationStatus = 'Changes could not be saved in this browser.';
  });
  const modes: Mode[] = ['light', 'dark'];
  const reset = async () => {
    const version = ++editVersion;
    checking = true;
    configurationStatus = 'Restoring default colors…';
    try {
      if (!balancer) throw new Error('Contrast checker is not ready. Previous settings retained.');
      const balanced = await balancer.balance(initialConfig, initialConfig);
      if (version !== editVersion || !balanced) return;
      skipPersistence = true;
      try { storage?.removeItem(CONFIGURATION_STORAGE_KEY); } catch { /* Storage is optional. */ }
      config = draft = balanced.config;
      system = balanced.system;
      adjusted = [];
      undo = null;
      configurationStatus = 'Default colors restored.';
    } catch (error) {
      if (version !== editVersion) return;
      draft = config;
      configurationStatus = error instanceof Error ? error.message : 'Unable to restore defaults. Previous settings retained.';
    } finally {
      if (version === editVersion) checking = false;
    }
  };
  const importConfiguration = async (json: string) => {
    const next = parseConfigurationJson(json, initialConfig);
    const accepted = await updateConfiguration(next);
    if (accepted === undefined) throw new Error('Import was superseded by a newer edit.');
    if (!accepted) throw new Error('Import was not accepted. Previous configuration retained.');
    configurationStatus ||= 'Imported settings saved.';
  };
  const updateConfiguration = async (next: BuilderConfig) => {
    if (!system) return false;
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
    <button class="primary-button" onclick={() => selectTab('Export')}>Export tokens</button>
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
        onCompactChange={settingsLayoutChanged}
        onClose={() => void closeSettings()}
        onUndo={undoAdjustments}
        onChange={updateConfiguration}
        onReset={reset}
      />
    <main id="workspace" class="workspace" tabindex="-1" inert={settingsCompact && settingsOpen}>
      <nav class="workspace-tabs" aria-label="Workspace sections">
        <button class="settings-toggle" bind:this={settingsToggle} aria-label="Settings" title="Settings" aria-controls="settings-panel" aria-expanded={settingsOpen} onclick={() => void openSettings()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true" focusable="false">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {#each tabs as item}
          <button aria-current={tab === item ? 'page' : undefined} onclick={() => selectTab(item)}>{item}</button>
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
          {#each modes as previewMode (previewMode)}<ThemePreview mode={previewMode} {system} selectedToken={previewSelection?.mode === previewMode ? previewSelection.token : ''} onInspect={token => inspectPreview(previewMode, token)} />{/each}
        </div>
        <ColorPopover id="preview-color-info" title={previewInfo?.label ?? 'Color information'} anchorName="--preview-color-anchor" onOpenChange={open => { previewPopoverOpen = open; }}>
          {#if previewSelection && previewInfo}
            <ColorInfo inspection={previewInfo} />
            <details class="color-inspection-details" bind:open={previewDetailsOpen}><summary>All token details</summary><div class="color-inspection-full">{#if previewPopoverOpen && previewDetailsOpen}<Inspector {system} selected={previewSelection} />{/if}</div></details>
          {/if}
        </ColorPopover>
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
  {:else}
    <main id="workspace" class="workspace" tabindex="-1">
      {#if initializationError}
        <div role="alert"><p>{initializationError}</p><button class="secondary-button" onclick={() => void initialize()}>Retry loading</button></div>
      {:else}
        <p role="status" aria-busy="true">Loading your color system…</p>
      {/if}
    </main>
  {/if}
</div>
{#if system}<PwaStatus {checking} save={() => saveStoredConfiguration(storage, config)} />{/if}
