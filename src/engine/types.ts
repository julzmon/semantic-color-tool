import type { FamilyId, PaletteKey } from './families';

export type { FamilyId, PaletteKey } from './families';

export type Mode = 'light' | 'dark';
export type State = 'base' | 'hover' | 'active' | 'selected';
export type FamilyRole = `muted.${State}` | `emphasis.${State}` | 'foreground.base' | 'foreground.hover' | 'border.muted.base' | 'border.muted.hover' | 'border.emphasis.base' | 'border.emphasis.hover';

export interface OklchColor { l: number; c: number; h: number }
export interface ColorValue extends OklchColor {
  css: string;
  hex: string;
  gamutMapped: boolean;
  /** Exact opaque source for a lock. Never silently gamut-map locked colors. */
  source?: string;
}
export interface FamilyConfig { id: FamilyId; key: PaletteKey; label: string; hue: number; chroma: number }
export interface ColorAnchor {
  family: FamilyId;
  mode: Mode | 'both';
  role: 'emphasis.base' | 'foreground.base';
  color: string;
  locked: boolean;
}
export interface BuilderConfig {
  /** Version 1 configurations remain readable while the generator migrates them. */
  version: 1 | 2;
  prefix: string;
  surfaces: { light: { l: number }; dark: { l: number }; levels: number; step: number | Record<Mode, number> };
  families: FamilyConfig[];
  muted: { distance: number | Record<Mode, number>; separation: number; chromaScale?: Record<Mode, number> };
  emphasis: { separation: number; selected: boolean; strategy?: 'shared' | 'adaptive' };
  targets: { normalText: number; largeText: number; ui: number };
  anchors: ColorAnchor[];
}
export interface GeneratedRole {
  color: ColorValue;
  primitive: string;
  semantic: string;
  /** Other semantic token names using this primitive in this mode. */
  sharedWith: string[];
}
export interface GeneratedFamily {
  id: FamilyId;
  key: PaletteKey;
  roles: Partial<Record<FamilyRole, GeneratedRole>>;
}
export interface ModeTheme {
  surfaces: GeneratedRole[];
  foreground: { base: GeneratedRole; muted: GeneratedRole; onEmphasis: GeneratedRole };
  families: Record<FamilyId, GeneratedFamily>;
}
export interface Primitive { name: string; family: PaletteKey; color: ColorValue; usages: string[] }
export interface SemanticToken { name: string; light: string; dark: string }
export interface ContrastCheck {
  id: string;
  mode: Mode;
  family?: FamilyId;
  foreground: string;
  background: string;
  foregroundColor: ColorValue;
  backgroundColor: ColorValue;
  ratio: number;
  target: number;
  pass: boolean;
  kind: 'normal-text' | 'large-text' | 'ui-boundary';
}
export interface GeneratedSystem {
  config: BuilderConfig;
  modes: Record<Mode, ModeTheme>;
  primitives: Primitive[];
  semantics: SemanticToken[];
  checks: ContrastCheck[];
  diagnostics: string[];
}
export interface KdsReference {
  primitives: Record<string, string>;
  semantics: Record<Mode, Record<string, string>>;
  resolved: Record<Mode, Record<string, string>>;
  warnings: string[];
}
