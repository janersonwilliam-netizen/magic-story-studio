/**
 * audioAlign.ts
 * Aligns Gemini transcription timestamps to real voice activity in the audio.
 * Uses Web Audio API to detect when speech actually starts.
 */

function tsToSeconds(ts: string): number {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function secondsToTs(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Detects voice activity start times in an audio buffer.
 * Returns an array of seconds where speech begins (after silence gaps).
 */
function detectVoiceSegments(audioBuffer: AudioBuffer): number[] {
    const sampleRate = audioBuffer.sampleRate;
    // Mix all channels to mono
    const mono = new Float32Array(audioBuffer.length);
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const ch = audioBuffer.getChannelData(c);
        for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / audioBuffer.numberOfChannels;
    }

    const windowMs = 20; // 20ms analysis window
    const windowSize = Math.floor((windowMs / 1000) * sampleRate);
    const rmsThreshold = 0.012; // speech energy threshold
    const minSilenceMs = 200; // min silence gap to start a new segment
    const minSilenceSamples = Math.floor((minSilenceMs / 1000) * sampleRate);

    const segments: number[] = [];
    let inSpeech = false;
    let silenceCount = 0;
    let segmentStart = 0;

    for (let i = 0; i < mono.length; i += windowSize) {
        const end = Math.min(i + windowSize, mono.length);
        let sum = 0;
        for (let j = i; j < end; j++) sum += mono[j] * mono[j];
        const rms = Math.sqrt(sum / (end - i));

        if (rms >= rmsThreshold) {
            if (!inSpeech) {
                segmentStart = i / sampleRate;
                inSpeech = true;
                segments.push(segmentStart);
            }
            silenceCount = 0;
        } else if (inSpeech) {
            silenceCount += windowSize;
            if (silenceCount >= minSilenceSamples) {
                inSpeech = false;
                silenceCount = 0;
            }
        }
    }

    return segments;
}

/**
 * For each transcription line, finds the closest real voice segment start
 * within a search window of the Gemini-estimated timestamp.
 * If no real segment is found nearby, keeps the Gemini timestamp.
 */
function alignLinesToSegments(
    lines: Array<{ timestamp: string; text: string }>,
    segments: number[],
): Array<{ timestamp: string; text: string }> {
    // Search window: look this many seconds before/after Gemini's estimate
    const SEARCH_WINDOW = 3.0;

    return lines.map((line) => {
        const geminiTime = tsToSeconds(line.timestamp);
        let bestTime = geminiTime;
        let bestDiff = Infinity;

        for (const seg of segments) {
            // Prefer segments that are slightly BEFORE Gemini's estimate (earlier = better)
            const diff = Math.abs(seg - geminiTime);
            if (diff <= SEARCH_WINDOW && diff < bestDiff) {
                bestDiff = diff;
                bestTime = seg;
            }
        }

        return { ...line, timestamp: secondsToTs(bestTime) };
    });
}

/**
 * Main function: aligns a Gemini transcription to real audio timing.
 * Returns corrected transcription, or original if alignment fails.
 */
export async function alignTranscriptionToAudio(
    audioUrl: string,
    lines: Array<{ timestamp: string; text: string }>,
    onProgress?: (msg: string) => void,
): Promise<Array<{ timestamp: string; text: string }>> {
    try {
        onProgress?.('Baixando áudio para calibração...');
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error('Não foi possível baixar o áudio');
        const arrayBuffer = await response.arrayBuffer();

        onProgress?.('Analisando voz no áudio...');
        const ctx = new AudioContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0)); // slice to avoid detached buffer
        await ctx.close();

        const segments = detectVoiceSegments(audioBuffer);
        if (segments.length < 3) {
            // Not enough segments detected — return original
            return lines;
        }

        onProgress?.(`${segments.length} segmentos de voz detectados. Alinhando...`);
        const aligned = alignLinesToSegments(lines, segments);
        return aligned;
    } catch (e) {
        console.warn('[audioAlign] Falhou, usando timestamps originais:', e);
        return lines;
    }
}
