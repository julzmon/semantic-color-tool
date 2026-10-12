<script lang="ts">
  import { onMount } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';
  import { applyPwaUpdate } from './pwa-update';

  let { checking, save }: { checking: boolean; save: () => boolean } = $props();
  let ready = $state(false);
  let refresh = $state(false);
  let applying = $state(false);
  let error = $state('');
  let update: ((reload?: boolean) => Promise<void>) | undefined;
  let reloadRequested = false;
  let updateActivated = false;

  onMount(() => {
    let registration: ServiceWorkerRegistration | undefined;
    update = registerSW({
      onOfflineReady() { ready = true; },
      onNeedRefresh() { refresh = true; },
      onNeedReload() {
        updateActivated = true;
        refresh = true;
        if (reloadRequested) void finishReload();
      },
      onRegisteredSW(_url, next) { registration = next; },
    });
    const checkUpdate = () => { void registration?.update().catch(() => {}); };
    window.addEventListener('focus', checkUpdate);
    return () => window.removeEventListener('focus', checkUpdate);
  });

  async function finishReload() {
    const result = await applyPwaUpdate(checking || !reloadRequested, save, async () => window.location.reload());
    if (result !== 'updated') {
      reloadRequested = false;
      error = result === 'busy' ? 'Finish your changes, then reload when ready.' : 'Could not save settings. Export your configuration before updating.';
    }
  }

  async function reload() {
    if (!update || applying) return;
    applying = true;
    error = '';
    try {
      if (updateActivated) {
        reloadRequested = true;
        await finishReload();
        return;
      }
      const result = await applyPwaUpdate(checking, save, async () => {
        reloadRequested = true;
        await update!(true);
      });
      if (result === 'storage-failed') error = 'Could not save settings. Export your configuration before updating.';
    } catch {
      reloadRequested = false;
      error = 'Update could not be loaded. Please try again when connected.';
    } finally {
      applying = false;
    }
  }
</script>

{#if ready || refresh}
  <aside class="pwa-notice" aria-label="App availability">
    <p role="status">{refresh ? 'Update available' : 'Ready to work offline'}</p>
    {#if error}<p role="alert">{error}</p>{/if}
    <div>
      {#if refresh}<button onclick={reload} disabled={checking || applying}>{applying ? 'Updating…' : 'Reload to update'}</button>{/if}
      <button onclick={() => { ready = false; refresh = false; reloadRequested = false; error = ''; }}>{refresh ? 'Later' : 'Dismiss'}</button>
    </div>
  </aside>
{/if}

<style>
  .pwa-notice {
    position: fixed;
    inset-inline-end: 1rem;
    inset-block-end: 1rem;
    z-index: 100;
    max-inline-size: min(26rem, calc(100dvw - 2rem));
    padding: 1rem;
    background: #fff;
    color: #19282c;
    border: 1px solid #b8c5c8;
    border-radius: .75rem;
    box-shadow: 0 4px 24px #19282c26;
    font-size: 16px;

    & p { margin: 0 0 .75rem; line-height: 1.5; }
    & div { display: flex; gap: .5rem; flex-wrap: wrap; }
    & button {
      font: inherit;
      padding: .5rem .75rem;
      border-radius: .35rem;
      border: 1px solid #607378;
      background: #fff;
      color: #19282c;
      cursor: pointer;

      &:first-child:not(:last-child) { background: #006e78; color: #fff; }
      &:disabled { opacity: .6; cursor: wait; }
    }
  }
</style>
