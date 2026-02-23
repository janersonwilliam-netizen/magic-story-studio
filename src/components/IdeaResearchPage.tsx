import React, { useState } from 'react';
import { Search, TrendingUp, Calendar, Filter, Youtube, Loader2, AlertCircle, Clock, Sparkles, X, PlayCircle, Eye, ThumbsUp } from 'lucide-react';
import { searchVideos, VideoResult, formatViewCount, formatDuration } from '../services/youtube';
import { analyzeVideoIdea, IdeaAnalysis } from '../services/ideaAnalysis';
import { motion, AnimatePresence } from 'framer-motion';

export function IdeaResearchPage() {
    const [query, setQuery] = useState('historinhas infantis');
    const [videos, setVideos] = useState<VideoResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'relevance' | 'viewCount' | 'date'>('relevance');
    const [durationFilter, setDurationFilter] = useState<'any' | 'short' | 'medium' | 'long'>('any');
    const [periodFilter, setPeriodFilter] = useState<'any' | 'month' | 'year' | 'last_year'>('any');
    const [selectedIdea, setSelectedIdea] = useState<{ video: VideoResult, analysis: IdeaAnalysis } | null>(null);

    const handleSearch = async (
        overrideQuery?: string,
        overrideFilter?: 'relevance' | 'viewCount' | 'date',
        overrideDuration?: 'any' | 'short' | 'medium' | 'long',
        overridePeriod?: 'any' | 'month' | 'year' | 'last_year'
    ) => {
        setLoading(true);
        setError(null);
        try {
            const searchQuery = overrideQuery || query;
            const searchFilter = overrideFilter || filter;
            const searchDuration = overrideDuration || durationFilter;
            const searchPeriod = overridePeriod || periodFilter;

            let publishedAfter: string | undefined;
            let publishedBefore: string | undefined;

            const now = new Date();

            if (searchPeriod === 'month') {
                const date = new Date(now.getFullYear(), now.getMonth(), 1);
                publishedAfter = date.toISOString();
            } else if (searchPeriod === 'year') {
                const date = new Date(now.getFullYear(), 0, 1);
                publishedAfter = date.toISOString();
            } else if (searchPeriod === 'last_year') {
                const start = new Date(now.getFullYear() - 1, 0, 1);
                const end = new Date(now.getFullYear(), 0, 1);
                publishedAfter = start.toISOString();
                publishedBefore = end.toISOString();
            } else if (searchFilter === 'date') {
                // Classic "Recent" behavior if no specific period is selected
                const date = new Date();
                date.setMonth(date.getMonth() - 1);
                publishedAfter = date.toISOString();
            }

            const results = await searchVideos({
                query: searchQuery,
                order: searchFilter,
                publishedAfter,
                publishedBefore,
                videoDuration: searchDuration
            });
            setVideos(results);
        } catch (err: any) {
            setError(err.message || 'Erro ao buscar vídeos');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (newFilter: 'relevance' | 'viewCount' | 'date') => {
        setFilter(newFilter);
        // Reset period if switching to 'date' implies general recency, or keep it if explicitly set?
        // Let's keep period independent, but if 'date' is clicked maybe we want 'any' period?
        // For now, let's keep them somewhat independent but default behavior applies.
        handleSearch(query, newFilter, durationFilter, periodFilter);
    };

    const handleDurationChange = (newDuration: 'any' | 'short' | 'medium' | 'long') => {
        setDurationFilter(newDuration);
        handleSearch(query, filter, newDuration, periodFilter);
    };

    const handlePeriodChange = (newPeriod: 'any' | 'month' | 'year' | 'last_year') => {
        setPeriodFilter(newPeriod);
        handleSearch(query, filter, durationFilter, newPeriod);
    };

    const handleAnalyze = async (video: VideoResult) => {
        setAnalyzingId(video.id);
        setError(null);
        try {
            const analysis = await analyzeVideoIdea(video);
            setSelectedIdea({ video, analysis });
        } catch (err: any) {
            setError(err.message || 'Falha ao analisar a ideia. Tente novamente.');
        } finally {
            setAnalyzingId(null);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl relative">
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
                    <Youtube className="w-10 h-10 text-red-600" />
                    Pesquisa de Ideias
                </h1>
                <p className="text-muted-foreground text-lg">
                    Encontre inspiração em histórias virais e use IA para criar a sua.
                </p>
            </div>

            {/* Search Bar */}
            <div className="flex gap-4 mb-8 max-w-2xl mx-auto">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Ex: histórias de ninar, contos de fadas..."
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background/50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    />
                </div>
                <button
                    onClick={() => handleSearch()}
                    disabled={loading}
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Pesquisar'}
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 mb-8 bg-card/50 p-4 rounded-xl border border-border/50 backdrop-blur-sm">

                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Sort Filters */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleFilterChange('relevance')}
                            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all flex items-center gap-2 ${filter === 'relevance'
                                    ? 'bg-secondary text-secondary-foreground border-transparent'
                                    : 'bg-background border-border hover:border-primary/50 text-muted-foreground'
                                }`}
                        >
                            <Filter className="w-4 h-4" />
                            Relevância
                        </button>
                        <button
                            onClick={() => handleFilterChange('viewCount')}
                            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all flex items-center gap-2 ${filter === 'viewCount'
                                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                    : 'bg-background border-border hover:border-red-500/30 text-muted-foreground hover:text-red-500'
                                }`}
                        >
                            <TrendingUp className="w-4 h-4" />
                            Mais Virais
                        </button>
                        <button
                            onClick={() => handleFilterChange('date')}
                            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all flex items-center gap-2 ${filter === 'date'
                                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    : 'bg-background border-border hover:border-blue-500/30 text-muted-foreground hover:text-blue-500'
                                }`}
                        >
                            <Calendar className="w-4 h-4" />
                            Recentes
                        </button>
                    </div>

                    {/* Duration Filters */}
                    <div className="flex gap-2 items-center">
                        <span className="text-sm text-muted-foreground mr-2 hidden md:inline">Duração:</span>
                        <div className="flex bg-background border border-border rounded-lg p-1">
                            <button
                                onClick={() => handleDurationChange('any')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${durationFilter === 'any' ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Qualquer
                            </button>
                            <button
                                onClick={() => handleDurationChange('short')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${durationFilter === 'short' ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Curto
                            </button>
                            <button
                                onClick={() => handleDurationChange('medium')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${durationFilter === 'medium' ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Médio
                            </button>
                        </div>
                    </div>
                </div>

                {/* Period Filters (New Row) */}
                <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
                    <span className="text-sm text-muted-foreground mr-2">Período:</span>
                    <button
                        onClick={() => handlePeriodChange('any')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${periodFilter === 'any' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-background border-border text-muted-foreground hover:border-primary/30'
                            }`}
                    >
                        Qualquer Data
                    </button>
                    <button
                        onClick={() => handlePeriodChange('month')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${periodFilter === 'month' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-background border-border text-muted-foreground hover:border-primary/30'
                            }`}
                    >
                        Este Mês
                    </button>
                    <button
                        onClick={() => handlePeriodChange('year')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${periodFilter === 'year' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-background border-border text-muted-foreground hover:border-primary/30'
                            }`}
                    >
                        Este Ano
                    </button>
                    <button
                        onClick={() => handlePeriodChange('last_year')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${periodFilter === 'last_year' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-background border-border text-muted-foreground hover:border-primary/30'
                            }`}
                    >
                        Ano Passado
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="max-w-2xl mx-auto mb-8 p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-3 border border-destructive/20">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.map((video, index) => (
                    <motion.div
                        key={video.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-xl transition-all hover:border-primary/30 flex flex-col h-full"
                    >
                        {/* Thumbnail */}
                        <div className="relative aspect-video bg-muted overflow-hidden">
                            <img
                                src={video.thumbnailUrl}
                                alt={video.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            {/* Duration Badge */}
                            {video.duration && (
                                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[10px] font-bold rounded flex items-center gap-1 backdrop-blur-sm">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(video.duration)}
                                </div>
                            )}

                            {/* Play Overlay */}
                            <a
                                href={`https://www.youtube.com/watch?v=${video.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <PlayCircle className="w-12 h-12 text-white drop-shadow-lg" />
                            </a>
                        </div>

                        {/* Content */}
                        <div className="p-4 flex flex-col flex-1">
                            <h3 className="font-semibold text-card-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors text-sm" title={video.title}>
                                {video.title}
                            </h3>

                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                                <span>{video.channelTitle}</span>
                                <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-3 mb-4 text-xs font-medium">
                                <span className="flex items-center gap-1 text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md">
                                    <Eye className="w-3 h-3" />
                                    {formatViewCount(video.viewCount)}
                                </span>
                                {video.likeCount && (
                                    <span className="flex items-center gap-1 text-green-400 bg-green-400/10 px-2 py-1 rounded-md">
                                        <ThumbsUp className="w-3 h-3" />
                                        {formatViewCount(video.likeCount)}
                                    </span>
                                )}
                            </div>

                            <div className="mt-auto pt-3 border-t border-border/50">
                                <button
                                    onClick={() => handleAnalyze(video)}
                                    disabled={analyzingId === video.id}
                                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {analyzingId === video.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            ANALISAR COM IA
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {!loading && videos.length === 0 && !error && (
                <div className="text-center text-muted-foreground py-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-6 ring-8 ring-muted/20">
                        <Search className="w-10 h-10 opacity-50" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Comece sua pesquisa</h3>
                    <p className="max-w-md mx-auto">Pesquise por temas ou use os filtros para encontrar as histórias mais virais do momento.</p>
                </div>
            )}

            {/* Analysis Modal */}
            <AnimatePresence>
                {selectedIdea && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedIdea(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-border"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative p-6 pt-12 md:p-8 md:pt-8">
                                <button
                                    onClick={() => setSelectedIdea(null)}
                                    className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="mb-6 flex items-start gap-4">
                                    <img
                                        src={selectedIdea.video.thumbnailUrl}
                                        alt="Thumbnail"
                                        className="w-32 h-auto rounded-lg shadow-md hidden sm:block"
                                    />
                                    <div>
                                        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent mb-1">
                                            Análise de Potencial Viral
                                        </h2>
                                        <p className="text-muted-foreground text-sm">
                                            Baseado em: <span className="text-foreground font-medium">{selectedIdea.video.title}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Viral Reason */}
                                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                        <h3 className="text-yellow-500 font-semibold mb-2 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4" /> Por que viralizou?
                                        </h3>
                                        <p className="text-sm">{selectedIdea.analysis.viralReason}</p>
                                    </div>

                                    {/* Strategy Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                                            <h3 className="font-semibold text-primary mb-2 text-sm uppercase tracking-wider">Sugestão de Título</h3>
                                            <p className="font-medium text-lg text-foreground">{selectedIdea.analysis.suggestedTitle}</p>
                                        </div>
                                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                                            <h3 className="font-semibold text-primary mb-2 text-sm uppercase tracking-wider">Potencial Estimado</h3>
                                            <p className="font-medium text-lg text-foreground">{selectedIdea.analysis.estimatedEngagement}</p>
                                        </div>
                                    </div>

                                    {/* Hook */}
                                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                        <h3 className="text-blue-500 font-semibold mb-2 flex items-center gap-2">
                                            <Clock className="w-4 h-4" /> Gancho (Hook) - 3s
                                        </h3>
                                        <p className="text-sm italic">"{selectedIdea.analysis.hook}"</p>
                                    </div>

                                    {/* Outline */}
                                    <div>
                                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-purple-500" /> Estrutura do Roteiro
                                        </h3>
                                        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
                                            {selectedIdea.analysis.scriptOutline.map((step, i) => (
                                                <li key={i} className="pl-2">{step}</li>
                                            ))}
                                        </ol>
                                    </div>

                                    <div className="pt-4 border-t border-border flex justify-end gap-3">
                                        <button
                                            onClick={() => setSelectedIdea(null)}
                                            className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                                        >
                                            Fechar
                                        </button>
                                        <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                                            Criar História Agora
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
