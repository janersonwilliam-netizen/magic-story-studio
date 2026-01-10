-- Add scene_duration column to stories table
ALTER TABLE stories 
ADD COLUMN scene_duration INTEGER DEFAULT 15;

COMMENT ON COLUMN stories.scene_duration IS 'Duração de cada cena em segundos (para vídeo)';
COMMENT ON COLUMN stories.duration IS 'Duração total estimada da história em minutos (para texto)';
