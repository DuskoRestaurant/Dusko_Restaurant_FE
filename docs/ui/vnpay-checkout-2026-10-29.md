# VNPay checkout regression

Selecting VNPay then switching away from and back to the bill recreated the
select with CASH as its default. A changed bill snapshot during refresh had the
same problem. Payment selection now belongs to the workspace state and resets
only when selecting a table or changing dining sessions. VNPay continues to use
the payment creation API; it never falls back to ordinary checkout on failure.
The visible option is named VNPay. Provider configuration remains unchanged.

Business errors now also appear in a visible error toast rather than only above
the table, which can be outside the current viewport.

Validation:
- `node tests/browser/vnpay-checkout.mjs`: passes using Edge and a mocked API.
- `TEST_BASELINE=ec27db2` with the same test fails: expected QR_BANKING, got CASH.
- 97 existing tests pass; all three applications build successfully.
- Read-only production inspection found the reported table's items served,
  recipes present, stock sufficient, and an expired pending VNPay request.
  The screenshot does not include the 409 response body, so the exact historical
  server rejection cannot be established from this evidence alone.

The browser regression checks tab changes, bill refresh, payment API selection,
visible 409 errors without a cash fallback, and resetting for a new session.
It does not contact VNPay or verify a real provider settlement.

Run with Playwright available via Node module resolution; Windows uses the
installed Edge channel. The optional TEST_BASELINE git ref loads only the old
workspace module through Vite, without modifying the working tree.
