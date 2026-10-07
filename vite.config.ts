import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { parseKdsTokens } from './src/engine/reference';

const referencePath = fileURLToPath(new URL('./src/reference/kds-tokens.css', import.meta.url));

// Parse the immutable source at build time, keeping PostCSS's Node dependencies
// out of the browser. The same pure importer is tested against the real fixture.
export default defineConfig({
  // Relative production paths support the repository's GitHub Pages project URL.
  base: './',
  plugins: [{
    name: 'kds-reference',
    resolveId(id) { if (id === 'virtual:kds-reference') return '\0virtual:kds-reference'; },
    load(id) {
      if (id !== '\0virtual:kds-reference') return;
      this.addWatchFile(referencePath);
      return `export default ${JSON.stringify(parseKdsTokens(readFileSync(referencePath, 'utf8')))};`;
    },
  }],
});
