import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Sparkles, Clock, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CreateStoryFormProps {
    onCancel: () => void;
    onSuccess: (storyId: string) => void;
}

export function CreateStoryForm({ onCancel, onSuccess }: CreateStoryFormProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        age_group: '6-8',
        theme: 'classica',
        tone: 'aventura',
        visual_style: 'Estilo Pixar 3D',
        duration: 3, // Duração da história em minutos (texto)
        scene_count: 20, // Quantidade de cenas desejada (15, 20, 25)
        custom_instructions: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Validações
            if (!formData.title.trim()) {
                throw new Error('Título é obrigatório');
            }

            if (formData.title.length > 100) {
                throw new Error('Título deve ter no máximo 100 caracteres');
            }

            // Criar história no banco
            // Armazenamos scene_count dentro de custom_instructions para evitar migração de banco
            const instructionsWithMeta = `${formData.custom_instructions.trim()}\n[SCENE_COUNT: ${formData.scene_count}]`.trim();

            // Construir o StudioState inicial para garantir persistência do rascunho
            const initialStudioState = {
                currentStep: 'NARRATION', // Pula CONFIG porque o formulário já é a configuração
                config: {
                    title: formData.title.trim(),
                    duration: formData.duration,
                    sceneCount: formData.scene_count,
                    visualStyle: formData.visual_style as any,
                    theme: formData.theme,
                    ageGroup: formData.age_group,
                    tone: formData.tone,
                    storyIdea: formData.custom_instructions.trim() || undefined
                }
            };

            // IMPORTANT: Only use columns that exist in the database schema!
            // Schema has: id, user_id, title, preview_image, data, is_complete, created_at, updated_at
            // All other config goes in the 'data' JSONB field
            const { data, error: insertError } = await supabase
                .from('stories')
                .insert({
                    user_id: user?.id,
                    title: formData.title.trim(),
                    data: initialStudioState, // All config saved in JSONB 'data' field
                    is_complete: false,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // Sucesso!
            onSuccess(data.id);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <div className="max-w-2xl mx-auto py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={onCancel}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar ao Dashboard
                    </button>
                    <h1 className="text-3xl font-bold mb-2">Criar Nova História</h1>
                    <p className="text-muted-foreground">
                        Preencha os detalhes para criar sua história mágica
                    </p>
                </div>

                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border shadow-sm p-8"
                >
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {/* Título */}
                        <div className="space-y-2">
                            <label htmlFor="title" className="text-sm font-medium">
                                Título da História *
                            </label>
                            <input
                                id="title"
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF0000]"
                                placeholder="Ex: A Aventura do Coelhinho Curioso"
                                required
                                disabled={loading}
                                maxLength={100}
                            />
                            <p className="text-xs text-muted-foreground">
                                {formData.title.length}/100 caracteres
                            </p>
                        </div>

                        {/* Faixa Etária */}
                        <div className="space-y-2">
                            <label htmlFor="age_group" className="text-sm font-medium">
                                Faixa Etária *
                            </label>
                            <select
                                id="age_group"
                                value={formData.age_group}
                                onChange={(e) => setFormData({ ...formData, age_group: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF0000]"
                                required
                                disabled={loading}
                            >
                                <option value="3-5">3-5 anos</option>
                                <option value="6-8">6-8 anos</option>
                                <option value="9-12">9-12 anos</option>
                            </select>
                        </div>

                        {/* Tema da História */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tema da História *</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { value: 'classica', label: '🧚‍♀️ História Infantil', desc: 'Aventuras lúdicas clássicas' },
                                    { value: 'biblica', label: '📖 História Bíblica', desc: 'Ensinamentos e princípios bíblicos' },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            setFormData({
                                                ...formData,
                                                theme: option.value,
                                                visual_style: option.value === 'biblica' ? 'Estilo 2D Cartoon' : 'Estilo Pixar 3D'
                                            });
                                        }}
                                        disabled={loading}
                                        className={`p-4 border-2 rounded-lg text-left transition-all ${formData.theme === option.value
                                            ? 'border-[#FF5722] bg-[#FF5722]/10'
                                            : 'border-transparent hover:border-[#FF5722]/50'
                                            }`}
                                    >
                                        <div className="font-medium">{option.label}</div>
                                        <div className="text-xs text-muted-foreground">{option.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tom da História */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tom da História *</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { value: 'calma', label: '🌙 Calma', desc: 'Para dormir' },
                                    { value: 'aventura', label: '🚀 Aventura', desc: 'Emocionante' },
                                    { value: 'educativa', label: '📚 Educativa', desc: 'Aprendizado' },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, tone: option.value })}
                                        disabled={loading}
                                        className={`p-4 border-2 rounded-lg text-left transition-all ${formData.tone === option.value
                                            ? 'border-[#FF5722] bg-[#FF5722]/10'
                                            : 'border-transparent hover:border-[#FF5722]/50'
                                            }`}
                                    >
                                        <div className="font-medium">{option.label}</div>
                                        <div className="text-xs text-muted-foreground">{option.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Duração da História (Total) */}
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor="duration" className="text-sm font-medium flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-[#FF0000]" />
                                    Tamanho da História (Texto)
                                </label>
                                <span className="text-sm font-bold text-[#FF0000] bg-red-50 px-3 py-1 rounded-full border border-red-100">
                                    ~{formData.duration} minutos de leitura
                                </span>
                            </div>

                            <div className="relative">
                                <input
                                    id="duration"
                                    type="range"
                                    min="3"
                                    max="10"
                                    step="1"
                                    value={formData.duration}
                                    onChange={(e) =>
                                        setFormData({ ...formData, duration: parseInt(e.target.value) })
                                    }
                                    className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider-thumb-form"
                                    disabled={loading}
                                />
                                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                    <span>Curta (3min)</span>
                                    <span>Média (5min)</span>
                                    <span>Longa (10min)</span>
                                </div>
                            </div>
                        </div>

                        {/* Quantidade de Cenas */}
                        <div className="space-y-4 pt-4 border-t border-dashed">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-[#FF0000]" />
                                    Quantidade de Cenas
                                </label>
                                <span className="text-sm font-bold text-[#FF0000] bg-red-50 px-3 py-1 rounded-full border border-red-100">
                                    {formData.scene_count} cenas
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {[15, 20, 25].map((count) => (
                                    <button
                                        key={count}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, scene_count: count })}
                                        disabled={loading}
                                        className={`p-3 border-2 rounded-lg text-center transition-all ${formData.scene_count === count
                                            ? 'border-[#FF5722] bg-[#FF5722] text-white font-bold'
                                            : 'border-transparent bg-transparent hover:bg-slate-800 text-white'
                                            }`}
                                    >
                                        <div className="text-lg">{count}</div>
                                        <div className="text-xs text-muted-foreground">Cenas</div>
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Define em quantas partes a história será dividida para o vídeo.
                            </p>
                        </div>

                        {/* Estilo Visual */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Estilo Visual *</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { value: 'Estilo Pixar 3D', label: '🎬 3D Pixar/DreamWorks' },
                                    { value: 'Estilo 2D Cartoon', label: '🖍️ 2D Cartoon Animado' },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, visual_style: option.value })}
                                        disabled={loading}
                                        className={`p-4 border-2 rounded-lg text-left transition-all ${formData.visual_style === option.value
                                            ? 'border-[#FF5722] bg-[#FF5722]/10'
                                            : 'border-transparent hover:border-[#FF5722]/50'
                                            }`}
                                    >
                                        <div className="font-medium">{option.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Observações / Instruções Personalizadas */}
                        <div className="space-y-2">
                            <label htmlFor="custom_instructions" className="text-sm font-medium">
                                Observações / Ideias para a História (Opcional)
                            </label>
                            <textarea
                                id="custom_instructions"
                                value={formData.custom_instructions}
                                onChange={(e) => setFormData({ ...formData, custom_instructions: e.target.value })}
                                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF0000] min-h-[120px] resize-y"
                                placeholder="Ex: Quero que a história tenha um dragão amigável, que ensine sobre amizade e coragem. O final deve ser feliz e emocionante."
                                disabled={loading}
                                maxLength={500}
                            />
                            <p className="text-xs text-muted-foreground">
                                {formData.custom_instructions.length}/500 caracteres • Dê ideias sobre personagens, temas, lições ou como quer que a história seja
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={loading}
                                className="flex-1 px-6 py-3 border rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 px-6 py-3 bg-[#FF5722] text-white rounded-lg font-bold hover:bg-[#F4511E] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Criando...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-5 w-5" />
                                        Criar História
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
