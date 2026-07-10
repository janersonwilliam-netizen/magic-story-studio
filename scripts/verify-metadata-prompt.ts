/**
 * Verifica ESTRUTURALMENTE o prompt de metadados (sem chamar a API): confirma
 * que as regras novas do design de SEO/vidIQ (palavra-chave primária, alvo de
 * tamanho da descrição, alvo de contagem/orçamento de tags) estão presentes no
 * texto do prompt, e que a interpolação de título/roteiro/tema continua correta.
 *
 * Rodar: npx tsx scripts/verify-metadata-prompt.ts
 */
import { buildStoryMetadataPrompt, trimTagsToCharBudget } from '../src/services/gemini';

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
check('cita o limite técnico de 500', classica.includes('nunca ultrapasse 500'));

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

console.log('7) trimTagsToCharBudget corta do fim até caber no orçamento de caracteres');
{
    const manyTags = Array.from({ length: 30 }, (_, i) => `palavra-chave numero ${i} bem longa e especifica`);
    const joinedBefore = manyTags.join(', ').length;
    check('reproduz o cenário do incidente: lista original excede 500 chars', joinedBefore > 500, `tamanho original: ${joinedBefore}`);

    const trimmed = trimTagsToCharBudget(manyTags, 500);
    check('resultado fica dentro do orçamento', trimmed.join(', ').length <= 500, `tamanho após corte: ${trimmed.join(', ').length}`);
    check('não adicionou tags', trimmed.length <= manyTags.length);
    check('manteve pelo menos 1 tag', trimmed.length >= 1);

    const isPrefix = trimmed.every((tag, i) => tag === manyTags[i]);
    check('preservou a ORDEM/PRIORIDADE original (cortou só do fim)', isPrefix,
        `trimmed: ${JSON.stringify(trimmed)}`);
}

console.log('8) trimTagsToCharBudget não mexe em listas já dentro do orçamento');
{
    const shortTags = ['coelhinho corajoso', 'historia infantil', 'contos para crianças'];
    const result = trimTagsToCharBudget(shortTags, 500);
    check('lista curta sai inalterada', JSON.stringify(result) === JSON.stringify(shortTags));
}

console.log('9) trimTagsToCharBudget nunca esvazia a lista, mesmo com 1 tag gigante');
{
    const oneHugeTag = ['x'.repeat(600)];
    const result = trimTagsToCharBudget(oneHugeTag, 500);
    check('mantém a única tag mesmo excedendo o limite sozinha', result.length === 1);
    check('trunca o texto da tag para caber no orçamento (garantia nunca-excede vale sempre)', result[0].length === 500);
    check('resultado fica dentro do orçamento mesmo neste caso extremo', result.join(', ').length <= 500);
}

console.log('10) trimTagsToCharBudget com lista vazia não quebra');
{
    const result = trimTagsToCharBudget([], 500);
    check('lista vazia retorna lista vazia', result.length === 0);
}

console.log(failures === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
