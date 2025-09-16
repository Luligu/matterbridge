// Vite configuration file for a React project

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks(id) {
          if (id.includes('@mdi')) {
            return 'vendor_mdi';
          }
          if (id.includes('@mui')) {
            return 'vendor_mui';
          }
          if (id.includes('@emotion')) {
            return 'vendor_emotion';
          }
          if (id.includes('@rjsf')) {
            return 'vendor_rjsf';
          }
          if (id.includes('notistack')) {
            return 'vendor_notistack';
          }
          if (id.includes('qrcode.react')) {
            return 'vendor_qrcode';
          }
          if (id.includes('react-table')) {
            return 'vendor_react_table';
          }
          if (id.includes('lodash')) {
            return 'vendor_lodash';
          }
          if (id.includes('node_modules')) {
            return 'vendor_node_modules';
          }
          return null;
        }
      }
    }
  }
});