import React, { useEffect, useRef, useState } from 'react';
import { playgroundHtml } from './playgroundHtml';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

function createAdaptedHtml(initialKeys: any) {
    return playgroundHtml.replace(
        '</head>',
        `<style>
          header .logo-badge, header h1, header .subtitle { display: none !important; }
          header { margin-bottom: 20px !important; }
          body { 
            background-color: transparent !important; 
            background-image: none !important; 
            padding: 0 16px 64px !important; 
            overflow: hidden !important; 
          }
          ::-webkit-scrollbar { display: none; }
          .card { 
            box-shadow: none !important; 
            border: none !important; 
            background-color: transparent !important;
            padding: 0 !important;
            max-width: 1000px !important;
            margin: 0 auto !important;
          }
        </style>
        <script>
          const initialPlaygroundKeys = ${JSON.stringify(initialKeys || {})};
          let appKeys = { ...initialPlaygroundKeys };

          window.onload = () => {
            const ro = new ResizeObserver(() => {
              window.parent.postMessage({ type: 'iframe-resize', height: document.documentElement.scrollHeight }, '*');
            });
            ro.observe(document.body);

            // Listen to typing to notify React parent
            document.addEventListener('input', (e) => {
               if (e.target.id === 'api-key-input' || e.target.id === 'vertex-token') {
                   const lblBtnText = document.querySelector('.provider-tab.active')?.textContent || '';
                   let field = '';
                   if (lblBtnText.includes('OpenAI')) field = 'playground_openai_key';
                   if (lblBtnText.includes('Google') || lblBtnText.includes('Nano Banana')) field = 'playground_google_key';
                   if (lblBtnText.includes('Vertex')) {
                      if (e.target.id === 'api-key-input') field = 'playground_vertex_project';
                      if (e.target.id === 'vertex-token') field = 'playground_vertex_token';
                   }

                   if (field) {
                      appKeys[field] = e.target.value;
                      window.parent.postMessage({ type: 'save-key', keys: appKeys }, '*');
                   }
               }
            });

            // Watch for UI provider changes to autofill the inputs contextually
            const observer = new MutationObserver(() => {
                const lbl = document.getElementById('api-key-label')?.textContent || '';
                const inp = document.getElementById('api-key-input');
                const tInp = document.getElementById('vertex-token');
                if (!inp) return;
                
                if (lbl.includes('OpenAI')) {
                   inp.value = appKeys.playground_openai_key || '';
                } else if (lbl.includes('Google') || lbl.includes('Nano Banana')) {
                   inp.value = appKeys.playground_google_key || '';
                } else if (lbl.includes('Vertex')) {
                   inp.value = appKeys.playground_vertex_project || '';
                   if (tInp) tInp.value = appKeys.playground_vertex_token || '';
                } else {
                   // cloudflare uses default optional or none
                }
            });

            // Start observer
            const lblNode = document.getElementById('api-key-label');
            if (lblNode) {
                 observer.observe(lblNode, { childList: true, characterData: true, subtree: true });
                 // force trigger 
                 let triggerEvent = new Event('change');
                 lblNode.dispatchEvent(triggerEvent); // fake event just to poke, but we can do manual update
                 
                 const pTab = window.currentProvider; // might be undefined, fallback manual trigger check
                 setTimeout(() => {
                       const lblTxt = document.getElementById('api-key-label')?.textContent || '';
                       const inp = document.getElementById('api-key-input');
                       if (lblTxt.includes('OpenAI') && inp) inp.value = appKeys.playground_openai_key || '';
                       else if ((lblTxt.includes('Google') || lblTxt.includes('Nano')) && inp) inp.value = appKeys.playground_google_key || '';
                       else if (lblTxt.includes('Vertex') && inp) {
                           inp.value = appKeys.playground_vertex_project || '';
                           const tInp = document.getElementById('vertex-token');
                           if (tInp) tInp.value = appKeys.playground_vertex_token || '';
                       }
                 }, 300);
            }
          };
        </script>
        </head>`
    );
}

export function PlaygroundPage() {
    const { user } = useAuth();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    const [loading, setLoading] = useState(true);
    const [htmlDoc, setHtmlDoc] = useState('');
    const saveTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        async function fetchKeys() {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('user_preferences')
                    .select('playground_openai_key, playground_google_key, playground_vertex_project, playground_vertex_token')
                    .eq('user_id', user?.id)
                    .single();
                
                // Construct the HTML with fetched data (or empty if none or error)
                setHtmlDoc(createAdaptedHtml(data || {}));
            } catch (err) {
                console.error("Error fetching playground keys:", err);
                setHtmlDoc(createAdaptedHtml({}));
            }
            setLoading(false);
        }
        fetchKeys();
    }, [user?.id]);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data?.type === 'iframe-resize' && iframeRef.current) {
                iframeRef.current.style.height = `${e.data.height}px`;
            } else if (e.data?.type === 'save-key') {
                // Debounce the save mechanism to 1.5 seconds after user stops typing
                if (saveTimeout.current) clearTimeout(saveTimeout.current);
                saveTimeout.current = setTimeout(async () => {
                    try {
                        const { error } = await supabase
                            .from('user_preferences')
                            .upsert({
                                user_id: user?.id,
                                ...e.data.keys
                            }, { onConflict: 'user_id' });
                        if (error) {
                            console.error("Error saving playground keys:", error);
                            alert("Erro ao salvar no banco! Verifique se as colunas (playground_openai_key, etc) foram realmente criadas no Supabase.\n" + error.message);
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }, 1500);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [user?.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col -mx-6 lg:-mx-8">
            <iframe 
                ref={iframeRef}
                srcDoc={htmlDoc} 
                className="w-full border-none transition-all duration-200"
                style={{ height: '100vh', minHeight: '800px' }} // Initial height before resize kicks in
                title="Magic Story Studio Playground"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                scrolling="no"
            />
        </div>
    );
}
