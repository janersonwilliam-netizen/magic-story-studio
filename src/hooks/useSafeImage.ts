import { useState, useEffect } from 'react';

/**
 * Hook to safely fetch images in a COEP: require-corp environment
 * Fetches the image via a proxy, converts to Blob, and returns a local Object URL
 */
export function useSafeImage(src: string | undefined) {
    const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) {
            setImageSrc(undefined);
            setIsLoading(false);
            setError(false);
            return;
        }

        let active = true;
        let objectUrl: string | undefined;

        const fetchImage = async () => {
            setIsLoading(true);
            setError(false);

            try {
                // Strategy 1: corsproxy.io (Direct proxy, handles long URLs better)
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(src)}`;

                let response = await fetch(proxyUrl);

                if (!response.ok) {
                    // Strategy 2: weserv.nl (Backup, good caching but strict length limits)
                    // console.warn('Corsproxy failed, trying weserv.nl');
                    const fallbackUrl = `https://images.weserv.nl/?url=${encodeURIComponent(src)}&output=png`;
                    response = await fetch(fallbackUrl);
                }

                if (!response.ok) {
                    throw new Error('All image proxies failed');
                }

                const blob = await response.blob();

                if (active) {
                    objectUrl = URL.createObjectURL(blob);
                    setImageSrc(objectUrl);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("useSafeImage failed:", err);
                if (active) {
                    setError(true);
                    setIsLoading(false);
                    // Fallback to placeholder is handled by component, or we can return a placeholder blob here
                }
            }
        };

        fetchImage();

        return () => {
            active = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [src]);

    return { imageSrc, isLoading, error };
}
