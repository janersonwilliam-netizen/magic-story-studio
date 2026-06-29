import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Sparkles, Plus, Clock, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storyStorage, StoryProject } from '../lib/storyStorage';

export function Dashboard() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

    const [stories, setStories] = useState<StoryProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        if (user?.id) {
            loadStories();
        }
    }, [user?.id, page, pageSize]);

    const loadStories = async () => {
        try {
            setLoading(true);

            // 1. Carrega o que existe só localmente (para mesclar na 1ª página)
            const localData = await storyStorage.getLocalStories();

            // 2. Página da nuvem
            const pageData = await storyStorage.getStoriesPage(page, pageSize);

            // Na primeira página, mescla as histórias que existem só localmente
            // (ex.: que não sincronizaram) para que nenhuma suma do dashboard.
            let list = pageData.stories;
            if (page === 0) {
                const cloudIds = new Set(list.map(s => s.id));
                const localOnly = localData.filter(s => !cloudIds.has(s.id));
                list = [...list, ...localOnly].sort((a, b) => b.updatedAt - a.updatedAt);
            }

            setStories(list);
            // Total inclui as locais não sincronizadas para a contagem de páginas ficar coerente.
            const localOnlyCount = localData.filter(s => !new Set(pageData.stories.map(c => c.id)).has(s.id)).length;
            setTotal(pageData.total + (page === 0 ? localOnlyCount : 0));

        } catch (error) {
            console.error('Error loading stories:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(0);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Tem certeza que deseja excluir esta história?')) {
            try {
                await storyStorage.deleteStory(id);
                loadStories();
            } catch (error) {
                console.error('Error deleting story:', error);
            }
        }
    };

    return (
        <div className="min-h-full">
            {/* Main Content */}

            {/* Action Bar */}
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-foreground">Minhas Histórias</h2>
                <button
                    onClick={() => navigate('/studio')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                    <Plus className="h-5 w-5" />
                    Nova História
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : stories.length === 0 ? (
                // Empty State
                <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">
                        Nenhuma história criada ainda
                    </h3>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        Comece agora a criar histórias mágicas com o poder da Inteligência Artificial!
                    </p>
                    <button
                        onClick={() => navigate('/studio')}
                        className="text-primary font-semibold hover:text-primary/80 hover:underline"
                    >
                        Criar minha primeira história &rarr;
                    </button>
                </div>
            ) : (
                // Grid of Stories
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {stories.map((story) => {
                        const steps = ['CONFIG', 'NARRATION', 'SCENES', 'THUMBNAIL', 'IMAGES', 'TIMELINE', 'EDITOR'];
                        const currentStepIndex = steps.indexOf(story.data?.currentStep ?? 'CONFIG');

                        return (
                            <div
                                key={story.id}
                                className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
                            >
                                {/* Thumbnail */}
                                <div
                                    className="aspect-video bg-muted relative overflow-hidden"
                                    onClick={() => navigate(`/studio?id=${story.id}`)}
                                >
                                    {story.previewImage ? (
                                        <img
                                            src={story.previewImage}
                                            alt={story.title}
                                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <Sparkles className="w-12 h-12" />
                                        </div>
                                    )}

                                    {/* Overlay Gradient */}
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>

                                    {/* Status Badge */}
                                    <div className="absolute top-3 right-3">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold shadow-sm ${story.isComplete
                                            ? 'bg-green-900/30 text-green-400'
                                            : 'bg-yellow-900/30 text-yellow-400'
                                            }`}>
                                            {story.isComplete ? 'Completo' : 'Rascunho'}
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5">
                                    <h3
                                        className="font-bold text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors cursor-pointer"
                                        onClick={() => navigate(`/studio?id=${story.id}`)}
                                    >
                                        {story.title}
                                    </h3>

                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                                        <Clock className="w-3 h-3" />
                                        <span>
                                            {new Date(story.updatedAt).toLocaleDateString()} às {new Date(story.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Step Pagination Dots */}
                                    <div className="flex items-center justify-center gap-1.5 py-3 border-t border-border">
                                        {steps.map((step, idx) => (
                                            <button
                                                key={step}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (idx <= currentStepIndex) {
                                                        navigate(`/studio?id=${story.id}&step=${step}`);
                                                    }
                                                }}
                                                className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentStepIndex
                                                    ? 'bg-primary scale-125'
                                                    : idx < currentStepIndex
                                                        ? 'bg-green-500 hover:scale-110 cursor-pointer'
                                                        : 'bg-muted'
                                                    }`}
                                                title={step}
                                                disabled={idx > currentStepIndex}
                                            />
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                            {story.data?.currentStep || 'CONFIG'}
                                        </span>
                                        <button
                                            onClick={(e) => handleDelete(e, story.id)}
                                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            
            {!loading && stories.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pb-8">
                    {/* Seletor de itens por página */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Por página:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                            className="bg-card border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            {PAGE_SIZE_OPTIONS.map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                        <span className="ml-2">{total} {total === 1 ? 'história' : 'histórias'}</span>
                    </div>

                    {/* Navegação de páginas */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-4 py-1.5 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Anterior
                        </button>
                        <span className="text-sm text-muted-foreground px-2">
                            Página {page + 1} de {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-4 py-1.5 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
