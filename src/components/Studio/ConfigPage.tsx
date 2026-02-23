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

export const VISUAL_STYLES: { value: VisualStyle; label: string; icon: string }[] = [
    { value: 'Estilo Pixar 3D', label: 'Estilo Pixar 3D', icon: '🎬' },
    { value: 'Estilo 2D Cartoon', label: 'Estilo 2D Cartoon', icon: '🖍️' },
];

export function ConfigPage({ onComplete }: ConfigPageProps) {
    const [config, setConfig] = useState<StoryConfig>({
        title: '',
        duration: 5,
        sceneCount: 20,
        visualStyle: 'Estilo Pixar 3D',
        theme: 'classica',
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
        <div className="max-w-6xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-2xl shadow-lg p-8 border border-border"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-foreground mb-2">
                        Qual será a aventura de hoje?
                    </h1>
                    <p className="text-muted-foreground">
                        Preencha os ingredientes mágicos para sua história.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                            TÍTULO DA HISTÓRIA
                        </label>
                        <input
                            type="text"
                            value={config.title}
                            onChange={(e) => setConfig({ ...config, title: e.target.value })}
                            placeholder="Ex: O Coelhinho Astronauta no Planeta Cenoura"
                            className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-foreground placeholder:text-muted-foreground/50"
                            required
                        />
                    </div>

                    {/* Story Idea (Optional) */}
                    <div>
                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                            IDEIA DA HISTÓRIA (OPCIONAL)
                        </label>
                        <textarea
                            value={config.storyIdea || ''}
                            onChange={(e) => setConfig({ ...config, storyIdea: e.target.value })}
                            placeholder="Ex: Quero uma história sobre um dragão que tinha medo de fogo mas aprendeu a cozinhar..."
                            className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-foreground min-h-[100px] resize-none placeholder:text-muted-foreground/50"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Se deixar em branco, vou criar algo surpreendente para você!
                        </p>
                    </div>

                    {/* Theme */}
                    <div>
                        <label className="block text-sm font-semibold text-muted-foreground mb-3">
                            TEMA DA HISTÓRIA
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { value: 'classica', label: '🧚‍♀️ História Infantil Clássica', desc: 'Aventuras lúdicas' },
                                { value: 'biblica', label: '📖 História Bíblica', desc: 'Ensinamentos e princípios' },
                            ].map((theme) => (
                                <button
                                    key={theme.value}
                                    type="button"
                                    onClick={() => {
                                        setConfig({
                                            ...config,
                                            theme: theme.value,
                                            visualStyle: theme.value === 'biblica' ? 'Estilo 2D Cartoon' : 'Estilo Pixar 3D'
                                        });
                                    }}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col text-left ${config.theme === theme.value
                                        ? 'border-primary bg-primary/5 shadow-lg'
                                        : 'border-border hover:border-primary/50 bg-card hover:bg-secondary/50'
                                        }`}
                                >
                                    <span className="font-bold text-lg mb-1">{theme.label}</span>
                                    <span className="text-sm text-muted-foreground">{theme.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration Slider */}
                    <div>
                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                            DURAÇÃO DO CONTO
                        </label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">CURTO</span>
                            <input
                                type="range"
                                min="2"
                                max="10"
                                value={config.duration}
                                onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                                className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider-thumb"
                            />
                            <span className="text-sm text-muted-foreground">LONGO</span>
                        </div>
                        <div className="text-center mt-2">
                            <span className="text-3xl font-bold text-primary">{config.duration} MIN</span>
                        </div>
                    </div>

                    {/* Quantity of Scenes */}
                    <div>
                        <label className="block text-sm font-semibold text-muted-foreground mb-3">
                            QUANTIDADE DE CENAS
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {[15, 20, 25].map((count) => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() => setConfig({ ...config, sceneCount: count })}
                                    className={`py-3 px-4 rounded-xl font-semibold transition-all ${config.sceneCount === count
                                        ? 'bg-[#FF5722] text-white shadow-lg scale-105'
                                        : 'bg-transparent text-white hover:bg-secondary/50'
                                        }`}
                                >
                                    {count} cenas
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Visual Style */}
                    <div>
                        <label className="block text-sm font-semibold text-muted-foreground mb-3">
                            ESCOLHA O ESTILO DE ARTE
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {VISUAL_STYLES.map((style) => (
                                <button
                                    key={style.value}
                                    type="button"
                                    onClick={() => setConfig({ ...config, visualStyle: style.value })}
                                    className={`p-4 rounded-xl border-2 transition-all ${config.visualStyle === style.value
                                        ? 'border-primary bg-primary/5 shadow-lg'
                                        : 'border-border hover:border-primary/50 bg-card hover:bg-secondary/50'
                                        }`}
                                >
                                    <div className="text-4xl mb-2">{style.icon}</div>
                                    <div className={`text-sm font-medium ${config.visualStyle === style.value ? 'text-primary' : 'text-muted-foreground'
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
                        className="w-full py-4 bg-[#FF5722] text-white rounded-xl font-bold text-lg hover:bg-[#F4511E] transition-colors disabled:bg-muted disabled:cursor-not-allowed shadow-lg"
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
                    background: #FF5722;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .slider-thumb::-moz-range-thumb {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #FF5722;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
            `}</style>
        </div>
    );
}
