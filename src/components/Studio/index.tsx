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
// import { EditorPage } from './EditorPage';

export function StudioIndex() {
    const [studioState, setStudioState] = useState<StudioState>({
        currentStep: 'CONFIG'
    });

    const goToStep = (step: StudioStep) => {
        setStudioState(prev => ({ ...prev, currentStep: step }));
    };

    const nextStep = () => {
        const steps: StudioStep[] = ['CONFIG', 'NARRATION', 'SCENES', 'IMAGES', 'TIMELINE', 'EDITOR'];
        const currentIndex = steps.indexOf(studioState.currentStep);
        if (currentIndex < steps.length - 1) {
            goToStep(steps[currentIndex + 1]);
        }
    };

    const previousStep = () => {
        const steps: StudioStep[] = ['CONFIG', 'NARRATION', 'SCENES', 'IMAGES', 'TIMELINE', 'EDITOR'];
        const currentIndex = steps.indexOf(studioState.currentStep);
        if (currentIndex > 0) {
            goToStep(steps[currentIndex - 1]);
        }
    };

    // Handler for CONFIG page completion
    const handleConfigComplete = (config: StoryConfig) => {
        setStudioState(prev => ({
            ...prev,
            config,
            currentStep: 'NARRATION'
        }));
    };

    // Handler for NARRATION page completion
    const handleNarrationComplete = (story: StoryWithNarration) => {
        setStudioState(prev => ({
            ...prev,
            story,
            currentStep: 'SCENES'
        }));
    };

    // Handler for SCENES page completion
    const handleScenesComplete = (storyWithScenes: StoryWithScenes) => {
        setStudioState(prev => ({
            ...prev,
            storyWithScenes,
            currentStep: 'IMAGES'
        }));
    };

    // Handler for IMAGES page completion
    const handleImagesComplete = (storyWithScenes: StoryWithScenes) => {
        setStudioState(prev => ({
            ...prev,
            storyWithScenes,
            currentStep: 'TIMELINE'
        }));
    };

    // Handler for TIMELINE page completion
    const handleTimelineComplete = (storyWithTimeline: any) => {
        setStudioState(prev => ({
            ...prev,
            storyWithScenes: storyWithTimeline,
            currentStep: 'EDITOR'
        }));
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Progress indicator */}
            <div className="bg-[#0f0f0f] text-white p-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between">
                        {(['CONFIG', 'NARRATION', 'SCENES', 'IMAGES', 'TIMELINE', 'EDITOR'] as StudioStep[]).map((step, index) => (
                            <div
                                key={step}
                                className={`flex items-center ${index > 0 ? 'flex-1' : ''}`}
                            >
                                {index > 0 && (
                                    <div className={`flex-1 h-1 mx-2 ${studioState.currentStep === step ||
                                        (['CONFIG', 'NARRATION', 'SCENES', 'IMAGES', 'TIMELINE', 'EDITOR'] as StudioStep[]).indexOf(studioState.currentStep) > index
                                        ? 'bg-[#FF0000]'
                                        : 'bg-gray-600'
                                        }`} />
                                )}
                                <div className={`flex flex-col items-center ${studioState.currentStep === step ? 'text-[#FF0000]' : 'text-gray-400'
                                    }`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${studioState.currentStep === step
                                        ? 'bg-[#FF0000] text-white'
                                        : 'bg-gray-600 text-white'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <span className="text-xs mt-1 hidden sm:block">{step}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content area */}
            <div className="max-w-7xl mx-auto p-6">
                {studioState.currentStep === 'CONFIG' && (
                    <ConfigPage onComplete={handleConfigComplete} />
                )}

                {studioState.currentStep === 'NARRATION' && studioState.config && (
                    <NarrationPage
                        config={studioState.config}
                        onComplete={handleNarrationComplete}
                        onBack={previousStep}
                    />
                )}

                {studioState.currentStep === 'SCENES' && studioState.story && (
                    <ScenesPage
                        story={studioState.story}
                        onComplete={handleScenesComplete}
                        onBack={previousStep}
                    />
                )}

                {studioState.currentStep === 'IMAGES' && studioState.storyWithScenes && (
                    <ImagesPage
                        storyWithScenes={studioState.storyWithScenes}
                        onComplete={() => handleImagesComplete(studioState.storyWithScenes!)}
                        onBack={previousStep}
                    />
                )}

                {studioState.currentStep === 'TIMELINE' && studioState.storyWithScenes && (
                    <TimelinePage
                        storyWithScenes={studioState.storyWithScenes}
                        onComplete={handleTimelineComplete}
                        onBack={previousStep}
                    />
                )}

                {studioState.currentStep === 'EDITOR' && (
                    <div className="text-center py-20">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">Editor</h1>
                        <p className="text-gray-600 mb-8">Página de edição será implementada no Sprint 5</p>
                        <button
                            onClick={previousStep}
                            className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            ← Voltar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
