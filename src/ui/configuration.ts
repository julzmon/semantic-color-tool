import { validateConfig } from '../engine/generate';
import type { BuilderConfig } from '../engine/types';

type RecordValue = Record<string, unknown>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StoredConfiguration {
  config: BuilderConfig;
  restored: boolean;
  error?: string;
}

export const CONFIGURATION_STORAGE_KEY = 'kds-color-system-builder/configuration';

function isRecord(value: unknown): value is RecordValue {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown, path: string): RecordValue {
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
  return value;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value;
}

function copyFamily(value: unknown, path: string): RecordValue {
  const family = record(value, path);
  return { id: family.id, key: family.key, label: family.label, hue: family.hue, chroma: family.chroma };
}

function copyAnchor(value: unknown, path: string): RecordValue {
  const anchor = record(value, path);
  return { family: anchor.family, mode: anchor.mode, role: anchor.role, color: anchor.color, locked: anchor.locked };
}

function normalizeSurfaces(value: unknown): RecordValue {
  const surfaces = record(value, 'Configuration surfaces');
  const light = record(surfaces.light, 'Configuration surfaces.light');
  const dark = record(surfaces.dark, 'Configuration surfaces.dark');
  const legacyStep = surfaces.step;
  const step = typeof legacyStep === 'number'
    ? { light: legacyStep, dark: legacyStep }
    : (() => {
      const split = record(legacyStep, 'Configuration surfaces.step');
      return { light: split.light, dark: split.dark };
    })();
  return { light: { l: light.l }, dark: { l: dark.l }, levels: surfaces.levels, step };
}

function normalizeMuted(value: unknown): RecordValue {
  const muted = record(value, 'Configuration muted');
  const legacyDistance = muted.distance;
  const distance = typeof legacyDistance === 'number'
    ? { light: legacyDistance, dark: legacyDistance }
    : (() => {
      const split = record(legacyDistance, 'Configuration muted.distance');
      return { light: split.light, dark: split.dark };
    })();
  return { distance, separation: muted.separation };
}

function sourceConfig(value: unknown): RecordValue {
  const document = record(value, 'Configuration');
  if (!('config' in document)) return document;
  if ('formatVersion' in document && document.formatVersion !== 1) throw new Error('Unsupported configuration export format.');
  return record(document.config, 'Configuration export config');
}

/**
 * Converts a direct config or exported configuration envelope into the current
 * shape. Version 1 values receive the missing version-2 defaults, while
 * explicitly supplied values remain intact.
 */
export function normalizeConfiguration(value: unknown, defaults: BuilderConfig): BuilderConfig {
  const source = sourceConfig(value);
  const sourceVersion = source.version;
  const defaultVersion = defaults.version;
  if (sourceVersion !== 1 && sourceVersion !== defaultVersion) throw new Error('Unsupported builder configuration version.');

  const normalized = structuredClone(defaults) as unknown as RecordValue;
  normalized.version = defaultVersion;
  normalized.surfaces = normalizeSurfaces(source.surfaces);
  normalized.muted = normalizeMuted(source.muted);
  const emphasis = record(source.emphasis, 'Configuration emphasis');
  normalized.emphasis = { ...emphasis, strategy: emphasis.strategy ?? 'shared' };
  normalized.targets = { ...record(source.targets, 'Configuration targets') };
  normalized.anchors = list(source.anchors, 'Configuration anchors').map((anchor, index) => copyAnchor(anchor, `Configuration anchors[${index}]`));

  const expectedFamilies = list((defaults as unknown as RecordValue).families, 'Default configuration families').map((family, index) => copyFamily(family, `Default configuration families[${index}]`));
  const importedFamilies = list(source.families, 'Configuration families').map((family, index) => copyFamily(family, `Configuration families[${index}]`));
  const importedById = new Map(importedFamilies.map((family) => [family.id, family]));
  const expectedIds = new Set(expectedFamilies.map((family) => family.id));
  if (importedFamilies.some((family) => !expectedIds.has(family.id))) throw new Error('Configuration contains an unsupported color family.');
  if (sourceVersion === defaultVersion && importedFamilies.length !== expectedFamilies.length) throw new Error('Configuration is missing a required color family.');
  normalized.families = expectedFamilies.map((family) => importedById.get(family.id) ?? family);

  const config = normalized as unknown as BuilderConfig;
  validateConfig(config);
  return config;
}

export function parseConfigurationJson(json: string, defaults: BuilderConfig): BuilderConfig {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('Configuration JSON could not be parsed.');
  }
  return normalizeConfiguration(value, defaults);
}

function fallback(defaults: BuilderConfig, error?: string): StoredConfiguration {
  return { config: structuredClone(defaults), restored: false, ...(error ? { error } : {}) };
}

/** Reads browser storage without allowing unavailable or malformed storage to break the builder. */
export function loadStoredConfiguration(storage: StorageLike | null | undefined, defaults: BuilderConfig, key = CONFIGURATION_STORAGE_KEY): StoredConfiguration {
  if (!storage) return fallback(defaults);
  try {
    const json = storage.getItem(key);
    return json ? { config: parseConfigurationJson(json, defaults), restored: true } : fallback(defaults);
  } catch (error) {
    return fallback(defaults, error instanceof Error ? error.message : 'Saved configuration could not be restored.');
  }
}

/** Writes a minimal import-compatible configuration envelope and absorbs browser storage failures. */
export function saveStoredConfiguration(storage: StorageLike | null | undefined, config: BuilderConfig, key = CONFIGURATION_STORAGE_KEY): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify({ formatVersion: 1, config }));
    return true;
  } catch {
    return false;
  }
}
