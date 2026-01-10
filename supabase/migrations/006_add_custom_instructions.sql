-- Add custom_instructions field to stories table
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS custom_instructions TEXT;
