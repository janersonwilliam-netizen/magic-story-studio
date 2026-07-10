# Metadados otimizados para vidIQ (Studio — Infantil/Bíblica)

## Contexto

O usuário reportou que a nota do vidIQ para os vídeos gerados pelo fluxo Studio
(histórias infantis e bíblicas) está baixa. A geração de metadados (título,
descrição, tags, comentário fixado) acontece em `generateStoryMetadata`
(`src/services/gemini.ts`), chamada pela tela `src/components/Studio/MetadataPage.tsx`.

**Escopo:** apenas o fluxo Studio (Infantil/Bíblica). O Palito tem seu próprio
gerador de metadados (`generatePalitoMetadata` em `palitoGemini.ts`) e não é
tocado nesta mudança.

## Problema

Comparado às boas práticas de SEO que o vidIQ pontua, o prompt atual tem gaps:

1. **Sem palavra-chave primária amarrando os campos.** Título, descrição e tags
   são gerados de forma relativamente solta entre si — não há uma frase-chave
   única reforçada nos três lugares, que é um dos fatores que mais pesa no
   score do vidIQ (consistência de keyword entre título/descrição/tags).
2. **Descrição curta.** O prompt não define um tamanho-alvo; na prática sai com
   ~80-150 palavras. O vidIQ recompensa descrições mais substanciais (~200-300
   palavras) com a keyword repetida naturalmente algumas vezes.
3. **Poucas tags.** O prompt pede 15-20 tags, usando bem menos que os 500
   caracteres que o YouTube permite. Mais cobertura de tags relevantes pontua
   mais alto.

## Mudança

Único arquivo tocado: `src/services/gemini.ts`, função `generateStoryMetadata`
(prompt reescrito). Sem mudança de UI e sem novo campo na resposta — o shape
do JSON continua `{viralTitle, description, tags, pinnedComment}`.

### 1. Palavra-chave primária

O prompt instrui a IA a escolher UMA frase-chave primária (2-4 palavras, a
forma mais provável de um pai/criança buscar esse vídeo específico) antes de
gerar o resto, e reusar essa mesma frase (ou variação muito próxima) em três
lugares:
- início do título
- abertura da descrição
- primeira tag

A palavra-chave não é exposta em um campo separado do JSON — fica implícita no
resultado (título/descrição/tags já a contêm). Não há mudança de UI.

### 2. Título

Mantém as regras já existentes (≤60 caracteres, keyword no início, gancho sem
prometer o que a história não cumpre, sem CAIXA ALTA/spam de pontuação),
reforçando que a keyword usada no título deve ser a mesma frase-chave
primária definida acima.

### 3. Descrição (maior mudança)

Nova estrutura, com alvo de ~200-300 palavras (hoje sem alvo definido, sai bem
mais curta):
- Linha de gancho nos primeiros ~125 caracteres, contendo a keyword primária
  (é a parte visível antes do "mostrar mais")
- 2-3 parágrafos (hoje é só 1) resumindo a história e a lição/moral, repetindo
  a keyword primária ou variações próximas 2-4 vezes ao total, de forma
  natural — sem parecer spam de palavra-chave
- Menção a termos relacionados para ampliar a cobertura semântica (faixa
  etária, formato — ex: "desenho animado infantil", "história bíblica
  infantil")
- Pergunta de engajamento para os comentários (mantém)
- Linha de CTA — curtir, comentar, inscrever, sininho (mantém)
- 6-10 hashtags no final (hoje 6-8), sempre lembrando que o YouTube só mostra
  as 3 primeiras acima do título

### 4. Tags (segunda maior mudança)

Alvo sobe de 15-20 para 25-35 tags, usando até ~480 dos 500 caracteres
permitidos pelo YouTube (hoje o prompt mira em só ~450, mas a contagem baixa
de tags deixa boa parte do espaço sem uso). Composição:
- primeira tag = a keyword primária exata
- variações próximas da keyword
- termos amplos do nicho (já existe `broadTerms` no código, mantém)
- termos de cauda longa (frases como pais/crianças buscam de verdade)
- tags de faixa etária e formato
- para histórias bíblicas: nomes de personagens e do episódio bíblico

Sem repetir a mesma tag em variações inúteis (regra já existente, mantém).

### 5. Comentário fixado

Sem mudança de regra — mantém como está (pergunta curta para fixar,
incentivando resposta de pais/crianças nos comentários).

## Validação

O prompt é não-determinístico (LLM), então não há teste automatizado de CI
verificando o texto exato gerado. A validação é um script pontual (rodado uma
vez antes de considerar a mudança pronta, fora do CI) que gera metadados reais
via `callVertexText` e verifica programaticamente:
- a keyword escolhida (inferida a partir do início do título) aparece também
  no início da descrição e como uma das primeiras tags
- soma de caracteres das tags fica ≤500
- contagem de palavras da descrição cai dentro (ou perto) do alvo de 200-300
- contagem de tags cai dentro do alvo de 25-35

## Fora de escopo

- Palito (`generatePalitoMetadata`) — não é tocado.
- Qualquer mudança de UI na tela de Metadados.
- Pesquisa real de volume de busca/keyword (ex.: API do vidIQ) — a escolha da
  keyword primária é inferida pela própria IA a partir do tema da história,
  não validada contra dados externos de busca.
