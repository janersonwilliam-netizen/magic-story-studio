import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Smile, Edit2, Save, X } from 'lucide-react';

interface Scene {
    id?: string;
    order: number;
    narration_text: string;
    visual_description: string;
    emotion: string;
    duration_estimate: number;
    characters: string[];
}

interface SceneListProps {
    scenes: Scene[];
    onSaveScene: (index: number, updatedScene: Scene) => void;
}

export function SceneList({ scenes, onSaveScene }: SceneListProps) {
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
                    className={`bg-white rounded-xl border shadow-sm p-6 ${editingIndex === index ? 'ring-2 ring-purple-600' : ''
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
                                        className="p-2 bg-purple-100 hover:bg-purple-200 rounded-full text-purple-700"
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
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-600 outline-none"
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
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-600 outline-none"
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
                                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
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
                                    className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-purple-600 transition-colors"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                        Narração
                                    </h4>
                                    <p className="text-gray-800 leading-relaxed font-medium">
                                        "{scene.narration_text}"
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                        Visual
                                    </h4>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        {scene.visual_description}
                                    </p>
                                </div>
                            </div>

                            {scene.characters.length > 0 && (
                                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                                    <Users className="h-4 w-4" />
                                    <span>{scene.characters.join(', ')}</span>
                                </div>
                            )}
                        </>
                    )}
                </motion.div>
            ))}
        </div>
    );
}
