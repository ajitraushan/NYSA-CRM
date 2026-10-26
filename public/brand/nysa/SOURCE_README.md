# NYSA logo production artwork

This set preserves the exact outlined paths from the supplied NYSA artwork. It removes all Gaussian blur filters, drop shadows, stray grey, live text and external dependencies.

## Colours

- Light backgrounds: ink `#14232c`, gold `#8f6a30`
- Dark backgrounds: white `#ffffff`, gold `#b88f4f`
- Recommended light background: `#faf8f3`
- Recommended dark background: `#04121d`

## Usage

- Use the horizontal lockup in website headers and other wide, shallow spaces.
- Use the stacked lockup in footers, documents and square or portrait placements.
- Below 140px horizontal width or 90px stacked width, use the mark alone.
- Minimum clear space on every side is half the cap height of the N.
- Do not add shadows, blur, gradients, outlines or recolour the files.

The `raster` directory contains transparent @1x, @2x and @3x PNG exports, favicon sizes, an Apple touch icon, a 512px app icon and the 1200 x 630 social-share image.

## Source integrity

All lettering remains outlined. No font is required. Rebuild with `node scripts/build-logo-assets.mjs`.
