/*
  # Add arrived column to volunteer_signups

  1. Changes
    - Add `arrived` column to `volunteer_signups` table with default value of false
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'volunteer_signups' AND column_name = 'arrived'
  ) THEN
    ALTER TABLE volunteer_signups ADD COLUMN arrived boolean DEFAULT false;
  END IF;
END $$;