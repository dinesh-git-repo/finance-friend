-- Add 'ACH' to the transaction_mode enum
ALTER TYPE transaction_mode ADD VALUE IF NOT EXISTS 'ACH';