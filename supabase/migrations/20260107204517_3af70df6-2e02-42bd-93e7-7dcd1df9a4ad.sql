-- Drop the audit triggers temporarily
DROP TRIGGER IF EXISTS audit_transactions_trigger ON transactions;
DROP TRIGGER IF EXISTS audit_accounts_trigger ON accounts;