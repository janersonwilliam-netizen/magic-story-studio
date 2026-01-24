import React, { useState, useEffect } from 'react';
import { ArrowLeft, Upload, Trash2, Music, Image as ImageIcon, Star, Loader2, Edit2, Layout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storage, StoredFile } from '../lib/storage';

type FileCategory = 'ending_card' | 'music' | 'logo' | 'thumbnail';

export function FilesPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<FileCategory>('ending_card');
    const [files, setFiles] = useState<StoredFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRefs = React.useRef<Record<string, HTMLAudioElement>>({});
    const [uploadLanguage, setUploadLanguage] = useState<'pt' | 'en'>('pt');
    const [editingId, setEditingId] = useState<string | null>(null);

    const togglePlay = (id: string) => {
        const audio = audioRefs.current[id];
        if (!audio) return;

        if (playingId === id) {
            audio.pause();
            setPlayingId(null);
        } else {
            // Stop currently playing
            if (playingId && audioRefs.current[playingId]) {
                audioRefs.current[playingId].pause();
                audioRefs.current[playingId].currentTime = 0;
            }

            audio.play();
            setPlayingId(id);
        }
    };


    // Load files from IndexedDB on mount
    useEffect(() => {
        loadFiles();
    }, []);

    const loadFiles = async () => {
        try {
            const loadedFiles = await storage.getAllFiles();
            setFiles(loadedFiles);
        } catch (error) {
            console.error('Error loading files:', error);
        } finally {
            setInitializing(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const newFile: StoredFile = {
                id: crypto.randomUUID(),
                name: file.name,
                url: reader.result as string,
                type: file.type.startsWith('audio') ? 'audio' : 'image',
                category: activeTab,
                isDefault: files.filter(f => f.category === activeTab).length === 0, // First one is default
                language: uploadLanguage,
                createdAt: Date.now(),
            };

            try {
                await storage.saveFile(newFile);
                setFiles(prev => [...prev, newFile]);
            } catch (error) {
                console.error('Error saving file:', error);
                alert('Erro ao salvar arquivo. O navegador pode estar sem espaço.');
            } finally {
                setLoading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este arquivo?')) {
            try {
                await storage.deleteFile(id);
                setFiles(prev => prev.filter(f => f.id !== id));
            } catch (error) {
                console.error('Error deleting file:', error);
                alert('Erro ao excluir arquivo.');
            }
        }
    };

    const handleSetDefault = async (id: string, category: FileCategory) => {
        const updatedFiles = files.map(f => {
            if (f.category === category) {
                return { ...f, isDefault: f.id === id };
            }
            return f;
        });

        // Optimistic update
        setFiles(updatedFiles);

        // Update in DB
        try {
            // We need to update all files in this category to reflect the new default status
            // This is not super efficient but robust
            const filesToUpdate = updatedFiles.filter(f => f.category === category);
            for (const file of filesToUpdate) {
                await storage.updateFile(file);
            }
        } catch (error) {
            console.error('Error updating defaults:', error);
            // Revert on error would be ideal, but for now just log
        }
    };



    const handleUpdateLanguage = async (file: StoredFile, newLang: 'pt' | 'en') => {
        const updatedFile = { ...file, language: newLang };

        // Optimistic update
        setFiles(prev => prev.map(f => f.id === file.id ? updatedFile : f));
        setEditingId(null);

        try {
            await storage.updateFile(updatedFile);
        } catch (error) {
            console.error('Error updating language:', error);
            // Revert optimistic update if needed, but for simple tag toggle not critical
        }
    };

    const filteredFiles = files.filter(f => f.category === activeTab);

    if (initializing) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#FF0000] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5 text-gray-600" />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Biblioteca de Arquivos</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Tabs */}
                <div className="flex gap-4 mb-8 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('ending_card')}
                        className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === 'ending_card' ? 'text-[#FF0000]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Cartões Finais
                        {activeTab === 'ending_card' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FF0000]" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('thumbnail')}
                        className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === 'thumbnail' ? 'text-[#FF0000]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Capas
                        {activeTab === 'thumbnail' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FF0000]" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('music')}
                        className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === 'music' ? 'text-[#FF0000]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Música de Fundo
                        {activeTab === 'music' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FF0000]" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('logo')}
                        className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === 'logo' ? 'text-[#FF0000]' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Logos
                        {activeTab === 'logo' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FF0000]" />
                        )}
                    </button>
                </div>

                {/* Upload Area */}
                <div className="mb-8">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {loading ? (
                                <Loader2 className="w-8 h-8 mb-3 text-[#FF0000] animate-spin" />
                            ) : (
                                <Upload className="w-8 h-8 mb-3 text-gray-400" />
                            )}
                            <p className="mb-2 text-sm text-gray-500">
                                <span className="font-semibold">{loading ? 'Salvando...' : 'Clique para fazer upload'}</span> {loading ? '' : 'ou arraste e solte'}
                            </p>
                            <p className="text-xs text-gray-500">
                                {activeTab === 'music' ? 'MP3, WAV (Max 10MB)' : 'PNG, JPG, WEBP (Max 5MB)'}
                            </p>

                            {/* Language Selector inside Dropzone (prevents click propagation) */}
                            <div className="mt-2 flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                                <label className="text-xs text-gray-500">Idioma:</label>
                                <select
                                    value={uploadLanguage}
                                    onChange={(e) => setUploadLanguage(e.target.value as 'pt' | 'en')}
                                    className="text-xs bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                >
                                    <option value="pt">Português 🇧🇷</option>
                                    <option value="en">Inglês 🇺🇸</option>
                                </select>
                            </div>
                        </div>
                        <input
                            type="file"
                            className="hidden"
                            accept={activeTab === 'music' ? 'audio/*' : 'image/*'
                            }
                            onChange={handleFileUpload}
                            disabled={loading}
                        />
                    </label>
                </div>

                {/* Files Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredFiles.map((file) => (
                        <div key={file.id} className="group relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                            {/* Preview */}
                            <div className="aspect-video w-full bg-gray-100 flex items-center justify-center overflow-hidden">
                                {file.type === 'image' ? (
                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="relative w-full h-full flex items-center justify-center bg-gray-900 group-hover:bg-gray-800 transition-colors">
                                        <Music className="w-12 h-12 text-gray-600 absolute opacity-20" />

                                        <audio
                                            ref={el => {
                                                if (el) audioRefs.current[file.id] = el;
                                            }}
                                            src={file.url}
                                            onEnded={() => setPlayingId(null)}
                                            className="hidden"
                                        />

                                        <button
                                            onClick={() => togglePlay(file.id)}
                                            className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition-all transform hover:scale-105 z-10"
                                        >
                                            {playingId === file.id ? (
                                                <div className="w-6 h-6 border-l-4 border-r-4 border-white mr-px" />
                                            ) : (
                                                <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2" />
                                            )}
                                        </button>

                                        {playingId === file.id && (
                                            <div className="absolute bottom-4 left-0 w-full flex justify-center gap-1 px-8">
                                                {[...Array(4)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-1 bg-[#FF0000] rounded-full animate-bounce"
                                                        style={{
                                                            height: '16px',
                                                            animationDelay: `${i * 0.1}s`,
                                                            animationDuration: '0.6s'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions Overlay */}
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleSetDefault(file.id, file.category)}
                                    title="Definir como padrão"
                                    className={`p-1.5 rounded-full ${file.isDefault ? 'bg-yellow-400 text-white' : 'bg-gray-900/50 text-white hover:bg-gray-900'}`}
                                >
                                    <Star className={`w-4 h-4 ${file.isDefault ? 'fill-current' : ''}`} />
                                </button>
                                <button
                                    onClick={() => setEditingId(file.id)}
                                    title="Editar idioma"
                                    className="p-1.5 bg-gray-900/50 text-white rounded-full hover:bg-gray-900 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(file.id)}
                                    className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Info */}
                            <div className="p-3">
                                {editingId === file.id ? (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                        <select
                                            autoFocus
                                            value={file.language || 'pt'}
                                            onChange={(e) => handleUpdateLanguage(file, e.target.value as 'pt' | 'en')}
                                            onBlur={() => setEditingId(null)}
                                            className="text-xs bg-gray-50 border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        >
                                            <option value="pt">Português 🇧🇷</option>
                                            <option value="en">Inglês 🇺🇸</option>
                                        </select>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                                            {file.name}
                                        </p>
                                        {/* Language Badge */}
                                        {file.language && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 ${file.language === 'pt' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {file.language.toUpperCase()}
                                            </span>
                                        )}
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-xs text-gray-500">
                                                {new Date(file.createdAt).toLocaleDateString()}
                                            </p>
                                            {file.isDefault && (
                                                <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Star className="w-3 h-3 fill-current" />
                                                    Padrão
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {filteredFiles.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>Nenhum arquivo encontrado nesta categoria.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
