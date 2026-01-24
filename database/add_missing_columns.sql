-- ============================================
-- Migração: Adicionar Colunas Faltantes
-- Magic Story Studio - Fix para storyStorage.ts
-- ============================================
-- 
-- PROBLEMA: O código storyStorage.ts tenta salvar campos
-- que não existem na tabela stories atual.
-- 
-- Execute este script no SQL Editor do Supabase:
-- Dashboard > SQL Editor > New Query
-- ============================================

-- 1. Adicionar coluna 'data' (JSONB) para armazenar todo o StudioState
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- 2. Adicionar coluna 'preview_image' para armazenar thumbnail (Base64/URL)
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS preview_image TEXT;

-- 3. Adicionar coluna 'is_complete' para indicar se a história está finalizada
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false;

-- 4. Tornar campos antigos opcionais (caso existam como NOT NULL)
-- Isso permite que o novo código funcione sem precisar enviar esses valores

-- age_group: tornar opcional
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stories' 
        AND column_name = 'age_group' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE stories ALTER COLUMN age_group DROP NOT NULL;
        ALTER TABLE stories ALTER COLUMN age_group DROP DEFAULT;
    END IF;
END $$;

-- tone: tornar opcional
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stories' 
        AND column_name = 'tone' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE stories ALTER COLUMN tone DROP NOT NULL;
        ALTER TABLE stories ALTER COLUMN tone DROP DEFAULT;
    END IF;
END $$;

-- duration: tornar opcional
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stories' 
        AND column_name = 'duration' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE stories ALTER COLUMN duration DROP NOT NULL;
    END IF;
END $$;

-- visual_style: tornar opcional
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stories' 
        AND column_name = 'visual_style' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE stories ALTER COLUMN visual_style DROP NOT NULL;
    END IF;
END $$;

-- status: tornar opcional
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stories' 
        AND column_name = 'status' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE stories ALTER COLUMN status DROP NOT NULL;
    END IF;
END $$;

-- ============================================
-- Verificação: Listar estrutura atual da tabela
-- ============================================
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'stories'
ORDER BY ordinal_position;

-- ============================================
-- Resultado Esperado após executar:
-- - data: jsonb (adicionado)
-- - preview_image: text (adicionado)
-- - is_complete: boolean (adicionado)
-- - age_group, tone, duration, visual_style, status: opcionais
-- ============================================
