<script lang="ts">
  import NestedSurfaceCard from './NestedSurfaceCard.svelte';
  import type { FamilyId, GeneratedSystem, Mode } from '../engine/types';
  import { previewStyle } from './presentation';
  type PreviewStatus = Readonly<{
    family: Extract<FamilyId, 'info' | 'positive' | 'warning' | 'negative'>;
    icon: string;
    title: string;
    description: string;
  }>;
  const PREVIEW_STATUSES: readonly PreviewStatus[] = [
    {
      family: 'info',
      icon: 'i',
      title: 'You’re all up to date',
      description: 'Your changes are ready for the team.',
    },
    {
      family: 'positive',
      icon: '✓',
      title: 'Ready to share',
      description: 'All required checks have passed.',
    },
    {
      family: 'warning',
      icon: '!',
      title: 'Review before publishing',
      description: 'A few choices need your attention.',
    },
    {
      family: 'negative',
      icon: '×',
      title: 'Needs attention',
      description: 'Resolve blockers before continuing.',
    },
  ];

  function surfaceLabel(index: number) {
    return index === 0 ? 'Base' : `Level ${index}`;
  }
  let { system, mode }: { system: GeneratedSystem; mode: Mode } = $props();
  let name = $state('Design foundations');
  let saved = $state(false);
  let theme = $derived(system.modes[mode]);
  let checks = $derived(system.checks.filter((check) => check.mode === mode));
  let failures = $derived(checks.filter((check) => !check.pass).length);
</script>

<article class="preview-shell">
  <header class="preview-heading">
    <span
      ><span aria-hidden="true">{mode === 'light' ? '☀' : '◐'}</span>
      {mode === 'light' ? 'Light' : 'Dark'} theme</span
    ><span class={`status-label ${failures ? 'fail' : ''}`}
      >{failures ? `${failures} failed checks` : 'Checks pass'}</span
    >
  </header>
  <div class="theme-preview" data-mode={mode} style={previewStyle(system)}>
    <div class="preview-product-heading">
      <div class="preview-logo" aria-hidden="true">K</div>
      <span>Workspace</span><span class="preview-avatar">JD</span>
    </div>
    <div class="preview-product-body">
      <span class="preview-overline">PROJECT OVERVIEW</span>
      <h3>A place for good work.</h3>
      <p class="preview-description">Bring your team, ideas, and next steps together.</p>
      <section class="preview-statuses" aria-labelledby={`status-updates-${mode}`}>
        <h4 id={`status-updates-${mode}`} class="preview-overline">STATUS UPDATES</h4>
        <div class="preview-status-grid">
          {#each PREVIEW_STATUSES as status}<div class="preview-alert" data-family={status.family}>
              <span class="preview-alert-icon" aria-hidden="true">{status.icon}</span>
              <div>
                <strong>{status.title}</strong>
                <p>{status.description}</p>
              </div>
            </div>{/each}
        </div>
      </section>
      <div class="preview-field">
        <label for={`project-${mode}`}>Project name</label><input
          id={`project-${mode}`}
          value={name}
          oninput={(event) => {
            name = event.currentTarget.value;
            saved = false;
          }}
        /><span>Interactive sample · changes stay in this preview.</span>
      </div>
      <div class="preview-actions">
        <button class="preview-primary" data-family="brand" onclick={() => (saved = true)}
          >{saved ? 'Saved in preview ✓' : 'Save changes ↗'}</button
        ><button
          class="preview-secondary"
          onclick={() => {
            name = 'Design foundations';
            saved = false;
          }}>Reset project</button
        >
      </div>
      <a class="preview-link" href="#contrast"
        >View contrast checks <span aria-hidden="true">↗</span></a
      >
      <section
        class="preview-nested"
        data-mode={mode === 'light' ? 'dark' : 'light'}
        aria-label={`Nested ${mode === 'light' ? 'dark' : 'light'} region`}
      >
        <strong>{mode === 'light' ? 'Dark' : 'Light'} within {mode}</strong>
        <p>The same semantic tokens follow this region’s color scheme.</p>
      </section>
      <section class="surface-demo" aria-label={`${mode === 'light' ? 'Light' : 'Dark'} surface-level cards`}>
        <div class="surface-demo-heading">
          <div>
            <span class="preview-overline">SURFACE LEVELS</span>
            <h4>Cards at each level</h4>
          </div>
          <span>Generated backgrounds</span>
        </div>
        <div class="surface-level-cards">
          {#each theme.surfaces as surface, index}<article
              class="surface-level-card"
              data-surface={surface.semantic}
              style:background={surface.color.css}
            >
              <span>{surfaceLabel(index)}</span><strong
                >{index === 0 ? 'Project summary' : `Card on ${surfaceLabel(index).toLowerCase()}`}</strong
              >
              <p>Use this level for grouped content.</p>
            </article>{/each}
        </div>
      </section>
      <section
        class="surface-demo surface-nesting-demo"
        aria-label={`${mode === 'light' ? 'Light' : 'Dark'} nested surface cards`}
      >
        <div class="surface-demo-heading">
          <div>
            <span class="preview-overline">NESTED SURFACES</span>
            <h4>Cards within cards</h4>
          </div>
          <span>Every level in context</span>
        </div>
        <NestedSurfaceCard surfaces={theme.surfaces} />
      </section>
    </div>
    <div class="surface-strip" aria-label={`${mode} generated surfaces`}>
      {#each theme.surfaces as surface, index}<div style:background={surface.color.css}>
          <span>{index === 0 ? 'Base' : `Level ${index}`}</span><code>{surface.color.hex}</code>
        </div>{/each}
    </div>
  </div>
</article>
