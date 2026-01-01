# Supabase Migrations - Magic Story Studio

Este diretório contém as migrations SQL para configurar o banco de dados do Magic Story Studio no Supabase.

## 📋 Ordem de Execução

Execute os scripts na seguinte ordem:

1. **`001_initial_schema.sql`** - Cria todas as tabelas, índices, triggers e políticas RLS
2. **`002_storage_buckets.sql`** - Configura os buckets de storage para imagens e áudios

## 🚀 Como Executar

### Opção 1: Via Supabase Dashboard (Recomendado para MVP)

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** (ícone de banco de dados na sidebar)
4. Clique em **New Query**
5. Cole o conteúdo de `001_initial_schema.sql`
6. Clique em **Run** (ou pressione Ctrl+Enter)
7. Repita os passos 4-6 para `002_storage_buckets.sql`

### Opção 2: Via Supabase CLI (Para Produção)

```bash
# Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# Login no Supabase
supabase login

# Inicializar projeto local
supabase init

# Linkar com projeto remoto
supabase link --project-ref YOUR_PROJECT_REF

# Aplicar migrations
supabase db push
```

## 📊 O que é criado

### Tabelas (5)
- `user_profiles` - Perfis de usuários com quotas
- `stories` - Histórias criadas
- `scenes` - Cenas das histórias
- `assets` - Arquivos (imagens e áudios)
- `api_usage` - Rastreamento de custos de API

### Índices (14)
- Índices em foreign keys para performance de JOINs
- Índices em campos de busca frequente
- Índice GIN em JSONB para queries eficientes

### Triggers (4)
- Auto-atualização de `updated_at`
- Auto-criação de perfil ao criar usuário
- Auto-incremento de contador de histórias
- Validação de completude de história

### Políticas RLS (13)
- Isolamento de dados por usuário
- Segurança em todas as operações CRUD

### Storage Buckets (2)
- `story-images` - Imagens das cenas (10MB max por arquivo)
- `story-audio` - Áudios de narração (5MB max por arquivo)

## ✅ Verificação

Após executar as migrations, verifique se tudo foi criado corretamente:

```sql
-- Verificar tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar índices
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Verificar triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Verificar políticas RLS
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar storage buckets
SELECT id, name, public, file_size_limit 
FROM storage.buckets;
```

## 🔧 Troubleshooting

### Erro: "relation already exists"
Se você já executou as migrations antes, você pode:
1. Dropar as tabelas existentes (CUIDADO: isso apaga todos os dados)
2. Ou modificar o script para usar `CREATE TABLE IF NOT EXISTS`

### Erro: "permission denied"
Certifique-se de que você está executando como um usuário com permissões adequadas (geralmente o usuário padrão do Supabase tem todas as permissões necessárias).

### Erro ao criar trigger em auth.users
O trigger `on_auth_user_created` requer permissões especiais. Se falhar:
1. Execute manualmente via Dashboard do Supabase
2. Ou crie perfis de usuário manualmente quando necessário

## 📝 Notas Importantes

- **UUIDs**: Todas as chaves primárias usam UUID para segurança e escalabilidade
- **Timestamps**: Todos os timestamps usam `TIMESTAMPTZ` (com timezone)
- **RLS**: Row Level Security está habilitado em todas as tabelas
- **CASCADE**: Deletar uma história deleta automaticamente suas cenas e assets
- **Constraints**: CHECK constraints garantem integridade de dados

## 🔄 Rollback

Se precisar reverter as migrations:

```sql
-- ATENÇÃO: Isso apaga TODOS os dados!

-- Dropar políticas RLS
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
-- ... (repetir para todas as políticas)

-- Dropar triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_story_created ON stories;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_stories_updated_at ON stories;
DROP TRIGGER IF EXISTS update_scenes_updated_at ON scenes;

-- Dropar functions
DROP FUNCTION IF EXISTS create_user_profile();
DROP FUNCTION IF EXISTS increment_stories_created();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS validate_story_completeness(UUID);

-- Dropar tabelas (ordem inversa devido a foreign keys)
DROP TABLE IF EXISTS api_usage;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS scenes;
DROP TABLE IF EXISTS stories;
DROP TABLE IF EXISTS user_profiles;

-- Dropar buckets de storage
DELETE FROM storage.buckets WHERE id IN ('story-images', 'story-audio');
```

## 📚 Documentação Adicional

Para mais informações sobre a modelagem do banco de dados, consulte:
- `database_schema.md` - Documentação completa do schema
- `technical_plan.md` - Plano técnico geral do projeto
