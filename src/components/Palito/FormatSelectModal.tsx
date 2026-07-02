import React from 'react';
import { X, Clapperboard, Zap } from 'lucide-react';
import { PalitoFormat } from '../../types/palito';

interface FormatSelectModalProps {
    onSelect: (format: PalitoFormat) => void;
    onClose: () => void;
}

export function FormatSelectModal({ onSelect, onClose }: FormatSelectModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>

                <h2 className="text-xl font-bold text-white mb-1">Qual formato você quer criar?</h2>
                <p className="text-gray-400 text-sm mb-6">Isso define o tamanho do roteiro e o formato das imagens.</p>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => onSelect('VIDEO')}
                        className="flex flex-col items-start gap-3 p-5 bg-[#242426] border border-border rounded-xl text-left hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                        <div className="p-2.5 bg-primary/10 rounded-lg">
                            <Clapperboard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm">Vídeo História</p>
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                Roteiro completo (4–6 min), com capa para YouTube. Imagens 16:9.
                            </p>
                        </div>
                    </button>

                    <button
                        onClick={() => onSelect('SHORTS')}
                        className="flex flex-col items-start gap-3 p-5 bg-[#242426] border border-border rounded-xl text-left hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                        <div className="p-2.5 bg-primary/10 rounded-lg">
                            <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm">Shorts</p>
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                Roteiro viral de até 60s, sem capa. Imagens verticais 9:16.
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
