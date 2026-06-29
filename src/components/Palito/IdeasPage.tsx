import React, { useState } from 'react';
import { Lightbulb, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { generatePalitoIdeas } from '../../services/palitoGemini';

interface IdeasPageProps {
    tema?: string;
    existingIdeas?: string[];
    existingSelected?: string;
    onComplete: (ideas: string[], selectedTitle: string, tema?: string) => void;
}

export function IdeasPage({ tema: initialTema, existingIdeas, existingSelected, onComplete }: IdeasPageProps) {
    const [tema, setTema] = useState(initialTema || '');
    const [ideas, setIdeas] = useState<string[]>(existingIdeas || []);
    const [selected, setSelected] = useState<string>(existingSelected || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hasGenerated, setHasGenerated] = useState(existingIdeas && existingIdeas.length > 0);

    const handleGenerate = async () => {
        setLoading(true);
        setError('');
        setSelected('');
        try {
            const result = await generatePalitoIdeas(tema.trim() || undefined);
            setIdeas(result);
            setHasGenerated(true);
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar ideias. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-[60vh]">
            <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 flex-1">

                {/* Search bar — sempre visível no topo */}
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={tema}
                        onChange={e => setTema(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !loading && handleGenerate()}
                        placeholder="Ex: como é feita a água com gás, copa do mundo, quanto ganha um piloto..."
                        className="flex-1 bg-[#242426] border border-border text-white rounded-xl px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : hasGenerated ? <RefreshCw className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                        {loading ? 'Gerando...' : hasGenerated ? 'Regenerar' : 'Gerar Ideias'}
                    </button>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                {/* Empty state — centralizado */}
                {!hasGenerated && !loading && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-gray-500">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <Lightbulb className="h-7 w-7 text-primary/50" />
                        </div>
                        <p className="text-sm font-medium text-gray-400 mb-1">Pronto para criar?</p>
                        <p className="text-xs text-gray-600">Informe um tema ou deixe em branco para ideias livres</p>
                    </div>
                )}

                {/* Lista de ideias */}
                {ideas.length > 0 && (
                    <div className="space-y-2">
                        {ideas.map((idea, i) => (
                            <button
                                key={i}
                                onClick={() => setSelected(idea)}
                                className={`w-full text-left flex items-start gap-4 px-4 py-3 rounded-xl border transition-all ${
                                    selected === idea
                                        ? 'bg-primary/15 border-primary text-white shadow-sm shadow-primary/20'
                                        : 'bg-[#242426] border-border text-gray-300 hover:border-gray-500 hover:text-white'
                                }`}
                            >
                                <span className={`text-xs font-bold mt-0.5 w-5 shrink-0 ${selected === idea ? 'text-primary' : 'text-gray-600'}`}>{i + 1}</span>
                                <span className="text-sm leading-relaxed">{idea}</span>
                                {selected === idea && <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5 ml-auto" />}
                            </button>
                        ))}
                    </div>
                )}

                {/* Botão avançar */}
                {selected && (
                    <div className="flex justify-end pt-2 pb-4">
                        <button
                            onClick={() => onComplete(ideas, selected, tema.trim() || undefined)}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-md"
                        >
                            Usar este título
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
