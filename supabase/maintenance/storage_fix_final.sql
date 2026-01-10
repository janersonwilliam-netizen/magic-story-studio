-- ========================================
-- SOLUÇÃO DEFINITIVA: Storage Policies Simplificadas
-- Execute este no Supabase SQL Editor
-- ========================================

-- 1. REMOVER TODAS as políticas antigas
DROP POLICY IF EXISTS "Users can upload story images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own story images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view story images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own story images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;

DROP POLICY IF EXISTS "Users can upload story audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own story audio" ON storage.objects;
DROP POLICY IF EXISTS "Public can view story audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own story audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete audio" ON storage.objects;

-- 2. Garantir que os buckets existem e são públicos
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('story-images', 'story-images', true),
  ('story-audio', 'story-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. POLÍTICAS SUPER SIMPLES (sem restrições de pasta)

-- IMAGENS: Qualquer usuário autenticado pode fazer tudo
CREATE POLICY "Allow all for authenticated users - images"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'story-images')
WITH CHECK (bucket_id = 'story-images');

-- IMAGENS: Qualquer pessoa pode visualizar
CREATE POLICY "Allow public read - images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'story-images');

-- ÁUDIO: Qualquer usuário autenticado pode fazer tudo
CREATE POLICY "Allow all for authenticated users - audio"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'story-audio')
WITH CHECK (bucket_id = 'story-audio');

-- ÁUDIO: Qualquer pessoa pode visualizar
CREATE POLICY "Allow public read - audio"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'story-audio');

-- 4. VERIFICAR
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%images%' OR policyname LIKE '%audio%'
ORDER BY policyname;
