# Semantic Preview Design

## Goal

Show every generated semantic family in a realistic product preview while making Brand the primary-action color.

## Approved experience

Each light and dark preview keeps the existing project form, nested color-scheme region, and generated surface strip. The content area changes as follows:

- The primary **Save changes** button uses Brand emphasis base, hover, and active tokens.
- The current Info notice gains a decorative muted Info border.
- The notice expands into a compact **Status updates** group with four visible cards: Info, Positive, Warning, and Negative.
- Each card uses its family’s muted base background, muted base border, and base foreground. Its icon and text identify the status so color is not the only signal.
- The status cards use a two-column grid when space permits and collapse to one column at the existing narrow-preview breakpoint.

Neutral remains visible through the surface, input, secondary button, navigation, and nested region. Brand remains visible through the primary action. Therefore, the preview exposes all six families without adding a decorative swatch-only section.

## Technical design

`ThemePreview.tsx` owns a small, typed collection of the four status-card content records and renders it with `data-family` attributes. `styles.css` maps each family attribute directly to existing generated CSS semantic variables. No new engine tokens, configuration options, exports, or color calculations are needed.

The status cards are static preview content, so they do not use `role="alert"` or a live region. Native buttons and existing focus styling remain unchanged. The muted border is explicitly decorative; the builder continues to validate the text relationship on its muted background.

## Validation

- Server-render the preview in a focused test and assert that Brand is assigned to the primary action and that Info, Positive, Warning, and Negative cards are all present.
- Run the full test suite and production build.
- Inspect light, dark, and split browser previews. Confirm the Button’s base/hover/active state uses Brand and the status cards read correctly in both modes.
