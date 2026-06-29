import React, { useState } from 'react';
import { Volume2, Loader2, RefreshCw, ArrowRight, ArrowLeft, Play, Pause } from 'lucide-react';
import { generateAudioNarration, GEMINI_VOICES } from '../../services/tts';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface NarrationPageProps {
    script: string;
    existingAudioUrl?: string;
    existingVoice?: string;
    existingEmotion?: string;
    onComplete: (audioUrl: string, voiceName: string, emotion: string) => void;
    onBack: () => void;
}

const EMOTION_OPTIONS = [
    { value: 'narrator',      label: 'Narrador — documental, neutro e fluido' },
    { value: 'broadcaster',   label: 'Locutor — rádio/TV, voz cheia e dinâmica' },
    { value: 'calmly',        label: 'Calma — tranquila e sem pressa' },
    { value: 'authoritative', label: 'Autoritária — confiante e profissional' },
    { value: 'warmly',        label: 'Calorosa — acolhedora e próxima' },
    { value: 'mysteriously',  label: 'Misteriosa — envolvente e suspense leve' },
    { value: 'excitedly',     label: 'Animada — energética e entusiasmada' },
    { value: 'dramatically',  label: 'Dramática — marcante e expressiva' },
    { value: 'storyteller',   label: 'Contador de histórias — clássico e envolvente' },
];

const VOICE_OPTIONS = Object.entries(GEMINI_VOICES).slice(0, 12).map(([key, meta]) => ({
    value: key,
    label: `${meta.label} (${meta.gender === 'female' ? 'F' : 'M'})`,
}));

export function NarrationPage({ script, existingAudioUrl, existingVoice, existingEmotion, onComplete, onBack }: NarrationPageProps) {
    const { user } = useAuth();
    const [voiceName, setVoiceName] = useState(existingVoice || 'Charon');
    const [emotion, setEmotion] = useState(existingEmotion || 'narrator');
    const [audioUrl, setAudioUrl] = useState(existingAudioUrl || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = React.useRef<HTMLAudioElement>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError('');
        try {
            const blob64 = await generateAudioNarration({ text: script, voiceName, emotion: emotion as any });

            // Upload to Supabase
            const filename = `palito/audio_${Date.now()}.mp3`;
            const byteStr = atob(blob64.split(',')[1] || blob64);
            const ab = new ArrayBuffer(byteStr.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
            const audioBlob = new Blob([ab], { type: 'audio/mpeg' });

            const { data, error: upErr } = await supabase.storage
                .from('story-audio')
                .upload(filename, audioBlob, { contentType: 'audio/mpeg', upsert: true });

            if (upErr) throw upErr;

            const { data: urlData } = supabase.storage.from('story-audio').getPublicUrl(filename);
            setAudioUrl(urlData.publicUrl);
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar áudio. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Geração de Narração</h2>
                <p className="text-gray-400 text-sm">Escolha a voz e a emoção para gerar o áudio da narração.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm text-gray-400">Voz</label>
                    <select
                        value={voiceName}
                        onChange={e => setVoiceName(e.target.value)}
                        className="w-full bg-[#242426] border border-border text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {VOICE_OPTIONS.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm text-gray-400">Emoção</label>
                    <select
                        value={emotion}
                        onChange={e => setEmotion(e.target.value)}
                        className="w-full bg-[#242426] border border-border text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {EMOTION_OPTIONS.map(e => (
                            <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                {loading ? 'Gerando áudio (pode levar 1–2 min)...' : audioUrl ? 'Regenerar Áudio' : 'Gerar Áudio'}
            </button>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {audioUrl && !loading && (
                <div className="bg-[#242426] border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={togglePlay}
                            className="p-3 bg-primary rounded-full text-white hover:bg-primary/90 transition-colors"
                        >
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <div>
                            <p className="text-white text-sm font-medium">Áudio gerado</p>
                            <p className="text-gray-400 text-xs">Voz: {voiceName} · Emoção: {EMOTION_OPTIONS.find(e => e.value === emotion)?.label}</p>
                        </div>
                    </div>
                    <audio
                        ref={audioRef}
                        src={audioUrl}
                        onEnded={() => setIsPlaying(false)}
                        className="w-full"
                        controls
                    />
                </div>
            )}

            <div className="flex justify-between pt-2">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                    onClick={() => onComplete(audioUrl, voiceName, emotion)}
                    disabled={!audioUrl}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    Avançar <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
