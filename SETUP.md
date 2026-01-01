# Magic Story Studio - Setup Guide

## 🚀 Passo 1: Autenticação - IMPLEMENTADO

### ✅ O que foi implementado:

1. **Supabase Client** (`src/lib/supabase.ts`)
   - Configuração do cliente Supabase
   - Leitura de variáveis de ambiente

2. **Auth Context** (`src/contexts/AuthContext.tsx`)
   - Gerenciamento de sessão
   - Métodos: signUp, signIn, signOut
   - Listener de mudanças de autenticação
   - Persistência de sessão

3. **Componentes de Autenticação**:
   - `LoginForm.tsx` - Formulário de login
   - `SignUpForm.tsx` - Formulário de cadastro
   - `AuthPage.tsx` - Página wrapper com toggle

4. **Dashboard** (`src/components/Dashboard.tsx`)
   - Exibe informações do usuário autenticado
   - Mostra auth.uid()
   - Consulta e exibe user_profiles
   - Valida RLS e trigger automático

5. **App.tsx**
   - Integração completa do fluxo de autenticação
   - Renderização condicional (Auth vs Dashboard)

---

## 📋 Próximos Passos para Executar

### 1. Instalar Dependências

```bash
npm install
```

Isso instalará o `@supabase/supabase-js` e outras dependências.

### 2. Configurar Supabase

#### 2.1. Criar Projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Crie uma nova conta ou faça login
3. Clique em "New Project"
4. Preencha:
   - Nome do projeto: "Magic Story Studio"
   - Database Password: (crie uma senha forte)
   - Region: escolha a mais próxima
5. Aguarde a criação do projeto (~2 minutos)

#### 2.2. Obter Credenciais

1. No dashboard do Supabase, vá em **Settings** > **API**
2. Copie:
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon public** key (chave pública)

#### 2.3. Executar Migrations SQL

1. No dashboard do Supabase, vá em **SQL Editor**
2. Clique em **New Query**
3. Cole o conteúdo de `supabase/migrations/001_initial_schema.sql`
4. Clique em **Run** (ou Ctrl+Enter)
5. Aguarde a execução (deve mostrar "Success")
6. Repita para `supabase/migrations/002_storage_buckets.sql`

#### 2.4. Verificar Criação das Tabelas

1. Vá em **Table Editor** no Supabase
2. Você deve ver as tabelas:
   - `user_profiles`
   - `stories`
   - `scenes`
   - `assets`
   - `api_usage`

### 3. Configurar Variáveis de Ambiente

1. Crie um arquivo `.env` na raiz do projeto:

```bash
cp .env.example .env
```

2. Edite o arquivo `.env` e adicione suas credenciais:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### 4. Executar o Projeto

```bash
npm run dev
```

O projeto estará disponível em `http://localhost:5173`

---

## 🧪 Testar a Autenticação

### Teste 1: Criar Conta

1. Acesse `http://localhost:5173`
2. Clique em "Criar conta"
3. Preencha:
   - Email: `teste@example.com`
   - Senha: `123456` (mínimo 6 caracteres)
   - Confirmar senha: `123456`
4. Clique em "Criar conta"
5. Você verá a mensagem de sucesso

### Teste 2: Fazer Login

1. Clique em "Entrar"
2. Use as credenciais criadas
3. Você será redirecionado para o Dashboard

### Teste 3: Validar Dashboard

No Dashboard, você deve ver:

✅ **Email do usuário** autenticado  
✅ **Auth UID** (UUID do Supabase)  
✅ **Perfil do usuário** carregado da tabela `user_profiles`  
✅ Dados do perfil:
   - ID (mesmo do auth.uid)
   - Nome (email por padrão)
   - Plano: "free"
   - Histórias criadas: 0 / 10
   - Data de criação

✅ **Mensagem de validação**: "Perfil criado automaticamente via trigger"

### Teste 4: Validar RLS

1. Abra o **DevTools** (F12)
2. Vá em **Network**
3. Recarregue a página
4. Procure pela requisição para `user_profiles`
5. Verifique que apenas o perfil do usuário logado é retornado

### Teste 5: Persistência de Sessão

1. Recarregue a página (F5)
2. Você deve permanecer logado
3. O Dashboard deve carregar automaticamente

### Teste 6: Logout

1. Clique em "Sair"
2. Você será redirecionado para a tela de login
3. A sessão foi encerrada

---

## 🔍 Verificar no Supabase

### Verificar Usuário Criado

1. No Supabase, vá em **Authentication** > **Users**
2. Você deve ver o usuário criado com o email de teste

### Verificar Perfil Criado

1. Vá em **Table Editor** > **user_profiles**
2. Você deve ver 1 registro com:
   - `id` = mesmo UUID do usuário em Authentication
   - `display_name` = email do usuário
   - `plan_type` = "free"
   - `stories_created` = 0
   - `stories_limit` = 10

### Verificar Trigger

O trigger `on_auth_user_created` criou automaticamente o perfil quando o usuário foi cadastrado. Isso confirma que:

✅ Trigger está funcionando  
✅ Function `create_user_profile()` está correta  
✅ RLS permite inserção automática

---

## ✅ Checklist de Validação

- [ ] Projeto Supabase criado
- [ ] Migrations SQL executadas com sucesso
- [ ] Tabelas criadas no banco
- [ ] Arquivo `.env` configurado com credenciais corretas
- [ ] Dependências instaladas (`npm install`)
- [ ] Projeto rodando (`npm run dev`)
- [ ] Consegue criar conta
- [ ] Consegue fazer login
- [ ] Dashboard exibe informações do usuário
- [ ] auth.uid() é exibido corretamente
- [ ] user_profiles é consultado com sucesso
- [ ] Perfil foi criado automaticamente
- [ ] Sessão persiste após reload
- [ ] Logout funciona corretamente

---

## 🐛 Troubleshooting

### Erro: "Missing Supabase environment variables"

**Solução**: Verifique se o arquivo `.env` existe e contém as variáveis corretas.

### Erro: "Invalid API key"

**Solução**: Verifique se copiou a chave `anon public` correta do Supabase.

### Erro ao executar migrations

**Solução**: 
1. Verifique se está usando o SQL Editor correto
2. Execute as migrations na ordem correta (001, depois 002)
3. Verifique se não há erros de sintaxe

### Perfil não é criado automaticamente

**Solução**:
1. Verifique se o trigger `on_auth_user_created` foi criado
2. Execute novamente a migration `001_initial_schema.sql`
3. Tente criar um novo usuário

### RLS bloqueia acesso

**Solução**:
1. Verifique se as políticas RLS foram criadas
2. Verifique se o usuário está autenticado
3. Verifique se `auth.uid()` retorna o ID correto

---

## 🎯 Resultado Esperado

Ao final deste passo, você deve ter:

✅ Sistema de autenticação completo e funcional  
✅ Usuários podem criar conta e fazer login  
✅ Sessão persiste após reload  
✅ Dashboard exibe informações do usuário  
✅ auth.uid() acessível no frontend  
✅ user_profiles criado automaticamente via trigger  
✅ RLS funcionando corretamente  

**Passo 1 concluído com sucesso!** 🎉

Próximo passo: Implementar Dashboard e CRUD de histórias.
