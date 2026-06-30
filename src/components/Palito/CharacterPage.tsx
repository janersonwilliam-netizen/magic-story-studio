import React, { useState } from 'react';
import { User, Users, Loader2, RefreshCw, ArrowRight, ArrowLeft, CheckCircle, Sparkles, ImageIcon } from 'lucide-react';
import { generateImageWithNanoBanana } from '../../services/google_image';
import { extractStoryCharacters } from '../../services/palitoGemini';
import { StoryCharacter } from '../../types/palito';

const STORY_CHAR_STYLE = `Hand-drawn 2D doodle animation style, flat colors, thick black outlines, slightly imperfect marker lines. Character in neutral standing pose, centered, pure white background. No shading, no gradient, no textures, no photorealism, no 3D, no anime style, 1:1 ratio, pure white background, educational YouTube doodle channel style.`;

interface CharacterPageProps {
    title: string;
    script: string;
    existingStoryCharacters?: StoryCharacter[];
    onComplete: (storyCharacters: StoryCharacter[]) => void;
    onBack: () => void;
}

export function CharacterPage({
    title,
    script,
    existingStoryCharacters,
    onComplete,
    onBack,
}: CharacterPageProps) {
    const [storyChars, setStoryChars] = useState<StoryCharacter[]>(existingStoryCharacters || []);
    const [extracting, setExtracting] = useState(false);
    const [generatingIdx, setGeneratingIdx] = useState<number | null>(null);
    const [error, setError] = useState('');

    const [noCharsFound, setNoCharsFound] = useState(false);

    const handleExtractCharacters = async () => {
        setExtracting(true);
        setError('');
        setNoCharsFound(false);
        try {
            const chars = await extractStoryCharacters(title, script);
            if (chars.length === 0) {
                setNoCharsFound(true);
            } else {
                setStoryChars(chars.map(c => ({ ...c, imageUrl: undefined })));
            }
        } catch (e: any) {
            setError(e.message || 'Erro ao identificar personagens. Tente novamente.');
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

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Personagens</h2>
                <p className="text-gray-400 text-sm">Identifique os personagens da história para usar como referência visual nas cenas.</p>
            </div>

            {/* Narrador fixo — apenas informativo */}
            <div className="bg-[#1a1a1c] border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                    <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-white">Narrador — Boneco Palito</p>
                    <p className="text-xs text-gray-500">DNA visual fixo — aplicado automaticamente em todas as cenas via prompt.</p>
                </div>
                <CheckCircle className="h-4 w-4 text-green-400 ml-auto shrink-0" />
            </div>

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

                {storyChars.length === 0 && !extracting && !noCharsFound && (
                    <div className="bg-[#1a1a1c] border border-dashed border-border rounded-xl p-6 text-center">
                        <Users className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">Clique em "Identificar Personagens" para analisar o roteiro e extrair os personagens da história.</p>
                    </div>
                )}

                {noCharsFound && !extracting && (
                    <div className="bg-[#1a1a1c] border border-dashed border-amber-800/40 rounded-xl p-6 text-center">
                        <Users className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                        <p className="text-amber-400 text-sm font-medium mb-1">Nenhum personagem visual identificado</p>
                        <p className="text-gray-500 text-xs">O roteiro desta história é mais conceitual e não tem personagens visuais específicos. O narrador palito será o único personagem nas cenas.</p>
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
                    onClick={() => onComplete(storyChars)}
                    disabled={false}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    Avançar <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
