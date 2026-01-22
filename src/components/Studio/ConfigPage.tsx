/**
 * CONFIG Page - Story Configuration
 * First step in the Studio workflow
 * User configures: title, duration, average scene duration, visual style
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { StoryConfig, VisualStyle } from '../../types/studio';
import { Sparkles, Clock, Image, Play } from 'lucide-react';

interface ConfigPageProps {
    onComplete: (config: StoryConfig) => void;
}

const VISUAL_STYLES: { value: VisualStyle; label: string; icon: string }[] = [
    { value: 'Estilo Pixar 3D', label: 'Estilo Pixar 3D', icon: '🎬' },
    { value: 'Aquarela Delicada', label: 'Aquarela Delicada', icon: '🎨' },
    { value: 'Desenho Animado Retrô', label: 'Desenho Animado Retrô', icon: '📺' },
    { value: 'Anime Japonês', label: 'Anime Japonês', icon: '🎌' },
    { value: 'Esboço a Lápis', label: 'Esboço a Lápis', icon: '✏️' },
    { value: 'Ilustração de Livro Clássico', label: 'Ilustração de Livro Clássico', icon: '📖' },
];

export function ConfigPage({ onComplete }: ConfigPageProps) {
    const [config, setConfig] = useState<StoryConfig>({
        title: '',
        duration: 5,
        title: '',
        duration: 5,
        sceneCount: 20,
        visualStyle: 'Estilo Pixar 3D',
        ageGroup: '3-5',
        tone: 'aventura'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (config.title.trim()) {
            onComplete(config);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-8"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Qual será a aventura de hoje?
                    </h1>
                    <p className="text-gray-600">
                        Preencha os ingredientes mágicos para sua história.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            TÍTULO DA HISTÓRIA
                        </label>
                        <input
                            type="text"
                            value={config.title}
                            onChange={(e) => setConfig({ ...config, title: e.target.value })}
                            placeholder="Ex: O Coelhinho Astronauta no Planeta Cenoura"
                            className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-[#FF0000] focus:ring-2 focus:ring-red-100 outline-none transition-colors text-gray-900"
                            required
                        />
                    </div>

                    {/* Story Idea (Optional) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            IDEIA DA HISTÓRIA (OPCIONAL)
                        </label>
                        <textarea
                            value={config.storyIdea || ''}
                            onChange={(e) => setConfig({ ...config, storyIdea: e.target.value })}
                            placeholder="Ex: Quero uma história sobre um dragão que tinha medo de fogo mas aprendeu a cozinhar..."
                            className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-[#FF0000] focus:ring-2 focus:ring-red-100 outline-none transition-colors text-gray-900 min-h-[100px] resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Se deixar em branco, vou criar algo surpreendente para você!
                        </p>
                    </div>

                    {/* Duration Slider */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            DURAÇÃO DO CONTO
                        </label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600">CURTO</span>
                            <input
                                type="range"
                                min="2"
                                max="10"
                                value={config.duration}
                                onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                                className="flex-1 h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer slider-thumb"
                            />
                            <span className="text-sm text-gray-600">LONGO</span>
                        </div>
                        <div className="text-center mt-2">
                            <span className="text-3xl font-bold text-[#FF0000]">{config.duration} MIN</span>
                        </div>
                    </div>

                    {/* Quantity of Scenes */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            QUANTIDADE DE CENAS
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {[15, 20, 25].map((count) => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() => setConfig({ ...config, sceneCount: count })}
                                    className={`py-3 px-4 rounded-xl font-semibold transition-all ${config.sceneCount === count
                                        ? 'bg-[#FF0000] text-white shadow-lg scale-105'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {count} cenas
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Visual Style */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            ESCOLHA O ESTILO DE ARTE
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {VISUAL_STYLES.map((style) => (
                                <button
                                    key={style.value}
                                    type="button"
                                    onClick={() => setConfig({ ...config, visualStyle: style.value })}
                                    className={`p-4 rounded-xl border-2 transition-all ${config.visualStyle === style.value
                                        ? 'border-[#FF0000] bg-red-50 shadow-lg'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                >
                                    <div className="text-4xl mb-2">{style.icon}</div>
                                    <div className={`text-sm font-medium ${config.visualStyle === style.value ? 'text-[#FF0000]' : 'text-gray-700'
                                        }`}>
                                        {style.label}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <motion.button
                        type="submit"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={!config.title.trim()}
                        className="w-full py-4 bg-[#FF0000] text-white rounded-xl font-bold text-lg hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            CRIAR HISTÓRIA
                        </span>
                    </motion.button>
                </form>
            </motion.div>

            {/* Custom slider styles */}
            <style>{`
                .slider-thumb::-webkit-slider-thumb {
                    appearance: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #FF0000;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .slider-thumb::-moz-range-thumb {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #FF0000;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
            `}</style>
        </div>
    );
}
