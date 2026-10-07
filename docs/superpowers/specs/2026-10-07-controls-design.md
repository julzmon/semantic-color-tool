# Controls organization

Approved design: structure first; surfaces and neutrals; semantic families; muted fills grouped by theme; interaction states; namespace in Export. Surface count uses discrete buttons with base/level explanation. Selected state is global. Common controls remain visible; anchors and strategy details use native disclosure. Contrast protection stays visible with fixed targets in disclosure.

Every numeric slider gets a labeled number field committed on blur/Enter, cancelable with Escape, clamped and snapped to its range/step. Blank/nonfinite entries restore the current value with local feedback. Native range keyboard operation stays intact. Existing generator and contrast guard remain unchanged.

Compare requested with accepted numeric control values to identify automatic adjustments. Show badges beside those controls and offer one undo that restores the previous verified config/system. Invalidate pending worker requests on undo. New accepted edits replace that history. Prefix editing moves into Export while retaining normalization, validation and asynchronous guard behavior.
