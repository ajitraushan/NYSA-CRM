-- Owner-approved separation of completed transactions from commission collection.
-- Keep receipt evidence, reconciliation, credit and payout constraints untouched.
-- No business rows or historical migration files are rewritten.
DROP TRIGGER IF EXISTS deals_commission_receipt_close_gate ON deals;
-- Retain enforce_commission_receipt_before_close_won() for a controlled policy rollback.
