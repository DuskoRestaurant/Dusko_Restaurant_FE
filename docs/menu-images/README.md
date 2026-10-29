# Menu images and combo ordering — 2026-10-29

Added image mappings for 93 named food/drink products with previously empty images; existing product images are untouched. The unidentified VNP-78ba2320 test entry is excluded.

79 new WebP assets (44 AI illustrations and 35 attributed Commons photographs) plus 6 existing restaurant assets cover the 93 products. Repeated drinks use the same matching image. Credits and licenses are published at /menu-image-credits.html and linked below the customer menu. Images are labelled illustrative.

Combos appear before individual dishes in both the menu sections and category navigation, including when combos load asynchronously. Filtering, bundle price and add-to-cart behavior remain intact.

Validation: 98 unit tests; all three application builds; browser checks at 1440px and 390px, combo-first ordering and add action, all 85 unique assets decode, no horizontal overflow or browser errors. Contact sheets were visually reviewed. Final menu screenshots are in ../ui/menu-images/.

Deployment order: frontend assets, then the backend repository's guarded fill-menu-images.mjs utility. This only fills empty imageUrl values after checking product names, live image responses and saving a backup.
