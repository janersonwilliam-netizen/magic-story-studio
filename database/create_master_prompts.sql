-- Cria a tabela de Prompts Mestres
create table if not exists public.master_prompts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null, -- Ex: "Prompt Base Infantil", "Prompt Imagem Pixar"
    type text not null, -- Ex: 'story', 'image', 'music', 'system'
    content text not null, -- O texto do prompt em si
    is_active boolean default true, -- Para ativar/desativar prompts facilmente
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilita segurança em nível de linha (RLS)
alter table public.master_prompts enable row level security;

-- Políticas de segurança: Usuários só mexem nos seus próprios prompts
create policy "Users can view their own master prompts"
    on public.master_prompts for select
    using (auth.uid() = user_id);

create policy "Users can insert their own master prompts"
    on public.master_prompts for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own master prompts"
    on public.master_prompts for update
    using (auth.uid() = user_id);

create policy "Users can delete their own master prompts"
    on public.master_prompts for delete
    using (auth.uid() = user_id);

-- O gatilho (trigger) de "updated_at" já existe no seu banco, então só precisamos vinculá-lo a esta nova tabela:
create trigger handle_updated_at_master_prompts
    before update on public.master_prompts
    for each row
    execute procedure public.handle_updated_at();
