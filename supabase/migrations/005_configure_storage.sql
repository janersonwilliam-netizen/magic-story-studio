-- ========================================
-- CONFIGURAÇÃO DE STORAGE BUCKETS E POLÍTICAS
-- Execute este script no Supabase SQL Editor
-- ========================================

-- 1. Criar buckets (se não existirem)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('story-images', 'story-images', true),
  ('story-audio', 'story-audio', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas para story-images bucket

-- Permitir upload de imagens (INSERT)
CREATE POLICY "Users can upload story images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'story-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Permitir atualização de imagens (UPDATE)
CREATE POLICY "Users can update own story images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'story-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'story-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Permitir leitura pública de imagens (SELECT)
CREATE POLICY "Public can view story images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'story-images');

-- Permitir deletar próprias imagens (DELETE)
CREATE POLICY "Users can delete own story images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'story-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Políticas para story-audio bucket

-- Permitir upload de áudio (INSERT)
CREATE POLICY "Users can upload story audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'story-audio' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Permitir atualização de áudio (UPDATE)
CREATE POLICY "Users can update own story audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'story-audio' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'story-audio' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Permitir leitura pública de áudio (SELECT)
CREATE POLICY "Public can view story audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'story-audio');

-- Permitir deletar próprio áudio (DELETE)
CREATE POLICY "Users can delete own story audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'story-audio' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ========================================
-- VERIFICAÇÃO
-- ========================================

-- Ver buckets criados
SELECT * FROM storage.buckets WHERE id IN ('story-images', 'story-audio');

-- Ver políticas criadas
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
