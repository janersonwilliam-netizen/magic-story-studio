import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, Copy, Check, ArrowLeft, ArrowRight, Package } from 'lucide-react';
import JSZip from 'jszip';
import { generateStoryMetadata } from '../../services/gemini';
import { StoryWithScenes, StoryMetadata } from '../../types/studio';

interface MetadataPageProps {
    storyWithScenes: StoryWithScenes;
    existingMetadata?: StoryMetadata;
    onComplete: (metadata: StoryMetadata) => void;
    onBack: () => void;
}

function CopyBlock({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">{label}</label>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1 bg-muted text-muted-foreground rounded text-xs hover:text-foreground transition-colors"
                >
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                </button>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed font-mono">
                {value}
            </div>
        </div>
    );
}

async function fetchAsBlob(url: string): Promise<Blob | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.blob();
    } catch {
        return null;
    }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
    try {
        const [header, base64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    } catch {
        return null;
    }
}

async function resolveBlob(url: string): Promise<Blob | null> {
    if (!url) return null;
    if (url.startsWith('data:')) return dataUrlToBlob(url);
    return fetchAsBlob(url);
}

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40);
}

function mimeToExt(mime: string): string {
    if (mime.includes('mp3') || mime.includes('mpeg')) return 'mp3';
    if (mime.includes('wav')) return 'wav';
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    return 'jpg';
}

export function MetadataPage({ storyWithScenes, existingMetadata, onComplete, onBack }: MetadataPageProps) {
    const [metadata, setMetadata] = useState<StoryMetadata | null>(existingMetadata || null);
    const [loading, setLoading] = useState(!existingMetadata);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState('');

    useEffect(() => {
        if (!existingMetadata) handleGenerate();
    }, []);

    const handleGenerate = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await generateStoryMetadata({
                title: storyWithScenes.title,
                script: storyWithScenes.storyText,
                theme: storyWithScenes.theme,
            });
            setMetadata(result);
        } catch (e: any) {
            setError(e.message || 'Erro ao gerar metadados. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadZip = async () => {
        if (!metadata) return;
        setDownloading(true);

        const zip = new JSZip();
        const folderName = slugify(storyWithScenes.title);
        const root = zip.folder(folderName)!;
        const scenesFolder = root.folder('cenas')!;

        setDownloadProgress('Adicionando roteiro...');
        root.file('roteiro.txt', storyWithScenes.storyText);

        setDownloadProgress('Adicionando metadados...');
        const metaContent = [
            '=== TÍTULO VIRAL ===',
            metadata.viralTitle,
            '',
            '=== DESCRIÇÃO ===',
            metadata.description,
            '',
            '=== TAGS ===',
            metadata.tags.join(', '),
            ...(metadata.pinnedComment ? ['', '=== COMENTÁRIO PARA FIXAR ===', metadata.pinnedComment] : []),
        ].join('\n');
        root.file('metadados.txt', metaContent);

        if (storyWithScenes.audioUrl) {
            setDownloadProgress('Baixando áudio da narração...');
            const audioBlob = await resolveBlob(storyWithScenes.audioUrl);
            if (audioBlob) {
                const ext = mimeToExt(audioBlob.type);
                root.file(`narracao.${ext}`, audioBlob);
            }
        }

        if (storyWithScenes.thumbnailUrl) {
            setDownloadProgress('Baixando capa...');
            const thumbBlob = await resolveBlob(storyWithScenes.thumbnailUrl);
            if (thumbBlob) {
                const ext = mimeToExt(thumbBlob.type);
                root.file(`capa.${ext}`, thumbBlob);
            }
        }

        const scenesWithImages = storyWithScenes.scenes.filter(s => s.imageUrl);
        for (let i = 0; i < scenesWithImages.length; i++) {
            const scene = scenesWithImages[i];
            setDownloadProgress(`Baixando cenas (${i + 1}/${scenesWithImages.length})...`);
            const imgBlob = await resolveBlob(scene.imageUrl!);
            if (imgBlob) {
                const ext = mimeToExt(imgBlob.type);
                scenesFolder.file(`${String(scene.order).padStart(3, '0')}.${ext}`, imgBlob);
            }
        }

        setDownloadProgress('Compactando arquivo ZIP...');
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folderName}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        setDownloading(false);
        setDownloadProgress('');
    };

    return (
        <div className="max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-2xl shadow-lg p-8 border border-border space-y-6"
            >
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-foreground mb-2">Metadados para YouTube</h1>
                    <p className="text-muted-foreground">Título, descrição, tags e comentário fixado otimizados para os 3 fatores que o YouTube mais usa para recomendar um vídeo: CTR do título, retenção e engajamento (comentários).</p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-muted-foreground text-sm">Gerando metadados otimizados...</p>
                    </div>
                ) : (
                    <>
                        {error && <p className="text-destructive text-sm text-center">{error}</p>}

                        {metadata && (
                            <div className="space-y-5">
                                <CopyBlock label="Título Viral do Vídeo" value={metadata.viralTitle} />
                                <CopyBlock label="Descrição do Vídeo" value={metadata.description} />
                                <CopyBlock label="Tags (separadas por vírgula)" value={metadata.tags.join(', ')} />
                                {metadata.pinnedComment && (
                                    <CopyBlock label="Comentário para Fixar (engajamento)" value={metadata.pinnedComment} />
                                )}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                onClick={handleGenerate}
                                disabled={loading || downloading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-semibold hover:bg-secondary/80 disabled:opacity-50 transition-colors"
                            >
                                <RefreshCw className="h-4 w-4" /> Regenerar Metadados
                            </button>

                            {metadata && (
                                <button
                                    onClick={handleDownloadZip}
                                    disabled={downloading}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    {downloading
                                        ? <><Loader2 className="h-4 w-4 animate-spin" /> {downloadProgress}</>
                                        : <><Package className="h-4 w-4" /> Baixar Pacote ZIP Completo</>
                                    }
                                </button>
                            )}
                        </div>

                        {metadata && (
                            <div className="bg-muted/30 border border-border rounded-xl p-4">
                                <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">O ZIP vai conter</p>
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                    <li>📄 <span className="text-foreground">roteiro.txt</span> — texto completo da narração</li>
                                    <li>📋 <span className="text-foreground">metadados.txt</span> — título, descrição e tags</li>
                                    {storyWithScenes.audioUrl && <li>🎙️ <span className="text-foreground">narracao</span> — áudio gerado</li>}
                                    {storyWithScenes.thumbnailUrl && <li>🖼️ <span className="text-foreground">capa</span> — thumbnail do vídeo</li>}
                                    {storyWithScenes.scenes.filter(s => s.imageUrl).length > 0 && (
                                        <li>🎬 <span className="text-foreground">cenas/</span> — {storyWithScenes.scenes.filter(s => s.imageUrl).length} imagens numeradas por ordem</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </>
                )}

                <div className="flex justify-between pt-2">
                    <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-semibold hover:bg-secondary/80 transition-colors">
                        <ArrowLeft className="h-4 w-4" /> Voltar
                    </button>
                    {metadata && (
                        <button
                            onClick={() => onComplete(metadata)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors"
                        >
                            Continuar <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
