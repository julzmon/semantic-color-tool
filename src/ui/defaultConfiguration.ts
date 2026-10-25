import { withChromaCurves } from '../engine/chroma-curves';
import { configFromReference } from '../engine/config';
import { withMutedStateControls } from '../engine/muted';
import type { KdsReference } from '../engine/types';
import { applyBrandAnchors } from './brandAnchor';

/** App defaults use two shared-theme chroma profiles. Legacy app imports migrate explicitly. */
export function defaultConfiguration(reference: KdsReference) {
  const config = withMutedStateControls(configFromReference(reference));
  return withChromaCurves(applyBrandAnchors(config, [{
    family: 'brand', color: '#cc0000', role: 'emphasis.base', mode: 'light', locked: false,
  }]));
}
