import React, { useState } from 'react';
import { Loader2, RefreshCw, ImageIcon, Wand2 } from 'lucide-react';
import { generateImageWithNanoBanana } from '../services/google_image';
import { buildPalitoThumbnailPrompt } from '../services/palitoGemini';

// Espelha exatamente o STYLE_ANCHOR + STYLE_CLOSE de palitoGemini.ts
const STYLE_ANCHOR = `2D doodle cartoon illustration, very thick bold black outlines, clean crisp lines, flat solid colors, high contrast, professional cartoon quality, main character with large circular white head (solid flat white fill, no shading inside), 4-5 thin diagonal spiky hair lines on top, two small black dot eyes, straight thin eyebrows slightly angled down at center, medium gray t-shirt (solid flat #9E9E9E fill, absolutely no shading or gradient inside the shirt), dark gray shorts (solid flat #555555 fill, no shading), mouth shown as simple black open oval with NO colored tongue and NO pink interior, thin arms with solid white circular fists, thin legs with solid white oval feet, small flat oval shadow under feet,`;
const STYLE_CLOSE = `no gradients, no textures, no photorealism, no 3D, no anime style, clean crisp outlines, vibrant flat colors, high contrast composition, 16:9 ratio, educational YouTube doodle channel style. Any text written INSIDE the image (signs, boards, labels, numbers, dates, statistics) MUST be in Brazilian Portuguese.`;

const DEFAULT_SCENE_DESC = `character shocked open mouth, light blue background, large calendar showing "1969" on the wall, rocket ship drawing on a whiteboard`;

const DEFAULT_THUMBNAIL = buildPalitoThumbnailPrompt({
    textRed: 'VOCÊ NÃO',
    textBlack: 'VAI ACREDITAR!',
    object1: 'giant golden FIFA World Cup trophy',
    object2: 'pile of gold coins',
    characterAction: 'pointing at the trophy with one arm extended and jaw dropped open, eyes wide',
});

function ImageCard({ label, prompt, aspectRatio }: { label: string; prompt: string; aspectRatio?: string }) {
    const [currentPrompt, setCurrentPrompt] = useState(prompt);
    const [imageUrl, setImageUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [elapsed, setElapsed] = useState(0);

    const handleGenerate = async () => {
        setLoading(true);
        setError('');
        setImageUrl('');
        const start = Date.now();
        const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
        try {
            const url = await generateImageWithNanoBanana(currentPrompt);
            setImageUrl(url);
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar imagem.');
        } finally {
            clearInterval(timer);
            setElapsed(0);
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wide">{label}</h3>
                {imageUrl && !loading && (
                    <button
                        onClick={handleGenerate}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#333] text-gray-400 rounded text-xs hover:text-white transition-colors"
                    >
                        <RefreshCw className="h-3 w-3" /> Regenerar
                    </button>
                )}
            </div>

            {/* Prompt textarea */}
            <textarea
                value={currentPrompt}
                onChange={e => setCurrentPrompt(e.target.value)}
                rows={5}
                className="w-full bg-[#1a1a1c] border border-border text-gray-400 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />

            {/* Generate button */}
            <button
                onClick={handleGenerate}
                disabled={loading || !currentPrompt.trim()}
                className="flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
                {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando... {elapsed > 0 ? `${elapsed}s` : ''}</>
                    : <><Wand2 className="h-4 w-4" /> Gerar Imagem</>
                }
            </button>

            {error && <p className="text-red-400 text-xs px-1">{error}</p>}

            {/* Image preview */}
            <div className={`bg-[#1a1a1c] border border-border rounded-xl overflow-hidden flex items-center justify-center ${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-video'}`}>
                {imageUrl ? (
                    <img src={imageUrl} alt={label} className="w-full h-full object-contain" />
                ) : loading ? (
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-xs">{elapsed > 0 ? `${elapsed}s...` : 'Iniciando...'}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-600">
                        <ImageIcon className="h-10 w-10" />
                        <p className="text-xs">Clique em Gerar Imagem</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PalitoTestPage() {
    const scenePrompt = `${STYLE_ANCHOR} ${DEFAULT_SCENE_DESC}, ${STYLE_CLOSE}`;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-1">Teste Visual — Palito</h1>
                <p className="text-gray-400 text-sm">Compare o estilo da capa com o estilo das cenas. Edite os prompts livremente e regenere.</p>
            </div>

            {/* Info bar */}
            <div className="bg-[#1a1a1c] border border-border rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Âncoras de estilo ativas nas cenas</p>
                <div className="space-y-1">
                    <p className="text-xs text-gray-500"><span className="text-gray-400 font-mono">STYLE_ANCHOR:</span> {STYLE_ANCHOR.substring(0, 120)}...</p>
                    <p className="text-xs text-gray-500"><span className="text-gray-400 font-mono">STYLE_CLOSE:</span> {STYLE_CLOSE.substring(0, 100)}...</p>
                </div>
            </div>

            {/* Side by side */}
            <div className="grid grid-cols-2 gap-6">
                <ImageCard
                    label="🖼️ Prompt de Capa (Thumbnail)"
                    prompt={DEFAULT_THUMBNAIL}
                    aspectRatio="16:9"
                />
                <ImageCard
                    label="🎬 Prompt de Cena"
                    prompt={scenePrompt}
                    aspectRatio="16:9"
                />
            </div>

            {/* Quick scene variants */}
            <div className="bg-[#242426] border border-border rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Descrições de cena para testar rapidamente</p>
                <div className="flex flex-wrap gap-2">
                    {[
                        `character shocked open mouth, light blue background, large calendar showing "1969" on wall`,
                        `character thinking chin hand, yellow background, blackboard with "R$ 1.000.000" written on it`,
                        `character happy arms up, white background, giant trophy and pile of coins`,
                        `character confused raised eyebrow, green background, sign board reading "Por quê?"`,
                        `character pointing right, orange background, giant human brain with label "Cérebro"`,
                        `character neutral, white background, timeline with dates "1900 → 2000 → 2024"`,
                    ].map((desc, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                const full = `${STYLE_ANCHOR} ${desc}, ${STYLE_CLOSE}`;
                                navigator.clipboard.writeText(full);
                            }}
                            className="text-xs bg-[#1a1a1c] border border-border text-gray-400 rounded px-2 py-1 hover:text-white hover:border-primary transition-colors text-left"
                            title="Clique para copiar o prompt completo"
                        >
                            {desc.substring(0, 55)}...
                        </button>
                    ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">Clique em qualquer variante para copiar o prompt completo → cole no campo de cena acima</p>
            </div>
        </div>
    );
}
