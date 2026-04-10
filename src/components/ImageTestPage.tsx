import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { generateImageWithNanoBanana } from '../services/google_image';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface TestScene {
    order: number;
    narration_text: string;
    visual_description: string;
    emotion: string;
    characters: string[];
}

interface SceneState {
    prompt: string;
    imageUrl: string;
    isGeneratingPrompt: boolean;
    isGeneratingImage: boolean;
    error: string;
}

const TEST_SCENES: TestScene[] = [
    {
        order: 1,
        narration_text: "Era uma vez, nas profundezas cristalinas do oceano, um peixinho muito especial chamado Pipo.",
        visual_description: "Cena ampla subaquática mostrando um recife de coral colorido. Pipo, um pequeno peixe azul cobalto elétrico com escamas iridescentes e olhos enormes cor de âmbar dourado, nada suavemente. Ele usa um capacete feito de meia casca de noz com uma tira de alga verde como jugular. Iluminação cinematográfica submarina com raios de sol atravessando a água.",
        emotion: "curiosidade",
        characters: ["Pipo"]
    },
    {
        order: 2,
        narration_text: "Pipo adorava explorar, mas tinha um pouco de medo do desconhecido. Seus olhos dourados sempre expressavam uma mistura de curiosidade e timidez.",
        visual_description: "Close-up de Pipo com suas sobrancelhas expressivas levemente inclinadas para cima, mostrando timidez. Seus olhos âmbar dourados brilham com dois pontos de luz branca (brilho especular duplo). Suas barbatanas translúcidas captam a luz do oceano com efeito de subsurface scattering, deixando as pontas rosadas. Ele segura sua pedra de estimação, lisa e cinza.",
        emotion: "medo",
        characters: ["Pipo"]
    },
    {
        order: 3,
        narration_text: "Mas quando Pipo encontrou coragem para explorar a caverna misteriosa, descobriu que não tinha nada a temer!",
        visual_description: "Pipo nadando corajosamente em direção a uma caverna subaquática iluminada por cristais bioluminescentes. Sua pequena pedra de estimação está guardada junto a ele. Seu corpo azul cobalto brilha intensamente contra o fundo escuro da caverna. Estilo Pixar com texturas hiper-detalhadas, iluminação dramática, partículas de luz na água.",
        emotion: "aventura",
        characters: ["Pipo"]
    }
];

export default function ImageTestPage() {
    const { user } = useAuth();
    const [imageTemplate, setImageTemplate] = useState<string>('');
    const [characterDescription, setCharacterDescription] = useState<string>('');
    const [scenes, setScenes] = useState<SceneState[]>([
        { prompt: '', imageUrl: '', isGeneratingPrompt: false, isGeneratingImage: false, error: '' },
        { prompt: '', imageUrl: '', isGeneratingPrompt: false, isGeneratingImage: false, error: '' },
        { prompt: '', imageUrl: '', isGeneratingPrompt: false, isGeneratingImage: false, error: '' },
    ]);

    useEffect(() => {
        loadImageTemplate();
    }, [user]);

    const loadImageTemplate = async () => {
        // Template dinâmico padrão - funciona para qualquer personagem
        const defaultTemplate = `3D Pixar Style Character, [PERSONAGEM], [EMOÇÃO], cinematic lighting, vibrant colors, high quality render, 8k, detailed background, [CENA]`;
        setImageTemplate(defaultTemplate);
        
        // Initial character for testing
        if (!characterDescription) {
            setCharacterDescription('A cute small robot with big blue digital eyes, shiny white metallic body, friendly smile');
        }
    };

    const resetTemplate = () => {
        const defaultTemplate = `3D Pixar Style Character, [PERSONAGEM], [EMOÇÃO], cinematic lighting, vibrant colors, high quality render, 8k, detailed background, [CENA]`;
        setImageTemplate(defaultTemplate);
        alert('Template resetado!');
    };

    const handleGeneratePrompt = async (sceneIndex: number) => {
        const scene = TEST_SCENES[sceneIndex];
        updateSceneState(sceneIndex, { isGeneratingPrompt: true, error: '' });

        try {
            let charDesc = characterDescription;

            if (sceneIndex === 0) {
                // Primeira cena: usar descrição inicial baseada no personagem de teste (Pipo)
                charDesc = 'Pipo: pequeno peixe azul cobalto elétrico, escamas iridescentes brilhantes, olhos enormes âmbar dourado com brilho especular duplo, capacete de meia casca de noz, tira de alga verde como jugular, barbatanas translúcidas com efeito subsurface scattering';
                console.log('[CENA 1] 🎬 Usando descrição inicial do Pipo:', charDesc);
                console.log('[CENA 1] 💡 Após gerar a imagem, atualize a descrição do personagem se necessário!');
            } else {
                // Cenas 2 e 3: EXIGIR descrição do personagem
                if (!characterDescription || characterDescription.trim() === '') {
                    updateSceneState(sceneIndex, {
                        error: '⚠️ Primeiro gere a Cena 1 e defina a descrição do personagem!',
                        isGeneratingPrompt: false
                    });
                    console.error(`[CENA ${sceneIndex + 1}] ❌ Descrição do personagem não definida!`);
                    alert(`⚠️ Atenção!\n\nPara manter a consistência visual:\n\n1. Gere a CENA 1 primeiro\n2. Revise a "Descrição do Personagem"\n3. Depois gere as cenas seguintes\n\nIsso garante que o personagem terá a mesma aparência em todas as cenas!`);
                    return;
                }
                console.log(`[CENA ${sceneIndex + 1}] ✅ Usando descrição salva:`, charDesc);
            }

            const prompt = buildPromptFromTemplate(scene, charDesc);

            console.log(`\n${'='.repeat(80)}`);
            console.log(`[CENA ${sceneIndex + 1}] Prompt Gerado (${prompt.length} chars):`);
            console.log('='.repeat(80));
            console.log(prompt);
            console.log('='.repeat(80));
            console.log(`[PERSONAGEM] "${charDesc}"`);
            console.log('='.repeat(80) + '\n');

            updateSceneState(sceneIndex, { prompt, isGeneratingPrompt: false });
        } catch (error: any) {
            updateSceneState(sceneIndex, {
                error: error.message || 'Erro ao gerar prompt',
                isGeneratingPrompt: false
            });
        }
    };

    const handleGenerateImage = async (sceneIndex: number) => {
        const scene = scenes[sceneIndex];

        if (!scene.prompt) {
            updateSceneState(sceneIndex, { error: 'Gere o prompt primeiro!' });
            return;
        }

        updateSceneState(sceneIndex, { isGeneratingImage: true, error: '' });

        try {
            const dataUrl = await generateImageWithNanoBanana(scene.prompt);
            updateSceneState(sceneIndex, { imageUrl: dataUrl, isGeneratingImage: false });

            // Se for a primeira cena e descrição estiver vazia, sugerir atualização
            if (sceneIndex === 0 && !characterDescription) {
                console.log('[PERSONAGEM] 💡 Dica: Atualize a descrição do personagem com base na imagem gerada!');

                // Sugestão automática baseada no Pipo
                const suggestedDesc = 'Pipo: peixe azul cobalto elétrico com escamas iridescentes, olhos enormes âmbar dourado, capacete de casca de noz marrom, tira de alga verde, barbatanas translúcidas rosadas';
                setCharacterDescription(suggestedDesc);
                console.log('[PERSONAGEM] Descrição sugerida:', suggestedDesc);

                // Mostrar alerta
                setTimeout(() => {
                    alert('🎉 Primeira imagem gerada com sucesso!\n\n' +
                        '📝 PRÓXIMO PASSO IMPORTANTE:\n\n' +
                        '1. 👀 OLHE A IMAGEM GERADA com atenção\n' +
                        '2. 📝 Edite a "Descrição do Personagem" acima\n' +
                        '3. ✍️ Descreva EXATAMENTE o que você vê na imagem:\n' +
                        '   • Cores (azul, âmbar, etc)\n' +
                        '   • Olhos (tamanho, cor, formato)\n' +
                        '   • Acessórios (capacete, etc)\n' +
                        '   • Características únicas\n\n' +
                        '⚠️ IMPORTANTE: Use a IMAGEM GERADA como referência!\n' +
                        '   Não invente características que não estão visíveis.\n\n' +
                        '✅ As Cenas 2 e 3 usarão essa descrição para manter\n' +
                        '   o personagem EXATAMENTE igual!');
                }, 500);
            }
        } catch (error: any) {
            updateSceneState(sceneIndex, {
                error: error.message || 'Erro ao gerar imagem',
                isGeneratingImage: false
            });
        }
    };

    const updateSceneState = (index: number, updates: Partial<SceneState>) => {
        setScenes(prev => {
            const newScenes = [...prev];
            newScenes[index] = { ...newScenes[index], ...updates };
            return newScenes;
        });
    };

    const buildPromptFromTemplate = (scene: TestScene, charDesc: string): string => {
        const compactScene = scene.visual_description;
        const emotionPT = scene.emotion;

        let prompt = imageTemplate;

        // Substituir placeholders principais
        prompt = prompt.replace(/\[PERSONAGEM\]/gi, charDesc);
        prompt = prompt.replace(/\[CENA\]/gi, compactScene);
        prompt = prompt.replace(/\[EMOÇÃO\]/gi, emotionPT);

        // Limpar placeholders com exemplos (ex: [emoção desejada, ex: ...])
        prompt = cleanTemplatePlaceholders(prompt, emotionPT, compactScene);

        // Se o template estiver vazio, usar estrutura básica dinâmica
        if (prompt.length < 50) {
            prompt = `PERSONAGEM: ${charDesc}

IMPORTANTE: Gere o personagem SEM anomalias físicas. Proporções corretas, anatomia realista para desenho animado 3D. Postura natural.

CENA: ${compactScene}

EMOÇÃO: ${emotionPT}

COMPOSIÇÃO: Horizontal, 1920x1080

ESTILO: 3D Pixar/DreamWorks, iluminação cinematográfica, cores vibrantes, alta qualidade`;
        }

        return prompt.trim();
    };

    const cleanTemplatePlaceholders = (prompt: string, emotion: string, scene: string): string => {
        let cleaned = prompt;

        // Substituir [emoção desejada, ex: ...] pela emoção real
        cleaned = cleaned.replace(/\[emoção desejada[^\]]*\]/gi, emotion);

        // Substituir [formato, ex: ...] por descrição genérica
        cleaned = cleaned.replace(/\[formato[^\]]*\]/gi, 'arredondadas');

        // Substituir [ex: floresta ensolarada, ...] pela cena real
        cleaned = cleaned.replace(/\[ex:[^\]]*\]/gi, scene);

        // Remover qualquer outro placeholder com exemplos
        cleaned = cleaned.replace(/\[[^\]]*ex:[^\]]*\]/gi, '');

        return cleaned;
    };

    return (
        <div className="w-full">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-4xl font-bold text-foreground mb-2">
                                🧪 Teste de Consistência de Personagens
                            </h1>
                            <p className="text-muted-foreground">
                                Gere as 3 cenas e veja como o personagem mantém suas características
                            </p>
                        </div>
                        <button
                            onClick={resetTemplate}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all"
                        >
                            🔄 Resetar Template
                        </button>
                    </div>

                    {/* Character Description Editor */}
                    <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-yellow-500">🐄 Descrição do Personagem</h3>
                            <span className="text-xs text-yellow-600">
                                {characterDescription ? '✅ Salva' : '⚠️ Não definida'}
                            </span>
                        </div>
                        <textarea
                            value={characterDescription}
                            onChange={(e) => setCharacterDescription(e.target.value)}
                            placeholder="Ex: Vaca marrom e branca, olhos expressivos, chifres pequenos, manchas características..."
                            className="w-full p-3 bg-background text-foreground border border-yellow-700/30 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            rows={2}
                        />
                        <p className="text-xs text-yellow-600 mt-2">
                            💡 <strong>Dica:</strong> Gere a primeira imagem e depois atualize esta descrição com as características visuais que você vê. As próximas cenas usarão esta descrição para manter a consistência.
                        </p>
                    </div>

                    {/* Template Display */}
                    {imageTemplate && (
                        <div className="mb-4 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-blue-400">📝 Template Atual</h3>
                                <button
                                    onClick={() => {
                                        const elem = document.getElementById('template-display');
                                        if (elem) {
                                            elem.classList.toggle('max-h-40');
                                            elem.classList.toggle('max-h-full');
                                        }
                                    }}
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                    {imageTemplate.length > 200 ? 'Ver mais/menos' : ''}
                                </button>
                            </div>
                            <pre id="template-display" className="text-xs text-blue-300 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                                {imageTemplate}
                            </pre>
                        </div>
                    )}
                </div>

                {/* 3 Scenes Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {TEST_SCENES.map((testScene, index) => {
                        const sceneState = scenes[index];

                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-card border border-border rounded-xl shadow-lg p-6"
                            >
                                <h2 className="text-2xl font-bold text-foreground mb-4">
                                    📝 Cena {testScene.order}
                                </h2>

                                {/* Scene Info */}
                                <div className="space-y-3 mb-4">
                                    <div>
                                        <h3 className="font-semibold text-muted-foreground text-sm mb-1">Descrição Visual:</h3>
                                        <p className="text-muted-foreground text-xs leading-relaxed bg-muted p-2 rounded max-h-32 overflow-y-auto">
                                            {testScene.visual_description}
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                            {testScene.emotion}
                                        </span>
                                    </div>
                                </div>

                                {/* Generate Prompt Button */}
                                <button
                                    onClick={() => handleGeneratePrompt(index)}
                                    disabled={sceneState.isGeneratingPrompt}
                                    className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                                >
                                    {sceneState.isGeneratingPrompt ? '⏳ Gerando...' : '🎨 Gerar Prompt'}
                                </button>

                                {/* Prompt Display */}
                                {sceneState.prompt && (
                                    <div className="mb-3">
                                        <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-40">
                                            {sceneState.prompt}
                                        </pre>
                                        <p className="text-xs text-gray-600 mt-1">
                                            {sceneState.prompt.length} caracteres
                                        </p>
                                    </div>
                                )}

                                {/* Generate Image Button */}
                                {sceneState.prompt && (
                                    <button
                                        onClick={() => handleGenerateImage(index)}
                                        disabled={sceneState.isGeneratingImage}
                                        className="w-full bg-secondary text-secondary-foreground py-2 rounded-lg font-semibold hover:bg-secondary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                                    >
                                        {sceneState.isGeneratingImage ? '⏳ Gerando...' : '🖼️ Gerar Imagem'}
                                    </button>
                                )}

                                {/* Error Display */}
                                {sceneState.error && (
                                    <div className="p-2 bg-destructive/10 border border-destructive/20 rounded mb-3">
                                        <p className="text-destructive text-xs">❌ {sceneState.error}</p>
                                    </div>
                                )}

                                {/* Image Display */}
                                {sceneState.imageUrl && (
                                    <div>
                                        <img
                                            src={sceneState.imageUrl}
                                            alt={`Cena ${testScene.order}`}
                                            className="w-full rounded-lg shadow-md"
                                        />
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

