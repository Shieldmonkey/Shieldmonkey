import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import manifest from './src/manifest.json'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins = [
    react(),
    crx({ manifest }),
  ];

  if (mode === 'development') {
    plugins.push(
      viteStaticCopy({
        targets: [
          {
            src: 'examples',
            dest: '.'
          }
        ]
      })
    );
  }

  return {
    plugins,
    define: {
      '__DEV__': mode === 'development'
    },
    build: {
      minify: process.env.ENABLE_MINIFY === 'true',
      sourcemap: process.env.DISABLE_SOURCEMAP === 'true' ? false : true,
      rollupOptions: {
        input: {
          install: 'src/install/index.html'
        }
      }
    }
  };
})
