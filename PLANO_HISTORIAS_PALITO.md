# PRD — Histórias Palito (Doodle Animation Studio)

**Data:** 2026-06-28  
**Status:** Rascunho  
**Responsável:** Janerson William

---

## 1. Visão Geral

Adicionar ao Magic Story Studio um novo modo de produção chamado **Histórias Palito** — um pipeline completo para criar vídeos educativos de curiosidades no estilo animação doodle 2D desenhada à mão, voltado para canais do YouTube.

O formato é distinto do Studio atual (histórias infantis/bíblicas): o conteúdo é factual/educativo, o personagem é um boneco semi-palito com identidade visual fixa, e o pipeline começa pela geração de ideias virais (não por uma configuração de história).

---

## 2. Entrada no Sistema

### 2.1 Menu / Sidebar
- Adicionar novo item no Sidebar: **"Histórias Palito"** com ícone `PenLine` (Lucide)
- Rota: `/palito`
- Posicionar abaixo de "Studio" no menu principal

### 2.2 Página de Entrada (`/palito`)
- Tela com dois campos:
  - **Tema** (opcional): campo de texto livre — ex: "copa do mundo", "como é feita a água com gás"
  - Botão **"Gerar Ideias"**
- Se tema vazio → gera 10 ideias livres dentro do nicho de curiosidades gerais
- Se tema informado → gera 10 ângulos virais diferentes para aquele tema

---

## 3. Pipeline de Etapas

O pipeline tem **7 etapas sequenciais**, navegáveis por abas/steps no topo da página (igual ao Studio atual).

```
IDEIAS → ROTEIRO → NARRAÇÃO → TRANSCRIÇÃO → PERSONAGENS → CAPA → CENAS → METADADOS
```

---

### Etapa 1 — IDEIAS

**Objetivo:** Gerar e selecionar o título viral do vídeo.

**Comportamento:**
- Chamar Gemini com o prompt de geração de 10 ideias (Estágio 1 do prompt base)
- Exibir tabela com 10 títulos numerados
- Usuário clica em um título para selecioná-lo (highlight visual)
- Botão "Usar este título" avança para Etapa 2
- Botão "Gerar novas ideias" regenera a lista (mantendo o mesmo tema)

**Output salvo:** `{ titleIdeas: string[], selectedTitle: string }`

---

### Etapa 2 — ROTEIRO

**Objetivo:** Gerar o roteiro completo de narração (700–900 palavras).

**Comportamento:**
- Gerar automaticamente ao entrar na etapa (com base no título selecionado)
- Exibir o roteiro em textarea editável (o usuário pode ajustar antes de avançar)
- Contador de palavras visível
- Botão "Regenerar Roteiro" → regenera sem perder o título
- Botão "Usar este Roteiro" → avança para Etapa 3

**Regras do roteiro (via prompt para Gemini):**
- 700–900 palavras, apenas narração pura
- Tom calmo, 2ª pessoa ("você", "seu cérebro")
- Ritmo: frase curta. Frase curta. Frase mais longa. Pergunta?
- Arco: Gancho → Contexto → Explicação → Fato surpreendente → Conclusão
- Pelo menos 2 pesquisadores/estudos reais incorporados naturalmente
- Termina com linha que ecoa a abertura
- Idioma: Português brasileiro

**Output salvo:** `{ narrationScript: string }`

---

### Etapa 3 — NARRAÇÃO (Áudio)

**Objetivo:** Gerar o áudio da narração via TTS.

**Comportamento:**
- Reusar o componente/serviço de TTS já existente no sistema (`tts.ts`)
- Voz configurável: Gemini TTS (Kore, Charon, Aoede, Fenrir, Puck) — padrão: **Kore** (calma)
- Emoção padrão: **calmly**
- Player de áudio para preview
- Botão "Regenerar Áudio" (mesma voz, regenera)
- Botão "Trocar Voz" → dropdown de seleção
- Botão "Avançar" → Etapa 4

**Output salvo:** `{ audioUrl: string, voiceName: string }`

---

### Etapa 4 — TRANSCRIÇÃO (Timestamps)

**Objetivo:** Gerar a transcrição com timestamps para cada linha da narração.

**Comportamento:**
- Botão "Gerar Transcrição Automática" → processa o audioUrl e retorna transcrição com timestamps
- Exibir resultado em formato editável:
  ```
  [00:00] Esta noite, quando o sol se pôr...
  [00:05] A luz vai inundar o cômodo...
  ```
- Usuário pode editar manualmente qualquer linha/timestamp
- Contador: "X linhas / Y timestamps detectados"
- Botão "Avançar" → Etapa 5

**Implementação de transcrição:**
- Usar Gemini API com o audioUrl (modelo multimodal que aceita áudio)
- Fallback: campo de upload manual (usuário cola transcrição do TurboScribe/YouTube Studio)
- Formato de saída obrigatório: array de `{ timestamp: string, text: string }`

**Output salvo:** `{ transcription: Array<{ timestamp: string, text: string }> }`

---

### Etapa 5 — PERSONAGENS

**Objetivo:** Gerar a imagem de referência do personagem principal (identidade fixa do canal).

**Comportamento:**
- Exibir o DNA do personagem fixo (descrito abaixo) como card visual de referência
- Botão "Gerar Personagem de Referência" → chama gerador de imagens com o prompt padrão
- Exibir imagem gerada
- Botão "Regenerar" → tenta novamente com seed diferente
- Botão "Usar esta imagem" → salva como referência para todas as cenas

**DNA do Personagem (prompt fixo, não editável pelo usuário):**
```
Animação doodle 2D desenhada à mão, cores chapadas, contornos pretos grossos, 
linhas levemente imperfeitas de marcador. Personagem em pose neutra, fundo branco sólido. 
Cabeça circular grande preenchida de branco, contorno preto grosso. 
Cabelo: 4 a 5 riscos diagonais finos e curtos no topo, levemente espetados. 
Olhos: dois pontos pretos pequenos, centro-baixo da cabeça. 
Sobrancelhas: duas linhas retas finas levemente inclinadas para baixo no centro. 
Boca: linha reta (expressão neutra). 
Camiseta cinza médio (#9E9E9E), gola redonda, mangas curtas. 
Shorts cinza escuro (#555555). 
Braços: linhas finas pretas, punhos circulares brancos. 
Pernas: linhas finas pretas, pés ovais brancos levemente achatados. 
Sombra oval cinza claro achatada embaixo dos pés. 
Sem sombreamento, sem gradiente, sem texturas, sem fotorrealismo, sem 3D, 
sem estilo anime, proporção 1:1, fundo branco puro.
```

**Output salvo:** `{ characterReferenceImageUrl: string }`

---

### Etapa 6 — CAPA (Thumbnail)

**Objetivo:** Gerar a thumbnail/capa do vídeo.

**Comportamento:**
- Exibir o título selecionado
- Botão "Gerar Capa" → gera com prompt específico para thumbnail YouTube (16:9)
- Exibir imagem gerada (preview em 16:9)
- Botão "Regenerar"
- Botão "Avançar"

**Prompt da capa (gerado automaticamente com base no título):**
```
Thumbnail YouTube estilo doodle 2D desenhada à mão, 16:9, fundo [cor vibrante baseada no tema].
Personagem principal [expressão de choque/surpresa: boca aberta em "O", sobrancelhas levantadas],
braços abertos. Texto em caixa alta vermelho no topo: "[TÍTULO CURTO EM PORTUGUÊS]". 
Objeto central grande relacionado ao tema do vídeo em estilo cartoon chapado.
Cores chapadas, contornos pretos grossos, sem gradientes, sem fotorrealismo.
```

**Output salvo:** `{ thumbnailUrl: string }`

---

### Etapa 7 — CENAS (Imagens)

**Objetivo:** Gerar uma imagem por timestamp da transcrição.

**Comportamento:**
- Para cada item da transcrição, gerar automaticamente um prompt de imagem detalhado
- Exibir os prompts antes de gerar (usuário pode editar)
- Botão "Gerar Todas as Imagens" → processa em lotes (máx 5 simultâneos)
- Exibir grid de thumbnails das imagens geradas com o timestamp associado
- Cada imagem tem botão "Regenerar" individual
- Barra de progresso: "X de Y imagens geradas"
- Botão "Avançar" ativo somente quando todas as imagens estiverem geradas

**Geração dos prompts de cena (via Gemini):**
- Input: transcrição com timestamps + título + caracterReferenceImageUrl
- Output: array de prompts, um por timestamp
- Cada prompt segue o padrão completo com âncora de estilo + descrição + fechamento
- Intercalação de fundos Tipo A (chapado) e Tipo B (cenário doodle) obrigatória
- Todo texto dentro da cena em PORTUGUÊS

**Output salvo:** `{ scenes: Array<{ timestamp: string, text: string, prompt: string, imageUrl: string }> }`

---

### Etapa 8 — METADADOS

**Objetivo:** Gerar título viral, descrição e tags otimizadas para YouTube.

**Comportamento:**
- Gerar automaticamente ao entrar na etapa
- Exibir três blocos copiáveis:
  1. **Título Viral** (< 70 caracteres)
  2. **Descrição** (gancho + resumo + CTA + hashtags)
  3. **Tags** (25–40 palavras-chave separadas por vírgula)
- Botão "Copiar" em cada bloco
- Botão "Regenerar Metadados"
- Botão "Baixar Pacote Completo" → ZIP com: roteiro.txt + prompts.txt + metadados.txt

---

## 4. Tipos TypeScript Novos

```typescript
// src/types/palito.ts

export interface PalitoConfig {
  tema?: string;
}

export interface PalitoIdeas {
  tema?: string;
  ideas: string[];
  selectedTitle: string;
}

export interface PalitoScript {
  narrationScript: string;
  wordCount: number;
}

export interface PalitoAudio {
  audioUrl: string;
  voiceName: string;
  emotion: string;
}

export interface PalitoTranscriptionLine {
  timestamp: string; // "00:00"
  text: string;
}

export interface PalitoSceneLine extends PalitoTranscriptionLine {
  imagePrompt: string;
  imageUrl?: string;
}

export interface PalitoCharacter {
  referenceImageUrl: string;
}

export interface PalitoMetadata {
  viralTitle: string;
  description: string;
  tags: string[];
}

export interface PalitoState {
  currentStep: PalitoStep;
  config?: PalitoConfig;
  ideas?: PalitoIdeas;
  script?: PalitoScript;
  audio?: PalitoAudio;
  transcription?: PalitoTranscriptionLine[];
  character?: PalitoCharacter;
  thumbnailUrl?: string;
  scenes?: PalitoSceneLine[];
  metadata?: PalitoMetadata;
}

export type PalitoStep =
  | 'IDEAS'
  | 'SCRIPT'
  | 'NARRATION'
  | 'TRANSCRIPTION'
  | 'CHARACTER'
  | 'THUMBNAIL'
  | 'SCENES'
  | 'METADATA';
```

---

## 5. Serviços / APIs

| Serviço | Onde usar | Observação |
|---------|-----------|------------|
| Gemini (texto) | Ideias, Roteiro, Prompts de cena, Metadados | Reusar `gemini.ts` |
| Gemini TTS | Narração | Reusar `tts.ts` |
| Gemini multimodal (áudio→texto) | Transcrição automática | Novo método em `gemini.ts` |
| Google Imagen / Pollinations | Personagem, Capa, Cenas | Reusar `google_image.ts` |
| Supabase Storage | Salvar audioUrl, imageUrls | Reusar `storyStorage.ts` |

---

## 6. Arquivos a Criar / Modificar

### Criar
```
src/types/palito.ts
src/components/Palito/index.tsx              ← roteador de steps
src/components/Palito/IdeasPage.tsx
src/components/Palito/ScriptPage.tsx
src/components/Palito/NarrationPage.tsx
src/components/Palito/TranscriptionPage.tsx
src/components/Palito/CharacterPage.tsx
src/components/Palito/ThumbnailPage.tsx
src/components/Palito/ScenesPage.tsx
src/components/Palito/MetadataPage.tsx
src/lib/palitoStorage.ts                    ← persistência no Supabase
```

### Modificar
```
src/App.tsx                  ← adicionar rota /palito
src/components/Sidebar.tsx   ← adicionar item "Histórias Palito"
src/components/MainLayout.tsx ← mapear nova página
src/services/gemini.ts       ← adicionar método de transcrição de áudio
supabase_schema.sql          ← nova tabela palito_projects
```

---

## 7. Schema Supabase

```sql
CREATE TABLE palito_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tema TEXT,
  selected_title TEXT,
  narration_script TEXT,
  audio_url TEXT,
  voice_name TEXT,
  transcription JSONB,         -- Array<{ timestamp, text }>
  character_image_url TEXT,
  thumbnail_url TEXT,
  scenes JSONB,                -- Array<{ timestamp, text, prompt, imageUrl }>
  metadata JSONB,              -- { viralTitle, description, tags }
  current_step TEXT DEFAULT 'IDEAS',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE palito_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own palito projects" ON palito_projects
  FOR ALL USING (auth.uid() = user_id);
```

---

## 8. UX / Design

- Reusar o sistema de design atual (dark theme, `bg-[#1a1a1c]`, `border-border`)
- Steps no topo como chips clicáveis (apenas steps já completados são clicáveis)
- Cada page tem: título do step, área de conteúdo principal, botões "Voltar" / "Avançar"
- Loading states com skeleton ou spinner animado durante geração
- Ícone do menu: `PenLine` (Lucide) — representa escrita/doodle

---

## 9. Ordem de Implementação

1. `src/types/palito.ts` — tipos
2. Sidebar + rota `/palito` (página placeholder)
3. `palitoStorage.ts` + migration Supabase
4. `IdeasPage.tsx` — integração Gemini
5. `ScriptPage.tsx` — integração Gemini
6. `NarrationPage.tsx` — reusar TTS existente
7. `TranscriptionPage.tsx` — transcrição via Gemini multimodal
8. `CharacterPage.tsx` — geração de imagem com prompt fixo
9. `ThumbnailPage.tsx` — geração thumbnail
10. `ScenesPage.tsx` — geração em lote (mais complexo)
11. `MetadataPage.tsx` — integração Gemini
12. `index.tsx` (Palito) — orquestrador com estado global

---

## 10. Fora de Escopo (v1)

- Timeline / editor de vídeo integrado (usar CapCut/Premiere externamente)
- Upload de áudio externo (ElevenLabs) — v1 usa apenas Gemini TTS
- Múltiplos personagens (v1 = apenas personagem fixo do canal)
- Histórico de projetos Palito na Dashboard
