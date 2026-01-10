# 🗑️ Limpeza do Banco de Dados

## Como limpar o banco de dados Supabase

### Opção 1: Via SQL Editor (Recomendado)

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. Clique em **New Query**
5. Cole o conteúdo do arquivo `reset_database.sql`
6. Clique em **Run** (ou pressione `Ctrl+Enter`)

### Opção 2: Via Table Editor (Manual)

1. Acesse **Table Editor** no Supabase Dashboard
2. Para cada tabela (exceto `auth.users`):
   - Selecione a tabela
   - Clique nos 3 pontinhos (⋮)
   - Selecione **Truncate table**
   - Confirme a ação

### ⚠️ Tabelas que serão limpas:

- ✅ `scenes` - Todas as cenas
- ✅ `stories` - Todas as histórias
- ✅ `user_preferences` - Preferências de usuário
- ✅ `image_usage` - Uso de imagens (se existir)

### 🔒 Tabelas que serão MANTIDAS:

- ✅ `auth.users` - Usuários cadastrados
- ✅ `auth.sessions` - Sessões ativas
- ✅ Todas as tabelas de autenticação do Supabase

---

## Verificação Pós-Limpeza

Após executar o script, você verá uma tabela com o resultado:

```
tabela              | total
--------------------|-------
scenes              | 0
stories             | 0
user_preferences    | 0
auth.users          | 2  (exemplo)
```

Se todos os valores estiverem em **0** (exceto `auth.users`), a limpeza foi bem-sucedida! ✅

---

## 🚨 ATENÇÃO

**Esta ação é IRREVERSÍVEL!** 

Certifique-se de que:
- ✅ Você tem backup dos dados importantes
- ✅ Você realmente quer deletar TUDO
- ✅ Os usuários podem continuar fazendo login normalmente

---

## Próximos Passos

Após limpar o banco:

1. ✅ Faça login no sistema
2. ✅ Comece a criar do zero
3. ✅ O banco está pronto para novos dados!
