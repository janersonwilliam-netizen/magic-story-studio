import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, UserPlus, Trash2, Sparkles, User } from 'lucide-react';

interface CharacterModalProps {
    isOpen: boolean;
    onClose: () => void;
    detectedCharacters: string[];
    initialDescriptions: Record<string, string>;
    onSave: (descriptions: Record<string, string>) => Promise<void>;
}

export function CharacterModal({
    isOpen,
    onClose,
    detectedCharacters,
    initialDescriptions,
    onSave
}: CharacterModalProps) {
    const [descriptions, setDescriptions] = useState<Record<string, string>>(initialDescriptions);
    const [newCharacterName, setNewCharacterName] = useState('');
    const [saving, setSaving] = useState(false);

    // Merge detected characters with existing descriptions keys to show all
    const allCharacterNames = Array.from(new Set([
        ...detectedCharacters,
        ...Object.keys(descriptions)
    ])).sort();

    useEffect(() => {
        setDescriptions(initialDescriptions);
    }, [initialDescriptions, isOpen]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(descriptions);
            onClose();
        } catch (error) {
            console.error('Error saving characters:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleAddCharacter = () => {
        if (newCharacterName.trim()) {
            setDescriptions(prev => ({
                ...prev,
                [newCharacterName.trim()]: ''
            }));
            setNewCharacterName('');
        }
    };

    const handleRemoveCharacter = (name: string) => {
        if (confirm(`Remover personagem "${name}" da lista?`)) {
            const newDesc = { ...descriptions };
            delete newDesc[name];
            setDescriptions(newDesc);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-red-50 to-pink-50">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2 text-red-900">
                                    <User className="h-6 w-6 text-[#FF0000]" />
                                    Personagens da História
                                </h2>
                                <p className="text-sm text-[#FF0000] mt-1">
                                    Defina a aparência física para manter a consistência nas imagens.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/50 rounded-full transition-colors"
                            >
                                <X className="h-6 w-6 text-gray-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Add New Character Bar */}
                            <div className="flex gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <input
                                    type="text"
                                    value={newCharacterName}
                                    onChange={(e) => setNewCharacterName(e.target.value)}
                                    placeholder="Nome de um novo personagem..."
                                    className="flex-1 px-4 py-2 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddCharacter()}
                                />
                                <button
                                    onClick={handleAddCharacter}
                                    disabled={!newCharacterName.trim()}
                                    className="px-4 py-2 bg-[#FF0000] text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Adicionar
                                </button>
                            </div>

                            {/* Alert Tip */}
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-700">
                                <Sparkles className="h-5 w-5 flex-shrink-0" />
                                <div>
                                    <strong>Dica de Prompt:</strong> Descreva características visuais fixas (cabelo, olhos, roupas principais). Evite emoções ou ações aqui (isso muda a cada cena).
                                    <br />
                                    <em>Ex: "Menino de 8 anos, pele morena, cabelos pretos cacheados curtos, vestindo camiseta amarela e jeans azul."</em>
                                </div>
                            </div>

                            {/* Characters Form */}
                            <div className="space-y-6">
                                {allCharacterNames.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        Nenhum personagem detectado ainda. Adicione um acima!
                                    </div>
                                ) : (
                                    allCharacterNames.map((name) => (
                                        <motion.div
                                            key={name}
                                            layout
                                            className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <h3 className="font-bold text-lg text-gray-800">{name}</h3>
                                                <button
                                                    onClick={() => handleRemoveCharacter(name)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Remover personagem"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <textarea
                                                value={descriptions[name] || ''}
                                                onChange={(e) => setDescriptions({ ...descriptions, [name]: e.target.value })}
                                                placeholder={`Como é a aparência de ${name}?`}
                                                className="w-full h-24 p-3 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none resize-none text-sm"
                                            />
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-[#FF0000] text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                            >
                                {saving ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Salvar Personagens
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

