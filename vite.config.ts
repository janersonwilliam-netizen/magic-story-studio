import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/vertex': {
          target: 'https://vertex-image-service-498496800797.us-central1.run.app',
          changeOrigin: true,
          headers: {
            'X-Vertex-Secret': 'mss-secret-2024'
          }
        }
      },
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'VITE_VERTEX_AI_URL': JSON.stringify(env.VITE_VERTEX_AI_URL),
      'VITE_VERTEX_AI_SECRET': JSON.stringify(env.VITE_VERTEX_AI_SECRET),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
