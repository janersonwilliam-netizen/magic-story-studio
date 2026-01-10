-- ============================================
-- Script de Limpeza do Banco de Dados
-- Magic Story Studio - Reset Completo
-- ============================================
-- 
-- ATENÇÃO: Este script irá DELETAR TODOS OS DADOS
-- exceto os usuários cadastrados (auth.users)
-- 
-- Execute este script no SQL Editor do Supabase:
-- Dashboard > SQL Editor > New Query
-- ============================================

-- 1. Deletar todas as cenas
DELETE FROM scenes;

-- 2. Deletar todas as histórias
DELETE FROM stories;

-- 3. Deletar todas as preferências de usuário
DELETE FROM user_preferences;

-- 4. Deletar uso de imagens (se a tabela existir)
-- DELETE FROM image_usage;

-- 5. Deletar quaisquer outras tabelas customizadas que você tenha criado
-- Adicione aqui conforme necessário:
-- DELETE FROM sua_tabela_customizada;

-- ============================================
-- Verificação: Contar registros restantes
-- ============================================

SELECT 
    'scenes' as tabela, 
    COUNT(*) as total 
FROM scenes

UNION ALL

SELECT 
    'stories' as tabela, 
    COUNT(*) as total 
FROM stories

UNION ALL

SELECT 
    'user_preferences' as tabela, 
    COUNT(*) as total 
FROM user_preferences

UNION ALL

SELECT 
    'auth.users' as tabela, 
    COUNT(*) as total 
FROM auth.users;

-- ============================================
-- Resultado esperado:
-- - scenes: 0
-- - stories: 0
-- - user_preferences: 0
-- - auth.users: [número de usuários cadastrados]
-- ============================================
