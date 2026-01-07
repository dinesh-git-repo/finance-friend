-- Add new values to account_type enum
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'Overdraft';
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'BNPL';
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'Demat';
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'Personal Loan';

-- Add missing columns to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS issuer_name text,
ADD COLUMN IF NOT EXISTS account_number text,
ADD COLUMN IF NOT EXISTS account_variant text,
ADD COLUMN IF NOT EXISTS card_network text,
ADD COLUMN IF NOT EXISTS network_variant text,
ADD COLUMN IF NOT EXISTS credit_limit numeric,
ADD COLUMN IF NOT EXISTS statement_day integer,
ADD COLUMN IF NOT EXISTS repayment_day integer;

-- Remove the old balance column
ALTER TABLE public.accounts DROP COLUMN IF EXISTS balance;