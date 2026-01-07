
-- Modify subcategories table - add icon column
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS subcategory_icon text;

-- Modify transactions table - add new columns
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tag text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS group_name text;

-- Drop existing subcategories select policy and recreate without is_system
DROP POLICY IF EXISTS "Users can view subcategories of own categories" ON subcategories;
CREATE POLICY "Users can view subcategories of own categories" ON subcategories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM categories 
      WHERE categories.id = subcategories.category_id 
      AND categories.user_id = auth.uid()
    )
  );
