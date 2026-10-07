# Semantic Color System Generator naming and prefix design

## Goal

Rename the product to **Semantic Color System Generator** and let a designer choose the CSS custom-property prefix for generated tokens.

## Scope

- Replace public KDS product and reference language in the application, exported artifacts, package metadata, and README.
- Add `prefix` to the saved builder configuration.
- Default new configurations to `kds` so existing token names and user expectations remain unchanged.
- Preserve existing saved and imported configurations: a missing prefix is normalized to `kds`.
- Apply the selected prefix to generated primitives, semantic tokens, CSS component tokens, CSS mode rules, DTCG files, resolver filenames, token inspection, and contrast relationships.
- Retain the bundled source only as an internal seed for initial color values. It is not named or compared in the public product.

## Prefix behavior

The control accepts a namespace without the leading `--`, for example `acme` or `acme-ui`. Input is normalized to lowercase kebab-case and rejects values that cannot form a CSS custom property. The UI keeps the last valid configuration while an invalid value is being corrected, and explains the accepted format next to the field.

## Data flow

`BuilderConfig.prefix` is the single source of truth. Generation receives the configured prefix and emits all token names through shared naming helpers. Export and UI components consume emitted names instead of rebuilding `--kds-` strings. Imported configurations are migrated before validation; exports include the prefix in their configuration payload.

## Validation

- Unit tests cover default and migrated prefixes, prefix normalization/validation, and generated token names for a custom prefix.
- Export tests cover CSS and DTCG output with a custom prefix.
- UI tests cover the visible field label and persistence behavior.
- The full test suite and production build must pass.
