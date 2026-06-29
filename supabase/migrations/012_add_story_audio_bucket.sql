-- Migration to ensure story-audio bucket exists and has correct policies

insert into storage.buckets (id, name, public)
values ('story-audio', 'story-audio', true)
on conflict (id) do update set public = true;

-- Storage Policies (Story Audio)
drop policy if exists "Authenticated users can upload story audio" on storage.objects;
drop policy if exists "Public Access to story audio" on storage.objects;

create policy "Authenticated users can upload story audio"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'story-audio' );

create policy "Public Access to story audio"
on storage.objects for select
to public
using ( bucket_id = 'story-audio' );
