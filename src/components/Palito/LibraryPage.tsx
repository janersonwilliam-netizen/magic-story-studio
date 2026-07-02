import React, { useState, useEffect } from 'react';
import { PenLine, Plus, Clock, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { palitoStorage, PalitoProject } from '../../lib/palitoStorage';
import { useAuth } from '../../contexts/AuthContext';
import { PALITO_STEP_LABELS, PalitoStep, stepsForFormat } from '../../types/palito';

interface LibraryPageProps {
    onNewProject: () => void;
    onOpenProject: (id: string) => void;
}

export function LibraryPage({ onNewProject, onOpenProject }: LibraryPageProps) {
    const { user } = useAuth();
    const [projects, setProjects] = useState<PalitoProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        if (user?.id) loadProjects();
    }, [user?.id]);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const list = await palitoStorage.listProjects();
            setProjects(list);
        } catch (e) {
            console.error('Erro ao carregar projetos Palito:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm('Excluir este projeto permanentemente?')) return;
        setDeleting(id);
        try {
            await palitoStorage.deleteProject(id);
            setProjects(prev => prev.filter(p => p.id !== id));
        } finally {
            setDeleting(null);
        }
    };

    const stepProgress = (currentStep: PalitoStep, format: PalitoProject['format']) => {
        const steps = stepsForFormat(format);
        const idx = steps.indexOf(currentStep);
        return { current: idx, total: steps.length };
    };

    return (
        <div className="min-h-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white">Histórias Palito</h2>
                    <p className="text-gray-400 text-sm mt-0.5">Vídeos educativos doodle para YouTube</p>
                </div>
                <button
                    onClick={onNewProject}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
                >
                    <Plus className="h-4 w-4" />
                    Nova História
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            ) : projects.length === 0 ? (
                /* Empty State */
                <div className="bg-card rounded-2xl border border-border p-14 text-center">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <PenLine className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Nenhuma história criada ainda</h3>
                    <p className="text-gray-400 mb-8 max-w-md mx-auto">
                        Crie vídeos educativos doodle completos — do título viral ao pacote de metadados para YouTube.
                    </p>
                    <button
                        onClick={onNewProject}
                        className="inline-flex items-center gap-2 text-primary font-semibold hover:text-primary/80 hover:underline"
                    >
                        Criar minha primeira história <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                /* Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                    {projects.map(project => {
                        const { current, total } = stepProgress(project.currentStep, project.format);
                        const progressPct = Math.round((current / (total - 1)) * 100);

                        return (
                            <div
                                key={project.id}
                                onClick={() => onOpenProject(project.id)}
                                className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
                            >
                                {/* Thumbnail */}
                                <div className="aspect-video bg-[#1a1a1c] relative overflow-hidden">
                                    {project.thumbnailUrl ? (
                                        <img
                                            src={project.thumbnailUrl}
                                            alt={project.selectedTitle}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : project.characterImageUrl ? (
                                        <div className="w-full h-full flex items-center justify-center bg-[#242426]">
                                            <img
                                                src={project.characterImageUrl}
                                                alt="personagem"
                                                className="h-3/4 object-contain opacity-60"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <PenLine className="w-10 h-10 text-gray-600" />
                                        </div>
                                    )}

                                    {/* Gradient overlay */}
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

                                    {/* Status badge */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                        {project.format === 'SHORTS' && (
                                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/30 text-primary">
                                                Shorts
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                            project.isComplete
                                                ? 'bg-green-900/40 text-green-400'
                                                : 'bg-yellow-900/40 text-yellow-400'
                                        }`}>
                                            {project.isComplete ? 'Completo' : 'Rascunho'}
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-4">
                                    <h3 className="font-bold text-white text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                                        {project.selectedTitle}
                                    </h3>
                                    {project.tema && (
                                        <p className="text-xs text-gray-500 mb-2 truncate">#{project.tema}</p>
                                    )}
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(project.updatedAt).toLocaleDateString('pt-BR')} às {new Date(project.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="space-y-1 mb-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-500">{PALITO_STEP_LABELS[project.currentStep]}</span>
                                            <span className="text-xs text-gray-600">{current + 1}/{total}</span>
                                        </div>
                                        <div className="w-full bg-[#333] rounded-full h-1.5">
                                            <div
                                                className="bg-primary h-1.5 rounded-full transition-all"
                                                style={{ width: `${progressPct}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="flex justify-between items-center pt-1 border-t border-border">
                                        <span className="text-xs text-primary font-medium">
                                            Continuar →
                                        </span>
                                        <button
                                            onClick={e => handleDelete(e, project.id)}
                                            disabled={deleting === project.id}
                                            className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded"
                                        >
                                            {deleting === project.id
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Trash2 className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
