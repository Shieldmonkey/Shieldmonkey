import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifestChrome from './src/manifest.json'
import manifestFirefox from './src/manifest.firefox.json'

const manifest = process.env.TARGET_BROWSER === 'firefox' ? manifestFirefox : manifestChrome;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins = [
    react(),
    crx({ manifest }),
  ];

  return {
    plugins,
    define: {
      '__DEV__': mode === 'development'
    },
    build: {
      outDir: process.env.TARGET_BROWSER === 'firefox' ? 'dist-firefox' : 'dist',
      minify: process.env.ENABLE_MINIFY === 'true',
      sourcemap: process.env.DISABLE_SOURCEMAP === 'true' ? false : true,
      rollupOptions: {
        input: {
        }
      }
    }
  };
})
