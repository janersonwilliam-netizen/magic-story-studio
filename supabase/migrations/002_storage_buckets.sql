-- ============================================================================
-- Magic Story Studio - Storage Buckets Configuration
-- Supabase Storage
-- ============================================================================
-- 
-- Este script configura os buckets de storage e suas políticas de acesso.
-- Execute este script APÓS o script 001_initial_schema.sql
--
-- Buckets criados:
-- 1. story-images: Armazena imagens geradas para as cenas
-- 2. story-audio: Armazena arquivos de áudio de narração
--
-- ============================================================================

-- ============================================================================
-- 1. CRIAR BUCKETS
-- ============================================================================

-- Bucket para imagens
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-images',
  'story-images',
  true,
  10485760, -- 10MB por arquivo
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
);

-- Bucket para áudios
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-audio',
  'story-audio',
  true,
  5242880, -- 5MB por arquivo
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']
);

-- ============================================================================
-- 2. POLÍTICAS DE STORAGE - IMAGENS
-- ============================================================================

-- Política: Usuários podem fazer upload de imagens em suas próprias pastas
CREATE POLICY "Users can upload own story images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'story-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política: Todos podem visualizar imagens públicas
CREATE POLICY "Public can view story images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-images');

-- Política: Usuários podem atualizar suas próprias imagens
CREATE POLICY "Users can update own story images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'story-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política: Usuários podem deletar suas próprias imagens
CREATE POLICY "Users can delete own story images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'story-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 3. POLÍTICAS DE STORAGE - ÁUDIO
-- ============================================================================

-- Política: Usuários podem fazer upload de áudios em suas próprias pastas
CREATE POLICY "Users can upload own story audio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'story-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política: Todos podem visualizar áudios públicos
CREATE POLICY "Public can view story audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-audio');

-- Política: Usuários podem atualizar seus próprios áudios
CREATE POLICY "Users can update own story audio"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'story-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política: Usuários podem deletar seus próprios áudios
CREATE POLICY "Users can delete own story audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'story-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 4. VERIFICAÇÃO
-- ============================================================================

-- Verificar se os buckets foram criados
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('story-images', 'story-audio');

-- ============================================================================
-- ESTRUTURA DE PASTAS RECOMENDADA
-- ============================================================================
--
-- story-images/
--   {user_id}/
--     {story_id}/
--       cena_01.png
--       cena_02.png
--       cena_03.png
--       ...
--
-- story-audio/
--   {user_id}/
--     {story_id}/
--       cena_01.mp3
--       cena_02.mp3
--       cena_03.mp3
--       ...
--
-- ============================================================================
