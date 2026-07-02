import React, { useState, useEffect } from 'react';
import { FileText, Loader2, RefreshCw, ArrowRight, ArrowLeft } from 'lucide-react';
import { generatePalitoScript, generatePalitoShortsScript } from '../../services/palitoGemini';
import { PalitoFormat } from '../../types/palito';

interface ScriptPageProps {
    title: string;
    format?: PalitoFormat;
    existingScript?: string;
    onComplete: (script: string) => void;
    onBack: () => void;
}

export function ScriptPage({ title, format = 'VIDEO', existingScript, onComplete, onBack }: ScriptPageProps) {
    const isShorts = format === 'SHORTS';
    const [script, setScript] = useState(existingScript || '');
    const [loading, setLoading] = useState(!existingScript);
    const [error, setError] = useState('');

    const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
    const estimatedMinutes = wordCount > 0 ? (wordCount / 140) : 0;
    const estimatedTime = wordCount > 0
        ? isShorts
            ? `~${Math.round(estimatedMinutes * 60)}s`
            : `~${estimatedMinutes.toFixed(1).replace('.', ',')} min`
        : '';
    const minWords = isShorts ? 140 : 700;
    const maxWords = isShorts ? 190 : 900;
    const wordCountColor = wordCount < minWords ? 'text-yellow-400' : wordCount > maxWords ? 'text-red-400' : 'text-green-400';

    useEffect(() => {
        if (!existingScript) generateScript();
    }, []);

    const generateScript = async () => {
        setLoading(true);
        setError('');
        try {
            const result = isShorts
                ? await generatePalitoShortsScript(title)
                : await generatePalitoScript(title);
            setScript(result);
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar roteiro. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Roteiro de Narração</h2>
                <p className="text-gray-400 text-sm">Título: <span className="text-white font-medium">"{title}"</span></p>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-gray-400 text-sm">
                        {isShorts ? 'Gerando roteiro de até 60 segundos...' : 'Gerando roteiro de 700–900 palavras...'}
                    </p>
                </div>
            ) : (
                <>
                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm text-gray-400">Narração (editável)</label>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-mono ${wordCountColor}`}>{wordCount} palavras</span>
                                {estimatedTime && (
                                    <span className="text-xs text-gray-500">· {estimatedTime}</span>
                                )}
                            </div>
                        </div>
                        <textarea
                            value={script}
                            onChange={e => setScript(e.target.value)}
                            rows={20}
                            className="w-full bg-[#242426] border border-border text-white rounded-lg px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                        <p className="text-xs text-gray-500">
                            {isShorts
                                ? 'Meta: 140–190 palavras · até 60 segundos de narração (base: 140 palavras/min)'
                                : 'Meta: 700–900 palavras · 4–6 minutos de narração (base: 140 palavras/min)'}
                        </p>
                    </div>

                    <div className="flex justify-between pt-2">
                        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                            <ArrowLeft className="h-4 w-4" /> Voltar
                        </button>
                        <div className="flex gap-3">
                            <button
                                onClick={generateScript}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors"
                            >
                                <RefreshCw className="h-4 w-4" /> Regenerar
                            </button>
                            <button
                                onClick={() => onComplete(script)}
                                disabled={!script.trim()}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                Usar este roteiro <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
