-- Add character_descriptions field to stories table
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS character_descriptions JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN stories.character_descriptions IS 'Detailed descriptions of each character for consistency across image generation. Format: {"CharacterName": "detailed description"}';
