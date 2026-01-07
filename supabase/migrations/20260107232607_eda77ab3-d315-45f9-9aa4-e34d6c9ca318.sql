-- Add category_name and subcategory_name text columns to transactions table
-- This allows storing category/subcategory as plain text without foreign key relationships

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS category_name text,
ADD COLUMN IF NOT EXISTS subcategory_name text;