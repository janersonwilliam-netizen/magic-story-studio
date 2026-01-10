import React, { useState, useEffect, useRef } from 'react';
import { VideoRenderer } from '../services/video_renderer';
import { Scene } from '../services/gemini';
import { Loader2, Download, Video, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExportVideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    scenes: Scene[];
    storyAudioUrl?: string; // Full story audio
    storyTitle: string;
}

export function ExportVideoModal({ isOpen, onClose, scenes, storyAudioUrl, storyTitle }: ExportVideoModalProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'rendering' | 'complete' | 'error'>('idle');
    const [progressLog, setProgressLog] = useState<string[]>([]);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string>('');

    // We need a ref to the renderer to keep it across renders, 
    // but the renderer is stateful (loaded state).
    const rendererRef = useRef<VideoRenderer | null>(null);

    useEffect(() => {
        if (isOpen && status === 'idle') {
            startRendering();
        }
    }, [isOpen]);

    const addLog = (msg: string) => {
        setProgressLog(prev => [...prev.slice(-4), msg]); // Keep last 5 logs
    };

    const startRendering = async () => {
        try {
            setStatus('rendering');
            setError('');
            setProgressLog(['Inicializando motor de renderização...']);

            if (!rendererRef.current) {
                rendererRef.current = new VideoRenderer(addLog);
            }

            const blob = await rendererRef.current.renderStory(scenes, storyAudioUrl);
            setVideoBlob(blob);
            setStatus('complete');
            addLog('Renderização concluída com sucesso!');
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Erro desconhecido ao renderizar vídeo.');
            setStatus('error');
        }
    };

    const handleDownload = () => {
        if (!videoBlob) return;
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${storyTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_video.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Video className="h-5 w-5 text-red-600" />
                        Exportar Vídeo MP4
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-8 text-center">
                    {status === 'rendering' && (
                        <div className="py-8">
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <Loader2 className="w-full h-full text-red-600 animate-spin opacity-20" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Video className="h-8 w-8 text-red-600 animate-pulse" />
                                </div>
                            </div>
                            <h4 className="text-lg font-semibold mb-2">Renderizando seu vídeo...</h4>
                            <p className="text-gray-500 text-sm mb-6">Isso pode levar alguns minutos. Por favor, não feche esta janela.</p>

                            <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg text-left h-32 overflow-hidden flex flex-col justify-end">
                                {progressLog.map((log, i) => (
                                    <div key={i} className="truncate">&gt; {log}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {status === 'complete' && (
                        <div className="py-6">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Download className="h-10 w-10 text-green-600" />
                            </div>
                            <h4 className="text-2xl font-bold text-green-700 mb-2">Vídeo Pronto!</h4>
                            <p className="text-gray-600 mb-8">Seu vídeo foi gerado com sucesso.</p>

                            <button
                                onClick={handleDownload}
                                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg shadow-green-200"
                            >
                                Baixar Arquivo MP4
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="py-6">
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertCircle className="h-10 w-10 text-red-600" />
                            </div>
                            <h4 className="text-xl font-bold text-red-700 mb-2">Erro ao Renderizar</h4>
                            <p className="text-gray-600 mb-6">{error}</p>

                            <button
                                onClick={startRendering}
                                className="px-6 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                            >
                                Tentar Novamente
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
