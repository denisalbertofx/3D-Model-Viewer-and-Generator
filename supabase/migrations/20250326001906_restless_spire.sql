/*
  # Add file path to models table
  
  1. Changes
    - Add file_path column to models table to track files in Storage
  
  2. Purpose
    - Support storing models directly in Supabase Storage
    - Maintain backward compatibility with external URLs
*/

-- Add file_path column to models table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'models' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE models ADD COLUMN file_path text;
  END IF;
END $$;

-- Create a storage.objects policy to allow authenticated users to read and write their own model files
DO $$
BEGIN
  -- Enable RLS on the storage.objects table if it's not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- Create policy for users to read their own model files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can read their own model files'
  ) THEN
    CREATE POLICY "Users can read their own model files"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'model-files' AND
        (storage.foldername(name))[1] = 'models' AND
        EXISTS (
          SELECT 1 FROM models
          WHERE models.file_path = name AND models.user_id = auth.uid()
        )
      );
  END IF;
  
  -- Create policy for users to insert their own model files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can upload model files'
  ) THEN
    CREATE POLICY "Users can upload model files"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'model-files' AND
        (storage.foldername(name))[1] = 'models'
      );
  END IF;
  
  -- Create policy for users to update their own model files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can update their own model files'
  ) THEN
    CREATE POLICY "Users can update their own model files"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'model-files' AND
        (storage.foldername(name))[1] = 'models' AND
        EXISTS (
          SELECT 1 FROM models
          WHERE models.file_path = name AND models.user_id = auth.uid()
        )
      );
  END IF;
  
  -- Create policy for users to delete their own model files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can delete their own model files'
  ) THEN
    CREATE POLICY "Users can delete their own model files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'model-files' AND
        (storage.foldername(name))[1] = 'models' AND
        EXISTS (
          SELECT 1 FROM models
          WHERE models.file_path = name AND models.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Make model-files bucket public readable
-- Note: This will work if the bucket exists, otherwise this will be a no-op
-- The bucket will be created programmatically by the app
INSERT INTO storage.buckets (id, name, public)
VALUES ('model-files', 'model-files', true)
ON CONFLICT (id) DO UPDATE
SET public = true;