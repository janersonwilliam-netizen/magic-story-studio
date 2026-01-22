-- Create Stories Table if it doesn't exist
create table if not exists public.stories (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    preview_image text, -- Base64 or URL
    data jsonb default '{}'::jsonb, -- Stores the entire StudioState
    is_complete boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.stories enable row level security;

-- Create Policies
create policy "Users can view their own stories"
    on public.stories for select
    using (auth.uid() = user_id);

create policy "Users can insert their own stories"
    on public.stories for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own stories"
    on public.stories for update
    using (auth.uid() = user_id);

create policy "Users can delete their own stories"
    on public.stories for delete
    using (auth.uid() = user_id);

-- Create Updated At Trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger handle_updated_at
    before update on public.stories
    for each row
    execute procedure public.handle_updated_at();
