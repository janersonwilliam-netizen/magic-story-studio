/**
 * IMAGES Page - Batch Image Generation
 * Fourth step in the Studio workflow
 * Generates all scene images using Gemini Image API
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CharacterDNA, Scene, StoryWithScenes } from '../../types/studio';
import { generateImagePrompt } from '../../services/gemini';
import { generateImageWithNanoBanana, generateImageWithReferences } from '../../services/google_image';
import { Loader2, Check, Image as ImageIcon, AlertCircle, Download, RefreshCw } from 'lucide-react';
import JSZip from 'jszip';

interface ImagesPageProps {
    storyWithScenes: StoryWithScenes;
    onComplete: (updatedStory: StoryWithScenes) => void;
    onPartialUpdate?: (updatedStory: StoryWithScenes) => void;
    onBack: () => void;
}

interface ImageGenerationStatus {
    sceneId: string;
    status: 'pending' | 'generating' | 'complete' | 'error';
    imageUrl?: string;
    error?: string;
}

const GENERIC_CHARACTER_MARKERS = [
    '__protagonist__',
    'protagonista',
    'personagem principal',
    'principal',
    'main character',
    'hero',
    'heroi',
    'herói',
    'personagem1',
    'personagem 1',
    'personagem',
    'child',
    'crianca',
    'criança',
];

function normalizeLookupText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sceneTextIncludesName(sceneText: string, characterName: string): boolean {
    const normalizedText = normalizeLookupText(sceneText);
    const normalizedName = normalizeLookupText(characterName);
    if (!normalizedText || !normalizedName) return false;

    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedName)}([^a-z0-9]|$)`, 'i');
    return pattern.test(normalizedText);
}

function getPrimaryCharacterName(characters: Record<string, CharacterDNA>): string | null {
    const allCharacters = Object.values(characters);
    const protagonist = allCharacters.find(character => character.status === 'protagonist');
    return protagonist?.name || allCharacters[0]?.name || null;
}

function resolveOfficialCharacterName(rawName: string, characters: Record<string, CharacterDNA>): string | null {
    const officialNames = Object.keys(characters);
    const normalizedRaw = normalizeLookupText(rawName);
    if (!normalizedRaw) return null;

    if (GENERIC_CHARACTER_MARKERS.some(marker => normalizeLookupText(marker) === normalizedRaw)) {
        return getPrimaryCharacterName(characters);
    }

    return officialNames.find(name => normalizeLookupText(name) === normalizedRaw) || null;
}

function resolveSceneCharacters(scene: Scene, characters: Record<string, CharacterDNA>): string[] {
    const officialNames = Object.keys(characters);
    if (officialNames.length === 0) return scene.characters || [];

    const resolved = new Set<string>();

    (scene.characters || []).forEach(characterName => {
        const officialName = resolveOfficialCharacterName(characterName, characters);
        if (officialName) resolved.add(officialName);
    });

    const combinedSceneText = [
        scene.narrationText,
        scene.visualDescription,
        scene.imagePrompt,
    ].filter(Boolean).join(' ');

    officialNames.forEach(name => {
        if (sceneTextIncludesName(combinedSceneText, name)) {
            resolved.add(name);
        }
    });

    if (resolved.size === 0) {
        const primaryName = getPrimaryCharacterName(characters);
        if (primaryName) resolved.add(primaryName);
    }

    return Array.from(resolved);
}

function buildCharacterDescriptionsMap(characters: Record<string, CharacterDNA>): Record<string, string> {
    const descriptions: Record<string, string> = {};
    Object.values(characters).forEach(char => {
        const colorsList = char.mainColors?.length ? char.mainColors.join(', ') : '';
        const parts = [
            char.species ? `Species: ${char.species}` : '',
            colorsList ? `Colors: ${colorsList}` : '',
            char.clothing ? `Clothing: ${char.clothing}` : '',
            char.accessories ? `Accessories: ${char.accessories}` : '',
            char.full_description || char.description || '',
        ].filter(Boolean);
        descriptions[char.name] = parts.join('. ');
    });
    return descriptions;
}

export function ImagesPage({ storyWithScenes, onComplete, onPartialUpdate, onBack }: ImagesPageProps) {
    const [generationStatus, setGenerationStatus] = useState<Record<string, ImageGenerationStatus>>({});
    const [generating, setGenerating] = useState(false);
    const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
    const [useEconomyModel, setUseEconomyModel] = useState(false); // New Test Mode State

    const hasStartedRef = React.useRef(false);

    useEffect(() => {
        // Initialize status for all scenes - CHECK if images already exist
        const initialStatus: Record<string, ImageGenerationStatus> = {};
        let hasAllImages = true;

        storyWithScenes.scenes.forEach(scene => {
            if (scene.imageUrl) {
                // Scene already has an image - mark as complete
                initialStatus[scene.id] = {
                    sceneId: scene.id,
                    status: 'complete',
                    imageUrl: scene.imageUrl
                };
            } else {
                // Scene needs image generation
                initialStatus[scene.id] = {
                    sceneId: scene.id,
                    status: 'pending'
                };
                hasAllImages = false;
            }
        });
        setGenerationStatus(initialStatus);

        // Only auto-start if there are scenes without images AND we haven't started yet
        if (!hasAllImages && !hasStartedRef.current) {
            hasStartedRef.current = true;
            startGeneration();
        } else if (hasAllImages) {
            console.log('[ImagesPage] All images already exist, skipping generation');
        }
    }, []);

    const startGeneration = async () => {
        setGenerating(true);

        // Get all character reference images
        const characterReferences = storyWithScenes.characterReferenceImages || {};

        console.log('[ImagesPage] Available character references:', Object.keys(characterReferences));

        for (let i = 0; i < storyWithScenes.scenes.length; i++) {
            const scene = storyWithScenes.scenes[i];
            setCurrentSceneIndex(i);

            // --- SKIP if scene already has an image ---
            if (scene.imageUrl) {
                console.log(`[ImagesPage] Scene ${i + 1} already has image, skipping`);
                setGenerationStatus(prev => ({
                    ...prev,
                    [scene.id]: { ...prev[scene.id], status: 'complete', imageUrl: scene.imageUrl }
                }));
                continue;
            }

            // Update status to generating
            setGenerationStatus(prev => ({
                ...prev,
                [scene.id]: { ...prev[scene.id], status: 'generating' }
            }));

            try {
                console.log(`[ImagesPage] Generating image for scene ${i + 1}/${storyWithScenes.scenes.length}`);
                console.log(`[ImagesPage] Scene characters:`, scene.characters);

                const resolvedCharacters = resolveSceneCharacters(scene, storyWithScenes.characters || {});
                scene.characters = resolvedCharacters;
                console.log(`[ImagesPage] Resolved scene characters:`, resolvedCharacters);

                const characterDescriptionsMap = buildCharacterDescriptionsMap(storyWithScenes.characters || {});

                // Build character description prefix for visual consistency
                const characterDescPrefix = resolvedCharacters
                    .map(name => characterDescriptionsMap[name])
                    .filter(Boolean)
                    .map(desc => `CRITICAL CHARACTER APPEARANCE (must match exactly): ${desc.substring(0, 280)}`)
                    .join('. ');

                // Style string based on visual style
                const is2D = storyWithScenes.visualStyle === 'Estilo 2D Cartoon';
                const styleStr = is2D
                    ? 'Premium 2D cartoon illustration, modern Disney 2D style, vibrant colors, crisp clean outlines, animated children storybook style, NO 3D, NO CGI'
                    : '3D animated children movie style, Pixar-quality charm, big expressive eyes, soft rounded features, vibrant colors';

                // If the scene has a rich imagePrompt (from backend rawScenes), use it directly.
                // It already contains the correct setting, action, and all visual details.
                const hasRichImagePrompt = !!(scene.imagePrompt
                    && scene.imagePrompt !== 'ENDING_CARD_PLACEHOLDER'
                    && scene.imagePrompt.length > 80);

                // Trecho real da narração desta cena — garante que a imagem ilustre o evento certo.
                const narrationBeat = (scene.narrationText || '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
                const beatDirective = narrationBeat
                    ? `Depict THIS exact story moment as a purely visual illustration (do NOT write any of these words inside the image), including every character, action, object and place that appears in it: ${narrationBeat.replace(/["'“”‘’«»]/g, '').substring(0, 500)}`
                    : '';

                let optimizedPrompt: string;

                if (hasRichImagePrompt) {
                    // Ação da cena PRIMEIRO (não pode ser truncada), depois o personagem.
                    optimizedPrompt = [
                        scene.imagePrompt,
                        beatDirective,
                        characterDescPrefix,
                        'CRITICAL: Show the full action of the scene with all its elements, not just a character posing. Do NOT change the time of day, location, or setting described above.',
                        styleStr,
                        `${scene.emotion || 'cheerful'} mood`,
                        'fully detailed environment background, NO white background, NO plain background, children book illustration, widescreen 16:9',
                        'IMPORTANT: render the scene as a purely visual illustration with NO text, NO letters, NO words, NO captions, NO subtitles, NO speech bubbles and NO writing of any kind anywhere in the image'
                    ].filter(Boolean).join('. ');
                } else {
                    // Fallback: reconstruct from visualDescription
                    const promptSeed = [
                        scene.visualDescription,
                        beatDirective,
                        scene.imagePrompt && scene.imagePrompt !== 'ENDING_CARD_PLACEHOLDER'
                            ? `Extra scene-specific direction: ${scene.imagePrompt}`
                            : ''
                    ].filter(Boolean).join('\n');

                    const promptResult = await generateImagePrompt({
                        visual_description: promptSeed,
                        emotion: scene.emotion,
                        characters: resolvedCharacters,
                        visual_style: storyWithScenes.visualStyle,
                        characterDescriptions: characterDescriptionsMap,
                        sceneIndex: i,
                        totalScenes: storyWithScenes.scenes.length
                    });
                    optimizedPrompt = typeof promptResult === 'string' ? promptResult : (promptResult as any).optimized_prompt || promptResult;
                }


                console.log(`[ImagesPage] Using prompt for scene ${scene.order}:`, optimizedPrompt);

                // 2. Collect reference images for characters in THIS scene
                const sceneReferenceImages: string[] = [];
                const sceneCharacterStatuses: string[] = [];

                if (resolvedCharacters.length > 0) {
                    for (const characterName of resolvedCharacters) {
                        if (characterReferences[characterName]) {
                            sceneReferenceImages.push(characterReferences[characterName]);

                            // Get character status for conditional duplication
                            const characterData = storyWithScenes.characters[characterName];
                            sceneCharacterStatuses.push(characterData?.status || 'supporting');

                            console.log(`[ImagesPage] Added reference for ${characterName} (${characterData?.status})`);
                        } else {
                            console.warn(`[ImagesPage] No reference image for character: ${characterName}`);
                        }
                    }
                }

                // 3. Generate image with character-specific references
                let imageUrl: string;

                // CHECK TEST MODE: If Economy Mode is ON, skip references and use Nano Banana
                if (sceneReferenceImages.length > 0 && !useEconomyModel) {
                    // Use Gemini 3 Pro with character references AND statuses
                    imageUrl = await generateImageWithReferences(
                        optimizedPrompt!,
                        sceneReferenceImages,
                        sceneCharacterStatuses, // Pass statuses for conditional duplication
                        storyWithScenes.visualStyle // Pass the visual style
                    );
                    console.log(`[ImagesPage] Scene ${i + 1} generated with ${sceneReferenceImages.length} character reference(s)`);
                } else {
                    // Fallback to standard generation if no references
                    imageUrl = await generateImageWithNanoBanana(optimizedPrompt!, storyWithScenes.visualStyle);
                    console.log(`[ImagesPage] Scene ${i + 1} generated without references`);
                }

                // Update status to complete
                setGenerationStatus(prev => ({
                    ...prev,
                    [scene.id]: {
                        ...prev[scene.id],
                        status: 'complete',
                        imageUrl
                    }
                }));

                // Update scene with image URL
                scene.imageUrl = imageUrl;
                scene.imagePrompt = optimizedPrompt;

                if (onPartialUpdate) {
                    onPartialUpdate({
                        ...storyWithScenes,
                        scenes: [...storyWithScenes.scenes]
                    });
                }


            } catch (error: any) {
                console.error(`[ImagesPage] Error generating image for scene ${scene.order}:`, error);

                setGenerationStatus(prev => ({
                    ...prev,
                    [scene.id]: {
                        ...prev[scene.id],
                        status: 'error',
                        error: error.message
                    }
                }));
            }

            // Delay between generations to avoid Vertex AI rate limiting (429)
            // Increased to 7 seconds for better stability with Gemini Flash Image
            await new Promise(resolve => setTimeout(resolve, 7000));
        }

        setGenerating(false);
    };

    const retryScene = async (sceneId: string) => {
        const scene = storyWithScenes.scenes.find(s => s.id === sceneId);
        if (!scene) return;

        setGenerationStatus(prev => ({
            ...prev,
            [sceneId]: { ...prev[sceneId], status: 'generating', error: undefined }
        }));

        try {
            const resolvedCharacters = resolveSceneCharacters(scene, storyWithScenes.characters || {});
            scene.characters = resolvedCharacters;
            console.log(`[ImagesPage] Resolved retry characters:`, resolvedCharacters);

            const characterDescriptions = buildCharacterDescriptionsMap(storyWithScenes.characters || {});

            // Build character description prefix for visual consistency
            const characterDescPrefix = resolvedCharacters
                .map(name => characterDescriptions[name])
                .filter(Boolean)
                .map(desc => `CRITICAL CHARACTER APPEARANCE (must match exactly): ${desc.substring(0, 280)}`)
                .join('. ');

            const is2D = storyWithScenes.visualStyle === 'Estilo 2D Cartoon';
            const styleStr = is2D
                ? 'Premium 2D cartoon illustration, modern Disney 2D style, vibrant colors, crisp clean outlines, animated children storybook style, NO 3D, NO CGI'
                : '3D animated children movie style, Pixar-quality charm, big expressive eyes, soft rounded features, vibrant colors';

            const hasRichImagePrompt = !!(scene.imagePrompt
                && scene.imagePrompt !== 'ENDING_CARD_PLACEHOLDER'
                && scene.imagePrompt.length > 80);

            // Trecho real da narração desta cena — garante que a imagem ilustre o evento certo.
            const narrationBeat = (scene.narrationText || '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
            const beatDirective = narrationBeat
                ? `Depict THIS exact story moment as a purely visual illustration (do NOT write any of these words inside the image), including every character, action, object and place that appears in it: ${narrationBeat.replace(/["'“”‘’«»]/g, '').substring(0, 500)}`
                : '';

            let optimizedPrompt: string;

            if (hasRichImagePrompt) {
                // Ação da cena PRIMEIRO (não pode ser truncada), depois o personagem.
                optimizedPrompt = [
                    scene.imagePrompt,
                    beatDirective,
                    characterDescPrefix,
                    'CRITICAL: Show the full action of the scene with all its elements, not just a character posing. Do NOT change the time of day, location, or setting described above.',
                    styleStr,
                    `${scene.emotion || 'cheerful'} mood`,
                    'fully detailed environment background, NO white background, NO plain background, children book illustration, widescreen 16:9'
                ].filter(Boolean).join('. ');
            } else {
                const sceneIndex = Math.max(0, storyWithScenes.scenes.findIndex(item => item.id === scene.id));
                const promptSeed = [
                    scene.visualDescription,
                    beatDirective,
                    scene.imagePrompt && scene.imagePrompt !== 'ENDING_CARD_PLACEHOLDER'
                        ? `Extra scene-specific direction: ${scene.imagePrompt}`
                        : ''
                ].filter(Boolean).join('\n');

                const promptResult = await generateImagePrompt({
                    visual_description: promptSeed,
                    emotion: scene.emotion,
                    characters: resolvedCharacters,
                    visual_style: storyWithScenes.visualStyle,
                    characterDescriptions,
                    sceneIndex,
                    totalScenes: storyWithScenes.scenes.length
                });
                optimizedPrompt = typeof promptResult === 'string' ? promptResult : (promptResult as any).optimized_prompt || promptResult;
            }


            // Collect reference images using the same logic as startGeneration
            const characterReferences = storyWithScenes.characterReferenceImages || {};
            const sceneReferenceImages: string[] = [];
            const sceneCharacterStatuses: string[] = [];

            if (resolvedCharacters.length > 0) {
                for (const characterName of resolvedCharacters) {
                    if (characterReferences[characterName]) {
                        sceneReferenceImages.push(characterReferences[characterName]);
                        const characterData = storyWithScenes.characters[characterName];
                        sceneCharacterStatuses.push(characterData?.status || 'supporting');
                    }
                }
            }

            let imageUrl: string;

            // CHECK TEST MODE: If Economy Mode is ON, skip references and use Nano Banana
            if (sceneReferenceImages.length > 0 && !useEconomyModel) {
                imageUrl = await generateImageWithReferences(
                    optimizedPrompt,
                    sceneReferenceImages,
                    sceneCharacterStatuses,
                    storyWithScenes.visualStyle
                );
            } else {
                imageUrl = await generateImageWithNanoBanana(optimizedPrompt, storyWithScenes.visualStyle);
            }

            setGenerationStatus(prev => ({
                ...prev,
                [sceneId]: {
                    ...prev[sceneId],
                    status: 'complete',
                    imageUrl
                }
            }));

            scene.imageUrl = imageUrl;
            scene.imagePrompt = optimizedPrompt;

            if (onPartialUpdate) {
                onPartialUpdate({
                    ...storyWithScenes,
                    scenes: [...storyWithScenes.scenes]
                });
            }


        } catch (error: any) {
            console.error(`[ImagesPage] Error regenerating scene ${scene.order}:`, error);
            setGenerationStatus(prev => ({
                ...prev,
                [sceneId]: {
                    ...prev[sceneId],
                    status: 'error',
                    error: error.message
                }
            }));
        }
    };

    /**
     * Download a single image with a descriptive filename
     */
    const downloadImage = async (imageUrl: string, sceneNumber: number) => {
        try {
            let blob: Blob;

            if (imageUrl.startsWith('data:')) {
                // Data URL (base64 from Gemini) - convert to blob
                const byteString = atob(imageUrl.split(',')[1]);
                const mimeString = imageUrl.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                blob = new Blob([ab], { type: mimeString });
            } else {
                // HTTP URL (from Supabase Storage) - fetch as blob
                const response = await fetch(imageUrl);
                if (!response.ok) throw new Error(`Erro ao baixar: ${response.status}`);
                blob = await response.blob();
            }

            // Create download link with proper filename
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `cena_${String(sceneNumber).padStart(2, '0')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            console.log(`[ImagesPage] Downloaded scene ${sceneNumber}`);
        } catch (error) {
            console.error('[ImagesPage] Error downloading image:', error);
            alert(`Erro ao baixar imagem da cena ${sceneNumber}. Tente novamente.`);
        }
    };

    /**
     * Download all completed images as a zip
     */
    const downloadAllImages = async () => {
        const zip = new JSZip();
        let count = 0;

        // Add images to zip
        for (const scene of storyWithScenes.scenes) {
            const status = generationStatus[scene.id];
            if (status?.status === 'complete' && status.imageUrl) {
                try {
                    const filename = `cena_${String(scene.order).padStart(2, '0')}.png`;

                    if (status.imageUrl.startsWith('data:')) {
                        // Base64 data URL
                        const imgData = status.imageUrl.split(',')[1];
                        zip.file(filename, imgData, { base64: true });
                    } else {
                        // HTTP URL - fetch as blob
                        const response = await fetch(status.imageUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            zip.file(filename, blob);
                        }
                    }
                    count++;
                } catch (err) {
                    console.warn(`[ImagesPage] Failed to add scene ${scene.order} to zip:`, err);
                }
            }
        }

        if (count > 0) {
            try {
                const storyTitle = storyWithScenes.title
                    ?.replace(/[^a-zA-Z0-9\u00C0-\u00FF ]/g, '')
                    .replace(/\s+/g, '_')
                    .substring(0, 30) || 'historia';
                const content = await zip.generateAsync({ type: 'blob' });
                const url = window.URL.createObjectURL(content);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${storyTitle}_imagens.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                console.log(`[ImagesPage] Downloaded zip with ${count} images`);
            } catch (error) {
                console.error('[ImagesPage] Error generating zip:', error);
                alert('Erro ao gerar arquivo ZIP. Tente novamente.');
            }
        }
    };

    const completedCount = Object.values(generationStatus).filter((s: ImageGenerationStatus) => s.status === 'complete').length;
    const errorCount = Object.values(generationStatus).filter((s: ImageGenerationStatus) => s.status === 'error').length;
    const totalScenes = storyWithScenes.scenes.length;
    const progress = (completedCount / totalScenes) * 100;

    const allComplete = completedCount === totalScenes;
    const canProceed = completedCount > 0; // Allow proceeding even if some failed

    // Build updated story with all generated image URLs
    const handleComplete = () => {
        const updatedScenes = storyWithScenes.scenes.map(scene => {
            const status = generationStatus[scene.id];
            if (status?.imageUrl) {
                return { ...scene, imageUrl: status.imageUrl };
            }
            return scene;
        });

        const updatedStory: StoryWithScenes = {
            ...storyWithScenes,
            scenes: updatedScenes
        };

        console.log('[ImagesPage] Passing updated story with', updatedScenes.filter(s => s.imageUrl).length, 'images');
        onComplete(updatedStory);
    };

    return (
        <div className="max-w-6xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-2xl shadow-lg p-8 border border-border"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-foreground mb-2">
                        Oficina de Ilustração
                    </h1>
                    <p className="text-muted-foreground">
                        Gerando imagens mágicas para cada cena
                    </p>

                    {/* TEST MODE TOGGLE */}
                    <div className="flex items-center justify-center mt-4 gap-2">
                        <div className="flex items-center space-x-2 bg-secondary/30 p-2 rounded-lg border border-border">
                            <input
                                type="checkbox"
                                id="economyMode"
                                checked={useEconomyModel}
                                onChange={(e) => setUseEconomyModel(e.target.checked)}
                                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                disabled={generating}
                            />
                            <label htmlFor="economyMode" className="text-sm font-medium text-foreground cursor-pointer select-none">
                                🧪 Modo Teste: Forçar Nano Banana (S/ Consistência)
                            </label>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-foreground">
                            Progresso: {completedCount}/{totalScenes}
                        </span>
                        <span className="text-sm text-muted-foreground">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                    {errorCount > 0 && (
                        <p className="text-sm text-orange-600 mt-2">
                            ⚠️ {errorCount} imagem(ns) com erro - você pode tentar novamente
                        </p>
                    )}
                </div>

                {/* Images Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {storyWithScenes.scenes.map((scene, index) => {
                        const status = generationStatus[scene.id];

                        return (
                            <motion.div
                                key={scene.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                className="relative aspect-square bg-muted rounded-xl overflow-hidden border-2 border-border group"
                            >
                                {/* Scene Number */}
                                <div className="absolute top-2 left-2 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm z-10">
                                    {scene.order}
                                </div>

                                {/* Pending State */}
                                {status?.status === 'pending' && (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                                    </div>
                                )}

                                {/* Generating State */}
                                {status?.status === 'generating' && (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/30">
                                        <Loader2 className="w-12 h-12 text-primary animate-spin mb-2" />
                                        <p className="text-xs text-muted-foreground">Gerando...</p>
                                    </div>
                                )}

                                {/* Complete State */}
                                {status?.status === 'complete' && status.imageUrl && (
                                    <>
                                        <img
                                            src={status.imageUrl}
                                            alt={`Cena ${scene.order}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute bottom-2 right-2 flex gap-2">
                                            <button
                                                onClick={() => downloadImage(status.imageUrl!, scene.order)}
                                                className="w-8 h-8 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors"
                                                title="Baixar imagem"
                                            >
                                                <Download className="w-4 h-4 text-white" />
                                            </button>
                                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        </div>

                                        {/* Regenerate Button (On Hover) */}
                                        {!generating && (
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        retryScene(scene.id);
                                                    }}
                                                    className="w-8 h-8 bg-card/90 hover:bg-card text-foreground hover:text-primary rounded-full flex items-center justify-center shadow-lg transition-colors border border-border"
                                                    title="Regenerar imagem"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )
                                }

                                {/* Error State */}
                                {status?.status === 'error' && (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-destructive/10">
                                        <AlertCircle className="w-12 h-12 text-destructive mb-2" />
                                        <button
                                            onClick={() => retryScene(scene.id)}
                                            className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                                        >
                                            Tentar Novamente
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Download All Button */}
                {
                    completedCount > 0 && (
                        <div className="mb-4">
                            <button
                                onClick={downloadAllImages}
                                disabled={generating}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Download className="w-5 h-5" />
                                Baixar Todas as Imagens ({completedCount})
                            </button>
                        </div>
                    )
                }

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={onBack}
                        disabled={generating}
                        className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ← Voltar
                    </button>
                    <button
                        onClick={handleComplete}
                        disabled={!canProceed || generating}
                        className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Gerando {currentSceneIndex + 1}/{totalScenes}...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                EDITAR NA LINHA DO TEMPO
                            </>
                        )}
                    </button>
                </div>
            </motion.div >
        </div >
    );
}
