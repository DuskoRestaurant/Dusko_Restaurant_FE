# FE Refactor Plan

> **Status:** PLAN — Not yet approved for implementation.
> **Created:** 2026-10-07
> **Source:** Evidence-based analysis of repository + three governance documents.
> **Immutable after approval.** Any change after approval must be recorded as a `REQUIREMENT REVISION`.

---

## 1. Purpose

This document is the implementation plan for an incremental frontend visual-consistency refactor of the Dusko Restaurant FE project.

The goal is to:

- Reduce hardcoded duplication of visual values where it is safe and justified by evidence.
- Make the visual language more coherent across Root/Admin, Customer, and Staff contexts.
- Improve discovery so future AI coding agents can find and reuse existing patterns instead of inventing new ones.
- Preserve all existing application boundaries, business logic, API contracts, and known-good behavior.

This is **NOT** permission to:

- Redesign the application.
- Introduce a new frontend framework.
- Merge application-specific components merely because they look similar.
- Perform a broad CSS rewrite.

---

## 2. Source of Truth

Priority order when determining the plan:

1. Explicit confirmed decisions in the three governance documents:
   - `docs/frontend/architecture.md`
   - `docs/frontend/ui-patterns.md`
   - `docs/ai/frontend-governance.md`
2. Existing working code and observable architecture.
3. Existing UI patterns and shared helpers.
4. Existing CSS and actual usage frequency.
5. Evidence from repository-wide analysis.
6. Technical inference.
7. Recommendation.

A recommendation MUST NOT override a confirmed decision.

### Design foundation revision — approved 2026-10-09

The refactor target is no longer the active POS blue visual direction. The approved target is:

- Direction: **Warm Modern Restaurant**.
- Shared palette across Root/Admin, Customer, and Staff.
- Application-specific layout and interaction patterns remain separate.
- Font family: **Nunito** for the frontend UI.
- Shared runtime visual tokens will be owned by `src/pos-theme.css` during the conservative Option C migration.

Approved shared palette:

| Token | Value | Semantic role |
|---|---|---|
| `--canvas` | `#FBF7F2` | Warm page background |
| `--surface` | `#FFFFFF` | Cards, panels and controls |
| `--ink` | `#3B2923` | Primary text |
| `--muted` | `#7C6D64` | Secondary text |
| `--line` | `#E8DED5` | Borders and dividers |
| `--primary` | `#C85A3F` | Primary action / brand terracotta |
| `--primary-dark` | `#9F3F2D` | Hover and pressed primary action |
| `--accent` | `#71856A` | Sage secondary accent |
| `--accent-soft` | `#E7EEE3` | Soft sage surface |
| `--warning` | `#C58A32` | Warning state |
| `--danger` | `#B84A45` | Error/destructive state |
| `--success` | `#4F8060` | Success state |

Approved typography scale:

| Role | Size / line-height |
|---|---|
| Body | `16px / 1.5` |
| Caption | `12px / 1.4` |
| Label | `13px / 1.4` |
| Button | `14px / 1.4` |
| H3 | `18px / 1.3` |
| H2 | `24px / 1.25` |
| H1 | `32px / 1.2` |

Approved shape and spacing scale:

- Spacing: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`.
- Control radius: `10px`.
- Card/panel radius: `16px`.
- Pill radius: `999px`.
- Shadows are subtle and reserved for elevated cards; flat panels do not receive a shadow by default.

These values replace the previous POS-blue/Inter target for future implementation phases. Existing source remains unchanged until the revised implementation phase is approved and started.

---

## 3. Current Frontend Baseline

### Repository structure

```text
Dusko_Restaurant_FE/          ← Root/Admin application
  src/
    main.js                   ← Root entry; contains btn, field, title, table, empty, badge helpers
    style.css                 ← Root layout, shell, panel, button, metric, table, form (older visual layer)
    theme.css                 ← Root visual overrides, KDS styles, legacy order tooling
    readability.css           ← Newer neutral visual direction, partial CSS variables (authoritative reference)
    font.css                  ← Shared font (Inter Variable); --font-ui token
    service-workspace.css     ← Service workspace component styles
    service-workspace.js      ← createServiceWorkspace() shared primitive
    confirm-dialog.css        ← Shared dialog styles
    confirm-dialog.js         ← confirmDialog() shared primitive
    product-photo.js          ← productPhoto() shared primitive
    app-entry.css             ← Shared login/entry page styles
    app-entry.js              ← mountLogin() shared primitive
    management.css            ← Root management form styles
    management.js             ← Root catalog/location renderers
    offline.css               ← Root offline indicator styles
    forecast.css              ← Root forecast + AI feature styles
    pos-theme.css             ← active final POS/blue runtime theme layer for all apps
    ui-icons.js               ← Icon helper
    kitchen-view.js           ← Kitchen/KDS renderers
    inventory-excel.js        ← Inventory Excel feature
  customer-web/
    src/
      main.js                 ← Customer entry; imports font.css + confirmDialog()
      style.css               ← Customer-specific styles
  staff-app/
    src/
      main.js                 ← Staff entry; imports service-workspace.js, readability.css, font.css
      style.css               ← Staff-specific styles
  docs/
    frontend/
      architecture.md
      ui-patterns.md
    ai/
      frontend-governance.md
```

### Technology

- Vanilla JavaScript + Vite (no React, Vue, TypeScript, Tailwind).
- UI rendered via JS template strings.
- Global CSS files; no CSS modules or CSS-in-JS.
- Fonts: `@fontsource-variable/inter` (Inter Variable).

### Known-good state

The current frontend is functional. All existing working behavior is treated as known-good unless repository evidence demonstrates a bug. This plan prioritizes **preserve behavior + improve consistency**, not rewrite.

---

## 4. Current Architecture

### Application boundaries

| Context | Root | Entry | CSS files |
|---|---|---|---|
| Root/Admin | `Dusko_Restaurant_FE/` | `src/main.js` | `style.css`, `offline.css`, `management.css`, `theme.css`, `confirm-dialog.css`, `readability.css`, `font.css`, `forecast.css`, `pos-theme.css` |
| Customer | `customer-web/` | `customer-web/src/main.js` | `customer-web/src/style.css`, `font.css`, `confirm-dialog.css`, `pos-theme.css` |
| Staff | `staff-app/` | `staff-app/src/main.js` | `staff-app/src/style.css`, `service-workspace.css`, `readability.css`, `font.css`, `pos-theme.css` |
| Shared | `src/` | — | `font.css`, `confirm-dialog.css`, `app-entry.css`, `service-workspace.css`, `readability.css`, `pos-theme.css` |

### CSS import order and runtime cascade

`main.js` imports in this order:

1. `app-entry.css` (via `app-entry.js`)
2. `style.css`
3. `offline.css`
4. `management.css`
5. `theme.css`
6. `confirm-dialog.css` (via `confirm-dialog.js`)
7. `readability.css`
8. `font.css`
9. `forecast.css`
10. `pos-theme.css` (direct import in `src/main.js`; also directly imported by Customer and Staff)

### Resolved runtime theme decision

- `pos-theme.css` is the active final theme layer for Root/Admin, Customer, and Staff.
- It is loaded in all three entry points and is not conditional.
- For duplicated selectors and custom properties, the later `pos-theme.css` declaration is the runtime baseline.
- `readability.css` remains a supporting reference layer, but it is not the final runtime source of truth while `pos-theme.css` is loaded after it.
- A visual change intended to be visible at runtime must not be added to `readability.css` alone.
- Runtime theme authority does not merge application-specific patterns such as `.btn`, `.sw-button`, or `.dish`.

The Customer and Staff entry points are first-class consumers of `pos-theme.css`. Any shared theme change must be checked against all three contexts.

### Shared primitives inventory

| Primitive | File | Consumers | Notes |
|---|---|---|---|
| `confirmDialog()` | `src/confirm-dialog.js` | Root, Customer, Staff (via service-workspace) | CSS: `confirm-dialog.css`; uses `<dialog>` element |
| `productPhoto()` | `src/product-photo.js` | Root catalog, kitchen, service-workspace | Narrow image primitive; not a full product card |
| `createServiceWorkspace()` | `src/service-workspace.js` | Root orders page, Staff app | CSS: `service-workspace.css`; cross-app shared |
| `mountLogin()` | `src/app-entry.js` | Root `main.js`, Staff `main.js` | CSS: `app-entry.css`; shared login shell |
| `font.css` | `src/font.css` | Root, Customer, Staff | `--font-ui` token; Inter Variable font |

### Screen consistency contract

Every screen changed by the refactor must be recorded against this contract:

| Contract | Required result |
|---|---|
| Context and owner | Root/Admin, Customer, Staff, or shared Service Workspace is explicit |
| Layout | Existing owner layout is reused before a new layout is introduced |
| Visual authority | Shared runtime values come from `pos-theme.css`; local values come from the owning stylesheet |
| Data states | Loading, success, empty, error, unauthorized/forbidden are defined |
| Interaction states | Busy, disabled, validation error, confirmation, and success feedback are defined |
| Responsive states | The active breakpoint and stack/collapse/overflow behavior are documented |
| Accessibility | Labels, heading order, focus, keyboard behavior, dialog semantics, and live feedback are checked |
| Evidence | Build plus visual or manual evidence is recorded for every affected application |

The happy path alone is not sufficient evidence that a screen is complete. Consistency means the same visual rules and state quality across screens, not that application-specific markup must be merged.

---

## 5. Current Visual System

### 5.1 Typography

#### Font family

The approved target font for all three applications is Nunito. The current source still imports Inter and must be migrated in the design-foundation implementation phase.

- Root/Admin: Inter Variable (via `font.css`); older `style.css` and `theme.css` reference `'DM Sans'` and `Manrope` for legacy selectors. `pos-theme.css` resets all elements to Inter.
- Customer: `customer-web/src/style.css` uses `system-ui, sans-serif` for body; imports `font.css` for the `--font-ui` token but body text uses system-ui fallback.
- Staff: `staff-app/src/style.css` uses `system-ui, sans-serif` for body; imports `font.css` and `readability.css`.

**Conflict / inconsistency:** `style.css` and `theme.css` reference `'DM Sans'` (for `:root`) and `Manrope` (for headings, KDS values, batch cards). `font.css` overrides these via explicit element selectors. Customer body text remains on `system-ui`. Staff body text remains on `system-ui`.

**Evidence for Inter as the intended primary font:** `font.css` is loaded by all three apps and assigns `font-family: var(--font-ui)` to `body`, `button`, `input`, `select`, `textarea`, plus a long list of specific elements. This is the confirmed shared font direction.

**Outlier values (DM Sans, Manrope):** These exist in the older CSS layers (`style.css`, `theme.css`). Since `font.css` is loaded after these, it overrides them for the specific selectors listed. However, any selector not in that list may still fall back to DM Sans or Manrope in certain cascade scenarios.

#### Font sizes

Representative values observed across the codebase:

| Size | Context | File(s) |
|---|---|---|
| 10px | Tiny labels, eyebrow text | `style.css`, `theme.css` |
| 11px | Small badges, cell-sub, brand small | `style.css`, `readability.css` |
| 12px | Workspace label, breadcrumb, small labels | `style.css`, `readability.css`, `customer-web` |
| 13px | Badge, form label, sw-button (mobile), various small text | `service-workspace.css`, `readability.css`, `customer-web` |
| 14px | Table headers, nav item, form help, breadcrumb | `readability.css`, `service-workspace.css`, `pos-theme.css` |
| 15px | Body copy variants, `.btn.text`, `.panel-head p` | `readability.css`, `customer-web/style.css` |
| 16px | Base button, input, select, base body (Customer) | `readability.css`, `confirm-dialog.css`, `customer-web/style.css` |
| 17px | Table `td`, cart items, order items, sw-order li | `readability.css`, `customer-web/style.css` |
| 18px | Root body/service-workspace base | `readability.css`, `service-workspace.css` |
| 19px | Staff h2, sw-button primary heading | `readability.css`, `staff-app/style.css` |
| 20px | Staff h2, cart total | `readability.css` |
| 21px | Panel-head h2, confirm title | `readability.css`, `confirm-dialog.css` |
| 24px | KDS heading, service-workspace h2 | `readability.css`, `service-workspace.css` |
| 25px | SW table strong, cart total strong | `readability.css`, `service-workspace.css` |
| 27–30px | Metric strong, page-head h1 | `readability.css`, `style.css` |
| 34px | KDS count strong | `readability.css` |

**Observation:** There is no shared semantic size scale. Values are inlined per-selector. Root body uses 18px (`readability.css`), Customer uses 18px (body element), Staff uses 16px. The range from 10px to 34px is used across all apps. Token candidates (e.g., `--text-sm`, `--text-base`, `--text-lg`) are not yet defined and cannot be introduced without an evidence phase.

#### Font weights

Common values: 400, 500 (500–550 range common in `readability.css`), 600, 650 (common in `readability.css` and `service-workspace.css`), 700, 750, 800.

`font.css` enables variable font so weights 100–900 are available. Most UI weights cluster at 550, 600, 650, 700.

#### Line heights

- `readability.css` body: 1.55
- `customer-web/style.css` body: 1.55
- `staff-app/style.css` body: 1.5 / 1.45
- Various inline values: 1.2, 1.25, 1.3, 1.35, 1.4, 1.5, 1.55, 1.6, 1.65

No shared line-height token exists.

---

### 5.2 Colors

#### CSS variables currently defined

**In `readability.css` (neutral/forest layer):**

First `:root` block (neutral):
```css
--surface: #fff
--canvas: #f6f7f8
--ink: #202124
--muted: #62666c
--line: #e1e4e8
--radius: 12px
```

Second `:root` block (forest/green theme override, later in same file):
```css
--canvas: #f3f6f4
--ink: #20312b
--muted: #687970
--line: #dfe8e2
--accent: #24744d
--accent-soft: #e6f5ed
--warm: #e5a13d
--blue: #4f8bd5
```

**In `pos-theme.css` (:root block):**
```css
--pos-blue: #0784bb
--pos-dark: #07658e
--pos-bg: #edf3f7
--pos-line: #d9e4eb
--pos-text: #243b4b
```
and later:
```css
--canvas: #edf3f7
--ink: #243b4b
--muted: #6b8190
--line: #d9e4eb
--accent: #0784bb
--accent-soft: #e7f5fd
--warm: #e5b847
--blue: #168ac0
```

**Resolved runtime note — token override conflict:**
The same CSS variables (`--canvas`, `--ink`, `--muted`, `--line`, `--accent`) are defined in both `readability.css` and `pos-theme.css` with different values. Since `pos-theme.css` is imported after `readability.css` in `main.js`, the `pos-theme.css` values win at runtime for Root/Admin. This means `readability.css` variable definitions are **overridden** in the Root context.

Resolution: `pos-theme.css` is the approved final runtime layer for all three applications. Token candidates must be evaluated against its effective declarations.

#### Hardcoded color samples (not tokenized)

The following hardcoded color values appear frequently across multiple files and represent duplication or inconsistency:

| Value | Semantic role | Files |
|---|---|---|
| `#202124` | Dark/ink (neutral theme) | `readability.css`, `confirm-dialog.css` |
| `#243b4b` | Dark/ink (POS theme) | `pos-theme.css` |
| `#20312b` | Dark/ink (forest theme) | `readability.css` (forest override) |
| `#111` / `#111111` | Dark/ink (staff, SW) | `staff-app/style.css`, `service-workspace.css` |
| `#171717` | Dark/ink (theme.css) | `theme.css` |
| `#f6f7f8` | Canvas (neutral) | `readability.css`, `customer-web/style.css` |
| `#f3f4f4` / `#f3f4f5` | Canvas (staff/warm) | `staff-app/style.css` |
| `#edf3f7` | Canvas (POS blue) | `pos-theme.css` |
| `#f3f6f4` | Canvas (forest) | `readability.css` |
| `#f5f5f5` | Canvas (neutral grey) | `theme.css` |
| `#e1e4e8` | Line/border (neutral) | `readability.css`, `customer-web/style.css` |
| `#d9e4eb` | Line/border (POS) | `pos-theme.css` |
| `#dfe8e2` | Line/border (forest) | `readability.css` |
| `#24744d` | Accent green | `readability.css` |
| `#0784bb` | Accent blue | `pos-theme.css` |
| `#202124` (btn bg) | Primary button | `readability.css` |
| `#24744d` (btn bg) | Primary button (forest) | `readability.css` theme override |
| `#0784bb` (btn bg) | Primary button (POS) | `pos-theme.css` |
| `#111` (btn bg) | Primary button (theme) | `theme.css` |
| `#243d32` (btn bg) | Primary button (style.css) | `style.css` |
| `#202124` / `#111` | SW primary button | `service-workspace.css` / `readability.css` |

**Observation:** The primary button alone has 5 distinct background colors across different CSS layers, representing different theme states rather than inconsistent bugs. All override each other in cascade order. This is a cascade layering system, not simple duplication.

#### Status / semantic colors (badge)

| Status | `style.css` | `theme.css` | `readability.css` |
|---|---|---|---|
| paid/completed | `#e8f3db / #5b8234` | `#fff / #111` | `#e6f5ed / #28764e` |
| pending/scheduled | `#fff2dc / #ae7926` | `#f0f0f0 / #333` | `#fff3df / #94621e` |
| cooking | `#e2eff8 / #457ca4` | `#252525 / #fff` | `#e8f2ff / #386da3` |

**Observation:** Status badge colors are layered per theme. They are not independently duplicated — they are the same semantic concept expressed through different theme layers.

---

### 5.3 Spacing

Common padding/gap values observed:

| Value | Typical use | Files |
|---|---|---|
| 4–6px | Gap between inline elements, badge padding | multiple |
| 8–10px | Small button padding, field gap, notification spacing | multiple |
| 12–14px | Card/section gap, form gap | multiple |
| 16–18px | Panel padding (mobile), section padding | multiple |
| 20–22px | Panel padding (desktop), content gap | multiple |
| 24px | Content padding, modal body padding | multiple |
| 28–34px | Content top padding | multiple |

**Observation:** Values 12px, 16px, 20px, 24px appear most frequently across all files as card/section/content spacing. No shared spacing scale token exists. Values are inlined per-selector. The overlap is strong enough to be a token candidate (Phase 4), but evidence must be gathered per-selector before proposing specific token names.

---

### 5.4 Radius

| Value | Typical use | Files |
|---|---|---|
| 4px–6px | Badge, small element | `readability.css`, `confirm-dialog.css`, `pos-theme.css` |
| 7px | Form inputs, confirm buttons | `confirm-dialog.css`, `theme.css`, `staff-app/style.css` |
| 8px | Buttons, inputs, cards | `readability.css`, `service-workspace.css`, `customer-web/style.css` |
| 9px | toast, modal, batch | `style.css` |
| 10px | Panels (mobile), small cards | `readability.css`, `service-workspace.css` |
| 12px | `--radius` token value; panels, SW content | `readability.css`, `service-workspace.css` |
| 14px | Login card, large modals | `readability.css`, `theme.css` |
| 15px | Staff section | `staff-app/style.css` |

**Token status:** `--radius: 12px` is defined in `readability.css` and used for `.panel`, `.metric`, `.kitchen-ticket`. Multiple values in the 8–14px range exist without tokens. Evidence suggests 8px and 12px are the most common candidates.

---

### 5.5 Shadows

| Shadow value | Context | File |
|---|---|---|
| `0 3px 12px #193f3308` | Panel, metric (forest) | `readability.css` |
| `0 3px 15px #1b3a1b05` | Panel, metric (style.css) | `style.css` |
| `0 2px 12px #00000008` | Panel (theme) | `theme.css` |
| `0 8px 24px #00000005` | Login (readability) | `readability.css` |
| `0 12px 34px #173e3014` | Login card (readability) | `readability.css` |
| `0 20px 70px #0003` | Modal | `readability.css` |
| `0 20px 60px #10131833` | Confirm dialog | `confirm-dialog.css` |
| `0 4px 18px #00000008` | Staff section | `staff-app/style.css` |
| `none` / `box-shadow:none` | Panels in POS theme | `pos-theme.css`, `readability.css` |

**Observation:** Panels and metrics use very similar `0 Xpx Ypx #rgba` shadows with slight variation. The POS theme removes most shadows. No shared elevation token exists.

---

### 5.6 Buttons

| Pattern | Owner | Application | File | Selector | Visual |
|---|---|---|---|---|---|
| Root `.btn` | Root | Root | `style.css`, `theme.css`, `readability.css`, `pos-theme.css` | `.btn`, `btn()` helper | Dark fill; variants: secondary, small, text |
| Service workspace `.sw-button` | Service workspace | Root + Staff | `service-workspace.css`, `readability.css`, `pos-theme.css` | `.sw-button`, `.sw-primary` | Neutral border; primary: dark fill |
| Customer `.primary` | Customer | Customer | `customer-web/style.css` | `.primary` | Dark fill, full-width |
| Staff `.primary` | Staff | Staff | `staff-app/style.css` | `.primary`, `.secondary` | Dark fill / bordered |
| Confirm dialog `.app-confirm__button` | Shared dialog | Cross-app | `confirm-dialog.css` | `.app-confirm__button`, `--primary`, `--danger` | Neutral border / dark fill |
| Login/entry `.entry-submit` | Shared entry | Root + Staff | `app-entry.css` | `.entry-submit` | Dark green fill |

**Reuse boundary note (confirmed decision):**
- `.btn` ≠ `.sw-button`. Must remain separate.
- Customer `.primary` is customer-only.
- Staff `.primary` is staff-shell-only.
- These must NOT be merged.

**`pos-theme.css` observation:** Line 5 of `pos-theme.css` applies `.btn,.sw-button{border-radius:6px;min-height:42px;font-size:14px;font-weight:650}`. This is the only place where `.btn` and `.sw-button` share a CSS rule block. They are NOT merged architecturally but do share some structural overrides via this theme layer. This is not a violation of the architectural boundary (it is a theme override, not a merge), but it should be noted for Phase 5/7 work.

---

### 5.7 Cards / Panels

| Pattern | Type | Owner | File(s) | Selector(s) | Behavior |
|---|---|---|---|---|---|
| Root `.panel` | Application pattern | Root | `style.css`, `readability.css` | `.panel`, `.panel-head` | White surface, border, radius, shadow; used for content sections |
| Root `.metric` | Application pattern | Root | `style.css`, `readability.css` | `.metric`, `.metric-grid` | White, border, metric values; dashboard only |
| SW table card | Application pattern | SW | `service-workspace.css`, `readability.css` | `.sw-table`, `.sw-attention` | Bordered card for table selection |
| SW order card | Application pattern | SW | `service-workspace.css`, `readability.css` | `.sw-order`, `.sw-content` | Order display within workspace |
| Customer `.dish` | Application-specific | Customer | `customer-web/style.css` | `.dish`, `.dish-body`, `.photo`, `.stepper` | Product card for QR ordering |
| Kitchen ticket | Application pattern | Root | `readability.css`, `theme.css` | `.kitchen-ticket`, `.kds-ticket` | Work ticket for kitchen display |
| Root `.order-card` | Application pattern | Root | `style.css`, `readability.css` | `.order-card` | Order summary in orders page |
| Root `.batch-card` | Application pattern | Root | `style.css` | `.batch-card` | Batch operation display |
| Forecast dish | Application pattern | Root | `forecast.css` | `.forecast-dish` | Forecast result card |

**Assessment:**
- `visual primitive`: None of the above qualifies. All carry application-specific content and behavior.
- `component pattern`: `.panel` is the closest to a shared surface primitive within Root, but it is Root-owned.
- `application-specific component`: All of the above.
- No universal card primitive is justified by repository evidence.

---

### 5.8 Tables

| Pattern | Owner | File | Selector(s) | Characteristics |
|---|---|---|---|---|
| Root data table | Root | `style.css`, `readability.css`, `theme.css` | `table`, `th`, `td`, `.table-scroll` | Full-width, collapsible, whitespace-nowrap in `style.css`, whitespace-normal in `theme.css` |
| SW product list | SW | `service-workspace.css`, `readability.css` | `.sw-product`, `.sw-products` | Flex list, not a `<table>`; product rows |
| Forecast results | Root | `forecast.css` | `.forecast-results`, `.forecast-dish` | CSS grid display of forecast items |

**Observation:** Only Root uses an HTML `<table>` for data display. The `table()` helper function in `main.js` constructs this. SW and Customer use list/grid layouts. A shared table primitive is not justified. Root table styling is already handled by the cascade (element selectors in `readability.css` override `style.css`).

---

### 5.9 Forms and Inputs

| Pattern | Owner | File(s) | Selector(s) |
|---|---|---|---|
| Root `field()` helper | Root | `style.css`, `readability.css` | `.field`, `field()` in `main.js` |
| Root management form | Root | `management.css`, `readability.css` | `.manage-form`, `.check-field`, `.form-error` |
| SW input | SW | `service-workspace.css`, `readability.css` | `.service-workspace input`, `.sw-filters` |
| Customer input | Customer | `customer-web/style.css` | `.toolbar input`, `.menu-filters select`, `.cart-item input` |
| Staff input | Staff | `staff-app/style.css` | `input[type=search]`, `.login input`, `.staff-branch select` |
| Entry/login form | Shared | `app-entry.css` | `.entry-page label`, `.entry-page input`, `.entry-password` |

**Observation:** Input visual characteristics (border, radius, padding, min-height) are similar but not identical across contexts. No universal form system is warranted. Root's `field()` helper and `.field` class are already the Root form pattern.

---

### 5.10 Dialogs

| Pattern | Owner | File(s) | Selector(s) | Consumers |
|---|---|---|---|---|
| `confirmDialog()` | Shared | `confirm-dialog.js`, `confirm-dialog.css` | `.app-confirm`, `.app-confirm__*` | Root, Customer, SW |
| Root modal | Root | `style.css`, `readability.css` | `.modal-wrap`, `.modal`, `.modal-close` | Root management forms, login overlay |

**Assessment:** `confirmDialog()` is the existing cross-app confirmation primitive. No duplicate must be created. The root `.modal` pattern is separate and serves a different purpose (full management form overlay) — it should not be confused with the confirmation dialog.

No additional consolidation is needed or warranted by repository evidence.

---

### 5.11 Status

| Pattern | Owner | File | Selector(s) | Status values handled |
|---|---|---|---|---|
| Root `badge()` + `.badge` | Root | `main.js`, `style.css`, `readability.css` | `.badge`, `.paid`, `.completed`, `.pending`, `.scheduled`, `.cooking`, `.warning` | Order/item statuses for Root |
| SW `statusText()` | SW | `service-workspace.js` | (inline text output) | Table/order item workflow statuses |
| Customer `updateStatus()` | Customer | `customer-web/src/main.js` | `.tracked-status` | Customer-facing order tracking |
| KDS status | Root (Kitchen) | `theme.css`, `readability.css` | `.kds-ticket.cooking`, `.kds-ticket.late` | Kitchen display ticket state |

**Confirmed decision (from architecture.md):** Centralize backend status semantic mapping before visual unification. Visual components may remain application-specific.

**Observation:** `statusLabel` map in `main.js` maps backend status strings to Vietnamese labels. This is Root-specific. `service-workspace.js` has its own status mapping. Customer has its own. None of these are shared. Semantic unification is a future direction, not a current plan item.

---

### 5.12 Responsive

| Breakpoint | Owner | Canonical? | Evidence |
|---|---|---|---|
| `480px` | `confirm-dialog.css` | — | Single use; dialog stacking at small width |
| `500px` | `forecast.css`, `staff-app/style.css` | Staff exception | Legitimate small-device staff exception |
| `540px` | `customer-web/style.css` | Customer | Confirmed customer-specific breakpoint |
| `700px` | `readability.css`, `theme.css`, `service-workspace.css`, `management.css`, `style.css`, `pos-theme.css` | Existing root/shared rule | Preserved legacy/root behavior |
| `760px` | `pos-theme.css`, `app-entry.css` | Active POS runtime | Approved shared POS transition |
| `800px` | `forecast.css` | Root feature exception | Forecast/AI layout specific |
| `1050px` | `readability.css`, `theme.css`, `style.css` | Existing root/shared rule | Preserved legacy/root behavior |
| `1100px` | `pos-theme.css` | Active POS runtime | Approved shared POS transition |
| `1350px` | `readability.css`, `forecast.css` | Root wide-screen | Metric grid collapse at wide |
| `370px` | `staff-app/style.css` | Staff exception | Confirmed staff-specific breakpoint |

`pos-theme.css` uses `760px` and `1100px` as the active POS transitions. Existing `700px` and `1050px` rules remain in earlier/root layers and are not automatically removed. New shared responsive work must use the active POS breakpoints unless a screen-specific requirement justifies an exception.

---

## 6. Visual System Problems

The following are evidence-based problems, not redesign proposals.

### P-01: CSS cascade layering complexity

The Root/Admin application loads 9–10 CSS files in sequence. `readability.css` is a supporting reference layer and is overridden by `pos-theme.css` for many selectors (including `:root` variables). The runtime authority is explicitly documented as `pos-theme.css`.

**Risk:** AI agents reading `readability.css` in isolation may implement values that are not the actual rendered values.

### P-02: Three competing inline color systems

`readability.css` contains two different `:root` blocks with different color values. `pos-theme.css` defines a third set overriding both. The effective runtime `:root` for Root/Admin is the `pos-theme.css` version.

**Risk:** Future work targeting `readability.css` color values may have no visible effect because `pos-theme.css` overrides them.

### P-03: DM Sans / Manrope references in style.css and theme.css

`style.css` sets `font-family: 'DM Sans', sans-serif` on `:root`. `theme.css` also sets `font-family: 'DM Sans'`. `font.css` overrides this via explicit element selectors. However, any selector not in `font.css`'s element list could fall through to DM Sans (which may not be loaded).

**Risk:** Fallback to DM Sans or Manrope where `font.css` does not cover the selector. DM Sans does not appear to be loaded as a dependency (no `@import` for it found in any reviewed CSS).

### P-04: Breakpoint layering in pos-theme.css

`pos-theme.css` uses `760px` and `1100px` as the active POS transitions. Existing `700px` and `1050px` rules remain in earlier/root layers and are not automatically removed. New shared responsive work must use the active POS breakpoints unless a screen-specific requirement justifies an exception.

### P-05: Hardcoded values in feature-specific CSS

`forecast.css`, `management.css`, `offline.css`, `app-entry.css` contain hardcoded color values that do not reference any CSS variables. These represent opportunities for future token adoption but are low priority and low risk.

### P-06: Customer body uses system-ui instead of Inter

`customer-web/style.css` sets `font: 18px/1.55 system-ui, sans-serif` on body. The imported `font.css` sets `font-family: var(--font-ui)` on `body`, which should override this. However, the `font:` shorthand in `customer-web` also resets `font-size` and `line-height`, which `font.css` does not reset. Effective result: Customer body should get Inter family (from `font.css`) but with `18px/1.55` from `customer-web/style.css`. This is likely intentional but should be documented.

### P-07: Staff body uses system-ui

Similarly, `staff-app/style.css` uses `system-ui, sans-serif` for body. `font.css` imports set Inter on `body`, which should override this. Load order: `style.css` before `font.css` in staff `main.js`, so `font.css` wins. Same situation as Customer.

---

## 7. Existing Patterns That Must Be Preserved

The following are confirmed architectural decisions. They are not recommendations. They MUST be preserved by any implementation that follows this plan.

| Decision | Constraint |
|---|---|
| `pos-theme.css` is active runtime theme | Shared runtime visual changes must target this layer. Check Root, Customer, and Staff. |
| `readability.css` is supporting reference | Do NOT delete. Do NOT add runtime visual changes there alone. |
| `style.css` remains | Do NOT delete or rewrite for consistency alone. |
| `theme.css` remains | Do NOT move or migrate existing working styles. |
| `.btn` is Root-owned | Do NOT merge with `.sw-button`. |
| `.sw-button` is SW-owned | Do NOT merge with `.btn`. SW changes must check both Root and Staff consumers. |
| Customer `.dish` is customer-specific | Do NOT copy into Root/Staff. Do NOT create universal ProductCard. |
| Root helpers `btn`, `field`, `title`, `table`, `empty`, `badge` | Local to Root. Do NOT extract. Do NOT export. Do NOT create equivalent helpers in same context. |
| `confirmDialog()` is the only confirmation dialog | Do NOT create a second confirmation dialog. |
| Breakpoints: POS `760px`/`1100px`; existing app-specific rules preserved | Do NOT introduce new breakpoints without a concrete responsive requirement. |
| Lightweight enforcement | Do NOT plan aggressive token linting unless evidence demands it. |
| Application boundaries: Root / Customer / Staff | Do NOT change. Similar UI ≠ shared architecture. |
| `productPhoto()` | Narrow image primitive, not a full card. May be reused where appropriate. |
| `createServiceWorkspace()` | Cross-app (Root + Staff). Changes must consider both consumers. |

---

## 8. Candidate Visual Foundation

Based on repository evidence, the following are candidates for the visual foundation. These are candidates only — they require Phase 0 evidence and Phase 1 planning before implementation.

### 8.1 Confirmed existing tokens

| Token | File | Current value | Used by |
|---|---|---|---|
| `--font-ui` | `font.css` | `'Inter Variable', Inter, 'Segoe UI', Arial, sans-serif` | Root, Customer, Staff |
| `--radius` | `readability.css` | `12px` | `.panel`, `.metric`, `.kitchen-ticket` |
| `--surface` | `readability.css` | `#fff` | Referenced in SW, readability selectors |
| `--canvas` | `readability.css` / `pos-theme.css` | Overridden per theme | Root, SW |
| `--ink` | `readability.css` / `pos-theme.css` | Overridden per theme | Root, SW |
| `--muted` | `readability.css` / `pos-theme.css` | Overridden per theme | Root, SW |
| `--line` | `readability.css` / `pos-theme.css` | Overridden per theme | Root, SW |
| `--accent` | `readability.css` / `pos-theme.css` | Overridden per theme | Root (forest/POS) |
| `--pos-blue` | `pos-theme.css` | `#0784bb` | POS theme only |
| `--pos-dark` | `pos-theme.css` | `#07658e` | POS theme only |

### 8.2 Token candidates (require Phase 0 evidence)

The following are candidates only. They require frequency analysis per-selector before being proposed as tokens.

| Candidate | Likely value range | Notes |
|---|---|---|
| Spacing scale (sm/md/lg/xl) | 8px / 16px / 24px / 32px | Most common card/section spacing values |
| Border radius (small/medium) | 7–8px / 12px | Button/input radius vs. panel radius |
| Text sizes (semantic scale) | 13–14px / 16px / 17–18px | Label / body / heading body |
| Shadow (panel) | ~`0 3px 12px rgba` | Panel elevation |

**Important:** These candidates must NOT become tokens until Phase 0 confirms actual usage frequency. Do not create tokens from inference alone.

### 8.3 CSS architecture decision

The approved structure is **Option C**: keep current files and refactor within existing ownership boundaries without structural changes. Shared runtime theme values belong in `pos-theme.css`; application-specific values remain in their owning stylesheet.

---

## 9. Shared Primitive Assessment

### `confirmDialog()` — `src/confirm-dialog.js` + `confirm-dialog.css`

- **Consumers:** Root (multiple action confirmations), Customer (order submit), Service workspace (via root consumer chain).
- **Assessment:** Already cross-app. CSS is self-contained and uses the `.app-confirm__*` namespace (BEM-like). No change needed. Do not create a second dialog.
- **Risk:** Any change to `confirm-dialog.css` affects all three application contexts.

### `productPhoto()` — `src/product-photo.js`

- **Consumers:** Root catalog, Root kitchen/KDS, Service workspace.
- **Assessment:** Already a narrow image primitive. Customer has its own inline image rendering in `main.js` (does not use `productPhoto()`). No merge proposed.
- **Risk:** Changes affect Root catalog and service workspace simultaneously.

### `createServiceWorkspace()` — `src/service-workspace.js` + `service-workspace.css`

- **Consumers:** Root orders page, Staff app.
- **Assessment:** Already cross-app. CSS uses `.sw-*` namespace. Any `.sw-*` change must be validated against both Root and Staff.
- **Risk:** High — any visual or behavioral change to SW affects both Root cashier and Staff phone app.

### `mountLogin()` — `src/app-entry.js` + `app-entry.css`

- **Consumers:** Root `main.js`, Staff `main.js`.
- **Assessment:** Already cross-app shared login shell. CSS uses `.entry-*` namespace.
- **Risk:** Changes affect both Root and Staff login experience.

### `font.css` — `src/font.css`

- **Consumers:** All three applications.
- **Assessment:** Already the shared font primitive. `--font-ui` token is the only font token. No change needed.
- **Risk:** Changes affect all three applications.

---

## 10. Application-Specific Pattern Assessment

### Root/Admin patterns — retain as Root-specific

| Pattern | Selector(s) | Assessment |
|---|---|---|
| Root shell layout | `.layout`, `.sidebar`, `.main`, `.topbar`, `.content` | Root-specific; preserve |
| Root page heading | `.page-head`, `.eyebrow`, `.head-tools`, `title()` | Root-specific; preserve |
| Root panel | `.panel`, `.panel-head` | Root-specific surface; preserve |
| Root metric | `.metric`, `.metric-grid` | Root-specific dashboard; preserve |
| Root table | `table()`, `row()`, `.table-scroll` | Root-specific helper; preserve |
| Root button | `.btn`, `btn()` | Root-specific; do NOT merge with SW |
| Root field | `.field`, `field()` | Root-specific; do NOT extract |
| Root badge | `.badge`, `badge()` | Root-specific; do NOT universalize |
| Root modal | `.modal-wrap`, `.modal`, `.modal-close` | Root-specific management overlay |
| Root management | `.manage-row`, `.manage-form`, `.manage-actions` | Root-specific |
| Kitchen/KDS | `.kitchen-*`, `.kds-*`, `.kt-*` | Root-specific; kitchen display context |
| Catalog patterns | `.catalog-*`, `.product-row` | Root-specific catalog management |
| Forecast/AI | `.forecast-*`, `.ai-*` | Root-specific feature |
| Inventory | `.inventory-*`, `.excel-*` | Root-specific feature |

### Customer patterns — retain as Customer-specific

| Pattern | Selector(s) | Assessment |
|---|---|---|
| Customer layout | `.customer-layout`, `.customer-menu` | Customer-specific |
| Customer product card | `.dish`, `.dish-body`, `.photo`, `.stepper` | Customer-specific; do NOT copy to Root/Staff |
| Customer cart | `.cart`, `.cart-item`, `.total`, `.primary` | Customer-specific |
| Customer service actions | `.service-actions`, `.service-hint` | Customer-specific |
| Customer receipt | `.receipt`, `.tracked-order` | Customer-specific |
| Customer header | `header` element styles | Customer-specific |

### Staff patterns — retain as Staff-specific

| Pattern | Selector(s) | Assessment |
|---|---|---|
| Staff shell header | `header` element, `.staff-app-header` | Staff-specific |
| Staff login | `.login`, `.primary`, `.secondary` (staff versions) | Staff-specific |
| Staff tables | `.tables`, `.table`, `.table.attention` | Staff-specific (not Root `.panel`) |
| Staff identity | `.staff-identity`, `.staff-branch` | Staff-specific |

### Service Workspace patterns — retain as SW-specific (Root + Staff consumers)

| Pattern | Selector(s) | Assessment |
|---|---|---|
| SW layout | `.service-workspace`, `.sw-*` layout classes | Cross-app but SW-owned |
| SW button | `.sw-button`, `.sw-primary` | SW-owned; do NOT merge with `.btn` |
| SW table card | `.sw-table`, `.sw-attention` | SW-specific card |
| SW product row | `.sw-product`, `.sw-photo` | SW-specific product display |
| SW cart | `.sw-cart`, `.sw-cart-item`, `.sw-stepper` | SW-specific cart |

---

## 11. Proposed Refactor Architecture

### Decision: Option C (conservative baseline)

The approved architecture is:

- **No new CSS files.**
- **No deletion of existing CSS files.**
- **No structural reorganization of CSS imports.**
- Refactoring occurs within existing ownership boundaries.
- Token additions expand `pos-theme.css` for shared runtime values, or the owning application stylesheet for local values, in a targeted, evidence-based manner.
- Visual primitive changes (typography, colors, spacing) happen in the file that is currently the active authority for those values.

This decision is the baseline for the refactor and may only change through a documented requirement revision.

### What this plan does NOT propose

- No `common.css`.
- No `primitives.css`.
- No `design-tokens.css`.
- No design token linting (lightweight enforcement confirmed decision).
- No Storybook, component library, CSS-in-JS, Tailwind, React, TypeScript.

---

## 12. Refactor Phases

### Phase 0 — Baseline & Safety

**Phase ID:** P-0
**Phase name:** Baseline Audit and Safety Establishment
**Objective:** Create a documented baseline of all current visual values, CSS file content, ownership, and known-good behavior. Establish what must not be changed. Resolve open questions before any implementation begins.

**Scope:**
- Read and document all CSS files.
- Read and document all shared JS primitives.
- Inventory all CSS variables currently defined.
- Inventory hardcoded color, typography, spacing, radius, and shadow values per file.
- Document all media query breakpoints.
- Record the CSS cascade/import order for each application.
- Identify which CSS layer is the effective visual source of truth for each application.
- Record the resolved runtime theme: `pos-theme.css` is the final theme layer for all three applications.
- Inventory effective CSS variables per application using import order and computed-style verification.
- Record `760px` and `1100px` as active POS theme breakpoints; preserve them unless a later responsive requirement explicitly changes them.
- Use CSS structure Option C: keep current files and refactor within existing ownership boundaries.
- Capture baseline screenshots or behavioral descriptions for known-good states.
- No source code changes during this phase.

**Files/modules likely affected:**
- All CSS files (read-only audit).
- All JS entry files (read-only import analysis).

**Tasks:**
1. Verify `src/main.js` CSS import order.
2. Verify `customer-web/src/main.js` CSS import order.
3. Verify `staff-app/src/main.js` CSS import order.
4. For each CSS file, extract all: CSS variables, media queries, hardcoded color values, font values, spacing values, radius values, shadows.
5. Determine cascade priority for each `:root` block.
6. Identify selectors in `pos-theme.css` that override `readability.css`.
7. Record the approved target: preserve the active POS blue runtime theme and make all screens consistent with it.
8. Record the rule that visual changes must be made in the runtime-owning layer, not in a shadow reference file.
9. Document baseline state in `docs/frontend/FE_REFACTOR_RESULT.md` Phase 0 section.

**Dependencies:** None. This is the first phase.

**Expected changes:** Only `docs/frontend/FE_REFACTOR_RESULT.md` will be created/updated.

**Explicit non-goals:**
- No source code changes.
- No CSS changes.
- No token additions.
- No new files.

**Acceptance criteria:**
- [ ] All CSS files read and documented.
- [ ] All CSS variables listed with their file, value, and cascade priority.
- [ ] All media query breakpoints listed by file and owner.
- [ ] Effective runtime `:root` values for Root/Admin, Customer, and Staff determined.
- [ ] Runtime theme decision recorded and verified for all three entry points.
- [ ] Effective runtime variables documented with evidence.
- [ ] Active POS breakpoints documented and verified.
- [ ] Option C ownership-preserving structure recorded.
- [ ] No source code changed during this phase.
- [ ] Phase 0 section written in `FE_REFACTOR_RESULT.md`.

**Required output/evidence:**
- Complete CSS variable inventory with cascade priority.
- Complete breakpoint inventory by file and owner.
- Resolved decision table D-01 through D-07 and runtime evidence.
- `FE_REFACTOR_RESULT.md` Phase 0 section.

**Validation method:** Read `FE_REFACTOR_RESULT.md` Phase 0 and verify all criteria are documented. Verify no git diff on source files.

**Regression risks:** None (read-only phase).

**Rollback:** Not applicable.

---

### Phase 1 — Visual Foundation Audit

**Phase ID:** P-1
**Phase name:** Visual Foundation Audit and Token Candidate Finalization
**Objective:** Based on Phase 0 evidence and resolved OQ decisions, finalize the list of justified token candidates and the target CSS file for each. Create a documented token specification, NOT an implementation.

**Dependencies:** Phase 0 complete and runtime decisions D-01 through D-07 recorded.

**Scope:**
- Review Phase 0 inventory.
- Classify each candidate value as: confirmed token, possible token (requires more evidence), or keep hardcoded.
- Determine target file for each proposed token.
- Apply the confirmed CSS structure: keep current files and existing ownership boundaries (Option C).
- Determine token naming convention.
- Document the specification in `FE_REFACTOR_RESULT.md` Phase 1 section.
- No source code changes.

**Files/modules likely affected:**
- `src/readability.css` (or `src/pos-theme.css`) — planning only.

**Tasks:**
1. Review Phase 0 color inventory. Select colors with >= 3 occurrences across different files that represent the same semantic role.
2. Review Phase 0 typography inventory. Select font sizes with >= 3 occurrences at the same semantic level.
3. Review Phase 0 spacing inventory. Select spacing values with >= 3 occurrences at the same structural role.
4. For each candidate, verify it does not already exist as a token.
5. Determine target file using the approved runtime ownership rules.
6. Draft token names following existing convention (e.g., `--canvas`, `--ink`, `--line`, `--radius`).
7. Confirm token specification with user before Phase 2.

**Explicit non-goals:**
- No CSS changes.
- No token additions yet.
- No approval to implement anything.

**Acceptance criteria:**
- [ ] Token candidates list finalized with: name, value, target file, justification, evidence (file count, selector count).
- [ ] No token added without at least 3 occurrences of the same semantic value.
- [ ] CSS structure option confirmed.
- [ ] Token naming convention confirmed.
- [ ] No source code changed during this phase.

**Required output/evidence:**
- Token candidate table with evidence.
- User confirmation of token list.
- `FE_REFACTOR_RESULT.md` Phase 1 section.

**Validation method:** Token candidate table cross-referenced with Phase 0 inventory. User confirmation recorded.

**Regression risks:** None (planning only).

**Rollback:** Not applicable.

---

### Phase 2 — Typography Refactor

**Phase ID:** P-2
**Phase name:** Typography Normalization (within approved scope)
**Objective:** Address known typography inconsistencies using the approved Warm Modern Restaurant typography foundation. The previous Inter cleanup is superseded by the Nunito decision recorded on 2026-10-09.

**Dependencies:** Phase 1 complete, token specification approved.

**Scope:**
- Add the approved Nunito font dependency and update `src/font.css`.
- Define the approved typography scale in the runtime theme layer.
- Replace legacy font-family references only within the approved visual-foundation scope.
- Preserve application-specific markup and behavior.

**Files/modules likely affected (pending Phase 1):**
- `src/font.css` — potential small addition only.
- `src/readability.css` or `src/pos-theme.css` — targeted additions only.
- `src/style.css` — targeted fix for DM Sans reference only if approved.
- `src/theme.css` — targeted fix for DM Sans/Manrope references only if approved.

**Tasks:**
1. Verify DM Sans / Manrope references in `style.css` and `theme.css`.
2. Determine if these cause visible fallback rendering (DM Sans is not loaded — confirm).
3. If approved: replace `:root { font-family: 'DM Sans' }` with `font-family: var(--font-ui)`.
4. Add any approved typography tokens to target file.
5. Confirm that `customer-web/src/style.css` body font interaction with `font.css` is as intended.
6. Run visual verification.

**Explicit non-goals:**
- Do NOT redesign application layouts in the typography phase.
- Do NOT merge application-specific patterns.
- Do NOT change business logic or API contracts.

**Acceptance criteria:**
- [ ] Nunito is loaded through the project dependency strategy.
- [ ] Approved typography scale is defined once in the runtime theme foundation.
- [ ] Root, Customer and Staff use the approved font direction.
- [ ] Legacy DM Sans/Manrope references are removed or explicitly scoped.
- [ ] No application boundary or behavior changed.
- [ ] Visual regression test performed at approved breakpoints.

**Required output/evidence:**
- Diff of changed files.
- Confirmation that DM Sans/Manrope references are resolved or documented.
- `FE_REFACTOR_RESULT.md` Phase 2 section.

**Validation method:** Read changed files, confirm all changes match approved token list. Load Root, Customer, and Staff in browser and verify no visible regression.

**Regression risks:**
- Changing `:root { font-family }` in `style.css` / `theme.css` could affect elements not covered by `font.css`'s explicit selectors.
- Mitigation: Test full page rendering before and after.

**Rollback:** Revert `style.css` / `theme.css` changes. `font.css` changes are additive and can be reverted individually.

---

### Phase 3 — Color Refactor

**Phase ID:** P-3
**Phase name:** Color Token Adoption (within approved scope)
**Objective:** Replace approved hardcoded color values with approved tokens. Scope is limited to the targets from Phase 1.

**Dependencies:** Phase 1 complete, Phase 2 complete, and runtime theme ownership verified.

**Scope:**
- In the target CSS file(s) approved in Phase 1, introduce or confirm color tokens.
- Replace hardcoded values with tokens only in the selectors approved in Phase 1.
- Do NOT broadly migrate all hardcoded colors.
- Do NOT change colors in `customer-web/src/style.css` unless Phase 1 explicitly approved it.
- Do NOT change colors in `staff-app/src/style.css` unless Phase 1 explicitly approved it.
- Do NOT change service-workspace colors unless Phase 1 explicitly approved it.
- Verify that token override chain (readability → pos-theme) still works correctly after changes.

**Files/modules likely affected (pending Phase 1):**
- `src/readability.css` or `src/pos-theme.css` — token additions.
- Possibly `src/forecast.css`, `src/management.css` — targeted hardcoded value replacement if approved.

**Explicit non-goals:**
- Do NOT touch `confirm-dialog.css` colors unless Phase 1 approved it.
- Do NOT change badge colors unless Phase 1 approved the specific badge variant.
- Do NOT change kitchen/KDS colors unless Phase 1 approved them.
- Do NOT modify `customer-web/src/style.css`.
- Do NOT modify `staff-app/src/style.css`.

**Acceptance criteria:**
- [ ] Only approved selectors changed.
- [ ] No new color values introduced (only replacement with approved tokens).
- [ ] CSS variable override chain verified correct after changes.
- [ ] Customer visual appearance unchanged.
- [ ] Staff visual appearance unchanged.
- [ ] Service workspace visual appearance verified.
- [ ] Root/Admin visual appearance verified.
- [ ] `FE_REFACTOR_RESULT.md` Phase 3 section written.

**Required output/evidence:**
- Diff of changed files.
- Before/after screenshot evidence for affected components.
- Confirmation that no unapproved file was changed.

**Validation method:** Git diff confirms only approved files changed. Browser rendering verified for Root, SW, Customer, Staff.

**Regression risks:**
- Wrong token value in override chain could silently change colors in unexpected selectors.
- CSS variable changes in `readability.css` may affect `staff-app` (which imports it).
- Mitigation: Check Staff app rendering after any `readability.css` color token change.

**Rollback:** Revert token additions. Replace with original hardcoded values.

---

### Phase 4 — Spacing / Shape Refactor

**Phase ID:** P-4
**Phase name:** Spacing and Shape Token Adoption (within approved scope)
**Objective:** Replace approved hardcoded spacing and radius values with approved tokens. Limited to Phase 1 scope.

**Dependencies:** Phase 1 complete, Phase 3 complete (or parallel if no dependency conflict).

**Scope:**
- Spacing: Replace hardcoded padding/margin/gap values with tokens only in approved selectors.
- Radius: `--radius: 12px` already exists in `readability.css`. Determine if a secondary radius token (e.g., for buttons/inputs, ~8px) is justified.
- Shadow: Determine if a panel shadow token is justified by Phase 1 evidence.
- Do NOT create spacing tokens for every spacing value — only where evidence shows repeated semantic use.

**Explicit non-goals:**
- Do NOT add spacing tokens to `customer-web/src/style.css` unless Phase 1 approved.
- Do NOT add spacing tokens to `staff-app/src/style.css` unless Phase 1 approved.
- Do NOT refactor service-workspace spacing unless Phase 1 approved.
- Do NOT introduce a spacing scale that doesn't match the evidence from Phase 0.

**Acceptance criteria:**
- [ ] Only approved selectors changed.
- [ ] `--radius` token usage confirmed where already valid.
- [ ] Any new token has >= 3 usage evidence from Phase 0 inventory.
- [ ] No visible layout shift in Root, SW, Customer, or Staff.
- [ ] `FE_REFACTOR_RESULT.md` Phase 4 section written.

**Required output/evidence:**
- Diff of changed files.
- Evidence table: for each new token, the selectors it replaced.
- Browser rendering verification.

**Regression risks:**
- Spacing token changes can cause subtle layout shifts (especially with `gap` in flex/grid contexts).
- Mitigation: Visual regression test for all affected pages.

**Rollback:** Revert to hardcoded values.

---

### Phase 5 — Root/Admin UI Refactor

**Phase ID:** P-5
**Phase name:** Root/Admin Application Cleanup
**Objective:** Within Root/Admin ownership boundary only, clean up duplicated or inconsistent values that were not addressed in Phases 2–4.

**Dependencies:** Phases 2, 3, 4 complete.

**Scope:**
- Within `src/style.css`, `src/theme.css`, `src/management.css`, `src/offline.css`, `src/forecast.css`: replace hardcoded values with tokens where Phase 1 approved.
- Verify Root helpers (`btn`, `field`, `title`, `table`, `empty`, `badge`) are consistent with the current visual direction.
- Do NOT extract Root helpers.
- Do NOT change Root helper function signatures.
- Do NOT change business logic.

**Explicit non-goals:**
- Do NOT merge `.btn` with any other button pattern.
- Do NOT extract Root helpers to a shared file.
- Do NOT change the catalog, kitchen, inventory, or forecast features' business logic.
- Do NOT add new breakpoints.
- Do NOT change the Root CSS import order.

**Acceptance criteria:**
- [ ] Only Root-owned files changed.
- [ ] No service-workspace files changed.
- [ ] No customer files changed.
- [ ] No staff files changed.
- [ ] Root helpers remain in `src/main.js`.
- [ ] All Root pages render correctly.
- [ ] All Root page helpers produce correct output.
- [ ] `FE_REFACTOR_RESULT.md` Phase 5 section written.

**Regression risks:** Root-specific feature breakage. Mitigation: Manual test of all Root pages (overview, orders, kitchen, inventory, forecast, analytics, locations, catalog).

**Rollback:** Revert changed Root CSS files.

---

### Phase 6 — Customer UI Refactor

**Phase ID:** P-6
**Phase name:** Customer Application Cleanup
**Objective:** Within Customer ownership boundary only, apply token adoption approved in Phase 1 and address any evidence-based inconsistencies.

**Dependencies:** Phases 2, 3, 4 complete.

**Scope:**
- `customer-web/src/style.css` only.
- Apply approved tokens where Phase 1 justified.
- Preserve customer `.dish`, `.cart`, `.primary`, `.stepper`, `.service-actions` behavior.
- Do NOT introduce tokens that don't exist in Customer context's effective CSS.

**Explicit non-goals:**
- Do NOT copy customer patterns to Root/Staff.
- Do NOT replace customer `.primary` with `.btn`.
- Do NOT change customer breakpoint (`540px`).
- Do NOT change the customer QR ordering flow.

**Acceptance criteria:**
- [ ] Only `customer-web/src/style.css` changed (or `customer-web/` scope only).
- [ ] Customer QR ordering flow functional.
- [ ] Customer `.dish` visual appearance preserved.
- [ ] Customer cart functional.
- [ ] Customer breakpoint (`540px`) preserved.
- [ ] `FE_REFACTOR_RESULT.md` Phase 6 section written.

**Regression risks:** Customer QR ordering is a guest-facing flow — any visual or behavioral regression is high impact. Test thoroughly.

**Rollback:** Revert `customer-web/src/style.css`.

---

### Phase 7 — Staff / Service Workspace Refactor

**Phase ID:** P-7
**Phase name:** Staff App and Service Workspace Cleanup
**Objective:** Within Staff and Service Workspace ownership boundaries, apply approved token adoption and address evidence-based inconsistencies.

**Dependencies:** Phases 2, 3, 4 complete.

**Scope:**
- `staff-app/src/style.css` — staff shell patterns only.
- `src/service-workspace.css` — SW patterns only.
- `src/readability.css` SW section — reference/supporting rules only; shared runtime changes belong in `pos-theme.css`.
- Any `.sw-*` change must be validated against both Root orders page AND Staff app.

**Explicit non-goals:**
- Do NOT merge `.sw-button` with `.btn`.
- Do NOT change staff breakpoints (`370px`, `500px`) without documented requirement.
- Do NOT change the `createServiceWorkspace()` function signature.
- Do NOT change SW business logic.

**Acceptance criteria:**
- [ ] Only Staff/SW files changed.
- [ ] `.sw-button` and `.btn` remain independent.
- [ ] SW works correctly in Root cashier view.
- [ ] SW works correctly in Staff app.
- [ ] Staff login flow functional.
- [ ] Staff breakpoints (`370px`, `500px`) preserved.
- [ ] `FE_REFACTOR_RESULT.md` Phase 7 section written.

**Regression risks:** SW changes affect two apps simultaneously. Test BOTH Root and Staff after every SW change.

**Rollback:** Revert `service-workspace.css` and/or `staff-app/src/style.css`.

---

### Phase 8 — Cross-Application Validation

**Phase ID:** P-8
**Phase name:** Cross-Application Regression Validation
**Objective:** Verify that all phases together did not introduce cross-application regressions. Validate shared primitives, breakpoints, and status rendering.

**Dependencies:** Phases 5, 6, 7 complete.

**Scope:**
- Full application test for Root, Customer, and Staff.
- Test all shared primitives: `confirmDialog()`, `productPhoto()`, `createServiceWorkspace()`, `mountLogin()`.
- Verify all canonical breakpoints still produce correct layouts.
- Verify badge/status rendering in Root and SW.
- Verify customer breakpoint behavior.
- Verify staff breakpoint behavior.

**Tasks:**
1. Test Root/Admin in desktop (>1050px), tablet (700–1050px), mobile (<700px).
2. Test Customer in desktop, tablet, mobile (<540px).
3. Test Staff in mobile (370–500px, >500px).
4. Open confirmation dialog in Root and confirm rendering.
5. Open confirmation dialog in Customer and confirm rendering.
6. Open service workspace in Root and confirm rendering.
7. Open staff app service workspace and confirm rendering.
8. Test a full Root order flow.
9. Test a full Customer order flow.
10. Test Staff login and table selection.

**Explicit non-goals:**
- No code changes during this phase.

**Acceptance criteria:**
- [ ] Root renders correctly at all three breakpoints.
- [ ] Customer renders correctly at all breakpoints including <540px.
- [ ] Staff renders correctly at 370px and 500px.
- [ ] `confirmDialog()` renders correctly in Root.
- [ ] `confirmDialog()` renders correctly in Customer.
- [ ] Service workspace renders correctly in Root.
- [ ] Service workspace renders correctly in Staff.
- [ ] No new breakpoints introduced.
- [ ] No duplicate dialog found.
- [ ] `FE_REFACTOR_RESULT.md` Phase 8 section written.

**Regression risks:** If earlier phases introduced regressions, they are discovered here. Phase 8 itself introduces no changes.

**Rollback:** Roll back the specific phase that caused the regression.

---

### Phase 9 — Final Governance / Cleanup

**Phase ID:** P-9
**Phase name:** Documentation Update and Governance Finalization
**Objective:** Update governance documents to reflect the actual post-refactor state. Record all decisions made. Close open questions.

**Dependencies:** Phase 8 complete and all criteria PASS.

**Scope:**
- Update `docs/frontend/architecture.md` to reflect any new tokens, CSS variables, or confirmed decisions.
- Update `docs/frontend/ui-patterns.md` to reflect any new or changed patterns.
- Update `docs/ai/frontend-governance.md` to reflect any new enforcement rules.
- Finalize `docs/frontend/FE_REFACTOR_RESULT.md`.
- Record any deviations from this plan.
- Verify all resolved decisions D-01 through D-07 remain satisfied.

**Explicit non-goals:**
- Do NOT add new patterns to governance documents that were not implemented.
- Do NOT change source code during this phase.

**Acceptance criteria:**
- [ ] All open questions documented as resolved (or explicitly deferred).
- [ ] All new tokens documented in `architecture.md`.
- [ ] All changed patterns documented in `ui-patterns.md`.
- [ ] `FE_REFACTOR_RESULT.md` fully written with PASS/PARTIAL/FAIL for each phase.
- [ ] No source code changed during this phase.
- [ ] Self-audit procedure (Section 16) executed and recorded.

**Required output/evidence:**
- Updated governance documents.
- Completed `FE_REFACTOR_RESULT.md`.
- Self-audit result.

---

## 13. Phase Dependency Graph

```
P-0 (Baseline)
  │
  ├─→ P-1 (Visual Foundation Audit)  [requires OQ resolution from P-0]
  │     │
  │     ├─→ P-2 (Typography)
  │     ├─→ P-3 (Colors)
  │     └─→ P-4 (Spacing/Shape)
  │               │
  │               ├─→ P-5 (Root/Admin)   [can run in parallel with P-6, P-7]
  │               ├─→ P-6 (Customer)     [can run in parallel with P-5, P-7]
  │               └─→ P-7 (Staff/SW)     [can run in parallel with P-5, P-6]
  │                         │
  │                         └─→ P-8 (Cross-App Validation)
  │                                   │
  │                                   └─→ P-9 (Governance/Cleanup)
```

P-2, P-3, P-4 may run in parallel if there are no file conflicts.
P-5, P-6, P-7 may run in parallel because they touch different ownership boundaries.

---

## 14. Acceptance Criteria Matrix

| Phase | Key Criteria | Objectively Checkable? |
|---|---|---|
| P-0 | All CSS variables documented | Yes — enumerable |
| P-0 | No source code changed | Yes — git diff |
| P-0 | Runtime decisions D-01 through D-07 recorded | Yes — decision table and evidence |
| P-1 | Token candidates have >= 3 usage evidence | Yes — evidence table |
| P-1 | No tokens added yet | Yes — git diff |
| P-2 | Only approved typography changed | Yes — git diff against approved list |
| P-2 | No customer typography changed | Yes — git diff on `customer-web/` |
| P-3 | CSS variable override chain correct | Yes — computed style check |
| P-3 | No unapproved file changed | Yes — git diff |
| P-4 | No layout shift | Yes — screenshot comparison |
| P-5 | Root helpers remain in `main.js` | Yes — grep |
| P-5 | Only Root files changed | Yes — git diff |
| P-6 | Customer QR flow functional | Yes — manual test |
| P-6 | Customer breakpoint `540px` preserved | Yes — media query grep |
| P-7 | `.sw-button` ≠ `.btn` | Yes — CSS inspection |
| P-7 | SW works in both Root and Staff | Yes — manual test |
| P-8 | All three apps render correctly at breakpoints | Yes — manual test |
| P-9 | All OQ documented as resolved | Yes — document review |
| P-9 | Self-audit executed | Yes — result in `FE_REFACTOR_RESULT.md` |

---

## 15. Result File Contract

The implementation workflow MUST maintain:

```text
docs/frontend/FE_REFACTOR_RESULT.md
```

### Required structure

```markdown
# FE REFACTOR RESULT

## Execution Metadata

- Plan version: [date/commit of FE_REFACTOR_PLAN.md]
- Implementation start: [date]
- Implementation end: [date]
- Executor: [AI agent or human]
- Open questions resolved: [list]

## Phase 0 Result

### Status
[PASS / PARTIAL / FAIL / BLOCKED]

### Work Completed

### Files Changed

### Tests / Validation

### Evidence

### Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|

### Deviations

### Known Issues

### Remaining Work

---

## Phase 1 Result

[same structure]

---

## Phase 2 Result

[same structure]

---

...repeat for P-3 through P-9...
```

### Integrity rules

- A phase may only be marked `PASS` if ALL mandatory acceptance criteria are satisfied with documented evidence.
- `PARTIAL`, `FAIL`, or `BLOCKED` must NOT be treated as complete.
- If evidence is missing, the phase status is `PARTIAL` at best.
- The Result file is append-only within a phase. Completed phase results must not be retroactively edited to improve status.

---

## 16. Self-Audit Procedure

After implementation of each phase (or at the end of the entire refactor), the executing agent MUST perform the following self-audit:

### Audit steps

1. Read `docs/frontend/FE_REFACTOR_PLAN.md` (this document).
2. Read `docs/frontend/FE_REFACTOR_RESULT.md`.
3. Read `docs/frontend/architecture.md`.
4. Read `docs/frontend/ui-patterns.md`.
5. Read `docs/ai/frontend-governance.md`.
6. For each phase:
   a. Read the phase's acceptance criteria in this plan.
   b. Read the phase's result in `FE_REFACTOR_RESULT.md`.
   c. Verify each criterion is met with documented evidence.
   d. Mark the phase: `PASS`, `PARTIAL`, `FAIL`, or `BLOCKED`.
7. Verify no forbidden behavior occurred:
   - `.btn` and `.sw-button` not merged.
   - Customer `.dish` not copied to Root/Staff.
   - Root helpers not extracted.
   - Universal Button/ProductCard not created.
   - No new breakpoint added without documented requirement.
   - No duplicate `confirmDialog` created.
   - No framework migration.
   - No broad CSS rewrite outside approved scope.
8. Verify application boundaries preserved:
   - Root files changed only contain Root-scoped changes.
   - Customer files changed only contain Customer-scoped changes.
   - Staff files changed only contain Staff-scoped changes.
   - SW changes validated against both Root and Staff consumers.
9. Verify known-good behavior preserved:
   - Root order flow functional.
   - Customer QR ordering functional.
   - Staff table service functional.
10. Verify no requirement was silently changed:
    - Compare actual Phase acceptance criteria against this plan's criteria.
    - Report any discrepancy as a deviation.
11. Check whether any scope was expanded without approval:
    - Any file not listed in "Files/modules likely affected" that was changed must be a documented deviation.
12. Record audit result in `FE_REFACTOR_RESULT.md` under "Self-Audit".

### Self-audit verdict

A phase is `PASS` only if:
- All acceptance criteria are `PASS` with evidence.
- No forbidden behavior found.
- No undocumented deviation found.
- All application boundaries preserved.

Missing evidence = NOT PASS.

---

## 17. Regression Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CSS cascade change breaks rendering | Medium | High | Test all apps before/after each CSS change |
| `readability.css` change affects Staff app | Medium | High | Test Staff app after every `readability.css` change |
| `pos-theme.css` token change affects Customer and Staff | Medium | Medium | Validate all three entry points after every shared theme change |
| Service-workspace change breaks Root orders page | Medium | High | Test Root orders page after every SW change |
| Service-workspace change breaks Staff app | Medium | High | Test Staff app after every SW change |
| Font fallback to DM Sans causes layout shift | Low | Low | Verify rendered font family in DevTools |
| Spacing token changes cause layout overflow | Low | Medium | Visual regression test at all breakpoints |
| Breakpoint deviation causes layout collapse | Low | Medium | Test at canonical breakpoints and new ones |
| Token override chain produces wrong computed value | Low | High | Use DevTools computed styles to verify |

---

## 18. Rollback Strategy

Each phase must be independently reversible.

### General rollback

- All CSS changes should be committed atomically per phase.
- Rollback = revert the phase commit.
- Do NOT attempt to partially revert if the commit is not atomic.

### Per-phase rollback

| Phase | Rollback action |
|---|---|
| P-0 | No code changes → no rollback needed |
| P-1 | No code changes → no rollback needed |
| P-2 | Revert `font.css`, `style.css`, `theme.css` changes |
| P-3 | Revert `readability.css` / `pos-theme.css` token additions |
| P-4 | Revert spacing/radius token additions |
| P-5 | Revert Root CSS changes |
| P-6 | Revert `customer-web/src/style.css` |
| P-7 | Revert `service-workspace.css` and/or `staff-app/src/style.css` |
| P-8 | No code changes → if regression found, revert affected earlier phase |
| P-9 | Revert documentation changes |

---

## 19. Resolved Decisions

The following decisions are closed and are prerequisites for implementation:

| ID | Decision | Implementation rule |
|---|---|---|
| D-01 | `pos-theme.css` is the active final theme layer for Root, Customer, and Staff | Treat its final declarations as the runtime visual baseline |
| D-02 | `readability.css` is a supporting/reference layer, not the final theme authority | Do not add runtime visual changes only there |
| D-03 | `760px` and `1100px` are active POS theme breakpoints | Preserve them; document any new breakpoint requirement |
| D-04 | CSS structure is unchanged (Option C) | Refactor within current files and ownership boundaries |
| D-05 | Target visual direction is the active POS blue theme | Do not introduce forest/green or alternate theme values during this refactor |
| D-06 | Every screen must cover loading, empty, error, disabled, and responsive states | The happy path alone is not complete |
| D-07 | Visual consistency does not mean shared implementation | Keep Root, Customer, Staff, and Service Workspace patterns separate where documented |

---

## 20. Out of Scope

The following are explicitly OUT OF SCOPE for this refactor:

- React, Vue, TypeScript, or any new frontend framework.
- Tailwind or any utility-first CSS framework.
- Storybook or any component documentation system.
- CSS-in-JS or CSS modules.
- Merging `.btn` and `.sw-button`.
- Creating a universal Button component.
- Creating a universal ProductCard component.
- Copying customer `.dish` into Root or Staff.
- Extracting Root helpers from `main.js`.
- Deleting `style.css`, `theme.css`, or `pos-theme.css`.
- Rewriting entire CSS files for consistency.
- Migrating all existing CSS to `readability.css`.
- Aggressive design-token linting system.
- Backend status semantic unification (future direction, not this refactor).
- New breakpoints without documented requirements.
- Any change to business logic, API contracts, or data models.
- Any change to the backend.

---

## 21. Final Recommendation

### Immediate next step

**Execute Phase 0 as a read-only baseline audit using the resolved decisions above.**

Do not change source code until the baseline records:

- actual CSS import order for all three entry points;
- effective runtime custom properties and representative selectors;
- screenshots or equivalent visual evidence for each app;
- screen/state inventory and responsive behavior;
- the initial token candidate table.

### Recommended approach

1. Phase 0 is executed as a read-only baseline audit.
2. Phase 1 formalizes token candidates based on Phase 0 evidence.
3. The implementation owner approves the Phase 1 token candidate list.
5. Phases 2–4 implement approved tokens incrementally.
6. Phases 5–7 clean up application-specific CSS within boundaries.
7. Phase 8 validates cross-app integrity.
8. Phase 9 updates governance documentation.

### Why this approach

- It is the minimum viable change to achieve consistency goals.
- It avoids premature standardization.
- It preserves all confirmed architectural decisions.
- It makes every change independently reviewable.
- It gives future AI agents more accurate governance documentation.
- It does not require redesigning the application.

### Implementation gate

No source change is allowed before the Phase 0 result is complete and the Phase 1 token list is approved. Every visual change must identify:

1. the application context;
2. the owning stylesheet;
3. the runtime cascade position;
4. the affected screens and states;
5. the validation evidence for Root, Customer, and Staff when shared CSS is involved.

---

*End of FE_REFACTOR_PLAN.md*
