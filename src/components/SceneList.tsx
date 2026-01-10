import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Smile, Edit2, Save, X, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Volume2, Download } from 'lucide-react';
import { useSafeImage } from '../hooks/useSafeImage';

interface Scene {
    id?: string;
    order: number;
    narration_text: string;
    visual_description: string;
    emotion: string;
    duration_estimate: number;
    characters: string[];
    image_prompt?: string;
    imageUrl?: string;
    audioUrl?: string;
}

interface SceneListProps {
    scenes: Scene[];
    onSaveScene: (index: number, updatedScene: Scene) => void;
    onGenerateImage: (index: number) => void;
    onGeneratePrompt: (index: number) => void;
    onUpdatePrompt: (index: number, prompt: string) => void;
    onGenerateAudio: (index: number) => void;
    generatingImageIndex: number | null;
    generatingPromptIndex: number | null;
    generatingAudioIndex: number | null;
}

export function SceneList({
    scenes,
    onSaveScene,
    onGenerateImage,
    onGeneratePrompt,
    onUpdatePrompt,
    onGenerateAudio,
    generatingImageIndex,
    generatingPromptIndex,
    generatingAudioIndex
}: SceneListProps) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Scene | null>(null);

    const startEditing = (index: number, scene: Scene) => {
        setEditingIndex(index);
        setEditForm({ ...scene });
    };

    const cancelEditing = () => {
        setEditingIndex(null);
        setEditForm(null);
    };

    const saveEditing = () => {
        if (editingIndex !== null && editForm) {
            onSaveScene(editingIndex, editForm);
            setEditingIndex(null);
            setEditForm(null);
        }
    };

    const getEmotionEmoji = (emotion: string) => {
        const map: Record<string, string> = {
            alegre: '😊',
            calma: '😌',
            aventura: '🏃',
            surpresa: '😲',
            medo: '😨',
            tristeza: '😢',
            curiosidade: '🧐',
        };
        return map[emotion.toLowerCase()] || '😐';
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Cenas da História ({scenes.length})</h2>

            {scenes.map((scene, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-white rounded-xl border shadow-sm p-6 ${editingIndex === index ? 'ring-2 ring-[#FF0000]' : ''
                        }`}
                >
                    {editingIndex === index && editForm ? (
                        // Form de Edição
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-lg">Cena {scene.order}</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={cancelEditing}
                                        className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={saveEditing}
                                        className="p-2 bg-red-100 hover:bg-red-200 rounded-full text-red-700"
                                    >
                                        <Save className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Narração</label>
                                <textarea
                                    value={editForm.narration_text}
                                    onChange={(e) =>
                                        setEditForm({ ...editForm, narration_text: e.target.value })
                                    }
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#FF0000] outline-none"
                                    rows={3}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Descrição Visual</label>
                                <textarea
                                    value={editForm.visual_description}
                                    onChange={(e) =>
                                        setEditForm({ ...editForm, visual_description: e.target.value })
                                    }
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#FF0000] outline-none"
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Emoção</label>
                                    <select
                                        value={editForm.emotion}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, emotion: e.target.value })
                                        }
                                        className="w-full p-2 border rounded-lg outline-none"
                                    >
                                        {['alegre', 'calma', 'aventura', 'surpresa', 'medo', 'tristeza', 'curiosidade'].map(e => (
                                            <option key={e} value={e}>{e}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Duração (s)</label>
                                    <input
                                        type="number"
                                        value={editForm.duration_estimate}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, duration_estimate: parseInt(e.target.value) })
                                        }
                                        className="w-full p-2 border rounded-lg outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Personagens (separados por vírgula)</label>
                                <input
                                    type="text"
                                    value={editForm.characters.join(', ')}
                                    onChange={(e) =>
                                        setEditForm({
                                            ...editForm,
                                            characters: e.target.value.split(',').map((c) => c.trim()),
                                        })
                                    }
                                    className="w-full p-2 border rounded-lg outline-none"
                                />
                            </div>
                        </div>
                    ) : (
                        // Visualização
                        <>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold">
                                        {scene.order}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-4 w-4" /> {scene.duration_estimate}s
                                        </span>
                                        <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                                            {getEmotionEmoji(scene.emotion)} {scene.emotion}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => startEditing(index, scene)}
                                    className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#FF0000] transition-colors"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Left Column: Narrativa & Prompt */}
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                            Narração
                                        </h4>
                                        <p className="text-gray-800 leading-relaxed font-medium">
                                            "{scene.narration_text}"
                                        </p>
                                    </div>

                                    {scene.characters.length > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Users className="h-4 w-4" />
                                            <span>{scene.characters.join(', ')}</span>
                                        </div>
                                    )}

                                    <div>
                                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                                            Prompt da Imagem
                                            {scene.image_prompt && (
                                                <button
                                                    onClick={() => onGeneratePrompt(index)}
                                                    className="text-[10px] text-[#FF0000] hover:underline flex items-center gap-1 font-normal normal-case"
                                                    disabled={generatingPromptIndex === index}
                                                >
                                                    {generatingPromptIndex === index ? (
                                                        <><Loader2 className="h-3 w-3 animate-spin" /> IA Criando...</>
                                                    ) : (
                                                        <><RefreshCw className="h-3 w-3" /> Resetar com IA</>
                                                    )}
                                                </button>
                                            )}
                                        </h4>

                                        {!scene.image_prompt ? (
                                            <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg text-center">
                                                <p className="text-sm text-gray-500 mb-3">O prompt descreve a cena para a IA gerar a imagem.</p>
                                                <button
                                                    onClick={() => onGeneratePrompt(index)}
                                                    disabled={generatingPromptIndex === index}
                                                    className="px-4 py-2 bg-white border border-[#FF0000] text-[#FF0000] rounded-lg hover:bg-red-50 transition-colors inline-flex items-center gap-2 text-sm font-medium"
                                                >
                                                    {generatingPromptIndex === index ? (
                                                        <><Loader2 className="h-4 w-4 animate-spin" /> Criando prompt...</>
                                                    ) : (
                                                        <><Sparkles className="h-4 w-4" /> Gerar Prompt Automático</>
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="relative">
                                                    <textarea
                                                        value={scene.image_prompt}
                                                        onChange={(e) => onUpdatePrompt(index, e.target.value)}
                                                        className="w-full text-sm p-3 bg-white border rounded-lg focus:ring-2 focus:ring-[#FF0000] outline-none text-gray-700 font-sans shadow-sm"
                                                        rows={5}
                                                        placeholder="Descreva a cena para gerar a imagem..."
                                                    />
                                                    <div className="absolute top-2 right-2">
                                                        <Edit2 className="h-4 w-4 text-gray-300" />
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => onGenerateImage(index)}
                                                        disabled={generatingImageIndex === index}
                                                        className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                                    >
                                                        {generatingImageIndex === index ? (
                                                            <><Loader2 className="h-5 w-5 animate-spin" /> Gerando Arte...</>
                                                        ) : (
                                                            <><ImageIcon className="h-5 w-5" /> {scene.imageUrl ? 'Gerar Novamente (Com Ajuste)' : 'Gerar Imagem'}</>
                                                        )}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-center text-gray-400">
                                                    Edite o prompt acima e clique em Gerar para ajustar a imagem.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column: Imagem & Audio */}
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                            Resultado Visual
                                        </h4>

                                        <SceneImage scene={scene} generatingImageIndex={generatingImageIndex} index={index} />
                                    </div>

                                    {/* Audio Section - Compact */}
                                    <div className="pt-4 border-t">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                Narração (Áudio)
                                            </h4>
                                            {scene.audioUrl && (
                                                <button
                                                    onClick={() => onGenerateAudio(index)}
                                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                    disabled={generatingAudioIndex === index}
                                                >
                                                    <RefreshCw className={`h-3 w-3 ${generatingAudioIndex === index ? 'animate-spin' : ''}`} />
                                                    Regenerar
                                                </button>
                                            )}
                                        </div>

                                        {scene.audioUrl ? (
                                            <audio
                                                controls
                                                src={scene.audioUrl}
                                                className="w-full h-8"
                                            />
                                        ) : (
                                            <button
                                                onClick={() => onGenerateAudio(index)}
                                                disabled={generatingAudioIndex === index}
                                                className="w-full py-2 border border-dashed border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-xs font-medium"
                                            >
                                                {generatingAudioIndex === index ? (
                                                    <><Loader2 className="h-3 w-3 animate-spin" /> Gerando...</>
                                                ) : (
                                                    <><Volume2 className="h-3 w-3" /> Gerar Áudio</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </motion.div>
            ))}
        </div>
    );
}


function SceneImage({ scene, generatingImageIndex, index }: { scene: Scene, generatingImageIndex: number | null, index: number }) {
    const { imageSrc, isLoading, error } = useSafeImage(scene.imageUrl);

    if (!scene.imageUrl) {
        return (
            <div className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                {generatingImageIndex === index ? (
                    <>
                        <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-4" />
                        <p className="font-medium text-purple-700">A mágica está acontecendo...</p>
                        <p className="text-xs text-purple-500 mt-2">Transformando seu prompt em arte</p>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <ImageIcon className="h-8 w-8 opacity-50" />
                        </div>
                        <p className="font-medium">Nenhuma imagem gerada</p>
                        <p className="text-xs mt-2 max-w-[200px]">Use o painel ao lado para definir o prompt e gerar a imagem.</p>
                    </>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="relative group rounded-xl overflow-hidden border bg-gray-50 shadow-md aspect-video">
                {isLoading && (
                    <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                )}

                {(imageSrc || error) && (
                    <img
                        src={imageSrc || 'https://placehold.co/1280x720/FEE2E2/DC2626?text=Erro+ao+Carregar+Imagem+(Clique+em+Link+Direto)'}
                        alt={`Cena ${scene.order}`}
                        className="w-full h-full object-cover"
                    />
                )}

                {generatingImageIndex === index && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-2" />
                            <p className="text-sm font-bold text-purple-800">Criando nova versão...</p>
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto z-20">
                    <a
                        href={scene.imageUrl}
                        download={`cena-${scene.order}.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-green-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-100 shadow-lg cursor-pointer transform hover:scale-105 transition-all"
                    >
                        <Download className="h-4 w-4" /> Baixar
                    </a>
                    <button
                        onClick={() => {
                            const newTab = window.open();
                            if (newTab) {
                                newTab.document.body.innerHTML = `<img src="${scene.imageUrl}" style="width:100%;height:auto;">`;
                            }
                        }}
                        className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-100 shadow-lg cursor-pointer transform hover:scale-105 transition-all"
                    >
                        🔍 Ampliar
                    </button>
                </div>
            </div>
            <div className="text-right mt-1">
                <a
                    href={scene.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-gray-400 hover:text-blue-500 underline decoration-dotted transition-colors"
                >
                    Link Direto (Debug)
                </a>
            </div>
        </>
    );
}

