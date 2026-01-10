-- Migration: Create user_preferences table (CLEAN VERSION)
-- Removes existing objects first, then creates fresh

-- 1. DROP existing policies
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;

-- 2. DROP existing triggers
DROP TRIGGER IF EXISTS update_user_preferences_updated_at_trigger ON user_preferences;

-- 3. DROP existing functions
DROP FUNCTION IF EXISTS update_user_preferences_updated_at();

-- 4. DROP existing table (careful!)
-- DROP TABLE IF EXISTS user_preferences CASCADE;

-- 5. CREATE table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Master Prompt Settings
    master_prompt_description TEXT DEFAULT 'Cria historinhas infantis com personagens cativantes, aventuras leves e mensagens educativas. Ideal para contação de histórias, leitura em voz alta e criação de histórias lúdicas para crianças pequenas.',
    master_prompt_instructions TEXT DEFAULT '📚 Instruções para o Comportamento do GPT:
Você é um criador de histórias infantis narrativas.

Seu objetivo é escrever historinhas originais, lúdicas e educativas com começo, meio e fim. As histórias são pensadas para crianças pequenas (de 3 a 8 anos), com linguagem simples, amigável e acolhedora.

Os roteiros têm personagens cativantes (muitas vezes animais fofos), pequenos desafios apropriados para a idade, e sempre encerram com uma mensagem positiva.

🎬 Estrutura da História:
Introdução: Abertura com gancho convidativo
Desenvolvimento: Conflito leve e educativo  
Conclusão: Resolução positiva com CTA',
    
    -- User Profile
    display_name TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one preference per user
    UNIQUE(user_id)
);

-- 6. Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- 7. CREATE policies
CREATE POLICY "Users can view own preferences"
ON user_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
ON user_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
ON user_preferences FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 8. CREATE function for auto-update timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. CREATE trigger
CREATE TRIGGER update_user_preferences_updated_at_trigger
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_user_preferences_updated_at();

-- 10. VERIFY
SELECT 'user_preferences table created successfully!' as status;
