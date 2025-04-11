/*
  # Initial Schema Setup for Volunteer Management System

  1. New Tables
    - events
      - id (uuid, primary key)
      - name (text, unique)
      - date (date)
      - time (time)
      - location (text)
      - user_id (uuid, foreign key)
    
    - volunteer_positions
      - id (uuid, primary key)
      - event_id (uuid, foreign key)
      - name (text)
      - needed (integer)
      - filled (integer)
      - description (text)
      - skill_level (text)
      - latitude (double precision)
      - longitude (double precision)
      - user_id (uuid, foreign key)
    
    - volunteer_signups
      - id (uuid, primary key)
      - position_id (uuid, foreign key)
      - volunteer_name (text)
      - phone_number (text)
      - start_time (time)
      - end_time (time)
      - arrived (boolean)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Events table
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  date date NOT NULL,
  time time NOT NULL,
  location text NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own events"
  ON events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
  ON events
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Volunteer positions table
CREATE TABLE volunteer_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  needed integer NOT NULL,
  filled integer DEFAULT 0,
  description text,
  skill_level text,
  latitude double precision,
  longitude double precision,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE volunteer_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read volunteer positions for their events"
  ON volunteer_positions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = volunteer_positions.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert volunteer positions for their events"
  ON volunteer_positions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their volunteer positions"
  ON volunteer_positions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = volunteer_positions.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their volunteer positions"
  ON volunteer_positions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = volunteer_positions.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Volunteer signups table
CREATE TABLE volunteer_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid REFERENCES volunteer_positions(id) ON DELETE CASCADE NOT NULL,
  volunteer_name text NOT NULL,
  phone_number text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  arrived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE volunteer_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read volunteer signups for their events"
  ON volunteer_signups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM volunteer_positions
      JOIN events ON events.id = volunteer_positions.event_id
      WHERE volunteer_positions.id = volunteer_signups.position_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert volunteer signups for their events"
  ON volunteer_signups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM volunteer_positions
      JOIN events ON events.id = volunteer_positions.event_id
      WHERE volunteer_positions.id = position_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update volunteer signups for their events"
  ON volunteer_signups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM volunteer_positions
      JOIN events ON events.id = volunteer_positions.event_id
      WHERE volunteer_positions.id = volunteer_signups.position_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete volunteer signups for their events"
  ON volunteer_signups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM volunteer_positions
      JOIN events ON events.id = volunteer_positions.event_id
      WHERE volunteer_positions.id = volunteer_signups.position_id
      AND events.user_id = auth.uid()
    )
  );