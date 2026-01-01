-- ============================================================================
-- Magic Story Studio - Database Schema
-- Supabase (PostgreSQL)
-- ============================================================================
-- 
-- Este script cria todas as tabelas necessárias para o MVP do Magic Story Studio.
-- Execute este script no SQL Editor do Supabase.
--
-- Ordem de execução:
-- 1. Extensões
-- 2. Tabelas principais
-- 3. Índices
-- 4. Triggers
-- 5. Row Level Security (RLS)
-- 6. Storage Buckets
--
-- ============================================================================

-- ============================================================================
-- 1. EXTENSÕES
-- ============================================================================

-- Habilitar extensão UUID (geralmente já está habilitada no Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. TABELAS PRINCIPAIS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabela: user_profiles
-- Descrição: Perfis estendidos de usuários com quotas e preferências
-- ----------------------------------------------------------------------------
CREATE TABLE user_profiles (
  -- Identificação
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Informações do Perfil
  display_name TEXT,
  avatar_url TEXT,
  
  -- Quotas e Limites
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'enterprise')),
  stories_limit INTEGER NOT NULL DEFAULT 10,
  stories_created INTEGER NOT NULL DEFAULT 0,
  
  -- Preferências
  default_visual_style TEXT DEFAULT '3D Pixar/DreamWorks',
  default_age_group TEXT CHECK (default_age_group IN ('3-5', '6-8', '9-12') OR default_age_group IS NULL),
  default_tone TEXT CHECK (default_tone IN ('calma', 'aventura', 'educativa') OR default_tone IS NULL),
  
  -- Estatísticas
  total_api_cost_usd DECIMAL(10, 2) DEFAULT 0.00,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Tabela: stories
-- Descrição: Histórias criadas pelos usuários
-- ----------------------------------------------------------------------------
CREATE TABLE stories (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Metadados da História
  title TEXT NOT NULL,
  age_group TEXT NOT NULL CHECK (age_group IN ('3-5', '6-8', '9-12')),
  tone TEXT NOT NULL CHECK (tone IN ('calma', 'aventura', 'educativa')),
  duration INTEGER NOT NULL CHECK (duration >= 3 AND duration <= 10),
  visual_style TEXT NOT NULL DEFAULT '3D Pixar/DreamWorks',
  
  -- Conteúdo
  story_text TEXT,
  narration_text TEXT,
  
  -- Status e Controle
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'complete', 'error')),
  
  -- Metadados de Geração
  character_descriptions JSONB,
  generation_metadata JSONB,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Tabela: scenes
-- Descrição: Cenas individuais de cada história
-- ----------------------------------------------------------------------------
CREATE TABLE scenes (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  
  -- Ordem e Estrutura
  order_number INTEGER NOT NULL CHECK (order_number > 0),
  
  -- Conteúdo da Cena
  narration_text TEXT NOT NULL,
  visual_description TEXT,
  
  -- Metadados da Cena
  emotion TEXT CHECK (emotion IN ('alegre', 'calma', 'aventura', 'surpresa', 'medo', 'tristeza', 'curiosidade') OR emotion IS NULL),
  duration_estimate INTEGER CHECK (duration_estimate >= 5 AND duration_estimate <= 60),
  characters TEXT[],
  
  -- Prompts de Geração
  image_prompt TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint de unicidade
  CONSTRAINT unique_scene_order UNIQUE (story_id, order_number)
);

-- ----------------------------------------------------------------------------
-- Tabela: assets
-- Descrição: Arquivos (imagens e áudios) vinculados às cenas
-- ----------------------------------------------------------------------------
CREATE TABLE assets (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  
  -- Tipo e Localização
  type TEXT NOT NULL CHECK (type IN ('image', 'audio')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  
  -- Metadados do Arquivo
  file_size_bytes BIGINT,
  mime_type TEXT,
  
  -- Metadados de Geração
  generation_metadata JSONB,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint: cada cena pode ter apenas 1 imagem e 1 áudio
  CONSTRAINT unique_asset_type_per_scene UNIQUE (scene_id, type)
);

-- ----------------------------------------------------------------------------
-- Tabela: api_usage
-- Descrição: Rastreamento de uso de APIs externas para controle de custos
-- ----------------------------------------------------------------------------
CREATE TABLE api_usage (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  
  -- Tipo de Serviço
  service TEXT NOT NULL CHECK (service IN ('openai_gpt', 'openai_dalle', 'google_tts')),
  operation TEXT NOT NULL,
  
  -- Métricas de Uso
  tokens_used INTEGER,
  characters_used INTEGER,
  images_generated INTEGER,
  
  -- Custo Estimado
  cost_estimate_usd DECIMAL(10, 6),
  
  -- Metadados
  request_metadata JSONB,
  response_metadata JSONB,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'partial')),
  error_message TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================

-- Índices em Foreign Keys
CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_scenes_story_id ON scenes(story_id);
CREATE INDEX idx_assets_scene_id ON assets(scene_id);
CREATE INDEX idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX idx_api_usage_story_id ON api_usage(story_id);

-- Índices para queries frequentes
CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX idx_stories_user_status ON stories(user_id, status);

-- Índice para ordenação de cenas
CREATE INDEX idx_scenes_story_order ON scenes(story_id, order_number);

-- Índice para busca de assets por tipo
CREATE INDEX idx_assets_scene_type ON assets(scene_id, type);

-- Índices para análise de custos
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at DESC);
CREATE INDEX idx_api_usage_service ON api_usage(service);
CREATE INDEX idx_api_usage_user_service ON api_usage(user_id, service);

-- Índice GIN para busca em JSONB
CREATE INDEX idx_stories_character_descriptions ON stories USING GIN (character_descriptions);

-- ============================================================================
-- 4. TRIGGERS E FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: Atualizar updated_at automaticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Function: Criar perfil automaticamente ao criar usuário
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- ----------------------------------------------------------------------------
-- Function: Incrementar contador de histórias criadas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_stories_created()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET stories_created = stories_created + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para incrementar contador
CREATE TRIGGER on_story_created
  AFTER INSERT ON stories
  FOR EACH ROW
  EXECUTE FUNCTION increment_stories_created();

-- ----------------------------------------------------------------------------
-- Function: Validar completude de história antes de exportar
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_story_completeness(story_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_scenes INTEGER;
  scenes_with_image INTEGER;
  scenes_with_audio INTEGER;
BEGIN
  -- Contar total de cenas
  SELECT COUNT(*) INTO total_scenes
  FROM scenes
  WHERE story_id = story_uuid;
  
  -- Retornar false se não há cenas
  IF total_scenes = 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Contar cenas com imagem
  SELECT COUNT(DISTINCT scene_id) INTO scenes_with_image
  FROM assets
  WHERE scene_id IN (SELECT id FROM scenes WHERE story_id = story_uuid)
  AND type = 'image';
  
  -- Contar cenas com áudio
  SELECT COUNT(DISTINCT scene_id) INTO scenes_with_audio
  FROM assets
  WHERE scene_id IN (SELECT id FROM scenes WHERE story_id = story_uuid)
  AND type = 'audio';
  
  -- Retornar true se todas as cenas têm imagem e áudio
  RETURN (total_scenes = scenes_with_image AND total_scenes = scenes_with_audio);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Políticas: user_profiles
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Políticas: stories
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Políticas: scenes
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view scenes of own stories"
  ON scenes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = scenes.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage scenes of own stories"
  ON scenes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = scenes.story_id
      AND stories.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Políticas: assets
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view assets of own scenes"
  ON assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scenes
      JOIN stories ON stories.id = scenes.story_id
      WHERE scenes.id = assets.scene_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage assets of own scenes"
  ON assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM scenes
      JOIN stories ON stories.id = scenes.story_id
      WHERE scenes.id = assets.scene_id
      AND stories.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Políticas: api_usage
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own api usage"
  ON api_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api usage"
  ON api_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 6. COMENTÁRIOS (Documentação)
-- ============================================================================

COMMENT ON TABLE user_profiles IS 'Perfis estendidos de usuários com quotas e preferências';
COMMENT ON TABLE stories IS 'Histórias criadas pelos usuários';
COMMENT ON TABLE scenes IS 'Cenas individuais de cada história';
COMMENT ON TABLE assets IS 'Arquivos (imagens e áudios) vinculados às cenas';
COMMENT ON TABLE api_usage IS 'Rastreamento de uso de APIs externas para controle de custos';

COMMENT ON COLUMN stories.character_descriptions IS 'Cache de descrições de personagens para consistência de imagens (JSONB)';
COMMENT ON COLUMN stories.generation_metadata IS 'Metadados da geração (modelo usado, tokens, etc)';
COMMENT ON COLUMN scenes.order_number IS 'Ordem da cena na história (1, 2, 3...)';
COMMENT ON COLUMN scenes.duration_estimate IS 'Duração estimada da cena em segundos';
COMMENT ON COLUMN assets.file_path IS 'Caminho completo no storage bucket';

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================

-- Verificar se todas as tabelas foram criadas
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('user_profiles', 'stories', 'scenes', 'assets', 'api_usage')
ORDER BY table_name;
