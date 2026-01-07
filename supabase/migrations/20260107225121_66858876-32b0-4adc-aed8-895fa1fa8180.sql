
-- Create trigger function for closing balance calculation
CREATE OR REPLACE FUNCTION public.update_account_closing_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_account_id uuid;
  new_closing_balance numeric;
BEGIN
  -- Determine which account was affected
  IF TG_OP = 'DELETE' THEN
    affected_account_id := OLD.account_id;
  ELSE
    affected_account_id := NEW.account_id;
  END IF;

  -- Calculate new closing balance: opening_balance + credits - debits
  SELECT 
    COALESCE(a.opening_balance, 0) + 
    COALESCE(SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE 0 END), 0)
  INTO new_closing_balance
  FROM accounts a
  LEFT JOIN transactions t ON t.account_id = a.id
  WHERE a.id = affected_account_id
  GROUP BY a.id, a.opening_balance;

  -- Update the account's closing balance
  UPDATE accounts 
  SET closing_balance = COALESCE(new_closing_balance, (SELECT opening_balance FROM accounts WHERE id = affected_account_id))
  WHERE id = affected_account_id;

  -- Handle UPDATE where account_id changed - recalculate old account too
  IF TG_OP = 'UPDATE' AND OLD.account_id IS DISTINCT FROM NEW.account_id THEN
    SELECT 
      COALESCE(a.opening_balance, 0) + 
      COALESCE(SUM(CASE WHEN t.transaction_type = 'credit' THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.transaction_type = 'debit' THEN t.amount ELSE 0 END), 0)
    INTO new_closing_balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id
    WHERE a.id = OLD.account_id
    GROUP BY a.id, a.opening_balance;

    UPDATE accounts 
    SET closing_balance = COALESCE(new_closing_balance, (SELECT opening_balance FROM accounts WHERE id = OLD.account_id))
    WHERE id = OLD.account_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS update_closing_balance_trigger ON transactions;
CREATE TRIGGER update_closing_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_closing_balance();
