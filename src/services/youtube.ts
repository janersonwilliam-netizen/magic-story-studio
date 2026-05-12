import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export interface VideoResult {
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    channelTitle: string;
    publishedAt: string;
    viewCount?: string;
    likeCount?: string;
    duration?: string; // ISO 8601 duration
}

export interface SearchParams {
    query: string;
    maxResults?: number;
    order?: 'date' | 'rating' | 'relevance' | 'title' | 'videoCount' | 'viewCount';
    publishedAfter?: string; // ISO 8601 date string (YYYY-MM-DDThh:mm:ssZ)
    publishedBefore?: string; // ISO 8601 date string (YYYY-MM-DDThh:mm:ssZ)
    videoDuration?: 'any' | 'long' | 'medium' | 'short';
}

export const searchVideos = async ({
    query,
    maxResults = 12,
    order = 'relevance',
    publishedAfter,
    publishedBefore,
    videoDuration = 'any'
}: SearchParams): Promise<VideoResult[]> => {
    if (!API_KEY) {
        console.error('YouTube API Key is missing');
        throw new Error('Chave da API do YouTube não configurada. Por favor, adicione VITE_YOUTUBE_API_KEY ao arquivo .env');
    }

    try {
        // 1. Search for videos
        let searchUrl = `${BASE_URL}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&order=${order}&key=${API_KEY}`;

        if (publishedAfter) {
            searchUrl += `&publishedAfter=${publishedAfter}`;
        }

        if (publishedBefore) {
            searchUrl += `&publishedBefore=${publishedBefore}`;
        }

        if (videoDuration !== 'any') {
            searchUrl += `&videoDuration=${videoDuration}`;
        }

        const searchResponse = await fetch(searchUrl);

        if (!searchResponse.ok) {
            const errorData = await searchResponse.json() as any;
            throw new Error(errorData.error?.message || 'Falha ao buscar vídeos');
        }

        const searchData = await searchResponse.json() as any;

        if (!searchData.items || searchData.items.length === 0) {
            return [];
        }

        // 2. Get video statistics (viewCount, likeCount) and duration
        const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
        const statsUrl = `${BASE_URL}/videos?part=statistics,contentDetails&id=${videoIds}&key=${API_KEY}`;

        const statsResponse = await fetch(statsUrl);
        const statsData = await statsResponse.json() as any;

        // Create a map of video statistics and details
        const detailsMap = new Map();
        if (statsData.items) {
            statsData.items.forEach((item: any) => {
                detailsMap.set(item.id, {
                    statistics: item.statistics,
                    contentDetails: item.contentDetails
                });
            });
        }

        // 3. Combine data
        return searchData.items.map((item: any) => {
            const details = detailsMap.get(item.id.videoId);
            return {
                id: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt,
                viewCount: details?.statistics?.viewCount,
                likeCount: details?.statistics?.likeCount,
                duration: details?.contentDetails?.duration
            };
        });

    } catch (error) {
        console.error('Error fetching from YouTube API:', error);
        throw error;
    }
};

export const formatViewCount = (count?: string) => {
    if (!count) return 'N/A';
    const num = parseInt(count, 10);
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
};

export const formatDuration = (isoDuration?: string) => {
    if (!isoDuration) return '';

    // Simple regex to parse PT#M#S format
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return isoDuration;

    const hours = (match[1] || '').replace('H', '');
    const minutes = (match[2] || '').replace('M', '');
    const seconds = (match[3] || '').replace('S', '');

    const parts = [];
    if (hours) parts.push(hours.padStart(2, '0'));
    parts.push(minutes ? minutes.padStart(2, '0') : '00');
    parts.push(seconds ? seconds.padStart(2, '0') : '00');

    return parts.join(':');
};
