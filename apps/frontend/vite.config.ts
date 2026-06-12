// Vite/Vitest configuration file for a React project

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const debugBuild = mode === 'debug';

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      // Disable Node's experimental built-in webstorage so the jsdom `localStorage` is used.
      // It is a Node bootstrap flag, so it must be passed to the pool worker processes (where
      // the tests run) via execArgv rather than set from within this config at runtime.
      execArgv: ['--no-experimental-webstorage'],
    },
    base: './', // or '' for relative paths
    build: {
      sourcemap: debugBuild,
      minify: debugBuild ? false : undefined,
      outDir: 'build',
      emptyOutDir: true,
      rolldownOptions: {
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
            if (id.includes('/@rjsf/') || id.includes('/ajv/') || id.includes('/ajv-formats/') || id.includes('/json-schema-compare/') || id.includes('/json-schema-traverse/') || id.includes('/json-schema-merge/')) {
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
          },
        },
      },
    },
  };
});
