-- Remove emotion check constraint to allow any emotion value
-- This fixes the "violates check constraint scenes_emotion_check" error

ALTER TABLE scenes DROP CONSTRAINT IF EXISTS scenes_emotion_check;

-- Optionally, add a more flexible constraint or no constraint at all
-- For now, we'll allow any text value for emotion
