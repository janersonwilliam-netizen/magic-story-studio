import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Copy, Check, ArrowLeft, Download, Package } from 'lucide-react';
import JSZip from 'jszip';
import { generatePalitoMetadata } from '../../services/palitoGemini';
import { PalitoMetadata, PalitoSceneLine, PalitoFormat } from '../../types/palito';

interface MetadataPageProps {
    title: string;
    script: string;
    scenes: PalitoSceneLine[];
    format?: PalitoFormat;
    audioUrl?: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    existingMetadata?: PalitoMetadata;
    onComplete: (metadata: PalitoMetadata) => void;
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
                <label className="text-sm font-medium text-gray-300">{label}</label>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1 bg-[#333] text-gray-400 rounded text-xs hover:text-white transition-colors"
                >
                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                </button>
            </div>
            <div className="bg-[#1a1a1c] border border-border rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
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

export function MetadataPage({ title, script, scenes, format = 'VIDEO', audioUrl, thumbnailUrl, videoUrl, existingMetadata, onComplete, onBack }: MetadataPageProps) {
    const [metadata, setMetadata] = useState<PalitoMetadata | null>(existingMetadata || null);
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
            const result = await generatePalitoMetadata(title, script, format);
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
        const folderName = slugify(title);
        const root = zip.folder(folderName)!;
        const scenesFolder = root.folder('cenas')!;

        // 1. roteiro.txt
        setDownloadProgress('Adicionando roteiro...');
        root.file('roteiro.txt', script);

        // 2. metadados.txt
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
        ].join('\n');
        root.file('metadados.txt', metaContent);

        // 3. Narração (áudio)
        if (audioUrl) {
            setDownloadProgress('Baixando áudio da narração...');
            const audioBlob = await resolveBlob(audioUrl);
            if (audioBlob) {
                const ext = mimeToExt(audioBlob.type);
                root.file(`narracao.${ext}`, audioBlob);
            }
        }

        // 4. Vídeo exportado
        if (videoUrl) {
            setDownloadProgress('Baixando vídeo MP4...');
            const videoBlob = await resolveBlob(videoUrl);
            if (videoBlob) root.file('video.mp4', videoBlob);
        }

        // 5. Capa (thumbnail)
        if (thumbnailUrl) {
            setDownloadProgress('Baixando capa...');
            const thumbBlob = await resolveBlob(thumbnailUrl);
            if (thumbBlob) {
                const ext = mimeToExt(thumbBlob.type);
                root.file(`capa.${ext}`, thumbBlob);
            }
        }

        // 6. Imagens das cenas
        const scenesWithImages = scenes.filter(s => s.imageUrl);
        for (let i = 0; i < scenesWithImages.length; i++) {
            const scene = scenesWithImages[i];
            setDownloadProgress(`Baixando cenas (${i + 1}/${scenesWithImages.length})...`);
            const imgBlob = await resolveBlob(scene.imageUrl!);
            if (imgBlob) {
                const ts = scene.timestamp.replace(/:/g, '-');
                const ext = mimeToExt(imgBlob.type);
                scenesFolder.file(`${String(i + 1).padStart(3, '0')}_${ts}.${ext}`, imgBlob);
            }
        }

        // 6. Generate ZIP
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
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Metadados para YouTube</h2>
                <p className="text-gray-400 text-sm">Título viral, descrição otimizada e tags SEO prontas para publicar.</p>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-gray-400 text-sm">Gerando metadados otimizados...</p>
                </div>
            ) : (
                <>
                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    {metadata && (
                        <div className="space-y-5">
                            <CopyBlock label="Título Viral do Vídeo" value={metadata.viralTitle} />
                            <CopyBlock label="Descrição do Vídeo" value={metadata.description} />
                            <CopyBlock label="Tags (separadas por vírgula)" value={metadata.tags.join(', ')} />
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            onClick={handleGenerate}
                            disabled={loading || downloading}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw className="h-4 w-4" /> Regenerar Metadados
                        </button>

                        {metadata && (
                            <button
                                onClick={handleDownloadZip}
                                disabled={downloading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                {downloading
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> {downloadProgress}</>
                                    : <><Package className="h-4 w-4" /> Baixar Pacote ZIP Completo</>
                                }
                            </button>
                        )}
                    </div>

                    {metadata && (
                        <div className="bg-[#1a1a1c] border border-border rounded-xl p-4">
                            <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">O ZIP vai conter</p>
                            <ul className="space-y-1 text-xs text-gray-400">
                                <li>📄 <span className="text-gray-300">roteiro.txt</span> — texto completo da narração</li>
                                <li>📋 <span className="text-gray-300">metadados.txt</span> — título, descrição e tags</li>
                                {videoUrl && <li>🎬 <span className="text-gray-300">video.mp4</span> — vídeo exportado</li>}
                                {audioUrl && <li>🎙️ <span className="text-gray-300">narracao.mp3</span> — áudio gerado</li>}
                                {thumbnailUrl && <li>🖼️ <span className="text-gray-300">capa.jpg</span> — thumbnail do vídeo</li>}
                                {scenes.filter(s => s.imageUrl).length > 0 && (
                                    <li>🎬 <span className="text-gray-300">cenas/</span> — {scenes.filter(s => s.imageUrl).length} imagens nomeadas por timestamp</li>
                                )}
                            </ul>
                        </div>
                    )}
                </>
            )}

            <div className="flex justify-between pt-2">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                {metadata && (
                    <button
                        onClick={() => onComplete(metadata)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors"
                    >
                        <Check className="h-4 w-4" /> Vídeo Completo!
                    </button>
                )}
            </div>
        </div>
    );
}
