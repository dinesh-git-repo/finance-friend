-- Drop audit triggers on transactions and accounts
DROP TRIGGER IF EXISTS audit_transactions ON transactions;
DROP TRIGGER IF EXISTS audit_accounts ON accounts;