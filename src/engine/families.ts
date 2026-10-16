/**
 * Fixed semantic families supported by the builder. Brand gets its own
 * generated palette namespace so it can differ from the Negative red family.
 */
export const FAMILY_IDS = ['neutral', 'brand', 'info', 'positive', 'negative', 'warning'] as const;
export type FamilyId = typeof FAMILY_IDS[number];

export const PALETTE_KEYS = ['gray', 'brand', 'blue', 'green', 'red', 'yellow'] as const;
export type PaletteKey = typeof PALETTE_KEYS[number];

interface FamilyDefinition {
  id: FamilyId;
  /** Generated primitive namespace. */
  key: PaletteKey;
  label: string;
  referenceToken: string;
}

export const FAMILY_DEFINITIONS: readonly FamilyDefinition[] = [
  { id: 'neutral', key: 'gray', label: 'Neutral', referenceToken: '--kds-key-gray-700' },
  { id: 'brand', key: 'brand', label: 'Brand', referenceToken: '--kds-key-red-800' },
  { id: 'info', key: 'blue', label: 'Info', referenceToken: '--kds-key-blue-700' },
  { id: 'positive', key: 'green', label: 'Positive', referenceToken: '--kds-key-green-700' },
  { id: 'negative', key: 'red', label: 'Negative', referenceToken: '--kds-key-red-700' },
  { id: 'warning', key: 'yellow', label: 'Warning', referenceToken: '--kds-key-yellow-700' },
];
