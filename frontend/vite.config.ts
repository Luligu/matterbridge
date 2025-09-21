// Vite configuration file for a React project

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  base: './', // or '' for relative paths
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
          if (id.includes('/@rjsf/') || id.includes('/ajv/') || id.includes('/ajv-formats/') || id.includes('/json-schema-compare/') || id.includes('/json-schema-traverse/') || id.includes('/json-schema-merge-allof/')) {
            return 'vendor_rjsf';
          }
          if (id.includes('notistack')) {
            return 'vendor_notistack';
          }
          if (id.includes('qrcode.react')) {
            return 'vendor_qrcode';
          }
          if (id.includes('lodash')) {
            return 'vendor_lodash';
          }
          if (id.includes('node_modules')) {
            // console.log('node_modules chunk:', id);
            return 'vendor_node_modules';
          }
          return null;
        }
      }
    }
  }
});