-- Add txn_id column for user's custom transaction ID from CSV
ALTER TABLE public.transactions ADD COLUMN txn_id text;