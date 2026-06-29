import React, { useState, useEffect, useCallback } from 'react';
import { PenLine, ArrowLeft, Loader2 } from 'lucide-react';
import { PalitoState, PalitoStep, PALITO_STEPS, PALITO_STEP_LABELS, PalitoTranscriptionLine, PalitoSceneLine, PalitoMetadata } from '../../types/palito';
import { palitoStorage } from '../../lib/palitoStorage';
import { useAuth } from '../../contexts/AuthContext';
import { LibraryPage } from './LibraryPage';
import { IdeasPage } from './IdeasPage';
import { ScriptPage } from './ScriptPage';
import { NarrationPage } from './NarrationPage';
import { TranscriptionPage } from './TranscriptionPage';
import { CharacterPage } from './CharacterPage';
import { ThumbnailPage } from './ThumbnailPage';
import { ScenesPage } from './ScenesPage';
import { TimelinePage } from './TimelinePage';
import { MetadataPage } from './MetadataPage';

type View = 'library' | 'editor';

const STEP_ORDER: PalitoStep[] = PALITO_STEPS;

function stepIndex(step: PalitoStep) {
    return STEP_ORDER.indexOf(step);
}

export function PalitoIndex() {
    const { user } = useAuth();
    const [view, setView] = useState<View>('library');
    const [state, setState] = useState<PalitoState>({ currentStep: 'IDEAS' });
    const [completedSteps, setCompletedSteps] = useState<Set<PalitoStep>>(new Set());
    const [saving, setSaving] = useState(false);
    const [loadingProject, setLoadingProject] = useState(false);

    // Auto-save whenever state changes (debounced)
    useEffect(() => {
        if (!state.projectId || view !== 'editor') return;
        const timer = setTimeout(() => {
            setSaving(true);
            palitoStorage.saveState(state.projectId!, state)
                .catch(e => console.error('[Palito] Auto-save error:', e))
                .finally(() => setSaving(false));
        }, 1200);
        return () => clearTimeout(timer);
    }, [state, view]);

    const handleNewProject = async () => {
        if (!user?.id) return;
        setLoadingProject(true);
        try {
            const id = await palitoStorage.createProject(user.id);
            setState({ projectId: id, currentStep: 'IDEAS' });
            setCompletedSteps(new Set());
            setView('editor');
        } catch (e) {
            console.error('[Palito] Erro ao criar projeto:', e);
        } finally {
            setLoadingProject(false);
        }
    };

    const handleOpenProject = async (id: string) => {
        setLoadingProject(true);
        try {
            const project = await palitoStorage.getProject(id);
            if (!project) return;
            setState(project.state);

            // Mark all steps up to current as completed
            const currentIdx = stepIndex(project.state.currentStep);
            const done = new Set<PalitoStep>(STEP_ORDER.slice(0, currentIdx) as PalitoStep[]);
            setCompletedSteps(done);
            setView('editor');
        } catch (e) {
            console.error('[Palito] Erro ao abrir projeto:', e);
        } finally {
            setLoadingProject(false);
        }
    };

    const updateState = useCallback((patch: Partial<PalitoState>) => {
        setState(prev => ({ ...prev, ...patch }));
    }, []);

    const goToStep = (step: PalitoStep) => {
        updateState({ currentStep: step });
    };

    const advance = (step: PalitoStep, patch: Partial<PalitoState>) => {
        const nextIdx = stepIndex(step) + 1;
        const nextStep = STEP_ORDER[nextIdx] || step;
        setCompletedSteps(prev => new Set([...prev, step]));
        updateState({ ...patch, currentStep: nextStep });
    };

    const currentIdx = stepIndex(state.currentStep);

    if (loadingProject) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (view === 'library') {
        return (
            <LibraryPage
                onNewProject={handleNewProject}
                onOpenProject={handleOpenProject}
            />
        );
    }

    return (
        <div className="flex flex-col min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView('library')}
                        className="p-2 text-gray-400 hover:text-white hover:bg-[#242426] rounded-lg transition-colors"
                        title="Voltar à biblioteca"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <PenLine className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white leading-tight">
                            {state.selectedTitle
                                ? <span className="line-clamp-1 max-w-xs">{state.selectedTitle}</span>
                                : 'Nova História Palito'}
                        </h1>
                        <p className="text-xs text-gray-400">Histórias Palito</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    {saving && (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Salvando...</span>
                        </>
                    )}
                    {!saving && state.projectId && (
                        <span className="text-green-500">✓ Salvo</span>
                    )}
                </div>
            </div>

            {/* Step navigator */}
            <div className="flex items-center justify-center gap-1 mb-8 overflow-x-auto pb-2 scrollbar-none">
                {STEP_ORDER.map((step, i) => {
                    const isActive = state.currentStep === step;
                    const isDone = completedSteps.has(step);
                    const isReachable = isDone || i <= currentIdx;
                    return (
                        <React.Fragment key={step}>
                            <button
                                onClick={() => isReachable && goToStep(step)}
                                disabled={!isReachable}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                                    isActive
                                        ? 'bg-primary text-white'
                                        : isDone
                                            ? 'bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer'
                                            : 'bg-[#242426] text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                <span className="w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold bg-white/10">
                                    {i + 1}
                                </span>
                                {PALITO_STEP_LABELS[step]}
                            </button>
                            {i < STEP_ORDER.length - 1 && (
                                <div className={`w-3 h-px shrink-0 ${isDone ? 'bg-primary/40' : 'bg-border'}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Title preview bar */}
            {state.selectedTitle && state.currentStep !== 'IDEAS' && (
                <div className="max-w-3xl mx-auto w-full mb-6 px-4 py-2.5 bg-[#242426] border border-border rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Título selecionado</p>
                    <p className="text-sm text-white font-medium line-clamp-1">"{state.selectedTitle}"</p>
                </div>
            )}

            {/* Page content */}
            <div className="flex-1">
                {state.currentStep === 'IDEAS' && (
                    <IdeasPage
                        tema={state.tema}
                        existingIdeas={state.ideas}
                        existingSelected={state.selectedTitle}
                        onComplete={(ideas, selectedTitle, tema) =>
                            advance('IDEAS', { ideas, selectedTitle, tema })
                        }
                    />
                )}

                {state.currentStep === 'SCRIPT' && state.selectedTitle && (
                    <ScriptPage
                        title={state.selectedTitle}
                        existingScript={state.narrationScript}
                        onComplete={narrationScript => advance('SCRIPT', { narrationScript })}
                        onBack={() => goToStep('IDEAS')}
                    />
                )}

                {state.currentStep === 'NARRATION' && state.narrationScript && (
                    <NarrationPage
                        script={state.narrationScript}
                        existingAudioUrl={state.audioUrl}
                        existingVoice={state.voiceName}
                        existingEmotion={state.emotion}
                        onComplete={(audioUrl, voiceName, emotion) =>
                            advance('NARRATION', { audioUrl, voiceName, emotion })
                        }
                        onBack={() => goToStep('SCRIPT')}
                    />
                )}

                {state.currentStep === 'TRANSCRIPTION' && state.audioUrl && (
                    <TranscriptionPage
                        audioUrl={state.audioUrl}
                        existingTranscription={state.transcription}
                        onComplete={transcription => advance('TRANSCRIPTION', { transcription })}
                        onBack={() => goToStep('NARRATION')}
                    />
                )}

                {state.currentStep === 'CHARACTER' && (
                    <CharacterPage
                        existingImageUrl={state.characterImageUrl}
                        onComplete={characterImageUrl => advance('CHARACTER', { characterImageUrl })}
                        onBack={() => goToStep('TRANSCRIPTION')}
                    />
                )}

                {state.currentStep === 'THUMBNAIL' && state.selectedTitle && (
                    <ThumbnailPage
                        title={state.selectedTitle}
                        existingThumbnailUrl={state.thumbnailUrl}
                        onComplete={thumbnailUrl => advance('THUMBNAIL', { thumbnailUrl })}
                        onBack={() => goToStep('CHARACTER')}
                    />
                )}

                {state.currentStep === 'SCENES' && state.transcription && state.selectedTitle && (
                    <ScenesPage
                        title={state.selectedTitle}
                        transcription={state.transcription}
                        characterImageUrl={state.characterImageUrl || ''}
                        existingScenes={state.scenes}
                        onComplete={scenes => advance('SCENES', { scenes })}
                        onBack={() => goToStep('THUMBNAIL')}
                    />
                )}

                {state.currentStep === 'TIMELINE' && state.audioUrl && state.scenes && state.transcription && (
                    <TimelinePage
                        audioUrl={state.audioUrl}
                        scenes={state.scenes}
                        transcription={state.transcription}
                        existingVideoUrl={state.videoUrl}
                        onComplete={videoUrl => advance('TIMELINE', { videoUrl })}
                        onBack={() => goToStep('SCENES')}
                    />
                )}

                {state.currentStep === 'METADATA' && state.selectedTitle && state.narrationScript && state.scenes && (
                    <MetadataPage
                        title={state.selectedTitle}
                        script={state.narrationScript}
                        scenes={state.scenes}
                        audioUrl={state.audioUrl}
                        thumbnailUrl={state.thumbnailUrl}
                        videoUrl={state.videoUrl}
                        existingMetadata={state.metadata}
                        onComplete={metadata => {
                            setCompletedSteps(prev => new Set([...prev, 'METADATA']));
                            updateState({ metadata });
                        }}
                        onBack={() => goToStep('SCENES')}
                    />
                )}
            </div>
        </div>
    );
}
