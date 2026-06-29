import React, { useState } from 'react';
import { Image, Loader2, RefreshCw, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { generateImageWithNanoBanana } from '../../services/google_image';
import { generatePalitoThumbnailData, buildPalitoThumbnailPrompt, PalitoThumbnailData } from '../../services/palitoGemini';

interface ThumbnailPageProps {
    title: string;
    existingThumbnailUrl?: string;
    onComplete: (thumbnailUrl: string) => void;
    onBack: () => void;
}

export function ThumbnailPage({ title, existingThumbnailUrl, onComplete, onBack }: ThumbnailPageProps) {
    const [thumbnailUrl, setThumbnailUrl] = useState(existingThumbnailUrl || '');
    const [thumbnailData, setThumbnailData] = useState<PalitoThumbnailData | null>(null);
    const [textRed, setTextRed] = useState('');
    const [textBlack, setTextBlack] = useState('');
    const [loadingData, setLoadingData] = useState(false);
    const [loadingImage, setLoadingImage] = useState(false);
    const [error, setError] = useState('');

    const handlePrepare = async () => {
        setLoadingData(true);
        setError('');
        try {
            const data = await generatePalitoThumbnailData(title);
            setThumbnailData(data);
            setTextRed(data.textRed);
            setTextBlack(data.textBlack);
        } catch (e: any) {
            setError(e.message || 'Erro ao preparar capa. Tente novamente.');
        } finally {
            setLoadingData(false);
        }
    };

    const handleGenerate = async () => {
        if (!thumbnailData) return;
        setLoadingImage(true);
        setError('');
        try {
            const data: PalitoThumbnailData = {
                ...thumbnailData,
                textRed: textRed.toUpperCase(),
                textBlack: textBlack.toUpperCase(),
            };
            const prompt = buildPalitoThumbnailPrompt(data);
            const url = await generateImageWithNanoBanana(prompt);
            setThumbnailUrl(url);
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar capa. Tente novamente.');
        } finally {
            setLoadingImage(false);
        }
    };

    const handleReset = () => {
        setThumbnailData(null);
        setTextRed('');
        setTextBlack('');
        setThumbnailUrl('');
    };

    const previewRed = textRed.toUpperCase() || 'TEXTO';
    const previewBlack = textBlack.toUpperCase() || 'EM DESTAQUE';

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Capa do Vídeo</h2>
                <p className="text-gray-400 text-sm">Thumbnail 16:9 estilo doodle para o YouTube.</p>
                <p className="mt-2 text-sm text-white">Título: <span className="text-primary font-medium">"{title}"</span></p>
            </div>

            {/* Step 1 */}
            {!thumbnailData && (
                <button
                    onClick={handlePrepare}
                    disabled={loadingData}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {loadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {loadingData ? 'Preparando composição...' : 'Preparar Capa'}
                </button>
            )}

            {/* Step 2 — review & edit */}
            {thumbnailData && (
                <div className="bg-[#242426] border border-border rounded-xl p-5 space-y-5">

                    {/* Text preview */}
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Texto de destaque — preview</p>
                        <div className="bg-white rounded-lg px-5 py-4 text-center">
                            <span
                                className="font-black uppercase"
                                style={{ fontSize: 28, color: '#E02020', fontFamily: 'Impact, Arial Black, sans-serif', letterSpacing: '0.03em' }}
                            >
                                {previewRed}{' '}
                            </span>
                            <span
                                className="font-black uppercase"
                                style={{ fontSize: 28, color: '#111', fontFamily: 'Impact, Arial Black, sans-serif', letterSpacing: '0.03em' }}
                            >
                                {previewBlack}
                            </span>
                        </div>
                    </div>

                    {/* Editable fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium" style={{ color: '#E24B4A' }}>Parte vermelha (impacto)</label>
                            <input
                                type="text"
                                value={textRed}
                                onChange={e => setTextRed(e.target.value.toUpperCase())}
                                maxLength={25}
                                className="w-full bg-[#1a1a1c] border border-border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                                style={{ color: '#E24B4A' }}
                                placeholder="O SEGREDO"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-300">Parte preta (complemento)</label>
                            <input
                                type="text"
                                value={textBlack}
                                onChange={e => setTextBlack(e.target.value.toUpperCase())}
                                maxLength={30}
                                className="w-full bg-[#1a1a1c] border border-border text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="DA COPA!"
                            />
                        </div>
                    </div>

                    {/* Objects info */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-[#1a1a1c] rounded-lg p-3">
                            <p className="text-gray-500 mb-1">Objeto principal</p>
                            <p className="text-gray-300 italic">{thumbnailData.object1}</p>
                        </div>
                        <div className="bg-[#1a1a1c] rounded-lg p-3">
                            <p className="text-gray-500 mb-1">Objeto secundário</p>
                            <p className="text-gray-300 italic">{thumbnailData.object2}</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleGenerate}
                            disabled={loadingImage || !textRed.trim() || !textBlack.trim()}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {loadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
                            {loadingImage ? 'Gerando capa...' : thumbnailUrl ? 'Regenerar Imagem' : 'Gerar Imagem'}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={loadingImage}
                            className="px-3 py-2.5 bg-[#1a1a1c] border border-border text-gray-400 rounded-lg text-sm hover:text-white transition-colors"
                            title="Recomeçar"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {thumbnailUrl && !loadingImage && (
                <div className="space-y-2">
                    <div className="rounded-xl overflow-hidden border border-border aspect-video bg-[#242426]">
                        <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-gray-500 text-center">Preview 16:9 — tamanho real: 1280×720px</p>
                </div>
            )}

            <div className="flex justify-between pt-2">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                    onClick={() => onComplete(thumbnailUrl)}
                    disabled={!thumbnailUrl}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    Avançar <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
