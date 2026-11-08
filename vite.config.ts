import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          lucide: ['lucide-react'],
        },
      },
    },
    target: 'ES2022',
    sourcemap: 'hidden',
    cssMinify: 'esbuild',
  },
});
