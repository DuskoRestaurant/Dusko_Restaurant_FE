# Checkout promotion codes

The table bill now provides a code input, Apply and Remove controls, the dish subtotal, total discounts and the payable total. Applied codes survive table refreshes because they are stored on the server; drafts survive tab changes. Errors remain visible and do not clear a previously applied valid discount.

The server prices accepted orders after existing combo discounts, validates branch/date/minimum/member eligibility and redemption limits, and reserves one usage for the bill. Reapplying restores and recalculates the previous code atomically. New orders are included when the cashier reapplies the code. Active or review-required VNPay transactions block changes. Gift codes belong to the ordering stage so kitchen work is not skipped.

Deploy backend migration 20261029000000_checkout_promotion before the frontend.

Validation: browser apply/remove/invalid/Enter and 390/1440px layouts; existing VNPay selection regression; 98 unit tests and all app builds. Backend integration tests cover repeated/concurrent application, usage limits, customer reassignment and discounted cash/POS/VNPay settlement using isolated test databases.
