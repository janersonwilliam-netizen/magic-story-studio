-- ========================================
-- SCRIPT SIMPLIFICADO: Limpar e Resetar
-- Execute este no Supabase SQL Editor
-- ========================================

-- 1. Limpar registros de hoje (se a tabela existir)
DELETE FROM api_usage
WHERE created_at >= CURRENT_DATE;

-- 2. Ver quantos registros restam
SELECT COUNT(*) as total_registros FROM api_usage;

-- Resultado esperado: 0 registros ou apenas registros antigos
