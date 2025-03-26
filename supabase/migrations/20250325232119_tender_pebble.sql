/*
  # Add model management policies

  1. Changes
    - Add policy for users to delete their own models
    - Add policy for users to update their own models
  
  2. Security
    - Ensure users can only delete/update models they own
    - Maintain existing read/create policies
*/

-- Add policy for users to delete their own models
CREATE POLICY "Users can delete own models"
  ON models
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add policy for users to update their own models
CREATE POLICY "Users can update own models"
  ON models
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);