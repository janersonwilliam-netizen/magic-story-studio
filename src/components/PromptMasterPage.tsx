import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, RotateCcw, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

import {
    DEFAULT_INSTRUCTIONS_CLASSICA,
    DEFAULT_INSTRUCTIONS_BIBLICA,
    DEFAULT_IMAGE_TEMPLATE_3D,
    DEFAULT_IMAGE_TEMPLATE_2D,
    DEFAULT_CHARACTER_SHEET
} from '../lib/promptDefaults';

export function PromptMasterPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS_CLASSICA);
    const [instructionsBiblica, setInstructionsBiblica] = useState(DEFAULT_INSTRUCTIONS_BIBLICA);
    const [imageTemplate, setImageTemplate] = useState(DEFAULT_IMAGE_TEMPLATE_3D);
    const [imageTemplate2D, setImageTemplate2D] = useState(DEFAULT_IMAGE_TEMPLATE_2D);
    const [characterSheet, setCharacterSheet] = useState(DEFAULT_CHARACTER_SHEET);

    const [mainTab, setMainTab] = useState<'historias' | 'imagens'>('historias');
    const [historiaTab, setHistoriaTab] = useState<'classica' | 'biblica'>('classica');
    const [imagemTab, setImagemTab] = useState<'3d' | '2d'>('3d');

    useEffect(() => {
        loadPreferences();
    }, []);

    async function loadPreferences() {
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('user_preferences')
                .select('master_prompt_instructions, master_prompt_instructions_biblica, image_prompt_template, image_prompt_template_2d')
                .eq('user_id', user?.id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

            if (data) {
                setInstructions(data.master_prompt_instructions || DEFAULT_INSTRUCTIONS_CLASSICA);
                setInstructionsBiblica(data.master_prompt_instructions_biblica || DEFAULT_INSTRUCTIONS_BIBLICA);
                setImageTemplate(data.image_prompt_template || DEFAULT_IMAGE_TEMPLATE_3D);
                setImageTemplate2D(data.image_prompt_template_2d || DEFAULT_IMAGE_TEMPLATE_2D);
                // setCharacterSheet(data.character_sheet_template || DEFAULT_CHARACTER_SHEET);
                setCharacterSheet(DEFAULT_CHARACTER_SHEET);
            }
        } catch (err: any) {
            console.error('Error loading preferences:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        try {
            setSaving(true);
            setError('');

            const { error: upsertError } = await supabase
                .from('user_preferences')
                .upsert({
                    user_id: user?.id,
                    master_prompt_instructions: instructions,
                    master_prompt_instructions_biblica: instructionsBiblica,
                    image_prompt_template: imageTemplate,
                    image_prompt_template_2d: imageTemplate2D,
                    // character_sheet_template: characterSheet,
                }, { onConflict: 'user_id' });

            if (upsertError) throw upsertError;

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    function handleReset() {
        if (confirm('Tem certeza que deseja restaurar os valores padrão de todas as abas?')) {
            setInstructions(DEFAULT_INSTRUCTIONS_CLASSICA);
            setInstructionsBiblica(DEFAULT_INSTRUCTIONS_BIBLICA);
            setImageTemplate(DEFAULT_IMAGE_TEMPLATE_3D);
            setImageTemplate2D(DEFAULT_IMAGE_TEMPLATE_2D);
            setCharacterSheet(DEFAULT_CHARACTER_SHEET);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">✨ Prompt Mestre</h1>
                    <p className="text-muted-foreground">
                        Personalize as instruções que a IA usa para criar suas histórias
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Success Message */}
                {saved && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-500/10 text-green-500 p-4 rounded-lg mb-6 flex items-center gap-2"
                    >
                        <Check className="h-5 w-5" />
                        Salvo com sucesso!
                    </motion.div>
                )}

                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-xl border border-border shadow-sm p-8 space-y-6"
                >
                    {/* Main Tabs Selection */}
                    <div className="flex space-x-2 border-b border-border pb-4 mb-4">
                        <button
                            onClick={() => setMainTab('historias')}
                            className={`px-6 py-2 rounded-t-lg font-bold transition-colors ${mainTab === 'historias' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                        >
                            📚 Estilos de História
                        </button>
                        <button
                            onClick={() => setMainTab('imagens')}
                            className={`px-6 py-2 rounded-t-lg font-bold transition-colors ${mainTab === 'imagens' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                        >
                            🖼️ Estilos de Imagem
                        </button>
                    </div>

                    {mainTab === 'historias' && (
                        <>
                            {/* Historia Sub Tabs */}
                            <div className="flex space-x-2 border-b border-border pb-4 mb-6">
                                <button
                                    onClick={() => setHistoriaTab('classica')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${historiaTab === 'classica' ? 'bg-primary/20 text-primary' : 'bg-transparent text-muted-foreground hover:bg-secondary/50'}`}
                                >
                                    Histórias Infantis Clássicas
                                </button>
                                <button
                                    onClick={() => setHistoriaTab('biblica')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${historiaTab === 'biblica' ? 'bg-amber-500/20 text-amber-500' : 'bg-transparent text-muted-foreground hover:bg-secondary/50'}`}
                                >
                                    Histórias Infantis Bíblicas
                                </button>
                            </div>

                            <div className="space-y-6">
                                {historiaTab === 'classica' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">
                                            Instruções de História (Clássica)
                                        </label>
                                        <textarea
                                            value={instructions}
                                            onChange={(e) => setInstructions(e.target.value)}
                                            className="w-full px-4 py-3 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[300px] resize-y font-mono text-sm"
                                            placeholder="Instruções para histórias clássicas..."
                                        />
                                        <p className="text-xs text-muted-foreground">{instructions.length} caracteres</p>
                                    </div>
                                )}

                                {historiaTab === 'biblica' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-amber-500">
                                            Instruções de História (Bíblica)
                                        </label>
                                        <textarea
                                            value={instructionsBiblica}
                                            onChange={(e) => setInstructionsBiblica(e.target.value)}
                                            className="w-full px-4 py-3 bg-background text-foreground border border-amber-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[300px] resize-y font-mono text-sm"
                                            placeholder="Instruções para histórias baseadas na Bíblia..."
                                        />
                                        <p className="text-xs text-muted-foreground">{instructionsBiblica.length} caracteres</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {mainTab === 'imagens' && (
                        <>
                            {/* Imagem Sub Tabs */}
                            <div className="flex space-x-2 border-b border-border pb-4 mb-6">
                                <button
                                    onClick={() => setImagemTab('3d')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${imagemTab === '3d' ? 'bg-primary/20 text-primary' : 'bg-transparent text-muted-foreground hover:bg-secondary/50'}`}
                                >
                                    Estilo 3D Pixar
                                </button>
                                <button
                                    onClick={() => setImagemTab('2d')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${imagemTab === '2d' ? 'bg-blue-500/20 text-blue-500' : 'bg-transparent text-muted-foreground hover:bg-secondary/50'}`}
                                >
                                    2D Cartoon
                                </button>
                            </div>

                            <div className="space-y-6">
                                {imagemTab === '3d' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">
                                                Template Base de Imagens (3D Pixar)
                                            </label>
                                            <textarea
                                                value={imageTemplate}
                                                onChange={(e) => setImageTemplate(e.target.value)}
                                                className="w-full px-4 py-3 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[300px] resize-y font-mono text-sm"
                                                placeholder="Template para imagens 3D Pixar..."
                                            />
                                            <p className="text-xs text-muted-foreground">{imageTemplate.length} caracteres</p>
                                        </div>

                                        {/* Character Sheet Oficial */}
                                        <div className="space-y-2 border-t pt-6">
                                            <label className="text-sm font-medium flex items-center gap-2">
                                                🎨 Character Sheet Oficial (3D Pixar)
                                            </label>
                                            <p className="text-xs text-muted-foreground mb-2">
                                                Use este template para criar descrições detalhadas e consistentes dos personagens
                                            </p>
                                            <textarea
                                                value={characterSheet}
                                                onChange={(e) => setCharacterSheet(e.target.value)}
                                                className="w-full px-4 py-3 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[400px] resize-y font-mono text-sm"
                                                placeholder="Template para Character Sheet..."
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {characterSheet.length} caracteres • Substitua [NOME DO PERSONAGEM] e demais campos para cada personagem
                                            </p>
                                        </div>
                                    </>
                                )}

                                {imagemTab === '2d' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-blue-500">
                                            Template Base de Imagens (2D Cartoon)
                                        </label>
                                        <textarea
                                            value={imageTemplate2D}
                                            onChange={(e) => setImageTemplate2D(e.target.value)}
                                            className="w-full px-4 py-3 bg-background text-foreground border border-blue-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[300px] resize-y font-mono text-sm"
                                            placeholder="Template para imagens 2D Cartoon..."
                                        />
                                        <p className="text-xs text-muted-foreground">{imageTemplate2D.length} caracteres</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleReset}
                            className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-secondary/80 text-foreground transition-colors flex items-center gap-2"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Restaurar Padrão
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    Salvar Alterações
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
