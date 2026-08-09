import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
    base: '/admin/',
    plugins: [react(), tailwindcss()],
    publicDir: false,
    resolve: {alias: {
        '@': path.resolve(__dirname, './src'),
        '@admin': path.resolve(__dirname, './src/admin'),
    }},
    build: {
        outDir: path.resolve(__dirname, 'dist/admin'),
        emptyOutDir: true,
        assetsDir: 'assets',
    },
    server: {
        port: 5174,
        proxy: {'/api/': {target: 'http://localhost:8080/', changeOrigin: true}},
    },
});
