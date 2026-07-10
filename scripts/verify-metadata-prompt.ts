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
