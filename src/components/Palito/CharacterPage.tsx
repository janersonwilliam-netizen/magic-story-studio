import React, { useState } from 'react';
import { User, Users, Loader2, RefreshCw, ArrowRight, ArrowLeft, CheckCircle, Sparkles, ImageIcon } from 'lucide-react';
import { generateImageWithNanoBanana } from '../../services/google_image';
import { extractStoryCharacters } from '../../services/palitoGemini';
import { StoryCharacter } from '../../types/palito';

const NARRATOR_PROMPT = `Hand-drawn 2D doodle animation style, flat colors, thick black outlines, slightly imperfect marker lines. Character in neutral standing pose, centered, pure white background (#FFFFFF). Large circular head filled white, thick black outline. Hair: 4 to 5 short thin diagonal lines at top of head, slightly spiky, hand-drawn style. Eyes: two small black dots, positioned center-lower area of the head. Eyebrows: two short straight thin lines slightly angled down toward center. Mouth: straight line (neutral expression). Medium gray t-shirt (#9E9E9E), round collar, short sleeves. Dark gray shorts (#555555). Arms: thin black lines from shoulders, small circular white fists with black outline. Legs: thin black lines, small slightly flat oval white feet with black outline. Light gray flattened oval shadow beneath feet. No shading, no gradient, no textures, no photorealism, no 3D, no anime style, 1:1 ratio, pure white background, educational YouTube doodle channel style.`;

const STORY_CHAR_STYLE = `Hand-drawn 2D doodle animation style, flat colors, thick black outlines, slightly imperfect marker lines. Character in neutral standing pose, centered, pure white background. No shading, no gradient, no textures, no photorealism, no 3D, no anime style, 1:1 ratio, pure white background, educational YouTube doodle channel style.`;

interface CharacterPageProps {
    title: string;
    script: string;
    existingNarratorUrl?: string;
    existingStoryCharacters?: StoryCharacter[];
    onComplete: (narratorUrl: string, storyCharacters: StoryCharacter[]) => void;
    onBack: () => void;
}

export function CharacterPage({
    title,
    script,
    existingNarratorUrl,
    existingStoryCharacters,
    onComplete,
    onBack,
}: CharacterPageProps) {
    const [narratorUrl, setNarratorUrl] = useState(existingNarratorUrl || '');
    const [narratorLoading, setNarratorLoading] = useState(false);

    const [storyChars, setStoryChars] = useState<StoryCharacter[]>(existingStoryCharacters || []);
    const [extracting, setExtracting] = useState(false);
    const [generatingIdx, setGeneratingIdx] = useState<number | null>(null);
    const [error, setError] = useState('');

    const handleGenerateNarrator = async () => {
        setNarratorLoading(true);
        setError('');
        try {
            const url = await generateImageWithNanoBanana(NARRATOR_PROMPT);
            setNarratorUrl(url);
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar narrador.');
        } finally {
            setNarratorLoading(false);
        }
    };

    const handleExtractCharacters = async () => {
        setExtracting(true);
        setError('');
        try {
            const chars = await extractStoryCharacters(title, script);
            setStoryChars(chars.map(c => ({ ...c, imageUrl: undefined })));
        } catch (e: any) {
            setError(e.message || 'Erro ao identificar personagens.');
        } finally {
            setExtracting(false);
        }
    };

    const handleGenerateCharImage = async (idx: number) => {
        setGeneratingIdx(idx);
        setError('');
        try {
            const char = storyChars[idx];
            const prompt = `${char.description}, ${STORY_CHAR_STYLE}`;
            const url = await generateImageWithNanoBanana(prompt);
            setStoryChars(prev => prev.map((c, i) => i === idx ? { ...c, imageUrl: url } : c));
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar imagem.');
        } finally {
            setGeneratingIdx(null);
        }
    };

    const canAdvance = !!narratorUrl;

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Personagens</h2>
                <p className="text-gray-400 text-sm">Gere o narrador fixo e os personagens da história para usar como referência nas cenas.</p>
            </div>

            {/* ── NARRADOR ── */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-semibold text-white">Narrador (Boneco Palito)</h3>
                    <span className="text-xs text-gray-500 bg-[#242426] px-2 py-0.5 rounded-full">fixo em todas as cenas</span>
                </div>

                <div className="bg-[#242426] border border-border rounded-xl p-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-400">
                    <span>Cabeça circular grande, branca</span>
                    <span>Cabelo: 4–5 riscos espetados</span>
                    <span>Olhos: 2 pontos pretos</span>
                    <span>Camiseta cinza médio #9E9E9E</span>
                    <span>Shorts cinza escuro #555555</span>
                    <span>Sombra oval achatada no chão</span>
                </div>

                <div className="flex gap-3 items-start">
                    <button
                        onClick={handleGenerateNarrator}
                        disabled={narratorLoading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        {narratorLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : narratorUrl ? <RefreshCw className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        {narratorLoading ? 'Gerando...' : narratorUrl ? 'Regenerar Narrador' : 'Gerar Narrador'}
                    </button>

                    {narratorUrl && !narratorLoading && (
                        <div className="relative rounded-xl overflow-hidden bg-[#1a1a1c] border border-border w-20 h-20 shrink-0">
                            <img src={narratorUrl} alt="Narrador" className="w-full h-full object-contain p-1" />
                            <div className="absolute top-1 right-1 bg-green-600 rounded-full p-0.5">
                                <CheckCircle className="h-3 w-3 text-white" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-border" />

            {/* ── PERSONAGENS DA HISTÓRIA ── */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <h3 className="text-base font-semibold text-white">Personagens da História</h3>
                        <span className="text-xs text-gray-500 bg-[#242426] px-2 py-0.5 rounded-full">máx. 3</span>
                    </div>
                    <button
                        onClick={handleExtractCharacters}
                        disabled={extracting || !script}
                        className="flex items-center gap-2 px-4 py-2 bg-[#242426] border border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary/10 disabled:opacity-50 transition-colors"
                    >
                        {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {extracting ? 'Identificando...' : storyChars.length > 0 ? 'Reanalisar Roteiro' : 'Identificar Personagens'}
                    </button>
                </div>

                {storyChars.length === 0 && !extracting && (
                    <div className="bg-[#1a1a1c] border border-dashed border-border rounded-xl p-6 text-center">
                        <Users className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">Clique em "Identificar Personagens" para analisar o roteiro e extrair os personagens da história.</p>
                    </div>
                )}

                {storyChars.length > 0 && (
                    <div className="space-y-3">
                        {storyChars.map((char, idx) => (
                            <div key={idx} className="bg-[#242426] border border-border rounded-xl p-4 flex gap-4 items-start">
                                {/* Image */}
                                <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-[#1a1a1c] border border-border flex items-center justify-center">
                                    {char.imageUrl ? (
                                        <img src={char.imageUrl} alt={char.name} className="w-full h-full object-contain p-1" />
                                    ) : generatingIdx === idx ? (
                                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                                    ) : (
                                        <ImageIcon className="h-6 w-6 text-gray-600" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 space-y-2">
                                    <p className="text-white font-semibold text-sm">{char.name}</p>
                                    <p className="text-gray-400 text-xs leading-relaxed">{char.description}</p>
                                    <button
                                        onClick={() => handleGenerateCharImage(idx)}
                                        disabled={generatingIdx !== null}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1c] border border-border text-gray-300 rounded-lg text-xs hover:text-white hover:border-primary disabled:opacity-50 transition-colors"
                                    >
                                        {generatingIdx === idx
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : char.imageUrl ? <RefreshCw className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                                        {char.imageUrl ? 'Regenerar' : 'Gerar Imagem'}
                                    </button>
                                </div>

                                {char.imageUrl && (
                                    <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-1" />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex justify-between pt-2">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                    onClick={() => onComplete(narratorUrl, storyChars)}
                    disabled={!canAdvance}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    Avançar <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
