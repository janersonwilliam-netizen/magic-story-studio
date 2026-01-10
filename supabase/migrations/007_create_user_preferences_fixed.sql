-- Migration: Create user_preferences table (FIXED VERSION)
-- Stores user-specific settings like custom AI prompts and preferences

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Master Prompt Settings
    master_prompt_description TEXT DEFAULT 'Cria historinhas infantis com personagens cativantes, aventuras leves e mensagens educativas. Ideal para contação de histórias, leitura em voz alta e criação de histórias lúdicas para crianças pequenas.',
    master_prompt_instructions TEXT DEFAULT '📚 Instruções para o Comportamento do GPT:
Você é um criador de histórias infantis narrativas.

Seu objetivo é escrever historinhas originais, lúdicas e educativas com começo, meio e fim. As histórias são pensadas para crianças pequenas (de 3 a 8 anos), com linguagem simples, amigável e acolhedora.

Os roteiros têm personagens cativantes (muitas vezes animais fofos), pequenos desafios apropriados para a idade, e sempre encerram com uma mensagem positiva.

As histórias devem ter duração equivalente a 3 a 10 minutos de leitura), adaptadas para leitura em voz alta.

🎬 Estrutura da História:
Introdução: Abertura com um gancho leve e convidativo, como: "Hoje eu vou contar uma historinha [Titulo da Historia]…"
Desenvolvimento: Um evento muda a rotina do personagem (conflito leve, seguro e educativo).
Conclusão: Resolução positiva e alegre. Encerramento carinhoso: "Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho para não perder nenhuma historinha nova! Um beijo grande… e até a próxima história! Tchau, tchau!"',
    
    -- User Profile
    display_name TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one preference per user
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own preferences
CREATE POLICY "Users can view own preferences"
ON user_preferences FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
ON user_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own preferences
CREATE POLICY "Users can update own preferences"
ON user_preferences FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_preferences_updated_at_trigger ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at_trigger
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_user_preferences_updated_at();

-- Create default preferences for current user (run manually if needed)
-- INSERT INTO user_preferences (user_id) 
-- SELECT auth.uid() 
-- ON CONFLICT (user_id) DO NOTHING;
