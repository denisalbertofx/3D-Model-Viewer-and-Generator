/*
  # User roles and subscription enhancements

  1. Changes
    - Add `role` column to profiles with enumeration constraint
    - Add subscription-related columns to profiles
    - Add new table `subscription_tiers` for plan management
    - Add new table `subscription_history` for tracking changes 
    - Update RLS policies

  2. Security
    - Add appropriate RLS policies for all new tables
    - Ensure proper access controls for role management
*/

-- Create role enumeration type
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'designer', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add role column to profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role user_role DEFAULT 'user'::user_role;
  END IF;
END $$;

-- Add subscription related columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_status text DEFAULT 'inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'subscription_end_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_end_date timestamptz;
  END IF;
END $$;

-- Create subscription_tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price decimal NOT NULL,
  interval text NOT NULL DEFAULT 'month',
  credits_per_cycle integer NOT NULL DEFAULT 10,
  stripe_price_id text,
  features jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_history table
CREATE TABLE IF NOT EXISTS subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_tier_id uuid REFERENCES subscription_tiers(id),
  stripe_subscription_id text,
  status text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscription_tiers
CREATE POLICY "Public can view active subscription tiers"
  ON subscription_tiers
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Only admins can modify subscription tiers"
  ON subscription_tiers
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- RLS policies for subscription_history
CREATE POLICY "Users can view their own subscription history"
  ON subscription_history
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Only admins can modify subscription history"
  ON subscription_history
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, description, price, interval, credits_per_cycle, features)
VALUES 
('Free', 'Basic access with limited features', 0, 'month', 5, '{"features": ["5 models per month", "Basic rendering", "Standard export formats"]}'),
('Pro', 'Professional tier with enhanced features', 9.99, 'month', 30, '{"features": ["30 models per month", "Priority rendering", "All export formats", "Model editing"]}'),
('Enterprise', 'Full access for teams and businesses', 29.99, 'month', 100, '{"features": ["100 models per month", "Team collaboration", "API access", "Custom branding", "Priority support"]}')
ON CONFLICT DO NOTHING;

-- Update existing user roles based on subscription tier
UPDATE profiles 
SET role = 
  CASE 
    WHEN subscription_tier = 'free' THEN 'user'::user_role 
    WHEN subscription_tier IN ('pro', 'enterprise') THEN 'designer'::user_role
    ELSE 'user'::user_role
  END;