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
