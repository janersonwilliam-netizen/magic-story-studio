-- ========================================
-- SCRIPT CONSOLIDADO: Todas as Migrações
-- Execute este script COMPLETO no Supabase SQL Editor
-- ========================================

-- ========================================
-- 1. TABELA STORIES
-- ========================================
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    age_group TEXT NOT NULL,
    tone TEXT NOT NULL,
    duration INTEGER NOT NULL,
    visual_style TEXT DEFAULT '3D Pixar/DreamWorks',
    custom_instructions TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own stories" ON stories;
DROP POLICY IF EXISTS "Users can insert own stories" ON stories;
DROP POLICY IF EXISTS "Users can update own stories" ON stories;
DROP POLICY IF EXISTS "Users can delete own stories" ON stories;

CREATE POLICY "Users can view own stories"
ON stories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stories"
ON stories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories"
ON stories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories"
ON stories FOR DELETE
USING (auth.uid() = user_id);

-- ========================================
-- 2. TABELA SCENES
-- ========================================
CREATE TABLE IF NOT EXISTS scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL,
    narration_text TEXT NOT NULL,
    visual_description TEXT NOT NULL,
    emotion TEXT NOT NULL,
    characters TEXT[] DEFAULT '{}',
    duration_estimate INTEGER,
    image_prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(story_id, "order")
);

ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scenes" ON scenes;
DROP POLICY IF EXISTS "Users can manage own scenes" ON scenes;

CREATE POLICY "Users can view own scenes"
ON scenes FOR SELECT
USING (EXISTS (
    SELECT 1 FROM stories WHERE stories.id = scenes.story_id AND stories.user_id = auth.uid()
));

CREATE POLICY "Users can manage own scenes"
ON scenes FOR ALL
USING (EXISTS (
    SELECT 1 FROM stories WHERE stories.id = scenes.story_id AND stories.user_id = auth.uid()
));

-- ========================================
-- 3. TABELA ASSETS
-- ========================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('image', 'audio')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(scene_id, type)
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own assets" ON assets;
DROP POLICY IF EXISTS "Users can manage own assets" ON assets;

CREATE POLICY "Users can view own assets"
ON assets FOR SELECT
USING (EXISTS (
    SELECT 1 FROM scenes JOIN stories ON scenes.story_id = stories.id 
    WHERE assets.scene_id = scenes.id AND stories.user_id = auth.uid()
));

CREATE POLICY "Users can manage own assets"
ON assets FOR ALL
USING (EXISTS (
    SELECT 1 FROM scenes JOIN stories ON scenes.story_id = stories.id 
    WHERE assets.scene_id = scenes.id AND stories.user_id = auth.uid()
));

-- ========================================
-- 4. TABELA API_USAGE
-- ========================================
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    operation TEXT NOT NULL,
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    error_message TEXT,
    images_generated INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own api usage" ON api_usage;
DROP POLICY IF EXISTS "Users can insert own api usage" ON api_usage;

CREATE POLICY "Users can view own api usage"
ON api_usage FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api usage"
ON api_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Helper functions
CREATE OR REPLACE FUNCTION get_daily_image_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(images_generated), 0)::INTEGER
        FROM api_usage
        WHERE user_id = p_user_id
        AND service = 'google_image'
        AND status = 'success'
        AND created_at >= CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_generate_image(p_user_id UUID DEFAULT auth.uid(), p_daily_limit INTEGER DEFAULT 20)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_daily_image_count(p_user_id) < p_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 5. TABELA USER_PREFERENCES
-- ========================================
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP TRIGGER IF EXISTS update_user_preferences_updated_at_trigger ON user_preferences;
DROP FUNCTION IF EXISTS update_user_preferences_updated_at();

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    master_prompt_description TEXT DEFAULT 'Cria historinhas infantis com personagens cativantes, aventuras leves e mensagens educativas. Ideal para contação de histórias, leitura em voz alta e criação de histórias lúdicas para crianças pequenas.',
    master_prompt_instructions TEXT DEFAULT '📚 Instruções para o Comportamento do GPT:
Você é um criador de histórias infantis narrativas.

Seu objetivo é escrever historinhas originais, lúdicas e educativas com começo, meio e fim. As histórias são pensadas para crianças pequenas (de 3 a 8 anos), com linguagem simples, amigável e acolhedora.

Os roteiros têm personagens cativantes (muitas vezes animais fofos), pequenos desafios apropriados para a idade, e sempre encerram com uma mensagem positiva.

🎬 Estrutura da História:
Introdução: Abertura com gancho convidativo
Desenvolvimento: Conflito leve e educativo
Conclusão: Resolução positiva com lição educativa

Encerramento: "Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho!"',
    image_prompt_template TEXT DEFAULT 'Crie um [personagem] com aparência extremamente fofa e expressiva, no estilo de animação 3D Pixar / DreamWorks. O personagem deve ter olhos grandes e brilhantes, repletos de [emoção desejada, ex: surpresa encantada, alegria radiante ou curiosidade profunda], com blush suave nas bochechas, orelhas [formato, ex: arredondadas, caídas ou pontudas], e uma textura realista com acabamento suave que ressalta sua personalidade cativante. Os traços devem transmitir ternura e carisma à primeira vista.
IMPORTANTE: O personagem deve ocupar cerca de 10% da largura da imagem, posicionado de forma centralizada ou levemente deslocado, para que o cenário ao redor seja amplamente visível e contribua com a atmosfera mágica da composição.
O fundo deve retratar um cenário rico em cor e profundidade, como uma [ex: floresta ensolarada, jardim encantado, vila mágica ou clareira brilhante], com árvores detalhadas, flores vibrantes, folhas dançantes ao vento, pequenos animais ao fundo ou trilhas sinuosas. Adicione elementos que tragam dinamismo e fantasia — como luz filtrando entre as copas das árvores, pétalas flutuando no ar, cogumelos coloridos, borboletas ou passarinhos em movimento — para criar um visual cinematográfico, vibrante e encantador.
A iluminação deve ser suave e mágica, com um efeito de backlight dourado que contorna o personagem com luz quente, realçando sua silhueta e trazendo uma sensação de manhã ensolarada ou entardecer encantado.
Estilo ultra-realista cartoon, com riqueza de detalhes e atmosfera envolvente. Referências visuais: Zootopia, Encanto, Como Treinar o Seu Dragão. Composição horizontal. Resolução: 1920x1080 pixels.',
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

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

CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at_trigger
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_user_preferences_updated_at();

-- ========================================
-- 6. STORAGE BUCKETS
-- ========================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('story-images', 'story-images', true),
  ('story-audio', 'story-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow all for authenticated users - images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read - images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all for authenticated users - audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read - audio" ON storage.objects;

-- Criar políticas SIMPLES
CREATE POLICY "Allow all for authenticated users - images"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'story-images')
WITH CHECK (bucket_id = 'story-images');

CREATE POLICY "Allow public read - images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'story-images');

CREATE POLICY "Allow all for authenticated users - audio"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'story-audio')
WITH CHECK (bucket_id = 'story-audio');

CREATE POLICY "Allow public read - audio"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'story-audio');

-- ========================================
-- VERIFICAÇÃO FINAL
-- ========================================
SELECT 'Migração completa! Verificando tabelas...' as status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('stories', 'scenes', 'assets', 'api_usage', 'user_preferences')
ORDER BY table_name;

SELECT 'Verificando buckets de storage...' as status;

SELECT * FROM storage.buckets WHERE id IN ('story-images', 'story-audio');
