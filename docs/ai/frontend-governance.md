# AI Frontend Governance

## 1. Purpose

This document defines operational rules for AI agents modifying the Dusko Restaurant frontend.

The goal is consistency without forcing migration, redesign, or refactoring.

## 2. Scope

Applies to frontend work in:
- Root/admin app: `Dusko_Restaurant_FE/`
- Customer app: `customer-web/`
- Staff app: `staff-app/`
- Shared frontend modules in `src/`

This document does not authorize source refactors, framework migrations, broad CSS cleanup, or new design-system implementation.

## 3. Non-Negotiable Principles

MUST preserve existing application boundaries.

MUST prefer existing patterns and helpers within their ownership boundary.

MUST centralize only cross-application semantics or primitives where reuse is already demonstrated.

MUST NOT standardize merely because two UI patterns look similar.

MUST remember: reuse does not mean merge.

## 4. Application Context Detection

Before changing frontend UI, AI MUST identify the application context:

```text
root/admin
customer-web
staff-app
shared src module
```

AI MUST identify:
- Who owns the UI.
- Who consumes the file.
- Whether the file is shared.
- Whether the change can affect another application.

## 5. Search Before Code

Before creating UI, AI MUST search the relevant application and shared modules.

AI MUST inspect:
- Relevant helper functions.
- Relevant CSS selectors.
- Nearby components/templates.
- `src/readability.css`.
- Relevant application-specific styles.

AI SHOULD use source search before writing code.

AI MUST NOT implement a new UI pattern before checking whether an equivalent or similar pattern already exists.

## 6. Reuse Before Create

If an existing pattern satisfies the requirement, AI MUST reuse it.

AI MUST NOT create a duplicate implementation merely because another implementation would be cleaner.

AI MUST NOT confuse visual similarity with architectural sameness.

Examples:
- `.btn` is not `.sw-button`.
- Customer `.dish` is not admin/staff product UI.

## 7. Visual Token Rules

When introducing NEW visual values, AI MUST inspect `src/readability.css` first.

If an appropriate existing token/value exists, AI MUST prefer it.

If no appropriate value exists, AI MAY introduce a new value only when justified by the requirement.

AI MUST NOT perform broad token migration.

Runtime theme rules:
- `src/pos-theme.css` is the final visual layer for Root/Admin, Customer, and Staff.
- `src/readability.css` is a supporting/reference layer and may be overridden at runtime.
- A visual change intended to be visible in the application MUST be added to the owning runtime stylesheet, normally `pos-theme.css` for shared theme values.
- AI MUST NOT add a token to `readability.css` alone and claim the runtime UI is updated.
- Any change to `pos-theme.css` MUST be checked against all three application contexts.

Approved visual foundation:
- Canvas: `#FBF7F2`
- Surface: `#FFFFFF`
- Ink: `#3B2923`
- Muted: `#7C6D64`
- Line: `#E8DED5`
- Primary terracotta: `#C85A3F`
- Primary dark: `#9F3F2D`
- Sage accent: `#71856A`
- Sage soft: `#E7EEE3`
- Warning: `#C58A32`
- Danger: `#B84A45`
- Success: `#4F8060`
- Spacing scale: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`
- Control radius: `10px`
- Card radius: `16px`
- Pill radius: `999px`
- Shadows are reserved for elevated cards and remain subtle.

AI MUST NOT rewrite existing CSS merely because it does not yet use `readability.css`.

## 8. Layout Rules

AI MUST inspect existing layout patterns before creating new layout CSS.

Root layout patterns include:
- `.layout`
- `.sidebar`
- `.main`
- `.topbar`
- `.content`
- `.page-head`
- `.two-col`
- `.metric-grid`
- `.table-scroll`

Service workspace layout patterns include:
- `.service-workspace`
- `.sw-heading`
- `.sw-filters`
- `.sw-tables`
- `.sw-tabs`
- `.sw-content`
- `.sw-menu-layout`
- `.sw-cart`

Customer layout patterns include:
- `.customer-layout`
- `.menu`
- `.dish`
- `.cart`
- `.receipt`

AI MUST NOT create new layout primitives without checking these first.

## 9. Spacing Rules

AI SHOULD reuse nearby spacing values from the owning application.

AI SHOULD inspect `readability.css` for new root/shared visual work.

AI MUST NOT introduce arbitrary spacing values when an existing nearby value satisfies the requirement.

AI MUST NOT normalize or migrate all existing spacing during unrelated feature work.

## 10. Typography Rules

AI MUST inspect `src/font.css` and `src/readability.css` before introducing new typography direction.

AI MUST use the approved Nunito-based direction for new root/shared/customer/staff work after the design-foundation implementation phase.

AI MUST NOT replace existing typography globally during unrelated work.

AI MUST NOT introduce any font other than Nunito without explicit approval.

Approved typography scale:
- Body: `16px / 1.5`
- Caption: `12px / 1.4`
- Label: `13px / 1.4`
- Button: `14px / 1.4`
- H3: `18px / 1.3`
- H2: `24px / 1.25`
- H1: `32px / 1.2`

## 11. Color Rules

AI MUST inspect `readability.css` before adding new colors.

AI SHOULD prefer existing neutral values and variables where appropriate.

AI MUST NOT introduce arbitrary colors when an existing color/value satisfies the requirement.

AI MUST NOT perform broad color migration.

## 12. Button Rules

Root UI MUST use root button patterns:

```text
.btn
btn()
```

Service workspace UI MUST use service workspace button patterns:

```text
.sw-button
```

AI MUST preserve this ownership boundary.

AI MUST NOT replace `.sw-button` with `.btn`.

AI MUST NOT replace `.btn` with `.sw-button`.

AI MUST NOT introduce a universal Button component without explicit architectural approval.

## 13. Dialog Rules

If `confirmDialog()` satisfies the requirement, AI MUST reuse it.

AI MUST NOT create another confirmation dialog implementation.

If `confirmDialog()` cannot satisfy the requirement, AI MUST state why before creating a new implementation.

AI MUST inspect:

```text
src/confirm-dialog.js
src/confirm-dialog.css
```

before implementing confirmation UI.

## 14. Product UI Rules

Customer `.dish` remains customer-specific.

AI MUST NOT copy customer product-card implementation into root or staff merely to save time.

AI MUST NOT create a universal ProductCard component without explicit approval.

AI MAY reuse narrow primitives where appropriate, such as:

```text
productPhoto()
```

AI MUST distinguish between:
- Product image primitive.
- Customer product card.
- Root catalog product row.
- Service workspace product row.

## 15. Service Workspace Rules

Any change involving `.sw-*` MUST consider both root and staff applications.

AI MUST inspect all relevant consumers before modifying shared service-workspace styles or behavior.

AI MUST inspect:

```text
src/service-workspace.js
src/service-workspace.css
src/readability.css
staff-app/src/main.js
src/main.js
```

AI MUST NOT treat `.sw-*` as root-only.

AI MUST NOT replace `.sw-button` with `.btn`.

## 16. Status Semantic Rules

Backend status handling SHOULD use centralized semantic mapping in the future.

AI MUST NOT force all applications to use the same visual status component.

Semantic consistency is required before visual unification.

When touching status handling, AI SHOULD identify:
- Backend status value.
- User-facing label.
- Workflow meaning.
- Owning application.
- Existing display pattern.

AI MUST NOT silently create conflicting status labels.

## 17. Responsive Rules

Preferred root/shared breakpoints:

```text
700px
1050px
```

Customer-specific breakpoint:

```text
540px
```

Staff-specific breakpoints:

```text
370px
500px
```

AI SHOULD reuse existing breakpoints.

AI MUST NOT introduce a new breakpoint without a concrete responsive requirement.

AI MUST NOT migrate existing breakpoints during unrelated work.

The active POS theme also contains `760px` and `1100px` transitions. These are approved runtime breakpoints, not accidental values to normalize automatically.

## 18. CSS Naming Rules

AI MUST preserve existing namespace conventions.

Important namespaces:
- `.sw-*` for service workspace.
- `.app-confirm__*` for confirmation dialog.
- `.catalog-*` for catalog UI.
- `.manage-*` for management UI.
- `.kitchen-*`, `.kt-*`, `.kds-*` for kitchen/KDS UI.
- `.staff-*` for staff shell UI.

AI SHOULD NOT add broad generic selectors unless necessary.

AI MUST check cross-application impact before editing shared CSS.

## 19. Helper Rules

When modifying root UI, AI MUST inspect existing local helpers:

```text
btn
field
title
table
empty
badge
```

AI MUST reuse them where appropriate.

AI MUST NOT extract or export them unless explicitly instructed.

AI MUST NOT create equivalent helpers in the same root context.

For shared helpers, AI MUST inspect current consumers before changing behavior.

## 20. Cross-Application Change Rules

Before modifying shared code, AI MUST identify:

```text
Who consumes this?
Which application owns it?
Is it intentionally shared?
Could the change alter another application's behavior?
```

A shared-looking UI element is NOT automatically shared code.

AI MUST consider staff impact when changing `src/service-workspace.js` or `.sw-*`.

AI MUST consider customer impact when changing `src/confirm-dialog.js`.

AI MUST consider root/service impact when changing `src/product-photo.js`.

## 21. When Creating a New Pattern Is Allowed

AI MAY create a new UI pattern only after answering:

1. Does an equivalent already exist?
2. Does a similar pattern exist?
3. Why can it not be reused?
4. What application owns the new pattern?
5. Is the difference semantic, behavioral, responsive, or merely visual?
6. Does this create a new design-system primitive?
7. Does the change affect another application?

If these questions cannot be answered from repository evidence, AI SHOULD ask for clarification rather than invent an architecture.

## 22. Forbidden AI Behaviors

AI MUST NOT:
- Create duplicate dialogs.
- Create duplicate helpers.
- Create arbitrary breakpoints.
- Replace `.sw-button` with `.btn`.
- Replace `.btn` with `.sw-button`.
- Copy customer `.dish` into admin/staff.
- Introduce a universal Button component without approval.
- Introduce a universal ProductCard component without approval.
- Perform broad CSS refactoring during unrelated feature work.
- Perform broad token migration during unrelated feature work.
- Extract root helpers without explicit approval.
- Introduce a new styling framework.
- Change application boundaries.
- Refactor unrelated code.
- Change known-good behavior merely for consistency.
- Treat best practice as a requirement.
- Assume visual similarity means shared architecture.
- Introduce React, Vue, TypeScript, Tailwind, or another frontend stack without explicit approval.

## 23. Self-Review Checklist

Before finishing a frontend task, AI MUST verify:

```text
[ ] Correct application context identified
[ ] Existing patterns searched
[ ] Existing helper reuse considered
[ ] readability.css inspected
[ ] No unnecessary hardcoded visual values introduced
[ ] Existing button boundary preserved
[ ] Service-workspace changes checked against staff app
[ ] Customer product UI boundary preserved
[ ] Existing breakpoints reused where appropriate
[ ] No unnecessary new breakpoint introduced
[ ] No duplicate dialog/helper/pattern created
[ ] No unrelated refactor performed
[ ] No application boundary changed
[ ] Responsive behavior checked
[ ] Existing known-good behavior preserved
[ ] Cross-application impact considered
[ ] Runtime-owning stylesheet identified
[ ] Loading, empty, error, disabled, and responsive states covered
[ ] Keyboard/focus/label behavior preserved for interactive UI
```

## 24. Lightweight Enforcement

Confirmed Decision:
- Initial enforcement is lightweight.
- Do not introduce aggressive design-token linting yet.
- Do not introduce a large design-system enforcement system yet.

Governance focus:
1. Do not create a new dialog if `confirmDialog()` satisfies the requirement.
2. Do not modify `.sw-*` patterns without considering staff-app impact.
3. Do not introduce arbitrary new breakpoints.
4. Do not create a new button/card/product pattern if an appropriate existing pattern already exists.
5. Prefer existing tokens/patterns before introducing new visual values.

Future enforcement MAY evolve after token standardization.

Before any refactor implementation begins, the executing agent MUST have a baseline covering:
1. CSS import order for Root, Customer, and Staff.
2. Effective runtime variables and representative computed styles.
3. Screen inventory with owner, layout, and responsive rules.
4. Required loading, empty, error, disabled, and permission states.
5. Visual evidence at the approved breakpoints.

## 25. Escalation / Ask Before Changing Architecture

AI MUST ask for clarification before:
- Extracting root helpers.
- Creating universal UI components.
- Migrating CSS to `readability.css`.
- Introducing new breakpoints without clear need.
- Changing shared service workspace behavior.
- Changing application boundaries.
- Replacing application-specific UI with shared UI.
- Introducing new enforcement tooling.
- Introducing a new styling framework or frontend stack.

If architectural ambiguity is significant, AI SHOULD ask rather than invent.
