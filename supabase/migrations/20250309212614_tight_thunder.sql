/*
  # Add zones for area management

  1. New Tables
    - `zones`
      - `id` (uuid, primary key)
      - `name` (text)
      - `volunteer_count` (integer)
      - `status` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `zones` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  volunteer_count integer DEFAULT 0,
  status text DEFAULT 'good',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read zones"
  ON zones
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update zones"
  ON zones
  FOR UPDATE
  TO authenticated
  USING (true);