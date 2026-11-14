import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the large channel list and the libraries out of the app's own script
        manualChunks(id) {
          if (id.includes('seedChannels.json')) return 'channels';
          if (id.includes('node_modules')) return id.includes('mpegts') ? 'mpegts' : 'vendor';
          return undefined;
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    open: false
  },
  test: {
    globals: true,
    environment: 'node'
  }
});
