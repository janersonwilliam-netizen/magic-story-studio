import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Sparkles, Plus, Clock, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storyStorage, StoryProject } from '../lib/storyStorage';

export function Dashboard() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [stories, setStories] = useState<StoryProject[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStories();
    }, []);

    const loadStories = async () => {
        try {
            const data = await storyStorage.getAllStories();
            setStories(data);
        } catch (error) {
            console.error('Error loading stories:', error);
        } finally {
            setLoading(false);
        }
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
                <h2 className="text-2xl font-bold text-gray-900">Minhas Histórias</h2>
                <button
                    onClick={() => navigate('/studio')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF0000] text-white font-semibold rounded-xl hover:bg-red-600 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                    <Plus className="h-5 w-5" />
                    Nova História
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                </div>
            ) : stories.length === 0 ? (
                // Empty State
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-10 h-10 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        Nenhuma história criada ainda
                    </h3>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                        Comece agora a criar histórias mágicas com o poder da Inteligência Artificial!
                    </p>
                    <button
                        onClick={() => navigate('/studio')}
                        className="text-red-600 font-semibold hover:text-red-700 hover:underline"
                    >
                        Criar minha primeira história &rarr;
                    </button>
                </div>
            ) : (
                // Grid of Stories
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stories.map((story) => {
                        const steps = ['CONFIG', 'NARRATION', 'SCENES', 'THUMBNAIL', 'IMAGES', 'TIMELINE', 'EDITOR'];
                        const currentStepIndex = steps.indexOf(story.data.currentStep);

                        return (
                            <div
                                key={story.id}
                                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
                            >
                                {/* Thumbnail */}
                                <div
                                    className="aspect-video bg-gray-100 relative overflow-hidden"
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
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {story.isComplete ? 'Completo' : 'Rascunho'}
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5">
                                    <h3
                                        className="font-bold text-gray-900 mb-1 line-clamp-1 group-hover:text-red-600 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/studio?id=${story.id}`)}
                                    >
                                        {story.title}
                                    </h3>

                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                                        <Clock className="w-3 h-3" />
                                        <span>
                                            {new Date(story.updatedAt).toLocaleDateString()} às {new Date(story.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Step Pagination Dots */}
                                    <div className="flex items-center justify-center gap-1.5 py-3 border-t border-gray-100">
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
                                                        ? 'bg-red-500 scale-125'
                                                        : idx < currentStepIndex
                                                            ? 'bg-green-500 hover:scale-110 cursor-pointer'
                                                            : 'bg-gray-200'
                                                    }`}
                                                title={step}
                                                disabled={idx > currentStepIndex}
                                            />
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                            {story.data.currentStep}
                                        </span>
                                        <button
                                            onClick={(e) => handleDelete(e, story.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
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
        </div>
    );
}
