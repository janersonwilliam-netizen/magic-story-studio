import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
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
        tone: 'aventura',
        duration: 5,
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
            const { data, error: insertError } = await supabase
                .from('stories')
                .insert({
                    user_id: user?.id,
                    title: formData.title.trim(),
                    age_group: formData.age_group,
                    tone: formData.tone,
                    duration: formData.duration,
                    visual_style: '3D Pixar/DreamWorks',
                    status: 'draft',
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
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4">
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
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
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
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                required
                                disabled={loading}
                            >
                                <option value="3-5">3-5 anos</option>
                                <option value="6-8">6-8 anos</option>
                                <option value="9-12">9-12 anos</option>
                            </select>
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
                                                ? 'border-purple-600 bg-purple-50'
                                                : 'border-gray-200 hover:border-purple-300'
                                            }`}
                                    >
                                        <div className="font-medium">{option.label}</div>
                                        <div className="text-xs text-muted-foreground">{option.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Duração */}
                        <div className="space-y-2">
                            <label htmlFor="duration" className="text-sm font-medium">
                                Duração Estimada: {formData.duration} minutos
                            </label>
                            <input
                                id="duration"
                                type="range"
                                min="3"
                                max="10"
                                value={formData.duration}
                                onChange={(e) =>
                                    setFormData({ ...formData, duration: parseInt(e.target.value) })
                                }
                                className="w-full"
                                disabled={loading}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>3 min</span>
                                <span>10 min</span>
                            </div>
                        </div>

                        {/* Estilo Visual (Read-only) */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Estilo Visual</label>
                            <div className="px-4 py-2 bg-gray-50 border rounded-lg text-muted-foreground">
                                3D Pixar/DreamWorks
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Mais estilos em breve!
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
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
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
