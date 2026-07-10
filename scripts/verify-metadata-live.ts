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
// NOTA: este patch roda DEPOIS do import abaixo ser resolvido (imports do ES
// module hoisteiam para o topo do arquivo em tempo de execução) — mas funciona
// porque `callVertexText` (dentro de gemini.ts) resolve `fetch` dinamicamente
// no MOMENTO da chamada, não guarda uma referência no import. Se um refactor
// futuro capturar `const f = fetch` no escopo do módulo em gemini.ts, este
// patch pararia de funcionar silenciosamente — vale checar aqui primeiro se
// este script parar de redirecionar para localhost:8788.
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
