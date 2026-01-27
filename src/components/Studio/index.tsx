/**
 * Studio Index Page
 * Entry point for the story creation workflow
 * Manages navigation between CONFIG → NARRATION → SCENES → IMAGES → TIMELINE → EDITOR
 */

import React, { useState, useRef, useEffect } from 'react';
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
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const storyIdFromUrl = searchParams.get('id');
    const stepFromUrl = searchParams.get('step') as StudioStep | null;

    // Generate a stable ID on mount if none exists in URL
    // This ensures the same ID is used throughout the entire story creation process
    const storyIdRef = useRef<string>(storyIdFromUrl || crypto.randomUUID());

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [studioState, setStudioState] = useState<StudioState>({
        currentStep: 'CONFIG'
    });

    // Sync ref with URL param when it changes (e.g., on navigation)
    useEffect(() => {
        if (storyIdFromUrl && storyIdFromUrl !== storyIdRef.current) {
            storyIdRef.current = storyIdFromUrl;
        }
    }, [storyIdFromUrl]);

    // Update URL immediately if no ID was in URL (new story)
    useEffect(() => {
        if (!storyIdFromUrl && storyIdRef.current) {
            setSearchParams(params => {
                params.set('id', storyIdRef.current);
                return params;
            }, { replace: true });
        }
    }, [storyIdFromUrl]);

    // Load story on mount if ID exists in URL
    useEffect(() => {
        if (storyIdFromUrl) {
            loadStory(storyIdFromUrl);
        }
    }, [storyIdFromUrl]);

    // Sync URL with current step whenever it changes
    useEffect(() => {
        if (studioState.currentStep) {
            setSearchParams(params => {
                const currentId = params.get('id') || storyIdRef.current;
                const currentStepParam = params.get('step');

                // Only update if actually changed to avoid infinite loops
                if (currentStepParam !== studioState.currentStep) {
                    const newParams = new URLSearchParams(params);
                    newParams.set('id', currentId);
                    newParams.set('step', studioState.currentStep);
                    return newParams;
                }
                return params;
            }, { replace: true });
        }
    }, [studioState.currentStep, setSearchParams]);

    const loadStory = async (id: string) => {
        setIsLoading(true);
        try {
            // 1. Instant Load (Local)
            const localStory = await storyStorage.getLocalStory(id);
            if (localStory) {
                console.log('[Studio] Loaded local story:', localStory.title);
                processLoadedStory(localStory);
                setIsLoading(false); // Show content immediately
            }

            // 2. Background Sync (Cloud)
            const syncedStory = await storyStorage.getStory(id);
            if (syncedStory) {
                // If we didn't have local data, or if cloud data is newer (logic can be improved, but for now just update)
                console.log('[Studio] Standard loaded story:', syncedStory.title);
                processLoadedStory(syncedStory);
            } else if (!localStory) {
                // Only if BOTH are missing
                console.warn('[Studio] Story data is empty or missing currentStep. Defaulting to CONFIG.');
                setStudioState({ currentStep: 'CONFIG' });
            }

        } catch (error) {
            console.error('[Studio] Error loading story:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const processLoadedStory = (story: StoryProject) => {
        // Safety check: ensure data has a valid currentStep
        const loadedData = story.data;
        let finalStep = loadedData?.currentStep || 'CONFIG';

        if (!loadedData || !loadedData.currentStep) {
            setStudioState({ currentStep: 'CONFIG' });
        } else {
            // If a specific step was requested via URL, navigate to it (if valid)
            if (stepFromUrl) {
                const validSteps: StudioStep[] = ['CONFIG', 'NARRATION', 'SCENES', 'THUMBNAIL', 'IMAGES', 'TIMELINE', 'EDITOR'];
                const requestedStepIndex = validSteps.indexOf(stepFromUrl);
                const currentStepIndex = validSteps.indexOf(loadedData.currentStep);

                // Only allow navigation to steps that have been completed or current
                if (requestedStepIndex >= 0 && requestedStepIndex <= currentStepIndex) {
                    console.log('[Studio] Navigating to requested step:', stepFromUrl);
                    setStudioState({ ...loadedData, currentStep: stepFromUrl });
                } else {
                    setStudioState(loadedData);
                }
            } else {
                setStudioState(loadedData);
            }
        }
    };

    const saveProgress = async (newState: StudioState) => {
        setIsSaving(true);
        try {
            // Determine title
            const title = newState.config?.title || newState.story?.title || 'Nova História';
            // Always use the stable ID from ref (never generate new one here)
            const currentId = storyIdRef.current;

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
            console.log('[Studio] Progress saved for:', title, 'ID:', currentId);

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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Carregando história...</p>
                </div>
            </div>
        );
    }

    // Define steps for navigation (Portuguese labels)
    // Note: TIMELINE step is now shown as "EDITOR" in the UI
    const allSteps: { key: StudioStep; label: string }[] = [
        { key: 'CONFIG', label: 'INÍCIO' },
        { key: 'NARRATION', label: 'NARRAÇÃO' },
        { key: 'SCENES', label: 'CENAS' },
        { key: 'THUMBNAIL', label: 'CAPA' },
        { key: 'IMAGES', label: 'IMAGENS' },
        { key: 'TIMELINE', label: 'EDITOR' }, // Timeline is the Editor
    ];

    // Get the index of highest reached step
    const getStepIndex = (step: StudioStep) => allSteps.findIndex(s => s.key === step);
    const currentStepIndex = getStepIndex(studioState.currentStep);

    // Determine which steps are accessible (completed or current)
    const highestReachedStep = studioState.storyWithScenes ?
        (studioState.storyWithScenes.scenes?.[0]?.imageUrl ? 'IMAGES' :
            (studioState.storyWithScenes.thumbnailUrl ? 'THUMBNAIL' : 'SCENES')) :
        (studioState.story ? 'NARRATION' : 'CONFIG');
    const highestReachedIndex = getStepIndex(highestReachedStep as StudioStep);

    // Check if we should show the step navigation (not in TIMELINE/EDITOR mode)
    const showStepNavigation = studioState.currentStep !== 'TIMELINE' && studioState.currentStep !== 'EDITOR';

    return (
        <div className={`min-h-screen ${studioState.currentStep === 'TIMELINE' ? 'bg-background overflow-hidden' : 'bg-background overflow-auto'} pb-20`}>

            {/* Step Navigation Header - Aligned with content */}
            {showStepNavigation && (
                <div className="container mx-auto px-4 pt-6 pb-2">
                    <div className="bg-card rounded-2xl shadow-lg border border-border px-8 py-4 flex justify-center">
                        <div className="flex items-center gap-4">
                            {allSteps.map((step, index) => {
                                const isActive = step.key === studioState.currentStep;
                                const isCompleted = index < currentStepIndex || index <= highestReachedIndex;
                                const isAccessible = index <= Math.max(currentStepIndex, highestReachedIndex);

                                return (
                                    <button
                                        key={step.key}
                                        onClick={() => isAccessible && goToStep(step.key)}
                                        disabled={!isAccessible}
                                        className={`flex flex-col items-center px-5 py-2 rounded-xl transition-all ${isActive
                                            ? 'bg-primary/10'
                                            : isAccessible
                                                ? 'hover:bg-muted cursor-pointer'
                                                : 'cursor-not-allowed opacity-50'
                                            }`}
                                    >
                                        {/* Progress bar */}
                                        <div className={`w-20 h-1 rounded-full mb-2 ${isActive
                                            ? 'bg-primary'
                                            : isCompleted
                                                ? 'bg-primary'
                                                : 'bg-muted'
                                            }`} />
                                        {/* Label */}
                                        <span className={`text-[11px] font-bold uppercase tracking-wide ${isActive
                                            ? 'text-primary'
                                            : isCompleted
                                                ? 'text-primary'
                                                : 'text-muted-foreground'
                                            }`}>
                                            {step.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <main className={studioState.currentStep === 'TIMELINE' ? 'w-full h-full p-0 overflow-hidden' : 'container mx-auto px-4 py-8 overflow-auto'}>
                {studioState.currentStep === 'CONFIG' && (
                    <ConfigPage onComplete={handleConfigComplete} />
                )}

                {studioState.currentStep === 'NARRATION' && studioState.config && (
                    <NarrationPage
                        config={studioState.config}
                        existingStory={studioState.story}
                        onComplete={handleNarrationComplete}
                        onBack={() => goToStep('CONFIG')}
                    />
                )}

                {studioState.currentStep === 'SCENES' && studioState.story && (
                    <ScenesPage
                        story={studioState.story}
                        existingData={studioState.storyWithScenes}
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
                    <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm p-12 text-center">
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
                <div className="fixed bottom-6 right-6 bg-card shadow-xl border border-border rounded-full px-5 py-3 flex items-center gap-3 text-sm font-medium z-50 animate-in slide-in-from-bottom-5 fade-in">
                    <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                    <span className="text-foreground">Salvando progresso...</span>
                </div>
            )}
        </div>
    );
}
