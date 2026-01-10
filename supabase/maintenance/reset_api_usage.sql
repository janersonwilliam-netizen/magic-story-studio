-- ========================================
-- SCRIPT DE MANUTENÇÃO: API Usage
-- ========================================

-- 1. VERIFICAR: Quantas imagens foram geradas hoje
SELECT 
    COUNT(*) as total_tentativas,
    SUM(CASE WHEN status = 'success' THEN images_generated ELSE 0 END) as imagens_geradas,
    SUM(CASE WHEN status = 'quota_exceeded' THEN 1 ELSE 0 END) as tentativas_bloqueadas,
    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as erros
FROM api_usage
WHERE service = 'gemini_nanobanana'
AND operation = 'generate_image'
AND created_at >= CURRENT_DATE
AND created_at < CURRENT_DATE + INTERVAL '1 day';

-- Ver detalhes de cada tentativa de hoje
SELECT 
    created_at,
    status,
    images_generated,
    error_message,
    scene_id
FROM api_usage
WHERE service = 'gemini_nanobanana'
AND operation = 'generate_image'
AND created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- ========================================
-- 2. LIMPAR: Remover registros de teste
-- ========================================

-- OPÇÃO A: Limpar TUDO (use com cuidado!)
-- DELETE FROM api_usage;

-- OPÇÃO B: Limpar apenas de hoje
DELETE FROM api_usage
WHERE created_at >= CURRENT_DATE;

-- OPÇÃO C: Limpar apenas imagens de hoje
DELETE FROM api_usage
WHERE service = 'gemini_nanobanana'
AND operation = 'generate_image'
AND created_at >= CURRENT_DATE;

-- ========================================
-- 3. AUMENTAR LIMITE: Temporariamente para testes
-- ========================================

-- Atualizar a função para usar limite de 20 durante testes
CREATE OR REPLACE FUNCTION can_generate_image(p_user_id UUID, p_daily_limit INTEGER DEFAULT 20)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_daily_image_count(p_user_id) < p_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- VERIFICAÇÃO PÓS-LIMPEZA
-- ========================================

-- Confirmar que está zerado
SELECT get_daily_image_count(auth.uid()) as contagem_atual;

-- Ver todos os registros (deve estar vazio ou sem registros de hoje)
SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 10;
