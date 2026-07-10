# Metadados otimizados para vidIQ (Studio) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o prompt de `generateStoryMetadata` (Studio — Infantil/Bíblica) para amarrar título, descrição e tags a uma palavra-chave primária consistente, alongar a descrição e ampliar a cobertura de tags, seguindo as boas práticas de SEO que o vidIQ pontua.

**Architecture:** Extrai a montagem do prompt para uma função pura exportada `buildStoryMetadataPrompt`, testável sem chamar a API. `generateStoryMetadata` passa a chamar essa função e mantém o resto do fluxo (chamada ao Vertex via `callVertexText`, parse do JSON) intacto.

**Tech Stack:** TypeScript, sem framework de testes (o projeto não tem vitest/jest) — verificação via scripts `tsx` ad-hoc em `scripts/`, seguindo o padrão já existente (`scripts/migrate_base64.ts`).

## Global Constraints

- Escopo: **apenas** `src/services/gemini.ts`. Não tocar `palitoGemini.ts` (Palito está fora de escopo) nem nenhum componente de UI.
- O shape de retorno de `generateStoryMetadata` continua exatamente `{viralTitle: string, description: string, tags: string[], pinnedComment: string}` — sem novos campos, sem mudança de assinatura.
- Todo o conteúdo gerado pelo prompt continua em Português Brasileiro.
- Tags somadas (`tags.join(', ')`) nunca podem ultrapassar 500 caracteres — limite técnico do YouTube.

---

### Task 1: Extrair `buildStoryMetadataPrompt` e reescrever o prompt

**Files:**
- Modify: `src/services/gemini.ts:175-224`
- Test: `scripts/verify-metadata-prompt.ts` (novo)

**Interfaces:**
- Produces: `export function buildStoryMetadataPrompt(params: GenerateStoryMetadataParams): string` — pura, sem I/O, usada por `generateStoryMetadata` e pelo script de teste.
- Consumes: `GenerateStoryMetadataParams` (já existe em `gemini.ts:162-166`): `{title: string, script: string, theme?: string}`.

- [ ] **Step 1: Escrever o teste estrutural (vai falhar — a função ainda não existe)**

Criar `scripts/verify-metadata-prompt.ts`:

```typescript
/**
 * Verifica ESTRUTURALMENTE o prompt de metadados (sem chamar a API): confirma
 * que as regras novas do design de SEO/vidIQ (palavra-chave primária, alvo de
 * tamanho da descrição, alvo de contagem/orçamento de tags) estão presentes no
 * texto do prompt, e que a interpolação de título/roteiro/tema continua correta.
 *
 * Rodar: npx tsx scripts/verify-metadata-prompt.ts
 */
import { buildStoryMetadataPrompt } from '../src/services/gemini';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
    if (cond) console.log(`  PASS ${name}`);
    else { failures++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const classica = buildStoryMetadataPrompt({
    title: 'O Coelhinho Corajoso',
    script: 'Era uma vez um coelhinho muito medroso que vivia na floresta e sonhava em ser corajoso.',
    theme: 'classica',
});

const biblica = buildStoryMetadataPrompt({
    title: 'Jonas e o Grande Peixe',
    script: 'Deus chamou Jonas para ir a Nínive, mas Jonas fugiu e foi engolido por um grande peixe.',
    theme: 'biblica',
});

console.log('1) conceito de palavra-chave primária presente');
check('menciona PALAVRA-CHAVE PRIMÁRIA', classica.includes('PALAVRA-CHAVE PRIMÁRIA'));
check('amarra título/descrição/tags à mesma frase',
    classica.includes('no início do título') &&
    classica.includes('primeira frase da descrição') &&
    classica.includes('primeira tag da lista'));

console.log('2) alvo de tamanho da descrição (200 a 300 palavras)');
check('cita 200 a 300 palavras', classica.includes('200 a 300 palavras'));
check('pede 2 a 3 parágrafos', classica.includes('2 a 3 parágrafos'));
check('pede repetição da keyword 2 a 4 vezes', classica.includes('entre 2 e 4 vezes'));

console.log('3) alvo de tags (25 a 35, orçamento de caracteres)');
check('cita 25 a 35 tags', classica.includes('25 a 35 tags'));
check('cita orçamento 400 a 480 caracteres', classica.includes('400 e 480 caracteres'));
check('cita o limite técnico de 500', classica.includes('500'));

console.log('4) diferenciação por tema (bíblica vs clássica)');
check('bíblica pede nomes de personagens/episódio', biblica.includes('personagens/episódio bíblico'));
check('clássica NÃO pede nomes de personagens/episódio bíblico', !classica.includes('personagens/episódio bíblico'));
check('clássica cita "historinha para dormir"', classica.includes('historinha para dormir'));
check('bíblica cita "história bíblica infantil"', biblica.includes('história bíblica infantil'));

console.log('5) interpolação de parâmetros continua correta');
check('título aparece verbatim', classica.includes('"O Coelhinho Corajoso"'));
check('trecho do roteiro aparece verbatim', classica.includes('Era uma vez um coelhinho muito medroso'));

console.log('6) contrato de saída JSON não foi quebrado');
check('ainda pede o mesmo shape de JSON',
    classica.includes('{"viralTitle": "...", "description": "...", "tags": ["tag1", "tag2", ...], "pinnedComment": "..."}'));

console.log(failures === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx tsx scripts/verify-metadata-prompt.ts`
Expected: erro de import — `buildStoryMetadataPrompt` não existe em `src/services/gemini.ts` (a função ainda não foi criada).

- [ ] **Step 3: Extrair e reescrever o prompt em `src/services/gemini.ts`**

Substituir o bloco atual (linhas 175-224, de `export async function generateStoryMetadata` até o fechamento da função) por:

```typescript
export function buildStoryMetadataPrompt(params: GenerateStoryMetadataParams): string {
    const isBiblica = params.theme === 'biblica';
    const broadTerms = isBiblica
        ? 'histórias bíblicas, historinhas para crianças, Bíblia infantil, desenho biblico'
        : 'histórias infantis, contos para crianças, desenho animado, historinha para dormir';
    const keywordExample = isBiblica
        ? 'Jonas historia biblica infantil'
        : 'coelhinho historia para dormir';

    return `Você é um especialista em SEO e crescimento de canais do YouTube, focado em fazer vídeos infantis viralizarem através do algoritmo (CTR do título/thumbnail + retenção + engajamento — os 3 fatores que o YouTube mais usa para recomendar um vídeo) e em maximizar a nota de ferramentas de SEO como o vidIQ.

Título da história: "${params.title}"
Trecho do roteiro (primeiros 300 caracteres): "${params.script.substring(0, 300)}..."

PASSO 1 — ESCOLHA A PALAVRA-CHAVE PRIMÁRIA (faça isso antes de escrever qualquer campo):
Escolha UMA frase-chave primária de 2 a 4 palavras — a forma mais provável de um pai ou uma criança digitar para buscar ESTE vídeo específico (ex: "${keywordExample}"). Essa MESMA frase (ou uma variação muito próxima) deve aparecer:
- no início do título
- na primeira frase da descrição
- como a primeira tag da lista

Isso é o fator que mais pesa na nota de SEO (vidIQ e busca do YouTube): consistência da palavra-chave entre título, descrição e tags.

Gere metadados otimizados para MAXIMIZAR o desempenho no algoritmo do YouTube e a nota de SEO, seguindo exatamente estas regras:

TÍTULO (principal fator de CTR):
- Máximo 60 caracteres (o YouTube corta o resto na busca e no celular)
- Comece com a palavra-chave primária escolhida no PASSO 1
- Crie curiosidade genuína (pergunta, gancho emocional, promessa de descoberta) SEM prometer nada que a história não cumpra — título enganoso derruba a retenção e o algoritmo pune o vídeo por isso
- Evite CAIXA ALTA constante e excesso de emojis/pontuação (!!! ???), isso é lido como spam pelo YouTube e pelos pais

DESCRIÇÃO (200 a 300 palavras — descrições curtas pontuam mal em ferramentas de SEO como o vidIQ):
- Primeira frase: gancho forte que já contém a palavra-chave primária (os primeiros ~125 caracteres aparecem na busca e no feed ANTES do "mostrar mais" — é a parte que decide se a pessoa clica)
- 2 a 3 parágrafos contando a história e a lição/moral aprendida ao final, repetindo a palavra-chave primária (ou uma variação bem próxima, ex: sinônimo ou plural) entre 2 e 4 vezes no total, de forma NATURAL — nunca empilhada/forçada a ponto de soar spam
- Inclua também 2 a 3 termos relacionados que ampliam a busca (ex: faixa etária, formato — "desenho animado infantil", "${isBiblica ? 'história bíblica infantil' : 'historinha para dormir'}")
- Uma pergunta simples para o espectador (ou os pais) responderem nos comentários — perguntas geram comentários, e comentários são um dos sinais mais fortes que o YouTube usa pra recomendar o vídeo
- Linha convidando a curtir, comentar, se inscrever e ativar o sininho
- 6 a 10 hashtags relevantes ao final (o YouTube só mostra as 3 primeiras acima do título; excesso de hashtags é tratado como spam)

TAGS (25 a 35 tags, usando o máximo possível dos 500 caracteres do YouTube sem ultrapassar):
- A primeira tag DEVE ser a palavra-chave primária exata escolhida no PASSO 1 (ela tem peso extra pro YouTube e pro vidIQ)
- Em seguida, 2 a 3 variações próximas dessa palavra-chave
- Misture termos amplos (${broadTerms}) com termos de cauda longa específicos desta história (frases como pais/crianças realmente buscam)
- Inclua tags de faixa etária e formato${isBiblica ? ', e nomes dos personagens/episódio bíblico da história' : ''}
- Some os caracteres de todas as tags (separadas por ", "): fique entre 400 e 480 caracteres — nunca ultrapasse 500
- Não repita a mesma tag em variações inúteis (plural/singular sem ganho de busca)

COMENTÁRIO FIXADO (engajamento):
- Crie uma pergunta curta e simples para o criador fixar como primeiro comentário do vídeo, convidando pais/crianças a responder — isso gera comentários logo nas primeiras horas, o que ajuda o vídeo a "pegar tração" no algoritmo

- Tudo em PORTUGUÊS BRASILEIRO

Retorne APENAS um JSON válido:
{"viralTitle": "...", "description": "...", "tags": ["tag1", "tag2", ...], "pinnedComment": "..."}`;
}

export async function generateStoryMetadata(params: GenerateStoryMetadataParams): Promise<StoryMetadataResult> {
    const prompt = buildStoryMetadataPrompt(params);
    const raw = await callVertexText(prompt, { temperature: 0.7 });
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
        viralTitle: parsed.viralTitle,
        description: parsed.description,
        tags: parsed.tags,
        pinnedComment: parsed.pinnedComment,
    };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx tsx scripts/verify-metadata-prompt.ts`
Expected: `TODOS OS TESTES PASSARAM`, exit code 0.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo em `src/services/gemini.ts` ou `scripts/verify-metadata-prompt.ts` (erros pré-existentes em outros arquivos, se houver, não são deste escopo).

- [ ] **Step 6: Commit**

```bash
git add src/services/gemini.ts scripts/verify-metadata-prompt.ts
git commit -m "feat: metadados do Studio amarram título/descrição/tags a uma palavra-chave primária (vidIQ SEO)

Extrai buildStoryMetadataPrompt (função pura, testável sem API) e
reescreve o prompt: PASSO 1 escolhe uma palavra-chave primária reusada
no início do título, na abertura da descrição e como primeira tag —
o fator que mais pesa no score do vidIQ. Descrição sobe de ~1
parágrafo curto para 200-300 palavras (2-3 parágrafos, keyword
repetida 2-4x natural). Tags sobem de 15-20 para 25-35, usando mais
do orçamento de 500 caracteres do YouTube.

Escopo: só Studio (Infantil/Bíblica) — Palito não é tocado.
"
```

---

### Task 2: Verificação com a API real

**Files:**
- Test: `scripts/verify-metadata-live.ts` (novo)

**Interfaces:**
- Consumes: `generateStoryMetadata(params: GenerateStoryMetadataParams): Promise<StoryMetadataResult>` (produzido/mantido na Task 1).

**Pré-requisito:** servidor local do backend rodando (`npm run dev:api` ou `npm run dev:api:ensure`) escutando em `http://localhost:8788`, com as credenciais Vertex configuradas em `.dev.vars` (já usadas em sessões anteriores deste projeto).

- [ ] **Step 1: Escrever o script de verificação**

Criar `scripts/verify-metadata-live.ts`:

```typescript
/**
 * Verificação com a API REAL (Vertex, via wrangler local): gera metadados para
 * uma história clássica e uma bíblica de exemplo e confere, na saída de verdade
 * da LLM, se a palavra-chave primária está de fato propagada entre título,
 * descrição e tags, e se tags/descrição batem os alvos de tamanho do design.
 *
 * Pré-requisito: `npm run dev:api` (ou dev:api:ensure) rodando em localhost:8788.
 * Rodar: npx tsx scripts/verify-metadata-live.ts
 *
 * Isso NÃO é um teste de CI — a saída do LLM não é determinística. É uma
 * checagem pontual, com avisos (⚠️) para revisão humana, não um gate rígido.
 */
(globalThis as any).fetch = ((orig) => (input: any, init?: any) => {
    let url = String(input);
    if (url.startsWith('/')) url = 'http://localhost:8788' + url;
    return orig(url, init);
})((globalThis as any).fetch);

import { generateStoryMetadata } from '../src/services/gemini';

const STOPWORDS = new Set(['de', 'da', 'do', 'a', 'o', 'e', 'um', 'uma', 'para', 'com', 'em', 'na', 'no']);

function normalize(text: string): string {
    return text
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function significantWords(text: string): Set<string> {
    return new Set(normalize(text).split(' ').filter(w => w.length >= 4 && !STOPWORDS.has(w)));
}

function sharedWordCount(a: string, b: string): number {
    const wordsA = significantWords(a);
    const wordsB = significantWords(b);
    let shared = 0;
    for (const w of wordsA) if (wordsB.has(w)) shared++;
    return shared;
}

function extractKeywordGuess(title: string): string {
    const cut = title.split(/[:\-–—?!,]/)[0].trim();
    const words = cut.split(/\s+/);
    return (words.length <= 6 ? cut : words.slice(0, 4).join(' '));
}

async function runCase(label: string, title: string, script: string, theme: 'classica' | 'biblica') {
    console.log(`\n===== ${label} =====`);
    const result = await generateStoryMetadata({ title, script, theme });

    console.log(`Título: ${result.viralTitle}`);
    console.log(`Descrição: ${result.description}`);
    console.log(`Tags (${result.tags.length}): ${result.tags.join(', ')}`);
    console.log(`Comentário fixado: ${result.pinnedComment}`);

    const keyword = extractKeywordGuess(result.viralTitle);
    console.log(`\nPalavra-chave inferida do título: "${keyword}"`);

    const descOpening = result.description.slice(0, 220);
    const sharedWithDesc = sharedWordCount(keyword, descOpening);
    console.log(sharedWithDesc >= 1
        ? `✅ keyword aparece na abertura da descrição (${sharedWithDesc} palavra(s) em comum)`
        : `⚠️  keyword NÃO aparece claramente na abertura da descrição`);

    const firstTags = result.tags.slice(0, 3).join(' ');
    const sharedWithTags = sharedWordCount(keyword, firstTags);
    console.log(sharedWithTags >= 1
        ? `✅ keyword aparece entre as 3 primeiras tags (${sharedWithTags} palavra(s) em comum)`
        : `⚠️  keyword NÃO aparece claramente entre as 3 primeiras tags`);

    const tagsCharCount = result.tags.join(', ').length;
    console.log(tagsCharCount <= 500
        ? `✅ tags somam ${tagsCharCount} caracteres (limite técnico: 500)`
        : `❌ tags somam ${tagsCharCount} caracteres — ULTRAPASSA o limite de 500 do YouTube`);
    console.log(result.tags.length >= 20 && result.tags.length <= 40
        ? `✅ ${result.tags.length} tags (alvo: 25-35)`
        : `⚠️  ${result.tags.length} tags — fora da faixa esperada (20-40)`);

    const wordCount = result.description.trim().split(/\s+/).filter(Boolean).length;
    console.log(wordCount >= 140 && wordCount <= 380
        ? `✅ descrição com ${wordCount} palavras (alvo: 200-300)`
        : `⚠️  descrição com ${wordCount} palavras — fora da faixa esperada (140-380)`);
}

(async () => {
    await runCase(
        'CLÁSSICA — O Coelhinho Corajoso',
        'O Coelhinho Corajoso',
        'Era uma vez um coelhinho muito medroso que vivia na floresta e sonhava em ser corajoso. Um dia, ele precisou enfrentar seus medos para salvar um amigo preso perto do rio, e descobriu que a coragem não é a ausência de medo, mas agir apesar dele.',
        'classica',
    );

    await runCase(
        'BÍBLICA — Jonas e o Grande Peixe',
        'Jonas e o Grande Peixe',
        'Deus chamou Jonas para ir à cidade de Nínive e avisar o povo para mudar de vida, mas Jonas teve medo e fugiu num barco. Uma tempestade forte quase afundou o navio, e Jonas foi engolido por um grande peixe, onde ficou três dias até se arrepender e obedecer a Deus.',
        'biblica',
    );

    console.log('\n\nRevise os ⚠️/❌ acima. Divergências pontuais são esperadas (o LLM não é determinístico) — o que importa é a TENDÊNCIA: a maioria dos checks deve vir ✅.');
    process.exit(0);
})().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
```

- [ ] **Step 2: Garantir que o backend local está rodando**

Run: `npm run dev:api:ensure` (em um terminal separado, deixar rodando)
Expected: servidor escutando em `http://localhost:8788`.

- [ ] **Step 3: Rodar a verificação e revisar a saída**

Run: `npx tsx scripts/verify-metadata-live.ts`
Expected: imprime título/descrição/tags/comentário gerados para os dois casos (clássica e bíblica), seguidos dos checks. A maioria das linhas deve vir `✅`. Nenhuma linha `❌` (essa é a única checagem rígida — orçamento de 500 caracteres de tags é limite técnico do YouTube, não estimativa).

Se algum `⚠️` aparecer isoladamente (ex.: 1 dos 2 casos com keyword não detectada na descrição), reler o texto impresso — frequentemente é falso-negativo do casamento de palavras (ex.: sinônimo que o script não reconhece), não um problema real do prompt. Se `❌` aparecer (tags > 500 chars) ou a maioria dos `⚠️` se repetir nos dois casos, isso indica que o prompt da Task 1 precisa de ajuste — voltar à Task 1, Step 3.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-metadata-live.ts
git commit -m "test: script de verificação manual dos metadados contra a API real (vidIQ SEO)

Gera metadados para uma história clássica e uma bíblica de exemplo e
confere, na saída real do LLM, propagação da palavra-chave primária
entre título/descrição/tags, orçamento de caracteres das tags e
contagem de palavras da descrição. Não é gate de CI — LLM não é
determinístico; serve para revisão humana pontual.
"
```
