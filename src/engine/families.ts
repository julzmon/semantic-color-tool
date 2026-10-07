/**
 * Fixed semantic families supported by the builder. Brand gets its own
 * generated palette namespace so it can differ from the Negative red family.
 */
export const FAMILY_IDS = ['neutral', 'brand', 'info', 'positive', 'negative', 'warning'] as const;
export type FamilyId = typeof FAMILY_IDS[number];

export const PALETTE_KEYS = ['gray', 'brand', 'blue', 'green', 'red', 'yellow'] as const;
export type PaletteKey = typeof PALETTE_KEYS[number];

export const REFERENCE_PALETTE_KEYS = ['gray', 'red', 'blue', 'green', 'yellow'] as const;
export type ReferencePaletteKey = typeof REFERENCE_PALETTE_KEYS[number];

export interface FamilyDefinition {
  id: FamilyId;
  /** Generated primitive namespace. */
  key: PaletteKey;
  label: string;
  /** Original KDS palette used only to seed the initial configuration. */
  referenceKey: ReferencePaletteKey;
  referenceToken: string;
}

export const FAMILY_DEFINITIONS: readonly FamilyDefinition[] = [
  { id: 'neutral', key: 'gray', label: 'Neutral', referenceKey: 'gray', referenceToken: '--kds-key-gray-700' },
  { id: 'brand', key: 'brand', label: 'Brand', referenceKey: 'red', referenceToken: '--kds-key-red-800' },
  { id: 'info', key: 'blue', label: 'Info', referenceKey: 'blue', referenceToken: '--kds-key-blue-700' },
  { id: 'positive', key: 'green', label: 'Positive', referenceKey: 'green', referenceToken: '--kds-key-green-700' },
  { id: 'negative', key: 'red', label: 'Negative', referenceKey: 'red', referenceToken: '--kds-key-red-700' },
  { id: 'warning', key: 'yellow', label: 'Warning', referenceKey: 'yellow', referenceToken: '--kds-key-yellow-700' },
];
