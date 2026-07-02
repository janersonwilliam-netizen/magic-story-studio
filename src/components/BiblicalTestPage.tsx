import React, { useState } from 'react';
import { Loader2, RefreshCw, ImageIcon, Wand2 } from 'lucide-react';
import { generateImageWithNanoBanana } from '../services/google_image';
import { IMAGE_STYLE_2D } from '../lib/imageStyle';

// Mesmo vocabulário de estilo usado pela capa (ThumbnailPage.tsx) e pelas cenas
// (ImagesPage.tsx / gemini.ts) em produção — ver src/lib/imageStyle.ts.
const STYLE_2D = IMAGE_STYLE_2D;
const NO_TEXT_NEGATIVE = `ABSOLUTELY NO text, no letters, no words, no captions, no subtitles, no speech bubbles, no dialogue text, no writing, no numbers, no signature, no watermark and no logos anywhere in the image. The illustration must be 100% visual with zero typography.`;

const DEFAULT_TITLE = 'Davi e Golias';

const DEFAULT_TITLE_BRIEF = `TITLE DESIGN: Spell exactly "${DEFAULT_TITLE}" in Portuguese. Use one main title only; no subtitles, no second-language translation, no random standalone letters, no misspellings, no watermark. The title must feel like a custom family movie logo, not a generic font: oversized chunky rounded hand-lettered words occupying the top 25-35% of the poster, playful irregular baseline, cinematic bevels, soft shadow, glossy highlights, readable from far away. Golden storybook details, thematic materials matching a biblical story. Premium 2D cartoon title lettering.`;

const DEFAULT_THUMBNAIL = `TITULO: ${DEFAULT_TITLE}
CENA: Movie Poster Layout. ${STYLE_2D}. ${DEFAULT_TITLE_BRIEF} Magical atmosphere, widescreen 16:9 cinematic poster.
SCENE: A unique poster moment inspired by the story premise: young shepherd boy David standing in a green valley holding a wooden sling, facing the massive armored giant Goliath in the distance across a dry riverbed, dust rising, Israelite army watching from a hillside, golden late afternoon light.
PERSONAGEM: Character: young shepherd boy, curly brown hair, simple tan tunic robe, red sash belt, leather sandals, holding a wooden sling, brave determined expression. Posing dynamically and naturally integrated with the title logo, not standing stiffly under generic text.
EMOÇÃO: Happy, Excited, Adventurous.`;

const DEFAULT_SCENE_DESC = `David kneeling by a calm stream picking five smooth stones and placing them in his leather pouch, green hills and olive trees in the background, warm morning sunlight, peaceful determined expression on his face`;

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

export default function BiblicalTestPage() {
    const scenePrompt = `${DEFAULT_SCENE_DESC}. ${STYLE_2D}. ${NO_TEXT_NEGATIVE}`;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-1">Teste Visual — Histórias Bíblicas</h1>
                <p className="text-gray-400 text-sm">Compare o estilo da capa com o estilo das cenas (Estilo 2D Cartoon). Edite os prompts livremente e regenere.</p>
            </div>

            {/* Info bar */}
            <div className="bg-[#1a1a1c] border border-border rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Estilo ativo nas cenas (produção — tema Bíblica)</p>
                <div className="space-y-1">
                    <p className="text-xs text-gray-500"><span className="text-gray-400 font-mono">STYLE (2D Cartoon):</span> {STYLE_2D.substring(0, 160)}...</p>
                    <p className="text-xs text-gray-500"><span className="text-gray-400 font-mono">NO_TEXT_NEGATIVE:</span> {NO_TEXT_NEGATIVE.substring(0, 100)}...</p>
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
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Descrições de cena bíblicas para testar rapidamente</p>
                <div className="flex flex-wrap gap-2">
                    {[
                        `giant wooden ark under construction on dry land, Noah hammering planks, pairs of animals lining up nearby, cloudy gray sky hinting at coming rain`,
                        `Jonah being swallowed by an enormous whale in a stormy dark blue sea, giant waves, small wooden ship in the background`,
                        `Daniel kneeling calmly in prayer inside a stone den, several large lions resting peacefully around him, warm shaft of light from above`,
                        `Moses raising his wooden staff as the Red Sea splits into two towering walls of water, Israelites crossing on dry ground between them`,
                        `young Samuel sleeping in the quiet dark temple, waking up as a soft glowing light appears near the altar`,
                        `Jesus calming a violent storm on a wooden fishing boat, disciples frightened, dark clouds parting to reveal bright sunlight`,
                    ].map((desc, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                const full = `${desc}. ${STYLE_2D}. ${NO_TEXT_NEGATIVE}`;
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
