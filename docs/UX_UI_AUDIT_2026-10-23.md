# Dusko — UI/UX Audit & Prioritized Recommendations

**Date:** 2026-10-23 · **Scope:** `Dusko_Restaurant_FE` (management console, `staff-app`, `customer-web`)
**Method:** static analysis of all CSS/JS + live inspection of the three built apps (screenshots taken; cascade order verified against the production bundles, not just import statements).

> **Status: remediation in progress.** The four CSS foundation steps (palette, tokens, dark mode, scoping) were executed and verified on 2026-10-23 — see [Remediation log](#remediation-log-verified-2026-10-23) at the end of this document for what changed, how it was verified, and the known limits. The accessibility / async / loading-state / responsive findings below are **still open**.

---

## Executive summary

The codebase is **not sloppy** — there are disciplined patterns already in place (`perform()`/`busy()` in `main.js:107-116`, `setBusy()` in `service-workspace.js:49`, native `<dialog>` in 7 modules, real `<button>` elements throughout, delta-based cart updates). The problem is not missing care; it is that **those good patterns were built on a styling foundation that has no single source of truth.**

That one root cause explains nearly every symptom in this report:

| | |
|---|---|
| CSS layers redefining the same tokens | **4** |
| Hardcoded hex colors | **965** |
| Token adoption (`var(--…)` references) | **35%** |
| `!important` overrides | **33** |
| Typefaces intended | **3** (Nunito, Inter, Manrope) |
| Typefaces actually loaded | **1** (Nunito) |
| Dark mode | **none — zero code** |

Until color is expressed as tokens, every theme-level change (dark mode above all) is a 965-value sweep. Fix that first and the rest becomes cheap.

---

## P0 — Critical

### 1. Dark mode does not exist

Not partially implemented — **completely absent**.

- `prefers-color-scheme`: **0 occurrences** across every `.css` and every built bundle.
- `matchMedia` / theme class / theme `localStorage`: **0 occurrences** in every `.js`.
- The only `color-scheme` declaration is `src/theme.css:1` → `color-scheme:light`, which actively pins light.
- `staff-app` and `customer-web` ship **no** `color-scheme` at all, so their form controls and scrollbars fall back to UA defaults.
- `meta theme-color` is hardcoded dark (`#101010` customer, `#111111` staff) over a light-only UI — on an OS in dark mode the browser chrome is near-black above a white page.

**Why it's blocked:** dark mode is a ~15-line token override *only if* tokens are authoritative. Today it would mean hand-editing 965 hex values across 17 stylesheets.

**Fix (do this after #2):**
```css
/* tokens.css — one block, authoritative */
:root { color-scheme: light; --canvas:#FBF7F2; --surface:#FFF; --ink:#3B2923; /* … */ }
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; --canvas:#15110F; --surface:#1F1A17; --ink:#F2EAE4; /* … */ }
}
[data-theme="dark"] { color-scheme: dark; /* same overrides, for manual toggle */ }
```
Ship `prefers-color-scheme` first (zero JS, zero risk), add a toggle later.

### 2. Two live color palettes on one screen — visually confirmed

Screenshot evidence from the built management + staff apps: the login page renders **blue** brand chrome (`#087fae` button, `#093850→#086b99` gradient hero) sitting directly beside **terracotta** accents (`#C85A3F` logo, "Mở trang quản lý →" link, "Hiện" password toggle).

Cause — the token layer is overridden by a hardcoded, `!important` "premium" block. `.entry-intro` alone is declared **5 times** in one bundle:

| # | Declaration | Source |
|---|---|---|
| 1 | `background:var(--primary-dark)` | `app-entry.css` |
| 2 | `background:var(--primary)` | override |
| 3 | `background:var(--primary)` | override |
| 4 | **`background:linear-gradient(145deg,#093850,#086b99)!important`** | `pos-theme.css` |
| 5 | (media) | — |

The customer app adds two more off-palette colors: blue presence bar (`#eaf1fb`/`#2b4d80`) and amber warning (`#fdf3e3`/`#8a5a12`) in `customer-cart.css`.

**Fix:** decide the brand palette once (the warm `#FBF7F2`/`#C85A3F` tokens look deliberate and are used most widely), delete the `.entry-premium` `!important` layer, and delete the `--pos-*` alias family (`--pos-bg/--pos-blue/--pos-dark/--pos-line/--pos-text`) which duplicates the canonical tokens with 0 added meaning.

### 3. Customer-app tap targets silently shrunk to 38×36px

**Verified.** The customer app deliberately sizes its quantity steppers for phones; the shared sheet overrides it.

| Rule | Size | Loads |
|---|---|---|
| `customer-web/src/style.css` `.stepper button` | `min-height:44px; width:46px` → `42px` mobile | first |
| `src/pos-theme.css` `.stepper button` | **`width:38px;height:36px`** | **last — wins** |

Same specificity (0,1,1); `pos-theme.css` is imported last, so the shared sheet wins. The `body:has(.customer-layout)` variants only recolor — they never restore the size. Net effect: the primary "+" control on a QR-scanned phone is **36px tall**, below both the 44px iOS and 48px Android guidelines.

Also under-sized: cart `+`/`−` at 40px on ≤540px (`customer-cart.css:22`), the `Xem giỏ món ↓` jump link (~33px), help-panel close `×` (~28px), and all staff buttons at 42px.

**Fix:** scope the shared sheet so it cannot outrank a sub-app, and raise the floor to 44px across the board.

---

## P1 — High

### 4. Typography is incoherent

**Three typefaces intended, one loaded.** `src/font.css:1` imports only Nunito.
- `Manrope` referenced 5× in `theme.css` (all KDS/kitchen-display styles: 12/18/19/26/34px) → silently falls back to **Arial**. The kitchen display is a glanceable, high-stakes screen rendering in a different typeface from everything else.
- `Inter` referenced in `staff-app/src/style.css:8`, `app-entry.css:1`, `service-workspace.css:1` → falls back to **Segoe UI/system-ui**. The staff *login screen* therefore renders in a different font from the staff *workspace*.

**No type scale.** 25 distinct `font-size` values, near-contiguous from 9px to 30px, plus 32 and 54. Specifically:
- `h1` is declared at **15 different sizes** (20, 24, 25, 26, 27, 28, 29, 30, 32, two clamps…).
- `h2` at **12+ different sizes** (15, 17, 18, 19, 20, 21, 22, 23, 24, 25).
- **Headings smaller than body text:** `h1{font-size:20px}`, `h1{font-size:15px}`, `h2{font-size:15px}` all exist against an 18px base.
- 22 declarations at 9–10px — below any accessible minimum.

**Fix:** add 5 scale tokens (`--fs-h1/-h2/-h3/-body/-price`), then replace declarations mechanically. Delete the `Manrope`/`Inter` references or actually load them — pick one family.

### 5. Measured WCAG contrast failures

Computed from the effective (winning) palette:

| Pair | Ratio | Verdict |
|---|---|---|
| `--warning #C58A32` on white | **2.98:1** | **FAIL** |
| `--muted` on `--accent-soft` (notice boxes) | 4.19:1 | fails AA |
| `--primary #C85A3F` on canvas | 3.95:1 | fails AA |
| `--primary #C85A3F` on white (link buttons) | 4.21:1 | fails AA |
| `#888` on `#f5f5f5` (`.empty span`) | 3.25:1 | fails AA |
| `--muted` on `--canvas` (body) | 4.66:1 | AA, thin margin |
| `--ink` on `--canvas` (headings) | 12.89:1 | AAA |

**5 of 12 pairs fail AA.** `--warning` at 2.98:1 is the worst — it's used for status badges.

**Fix:** darken `--warning` and `--primary` until ≥4.5:1 on their intended backgrounds, then re-check in both themes. A dark theme needs its own contrast pass — inverting lightness does not preserve ratios.

### 6. All action feedback is invisible to screen readers

`src/main.js:93`:
```js
function toast(message, bad=false){ const el=document.createElement('div'); el.className=`toast ${bad?'bad':''}`; … }
```
No `role`, no `aria-live`. This is the channel `perform()` (`main.js:116`) uses for **every** action success and error in the console.

Meanwhile `toast.js:39-40` does it correctly (`role="alert"`/`role="status"` + `aria-live`). Both are live in the same app — two toast systems, two visual designs, two accessibility contracts.

**Fix:** collapse `main.js`'s inline toast onto `toast.js`'s `createToast()`.

### 7. Double-submit on a mutating request

`main.js:407` is the only action in the dispatcher **not** wrapped in `perform()`:
```js
if(action==='receipt') return openReceipt(api, …);
```
→ `receipt.js:15` issues `POST /api/receipts/…` with no in-flight UI. The dialog only appears after the round-trip, so the button looks dead and is clickable. Two clicks = two POSTs.

Also `main.js:396` (`kitchen-fullscreen`) has no error handling — a denied fullscreen request becomes an unhandled rejection with **zero** user feedback.

`customer-web/src/main.js:221` `addCombo` sets no busy flag and no `cartPending`; its only feedback, a `.combo-message`, has **no CSS rule anywhere in the bundle** and is destroyed by the next `renderCombos()`.

**Fix:** wrap in `perform()`; add a `comboPending` id.

### 8. Live-update failures are silently swallowed

`src/live-updates.js:22` — **verified**:
```js
if (onEvent) { try { onEvent(message); } catch (error) { console.error('[live event]', error); } return; }
```
`onEvent` is never awaited inside a sync `try/catch`, and both consumers pass `async` handlers (`main.js:514`, `service-workspace.js:191`). Therefore:
1. The `catch` is **dead code** — rejections escape as unhandled promise rejections.
2. The intentional control-flow throws (`main.js:506/510/519`, `service-workspace.js:231`) become unhandled rejections rather than signals.
3. The refresh is dropped with no retry — the view silently goes stale.

Note the asymmetry: the `onChange` path (`live-updates.js:12-13`) *is* awaited and *does* have a retry timer. Only `onEvent` is broken.

**Fix:** `Promise.resolve(onEvent(message)).catch(…)` routed into the existing retry timer — one line.

---

## P2 — Medium

### 9. Three modals have no focus trap
`main.js:227`, `:345-348` (`formModal`), `:365-368` use `div.modal-wrap[role="dialog"]` instead of native `<dialog>`, so **Tab escapes to the page behind** and focus isn't restored on close. Seven other modules already use `<dialog>.showModal()` correctly. Convert these three to match.

### 10. Loading states are missing or misleading
- `accounts.js:25` and `combo-approval.js:5` — **blank screen** during fetch (no placeholder at all).
- `fp-pipeline.js:238-248` — `draw()` runs *before* the fetch and renders "Chưa có bộ dữ liệu." / "Chưa có snapshot nào." The user is told there is no data, then data appears.
- `service-workspace.js:184` — loading text reuses the `.sw-empty` class, so "loading" and "no data" look identical.
- `service-workspace.js:231` — `onStatus:live=>{liveConnected=live}` records a dropped WebSocket but never surfaces it; the view silently degrades to 12s polling.
- Both sub-app `index.html` files ship an **empty `<div id="app">`** — blank white screen on first paint. The main app gets this right with an inline `role="status"` splash.
- `.loading` has no spinner or skeleton anywhere — `theme.css:68` gives it only `color:#666`.

### 11. Customer mobile layout hides the primary CTA
`pos-theme.css` sets `.customer-layout .cart{position:static}` at ≤760px, and DOM order (`customer-web/src/main.js:60`) puts the cart **last**, after the full dish grid. On a phone the total and "Gửi yêu cầu" scroll off screen, leaving only a ~33px "Xem giỏ món ↓" jump link as mitigation.

Also: the help FAB (`customer-help.css`, `position:fixed;bottom:18px`) floats over the last dish card with no `padding-bottom` clearance, and its panel opens with **no scrim, no focus trap, no Escape handler, no scroll lock**.

**Fix:** on ≤760px make total + CTA a `position:sticky;bottom:0` bar; reserve `padding-bottom:calc(72px + env(safe-area-inset-bottom))`.

### 12. Quantity changes announce nothing
`<span data-quantity>` (`customer-web/src/main.js:59`) has no `aria-live`, and updates only *after* the server responds (`main.js:132`). A tap gives no immediate feedback. `changeQuantity` is guarded by `state.busy` but not `state.cartPending` (`main.js:163`), so rapid taps fire parallel POSTs.

### 13. Dead and duplicate CSS
- `staff-app/src/style.css` L1-5 is a **complete legacy POS layer** (`.table`, `.product`, `.order`, `.cartline`, `.confirm`…) that no live markup produces — ~2.3KB styling a deleted screen. L7-33 then redefines the same selectors again.
- `main.js:178-196`: the entire legacy order UI is still rendered and **fully functional** inside a collapsed `<details>`, with 8 live action branches in the shared dispatcher.
- `src/live-events.js` is imported only by a test — dead at runtime.
- `escapeHtml` duplicated 4×, `money` 3× (already disagreeing on `maximumFractionDigits` and currency), button factories 3× with divergent `type="button"` handling.

---

## P3 — Polish

- **`main.js:111-113`** — the `Đang xử lý…` label only appears if the clicked button is `document.activeElement`. Safari doesn't focus `<button>` on click, so on that platform **no button ever shows a text change**, only a grey disabled state. Pass the trigger button explicitly instead of inferring it.
- **`kitchen-view.js:14` + `main.js:204`** — `aria-live="polite"` wraps a region that gets wholesale `innerHTML`-replaced every 15s. Screen readers re-announce the entire KDS board on every tick. Use a small dedicated `role="status"` for the timestamp only.
- **`main.js:123`** — sidebar active state is conveyed by CSS class only; no `aria-current="page"`, and `<nav>` has no accessible name. (`app-entry.js:14` already does this correctly.)
- **`service-workspace.js:68,72`** — broken ARIA tabs: `role="tablist"`/`role="tab"` present, but the panel has no `role="tabpanel"`, tabs have no `id`/`aria-controls`, no roving `tabindex`, no arrow-key handling.
- **Missing `type="button"`** in `main.js:55` and `management.js:4` button factories (only `service-workspace.js:44` emits it). Latent today, an accidental-submit bug the moment one lands inside a form.
- **`main.js:406`** — `.filter(o=>o.id!==id || o.userId!==state.user.id)` uses `||` where `&&` is clearly intended. Correct only because `offline.js:10-12` pre-filters. Flagged so it isn't "simplified" into a real cross-user deletion later.
- No `viewport-fit=cover` (no safe-area insets) in either sub-app; customer app has no manifest/service worker while staff does.

### What's working — don't regress
Zero non-semantic click targets (no `div`/`span` + `onclick` anywhere). All icon-only buttons have `aria-label`. No Enter-keydown handlers bypassing click handlers. Pinch-zoom is not blocked in either sub-app. `#submit` in the customer app has a genuine 3-state label and an idempotency key persisted *before* the request. Cart updates are delta-based specifically so two guests tapping "+" can't overwrite each other. Focus rings are visible throughout. The KDS, VNPay dialog, and staff workspace have real per-action feedback.

---

## Recommended order

Sequenced by impact ÷ risk. Items 1–8 are the high-value core.

| # | Action | Effort | Why now |
|---|---|---|---|
| 1 | Pick one palette; delete `.entry-premium` `!important` + `--pos-*` aliases | S | Fixes the visible two-palette clash immediately |
| 2 | Consolidate into one `:root` token block; route hex → tokens (965 values, mechanical) | L | **Unblocks dark mode and everything else** |
| 3 | Add `[data-theme=dark]` + `@media(prefers-color-scheme:dark)` + `color-scheme` + `theme-color` | S | Now a ~15-line change instead of a 965-edit sweep |
| 4 | Scope `pos-theme.css` so it can't outrank sub-apps; 44px tap-target floor | S | Restores the customer app's intended phone ergonomics |
| 5 | `live-updates.js:22` one-line retry fix | XS | Currently defeats the entire live-update design |
| 6 | Wrap `main.js:407` in `perform()`; guard `kitchen-fullscreen`; guard `addCombo` | XS | Removes the double-submit paths |
| 7 | Unify the toast path onto `toast.js` (adds `aria-live` to all action feedback) | S | Fixes a11y and kills a duplicate system |
| 8 | Convert the 3 `div.modal-wrap` modals to native `<dialog>` | S | Fixes focus trapping repo-wide in one move |
| 9 | Type scale tokens; resolve Manrope/Inter; raise the 9–10px floor | M | Large legibility win on the KDS |
| 10 | Fix the 5 failing contrast pairs; re-check in dark | S | Accessibility compliance |
| 11 | Loading placeholders for `accounts`/`combo-approval`/`fp-pipeline`; splash in sub-app HTML | S | Removes blank + false-empty states |
| 12 | Sticky bottom CTA bar on customer mobile; FAB clearance | M | Primary action always reachable |
| 13 | Delete dead CSS (`staff-app` L1-5, legacy order UI, `live-events.js`) | M | Maintenance, not user-visible |

**Note:** `prefers-color-scheme` alone (item 3, OS-driven, no toggle UI) delivers most of dark mode's value at a fraction of the risk. A manual toggle is optional and can follow.
---

## Remediation log (verified 2026-10-23)

The four CSS foundation steps were executed in the required order. Every step was
validated before the next one began. Numbers below are measured, not estimated.

### Step 1 — One brand palette, no theme-defeating overrides  ✅

**Palette chosen: the warm Dusko identity** (cream canvas, terracotta brand, sage
accent). Rationale: it is the only palette authored as a complete design system
with dedicated Admin/Staff/Customer scoped layers, and it matches the brand
splash in `index.html` (`#493c31` on `#faf8f5`). The blue POS generation was the
older, superseded layer.

Changes:
- Created **`src/tokens.css`** as the single authoritative token source, imported
  first by all three entry points (`src/main.js`, `staff-app/src/main.js`,
  `customer-web/src/main.js`).
- Deleted the competing `:root` blocks from `pos-theme.css` (warm foundation and
  the `--pos-*` alias family) and `readability.css` (cool-gray set + the unused
  `--warm`/`--blue` pair, which had **zero** consumers).
- Removed the `.entry-premium .entry-intro{background:linear-gradient(…)!important}`
  override and replaced it with `linear-gradient(145deg,var(--brand-1),var(--brand-2))`
  — same hero structure, now token-driven and no `!important`.
- Tokenised the remaining login blues (`.entry-submit`, `.entry-role-badge`,
  `.entry-form-logo`, kicker/help/label colors).

**Verified:** blue `#093850` / `#087fae` / `#087ba8` / `#eef7fc` / `#fbfdff` all
report **0 occurrences** in every built bundle. Screenshots of admin, staff and
customer login show a single warm palette with no blue.

### Step 2 — One authoritative token block  ✅

- Migrated **13 stylesheets** to semantic tokens, all now at **0 hardcoded hex**:
  `toast.css`, `confirm-dialog.css`, `service-workspace.css`, `vnpay-payment.css`,
  `mfa-login.css`, `receipt.css`, `qr-preview.css`, `accounts.css`, `offline.css`,
  `forecast.css`, and the customer app's `style.css`, `customer-cart.css`,
  `customer-help.css`.
- Added semantic tokens for status tints, inverse surfaces (toasts), overlay and
  backdrops, plus a `--tap-min` interaction floor.
- **Typography:** `Manrope` was referenced 5× (all kitchen-display styles) and
  `Inter` in 3 files, but neither is loaded — both silently fell back to Arial /
  Segoe UI. All now use `var(--font-ui)`, so one family renders throughout. The
  customer app's `body{font:…system-ui}` override was removed.
- Left `theme.css` (admin base layer) and the legacy generation inside
  `pos-theme.css` mostly as-authored on purpose — see *Known limits*.

**Verified:** token adoption rose **35% → 45%** overall (965 hex → 946 hex,
526 → 785 token references). Tests 33/33, all three builds clean.

### Step 3 — Dark mode  ✅

- Added a single `@media (prefers-color-scheme: dark)` token block to
  `tokens.css`. **No JavaScript, no manual toggle** — the architecture did not
  require one.
- Removed the unconditional `color-scheme:light` pin from `theme.css`; `color-scheme`
  is now declared once per theme in `tokens.css`.
- Fixed a dark-mode contrast defect found during visual testing: the login hero
  kicker/eyebrow used `--primary-soft` (a *background tint*) as a *text colour*,
  giving **1.95:1** on the dark hero — effectively invisible. Switched hero text to
  `--on-brand`, which is **6.43:1** in dark and **5.03:1** in light.

**Verified:** `tools/contrast.js` reports **0 failing pairs of 37** in both themes,
plus both non-text border checks passing 3:1. Dark mode was emulated with headless
Chrome (`--blink-settings=preferredColorScheme=0`) and screenshotted for all
three apps in both light and dark.

### Step 4 — Scope `pos-theme.css`  ✅

- Confirmed the real app roots in rendered markup before choosing a selector:
  `.layout` (`src/main.js:124`, admin), `.staff-app-surface`
  (`staff-app/src/main.js:43`, staff), `.customer-layout` and `.guest-entry`
  (`customer-web/src/main.js:59`, customer), `.entry-page`
  (`src/app-entry.js:14`, login). No speculative selectors were used.
- Scoped **32 customer-app selectors** in `pos-theme.css`'s legacy block under
  `body:has(.customer-layout)` so the shared sheet can no longer reach into the
  customer app. `.entry-*` rules were deliberately left unscoped — the login screen
  is shared by admin + staff and those class names collide with nothing.
- Touch targets: the shared sheet's `.stepper button{width:38px;height:36px}` beat
  the customer app's own 44px because it loaded later. It is now scoped **and**
  sized `48×48`; the cart stepper was raised to 48px at both breakpoints.

**Verified by computed style**, not by reading CSS: a temporary probe page linked
the real built `customer-web` CSS and measured the rendered boxes at a 414px
viewport — `stepperButton 48×48`, `cartStepperButton 48×48`, `submitButton 458×48`.
The probe files were deleted after use.

### Regression status after all four steps

| Check | Result |
|---|---|
| `npm test` | **33/33 pass** |
| `npm run build:all` | **3/3 build clean** |
| Contrast, light theme | **0 failing of 37** |
| Contrast, dark theme | **0 failing of 37** |
| Non-text borders (3:1) | **pass both themes** |
| Light + dark screenshots, 3 apps | rendered, single palette |
| Customer touch targets | **48×48 computed** |

### Known limits — stated plainly

1. **The backend was not running** during this work (`:8080` unreachable), so
   **logged-in screens could not be visually verified** — the admin console
   dashboard, the staff service workspace, and the customer menu/cart behind a QR
   token. Everything reachable without authentication was checked.
2. Consequently `theme.css` (173 hex) and the legacy generation inside
   `pos-theme.css` were **not** bulk-rewritten. Those layers are largely overridden
   by the tokenized `.layout` / `.staff-app-surface` scoped layers, so bulk-editing
   them risked the admin shell with no way to see the result. The kitchen display
   (`.kds-*`, `theme.css:100-109`) is the most likely place for a remaining dark-mode
   gap and **should be checked on a running backend**.
3. Remaining findings in this document (P0–P3 accessibility, async, loading
   states, responsive, cleanup) are **not started**.

### Follow-ups worth doing next

1. Start the backend and visually review the kitchen display + admin dashboard in
   **both** themes — that is where any residual hardcoded colour will show.
2. Tokenise `theme.css` `.kds-*` once that review confirms what is actually live.
3. Then work the P0–P3 list, starting with `live-updates.js:22` (one line) and
   `main.js:407` (wrap in `perform()`), which are the two highest-impact JS bugs.

---

## Remediation log — phases 1–4 (verified 2026-10-23)

Continued after the CSS foundation work. Backend `:8080` was re-checked and is
**still unreachable**, so every claim below is backed by tests, builds, computed
styles or headless screenshots — never by an authenticated screen.

### Phase 1 — Async safety and duplicate submission

**`live-updates.js`** — the old code wrapped an `async onEvent` in a *synchronous*
`try/catch`, so its rejection was unobservable and escaped as an unhandled
rejection; the refresh was silently dropped. Consumers signal control flow by
throwing, and the two sentinels mean opposite things:

| thrown | meaning | correct handling |
|---|---|---|
| `login` | the watcher belongs to a superseded session | **stop** — retrying would refetch under a stale token |
| `busy` / `retry` | a request is already running | **retry** |

`onEvent` is now settled explicitly, the sentinels are honoured separately, and
transient failures retry with **bounded exponential backoff** (5 attempts,
1s→16s). A first attempt at this used a flat 1s retry; testing immediately showed
that turned a persistently failing consumer into a permanent 1 Hz loop, which was
worse than the original silent drop. The disposer also now clears
`handshakeTimer`, which previously leaked a 10s timer per stopped watcher.

**`main.js`** — the `receipt` action was the only branch in the dispatcher not
wrapped in `perform()`; it now is, so the button is disabled while the request
runs and failures surface through the same toast path as every other action.

**`receipt.js`** — `openReceipt` issues a mutating POST with no in-flight guard,
so a double click created two receipts. The concurrency concern was extracted to
**`src/single-flight.js`** (`createSingleFlight`) rather than inlined, so it is
unit-testable without a DOM and reusable elsewhere. The entry is released on
settle — success *and* failure — so a genuine retry still works while a pending
request is never duplicated.

**Tests: 33 → 52.** `tests/live-updates.test.js` (12) and
`tests/single-flight.test.js` (7) cover success, failure, repeated calls, retry
after failure, terminal-vs-transient, cleanup cancelling a queued retry, and the
absence of unhandled rejections.

### Phase 2 — Accessibility

**Toasts unified.** The console ran **three** notification systems: a local
`toast()` building bare `.toast` divs with no ARIA, plus a `createToast()` stack
in `main.js` and another inside `service-workspace.js`. Action feedback was
therefore completely silent to screen readers. Added `sharedToast()` to
`toast.js`; all 31 call sites keep their `(message, bad)` signature and now route
through one stack with one live region. No `.toast` producer remains.

**Modals converted to native `<dialog>`.** The three `div.modal-wrap` modals
(inventory Excel, manage form, recipe) declared `role="dialog" aria-modal="true"`
while providing no focus trap — they promised inertness the markup never
delivered. Tab walked into the page behind, focus was not restored on close, and
the recipe dialog had **no Escape handler at all**. They now use `showModal()`,
matching the seven dialogs that already did it correctly. The overlay dim moved to
`::backdrop`; the "don't dismiss while saving" Escape guards were preserved via the
`cancel` event; click-outside and Escape behaviour is retained.

### Phase 3 — Loading, empty and error states

| Surface | Was | Now |
|---|---|---|
| Accounts | blank until the fetch returned; a failure rendered nothing | explicit `Đang tải…` placeholder, then the table |
| Combo approval | blank until loaded; errors replaced the panel with bare text | loading placeholder, then content, or a styled error |
| FP-Growth snapshots | rendered **"Chưa có snapshot nào."** *while still fetching* — a false empty state | `busy ? "Đang tải…"` → `"Chưa có snapshot nào."` |

Empty responses, populated responses and errors are now three distinguishable
states rather than one ambiguous "nothing here" message.

### Phase 4 — Responsive and cleanup

- **Customer cart CTA:** at ≤1050px the cart is last in DOM order, so the total and
  "Gửi yêu cầu" sat below the entire dish grid. The cart is now a sticky bottom
  bar with a scrollable item list, and `main` gets bottom padding so the fixed help
  button no longer covers the last dish card.
- **Kitchen Display dark mode:** 25 `.kds-*` / `.kg-*` / `.recipe-*` rules in
  `theme.css` were hardcoded light values and would have rendered light-on-light in
  dark mode. These were tokenised **without redesigning the KDS** — the
  high-contrast inverse chips swap to the `ink`/`surface` pair so they stay legible
  in both themes. No bulk rewrite of the rest of `theme.css` was attempted.

### Correction to an earlier finding

The audit claimed `staff-app/src/style.css` L1-5 was ~2.3KB of **dead** legacy CSS
safe to delete. **That was wrong**, and verification caught it before any deletion:

| selector | in staff markup |
|---|---|
| `.tables`, `.table`, `.product`, `.order`, `.products`, `.secondary` | **live** |
| `.cartline`, `.login`, `.link` | unused |

Six of the nine selectors are in active use. **Nothing was deleted** — removing
that layer would have stripped styling from the staff workspace. Only three
individual selectors are candidates for removal, which is not worth the risk.

### Verification

| Check | Result |
|---|---|
| `npm test` | **52/52 pass** (was 33) |
| `npm run build:all` | **3/3 clean** |
| Contrast, light + dark | **0 failing of 37**, both themes |
| Non-text borders | **3:1 pass**, both themes |
| Screenshots: admin + customer, light + dark | render correctly |
| Customer mobile at 390×844 | renders, cart reachable |

### Still not verified — needs the backend

1. **The three converted modals were not exercised at runtime.** They sit behind
   authentication, so focus trapping, Escape, backdrop dismissal and focus
   restoration are verified by construction (native `<dialog>`) but **not by
   observation**. Open each one on a running backend.
2. **Kitchen Display** was tokenised statically; the board itself was never
   rendered. It is the most likely place for a residual dark-mode defect.
3. **Admin dashboard and staff service workspace** remain unrendered.
4. **The FP-Growth loading change** and the combo/accounts error states follow the
   same constraint.

### Remaining open findings

Not started: `busy()` label depends on `document.activeElement` (Safari), KDS
`aria-live` re-announcing the whole board every 15s, broken ARIA tabs in
`service-workspace.js:68/72`, missing `type="button"` in two button factories, the
`||` that should be `&&` at `main.js:406`, and the duplicated `escapeHtml`/`money`
helpers.