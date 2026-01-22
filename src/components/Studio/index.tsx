/**
 * Studio Index Page
 * Entry point for the story creation workflow
 * Manages navigation between CONFIG → NARRATION → SCENES → IMAGES → TIMELINE → EDITOR
 */

import React, { useState } from 'react';
import { StudioStep, StudioState, StoryConfig, StoryWithNarration, StoryWithScenes } from '../../types/studio';
import { ConfigPage } from './ConfigPage';
import { NarrationPage } from './NarrationPage';
import { ScenesPage } from './ScenesPage';
import { ImagesPage } from './ImagesPage';
import { TimelinePage } from './TimelinePage';

// Import Studio pages (will be created in Sprint 5+)
import { ThumbnailPage } from './ThumbnailPage';
// import { EditorPage } from './EditorPage';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { storyStorage, StoryProject } from '../../lib/storyStorage';
import { Loader2 } from 'lucide-react';

export function StudioIndex() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const storyId = searchParams.get('id');

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [studioState, setStudioState] = useState<StudioState>({
        currentStep: 'CONFIG'
    });

    // Load story on mount if ID exists
    React.useEffect(() => {
        if (storyId) {
            loadStory(storyId);
        }
    }, [storyId]);

    const loadStory = async (id: string) => {
        setIsLoading(true);
        try {
            const story = await storyStorage.getStory(id);
            if (story) {
                console.log('[Studio] Loaded story:', story.title);

                // Safety check: ensure data has a valid currentStep
                const loadedData = story.data;
                if (!loadedData || !loadedData.currentStep) {
                    console.warn('[Studio] Story data is empty or missing currentStep. Defaulting to CONFIG.');
                    setStudioState({ currentStep: 'CONFIG' });
                } else {
                    setStudioState(loadedData);
                }
            }
        } catch (error) {
            console.error('[Studio] Error loading story:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveProgress = async (newState: StudioState) => {
        setIsSaving(true);
        try {
            // Determine title and ID
            const title = newState.config?.title || newState.story?.title || 'Nova História';
            const currentId = storyId || crypto.randomUUID();

            // Get preview image from Scenes/Thumbnail
            let previewImage: string | undefined;
            if (newState.storyWithScenes?.scenes) {
                const intro = newState.storyWithScenes.scenes.find(s => s.visualDescription.includes('TITLE CARD'));
                if (intro?.imageUrl) previewImage = intro.imageUrl;
            }

            const project: StoryProject = {
                id: currentId,
                title,
                createdAt: Date.now(), // ideally keep original created date but ok for now
                updatedAt: Date.now(),
                previewImage,
                data: newState,
                isComplete: newState.currentStep === 'EDITOR'
            };

            await storyStorage.saveStory(project);
            console.log('[Studio] Progress saved for:', title);

            // If it's a new story (no ID in URL), update URL without reloading
            if (!storyId) {
                const newUrl = `${window.location.pathname}?id=${currentId}`;
                window.history.replaceState({ path: newUrl }, '', newUrl);
            }

        } catch (error) {
            console.error('[Studio] Error saving progress:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const goToStep = (step: StudioStep) => {
        const newState = { ...studioState, currentStep: step };
        setStudioState(newState);
        saveProgress(newState);
    };

    const nextStep = () => {
        const steps: StudioStep[] = ['CONFIG', 'NARRATION', 'SCENES', 'THUMBNAIL', 'IMAGES', 'TIMELINE', 'EDITOR'];
        const currentIndex = steps.indexOf(studioState.currentStep);
        if (currentIndex < steps.length - 1) {
            goToStep(steps[currentIndex + 1]);
        }
    };

    const previousStep = () => {
        const steps: StudioStep[] = ['CONFIG', 'NARRATION', 'SCENES', 'THUMBNAIL', 'IMAGES', 'TIMELINE', 'EDITOR'];
        const currentIndex = steps.indexOf(studioState.currentStep);
        if (currentIndex > 0) {
            goToStep(steps[currentIndex - 1]);
        }
    };

    // Handler for CONFIG page completion
    const handleConfigComplete = (config: StoryConfig) => {
        const newState: StudioState = {
            ...studioState,
            config,
            currentStep: 'NARRATION'
        };
        setStudioState(newState);
        saveProgress(newState);
    };

    // Handler for NARRATION page completion
    const handleNarrationComplete = (story: StoryWithNarration) => {
        const newState: StudioState = {
            ...studioState,
            story,
            currentStep: 'SCENES'
        };
        setStudioState(newState);
        saveProgress(newState);
    };

    // Handler for SCENES page completion
    const handleScenesComplete = (storyWithScenes: StoryWithScenes) => {
        const newState: StudioState = {
            ...studioState,
            storyWithScenes,
            currentStep: 'THUMBNAIL'
        };
        setStudioState(newState);
        saveProgress(newState);
    };

    // Handler for THUMBNAIL page completion
    const handleThumbnailComplete = (storyWithScenes: StoryWithScenes) => {
        const newState: StudioState = {
            ...studioState,
            storyWithScenes,
            currentStep: 'IMAGES'
        };
        setStudioState(newState);
        saveProgress(newState);
    };

    // Handler for IMAGES page completion
    const handleImagesComplete = (storyWithScenes: StoryWithScenes) => {
        const newState: StudioState = {
            ...studioState,
            storyWithScenes,
            currentStep: 'TIMELINE'
        };
        setStudioState(newState);
        saveProgress(newState);
    };

    // Handler for TIMELINE page completion
    const handleTimelineComplete = (storyWithTimeline: any) => {
        const newState: StudioState = {
            ...studioState,
            storyWithScenes: storyWithTimeline,
            currentStep: 'EDITOR'
        };
        setStudioState(newState);
        saveProgress(newState);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-red-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Carregando história...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] pb-20">
            {/* Header with Progress could go here, but let's keep it simple for now */}

            <main className="container mx-auto px-4 py-8">
                {studioState.currentStep === 'CONFIG' && (
                    <ConfigPage onComplete={handleConfigComplete} />
                )}

                {studioState.currentStep === 'NARRATION' && studioState.config && (
                    <NarrationPage
                        config={studioState.config}
                        onComplete={handleNarrationComplete}
                        onBack={() => goToStep('CONFIG')}
                    />
                )}

                {studioState.currentStep === 'SCENES' && studioState.story && (
                    <ScenesPage
                        story={studioState.story}
                        onComplete={handleScenesComplete}
                        onBack={() => goToStep('NARRATION')}
                    />
                )}

                {studioState.currentStep === 'THUMBNAIL' && studioState.storyWithScenes && (
                    <ThumbnailPage
                        storyWithScenes={studioState.storyWithScenes}
                        onComplete={handleThumbnailComplete}
                        onBack={() => goToStep('SCENES')}
                    />
                )}

                {studioState.currentStep === 'IMAGES' && studioState.storyWithScenes && (
                    <ImagesPage
                        storyWithScenes={studioState.storyWithScenes}
                        onComplete={handleImagesComplete}
                        onBack={() => goToStep('THUMBNAIL')}
                    />
                )}

                {studioState.currentStep === 'TIMELINE' && studioState.storyWithScenes && (
                    <TimelinePage
                        storyWithScenes={studioState.storyWithScenes}
                        onComplete={handleTimelineComplete}
                        onBack={() => goToStep('IMAGES')}
                    />
                )}

                {studioState.currentStep === 'EDITOR' && (
                    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-12 text-center">
                        <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Loader2 className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Editor de Vídeo</h2>
                        <p className="text-gray-500 mb-6">Esta funcionalidade está em desenvolvimento.</p>
                        <button
                            onClick={() => goToStep('TIMELINE')}
                            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                            Voltar para Timeline
                        </button>
                    </div>
                )}
            </main>

            {/* Global Saving Indicator */}
            {isSaving && (
                <div className="fixed bottom-6 right-6 bg-white shadow-xl border border-gray-100 rounded-full px-5 py-3 flex items-center gap-3 text-sm font-medium z-50 animate-in slide-in-from-bottom-5 fade-in">
                    <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                    <span className="text-gray-600">Salvando progresso...</span>
                </div>
            )}
        </div>
    );
}
