import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────
interface GeneratedImage {
    id: string;
    prompt: string;
    style: string;
    model: string;
    imageUrl: string;
    loadTime: number;
    timestamp: Date;
    width: number;
    height: number;
}

// Use local proxy to bypass CORS/COEP restrictions
const POLLINATIONS_BASE = '/api/pollinations/prompt';

const STYLE_PRESETS: Record<string, { label: string; emoji: string; suffix: string }> = {
    pixar: {
        label: 'Pixar 3D',
        emoji: '🎬',
        suffix: '3D Pixar DreamWorks style, cinematic lighting, vibrant colors, high quality render, soft rounded features, big expressive eyes, cute friendly design, detailed background, 8k'
    },
    cartoon2d: {
        label: '2D Cartoon',
        emoji: '🎨',
        suffix: 'premium 2D cartoon illustration, modern mobile game art style, vibrant colors, soft colorful shading, crisp clean outlines, magical storybook atmosphere, cute friendly design'
    },
    watercolor: {
        label: 'Aquarela',
        emoji: '🖌️',
        suffix: 'beautiful watercolor illustration, soft pastel colors, delicate brush strokes, children book art, dreamy atmosphere, gentle lighting, artistic'
    },
    realistic: {
        label: 'Semi-Realista',
        emoji: '📷',
        suffix: 'highly detailed digital art, semi-realistic style, dramatic cinematic lighting, professional quality, 8k resolution, intricate details'
    }
};

const MODEL_OPTIONS = [
    { value: 'flux', label: 'Flux (Recomendado)', description: 'Melhor qualidade geral' },
    { value: 'flux-realism', label: 'Flux Realism', description: 'Mais realista' },
    { value: 'flux-anime', label: 'Flux Anime', description: 'Estilo anime/cartoon' },
    { value: 'flux-3d', label: 'Flux 3D', description: 'Melhor para 3D' },
    { value: 'turbo', label: 'Turbo (Rápido)', description: 'Mais rápido, menor qualidade' },
];

const PRESET_PROMPTS = [
    {
        label: '👧 Menina (Lila)',
        prompt: 'cute little girl named Lila, golden blonde hair, big blue expressive eyes, wearing a yellow dress with flower patterns, friendly smile, standing in a magical garden with colorful flowers'
    },
    {
        label: '🐦 Passarinho (Tico)',
        prompt: 'cute small bird character named Tico, blue and black feathers, tiny orange beak, big round curious eyes, perched on a tree branch with green leaves, morning sunlight'
    },
    {
        label: '🐰 Coelhinho',
        prompt: 'adorable little white bunny rabbit character, soft pure white fur, pale pink inner ears, big sparkly black eyes, tiny pink nose, sitting in a meadow with daisies'
    },
    {
        label: '🏰 Cena Bíblica',
        prompt: 'young shepherd boy David standing bravely before a vast battlefield, holding a simple sling, rolling green hills, dramatic sky with golden sunlight breaking through clouds'
    },
    {
        label: '🌊 Cena Oceano',
        prompt: 'colorful underwater ocean scene, coral reef with tropical fish, sunbeams piercing through crystal clear water, sea turtle swimming gracefully, vibrant marine life'
    },
    {
        label: '🏠 Cena Fazenda',
        prompt: 'charming countryside farm scene, red barn with white fence, green rolling hills, cute farm animals, bright blue sky with fluffy white clouds, morning golden hour lighting'
    }
];

// ─── Pollinations API Helper ─────────────────────────────────────────────────
function buildPollinationsUrl(
    prompt: string,
    style: string,
    model: string,
    width: number,
    height: number,
    seed?: number
): string {
    const styleConfig = STYLE_PRESETS[style];
    const fullPrompt = `${prompt}, ${styleConfig?.suffix || ''}`;
    const encodedPrompt = encodeURIComponent(fullPrompt.trim());

    const params = new URLSearchParams({
        model,
        width: String(width),
        height: String(height),
        nologo: 'true',
    });

    if (seed !== undefined) {
        params.set('seed', String(seed));
    }

    return `${POLLINATIONS_BASE}/${encodedPrompt}?${params.toString()}`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function PollinationsTestPage() {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('pixar');
    const [model, setModel] = useState('flux');
    const [width, setWidth] = useState(1024);
    const [height, setHeight] = useState(576);
    const [useSeed, setUseSeed] = useState(false);
    const [seed, setSeed] = useState(42);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [compareMode, setCompareMode] = useState(false);
    const [error, setError] = useState('');
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const handleGenerate = useCallback(async (customPrompt?: string, customStyle?: string) => {
        const activePrompt = customPrompt || prompt;
        if (!activePrompt.trim()) {
            setError('Digite um prompt para gerar a imagem');
            return;
        }

        const activeStyle = customStyle || style;
        setIsGenerating(true);
        setError('');

        const startTime = Date.now();
        const imageUrl = buildPollinationsUrl(
            activePrompt,
            activeStyle,
            model,
            width,
            height,
            useSeed ? seed : undefined
        );

        const maxRetries = 3;
        let lastErr: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Fetch image as blob via proxy to bypass CORS/COEP
                const response = await fetch(imageUrl);
                if (!response.ok) {
                    // 520/502/503 are intermittent server errors - retry
                    if ((response.status >= 500) && attempt < maxRetries) {
                        console.warn(`[Pollinations] Erro ${response.status}, tentativa ${attempt}/${maxRetries}...`);
                        await new Promise(r => setTimeout(r, 2000 * attempt));
                        continue;
                    }
                    throw new Error(`Servidor retornou ${response.status}. Tente novamente.`);
                }
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);

                const loadTime = (Date.now() - startTime) / 1000;

                const newImage: GeneratedImage = {
                    id: Date.now().toString(),
                    prompt: activePrompt,
                    style: activeStyle,
                    model,
                    imageUrl: blobUrl,
                    loadTime,
                    timestamp: new Date(),
                    width,
                    height,
                };

                setGeneratedImages(prev => [newImage, ...prev]);
                lastErr = null;
                break; // Success, exit retry loop
            } catch (err: any) {
                lastErr = err;
                console.error(`[Pollinations] Tentativa ${attempt}/${maxRetries} falhou:`, err.message);
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                }
            }
        }

        if (lastErr) {
            setError(lastErr.message || 'Erro ao gerar imagem. Tente novamente.');
        }

        setIsGenerating(false);
    }, [prompt, style, model, width, height, useSeed, seed]);

    const handleCompareStyles = useCallback(async () => {
        if (!prompt.trim()) {
            setError('Digite um prompt para comparar estilos');
            return;
        }
        setCompareMode(true);
        setIsGenerating(true);
        setError('');

        const styles = Object.keys(STYLE_PRESETS);
        
        for (const s of styles) {
            const startTime = Date.now();
            const imageUrl = buildPollinationsUrl(prompt, s, model, width, height, useSeed ? seed : undefined);
            
            const maxRetries = 2;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const response = await fetch(imageUrl);
                    if (!response.ok) {
                        if (response.status >= 500 && attempt < maxRetries) {
                            await new Promise(r => setTimeout(r, 2000 * attempt));
                            continue;
                        }
                        break;
                    }
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);

                    const loadTime = (Date.now() - startTime) / 1000;
                    setGeneratedImages(prev => [{
                        id: `${Date.now()}-${s}`,
                        prompt,
                        style: s,
                        model,
                        imageUrl: blobUrl,
                        loadTime,
                        timestamp: new Date(),
                        width,
                        height,
                    }, ...prev]);
                    break; // Success
                } catch {
                    if (attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 2000 * attempt));
                    }
                }
            }
        }

        setIsGenerating(false);
    }, [prompt, model, width, height, useSeed, seed]);

    const handleClearAll = () => {
        setGeneratedImages([]);
        setError('');
    };

    const handleDownload = (imageUrl: string, name: string) => {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `pollinations_${name}_${Date.now()}.jpg`;
        a.target = '_blank';
        a.click();
    };

    return (
        <div style={{ width: '100%', minHeight: '100vh', padding: '24px', background: 'var(--background, #0f1117)' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

                {/* ─── Header ─── */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '32px' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                        <div style={{
                            width: '48px', height: '48px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '24px'
                        }}>
                            🌸
                        </div>
                        <div>
                            <h1 style={{
                                fontSize: '28px', fontWeight: '800',
                                background: 'linear-gradient(135deg, #8b5cf6, #ec4899, #f59e0b)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                margin: 0
                            }}>
                                Teste Pollinations AI
                            </h1>
                            <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px' }}>
                                API 100% gratuita • Modelo Flux • Sem chave de API necessária
                            </p>
                        </div>
                    </div>

                    {/* API Info Banner */}
                    <div style={{
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.1))',
                        border: '1px solid rgba(139,92,246,0.2)',
                        borderRadius: '12px',
                        display: 'flex', alignItems: 'center', gap: '12px',
                        marginTop: '16px'
                    }}>
                        <span style={{ fontSize: '20px' }}>💡</span>
                        <p style={{ color: '#c4b5fd', margin: 0, fontSize: '13px' }}>
                            <strong>Pollinations AI</strong> usa o modelo <strong>Flux</strong> (open-source) para gerar imagens de alta qualidade.
                            Totalmente gratuito, sem limites de quota. Ideal para substituir o Gemini Image Generation.
                        </p>
                    </div>
                </motion.div>

                {/* ─── Controls Panel ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{
                        background: 'var(--card, #1a1b23)',
                        border: '1px solid var(--border, #2d2e3a)',
                        borderRadius: '16px',
                        padding: '24px',
                        marginBottom: '24px',
                    }}
                >
                    {/* Prompt Input */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontWeight: '600', color: '#e5e7eb', marginBottom: '8px', fontSize: '14px' }}>
                            ✏️ Prompt (em inglês para melhor resultado)
                        </label>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="Ex: cute little girl with golden hair, big blue eyes, yellow dress, standing in a magical garden..."
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'var(--background, #0f1117)',
                                border: '1px solid var(--border, #2d2e3a)',
                                borderRadius: '10px',
                                color: '#e5e7eb',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                resize: 'vertical',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Preset Prompts */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontWeight: '600', color: '#9ca3af', marginBottom: '8px', fontSize: '13px' }}>
                            📋 Prompts pré-definidos (clique para usar)
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {PRESET_PROMPTS.map((preset, i) => (
                                <button
                                    key={i}
                                    onClick={() => setPrompt(preset.prompt)}
                                    style={{
                                        padding: '6px 14px',
                                        background: prompt === preset.prompt
                                            ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                                            : 'rgba(139,92,246,0.1)',
                                        border: `1px solid ${prompt === preset.prompt ? '#8b5cf6' : 'rgba(139,92,246,0.2)'}`,
                                        borderRadius: '20px',
                                        color: prompt === preset.prompt ? '#fff' : '#c4b5fd',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontWeight: prompt === preset.prompt ? '600' : '400',
                                    }}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Style + Model Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        {/* Style Selector */}
                        <div>
                            <label style={{ display: 'block', fontWeight: '600', color: '#9ca3af', marginBottom: '8px', fontSize: '13px' }}>
                                🎨 Estilo
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {Object.entries(STYLE_PRESETS).map(([key, val]) => (
                                    <button
                                        key={key}
                                        onClick={() => setStyle(key)}
                                        style={{
                                            padding: '8px 14px',
                                            background: style === key
                                                ? 'linear-gradient(135deg, #ec4899, #f43f5e)'
                                                : 'rgba(236,72,153,0.08)',
                                            border: `1px solid ${style === key ? '#ec4899' : 'rgba(236,72,153,0.2)'}`,
                                            borderRadius: '10px',
                                            color: style === key ? '#fff' : '#f9a8d4',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            fontWeight: style === key ? '600' : '400',
                                        }}
                                    >
                                        {val.emoji} {val.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Model Selector */}
                        <div>
                            <label style={{ display: 'block', fontWeight: '600', color: '#9ca3af', marginBottom: '8px', fontSize: '13px' }}>
                                🤖 Modelo
                            </label>
                            <select
                                value={model}
                                onChange={e => setModel(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    background: 'var(--background, #0f1117)',
                                    border: '1px solid var(--border, #2d2e3a)',
                                    borderRadius: '10px',
                                    color: '#e5e7eb',
                                    fontSize: '14px',
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                {MODEL_OPTIONS.map(m => (
                                    <option key={m.value} value={m.value}>
                                        {m.label} — {m.description}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Resolution */}
                        <div>
                            <label style={{ display: 'block', fontWeight: '600', color: '#9ca3af', marginBottom: '8px', fontSize: '13px' }}>
                                📐 Resolução
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {[
                                    { w: 1024, h: 576, label: '16:9' },
                                    { w: 1024, h: 1024, label: '1:1' },
                                    { w: 768, h: 1024, label: '3:4' },
                                ].map(res => (
                                    <button
                                        key={res.label}
                                        onClick={() => { setWidth(res.w); setHeight(res.h); }}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            background: width === res.w && height === res.h
                                                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                                : 'rgba(245,158,11,0.08)',
                                            border: `1px solid ${width === res.w && height === res.h ? '#f59e0b' : 'rgba(245,158,11,0.2)'}`,
                                            borderRadius: '10px',
                                            color: width === res.w && height === res.h ? '#fff' : '#fcd34d',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {res.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Seed Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <button
                            onClick={() => setUseSeed(!useSeed)}
                            style={{
                                padding: '6px 14px',
                                background: useSeed ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.1)',
                                border: `1px solid ${useSeed ? '#10b981' : '#374151'}`,
                                borderRadius: '8px',
                                color: useSeed ? '#6ee7b7' : '#9ca3af',
                                fontSize: '13px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            🎲 Seed fixa: {useSeed ? 'ON' : 'OFF'}
                        </button>
                        {useSeed && (
                            <input
                                type="number"
                                value={seed}
                                onChange={e => setSeed(Number(e.target.value))}
                                style={{
                                    width: '100px',
                                    padding: '6px 12px',
                                    background: 'var(--background, #0f1117)',
                                    border: '1px solid #374151',
                                    borderRadius: '8px',
                                    color: '#e5e7eb',
                                    fontSize: '14px',
                                    outline: 'none',
                                }}
                            />
                        )}
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            {useSeed ? 'Mesma seed = imagem consistente' : 'Imagens aleatórias a cada geração'}
                        </span>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => handleGenerate()}
                            disabled={isGenerating || !prompt.trim()}
                            style={{
                                flex: '1 1 200px',
                                padding: '14px 24px',
                                background: isGenerating
                                    ? '#374151'
                                    : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                border: 'none',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '16px',
                                fontWeight: '700',
                                cursor: isGenerating ? 'not-allowed' : 'pointer',
                                opacity: isGenerating || !prompt.trim() ? 0.5 : 1,
                                transition: 'all 0.3s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            }}
                        >
                            {isGenerating ? (
                                <>
                                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                                    Gerando...
                                </>
                            ) : (
                                <>🖼️ Gerar Imagem</>
                            )}
                        </button>

                        <button
                            onClick={handleCompareStyles}
                            disabled={isGenerating || !prompt.trim()}
                            style={{
                                flex: '1 1 200px',
                                padding: '14px 24px',
                                background: isGenerating
                                    ? '#374151'
                                    : 'linear-gradient(135deg, #ec4899, #f43f5e)',
                                border: 'none',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '16px',
                                fontWeight: '700',
                                cursor: isGenerating ? 'not-allowed' : 'pointer',
                                opacity: isGenerating || !prompt.trim() ? 0.5 : 1,
                                transition: 'all 0.3s',
                            }}
                        >
                            🔄 Comparar Todos os Estilos
                        </button>

                        {generatedImages.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                style={{
                                    padding: '14px 24px',
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: '12px',
                                    color: '#fca5a5',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                🗑️ Limpar ({generatedImages.length})
                            </button>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                marginTop: '16px',
                                padding: '12px 16px',
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '10px',
                                color: '#fca5a5',
                                fontSize: '14px',
                            }}
                        >
                            ❌ {error}
                        </motion.div>
                    )}
                </motion.div>

                {/* ─── Results Gallery ─── */}
                {generatedImages.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <h2 style={{
                            fontSize: '20px', fontWeight: '700', color: '#e5e7eb',
                            marginBottom: '16px',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                            🎨 Resultados ({generatedImages.length})
                        </h2>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                            gap: '20px',
                        }}>
                            <AnimatePresence>
                                {generatedImages.map((img, i) => (
                                    <motion.div
                                        key={img.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ delay: i * 0.05 }}
                                        style={{
                                            background: 'var(--card, #1a1b23)',
                                            border: '1px solid var(--border, #2d2e3a)',
                                            borderRadius: '16px',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {/* Image */}
                                        <div
                                            style={{ position: 'relative', cursor: 'pointer' }}
                                            onClick={() => setLightboxImage(img.imageUrl)}
                                        >
                                            <img
                                                src={img.imageUrl}
                                                alt={img.prompt}
                                                crossOrigin="anonymous"
                                                style={{
                                                    width: '100%',
                                                    display: 'block',
                                                    aspectRatio: `${img.width}/${img.height}`,
                                                    objectFit: 'cover',
                                                    background: '#1f2028',
                                                }}
                                                loading="lazy"
                                            />
                                            {/* Overlay badges */}
                                            <div style={{
                                                position: 'absolute', top: '10px', left: '10px',
                                                display: 'flex', gap: '6px', flexWrap: 'wrap'
                                            }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    background: 'rgba(0,0,0,0.7)',
                                                    backdropFilter: 'blur(8px)',
                                                    borderRadius: '6px',
                                                    color: '#c4b5fd',
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                }}>
                                                    {STYLE_PRESETS[img.style]?.emoji} {STYLE_PRESETS[img.style]?.label || img.style}
                                                </span>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    background: 'rgba(0,0,0,0.7)',
                                                    backdropFilter: 'blur(8px)',
                                                    borderRadius: '6px',
                                                    color: '#6ee7b7',
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                }}>
                                                    ⚡ {img.loadTime.toFixed(1)}s
                                                </span>
                                            </div>

                                            {/* Click hint */}
                                            <div style={{
                                                position: 'absolute', bottom: '10px', right: '10px',
                                                padding: '4px 10px',
                                                background: 'rgba(0,0,0,0.6)',
                                                backdropFilter: 'blur(8px)',
                                                borderRadius: '6px',
                                                color: '#9ca3af',
                                                fontSize: '11px',
                                            }}>
                                                🔍 Clique para ampliar
                                            </div>
                                        </div>

                                        {/* Info Footer */}
                                        <div style={{ padding: '12px 16px' }}>
                                            <p style={{
                                                color: '#9ca3af',
                                                fontSize: '12px',
                                                margin: '0 0 8px 0',
                                                lineHeight: '1.4',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}>
                                                {img.prompt}
                                            </p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: '#6b7280', fontSize: '11px' }}>
                                                    {img.model} • {img.width}×{img.height} • {img.timestamp.toLocaleTimeString()}
                                                </span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(img.imageUrl, img.style); }}
                                                    style={{
                                                        padding: '4px 10px',
                                                        background: 'rgba(139,92,246,0.1)',
                                                        border: '1px solid rgba(139,92,246,0.2)',
                                                        borderRadius: '6px',
                                                        color: '#c4b5fd',
                                                        fontSize: '11px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                    }}
                                                >
                                                    ⬇️ Download
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}

                {/* Empty State */}
                {generatedImages.length === 0 && !isGenerating && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: '#4b5563',
                        }}
                    >
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🌸</div>
                        <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#6b7280', margin: '0 0 8px 0' }}>
                            Nenhuma imagem gerada ainda
                        </h3>
                        <p style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
                            Escolha um prompt pré-definido ou escreva o seu e clique em "Gerar Imagem"
                        </p>
                    </motion.div>
                )}

                {/* ─── Lightbox ─── */}
                <AnimatePresence>
                    {lightboxImage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setLightboxImage(null)}
                            style={{
                                position: 'fixed',
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.9)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 9999,
                                cursor: 'pointer',
                                padding: '40px',
                            }}
                        >
                            <motion.img
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.8 }}
                                src={lightboxImage}
                                alt="Ampliação"
                                crossOrigin="anonymous"
                                style={{
                                    maxWidth: '95vw',
                                    maxHeight: '95vh',
                                    objectFit: 'contain',
                                    borderRadius: '12px',
                                }}
                                onClick={e => e.stopPropagation()}
                            />
                            <div style={{
                                position: 'absolute', top: '20px', right: '20px',
                                padding: '8px 16px',
                                background: 'rgba(0,0,0,0.6)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '14px',
                            }}>
                                ✕ Fechar (clique fora)
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Spin animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
