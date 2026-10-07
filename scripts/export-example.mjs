import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' });
try {
  const { generateSystem } = await vite.ssrLoadModule('/src/engine/generate.ts');
  const { parseKdsTokens, configFromReference } = await vite.ssrLoadModule('/src/engine/reference.ts');
  const { exportCss, exportDtcg, exportDtcgFiles } = await vite.ssrLoadModule('/src/engine/export.ts');
  const system = generateSystem(configFromReference(parseKdsTokens(await readFile('src/reference/kds-tokens.css', 'utf8'))));
  const files = { ...exportDtcgFiles(system), 'kds.bundle.resolver.json': exportDtcg(system), 'kds.css': exportCss(system) };
  for (const [name, contents] of Object.entries(files)) {
    const path = resolve('docs/examples', name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
  console.log(`Exported ${Object.keys(files).length} files; ${system.checks.length} checks, ${system.checks.filter((check) => !check.pass).length} failures.`);
} finally {
  await vite.close();
}
