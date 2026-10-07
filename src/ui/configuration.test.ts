import { describe, expect, it } from 'vitest';
import { loadStoredConfiguration, parseConfigurationJson, saveStoredConfiguration } from './configuration';
import type { BuilderConfig } from '../engine/types';

function defaults(): BuilderConfig {
  return {
    version: 2,
    surfaces: {
      light: { l: 1 },
      dark: { l: 0.2 },
      levels: 3,
      step: { light: 0.035, dark: 0.015 },
    },
    families: [
      { id: 'neutral', key: 'gray', label: 'Neutral', hue: 208, chroma: 0.02 },
      { id: 'brand', key: 'brand', label: 'Brand', hue: 28, chroma: 0.16 },
      { id: 'info', key: 'blue', label: 'Info', hue: 228, chroma: 0.12 },
      { id: 'positive', key: 'green', label: 'Positive', hue: 145, chroma: 0.14 },
      { id: 'negative', key: 'red', label: 'Negative', hue: 28, chroma: 0.16 },
      { id: 'warning', key: 'yellow', label: 'Warning', hue: 92, chroma: 0.14 },
    ],
    muted: { distance: 0.055, separation: 0.025 },
    emphasis: { separation: 0.045, selected: false },
    targets: { normalText: 4.5, largeText: 3, ui: 3 },
    anchors: [],
  };
}

function legacyV1(): BuilderConfig {
  const input = defaults();
  return {
    ...input,
    version: 1,
    families: input.families.filter((family) => family.id === 'neutral' || family.id === 'info'),
    surfaces: { ...input.surfaces, step: 0.025 },
  };
}

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('configuration lifecycle', () => {
  it('migrates direct version-1 JSON to the version supplied by defaults', () => {
    const input = legacyV1();

    const result = parseConfigurationJson(JSON.stringify(input), defaults());

    expect(result.version).toBe(2);
    expect(result.surfaces.step).toEqual({ light: 0.025, dark: 0.025 });
    expect(result.families.map((family) => family.id)).toEqual(['neutral', 'brand', 'info', 'positive', 'negative', 'warning']);
    expect(result.families.find((family) => family.id === 'brand')).toMatchObject({ hue: 28, chroma: 0.16 });
    expect(result).not.toBe(input);
  });

  it('accepts the current export envelope and returns its normalized configuration', () => {
    const input = defaults();
    input.anchors = [{ family: 'brand', mode: 'light', role: 'emphasis.base', color: 'oklch(0.5 0.12 28)', locked: true }];

    const result = parseConfigurationJson(JSON.stringify({ formatVersion: 1, scope: ['neutral', 'info'], config: input, validation: { checks: [] } }), defaults());

    expect(result.anchors).toEqual(input.anchors);
  });

  it('normalizes a legacy shared muted distance into both mode values', () => {
    const input = defaults();
    input.muted.distance = 0.075;

    const result = parseConfigurationJson(JSON.stringify(input), defaults());

    expect(result.muted.distance).toEqual({ light: 0.075, dark: 0.075 });
  });

  it('defaults imported emphasis configurations to shared themes', () => {
    const input = defaults();
    delete input.emphasis.strategy;

    const result = parseConfigurationJson(JSON.stringify(input), defaults());

    expect(result.emphasis.strategy).toBe('shared');
  });

  it('uses a cloned default when saved storage is unavailable or malformed', () => {
    const storage = new MemoryStorage();
    storage.setItem('test-config', '{not json');
    const result = loadStoredConfiguration(storage, defaults(), 'test-config');

    expect(result.restored).toBe(false);
    expect(result.config).toEqual(defaults());
    expect(result.config).not.toBe(defaults());
    expect(result.error).toMatch(/JSON/i);
  });

  it('round-trips a configuration through safe storage helpers', () => {
    const storage = new MemoryStorage();
    const input = defaults();
    input.surfaces.light.l = 0.97;

    expect(saveStoredConfiguration(storage, input, 'test-config')).toBe(true);
    expect(loadStoredConfiguration(storage, defaults(), 'test-config')).toMatchObject({ restored: true, config: { surfaces: { light: { l: 0.97 } } } });
  });
});
