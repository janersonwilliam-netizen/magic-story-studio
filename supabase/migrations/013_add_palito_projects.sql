-- Histórias Palito: tabela de projetos
CREATE TABLE IF NOT EXISTS palito_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tema TEXT,
    ideas JSONB,                     -- string[]
    selected_title TEXT,
    narration_script TEXT,
    audio_url TEXT,
    voice_name TEXT,
    emotion TEXT,
    transcription JSONB,             -- Array<{ timestamp, text }>
    character_image_url TEXT,
    thumbnail_url TEXT,
    scenes JSONB,                    -- Array<{ timestamp, text, imagePrompt, imageUrl }>
    metadata JSONB,                  -- { viralTitle, description, tags }
    current_step TEXT DEFAULT 'IDEAS',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE palito_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own palito projects"
    ON palito_projects FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_palito_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER palito_projects_updated_at
    BEFORE UPDATE ON palito_projects
    FOR EACH ROW EXECUTE FUNCTION update_palito_updated_at();
