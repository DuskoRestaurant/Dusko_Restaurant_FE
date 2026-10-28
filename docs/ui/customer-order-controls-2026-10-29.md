# Customer order controls — 2026-10-29

- History shows each dish in a list row with quantity and a semantic text badge. Confirmation/rejection override stale kitchen states; payment does not imply served. History follows normal page scrolling instead of a nested scroll box.
- Shared cart uses a common renderer in production and the visual fixture. A 44px trash target is separated from the quantity stepper; clear-all is in the cart heading and retains the existing production confirmation. Server line totals and shared basket behavior are preserved.
- Dish details has a compact 96–136px image, a separately scrolling body and an always-visible submit footer. Note hints distinguish drinks, food, hotpot and desserts; food names take precedence over miscategorized drink categories. Suggestions do not promise customization or create topping fees.
- Customer controls share token radii, touch targets, fonts and status colors. Scope is these customer components, not a redesign of management/staff screens.

Validation: full FE tests, all three production builds; fixture reviewed at 320×568, 390×844, 768×1024. Checked quantity/total updates and external-form submit in fixture only. No production orders or basket changes during QA.
