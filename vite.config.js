import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            // Forward API calls to the FastAPI backend (uvicorn on :8000),
            // avoiding CORS during development.
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
            // WebSocket for streaming voice transcription. ws:true enables
            // proxying the upgrade; path is preserved (/ws/transcribe).
            '/ws': {
                target: 'ws://localhost:8000',
                ws: true,
                changeOrigin: true,
            },
        },
    },
});
