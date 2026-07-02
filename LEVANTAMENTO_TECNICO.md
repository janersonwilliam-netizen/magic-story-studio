# Levantamento Tecnico - Magic Story Studio

Este documento resume o levantamento tecnico do projeto `magic-story-studio`, com foco em estrutura, Supabase, Storage, fluxos de IA/TTS, queries e ambiente.

## Bloco A - Estrutura do projeto

### Pergunta 1 - Estrutura de pastas do projeto

Output equivalente a `find src -type f | sort`:

```txt
src\App.tsx
src\components\auth\AuthPage.tsx
src\components\auth\LoginForm.tsx
src\components\auth\LoginPage.tsx
src\components\auth\ProtectedRoute.tsx
src\components\auth\SignUpForm.tsx
src\components\CharacterModal.tsx
src\components\CreateStoryForm.tsx
src\components\Dashboard.tsx
src\components\ExportVideoModal.tsx
src\components\FilesPage.tsx
src\components\IdeaResearchPage.tsx
src\components\ImageTestPage.tsx
src\components\MainLayout.tsx
src\components\MusicClipPage.tsx
src\components\playgroundHtml.ts
src\components\PlaygroundPage.tsx
src\components\PollinationsTestPage.tsx
src\components\PromptMasterPage.tsx
src\components\SceneList.tsx
src\components\SettingsPage.tsx
src\components\Sidebar.tsx
src\components\StepWizard.tsx
src\components\StoryDashboard.tsx
src\components\StoryViewer.tsx
src\components\Studio\ConfigPage.tsx
src\components\Studio\ImagesPage.tsx
src\components\Studio\index.tsx
src\components\Studio\NarrationPage.tsx
src\components\Studio\ScenesPage.tsx
src\components\Studio\ThumbnailPage.tsx
src\components\Studio\Timeline.tsx
src\components\Studio\TimelinePage.tsx
src\components\Studio\VideoPreview.tsx
src\components\TopBar.tsx
src\components\VideoGenPage.tsx
src\contexts\AuthContext.tsx
src\hooks\useSafeImage.ts
src\index.css
src\lib\gemini-utils.ts
src\lib\promptDefaults.ts
src\lib\storage.ts
src\lib\storyStorage.ts
src\lib\supabase.ts
src\services\api_usage.ts
src\services\export.ts
src\services\gemini.ts
src\services\google_image.ts
src\services\google_tts.ts
src\services\ideaAnalysis.ts
src\services\musicClip.ts
src\services\openai.ts
src\services\storage.ts
src\services\tts.ts
src\services\vertex_service.ts
src\services\video_renderer.ts
src\services\video_service.ts
src\services\youtube.ts
src\types\music.ts
src\types\studio.ts
```

### Pergunta 2 - Instanciacao do cliente Supabase

Arquivo: `src/lib/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

As variaveis sao injetadas pelo Vite via:

```ts
import.meta.env.VITE_SUPABASE_URL
import.meta.env.VITE_SUPABASE_ANON_KEY
```

### Pergunta 3 - Hook/service de login/logout/signup

Responsavel: `src/contexts/AuthContext.tsx`.

O contexto usa:

```ts
supabase.auth.getSession()
supabase.auth.onAuthStateChange(...)
supabase.auth.signUp(...)
supabase.auth.signInWithPassword(...)
supabase.auth.signOut()
```

Nao foi encontrado tratamento explicito de erro `401` ou fluxo proprio para token expirado. O app confia no estado de sessao do Supabase e no `onAuthStateChange`. Rotas protegidas usam `ProtectedRoute`, que redireciona para `/login` quando `user` e `null`.

## Bloco B - Upload e Storage

### Pergunta 4 - Arquivos com upload para Supabase Storage

Uploads reais encontrados no fluxo atual:

#### `src/lib/storage.ts`

Bucket:

```ts
const CLOUD_BUCKET = 'library';
```

Upload:

```ts
supabase.storage
  .from(CLOUD_BUCKET)
  .upload(filePath, blob, { upsert: true });
```

Caminho:

```ts
const filePath = `${user.id}/${fileName}`;
```

Uso: biblioteca de arquivos, como musicas, logos, thumbnails manuais e ending cards.

#### `src/lib/storyStorage.ts`

Bucket:

```ts
supabase.storage
  .from('thumbnails')
  .upload(filePath, blob, { upsert: true });
```

Caminho:

```ts
const fileName = `${story.id}_thumbnail.png`;
const filePath = `${user.id}/${fileName}`;
```

Uso: preview/capa da historia quando `previewImage` esta em base64/data URL.

#### `src/services/storage.ts`

Tambem existe um servico aparentemente legado:

```ts
supabase.storage.from('story-images').upload(...)
supabase.storage.from('story-audio').upload(...)
```

Os buckets `story-images` e `story-audio` existem nas migrations antigas, mas nao parecem ser o fluxo principal do Studio atual.

### Pergunta 5 - Fluxo das imagens geradas por IA

Fluxo principal atual do Studio:

1. A IA gera imagem em `src/services/google_image.ts`, chamando `/api/generate-image`.
2. O retorno vira data URL:

```ts
return `data:${data.mimeType || 'image/png'};base64,${data.base64}`;
```

3. `src/components/Studio/ImagesPage.tsx` atribui esse valor a cena:

```ts
scene.imageUrl = imageUrl;
```

4. `src/components/Studio/index.tsx` salva o estado inteiro:

```ts
data: newState
```

5. `src/lib/storyStorage.ts` persiste esse estado em `stories.data`.

Conclusao: as imagens de cena ficam como data URL/base64 dentro do JSONB `stories.data`; elas nao sao enviadas para Storage no fluxo principal. Ja a thumbnail/preview, se estiver em base64, e convertida para Blob e enviada para o bucket `thumbnails`.

### Pergunta 6 - Bucket de audio e fluxo TTS

Existe bucket legado/migration para audio: `story-audio`, em `supabase/migrations/002_storage_buckets.sql`.

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-audio',
  'story-audio',
  true,
  5242880,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']
);
```

Tambem existe funcao em `src/services/storage.ts`:

```ts
supabase.storage
  .from('story-audio')
  .upload(filePath, blob, {
    contentType: 'audio/mpeg',
    upsert: true
  });
```

No fluxo atual do Studio, o TTS gera data URL WAV e salva no estado local/cloud como JSONB, sem upload para bucket.

Fluxo atual:

1. `src/services/tts.ts` chama `/api/generate-narration`.
2. O retorno vira:

```ts
return `data:audio/wav;base64,${data.audio}`;
```

3. `src/components/Studio/NarrationPage.tsx` salva em:

```ts
audioUrl: audioPreviewUrl
```

4. `storyStorage.saveStory()` persiste dentro de `stories.data`.

No `StoryViewer` legado, o audio completo e salvo diretamente na coluna `stories.full_audio_url`:

```ts
await supabase.from('stories').update({ full_audio_url: audioUrl }).eq('id', storyId);
```

E reproduzido com:

```tsx
<audio controls src={story.full_audio_url} />
```

## Bloco C - Queries e performance

### Pergunta 7 - Listagem de historias do usuario

Fluxo principal do dashboard: `src/components/Dashboard.tsx` usa `src/lib/storyStorage.ts`.

Primeiro carrega local IndexedDB:

```ts
const localData = await storyStorage.getLocalStories();
```

Depois sincroniza nuvem:

```ts
const syncedData = await storyStorage.getAllStories();
```

Query cloud em `src/lib/storyStorage.ts`:

```ts
const { data, error } = await supabase
  .from('stories')
  .select('id, title, created_at, updated_at, preview_image, is_complete, currentStep:data->>currentStep')
  .order('updated_at', { ascending: false });
```

Nao ha paginacao. O sistema carrega todas as historias do usuario de uma vez, ordenadas por `updated_at desc`.

Tambem ha um dashboard antigo em `src/components/StoryDashboard.tsx`:

```ts
supabase
  .from('stories')
  .select('id, title, status, age_group, tone, created_at, user_id')
  .order('created_at', { ascending: false });
```

Tambem sem paginacao.

### Pergunta 8 - Campos JSONB em `stories`

Sim. Ha duas fases de schema no repo.

#### Schema mais novo/simples: `database/create_tables.sql`

```sql
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
```

`data`: armazena o `StudioState` inteiro, incluindo config, narracao, cenas, imagens base64/data URL, thumbnailUrl, timeline etc.

#### Schema/migration mais antigo: `supabase/migrations/001_initial_schema.sql`

```sql
character_descriptions JSONB,
generation_metadata JSONB
```

Comentarios do schema:

```sql
COMMENT ON COLUMN stories.character_descriptions IS 'Cache de descricoes de personagens para consistencia de imagens (JSONB)';
COMMENT ON COLUMN stories.generation_metadata IS 'Metadados da geracao (modelo usado, tokens, etc)';
```

Em `supabase_schema.sql` tambem aparecem:

```sql
character_descriptions jsonb,
generation_metadata jsonb
```

## Bloco D - Seguranca e ambiente

### Pergunta 9 - `.env.example`

Existe `.env.example` na raiz de `magic-story-studio`.

Conteudo:

```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_OPENAI_API_KEY=your_openai_api_key_here # Optional
```

Sim, lista chaves de IA: Gemini e OpenAI.

Nao lista algumas variaveis usadas pelo codigo ou pelas functions, como:

```txt
VITE_GOOGLE_CLOUD_API_KEY
VITE_VERTEX_AI_URL
GCP_PROJECT_ID
GCP_CREDENTIALS_JSON
GCP_REGION_TTS
```

### Pergunta 10 - Buckets `library` e `thumbnails`

#### `library`

Usado para arquivos de biblioteca enviados pelo usuario pelo `FilesPage`, incluindo:

- ending cards
- musicas
- logos
- thumbnails/capas manuais

Fluxo:

1. O arquivo e salvo primeiro em IndexedDB.
2. Se o usuario estiver autenticado, tambem e enviado ao Supabase Storage.
3. Caminho no bucket:

```ts
library/{user.id}/{file.id}.{ext}
```

4. Metadados ficam na tabela `library_files`.

Pelas policies em `supabase_schema.sql`, o bucket tem leitura publica e `library_files` tem policy de select publica:

```sql
create policy "Users can view all library files"
on public.library_files for select
to public
using (true);
```

Isso sugere uma biblioteca visivel/compartilhavel, embora os uploads sejam organizados por pasta do usuario.

#### `thumbnails`

Usado por `storyStorage.saveStory()` para a imagem de preview/capa da historia quando `previewImage` esta em base64.

Caminho:

```txt
thumbnails/{user.id}/{story.id}_thumbnail.png
```

Serve principalmente previews/capas geradas ou salvas por usuario para as historias.

## Observacoes finais

- O projeto tem sinais de fluxos antigos e novos coexistindo.
- O fluxo principal atual do Studio usa `stories.data` como armazenamento grande do estado completo.
- Imagens e audios gerados pela IA tendem a permanecer como data URL/base64 dentro do JSONB, exceto thumbnails/previews enviados ao bucket `thumbnails`.
- Os buckets `story-images` e `story-audio` existem em migrations/servicos legados, mas nao parecem ser usados pelo fluxo principal atual do Studio.
