import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../vite.config';

describe('production hosting configuration', () => {
  it('emits relative asset paths so the app works on a GitHub Pages project site', () => {
    expect(config.base).toBe('./');
  });

  it('uses the committed pnpm lockfile for Pages builds', () => {
    const workflow = readFileSync(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('cache: pnpm');
    expect(workflow).toContain('corepack enable');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toContain('enablement: true');
  });
});
