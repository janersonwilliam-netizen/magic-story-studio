-- Add image_prompt column to scenes table
ALTER TABLE scenes 
ADD COLUMN IF NOT EXISTS image_prompt TEXT;

-- Comment on column
COMMENT ON COLUMN scenes.image_prompt IS 'The generated image prompt for DALL-E/Nano Banana, allowing user review before generation';
