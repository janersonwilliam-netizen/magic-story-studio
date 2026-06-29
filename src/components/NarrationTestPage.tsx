import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, Download, Trash2, Volume2, Sparkles } from 'lucide-react';
import { generateLongAudioNarration, GEMINI_VOICES, GenerateAudioParams } from '../services/tts';

/**
 * NarrationTestPage — página isolada para TESTAR o áudio da narração.
 *
 * Chama exatamente o mesmo caminho do áudio completo da narração
 * (`generateLongAudioNarration`), então o que se ouve aqui é o que sai no app.
 * Permite variar voz, emoção e TAMANHO DO BLOCO (a alavanca das "duas vozes":
 * blocos maiores = menos emendas, com leve risco de variação de volume) e
 * comparar várias versões lado a lado (A/B) sem mexer em nenhuma história real.
 */

const SAMPLE_STORY = `Olá, pessoal! Hoje eu vou contar uma historinha muito especial para vocês. Então acomode-se, pegue seu cobertor favorito e venha comigo nesta aventura.

Era uma vez, no alto de uma montanha coberta de neve, uma pequena raposa de pelo alaranjado chamada Tato. Tato era curiosa como ninguém: queria saber o que havia além do último pinheiro, depois do último morro, atrás da última nuvem. Mas havia um problema. Tato tinha muito medo do escuro, e a floresta lá embaixo ficava escura bem cedo.

Todas as tardes, quando o sol começava a se esconder, Tato corria de volta para a toca e se enrolava bem apertadinho, tremendo. "Um dia eu vou ser corajoso", ele sussurrava para si mesmo. Mas o dia seguinte chegava, e o medo continuava ali, do tamanho de um urso.

Numa noite, Tato ouviu um chorinho fininho vindo da beira do riacho. Era um vaga-lume chamado Lumi, com a luzinha quase apagada, perdido e com frio. "Eu não consigo achar o caminho de casa", disse Lumi. "Está escuro demais." Tato sentiu o coração apertar. Ele também tinha medo do escuro. Mas o medo do amiguinho parecia maior que o dele.

Então Tato respirou fundo, levantou as orelhas e disse: "Eu te ajudo. Sobe nas minhas costas." E, passo a passo, com o coração batendo forte, a raposinha desceu a trilha escura. A cada árvore, Lumi acendia um pouquinho mais a sua luz, e juntos eles iam iluminando o caminho. Onde Tato colocava coragem, Lumi colocava brilho.

Quando finalmente chegaram ao carvalho onde morava a família de vaga-lumes, centenas de luzinhas se acenderam de uma vez, e a floresta inteira ficou dourada. Tato olhou em volta, espantado. O escuro que ele tanto temia estava cheio de amigos, de luz e de vida. Não era um lugar de medo: era um lugar de descobertas.

A partir daquela noite, Tato nunca mais correu de volta para a toca com medo. Ele aprendeu que coragem não é deixar de sentir medo, e sim fazer o que precisa ser feito mesmo sentindo. E que, muitas vezes, a melhor forma de espantar o nosso próprio escuro é ajudar alguém a encontrar a luz dele.

E assim, a pequena raposa que tinha medo da noite virou a guardiã mais querida da floresta, sempre pronta para acender uma esperança onde houvesse escuridão.

Se você gostou dessa história, já sabe: deixe o seu like, se inscreva no canal e ative o sininho para não perder as próximas aventuras. Até a próxima, pessoal!`;

const EMOTION_OPTIONS: { value: NonNullable<GenerateAudioParams['emotion']>; label: string }[] = [
    { value: 'warmly', label: 'Caloroso / acolhedor' },
    { value: 'cheerfully', label: 'Alegre / descontraído' },
    { value: 'calmly', label: 'Calmo / sereno' },
    { value: 'excitedly', label: 'Animado / empolgado' },
    { value: 'mysteriously', label: 'Misterioso / enigmático' },
    { value: 'sadly', label: 'Sensível / emotivo' },
    { value: 'dramatically', label: 'Dramático / intenso' },
    { value: 'heroically', label: 'Épico / heroico' },
    { value: 'storyteller', label: 'Narrativo / contação' },
    { value: 'playfully', label: 'Divertido / brincalhão' },
    { value: 'suspenseful', label: 'Suspense / tenso' },
    { value: 'authoritative', label: 'Confiante / locutor' },
];

interface LoudnessAnalysis {
    barsDb: number[];   // RMS por janela de ~0,5s, em dBFS
    spreadDb: number;   // diferença entre o trecho mais alto e o mais baixo (só fala)
    rmsDb: number;      // RMS global
    peakDb: number;     // pico global
}

/**
 * Mede o perfil de volume do WAV gerado (data URL): RMS por janela de ~0,5s.
 * É a "prova" visual — se o áudio estiver padronizado, as barras ficam todas na
 * mesma altura e a variação (spread) fica baixa.
 */
function analyzeLoudness(dataUrl: string, sampleRate = 24000, windowSec = 0.5): LoudnessAnalysis {
    const base64 = dataUrl.split(',')[1] || '';
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // pula o cabeçalho WAV de 44 bytes → PCM16
    const pcm = new Int16Array(bytes.buffer, 44, Math.floor((bytes.length - 44) / 2));
    const n = pcm.length;
    const toDb = (x: number) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -99);

    const win = Math.max(1, Math.floor(sampleRate * windowSec));
    const barsDb: number[] = [];
    let globalSq = 0;
    let peak = 0;
    for (let start = 0; start < n; start += win) {
        const end = Math.min(n, start + win);
        let sq = 0;
        for (let i = start; i < end; i++) {
            const s = pcm[i] / 32768;
            sq += s * s;
            globalSq += s * s;
            const a = Math.abs(s);
            if (a > peak) peak = a;
        }
        barsDb.push(toDb(Math.sqrt(sq / Math.max(1, end - start))));
    }
    // spread só sobre os trechos de FALA (acima de -45 dB) — ignora silêncio inicial/final
    const speech = barsDb.filter((d) => d > -45);
    const spreadDb = speech.length ? Math.round((Math.max(...speech) - Math.min(...speech)) * 10) / 10 : 0;
    return {
        barsDb,
        spreadDb,
        rmsDb: toDb(Math.sqrt(globalSq / Math.max(1, n))),
        peakDb: toDb(peak),
    };
}

interface ResultItem {
    id: number;
    url: string;
    label: string;
    chars: number;
    estChunks: number;
    voice: string;
    emotion: string;
    chunkSize: number;
    leveling: boolean;
    genSeconds: number;
    analysis: LoudnessAnalysis;
}

let resultCounter = 0;

export default function NarrationTestPage() {
    const [story, setStory] = useState(SAMPLE_STORY);
    const [voiceName, setVoiceName] = useState('Kore');
    const [emotion, setEmotion] = useState<NonNullable<GenerateAudioParams['emotion']>>('warmly');
    const [chunkSize, setChunkSize] = useState(900);
    const [leveling, setLeveling] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<ResultItem[]>([]);

    const chars = story.trim().length;
    const estChunks = Math.max(1, Math.ceil(chars / chunkSize));
    const singleVoice = estChunks === 1; // 1 bloco = 1 chamada = 1 voz só (sem emendas)

    const voices = useMemo(
        () => Object.entries(GEMINI_VOICES).map(([id, meta]) => ({ id, ...meta })),
        []
    );

    const handleGenerate = async () => {
        if (!story.trim()) {
            setError('Cole uma história para testar.');
            return;
        }
        setError('');
        setIsGenerating(true);
        const startedAt = performance.now();
        try {
            const url = await generateLongAudioNarration({
                text: story.replace(/\\n/g, '\n'),
                voiceName,
                emotion,
                maxChunkChars: chunkSize,
                disableLeveling: !leveling,
            });
            const genSeconds = Math.round((performance.now() - startedAt) / 100) / 10;
            const analysis = analyzeLoudness(url);
            const item: ResultItem = {
                id: ++resultCounter,
                url,
                label: `${voiceName} · ${chunkSize} chars · ${leveling ? 'NIVELADO' : 'CRU'}`,
                chars,
                estChunks,
                voice: voiceName,
                emotion,
                chunkSize,
                leveling,
                genSeconds,
                analysis,
            };
            setResults((prev) => [item, ...prev]);
        } catch (err: any) {
            setError(err?.message || 'Falha ao gerar o áudio.');
        } finally {
            setIsGenerating(false);
        }
    };

    const removeResult = (id: number) => setResults((prev) => prev.filter((r) => r.id !== id));

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
                <Volume2 className="h-7 w-7 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Geração de Áudio</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
                Gera o áudio com alta qualidade e estabilidade. Escolha a voz, o tom de narração e compare diferentes versões com gráfico de volume em tempo real.
            </p>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                {/* História */}
                <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">
                        História ({chars} caracteres · ~{estChunks} bloco{estChunks > 1 ? 's' : ''})
                    </label>
                    <textarea
                        value={story}
                        onChange={(e) => setStory(e.target.value)}
                        rows={10}
                        className="w-full rounded-xl bg-background border border-border p-3 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                {/* Controles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5">Voz</label>
                        <select
                            value={voiceName}
                            onChange={(e) => setVoiceName(e.target.value)}
                            className="w-full rounded-xl bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            {voices.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.label} ({v.gender === 'female' ? 'F' : 'M'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5">Emoção / tom</label>
                        <select
                            value={emotion}
                            onChange={(e) => setEmotion(e.target.value as any)}
                            className="w-full rounded-xl bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            {EMOTION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5">
                            Tamanho do bloco: {chunkSize} chars
                        </label>
                        <input
                            type="range"
                            min={800}
                            max={8000}
                            step={100}
                            value={chunkSize}
                            onChange={(e) => setChunkSize(Number(e.target.value))}
                            className="w-full accent-primary"
                        />
                        <div className="text-[11px] mt-1">
                            {singleVoice ? (
                                <span className="text-green-400 font-semibold">✓ 1 bloco = 1 voz só (sem emendas)</span>
                            ) : (
                                <span className="text-yellow-400 font-semibold">⚠ {estChunks} blocos = {estChunks} vozes (emendas). Suba o bloco para caber tudo em 1.</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Toggle nivelamento */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={leveling}
                        onChange={(e) => setLeveling(e.target.checked)}
                        className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm text-foreground">
                        <strong>Nivelar volume</strong> (corrige sussurros/oscilação).
                        <span className="text-muted-foreground"> Desligue para ouvir o áudio CRU do Gemini e comparar.</span>
                    </span>
                </label>

                {error && (
                    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
                        {error}
                    </div>
                )}

                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold rounded-xl py-3 disabled:opacity-60 transition-colors"
                >
                    {isGenerating ? (
                        <><Loader2 className="h-5 w-5 animate-spin" /> Gerando áudio…</>
                    ) : (
                        <><Sparkles className="h-5 w-5" /> Gerar áudio</>
                    )}
                </motion.button>
            </div>

            {/* Resultados */}
            {results.length > 0 && (
                <div className="mt-6 space-y-3">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Play className="h-5 w-5 text-primary" /> Versões geradas ({results.length})
                    </h2>
                    {results.map((r) => (
                        <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">#{r.id} · {r.label}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {r.emotion} · {r.chars} chars · gerado em {r.genSeconds}s · pico {r.analysis.peakDb} dBFS
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={r.url}
                                        download={`teste-narracao-${r.id}-${r.voice}-${r.chunkSize}-${r.leveling ? 'nivelado' : 'cru'}.wav`}
                                        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                        title="Baixar WAV"
                                    >
                                        <Download className="h-4 w-4" />
                                    </a>
                                    <button
                                        onClick={() => removeResult(r.id)}
                                        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-red-400 transition-colors"
                                        title="Remover"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Gráfico de volume (RMS por ~0,5s) — a prova visual de uniformidade */}
                            <div className="mb-2">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] text-muted-foreground">Volume ao longo do tempo (cada barra ≈ 0,5s)</span>
                                    <span className={`text-[11px] font-semibold ${r.analysis.spreadDb <= 4 ? 'text-green-400' : r.analysis.spreadDb <= 8 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        variação: {r.analysis.spreadDb} dB {r.analysis.spreadDb <= 4 ? '✓ uniforme' : '⚠ oscilando'}
                                    </span>
                                </div>
                                <div className="flex items-end gap-px h-16 bg-background rounded-lg p-1.5 overflow-hidden">
                                    {r.analysis.barsDb.map((db, idx) => {
                                        // mapeia -50..0 dBFS → 0..100% de altura
                                        const h = Math.max(2, Math.min(100, ((db + 50) / 50) * 100));
                                        const quiet = db > -45 && db < -26; // trecho suspeito de sussurro
                                        return (
                                            <div
                                                key={idx}
                                                className={`flex-1 min-w-[1px] rounded-sm ${db <= -45 ? 'bg-gray-700' : quiet ? 'bg-red-500' : 'bg-primary'}`}
                                                style={{ height: `${h}%` }}
                                                title={`${(idx * 0.5).toFixed(1)}s: ${db} dBFS`}
                                            />
                                        );
                                    })}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                    barras <span className="text-primary">azuis</span> = fala normal · <span className="text-red-400">vermelhas</span> = baixo demais (sussurro) · cinza = silêncio/pausa
                                </div>
                            </div>

                            <audio controls src={r.url} className="w-full" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
