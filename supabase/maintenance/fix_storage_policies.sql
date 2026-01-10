-- ========================================
-- SCRIPT SIMPLIFICADO: Recriar Políticas de Storage
-- Execute este no Supabase SQL Editor
-- ========================================

-- 1. REMOVER políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can upload story images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own story images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view story images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own story images" ON storage.objects;

DROP POLICY IF EXISTS "Users can upload story audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own story audio" ON storage.objects;
DROP POLICY IF EXISTS "Public can view story audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own story audio" ON storage.objects;

-- 2. CRIAR buckets (se não existirem)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('story-images', 'story-images', true),
  ('story-audio', 'story-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. CRIAR políticas SIMPLES (sem verificação de user_id)

-- Imagens: Permitir tudo para usuários autenticados
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'story-images');

CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'story-images');

CREATE POLICY "Anyone can view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'story-images');

CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'story-images');

-- Áudio: Permitir tudo para usuários autenticados
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'story-audio');

CREATE POLICY "Authenticated users can update audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'story-audio');

CREATE POLICY "Anyone can view audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'story-audio');

CREATE POLICY "Authenticated users can delete audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'story-audio');

-- 4. VERIFICAR
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;
