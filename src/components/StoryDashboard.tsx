import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Plus, Loader2, BookOpen, Calendar, AlertCircle, Trash2, Play, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CreateStoryForm } from './CreateStoryForm';
import { StoryViewer } from './StoryViewer';

interface Story {
    id: string;
    title: string;
    status: string;
    age_group: string;
    tone: string;
    created_at: string;
}

export function StoryDashboard() {
    const { user, signOut } = useAuth();
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState<'dashboard' | 'create' | 'view'>('dashboard');
    const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

    // Delete modal state
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; storyId: string; storyTitle: string }>({
        isOpen: false,
        storyId: '',
        storyTitle: ''
    });

    useEffect(() => {
        fetchStories();
    }, []);

    async function fetchStories() {
        try {
            setLoading(true);
            setError('');

            const { data, error } = await supabase
                .from('stories')
                .select('id, title, status, age_group, tone, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStories(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleCreateStory = () => {
        setView('create');
    };

    const handleCancelCreate = () => {
        setView('dashboard');
    };

    const handleStoryCreated = async (storyId: string) => {
        await fetchStories();
        setSelectedStoryId(storyId);
        setView('view');
    };

    const handleOpenStory = (storyId: string) => {
        setSelectedStoryId(storyId);
        setView('view');
    };

    const handleDeleteClick = (e: React.MouseEvent, storyId: string, storyTitle: string) => {
        e.stopPropagation();
        setDeleteModal({ isOpen: true, storyId, storyTitle });
    };

    const handleConfirmDelete = async () => {
        try {
            const { error } = await supabase.from('stories').delete().eq('id', deleteModal.storyId);
            if (error) throw error;
            setStories(stories.filter(s => s.id !== deleteModal.storyId));
            setDeleteModal({ isOpen: false, storyId: '', storyTitle: '' });
        } catch (err: any) {
            alert('Erro ao excluir história: ' + err.message);
        }
    };

    const handleCancelDelete = () => {
        setDeleteModal({ isOpen: false, storyId: '', storyTitle: '' });
    };

    const handleBackToDashboard = async () => {
        setView('dashboard');
        setSelectedStoryId(null);
        await fetchStories();
    };

    if (view === 'view' && selectedStoryId) {
        return <StoryViewer storyId={selectedStoryId} onBack={handleBackToDashboard} />;
    }

    if (view === 'create') {
        return <CreateStoryForm onCancel={handleCancelCreate} onSuccess={handleStoryCreated} />;
    }

    return (
        <div className="w-full">
            {/* Action Bar / Chips */}
            <div className="mb-6 flex overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-gray-900 text-white rounded-full text-sm font-medium whitespace-nowrap">Tudo</button>
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm font-medium transition-colors whitespace-nowrap">Histórias para Crianças</button>
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm font-medium transition-colors whitespace-nowrap">Rascunhos</button>
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm font-medium transition-colors whitespace-nowrap">Gerados por IA</button>
                </div>
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-[#FF0000] mb-4" />
                    <p className="text-gray-500">Carregando...</p>
                </div>
            )}

            {!loading && !error && stories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <BookOpen className="h-12 w-12 text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Comece sua primeira história</h2>
                    <p className="text-gray-500 max-w-md mb-6">Crie histórias mágicas e personalizadas em segundos.</p>
                    <button
                        onClick={handleCreateStory}
                        className="px-6 py-2 bg-[#FF0000] text-white rounded-full font-medium hover:bg-red-700 transition-colors"
                    >
                        Criar História
                    </button>
                </div>
            )}

            {!loading && !error && stories.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                    {/* Create New Card */}
                    <motion.button
                        onClick={handleCreateStory}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="group flex flex-col h-full text-left"
                    >
                        <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden mb-3 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center group-hover:border-[#FF0000] group-hover:bg-red-50 transition-colors">
                            <Plus className="h-12 w-12 text-gray-400 group-hover:text-[#FF0000] mb-2 transition-colors" />
                            <span className="text-sm font-medium text-gray-500 group-hover:text-[#FF0000]">Criar Nova</span>
                        </div>
                        <div className="px-1">
                            <h3 className="font-semibold text-gray-900 line-clamp-2 leading-tight mb-1 group-hover:text-[#FF0000]">
                                Nova História Mágica
                            </h3>
                            <p className="text-sm text-gray-500">
                                Clique para começar
                            </p>
                        </div>
                    </motion.button>

                    {stories.map((story, index) => (
                        <motion.div
                            key={story.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="group cursor-pointer flex flex-col h-full"
                            onClick={() => handleOpenStory(story.id)}
                        >
                            {/* Thumbnail */}
                            <div className="relative aspect-video bg-gray-200 rounded-xl overflow-hidden mb-3 group-hover:rounded-none transition-all duration-200">
                                {/* Gradient Placeholder for now (Random color based on title length?) */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${story.status === 'complete' ? 'from-red-500 to-pink-600' : 'from-gray-300 to-gray-400'
                                    } opacity-80 group-hover:opacity-100 transition-opacity`} />

                                <div className="absolute inset-0 flex items-center justify-center">
                                    {story.status === 'complete' ? (
                                        <Play className="h-12 w-12 text-white opacity-80 group-hover:scale-110 transition-transform shadow-lg drop-shadow-md" fill="currentColor" />
                                    ) : (
                                        <Clock className="h-8 w-8 text-white opacity-60" />
                                    )}
                                </div>

                                {/* Duration / Status Badge */}
                                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded flex items-center gap-1">
                                    <span className="text-xs font-medium text-white">
                                        {story.status === 'complete' ? '2:45' : 'RASCUNHO'}
                                    </span>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="px-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-semibold text-gray-900 line-clamp-2 leading-tight mb-1 group-hover:text-black">
                                        {story.title || 'Sem título'}
                                    </h3>
                                    <button
                                        onClick={(e) => handleDeleteClick(e, story.id, story.title)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-full transition-all text-gray-400 hover:text-red-500"
                                        title="Excluir"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="text-sm text-gray-500 flex flex-col">
                                    <span>Magic Studio • {story.age_group}</span>
                                    <span className="flex items-center gap-1 mt-0.5 text-xs">
                                        {story.status === 'complete' ? '12 mil visualizações •' : ''} {new Date(story.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
                    >
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Deseja excluir?</h3>
                        <p className="text-gray-600 mb-6">
                            A história <strong>"{deleteModal.storyTitle}"</strong> será excluída permanentemente.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleCancelDelete}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="px-4 py-2 bg-[#FF0000] text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                            >
                                Excluir
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
