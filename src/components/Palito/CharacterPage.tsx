import React, { useState } from 'react';
import { User, Loader2, RefreshCw, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { generateImageWithNanoBanana } from '../../services/google_image';

const CHARACTER_REFERENCE_PROMPT = `Hand-drawn 2D doodle animation style, flat colors, thick black outlines, slightly imperfect marker lines. Character in neutral standing pose, centered, pure white background (#FFFFFF). Large circular head filled white, thick black outline. Hair: 4 to 5 short thin diagonal lines at top of head, slightly spiky, hand-drawn style. Eyes: two small black dots, positioned center-lower area of the head. Eyebrows: two short straight thin lines slightly angled down toward center. Mouth: straight line (neutral expression). Medium gray t-shirt (#9E9E9E), round collar, short sleeves, simple shape, no internal details. Dark gray shorts (#555555), short, simple. Arms: thin black lines from shoulders, small circular white fists with black outline. Legs: thin black lines, small slightly flat oval white feet with black outline. Light gray flattened oval shadow beneath feet. No shading, no gradient, no textures, no photorealism, no 3D, no anime style, 1:1 ratio, pure white background, educational YouTube doodle channel style.`;

interface CharacterPageProps {
    existingImageUrl?: string;
    onComplete: (imageUrl: string) => void;
    onBack: () => void;
}

export function CharacterPage({ existingImageUrl, onComplete, onBack }: CharacterPageProps) {
    const [imageUrl, setImageUrl] = useState(existingImageUrl || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        setLoading(true);
        setError('');
        try {
            const url = await generateImageWithNanoBanana(CHARACTER_REFERENCE_PROMPT);
            setImageUrl(url);
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar personagem. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Personagem de Referência</h2>
                <p className="text-gray-400 text-sm">Gere a imagem de referência do boneco palito. Ela será usada para manter consistência em todas as cenas.</p>
            </div>

            {/* DNA card */}
            <div className="bg-[#242426] border border-border rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">DNA Visual Fixo do Personagem</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-400">
                    <span>Cabeça circular grande, branca</span>
                    <span>Cabelo: 4–5 riscos espetados</span>
                    <span>Olhos: 2 pontos pretos</span>
                    <span>Sobrancelhas retas levemente inclinadas</span>
                    <span>Camiseta cinza médio #9E9E9E</span>
                    <span>Shorts cinza escuro #555555</span>
                    <span>Braços finos + punhos circulares</span>
                    <span>Sombra oval achatada no chão</span>
                </div>
            </div>

            <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : imageUrl ? <RefreshCw className="h-4 w-4" /> : <User className="h-4 w-4" />}
                {loading ? 'Gerando personagem...' : imageUrl ? 'Regenerar' : 'Gerar Personagem de Referência'}
            </button>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {imageUrl && !loading && (
                <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden bg-[#242426] border border-border aspect-square max-w-sm mx-auto">
                        <img src={imageUrl} alt="Personagem de referência" className="w-full h-full object-contain p-4" />
                        <div className="absolute top-2 right-2 bg-green-600 rounded-full p-1">
                            <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                    </div>
                    <p className="text-center text-xs text-gray-500">Esta imagem será usada como referência visual em todas as cenas do vídeo.</p>
                </div>
            )}

            <div className="flex justify-between pt-2">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                    onClick={() => onComplete(imageUrl)}
                    disabled={!imageUrl}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    Usar este personagem <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
