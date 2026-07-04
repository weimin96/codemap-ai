import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    // The application shell is route-split. Remaining large chunks are lazy Mermaid
    // renderer internals loaded only when a diagram is rendered.
    chunkSizeWarningLimit: 700
  }
});
