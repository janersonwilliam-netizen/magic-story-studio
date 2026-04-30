import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Type, Image as ImageIcon, Video, Upload, Download, Loader2, Play } from 'lucide-react';
import { generateVideoVertex } from '../services/video_service';

export function VideoGenPage() {
    const [prompt, setPrompt] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    
    // Configs do modelo
    const [duration, setDuration] = useState('4s');
    const [resolution, setResolution] = useState('720p');
    const [aspectRatio, setAspectRatio] = useState('16:9');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setImagePreview(url);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                setImageFile(file);
                const url = URL.createObjectURL(file);
                setImagePreview(url);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleGenerate = async () => {
        if (!prompt && !imageFile) return;
        
        setIsGenerating(true);
        setVideoUrl(null);
        try {
            const url = await generateVideoVertex({
                prompt,
                imageFile,
                duration,
                resolution,
                aspectRatio
            });
            setVideoUrl(url);
        } catch (error) {
            console.error('Erro ao gerar vídeo:', error);
            alert('Ocorreu um erro ao gerar o vídeo.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!videoUrl) return;
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = 'veo3_generated_video.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="w-full min-h-[calc(100vh-2rem)] relative overflow-hidden bg-[#0d0d0d] flex flex-col items-center p-4 lg:p-8 font-sans rounded-xl border border-white/5">
            {/* Background Grid Pattern */}
            <div 
                className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
                style={{ 
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)',
                    backgroundSize: '40px 40px' 
                }} 
            />

            <div className="relative z-10 w-full max-w-6xl mt-4 mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Geração de Vídeo</h1>
                <p className="text-gray-400 text-sm">Crie vídeos incríveis usando o modelo Veo 3 da Google.</p>
            </div>

            {/* Split Screen Container */}
            <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6 xl:gap-12 items-start">
                
                {/* Left Column: Inputs */}
                <div className="flex flex-col gap-6 w-full">
                    
                    {/* PROMPT NODE */}
                    <motion.div 
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full bg-[#1a1a1c] border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-md"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Type className="w-5 h-5 text-blue-400" />
                            <span className="text-sm font-semibold text-gray-200 uppercase tracking-wider">1. Prompt de Animação</span>
                        </div>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Descreva como a imagem deve se mover. Ex: 'Um rato andando pela floresta com câmera seguindo ele, iluminação cinematográfica...'"
                            className="w-full h-[120px] bg-black/40 border border-white/5 rounded-xl p-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none transition-colors"
                        />
                    </motion.div>

                    {/* IMAGE NODE */}
                    <motion.div 
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="w-full bg-[#1a1a1c] border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-md"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <ImageIcon className="w-5 h-5 text-amber-400" />
                            <span className="text-sm font-semibold text-gray-200 uppercase tracking-wider">2. Imagem Inicial (Opcional)</span>
                        </div>
                        
                        <div 
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full h-[220px] bg-black/40 border-2 border-dashed ${imagePreview ? 'border-white/10' : 'border-white/20 hover:border-amber-500/50'} rounded-xl flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group relative`}
                        >
                            {imagePreview ? (
                                <>
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-black/70 px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2">
                                            <Upload className="w-4 h-4" /> Trocar Imagem
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Upload className="w-6 h-6 text-gray-400 group-hover:text-amber-400 transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-300 font-medium">Clique ou arraste sua imagem</p>
                                        <p className="text-xs text-gray-500 mt-1">Usada como primeiro quadro do vídeo</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </motion.div>

                </div>

                {/* Right Column: Output */}
                <motion.div 
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="w-full bg-[#1a1a1c] border border-white/10 rounded-2xl p-0 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col h-full"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-white/10 bg-black/20">
                        <div className="flex items-center gap-2">
                            <Video className="w-5 h-5 text-purple-400" />
                            <span className="text-sm font-semibold text-gray-200 uppercase tracking-wider">3. Resultado (Apenas Vídeo)</span>
                        </div>
                    </div>

                    {/* Settings Bar */}
                    <div className="grid grid-cols-3 gap-3 p-4 bg-black/10 border-b border-white/5">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-gray-500 uppercase font-bold px-1">Duração</label>
                            <select 
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg text-sm text-gray-200 px-3 py-2.5 focus:outline-none focus:border-purple-500/50 cursor-pointer hover:bg-white/5 transition-colors"
                            >
                                <option value="4s">4 Segundos</option>
                                <option value="8s">8 Segundos</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-gray-500 uppercase font-bold px-1">Resolução</label>
                            <select 
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg text-sm text-gray-200 px-3 py-2.5 focus:outline-none focus:border-purple-500/50 cursor-pointer hover:bg-white/5 transition-colors"
                            >
                                <option value="720p">720p (Padrão/Suportado)</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-gray-500 uppercase font-bold px-1">Proporção</label>
                            <select 
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg text-sm text-gray-200 px-3 py-2.5 focus:outline-none focus:border-purple-500/50 cursor-pointer hover:bg-white/5 transition-colors"
                            >
                                <option value="16:9">16:9 (Paisagem)</option>
                                <option value="9:16">9:16 (Retrato)</option>
                                <option value="1:1">1:1 (Quadrado)</option>
                            </select>
                        </div>
                    </div>

                    {/* Player Area */}
                    <div className="w-full flex-1 min-h-[300px] bg-black/80 relative flex items-center justify-center p-4">
                        {isGenerating ? (
                            <div className="flex flex-col items-center justify-center gap-4">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-full border-2 border-purple-500/20 animate-ping absolute inset-0"></div>
                                    <Loader2 className="w-16 h-16 text-purple-500 animate-spin relative z-10" />
                                </div>
                                <div className="text-center">
                                    <span className="text-sm text-purple-300 font-medium animate-pulse block mb-1">Gerando vídeo...</span>
                                    <span className="text-xs text-gray-500">Isso pode levar alguns minutos no Veo 3</span>
                                </div>
                            </div>
                        ) : videoUrl ? (
                            <div className="w-full h-full max-h-[400px] flex items-center justify-center bg-black rounded-lg overflow-hidden border border-white/10 shadow-lg">
                                <video 
                                    src={videoUrl} 
                                    controls 
                                    autoPlay 
                                    loop 
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-gray-600 gap-3">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                    <Play className="w-8 h-8 opacity-50 ml-1" />
                                </div>
                                <span className="text-sm font-medium">Seu vídeo será exibido aqui</span>
                            </div>
                        )}
                    </div>

                    {/* Footer Controls */}
                    <div className="p-5 bg-black/20 flex gap-3 border-t border-white/5 mt-auto">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || (!prompt && !imageFile)}
                            className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg
                                ${isGenerating 
                                    ? 'bg-purple-500/20 text-purple-300 cursor-not-allowed' 
                                    : (!prompt && !imageFile)
                                        ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:scale-[1.02]'
                                }
                            `}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" /> Processando
                                </>
                            ) : (
                                <>
                                    <Video className="w-5 h-5" /> Gerar Vídeo com Veo 3
                                </>
                            )}
                        </button>
                        
                        <button
                            onClick={handleDownload}
                            disabled={!videoUrl || isGenerating}
                            className={`px-5 rounded-xl border transition-colors flex items-center justify-center
                                ${(!videoUrl || isGenerating) 
                                    ? 'border-white/5 text-gray-600 cursor-not-allowed bg-black/20' 
                                    : 'border-white/10 text-white hover:bg-white/10 hover:border-white/20 bg-white/5 shadow-lg'
                                }
                            `}
                            title="Baixar Vídeo"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
