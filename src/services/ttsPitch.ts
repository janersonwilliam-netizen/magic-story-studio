/**
 * ttsPitch.ts — normalização de TOM (pitch/F0) entre blocos de narração.
 *
 * Cada bloco é uma geração stateless do Gemini TTS e escolhe um registro de tom
 * ligeiramente diferente (medido: 188–207 Hz para a MESMA voz). Na emenda isso
 * soa como "a voz mudou". Aqui medimos o F0 de cada bloco e reamostramos os
 * blocos para um alvo comum, igualando o tom.
 *
 * Para as correções típicas (±3–5%) o reamostramento simples é praticamente
 * inaudível em duração/formantes e NÃO gera artefato metálico (ao contrário de
 * um phase vocoder). Correções grandes são LIMITADAS (clamp) para evitar efeito
 * "chipmunk" em casos raros de outlier.
 */

const PCM_SR = 24000;

function pcmToInt16(pcm: Uint8Array): Int16Array {
    return new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
}

/**
 * F0 mediano (Hz) por autocorrelação, considerando só janelas sonoras (com
 * energia acima de um piso). Retorna 0 se não houver fala detectável.
 */
export function medianF0(pcm: Uint8Array, sampleRate: number = PCM_SR): number {
    const s = pcmToInt16(pcm);
    const n = s.length;
    if (n === 0) return 0;

    const win = Math.floor(sampleRate * 0.04); // 40 ms
    const hop = Math.floor(sampleRate * 0.02); // 20 ms
    const minLag = Math.floor(sampleRate / 350); // 350 Hz
    const maxLag = Math.floor(sampleRate / 80);  // 80 Hz
    const f0s: number[] = [];

    for (let start = 0; start + win < n; start += hop) {
        let energy = 0;
        for (let i = 0; i < win; i++) { const v = s[start + i] / 32768; energy += v * v; }
        if (Math.sqrt(energy / win) < 0.02) continue; // pula silêncio/ruído

        let bestLag = 0, best = 0;
        for (let lag = minLag; lag <= maxLag; lag++) {
            let ac = 0;
            for (let i = 0; i < win - lag; i++) ac += (s[start + i] / 32768) * (s[start + i + lag] / 32768);
            if (ac > best) { best = ac; bestLag = lag; }
        }
        if (bestLag > 0) f0s.push(sampleRate / bestLag);
    }

    if (f0s.length === 0) return 0;
    f0s.sort((a, b) => a - b);
    return f0s[Math.floor(f0s.length / 2)];
}

/**
 * Reamostra o PCM para multiplicar o tom por `ratio` (interpolação linear).
 * ratio > 1 sobe o tom (áudio fica proporcionalmente mais curto); < 1 abaixa.
 * A mudança de duração para correções pequenas (±5%) é imperceptível.
 */
export function resamplePitch(pcm: Uint8Array, ratio: number): Uint8Array {
    if (!(ratio > 0) || Math.abs(ratio - 1) < 1e-4) return pcm;
    const s = pcmToInt16(pcm);
    const n = s.length;
    if (n === 0) return pcm;

    const outLen = Math.max(1, Math.floor(n / ratio));
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
        const srcPos = i * ratio;
        const i0 = Math.floor(srcPos);
        const i1 = Math.min(n - 1, i0 + 1);
        const frac = srcPos - i0;
        out[i] = Math.round(s[i0] * (1 - frac) + s[i1] * frac);
    }
    return new Uint8Array(out.buffer, 0, outLen * 2);
}

/**
 * Iguala o tom de vários blocos a um alvo comum (a mediana dos F0 dos blocos).
 * Blocos sem F0 detectável (ex.: quase mudos) ficam inalterados. A correção é
 * limitada a `maxCorrection` (padrão ±8%) para nunca introduzir "chipmunk".
 *
 * @returns blocos reamostrados + diagnóstico (F0 antes, alvo, F0 depois).
 */
export function normalizePitchAcrossChunks(
    chunks: Uint8Array[],
    sampleRate: number = PCM_SR,
    maxCorrection: number = 0.12,
): { chunks: Uint8Array[]; targetF0: number; before: number[]; after: number[] } {
    const before = chunks.map(c => Math.round(medianF0(c, sampleRate)));
    const voiced = before.filter(f => f > 0);

    // Menos de 2 blocos com tom, nada a igualar.
    if (voiced.length < 2) {
        return { chunks, targetF0: voiced[0] || 0, before, after: before.slice() };
    }

    // Alvo = MÉDIA GEOMÉTRICA (centro no domínio de log/oitavas). Mirar no centro
    // divide a correção entre os blocos (cada um se move ~metade do drift), em vez
    // de jogar toda a correção num só bloco (o que estouraria o clamp). Ex.: blocos
    // a 185 e 224 Hz → alvo ~204, cada um se move ~10% (cabe no clamp) e os dois
    // encontram no meio, fechando o degrau.
    const geoMean = Math.exp(voiced.reduce((sum, f) => sum + Math.log(f), 0) / voiced.length);
    const targetF0 = Math.round(geoMean);

    const lo = 1 - maxCorrection, hi = 1 + maxCorrection;
    const outChunks = chunks.map((chunk, i) => {
        const f0 = before[i];
        if (f0 <= 0) return chunk;
        const ratio = Math.min(hi, Math.max(lo, targetF0 / f0));
        return resamplePitch(chunk, ratio);
    });

    const after = outChunks.map(c => Math.round(medianF0(c, sampleRate)));
    return { chunks: outChunks, targetF0, before, after };
}
