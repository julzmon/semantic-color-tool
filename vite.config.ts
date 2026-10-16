import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { parseKdsTokens } from './src/engine/reference';

const referencePath = fileURLToPath(new URL('./src/reference/kds-tokens.css', import.meta.url));

// Parse the immutable source at build time, keeping PostCSS's Node dependencies
// out of the browser. The same pure importer is tested against the real fixture.
export default defineConfig({
  // Mounted component tests need Svelte's browser lifecycle APIs.
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  // Relative production paths support the repository's GitHub Pages project URL.
  base: './',
  plugins: [svelte(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: 'Semantic Color System Generator',
      short_name: 'Semantic Colors',
      description: 'Create accessible semantic color systems with light and dark themes.',
      id: './',
      start_url: './',
      scope: './',
      display: 'standalone',
      theme_color: '#f6f7f8',
      background_color: '#f6f7f8',
      icons: [
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // Icons and manifest are added by the plugin; this includes worker chunks.
      globPatterns: ['**/*.{js,css,html}'],
      cleanupOutdatedCaches: true,
      navigateFallback: 'index.html',
    },
  }), {
    name: 'kds-reference',
    resolveId(id) { if (id === 'virtual:kds-reference') return '\0virtual:kds-reference'; },
    load(id) {
      if (id !== '\0virtual:kds-reference') return;
      this.addWatchFile(referencePath);
      return `export default ${JSON.stringify(parseKdsTokens(readFileSync(referencePath, 'utf8')))};`;
    },
  }],
});
