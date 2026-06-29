import React, { useState } from 'react';
import { Clock, Loader2, ArrowRight, ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';
import { transcribeAudioWithGemini } from '../../services/palitoGemini';
import { PalitoTranscriptionLine } from '../../types/palito';

interface TranscriptionPageProps {
    audioUrl: string;
    existingTranscription?: PalitoTranscriptionLine[];
    onComplete: (transcription: PalitoTranscriptionLine[]) => void;
    onBack: () => void;
}

export function TranscriptionPage({ audioUrl, existingTranscription, onComplete, onBack }: TranscriptionPageProps) {
    const [lines, setLines] = useState<PalitoTranscriptionLine[]>(existingTranscription || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [manualMode, setManualMode] = useState(false);

    const handleAutoTranscribe = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await transcribeAudioWithGemini(audioUrl);
            setLines(result);
        } catch (e: any) {
            setError(e.message || 'Erro na transcrição automática.');
            setManualMode(true);
        } finally {
            setLoading(false);
        }
    };

    const handleManualPaste = (text: string) => {
        const parsed: PalitoTranscriptionLine[] = [];
        const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            parsed.push({ timestamp: match[1], text: match[2].trim() });
        }
        if (parsed.length > 0) setLines(parsed);
        else setError('Não foi possível detectar timestamps. Use o formato [00:00] Texto da fala.');
    };

    const updateLine = (i: number, field: 'timestamp' | 'text', value: string) => {
        setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
    };

    const addLine = (after: number) => {
        setLines(prev => [
            ...prev.slice(0, after + 1),
            { timestamp: '', text: '' },
            ...prev.slice(after + 1),
        ]);
    };

    const removeLine = (i: number) => {
        setLines(prev => prev.filter((_, idx) => idx !== i));
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Transcrição com Timestamps</h2>
                <p className="text-gray-400 text-sm">Gere a transcrição automática ou cole manualmente no formato <code className="text-primary">[00:00] Texto</code>.</p>
            </div>

            {lines.length === 0 && (
                <div className="space-y-4">
                    <button
                        onClick={handleAutoTranscribe}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                        {loading ? 'Transcrevendo áudio...' : 'Transcrição Automática'}
                    </button>

                    <div className="relative flex items-center">
                        <div className="flex-1 border-t border-border" />
                        <span className="px-3 text-gray-500 text-xs">ou cole manualmente</span>
                        <div className="flex-1 border-t border-border" />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Cole aqui a transcrição do TurboScribe / YouTube Studio</label>
                        <textarea
                            rows={8}
                            placeholder={'[00:00] Esta noite, quando o sol se pôr...\n[00:05] A luz vai inundar o cômodo...\n[00:09] Mas por 99,9% da história humana...'}
                            className="w-full bg-[#242426] border border-border text-white rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            onChange={e => handleManualPaste(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {error && (
                <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {lines.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">{lines.length} linhas detectadas</span>
                        <button
                            onClick={() => setLines([])}
                            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                        >
                            Limpar tudo
                        </button>
                    </div>

                    <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
                        {lines.map((line, i) => (
                            <div key={i} className="flex items-start gap-2 group">
                                <input
                                    value={line.timestamp}
                                    onChange={e => updateLine(i, 'timestamp', e.target.value)}
                                    placeholder="00:00"
                                    className="w-16 shrink-0 bg-[#242426] border border-border text-primary rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <input
                                    value={line.text}
                                    onChange={e => updateLine(i, 'text', e.target.value)}
                                    className="flex-1 bg-[#242426] border border-border text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => addLine(i)} className="p-1.5 text-gray-500 hover:text-green-400 transition-colors">
                                        <Plus className="h-3 w-3" />
                                    </button>
                                    <button onClick={() => removeLine(i)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-between pt-2">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                    onClick={() => onComplete(lines)}
                    disabled={lines.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    Avançar ({lines.length} linhas) <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
