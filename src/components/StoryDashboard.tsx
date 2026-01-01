import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Plus, Loader2, BookOpen, Calendar, AlertCircle } from 'lucide-react';
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
        // Refresh stories list
        await fetchStories();
        // Open the newly created story
        setSelectedStoryId(storyId);
        setView('view');
    };

    const handleOpenStory = (storyId: string) => {
        setSelectedStoryId(storyId);
        setView('view');
    };

    const handleBackToDashboard = async () => {
        setView('dashboard');
        setSelectedStoryId(null);
        // Refresh stories list
        await fetchStories();
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            draft: 'bg-yellow-100 text-yellow-800',
            generating: 'bg-blue-100 text-blue-800',
            complete: 'bg-green-100 text-green-800',
            error: 'bg-red-100 text-red-800',
        };

        const labels = {
            draft: 'Rascunho',
            generating: 'Gerando',
            complete: 'Completo',
            error: 'Erro',
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.draft}`}>
                {labels[status as keyof typeof labels] || status}
            </span>
        );
    };

    // Show story viewer
    if (view === 'view' && selectedStoryId) {
        return <StoryViewer storyId={selectedStoryId} onBack={handleBackToDashboard} />;
    }

    // Show create form
    if (view === 'create') {
        return <CreateStoryForm onCancel={handleCancelCreate} onSuccess={handleStoryCreated} />;
    }

    // Show dashboard
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                Magic Story Studio
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
                        </div>
                        <button
                            onClick={signOut}
                            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            Sair
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Create Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <button
                        onClick={handleCreateStory}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-lg"
                    >
                        <Plus className="h-5 w-5" />
                        Criar Nova História
                    </button>
                </motion.div>

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="h-12 w-12 animate-spin text-purple-600 mb-4" />
                        <p className="text-muted-foreground">Carregando suas histórias...</p>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3"
                    >
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-red-900 mb-1">Erro ao carregar histórias</h3>
                            <p className="text-sm text-red-700">{error}</p>
                            <button
                                onClick={fetchStories}
                                className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Empty State */}
                {!loading && !error && stories.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl border shadow-sm p-12 text-center"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="h-10 w-10 text-purple-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Nenhuma história criada ainda</h2>
                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                            Comece sua jornada mágica criando sua primeira história infantil com IA!
                        </p>
                        <button
                            onClick={handleCreateStory}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                        >
                            <Plus className="h-5 w-5" />
                            Criar Minha Primeira História
                        </button>
                    </motion.div>
                )}

                {/* Stories List */}
                {!loading && !error && stories.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold mb-4">Minhas Histórias ({stories.length})</h2>
                        {stories.map((story, index) => (
                            <motion.div
                                key={story.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold truncate">{story.title}</h3>
                                            {getStatusBadge(story.status)}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4" />
                                                {new Date(story.created_at).toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            </span>
                                            <span>Idade: {story.age_group}</span>
                                            <span className="capitalize">Tom: {story.tone}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleOpenStory(story.id)}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex-shrink-0"
                                    >
                                        Abrir
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
