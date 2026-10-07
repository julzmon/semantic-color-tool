import type { FamilyId, FamilyRole, Mode } from '../engine/types';

export type PreviewMode = Mode | 'split';
export type Selection = { mode: Mode; family: FamilyId; role: FamilyRole };
