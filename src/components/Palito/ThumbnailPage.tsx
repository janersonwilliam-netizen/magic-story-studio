import React, { useState } from 'react';
import { Image, Loader2, RefreshCw, ArrowRight, ArrowLeft, Sparkles, FlaskConical, CheckCircle2 } from 'lucide-react';
import { generateImageWithNanoBanana, generateImageWithReferences } from '../../services/google_image';
import { generatePalitoThumbnailData, buildPalitoThumbnailPrompt, buildPalitoThumbnailPromptB, PalitoThumbnailData } from '../../services/palitoGemini';
import { StoryCharacter } from '../../types/palito';

interface ThumbnailPageProps {
    title: string;
    script?: string;
    storyCharacters?: StoryCharacter[];
    existingThumbnailUrl?: string;
    onComplete: (thumbnailUrl: string) => void;
    onBack: () => void;
}

type SelectedVersion = 'A' | 'B' | null;

export function ThumbnailPage({ title, script, storyCharacters, existingThumbnailUrl, onComplete, onBack }: ThumbnailPageProps) {
    const [thumbnailData, setThumbnailData] = useState<PalitoThumbnailData | null>(null);
    const [textRed, setTextRed] = useState('');
    const [textBlack, setTextBlack] = useState('');
    const [object1, setObject1] = useState('');
    const [object2, setObject2] = useState('');
    const [characterAction, setCharacterAction] = useState('');
    const [loadingData, setLoadingData] = useState(false);
    const [loadingA, setLoadingA] = useState(false);
    const [loadingB, setLoadingB] = useState(false);
    const [urlA, setUrlA] = useState(existingThumbnailUrl || '');
    const [urlB, setUrlB] = useState('');
    const [selected, setSelected] = useState<SelectedVersion>(existingThumbnailUrl ? 'A' : null);
    const [error, setError] = useState('');

    const handlePrepare = async () => {
        setLoadingData(true);
        setError('');
        try {
            const data = await generatePalitoThumbnailData(title, script);
            setThumbnailData(data);
            setTextRed(data.textRed);
            setTextBlack(data.textBlack);
            setObject1(data.object1);
            setObject2(data.object2);
            setCharacterAction(data.characterAction);
        } catch (e: any) {
            setError(e.message || 'Erro ao preparar capa. Tente novamente.');
        } finally {
            setLoadingData(false);
        }
    };

    const buildData = (): PalitoThumbnailData => ({
        textRed: textRed.toUpperCase(),
        textBlack: textBlack.toUpperCase(),
        object1,
        object2,
        characterAction,
    });

    const generateImage = async (prompt: string): Promise<string> => {
        const refs = (storyCharacters || [])
            .filter(c => c.imageUrl)
            .map(c => c.imageUrl!)
            .slice(0, 2);
        return refs.length > 0
            ? generateImageWithReferences(prompt, refs)
            : generateImageWithNanoBanana(prompt);
    };

    const handleGenerateA = async () => {
        if (!thumbnailData) return;
        setLoadingA(true);
        setError('');
        try {
            const url = await generateImage(buildPalitoThumbnailPrompt(buildData()));
            setUrlA(url);
            if (!selected) setSelected('A');
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar versão A.');
        } finally {
            setLoadingA(false);
        }
    };

    const handleGenerateB = async () => {
        if (!thumbnailData) return;
        setLoadingB(true);
        setError('');
        try {
            const url = await generateImage(buildPalitoThumbnailPromptB(buildData()));
            setUrlB(url);
            if (!selected) setSelected('B');
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar versão B.');
        } finally {
            setLoadingB(false);
        }
    };

    const handleReset = () => {
        setThumbnailData(null);
        setTextRed(''); setTextBlack('');
        setObject1(''); setObject2('');
        setCharacterAction('');
        setUrlA(''); setUrlB('');
        setSelected(null);
    };

    const selectedUrl = selected === 'B' ? urlB : urlA;
    const previewRed = textRed.toUpperCase() || 'TEXTO';
    const previewBlack = textBlack.toUpperCase() || 'EM DESTAQUE';
    const canGenerate = !!(textRed.trim() && textBlack.trim() && object1.trim());

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
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Frase gancho da capa — preview</p>
                        <div className="bg-white rounded-lg px-5 py-4 text-center">
                            <span className="font-black uppercase" style={{ fontSize: 28, color: '#E02020', fontFamily: 'Impact, Arial Black, sans-serif', letterSpacing: '0.03em' }}>
                                {previewRed}{' '}
                            </span>
                            <span className="font-black uppercase" style={{ fontSize: 28, color: '#111', fontFamily: 'Impact, Arial Black, sans-serif', letterSpacing: '0.03em' }}>
                                {previewBlack}
                            </span>
                        </div>
                    </div>

                    {/* Editable fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium" style={{ color: '#E24B4A' }}>Parte vermelha — impacto</label>
                            <input type="text" value={textRed} onChange={e => setTextRed(e.target.value.toUpperCase())} maxLength={25}
                                className="w-full bg-[#1a1a1c] border border-border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                                style={{ color: '#E24B4A' }} placeholder="O SEGREDO" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-300">Parte preta — complemento</label>
                            <input type="text" value={textBlack} onChange={e => setTextBlack(e.target.value.toUpperCase())} maxLength={30}
                                className="w-full bg-[#1a1a1c] border border-border text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="DA COPA!" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Objeto principal <span className="text-gray-600">(em inglês)</span></label>
                            <input type="text" value={object1} onChange={e => setObject1(e.target.value)}
                                className="w-full bg-[#1a1a1c] border border-border text-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="ex: ancient campfire at night under stars" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Objeto secundário <span className="text-gray-600">(em inglês)</span></label>
                            <input type="text" value={object2} onChange={e => setObject2(e.target.value)}
                                className="w-full bg-[#1a1a1c] border border-border text-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="ex: crescent moon with stars" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400">Ação do personagem <span className="text-gray-600">(em inglês)</span></label>
                        <input type="text" value={characterAction} onChange={e => setCharacterAction(e.target.value)}
                            className="w-full bg-[#1a1a1c] border border-border text-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="ex: pointing at the fire with one arm extended, mouth open in shock" />
                    </div>

                    {/* Story character references */}
                    {storyCharacters && storyCharacters.some(c => c.imageUrl) && (
                        <div className="flex items-center gap-2 p-3 bg-[#1a1a1c] border border-border rounded-lg">
                            <span className="text-xs text-gray-400 shrink-0">Referências de personagens:</span>
                            <div className="flex gap-2">
                                {storyCharacters.filter(c => c.imageUrl).map((c, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <img src={c.imageUrl} className="w-8 h-8 rounded object-cover border border-border" alt={c.name} />
                                        <span className="text-xs text-gray-500">{c.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* A/B generate buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleGenerateA} disabled={loadingA || loadingB || !canGenerate}
                            className="flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
                            {loadingA ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
                            {loadingA ? 'Gerando...' : urlA ? 'Regenerar A' : 'Gerar Versão A'}
                        </button>
                        <button onClick={handleGenerateB} disabled={loadingA || loadingB || !canGenerate}
                            className="flex items-center justify-center gap-2 py-2.5 bg-[#7c3aed] text-white rounded-lg font-semibold text-sm hover:bg-[#6d28d9] disabled:opacity-50 transition-colors">
                            {loadingB ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                            {loadingB ? 'Gerando...' : urlB ? 'Regenerar B' : 'Gerar Versão B'}
                        </button>
                    </div>

                    <button onClick={handleReset} disabled={loadingA || loadingB}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors">
                        <RefreshCw className="h-3 w-3" /> Recomeçar do zero
                    </button>
                </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {/* A/B comparison */}
            {(urlA || urlB) && (
                <div className="space-y-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Teste A/B — clique para selecionar</p>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Version A */}
                        <div
                            onClick={() => urlA && setSelected('A')}
                            className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                                selected === 'A' ? 'border-primary shadow-lg shadow-primary/20' : 'border-border hover:border-gray-500'
                            } ${!urlA ? 'opacity-40 cursor-default' : ''}`}
                        >
                            <div className="aspect-video bg-[#242426]">
                                {urlA
                                    ? <img src={urlA} alt="Versão A" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">Não gerada</div>
                                }
                            </div>
                            <div className={`flex items-center justify-between px-2 py-1.5 text-xs font-semibold ${selected === 'A' ? 'bg-primary text-white' : 'bg-[#1a1a1c] text-gray-400'}`}>
                                <span>Versão A — Personagem + Objeto</span>
                                {selected === 'A' && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </div>
                        </div>

                        {/* Version B */}
                        <div
                            onClick={() => urlB && setSelected('B')}
                            className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                                selected === 'B' ? 'border-[#7c3aed] shadow-lg shadow-purple-500/20' : 'border-border hover:border-gray-500'
                            } ${!urlB ? 'opacity-40 cursor-default' : ''}`}
                        >
                            <div className="aspect-video bg-[#242426]">
                                {urlB
                                    ? <img src={urlB} alt="Versão B" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">Não gerada</div>
                                }
                            </div>
                            <div className={`flex items-center justify-between px-2 py-1.5 text-xs font-semibold ${selected === 'B' ? 'bg-[#7c3aed] text-white' : 'bg-[#1a1a1c] text-gray-400'}`}>
                                <span>Versão B — Objeto Hero + Diagonal</span>
                                {selected === 'B' && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </div>
                        </div>
                    </div>
                    {selected && (
                        <p className="text-xs text-center text-gray-500">
                            Versão <span className="font-bold text-white">{selected}</span> selecionada para avançar
                        </p>
                    )}
                </div>
            )}

            <div className="flex justify-between pt-2">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                    onClick={() => onComplete(selectedUrl)}
                    disabled={!selectedUrl}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    Avançar <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
