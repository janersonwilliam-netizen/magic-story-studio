# Plano de Implementacao - Mudancas do Magic Story Studio

Baseado no PDF `magic_story_studio_mudancas.pdf` e no estado atual do codigo.

## Objetivo

Reduzir o crescimento do banco Supabase, melhorar performance do dashboard e endurecer o comportamento de autenticacao. O ponto principal e remover imagens/audios base64 do campo `stories.data` e salvar somente URLs publicas de Storage.

## Diagnostico rapido

O problema mais critico esta no fluxo do Studio:

- `src/services/google_image.ts` retorna imagens como `data:image/...;base64,...`.
- `src/services/tts.ts` retorna audio como `data:audio/wav;base64,...`.
- `src/components/Studio/index.tsx` salva o `StudioState` inteiro via `storyStorage.saveStory(project)`.
- `src/lib/storyStorage.ts` persiste esse estado em `stories.data`.

Resultado: `stories.data` pode crescer varios MB por historia.

## Estrategia recomendada

Centralizar a sanitizacao em `src/lib/storyStorage.ts`, antes do upsert no Supabase.

Em vez de espalhar upload por `ImagesPage`, `NarrationPage`, `ThumbnailPage` e `ScenesPage`, o `supabaseStoryStorage.saveStory()` deve:

1. Detectar qualquer URL `data:` no `StudioState`.
2. Fazer upload para Storage.
3. Substituir o base64 pela URL publica.
4. Salvar no banco apenas o estado sanitizado.

Essa abordagem reduz risco, porque pega todos os pontos que hoje podem gerar base64:

- `story.audioUrl`
- `storyWithScenes.thumbnailUrl`
- `storyWithScenes.scenes[].imageUrl`
- `storyWithScenes.characterReferenceImages`
- `storyWithScenes.audioUrls`, se existir
- `timeline.clips[].imageUrl` e `timeline.clips[].audioUrl`, se existir

## Fase 0 - Preparacao e validacao

### Tarefas

- Confirmar buckets existentes no Supabase:
  - `thumbnails`
  - `story-audio`
  - opcionalmente `story-images`, se preferir separar cenas de thumbnails.
- Criar migration idempotente para garantir `story-audio`, porque o schema mais novo do repo (`supabase_schema.sql`) cria `library` e `thumbnails`, mas nao garante `story-audio`.
- Rodar busca por usos de `data:` em campos persistidos.

### Arquivos envolvidos

- `supabase/migrations/*`
- `supabase_schema.sql`
- `src/lib/storyStorage.ts`

### Resultado esperado

Storage preparado antes de mudar o fluxo de salvamento.

## Fase 1 - Helpers de upload e sanitizacao

### Tarefas

Adicionar em `src/lib/storyStorage.ts` helpers como:

- `isDataUrl(value)`
- `dataUrlToBlob(dataUrl)`
- `getDataUrlMimeType(dataUrl)`
- `uploadStoryDataUrl(options)`
- `sanitizeStudioStateMedia(storyId, userId, state)`

### Buckets e caminhos sugeridos

Imagens:

```txt
thumbnails/{userId}/{storyId}/scene-{sceneOrder}.png
thumbnails/{userId}/{storyId}/thumbnail.png
thumbnails/{userId}/{storyId}/character-{safeName}.png
```

Audio:

```txt
story-audio/{userId}/{storyId}/narration.wav
story-audio/{userId}/{storyId}/scene-{sceneOrder}.wav
story-audio/{userId}/{storyId}/clip-{clipId}.wav
```

### Decisoes tecnicas

- Usar `upsert: true`.
- Definir `cacheControl: '604800'`.
- Definir `contentType` pelo MIME do data URL.
- Clonar o state antes de alterar, para evitar mutacao inesperada do React state.
- Nao fazer upload se o valor ja for URL HTTP ou URL do Supabase.

### Resultado esperado

Um unico ponto do codigo consegue converter media base64 em URL de Storage.

## Fase 2 - Remover base64 do `stories.data`

### Tarefas

Alterar `supabaseStoryStorage.saveStory()` em `src/lib/storyStorage.ts`:

1. Obter usuario com `supabase.auth.getUser()`.
2. Chamar `sanitizeStudioStateMedia(story.id, user.id, story.data)`.
3. Usar o state sanitizado no `dbRecord.data`.
4. Usar `preview_image` tambem como URL sanitizada.
5. Manter fallback local IndexedDB com o state original ou sanitizado, a decidir.

### Recomendacao sobre IndexedDB

Salvar localmente o state sanitizado depois do upload quando autenticado. Isso evita que o navegador continue guardando varios MB em base64 e reduz divergencia entre local e cloud.

### Resultado esperado

Novas historias deixam de gravar `data:image` e `data:audio` em `stories.data`.

## Fase 3 - Ajustar fluxos de geracao para autosave correto

### Tarefas

Verificar os pontos que salvam progresso:

- `src/components/Studio/index.tsx`
- `handleNarrationComplete`
- `handleScenesComplete`
- `handleThumbnailComplete`
- `handleImagesComplete`
- `handleImagesPartialUpdate`
- `handleTimelineComplete`

Hoje `ImagesPage` recebe `onPartialUpdate`, mas nao usa durante a geracao de cada cena. Planejar ajuste para chamar `onPartialUpdate` logo apos cada cena concluida, ou aceitar salvar somente no botao final.

### Recomendacao

Implementar autosave por cena depois do upload/sanitizacao centralizada:

- Ao concluir uma imagem, chamar `onPartialUpdate(updatedStoryWithScenes)`.
- O `saveProgress()` vai sanitizar e subir a midia.
- Em caso de falha de upload, manter erro visivel e nao salvar base64 no cloud.

### Resultado esperado

O usuario nao perde tudo se gerar varias imagens e sair antes de finalizar.

## Fase 4 - Audio TTS no Storage

### Tarefas

Manter `src/services/tts.ts` retornando data URL, porque isso simplifica preview imediato.

No salvamento:

- `story.audioUrl` deve ser convertido para Storage.
- `storyWithScenes.audioUrls`, se existir, tambem.
- `timeline.clips[].audioUrl` deve ser sanitizado quando for data URL.

### Atencao

O PDF fala em `scene.audioUrl`, mas no fluxo atual do Studio o audio principal nasce em `NarrationPage` como `story.audioUrl`. Ja no `StoryViewer` legado existe outro fluxo com `full_audio_url`. O plano deve cobrir ambos:

- Studio novo: sanitizar em `stories.data`.
- StoryViewer legado: opcionalmente trocar `full_audio_url` para Storage se ainda for usado.

### Resultado esperado

Audios WAV nao ficam mais embutidos no JSONB.

## Fase 5 - Auth e token expirado

### Tarefas

Alterar `src/contexts/AuthContext.tsx`:

- Tratar `SIGNED_OUT` explicitamente.
- Se `session` vier `null`, limpar `user` e `session`.
- Evitar redirect agressivo durante `INITIAL_SESSION`.
- Redirecionar para `/login` apenas quando necessario.

### Observacao importante

O PDF menciona `TOKEN_REFRESHED_ERROR`, mas a versao instalada de `@supabase/auth-js` expoe:

```ts
'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED'
```

Entao o tratamento deve ser baseado em `SIGNED_OUT`, `session === null` e nos erros das queries.

### Helper recomendado

Criar um helper pequeno, por exemplo em `src/lib/supabaseErrors.ts`:

```ts
export async function handleSupabaseAuthError(error: any) {
  if (error?.status === 401 || error?.statusCode === 401) {
    await supabase.auth.signOut();
  }
}
```

Usar pelo menos em `storyStorage.ts`, `storage.ts` e telas principais que fazem queries diretas.

### Resultado esperado

Sessao expirada nao deixa o app em tela quebrada ou queries falhando silenciosamente.

## Fase 6 - SELECT seletivo e auditoria de queries

### Tarefas

Criar constante em `src/lib/storyStorage.ts`:

```ts
export const STORY_LIST_FIELDS =
  'id, title, created_at, updated_at, preview_image, is_complete, currentStep:data->>currentStep';
```

Revisar queries encontradas:

- `src/lib/storyStorage.ts`
  - `getAllStories()` ja e seletivo.
  - `getStory(id)` pode continuar carregando `*` ou ser reduzido para campos necessarios.
- `src/services/export.ts`
  - usa `.select('*')`; verificar se e detalhe/exportacao, nao listagem.
- `src/components/StoryViewer.tsx`
  - usa `.select('*')`; fluxo legado/detalhe.
- `src/components/StoryDashboard.tsx`
  - listagem antiga, ja nao carrega `data`, mas manter seletiva.

### Resultado esperado

Nenhuma listagem carrega `stories.data`.

## Fase 7 - Paginacao do Dashboard

### Tarefas

Adicionar API paginada em `storyStorage`:

- `getStoriesPage(page, pageSize)`
- retorno com `{ stories, total, page, pageSize, hasMore }`

Atualizar `src/components/Dashboard.tsx`:

- Estado `page`, `hasMore`, `loadingMore`.
- Botao `Carregar mais`.
- Manter primeiro carregamento rapido.

### Recomendacao

Comecar com botao `Carregar mais`, nao scroll infinito. E mais simples de testar e menos propenso a chamadas duplicadas.

### Resultado esperado

Dashboard carrega 20 historias por vez.

## Fase 8 - Atualizar `.env.example`

### Tarefas

Completar `.env.example` com:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Google AI
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GOOGLE_CLOUD_API_KEY=your_google_cloud_api_key_here
VITE_VERTEX_AI_URL=your_vertex_ai_endpoint_here

# GCP backend/functions
GCP_PROJECT_ID=your_gcp_project_id
GCP_CREDENTIALS_JSON='{"type":"service_account"}'
GCP_REGION_TTS=us-central1

# OpenAI optional
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

### Resultado esperado

Onboarding e deploy ficam menos sujeitos a variaveis ausentes.

## Fase 9 - Migracao de dados existentes

### Tarefas

Primeiro rodar query de diagnostico:

```sql
SELECT
  id,
  title,
  pg_size_pretty(octet_length(data::text)) AS data_size
FROM stories
WHERE data::text LIKE '%data:image/%;base64%'
   OR data::text LIKE '%data:audio/%;base64%'
ORDER BY octet_length(data::text) DESC;
```

Depois criar script Node ou function temporaria para:

1. Ler historias com base64.
2. Percorrer `data`.
3. Fazer upload de cada data URL para Storage.
4. Substituir por URL publica.
5. Atualizar `stories.data`.

### Recomendacao

Fazer essa migracao depois que o app novo estiver gravando corretamente. Rodar primeiro em uma copia ou em poucos registros.

### Resultado esperado

Historias antigas tambem deixam de ocupar MBs no banco.

## Fase 10 - QA e validacao

### Checklist

- Gerar uma historia nova.
- Gerar capa e cenas.
- Gerar audio.
- Confirmar arquivos no Storage:
  - `thumbnails`
  - `story-audio`
- Confirmar que `stories.data::text` nao contem:
  - `data:image`
  - `data:audio`
- Abrir dashboard e validar carregamento.
- Abrir historia salva e validar imagens/audio.
- Recarregar pagina e validar que URLs continuam funcionando.
- Testar logout e sessao limpa.
- Rodar `npm run build`.

### Query final de verificacao

```sql
SELECT
  id,
  title,
  pg_size_pretty(octet_length(data::text)) AS data_size,
  data::text LIKE '%data:image/%;base64%' AS has_base64_image,
  data::text LIKE '%data:audio/%;base64%' AS has_base64_audio
FROM stories
ORDER BY octet_length(data::text) DESC;
```

## Ordem de implementacao recomendada

1. Criar/garantir bucket `story-audio` e policies.
2. Criar helpers de upload/sanitizacao em `storyStorage.ts`.
3. Sanitizar `StudioState` antes do upsert cloud.
4. Ajustar autosave de imagens por cena.
5. Tratar auth/session expirada.
6. Auditar SELECTs e criar constante de campos de listagem.
7. Implementar paginacao no Dashboard.
8. Atualizar `.env.example`.
9. Rodar QA.
10. Planejar e executar migracao de dados antigos.

## Riscos e cuidados

- Se o bucket `story-audio` nao existir no Supabase real, uploads de audio vao falhar.
- Upload centralizado em `saveStory()` aumenta o tempo de salvamento quando houver muitos data URLs. Por isso e importante salvar apenas novos `data:` e ignorar URLs ja enviadas.
- O bucket `thumbnails` esta sendo reutilizado para cenas conforme o PDF. Tecnicamente seria mais claro usar `story-images`, mas seguir o PDF evita criar uma nova convencao.
- Nao redirecionar para `/login` em todo evento de auth com `session === null` sem considerar `loading`, para evitar flicker no primeiro carregamento.
- A migracao de dados antigos deve ser feita separadamente, depois de validar o novo fluxo.

## Estimativa

- Fases 0 a 4: 1 a 2 dias.
- Fases 5 a 8: 0,5 a 1 dia.
- QA: 0,5 dia.
- Migracao de dados antigos: depende do volume, estimado em 0,5 a 1 dia para criar e validar o script.

