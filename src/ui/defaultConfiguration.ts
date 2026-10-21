import { configFromReference } from '../engine/config';
import { withMutedStateControls } from '../engine/muted';
import type { KdsReference } from '../engine/types';
import { applyBrandAnchors } from './brandAnchor';

/** App defaults; existing saved and imported configurations retain their colors. */
export function defaultConfiguration(reference: KdsReference) {
  const config = withMutedStateControls(configFromReference(reference));
  return applyBrandAnchors(config, [{
    family: 'brand', color: '#cc0000', role: 'emphasis.base', mode: 'light', locked: false,
  }]);
}
