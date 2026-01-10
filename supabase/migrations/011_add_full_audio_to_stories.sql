-- Add full_audio_url column to stories table to store the complete narration
ALTER TABLE stories ADD COLUMN IF NOT EXISTS full_audio_url TEXT;

-- Update RLS policies to allow updating this column (if necessary, though usually update policies cover all columns)
-- Check if we need specific storage policies for the new file path "stories/{id}/full_narration.mp3"
-- Existing policies likely cover "stories/*" but let's be sure.
-- (Assuming standard authenticated uploads are allowed as per existing setup)
