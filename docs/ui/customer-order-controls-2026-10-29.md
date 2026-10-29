# Customer order controls — 2026-10-29

- History shows each dish in a list row with quantity and a semantic text badge. Confirmation/rejection override stale kitchen states; payment does not imply served. History follows normal page scrolling instead of a nested scroll box.
- Shared cart uses a common renderer in production and the visual fixture. A 44px trash target is separated from the quantity stepper; clear-all is in the cart heading and retains the existing production confirmation. Server line totals and shared basket behavior are preserved.
- Dish details has a compact 96–136px image, a separately scrolling body and an always-visible submit footer. Note hints distinguish drinks, food, hotpot and desserts; food names take precedence over miscategorized drink categories. Suggestions do not promise customization or create topping fees.
- Customer controls share token radii, touch targets, fonts and status colors. Scope is these customer components, not a redesign of management/staff screens.

Validation: full FE tests, all three production builds; fixture reviewed at 320×568, 390×844, 768×1024. Checked quantity/total updates and external-form submit in fixture only. No production orders or basket changes during QA.


## Separate history view and reachable cart actions

- Table assistance/payment actions keep short labels and fixed status space. Pending requests disable only their action; a send in progress blocks repeat actions. Existing temporary success toasts remain.
- History is a separate document view (`#history`) with Back, browser back/forward support, a direct-link empty state and retained menu DOM. There is no accordion or extra modal. Existing polling/live order updates continue in the history view.
- The cart has one visible title. Only its item area scrolls; total, submit and inline clear-all confirmation remain in a fixed footer. The checkout action sends directly, retaining session/stock/busy guards and idempotency. Clearing all still requires explicit inline confirmation.
- Detail/cart opens reject a second open dialog. Quantity and notes are edited directly in the cart. Dish details retains its separately pinned footer.

QA: fixture at 320×568 with ten cart lines, scrolled to the last note: submit bottom 515px inside 568px viewport. Clear-all keeps exactly one open dialog and Cancel preserves all lines. History navigation and browser Back restore the menu. Also checked mobile/tablet layout and built customer, staff and management targets. Production QA must only inspect, never send test orders or service requests.


## Combo category, bundle cards and dish gallery

Approved combinations now appear as normal cards in a Combo category, participating in search and sticky category tracking. There is no large combo block above the menu. The cart allocates component quantities to bundle cards with the discounted package price and controls for number of packages; extra loose units remain separate. Cards include a thumbnail, background, border and spacing. Notes for components remain product-scoped and this is stated next to the inputs.

The backend adds POST /api/public/tables/:token/cart/combos/change. It validates approved bundle identity and current price, checks stock and changes component quantities and bundle selection in a serializable transaction with conflict retries. Clear-cart removes bundle markers; checkout consumes the ordered bundle quantities while retaining concurrent additions. No schema migration is required.

Dish galleries render provided images with object-fit:contain and native horizontal scroll snap, previous/next buttons and keyboard navigation. A dish with one image stays single-image. Existing production data currently has only imageUrl; imageUrls/images are supported when supplied. Fixture-only rice images test the multiple-image behavior; production does not fabricate angles.

Validation: FE tests cover bundle allocation, overlapping/incomplete groups, server totals and gallery image normalization. BE unit tests pass; isolated CI integration covers rollback on changed price, concurrent additions, whole-bundle removal preserving loose units, checkout consumption and clear-cart. Visual checks use 390px and 320px widths; fixture bundle 115,000 plus existing loose 123,000 produces 238,000, two bundles produce 353,000 and removing bundles returns 123,000. Gallery next changes 1/2 to 2/2; submit footer stays within viewport.
