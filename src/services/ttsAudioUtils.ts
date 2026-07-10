/**
 * ttsAudioUtils.ts — helpers puros de pós-processamento do áudio TTS.
 *
 * O Gemini TTS degrada em textos longos: em vez de retornar erro, ele fala só
 * parte do transcript e preenche o resto com áudio quase mudo até o limite de
 * tokens de saída (~10 min). Estes helpers detectam e cortam essa cauda de
 * silêncio e permitem validar se a fala gerada é plausível para o texto.
 */

/** RMS por frame abaixo disso (~-48 dBFS) é considerado silêncio/ruído de fundo. */
const SILENCE_RMS_THRESHOLD = 0.004;

/**
 * Corta a cauda de silêncio de um buffer PCM16 mono, mantendo `keepMs` de
 * respiro após a última fala. Se não houver fala alguma, retorna um buffer
 * mínimo (só o respiro) — o chamador decide se isso é falha.
 */
export function trimTrailingSilence(pcm: Uint8Array, sampleRate: number = 24000, keepMs: number = 400): Uint8Array {
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
    const n = samples.length;
    if (n === 0) return pcm;

    const frame = Math.max(1, Math.floor(sampleRate * 0.02)); // 20ms
    let lastSpeechEnd = 0;

    for (let start = n - (n % frame || frame); start >= 0; start -= frame) {
        const end = Math.min(n, start + frame);
        let sq = 0;
        for (let i = start; i < end; i++) {
            const s = samples[i] / 32768;
            sq += s * s;
        }
        if (end > start && Math.sqrt(sq / (end - start)) > SILENCE_RMS_THRESHOLD) {
            lastSpeechEnd = end;
            break;
        }
    }

    const keepSamples = Math.floor((sampleRate * keepMs) / 1000);
    const endSample = Math.min(n, lastSpeechEnd + keepSamples);
    if (endSample >= n) return pcm;
    return pcm.subarray(0, endSample * 2);
}

export function pcmDurationSeconds(pcm: Uint8Array, sampleRate: number = 24000): number {
    return pcm.byteLength / 2 / sampleRate;
}

/**
 * Duração mínima plausível (segundos) da fala para um texto. Usa 220 palavras
 * por minuto (mais rápido que qualquer narração real) com folga de 50% — só
 * dispara em degradação grosseira (metade ou mais do texto sem fala), nunca em
 * narração legitimamente rápida.
 */
export function minPlausibleSpeechSeconds(text: string): number {
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
    return (words / 220) * 60 * 0.5;
}

/**
 * Versão RÍGIDA para a passada única da história inteira. A degradação típica
 * do Gemini em texto longo fala ~metade/⅔ do roteiro e emudece — o limiar
 * frouxo acima não pega (ex.: incidente real com 690 palavras: falou 164s e o
 * limiar era 94s). Aqui: 185 wpm é o teto de leitura do nosso prompt de ritmo;
 * exigimos 75% disso. 690 palavras → mínimo ~168s (o incidente dispararia).
 * Leituras legítimas (~135–185 wpm → 224s+ nesse exemplo) passam com folga.
 */
export function minPlausibleSinglePassSeconds(text: string): number {
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
    return (words / 185) * 60 * 0.75;
}
