/*
  # Add volunteer location tracking

  1. New Tables
    - `volunteer_locations`
      - `id` (uuid, primary key)
      - `position_id` (uuid, references volunteer_positions)
      - `latitude` (double precision)
      - `longitude` (double precision)
      - `last_updated` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `volunteer_locations` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS volunteer_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid REFERENCES volunteer_positions(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE volunteer_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read volunteer locations"
  ON volunteer_locations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert volunteer locations"
  ON volunteer_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update volunteer locations"
  ON volunteer_locations
  FOR UPDATE
  TO authenticated
  USING (true);