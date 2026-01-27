insert into storage.buckets (id, name, public)
values ('library', 'library', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do update set public = true;

-- Storage Policies (Library)
-- Clean up existing policies to avoid conflicts
drop policy if exists "Authenticated users can upload library files" on storage.objects;
drop policy if exists "Authenticated users can update library files" on storage.objects;
drop policy if exists "Authenticated users can delete library files" on storage.objects;
drop policy if exists "Public Access to library files" on storage.objects;

create policy "Authenticated users can upload library files"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'library' );

create policy "Authenticated users can update library files"
on storage.objects for update
to authenticated
with check ( bucket_id = 'library' );

create policy "Authenticated users can delete library files"
on storage.objects for delete
to authenticated
using ( bucket_id = 'library' );

create policy "Public Access to library files"
on storage.objects for select
to public
using ( bucket_id = 'library' );

-- Storage Policies (Thumbnails)
drop policy if exists "Authenticated users can upload thumbnails" on storage.objects;
drop policy if exists "Public Access to thumbnails" on storage.objects;

create policy "Authenticated users can upload thumbnails"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'thumbnails' );

create policy "Public Access to thumbnails"
on storage.objects for select
to public
using ( bucket_id = 'thumbnails' );


-- Create Library Files Table
create table if not exists public.library_files (
  id uuid primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  url text not null,
  type text not null,
  category text not null,
  is_default boolean default false,
  language text default 'pt',
  created_at timestamptz default now()
);

-- Enable RLS for Library Files
alter table public.library_files enable row level security;

-- Policies for Library Files Table
drop policy if exists "Users can view all library files" on public.library_files;
drop policy if exists "Users can insert their own library files" on public.library_files;
drop policy if exists "Users can update their own library files" on public.library_files;
drop policy if exists "Users can delete their own library files" on public.library_files;

create policy "Users can view all library files"
on public.library_files for select
to public
using (true);

create policy "Users can insert their own library files"
on public.library_files for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own library files"
on public.library_files for update
to authenticated
using (auth.uid() = user_id);

create policy "Users can delete their own library files"
on public.library_files for delete
to authenticated
using (auth.uid() = user_id);


-- Add Missing Columns to Stories Table
alter table public.stories 
add column if not exists narration_text text,
add column if not exists tone text,
add column if not exists age_group text,
add column if not exists duration integer,
add column if not exists story_text text,
add column if not exists custom_instructions text,
add column if not exists full_audio_url text,
add column if not exists character_descriptions jsonb,
add column if not exists generation_metadata jsonb;

-- Optional: Create index for better filtering if needed
create index if not exists idx_stories_user_id on public.stories(user_id);
